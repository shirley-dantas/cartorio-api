// ══ A REDE — varredura das minutas ══════════════════════════════════════
// Cole este código no MESMO projeto cartorio-drive-api em script.google.com,
// como um arquivo novo (Arquivo › Novo › Script, nome "cartorio-rede").
// Ele usa o PASTA_RAIZ_ID, o NOME_PASTA_MINUTAS e o FIREBASE_URL que já estão
// no cartorio-drive-api.js — por isso precisa morar no mesmo projeto.
//
// O QUE ELE FAZ
// Lê as minutas do Drive, tira de cada uma as pessoas com nome e profissão, e
// grava em /rede/pessoas do Firebase. O painel só lê o que ele escreveu.
//
// AS TRÊS REGRAS QUE A SHIRLEY PEDIU, E QUE NÃO DEVEM SER MEXIDAS SEM PERGUNTAR
//
//  1. CADA PESSOA ENTRA UMA VEZ. A mesma gerente da construtora assina dezenas
//     de escrituras. Quem já está em /rede/pessoas não é lido de novo: só ganha
//     mais um ato no contador e a data nova. É isso que faz a varredura ficar
//     mais barata a cada rodada, em vez de mais cara.
//
//  2. SÓ ENTRA QUEM TEM CARA DE RAMO IMOBILIÁRIO. Corretor, gerente de carteira,
//     relacionamento com cliente, incorporadora, engenheiro, arquiteto, advogado
//     de imobiliário. A bibliotecária e o aposentado ficam gravados, marcados
//     como fora do ramo — não somem, só não ocupam a fila da manhã.
//     Cargo que a IA não souber julgar vira "duvidoso" e espera a Shirley
//     decidir na tela. Descarte calado é onde a rede perde gente boa.
//
//  3. O CPF NÃO VEM PARA O BANCO. Ele já mora na minuta, no Drive, e continua
//     sendo de lá. Aqui ele só serve para saber que a Letícia de hoje é a mesma
//     de março: passa por uma conta de mão única (HMAC com uma chave secreta) e
//     o que fica guardado é o resultado dela. Do resultado não se volta ao
//     número. Ver impressaoDigital() lá embaixo.
//
// CONFIGURAÇÃO — três coisas, uma vez só
//
//  a) PROPRIEDADE DO SCRIPT: Configurações do projeto › Propriedades do script
//     REDE_CHAVE = qualquer texto longo e aleatório, guardado. É a chave da
//     impressão digital. Se ela mudar, todo mundo vira gente nova e o cadastro
//     duplica — então escolha uma e não troque.
//     (O ANTHROPIC_API_KEY já deve estar aí, do cartorio-drive-api.)
//
//  b) ESCOPOS: Configurações do projeto › marque "Mostrar arquivo de manifesto
//     appsscript.json" e acrescente em oauthScopes:
//       "https://www.googleapis.com/auth/firebase.database",
//       "https://www.googleapis.com/auth/userinfo.email"
//     É o que permite gravar no /rede, que está fechado nas regras. O token sai
//     da conta da própria Shirley, que é dona do projeto do Firebase — não
//     precisa criar conta de serviço nenhuma.
//
//  c) GATILHO: rode uma vez a função criarGatilhoDaRede() e a varredura passa
//     a acontecer sozinha toda madrugada.
//
// PARA TESTAR NA MÃO: rode varrerRede() e veja o registro em Execuções.
// A primeira rodada demora (lê tudo); as seguintes são rápidas.
// ═════════════════════════════════════════════════════════════════════════

// Quanto de cada minuta vai para a IA. A qualificação das partes mora toda no
// começo do documento — o resto são cláusulas, certidões e o encerramento, que
// não dizem quem é ninguém e só custariam tempo.
const REDE_PEDACO = 14000;

// Teto por rodada, para uma varredura não virar uma hora de execução (o Apps
// Script corta em 30 minutos e perderia o trabalho todo). O que sobrar fica
// para a rodada seguinte — é por isso que ele guarda o que já leu.
const REDE_MAX_POR_RODADA = 25;

// Quem aparece em toda minuta e não é rede: a própria casa e as serventias.
const REDE_FORA = [
  "shirley dantas", "tabeliao", "tabelião", "substituto legal",
  "oficial de registro", "registro de imoveis", "registro de imóveis",
  "escrevente", "20o tabeliao", "20º tabelião"
];

const REDE_EXTRACAO = [
  'Você lê minutas de escritura pública brasileira e devolve APENAS um JSON, sem comentário e sem cerca de código.',
  '',
  'Formato exato:',
  '{"ato":"...","data":"AAAA-MM-DD ou vazio","pessoas":[{"nome":"","cpf":"","profissao":"","empresa":"","papel":"","bairro":"","cidade":"","uf":"","ramo":"sim|nao|duvidoso","motivo":""}]}',
  '',
  'REGRAS:',
  '- "pessoas" traz as PARTES e quem comparece por elas: comprador, vendedor, cônjuge,',
  '  procurador de empresa, corretor, advogado, anuente, inventariante, herdeiro.',
  '- NUNCA inclua o escrevente, o tabelião, o substituto legal, nem os cartórios e',
  '  oficiais de registro citados no texto. Eles aparecem em toda minuta e não são rede.',
  '- "cpf": só os dígitos, sem ponto nem traço. Se não houver, string vazia.',
  '- "profissao": exatamente como está escrito na qualificação ("gerente financeira",',
  '  "bibliotecária", "aposentado"). Se o documento traz o campo em branco, ou com',
  '  traços, devolva string vazia — NÃO invente e NÃO deduza pela empresa.',
  '- "empresa": só quando a pessoa comparece por uma pessoa jurídica (procurador,',
  '  representante, sócio). Para parte física comum, string vazia.',
  '- "bairro"/"cidade"/"uf": do endereço RESIDENCIAL da pessoa. Se ela só tem endereço',
  '  comercial, use o comercial. Se não houver endereço, deixe vazio. UF com duas letras.',
  '- "ramo": "sim" se a profissão tem a ver com imóveis — corretor, CRECI, incorporadora,',
  '  construtora, gerente de carteira, relacionamento com cliente de incorporadora,',
  '  engenheiro civil, arquiteto, advogado de direito imobiliário, administradora,',
  '  crédito imobiliário, síndico profissional. "nao" para profissão claramente de fora',
  '  (bibliotecária, dentista, aposentado, professor). "duvidoso" quando a profissão',
  '  está vazia, ou é genérica demais para julgar ("empresário", "administrador",',
  '  "sócio", "autônomo").',
  '- "motivo": só quando ramo="sim". Uma frase curta dizendo por que vale a conversa,',
  '  falando da pessoa, não do documento. Nos outros casos, string vazia.',
  '',
  'Se não houver nenhuma pessoa aproveitável, devolva {"ato":"","data":"","pessoas":[]}.'
].join('\n');

// ── Firebase com a conta da dona ─────────────────────────────────────────
// O /rede está fechado nas regras (só a conta dona lê e escreve). Este token
// é da conta que roda o script — a mesma Shirley, dona do projeto —, então
// passa. É por isso que os escopos do item (b) lá em cima são obrigatórios:
// sem eles o token não serve para o banco e tudo volta 401.
function redeFetchFirebase(caminho, metodo, corpo) {
  const opcoes = {
    method: metodo,
    contentType: "application/json",
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  };
  if (corpo !== undefined) opcoes.payload = JSON.stringify(corpo);

  const r = UrlFetchApp.fetch(FIREBASE_URL + caminho + ".json", opcoes);
  const codigo = r.getResponseCode();
  if (codigo === 401 || codigo === 403) {
    throw new Error(
      "O Firebase recusou (" + codigo + "). Quase sempre é escopo faltando: " +
      "abra Configurações do projeto, mostre o appsscript.json e confirme que " +
      "firebase.database e userinfo.email estão em oauthScopes. Depois rode a " +
      "função de novo e aceite a permissão nova."
    );
  }
  if (codigo >= 400) throw new Error("Firebase respondeu " + codigo + ": " + r.getContentText().slice(0, 200));
  const txt = r.getContentText();
  return txt === "null" || !txt ? null : JSON.parse(txt);
}

// ── A impressão digital do CPF ───────────────────────────────────────────
// Conta de mão única: do resultado não se volta ao número. A chave secreta é
// o que faz isso valer alguma coisa — sem ela, existem só cem bilhões de CPFs
// possíveis e qualquer computador testaria todos até achar qual bate.
function impressaoDigital(cpf) {
  const chave = PropertiesService.getScriptProperties().getProperty("REDE_CHAVE");
  if (!chave) {
    throw new Error(
      "Falta a REDE_CHAVE nas Propriedades do script. Escolha um texto longo e " +
      "aleatório, guarde, e não troque depois: trocar faz todo mundo virar gente " +
      "nova e o cadastro duplicar."
    );
  }
  const bytes = Utilities.computeHmacSha256Signature(String(cpf), chave);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    let b = (bytes[i] + 256) % 256;
    hex += (b < 16 ? "0" : "") + b.toString(16);
  }
  return hex.slice(0, 24);
}

// Sem CPF não dá para reconhecer a pessoa com segurança. Em vez de descartar,
// usa nome + cidade como chave — pior, mas honesta: fica marcado que a
// identificação foi pelo nome, e nome comum pode juntar duas pessoas.
function redeChaveDaPessoa(p) {
  const cpf = String(p.cpf || "").replace(/\D/g, "");
  if (cpf.length === 11) return { id: impressaoDigital(cpf), porNome: false };
  const crua = redeSemAcento(p.nome) + "|" + redeSemAcento(p.cidade || "");
  return { id: "n" + impressaoDigital(crua).slice(0, 20), porNome: true };
}

function redeSemAcento(t) {
  return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function redeEhDaCasa(nome, profissao) {
  const alvo = redeSemAcento(nome) + " " + redeSemAcento(profissao);
  return REDE_FORA.some(function (t) { return alvo.indexOf(redeSemAcento(t)) !== -1; });
}

// ── A leitura de uma minuta ──────────────────────────────────────────────
function redeLerMinuta(texto) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");

  const r = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: REDE_EXTRACAO,
      messages: [{ role: "user", content: texto.slice(0, REDE_PEDACO) }]
    }),
    muteHttpExceptions: true
  });

  const data = JSON.parse(r.getContentText());
  if (data.error) throw new Error("Claude: " + (data.error.message || JSON.stringify(data.error)));

  let cru = (data.content[0].text || "").trim();
  // Mesmo pedindo JSON puro, de vez em quando vem embrulhado em cerca de código.
  const abre = cru.indexOf("{");
  const fecha = cru.lastIndexOf("}");
  if (abre === -1 || fecha === -1) return { ato: "", data: "", pessoas: [] };
  try {
    return JSON.parse(cru.slice(abre, fecha + 1));
  } catch (e) {
    Logger.log("JSON quebrado na leitura: " + cru.slice(0, 200));
    return { ato: "", data: "", pessoas: [] };
  }
}

// ── A varredura ──────────────────────────────────────────────────────────
function varrerRede() {
  const jaLidas = redeFetchFirebase("/rede/lidas", "get") || {};
  const pessoas = redeFetchFirebase("/rede/pessoas", "get") || {};

  const pastaMinutas = getPastaMinutasIA();
  const pastas = pastaMinutas.getFolders();
  let lidasAgora = 0, novas = 0, repetidas = 0;

  while (pastas.hasNext() && lidasAgora < REDE_MAX_POR_RODADA) {
    const pasta = pastas.next();
    const docs = pasta.getFilesByType(MimeType.GOOGLE_DOCS);

    while (docs.hasNext() && lidasAgora < REDE_MAX_POR_RODADA) {
      const doc = docs.next();
      if (doc.getName().toUpperCase().indexOf("MINUTA") !== 0) continue;

      // Já lida e não mexida desde então: pula sem gastar uma chamada de IA.
      const marca = doc.getLastUpdated().toISOString();
      const id = doc.getId();
      if (jaLidas[id] && jaLidas[id].em === marca) continue;

      let texto;
      try {
        texto = DocumentApp.openById(id).getBody().getText();
      } catch (e) {
        Logger.log("Não consegui abrir " + doc.getName() + ": " + e);
        continue;
      }

      const lido = redeLerMinuta(texto);
      lidasAgora++;

      const quando = lido.data || marca.slice(0, 10);
      const ato = lido.ato || "Escritura";
      // O nome da pasta guarda de onde veio o caso — construtora, parceiro ou
      // o próprio cliente. Sai errado às vezes, e é por isso que a tela tem
      // lápis: a correção da Shirley mora em /correcoes e nunca é desfeita aqui.
      const origem = pasta.getName();

      (lido.pessoas || []).forEach(function (p) {
        if (!p || !p.nome) return;
        if (redeEhDaCasa(p.nome, p.profissao)) return;

        const chave = redeChaveDaPessoa(p);
        const antiga = pessoas[chave.id];

        if (antiga) {
          // REGRA 1: não relê. Só conta mais um ato e atualiza a data.
          repetidas++;
          const atos = (antiga.atos || 1) + 1;
          redeFetchFirebase("/rede/pessoas/" + chave.id, "patch", {
            atos: atos,
            ultima: quando > (antiga.ultima || "") ? quando : antiga.ultima,
            ultimoAto: quando > (antiga.ultima || "") ? ato : antiga.ultimoAto
          });
          pessoas[chave.id] = Object.assign({}, antiga, { atos: atos });
          return;
        }

        novas++;
        const nova = {
          nome: p.nome,
          cargo: p.profissao || "",
          empresa: p.empresa || "",
          origem: origem,
          papel: p.papel || "",
          bairro: p.bairro || "",
          cidade: p.cidade || "",
          uf: (p.uf || "").toUpperCase().slice(0, 2),
          // REGRA 2: quem a IA não soube julgar espera decisão, não some.
          ramo: (p.ramo === "sim" || p.ramo === "nao") ? p.ramo : "duvidoso",
          motivo: p.motivo || "",
          atos: 1,
          primeira: quando,
          ultima: quando,
          ultimoAto: ato,
          situacao: "olhar",
          porNome: chave.porNome || false
        };
        redeFetchFirebase("/rede/pessoas/" + chave.id, "put", nova);
        pessoas[chave.id] = nova;
      });

      redeFetchFirebase("/rede/lidas/" + id, "put", { em: marca, pasta: pasta.getName() });
    }
  }

  redeFetchFirebase("/rede/meta", "patch", {
    ultimaVarredura: new Date().toISOString(),
    ultimoResultado: lidasAgora + " minutas · " + novas + " novas · " + repetidas + " repetidas"
  });

  const resumo = "Rede: li " + lidasAgora + " minuta(s), " + novas +
    " pessoa(s) nova(s), " + repetidas + " repetição(ões) que não precisei reler.";
  Logger.log(resumo);
  return resumo;
}

// ── O gatilho ────────────────────────────────────────────────────────────
// Rode uma vez, na mão. Depois a varredura acontece sozinha de madrugada.
function criarGatilhoDaRede() {
  ScriptApp.getProjectTriggers().forEach(function (g) {
    if (g.getHandlerFunction() === "varrerRede") ScriptApp.deleteTrigger(g);
  });
  ScriptApp.newTrigger("varrerRede").timeBased().atHour(4).everyDays(1).create();
  return "Pronto: a Rede passa a ler as minutas todo dia por volta das 4h.";
}

// Para recomeçar do zero (apaga o que foi lido e o cadastro, não as minutas).
// Serve para quando a REDE_CHAVE tiver que mudar, ou para refazer uma leitura
// que saiu torta. ATENÇÃO: leva junto as correções e anotações da Shirley.
function zerarRede() {
  redeFetchFirebase("/rede", "delete");
  return "Rede zerada. A próxima varredura lê tudo de novo.";
}
