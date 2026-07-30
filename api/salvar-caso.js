const https = require("https");

// ══ CONFIGURAÇÕES ══════════════════════════════════════════════
const EVOLUTION_INSTANCE = "escritorio";
const EVOLUTION_API_KEY = "escritorio@2025#EvAPI";
const EVOLUTION_HOST = "evolution-api-production-59b1.up.railway.app";
const FIREBASE_HOST = "painel-cartorio-default-rtdb.firebaseio.com";
const DRIVE_URL = "https://script.google.com/macros/s/AKfycbz6NoiizP5ThvPWZ1ZZ_HAvJworawPrmfzCAXyCfY2n9oB8Qx4oFfYw0trGgm5liXHY/exec";
const NUMERO_OPERACIONAL = "5511947851816";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// ═══════════════════════════════════════════════════════════════

function normalizar(texto) {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// Lê a resposta da pergunta explícita de modalidade (nunca adivinha a partir
// do texto do tipo de ato — modalidades erradas viravam abertura/encerramento
// errado na minuta).
function detectarModalidadeEscolhida(texto) {
  const t = normalizar(texto);
  if (/^1\b/.test(t) || /\bdigital\b/.test(t)) return "digital";
  if (/^2\b/.test(t) || /hibrid/.test(t)) return "hibrida";
  if (/^3\b/.test(t) || /presencial/.test(t)) return "presencial";
  return null;
}

function classificarServico(texto) {
  const t = normalizar(texto);
  if (/inventario|espolio|faleceu|falecimento|heranca|herdeiro|partilha|sobrepartilha/.test(t)) return "Inventário";
  if (/compra|venda|escritura|imovel|apartamento|terreno|casa/.test(t)) return "Escritura de Compra e Venda";
  if (/procuracao|procurador/.test(t)) return "Procuração";
  if (/uniao estavel|convivencia|companheiro|companheira/.test(t)) return "União Estável";
  if (/divorcio|separacao|dissolucao/.test(t)) return "Divórcio";
  if (/ata notarial|ata de/.test(t)) return "Ata Notarial";
  if (/doacao|doou|doar/.test(t)) return "Doação";
  if (/cessao|direitos hereditarios|ceder direitos/.test(t)) return "Cessão de Direitos";
  if (/pacto|antenupcial/.test(t)) return "Pacto Antenupcial";
  if (/testamento/.test(t)) return "Testamento";
  if (/reconhecimento de firma|reconhecer firma|firma/.test(t)) return "Reconhecimento de Firma";
  if (/autenticacao|autenticar|copia autenticada/.test(t)) return "Autenticação";
  if (/renuncia|renunciar|renunciante/.test(t)) return "Renúncia";
  if (/dacao|dacao em pagamento/.test(t)) return "Dação em Pagamento";
  if (/alienacao fiduciaria/.test(t)) return "Alienação Fiduciária";
  if (/usucapiao/.test(t)) return "Usucapião";
  if (/regularizacao/.test(t)) return "Regularização Imobiliária";
  return "A classificar";
}

function ehLegendaModelo(texto) {
  const t = normalizar(texto);
  return /\bmodelo\b/.test(t);
}

function classificarUrgencia(texto) {
  const t = normalizar(texto);
  const alta = ["urgente","urgencia","hoje","agora","imediato","imediata","amanha","prazo","vencendo","vencido","vence","emergencia","rapido","rapida","preciso ja","preciso hoje"];
  const baixa = ["quando puder","sem pressa","consulta","informacao","quanto custa","valor","preco","tabela","gostaria de saber","quero saber"];
  const a = alta.find(p => t.includes(p));
  if (a) return { status: "critico", motivo: `Urgência alta: "${a}"` };
  const b = baixa.find(p => t.includes(p));
  if (b) return { status: "emdia", motivo: `Consulta/informação: "${b}"` };
  return { status: "atencao", motivo: "Urgência padrão" };
}

function httpReq(url, method, body, headers = {}) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = { method, headers: { "Content-Type": "application/json", ...headers } };
    if (payload) options.headers["Content-Length"] = Buffer.byteLength(payload);
    const r = https.request(url, options, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    r.on("error", () => resolve(null));
    if (payload) r.write(payload);
    r.end();
  });
}

// ══ SESSÃO DO DIÁLOGO GUIADO ═════════════════════════════════════
// Só existe UM atendimento guiado ativo por vez na janela (o WhatsApp
// não distingue de qual PC/pessoa partiu a mensagem). A identificação
// de quem está falando serve para registrar o responsável no card, e
// para o sistema perguntar antes de sobrepor um atendimento em curso.

async function getSessao() {
  return httpReq(`https://${FIREBASE_HOST}/sessao_ativa.json`, "GET");
}
async function setSessao(sessao) {
  return httpReq(`https://${FIREBASE_HOST}/sessao_ativa.json`, "PUT", { ...sessao, ultimaInteracao: new Date().toISOString() });
}
async function clearSessao() {
  return httpReq(`https://${FIREBASE_HOST}/sessao_ativa.json`, "DELETE");
}

// Guarda a última mensagem que o próprio bot mandou, para detectar e
// ignorar o eco dela quando ela retorna pelo webhook (ver comentário
// acima de enviarTexto).
async function getUltimoEnvioBot() {
  return httpReq(`https://${FIREBASE_HOST}/bot_ultimo_envio.json`, "GET");
}
async function marcarUltimoEnvioBot(texto) {
  return httpReq(`https://${FIREBASE_HOST}/bot_ultimo_envio.json`, "PUT", { texto: texto.trim(), ts: new Date().toISOString() });
}

function sessaoExpirada(sessao) {
  if (!sessao?.ultimaInteracao) return false;
  const minutos = (Date.now() - new Date(sessao.ultimaInteracao).getTime()) / 60000;
  return minutos > 30;
}

function ehSaudacao(texto) {
  const t = normalizar(texto);
  return /^(oi|ola|bom dia|boa tarde|boa noite|inicio|iniciar)\b/.test(t);
}

function detectarPessoa(texto) {
  const t = normalizar(texto);
  // "1"/"2" respondem à ordem em que as opções são listadas em enviarBotoes.
  if (/^1\b/.test(t) || /shirley/.test(t)) return "Shirley";
  if (/^2\b/.test(t) || /grazi/.test(t)) return "Grazi";
  return null;
}

function respostaAfirmativa(texto) {
  const t = normalizar(texto);
  // "1" responde à primeira opção listada em enviarBotoes, que é sempre a
  // afirmativa/principal (Sim, Tem mais, Continuar etc.).
  return /^(1|sim|s|ok|pode|manda|continuar)\b/.test(t);
}
function respostaNegativa(texto) {
  const t = normalizar(texto);
  // "2" responde à segunda opção listada em enviarBotoes, sempre a
  // negativa/alternativa (Não, Pode seguir, Encerrar etc.).
  return /^(2|nao|n|cancelar|parar)\b/.test(t);
}
function ehPular(texto) {
  const t = normalizar(texto);
  return /^(pular|pula|nenhum|nenhuma|nao tenho|sem documento|nao vou anexar)\b/.test(t);
}

// Similaridade simples por distância de edição — evita depender de
// biblioteca externa só para tolerar erro de digitação/acento.
function distanciaEdicao(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = a[i - 1] === b[j - 1]
        ? d[i - 1][j - 1]
        : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
    }
  }
  return d[m][n];
}

async function buscarTodosCasosAbertos() {
  const data = await httpReq(`https://${FIREBASE_HOST}/casos.json`, "GET");
  if (!data || typeof data !== "object") return [];
  return Object.entries(data)
    .filter(([, c]) => c && !c.concluido && c.nome)
    .map(([id, c]) => ({ ...c, id }));
}

// Retorna: { tipo: "exato" } | { tipo: "aproximado", caso } | { tipo: "nenhum" }
async function buscarCasoPorNome(texto) {
  const casos = await buscarTodosCasosAbertos();
  const norm = normalizar(texto);
  const exato = casos.find(c => normalizar(c.nome).includes(norm) || norm.includes(normalizar(c.nome)));
  if (exato) return { tipo: "exato", caso: exato };

  let melhor = null;
  let melhorDist = Infinity;
  for (const c of casos) {
    const dist = distanciaEdicao(norm, normalizar(c.nome));
    if (dist < melhorDist) { melhorDist = dist; melhor = c; }
  }
  // tolera até ~35% de diferença de caracteres
  if (melhor && melhorDist <= Math.ceil(norm.length * 0.35)) {
    return { tipo: "aproximado", caso: melhor };
  }
  return { tipo: "nenhum" };
}

async function baixarMidia(dadosEvt) {
  return httpReq(
    `https://${EVOLUTION_HOST}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`,
    "POST",
    { message: dadosEvt, convertToMp4: false },
    { apikey: EVOLUTION_API_KEY }
  );
}
async function salvarNoDrive(nome, nomeArquivo, base64, mimetype) {
  return httpReq(DRIVE_URL, "POST", { acao: "salvar-arquivo", nome, nomeArquivo, base64, mimetype });
}
async function criarPastaDrive(nome, tipo) {
  return httpReq(DRIVE_URL, "POST", { acao: "criar-pasta", nome, tipo });
}

// ══ MENSAGENS PARA O WHATSAPP (texto simples com opções numeradas) ═
// Botões interativos (/message/sendButtons) foram tentados antes, mas
// na conexão Baileys/WhatsApp Web da Evolution API eles têm um bug
// conhecido: a API responde sucesso, mas a mensagem nunca chega no
// celular. Por isso as opções são mandadas como texto numerado — o
// destinatário pode responder digitando o número ou o nome da opção,
// já que a leitura das respostas (respostaAfirmativa, detectarPessoa
// etc.) sempre foi por texto livre, nunca por clique de botão.
async function enviarTexto(texto) {
  await marcarUltimoEnvioBot(texto);
  return httpReq(
    `https://${EVOLUTION_HOST}/message/sendText/${EVOLUTION_INSTANCE}`,
    "POST",
    { number: NUMERO_OPERACIONAL, text: texto },
    { apikey: EVOLUTION_API_KEY }
  );
}
async function enviarBotoes(texto, opcoes) {
  const lista = opcoes.map((o, i) => `${i + 1}. ${o}`).join("\n");
  return enviarTexto(`${texto}\n${lista}`);
}

// ══ GERAÇÃO AUTOMÁTICA DE MINUTA (igual à versão anterior) ═══════

const SYSTEM_PROMPT_MINUTA = `Você é o Assistente Jurídico-Cartorário do 20º Cartório de Notas de São Paulo.

Ao analisar um caso, você simula simultaneamente o trabalho de um Registrador de Imóveis, Tabelião de Notas, Escrevente altamente qualificado e Analista Documental Imobiliário.

Gere a minuta notarial completa e profissional do ato, no padrão de escritura pública brasileira, realizando análise documental completa com todos os apontamentos necessários.

REGRAS FUNDAMENTAIS:
- Nunca assuma informações inexistentes
- Nunca preencha lacunas sem evidência documental
- Preencha todos os campos que tiverem informação disponível
- Campos desconhecidos: use apenas traços: ______
- NÃO use colchetes ou texto descritivo para campos em branco — apenas ______

NOMENCLATURA DAS PARTES (use sempre a correta para o ato):
- Compra e Venda: VENDEDOR(A) e COMPRADOR(A)
- Doação: DOADOR(A) e DONATÁRIO(A)
- Procuração: OUTORGANTE e OUTORGADO(A)
- Inventário: INVENTARIANTE, HERDEIRO(A), VIÚVO(A) MEEIRO(A)
- Divórcio: PRIMEIRO(A) DIVORCIANDO(A) e SEGUNDO(A) DIVORCIANDO(A)
- União Estável: PRIMEIRO(A) COMPANHEIRO(A) e SEGUNDO(A) COMPANHEIRO(A)
- Cessão: CEDENTE e CESSIONÁRIO(A)
- Renúncia: RENUNCIANTE
- Dação em Pagamento: DEVEDOR(A) e CREDOR(A)
- Ata Notarial: REQUERENTE
- Anuência conjugal: ANUENTE

FORMATAÇÃO:
- Use **negrito** SOMENTE para: título, nomes das partes, matrícula, número de guia de tributo
- PROIBIDO negrito em: CNPJ, nome do banco, agência, conta corrente e qualquer texto do parágrafo final de pagamento
- Na seção ARQUIVAMENTO: negrito SOMENTE na palavra "controle" e no número que vem logo depois (______). Todo o restante sem negrito
- NÃO deixe linhas em branco entre parágrafos
- Use # para título principal e ## para seções/cláusulas

REGRA ABSOLUTA — ANÁLISE DOCUMENTAL:
NUNCA inclua no corpo do texto: tabelas, listas numeradas, seções "ANÁLISE DOCUMENTAL", "APONTAMENTOS TÉCNICOS", "PENDÊNCIAS DOCUMENTAIS" ou estrutura similar.
Cada pendência deve aparecer EXCLUSIVAMENTE como marcador 【PENDÊNCIA: descrição objetiva】 inserido diretamente no texto, após o trecho ao qual se refere. Esses marcadores viram balões de revisão automaticamente.

REGRA ABSOLUTA — MODELO DE MINUTA (REFERÊNCIA):
Se algum documento fornecido tiver cabeçalho começando com "MODELO DE MINUTA (REFERÊNCIA" — seja "FORNECIDA PELA EQUIPE" (enviada manualmente) ou "APRENDIDA AUTOMATICAMENTE" (de um caso anterior do mesmo tipo de ato) — os dois exigem o MESMO nível de fidelidade:
- SIGA O MODELO FIELMENTE — mesma estrutura, mesma ordem de cláusulas, mesmo nível de detalhe e abrangência. Se o modelo tem 13 cláusulas ou subcláusulas 6.1 a 6.10, a minuta nova também precisa cobrir esse mesmo escopo — não resuma, não condense, não pare cedo.
- NUNCA copie nomes, CPF, RG, matrícula, endereços, valores, datas ou qualquer dado específico do modelo
- Todos os dados factuais da minuta devem vir EXCLUSIVAMENTE dos demais documentos e observações do caso atual
- Se o modelo mencionar uma cláusula que não se aplica ao caso atual, não a inclua

ABERTURA DA MINUTA (escolha conforme MODALIDADE):

Se DIGITAL:
Aos ______ (______) dias do mês de ______ (______) do ano de dois mil e vinte e seis (2026), nesta cidade e Capital do Estado de São Paulo, República Federativa do Brasil, perante mim, **Shirley Dantas da Silva**, Escrevente autorizada do **20º Tabelião de Notas** desta Capital, compareceram partes entre si, por meio de **VIDEOCONFERÊNCIA**, nos termos do **Provimento nº 149/2023** do Conselho Nacional de Justiça, cujas identidades foram por mim confirmadas, conforme os documentos abaixo mencionados, a mim apresentados, corroborados por sua declaração justas e contratadas, a saber:

Se HÍBRIDA:
Aos ______ (______) dias do mês de ______ (______) do ano de dois mil e vinte e seis (2026), nesta cidade e Capital do Estado de São Paulo, República Federativa do Brasil, perante mim, **Shirley Dantas da Silva**, Escrevente autorizada do **20º Tabelião de Notas** desta Capital, compareceram partes entre si, por meio de **VIDEOCONFERÊNCIA**, e **PRESENCIALMENTE** nos termos do **Provimento nº 149/2023** do Conselho Nacional de Justiça, cujas identidades foram por mim confirmadas, conforme os documentos abaixo mencionados, a mim apresentados, corroborados por sua declaração justas e contratadas, a saber:

Se PRESENCIAL:
Aos ______ (______) dias do mês de ______ (______) do ano de dois mil e vinte e seis (2026), nesta cidade e Capital do Estado de São Paulo, República Federativa do Brasil, perante mim, **Shirley Dantas da Silva**, Escrevente autorizada do **20º Tabelião de Notas** desta Capital, compareceram partes entre si, cujas identidades foram por mim confirmadas, conforme os documentos abaixo mencionados, a mim apresentados, corroborados por sua declaração justas e contratadas, a saber:

ENCERRAMENTO (escolha conforme MODALIDADE):

Se DIGITAL ou HÍBRIDA:
**IMPOSTOS DE TRANSMISSÃO** - Que apresentam a guia de Imposto sobre Transmissão de Bens Imóveis e de direitos a eles relativos, recolhido através da guia sob nº ______ no valor de **R$______**, devidamente paga, a qual fica arquivada nestas notas; **INDISPONIBILIDADE:** CONSULTA com resultado negativo à Central de Indisponibilidade de Bens conforme código: **HASH: ______.** **DOI:** EMITIDA DOI - Declaração Sobre Operação Imobiliária, conforme Instrução Normativa da Secretaria da Receita Federal vigente. **ARQUIVAMENTO:** Todos os documentos de arquivamento obrigatório mencionados neste ato notarial ficam arquivados digitalmente, pelo prazo legal, neste **20º Tabelionato de Notas**, sob o número de controle: ______ **CERTIFICAÇÃO:** Escritura assinada digitalmente com certificado digital, pela plataforma do e-Notariado, por: ______ ///______[SE HÍBRIDA: e presencialmente por ______ /// ______]. Eu, escrevente autorizada indicada no fluxo de assinaturas, a lavrei, li realizei a videoconferência e assino com meu certificado digital. Eu, Substituto Legal do Tabelião, indicado no fluxo de assinaturas, subscrevo e assino com meu certificado digital padrão ICP-Brasil, encerrando este ato. Data e horário das assinaturas digitais, bem como matrícula notarial eletrônica (MNE) constantes do manifesto impresso na última página desta. De tudo dou fé. O adquirente adimpliu com os emolumentos notariais ao final consignados, mediante transferência à conta desta Serventia **(CNPJ: 45.566.502/0001-12)** junto ao banco **Itaú S/A**, agência **0350**, c/c: **72195-7.** O adquirente dispensa expressamente este Cartório e seu Tabelião do encaminhamento desta escritura a registro, pelo que isenta-o de qualquer responsabilidade. De como assim o disseram, dou fé, a pedido das partes, lavrei esta escritura, a qual feita e lhes sendo lida em voz alta, acharam-na conforme, aceitaram, outorgaram e assinam.

Se PRESENCIAL:
**IMPOSTOS DE TRANSMISSÃO** - Que apresentam a guia de Imposto sobre Transmissão de Bens Imóveis e de direitos a eles relativos, recolhido através da guia sob nº ______ no valor de **R$______**, devidamente paga, a qual fica arquivada nestas notas; **INDISPONIBILIDADE:** CONSULTA com resultado negativo à Central de Indisponibilidade de Bens conforme código: **HASH: ______.** **DOI:** EMITIDA DOI - Declaração Sobre Operação Imobiliária, conforme Instrução Normativa da Secretaria da Receita Federal vigente. **ARQUIVAMENTO:** Todos os documentos de arquivamento obrigatório mencionados neste ato notarial ficam arquivados digitalmente, pelo prazo legal, neste **20º Tabelionato de Notas**, sob o número de controle: ______ O adquirente adimpliu com os emolumentos notariais ao final consignados, mediante transferência à conta desta Serventia **(CNPJ: 45.566.502/0001-12)** junto ao banco **Itaú S/A**, agência **0350**, c/c: **72195-7.** O adquirente dispensa expressamente este Cartório e seu Tabelião do encaminhamento desta escritura a registro, pelo que isenta-o de qualquer responsabilidade. De como assim o disseram, dou fé, a pedido das partes, lavrei esta escritura, a qual feita e lhes sendo lida em voz alta, acharam-na conforme, aceitaram, outorgaram e assinam.

NOTA: Substitua "adquirente" pelo nome correto da parte principal do ato. Para atos sem transferência imobiliária (procuração, testamento, ata notarial), omita IMPOSTOS DE TRANSMISSÃO e DOI.`;

const INSTRUCOES_MINUTA = {
  "Inventário": "Verificar certidão de óbito, herdeiros, regime de bens, bens do espólio, ITCMD SP (4%), meação × herança.",
  "Escritura de Compra e Venda": "Verificar matrícula, certidões negativas do vendedor, ITBI, forma de pagamento, anuência conjugal.",
  "Procuração": "Identificar outorgante e outorgado, poderes específicos, substabelecimento, prazo, imóvel se aplicável.",
  "Divórcio": "Verificar certidão de casamento, ausência de filhos menores, partilha de bens, nome após divórcio.",
  "União Estável": "Verificar documentos dos companheiros, regime de bens, data de início, cláusulas especiais.",
  "Doação": "Identificar bem doado, ITCMD, cláusulas restritivas, anuência conjugal, usufruto se aplicável.",
  "Renúncia": "Identificar bem/direito, natureza da renúncia (translativa ou abdicativa), impacto registral, tributos.",
  "Cessão de Direitos": "Identificar cedente, cessionário, direitos cedidos, valor, ITBI ou ITCMD conforme o caso.",
  "Pacto Antenupcial": "Verificar regime de bens escolhido, bens pré-nupciais, data do casamento, registro no CRI.",
  "Testamento": "Verificar capacidade civil, legítima (50%), quota disponível, legatários, testamenteiro.",
  "Ata Notarial": "Identificar fato a ser constatado, requerente, finalidade. Descrever objetivamente, sem opinião jurídica.",
  "Dação em Pagamento": "Identificar dívida original, bem dado em pagamento, ITBI, quitação expressa, certidões do devedor."
};

function instrucoesMinimasPorTipo(tipo) {
  if (!tipo) return "";
  const chave = Object.keys(INSTRUCOES_MINUTA).find(k => tipo.toLowerCase().includes(k.toLowerCase()));
  return chave ? `ATENÇÃO — ATO: ${chave.toUpperCase()}\n${INSTRUCOES_MINUTA[chave]}` : "";
}

// Biblioteca de modelos aprendidos por tipo de ato (mesmo Firebase que o
// Apps Script usa) — evita depender de alguém lembrar de mandar um modelo
// manual toda vez: a cada minuta gerada com sucesso, ela vira a referência
// automática de estilo do tipo de ato, tanto pra próxima geração pelo
// WhatsApp quanto pelo painel.
function chaveTipoModelo(tipo) {
  if (!tipo) return "geral";
  const chave = Object.keys(INSTRUCOES_MINUTA).find(k => tipo.toLowerCase().includes(k.toLowerCase()));
  const base = (chave || tipo).toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "geral";
}
async function buscarModeloAprendido(tipo) {
  const chave = chaveTipoModelo(tipo);
  const data = await httpReq(`https://${FIREBASE_HOST}/modelos/${chave}.json`, "GET");
  return (data && data.texto) ? data : null;
}
async function salvarModeloAprendido(tipo, texto, nomeCaso) {
  const chave = chaveTipoModelo(tipo);
  await httpReq(`https://${FIREBASE_HOST}/modelos/${chave}.json`, "PUT", {
    texto: texto.slice(0, 6000),
    origemCaso: nomeCaso || "",
    atualizado: new Date().toISOString()
  });
}

function callClaudeMinuta(mensagem) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 5000,
      system: SYSTEM_PROMPT_MINUTA,
      messages: [{ role: "user", content: mensagem }]
    });
    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { resolve(JSON.parse(data)?.content?.[0]?.text || null); }
        catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.write(body);
    req.end();
  });
}

function httpPostComRedirect(url, body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const options = {
      hostname: u.hostname, path: u.pathname + u.search, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
    };
    const r = https.request(options, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        const lu = new URL(res.headers.location, url);
        const gr = https.request({ hostname: lu.hostname, path: lu.pathname + lu.search, method: "GET" }, (gres) => {
          let data = "";
          gres.on("data", d => data += d);
          gres.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
        });
        gr.on("error", () => resolve(null));
        gr.end();
        return;
      }
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    r.on("error", () => resolve(null));
    r.write(payload);
    r.end();
  });
}

async function gerarECriarMinuta(caso) {
  try {
    const instrucoes = instrucoesMinimasPorTipo(caso.tipo);
    const mod = (caso.modalidade || "digital").toUpperCase();

    // Junta o texto já extraído de cada documento anexado ao card (antes só
    // ficava guardado como registro, sem entrar na geração da minuta).
    let documentosTexto = "";
    if (caso.casoId) {
      const documentos = await httpReq(`https://${FIREBASE_HOST}/casos/${caso.casoId}/documentos.json`, "GET");
      if (documentos && typeof documentos === "object") {
        const linhas = [];
        Object.values(documentos).forEach(d => {
          if (!d) return;
          linhas.push(d.tipo === "modelo"
            ? `\n=== MODELO DE MINUTA (REFERÊNCIA FORNECIDA PELA EQUIPE) — ${d.nome} ===`
            : `\n=== DOCUMENTO: ${d.nome} ===`);
          if (d.texto) linhas.push(d.texto);
        });
        documentosTexto = linhas.join("\n");
      }
    }

    // Sem modelo mandado manualmente pelo WhatsApp: usa o último modelo
    // aprendido automaticamente para esse tipo de ato, se existir.
    if (!/MODELO DE MINUTA \(REFERÊNCIA FORNECIDA PELA EQUIPE\)/.test(documentosTexto)) {
      const modeloAprendido = await buscarModeloAprendido(caso.tipo);
      if (modeloAprendido) {
        documentosTexto += `\n\n=== MODELO DE MINUTA (REFERÊNCIA APRENDIDA AUTOMATICAMENTE) — ${caso.tipo || ""} ===\n${modeloAprendido.texto}`;
      }
    }

    const mensagem = `CASO: ${caso.nome}
TIPO DE ATO: ${caso.tipo || "Não informado"}
MODALIDADE: ${mod}
${instrucoes ? instrucoes + "\n" : ""}
OBSERVAÇÕES DO CASO: ${caso.obs || "Nenhuma"}

DOCUMENTOS E INFORMAÇÕES FORNECIDAS:
${documentosTexto.trim() || "Nenhum documento fornecido ainda."}

Por favor, gere a minuta completa conforme as informações disponíveis, usando a abertura e o encerramento correspondentes à modalidade ${mod}.`;

    const resposta = await callClaudeMinuta(mensagem);
    if (!resposta) return { driveUrl: null, docUrl: null };

    const comentarios = [];
    let minuta = resposta;
    const INICIO = "【PENDÊNCIA: ";
    const FIM = "】";
    let pos = 0; let num = 1;
    while (true) { const s = minuta.indexOf(INICIO, pos); if (s === -1) break; const e = minuta.indexOf(FIM, s); if (e === -1) break; comentarios.push("Pendencia " + num + ": " + minuta.slice(s + INICIO.length, e).trim()); num++; pos = e + 1; }
    let limpo = ""; pos = 0;
    while (true) { const s = minuta.indexOf(INICIO, pos); if (s === -1) { limpo += minuta.slice(pos); break; } const e = minuta.indexOf(FIM, s); if (e === -1) { limpo += minuta.slice(pos); break; } limpo += minuta.slice(pos, s); pos = e + 1; }
    minuta = limpo;
    const cortes = ["---\nANALISE", "---\nANÁLISE", "\nANÁLISE DOCUMENTAL", "\nANALISE DOCUMENTAL", "\nAPONTAMENTOS TÉCNICOS"];
    let idxCorte = -1;
    for (let i = 0; i < cortes.length; i++) { const idx = minuta.indexOf(cortes[i]); if (idx !== -1 && (idxCorte === -1 || idx < idxCorte)) idxCorte = idx; }
    if (idxCorte !== -1) minuta = minuta.slice(0, idxCorte);
    minuta = minuta.replace(/\n\n\n+/g, "\n\n").trim();

    const driveResp = await httpPostComRedirect(DRIVE_URL, {
      acao: "criar-minuta-doc",
      nome: caso.nome,
      tipo: caso.tipo || "",
      minuta,
      comentarios
    });

    // Aprende com essa minuta: vira a referência automática do tipo para as
    // próximas gerações (WhatsApp ou painel), sem precisar de tag manual.
    if (minuta) await salvarModeloAprendido(caso.tipo, minuta, caso.nome);

    return {
      driveUrl: driveResp?.folderUrl || null,
      docUrl: driveResp?.url || null
    };
  } catch (e) {
    return { driveUrl: null, docUrl: null };
  }
}

// Mesma extração jurídica usada para PDF/imagem (extrairTextoPDF), mas a
// partir de texto puro — usada depois do mammoth ler o .docx.
function extrairDadosJuridicosDeTexto(texto) {
  const body = JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `Extraia as informações jurídicas relevantes deste documento: partes (nome, CPF, RG, estado civil, endereço), dados do imóvel (matrícula, endereço, área), valores, datas e qualquer dado importante para elaboração de minuta notarial. Seja objetivo e liste tudo que encontrar.\n\nDOCUMENTO:\n${texto}`
    }]
  });
  return new Promise((resolve) => {
    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { resolve(JSON.parse(data)?.content?.[0]?.text || null); }
        catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.write(body);
    req.end();
  });
}

async function extrairTextoDocx(base64, isModelo) {
  try {
    const mammoth = require("mammoth");
    const buffer = Buffer.from(base64, "base64");
    const resultado = await mammoth.extractRawText({ buffer });
    const textoBruto = (resultado && resultado.value && resultado.value.trim()) || null;
    if (!textoBruto) return null;
    // Modelo: o mammoth já dá o texto exato do .docx — não precisa (nem deve)
    // passar pela extração jurídica, que resumiria em vez de transcrever.
    if (isModelo) return textoBruto;
    const dadosExtraidos = await extrairDadosJuridicosDeTexto(textoBruto);
    return dadosExtraidos || textoBruto;
  } catch (e) {
    return null;
  }
}

async function extrairTextoModelo(base64, mimetype) {
  const bloco = mimetype === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: mimetype, data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mimetype, data: base64 } };
  const body = JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [{
      role: "user",
      content: [
        bloco,
        {
          type: "text",
          text: "Este documento é uma MINUTA MODELO — uma escritura ou ato notarial já pronto, que será usado como referência de estilo e estrutura para redigir uma nova minuta. Transcreva o texto completo do documento, na íntegra, sem resumir e sem comentar. Apenas o texto puro da minuta."
        }
      ]
    }]
  });
  return new Promise((resolve) => {
    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { resolve(JSON.parse(data)?.content?.[0]?.text || null); }
        catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.write(body);
    req.end();
  });
}

async function extrairTextoPDF(base64, mimetype) {
  const body = JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: [
        {
          type: "document",
          source: { type: "base64", media_type: mimetype, data: base64 }
        },
        {
          type: "text",
          text: "Extraia as informações jurídicas relevantes deste documento: partes (nome, CPF, RG, estado civil, endereço), dados do imóvel (matrícula, endereço, área), valores, datas e qualquer dado importante para elaboração de minuta notarial. Seja objetivo e liste tudo que encontrar."
        }
      ]
    }]
  });
  return new Promise((resolve) => {
    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { resolve(JSON.parse(data)?.content?.[0]?.text || null); }
        catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.write(body);
    req.end();
  });
}

async function salvarDocumentoRecebido(sessao, dadosEvt, tipoMensagem, textoLegenda) {
  const resultado = await baixarMidia(dadosEvt);
  if (!resultado?.base64) return { ok: false };

  const isModelo = ehLegendaModelo(textoLegenda);
  const mimeReal = resultado.mimetype || "";
  const nomeReal = resultado.fileName || "";
  const isDocx = mimeReal.indexOf("wordprocessingml.document") !== -1 || /\.docx$/i.test(nomeReal);
  const ext = isDocx ? "docx" : tipoMensagem.includes("image") ? "jpg" : tipoMensagem.includes("audio") ? "mp3" : tipoMensagem.includes("video") ? "mp4" : "pdf";
  const mime = isDocx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : tipoMensagem.includes("image") ? "image/jpeg" : tipoMensagem.includes("audio") ? "audio/mpeg" : tipoMensagem.includes("video") ? "video/mp4" : "application/pdf";
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const nomeArquivo = `${isModelo ? "MODELO_" : ""}${sessao.nomeCaso.replace(/\s+/g, "_").toUpperCase()}_${ts}.${ext}`;
  const podeExtrair = isDocx || mime === "application/pdf" || mime === "image/jpeg";

  const [, textoExtraido] = await Promise.all([
    salvarNoDrive(sessao.nomeCaso, nomeArquivo, resultado.base64, mime),
    podeExtrair
      ? (isDocx ? extrairTextoDocx(resultado.base64, isModelo) : (isModelo ? extrairTextoModelo(resultado.base64, mime) : extrairTextoPDF(resultado.base64, mime)))
      : Promise.resolve(null)
  ]);

  if (sessao.casoId) {
    await httpReq(`https://${FIREBASE_HOST}/casos/${sessao.casoId}/documentos.json`, "POST", {
      nome: nomeArquivo,
      tipo: isModelo ? "modelo" : ext,
      salvoEm: new Date().toISOString(),
      ...(textoExtraido ? { texto: textoExtraido } : {})
    });
  }
  return { ok: true, isModelo, textoExtraido };
}

// ══ HANDLER VERCEL — DIÁLOGO GUIADO ═══════════════════════════════
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Método não permitido");
  }

  let corpo;
  try {
    corpo = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).send("JSON inválido");
  }

  const dadosEvt = corpo?.data || corpo?.dados || {};
  const chaveEvt = dadosEvt?.key || dadosEvt?.chave || {};
  const destinatario = chaveEvt?.remoteJid || chaveEvt?.remotoJid || "";
  const numeroDestino = destinatario.replace(/[^0-9]/g, "");
  if (numeroDestino !== NUMERO_OPERACIONAL) {
    return res.status(200).send("Mensagem ignorada");
  }

  const mensagemObj = dadosEvt?.message || dadosEvt?.mensagem || {};
  const tipoMensagem = dadosEvt?.messageType || dadosEvt?.tipoMensagem || "";
  const texto = (
    mensagemObj?.conversation ||
    mensagemObj?.conversa ||
    mensagemObj?.extendedTextMessage?.text ||
    mensagemObj?.mensagemTextoEstendida?.texto ||
    mensagemObj?.imageMessage?.caption ||
    mensagemObj?.documentMessage?.caption ||
    corpo.Resumo || ""
  ).trim();

  const isMedia = ["imageMessage","documentMessage","videoMessage","audioMessage","documentWithCaptionMessage"].includes(tipoMensagem);
  const isTexto = !isMedia && texto.length > 0;

  // Mensagens enviadas pelo próprio bot (enviarTexto/enviarBotoes) voltam pelo
  // mesmo webhook, já que instância e destinatário são o mesmo número. Em vez
  // de confiar em "fromMe" (que nesse tipo de conversa — instância falando com
  // o próprio número — pode vir true tanto pro bot quanto pra pessoa digitando
  // ali mesmo), compara com o texto que o bot acabou de mandar: só ignora se
  // for idêntico e muito recente, o que nunca bloqueia uma mensagem real.
  if (isTexto) {
    const ultimoEnvio = await getUltimoEnvioBot();
    if (ultimoEnvio?.texto === texto && ultimoEnvio?.ts) {
      const segundosDesdeEnvio = (Date.now() - new Date(ultimoEnvio.ts).getTime()) / 1000;
      if (segundosDesdeEnvio >= 0 && segundosDesdeEnvio < 30) {
        return res.status(200).send("Eco da própria mensagem do bot ignorado");
      }
    }
  }

  await httpReq(`https://${FIREBASE_HOST}/log_webhook.json`, "POST", {
    ts: new Date().toISOString(), tipoMensagem, isMedia, isTexto, texto: texto.slice(0, 100), destinatario
  });

  let sessao = await getSessao();
  if (sessao && sessaoExpirada(sessao)) {
    await clearSessao();
    sessao = null;
  }

  // ─── Sem sessão: só "Olá" inicia o atendimento ───
  if (!sessao || !sessao.etapa) {
    if (isTexto && ehSaudacao(texto)) {
      await setSessao({ etapa: "aguardando_identificacao" });
      await enviarBotoes("Oi! Quem está falando?", ["Shirley", "Grazi"]);
      return res.status(200).send("Diálogo iniciado");
    }
    // Texto solto ou documento sem "Olá" antes: não faz nada sozinho.
    return res.status(200).send("Sem atendimento ativo — mande 'Olá' para começar");
  }

  // ─── Já existe atendimento em curso: texto novo de saudação pergunta se quer sobrepor ───
  if (isTexto && ehSaudacao(texto) && sessao.etapa !== "aguardando_identificacao" && sessao.etapa !== "aguardando_confirmar_sobrepor") {
    await setSessao({ ...sessao, etapaAntesDeSobrepor: sessao.etapa, etapa: "aguardando_confirmar_sobrepor" });
    await enviarBotoes(
      `Já tem um atendimento em andamento${sessao.nomeCaso ? ` (${sessao.nomeCaso})` : ""}. Quer continuar esse ou encerrar e começar outro?`,
      ["Continuar", "Encerrar e começar outro"]
    );
    return res.status(200).send("Perguntou sobre sobrepor atendimento");
  }
  if (sessao.etapa === "aguardando_confirmar_sobrepor" && isTexto) {
    if (/encerrar/i.test(texto) || respostaNegativa(texto)) {
      await clearSessao();
      await setSessao({ etapa: "aguardando_identificacao" });
      await enviarBotoes("Ok, atendimento anterior encerrado. Quem está falando?", ["Shirley", "Grazi"]);
      return res.status(200).send("Atendimento anterior encerrado");
    }
    // "Continuar": restaura a etapa que estava em curso antes da tentativa de sobreposição
    const { etapaAntesDeSobrepor, ...resto } = sessao;
    await setSessao({ ...resto, etapa: etapaAntesDeSobrepor || resto.etapa });
    return res.status(200).send("Continuando atendimento anterior");
  }

  // ─── 1. Identificação ───
  if (sessao.etapa === "aguardando_identificacao") {
    const pessoa = isTexto ? detectarPessoa(texto) : null;
    if (!pessoa) {
      await enviarBotoes("Não entendi — quem está falando?", ["Shirley", "Grazi"]);
      return res.status(200).send("Repetiu pergunta de identificação");
    }
    await setSessao({ etapa: "aguardando_novo_ou_existente", pessoa });
    await enviarBotoes("Quer abrir um novo card?", ["Sim", "Não"]);
    return res.status(200).send("Identificado, perguntou novo/existente");
  }

  // ─── 2. Novo ou existente ───
  if (sessao.etapa === "aguardando_novo_ou_existente" && isTexto) {
    if (respostaAfirmativa(texto)) {
      await setSessao({ ...sessao, etapa: "aguardando_nome_novo" });
      await enviarTexto("Dê o nome ao card:");
    } else {
      await setSessao({ ...sessao, etapa: "aguardando_nome_existente" });
      await enviarTexto("Em qual card quer atualizar informações?");
    }
    return res.status(200).send("OK");
  }

  // ─── 3a. Nome do card novo ───
  if (sessao.etapa === "aguardando_nome_novo" && isTexto) {
    await setSessao({ ...sessao, etapa: "aguardando_tipo_ato", nomeCasoNovo: texto });
    await enviarTexto("Qual tipo de ato?");
    return res.status(200).send("OK");
  }

  // ─── 3b. Tipo de ato → pergunta modalidade ───
  if (sessao.etapa === "aguardando_tipo_ato" && isTexto) {
    await setSessao({ ...sessao, etapa: "aguardando_modalidade", tipoAtoNovo: texto });
    await enviarBotoes("Qual a modalidade do ato?", ["Digital", "Híbrida", "Presencial"]);
    return res.status(200).send("Perguntou modalidade");
  }

  // ─── 3c. Modalidade → cria o card ───
  if (sessao.etapa === "aguardando_modalidade" && isTexto) {
    const modalidade = detectarModalidadeEscolhida(texto);
    if (!modalidade) {
      await enviarBotoes("Não entendi — qual a modalidade do ato?", ["Digital", "Híbrida", "Presencial"]);
      return res.status(200).send("Repetiu pergunta de modalidade");
    }
    const urgencia = classificarUrgencia(sessao.tipoAtoNovo);
    const caso = {
      nome: sessao.nomeCasoNovo,
      tipo: sessao.tipoAtoNovo,
      modalidade,
      status: urgencia.status,
      resp: (sessao.pessoa || "Grazi").toLowerCase(),
      prazo: "Hoje",
      obs: `${sessao.tipoAtoNovo}\n\n[Urgência: ${urgencia.motivo}]`,
      atualizado: new Date().toISOString().split("T")[0],
      concluido: false,
      dep: ""
    };
    const fbResp = await httpReq(`https://${FIREBASE_HOST}/casos.json`, "POST", caso);
    const casoId = fbResp?.name || null;
    await setSessao({ ...sessao, etapa: "aguardando_documentos", nomeCaso: caso.nome, casoId, cardNovo: true });
    await enviarTexto("Pode anexar os documentos, ou digite \"pular\" se não for anexar nada agora.");
    return res.status(200).send("Card criado");
  }

  // ─── 4a. Nome do card existente ───
  if (sessao.etapa === "aguardando_nome_existente" && isTexto) {
    const achado = await buscarCasoPorNome(texto);
    if (achado.tipo === "nenhum") {
      await enviarBotoes(`Não encontrei nenhum card parecido com "${texto}". Quer criar um novo?`, ["Sim", "Não"]);
      await setSessao({ ...sessao, etapa: "aguardando_novo_ou_existente" });
      return res.status(200).send("Card não encontrado");
    }
    if (achado.tipo === "aproximado") {
      await setSessao({ ...sessao, etapa: "aguardando_confirmar_nome", casoCandidato: achado.caso });
      await enviarBotoes(`Quis dizer "${achado.caso.nome}"?`, ["Sim", "Não, buscar de novo"]);
      return res.status(200).send("Perguntou confirmação por aproximação");
    }
    await setSessao({ ...sessao, etapa: "aguardando_tipo_atualizacao", nomeCaso: achado.caso.nome, casoId: achado.caso.id });
    await enviarTexto("Qual seria a informação (reeditar a minuta / inserir informações / anexar documentos)?");
    return res.status(200).send("Card localizado");
  }

  // ─── 4b. Confirmação do nome aproximado ───
  if (sessao.etapa === "aguardando_confirmar_nome" && isTexto) {
    if (respostaAfirmativa(texto)) {
      const c = sessao.casoCandidato;
      await setSessao({ ...sessao, etapa: "aguardando_tipo_atualizacao", nomeCaso: c.nome, casoId: c.id, casoCandidato: null });
      await enviarTexto("Qual seria a informação (reeditar a minuta / inserir informações / anexar documentos)?");
    } else {
      await setSessao({ ...sessao, etapa: "aguardando_nome_existente", casoCandidato: null });
      await enviarTexto("Ok, em qual card quer atualizar informações?");
    }
    return res.status(200).send("OK");
  }

  // ─── 5. Tipo de atualização ───
  if (sessao.etapa === "aguardando_tipo_atualizacao" && isTexto) {
    await setSessao({ ...sessao, etapa: "aguardando_documentos", tipoAtualizacao: texto });
    await enviarTexto("Pode anexar os documentos, ou digite \"pular\" se não for anexar nada agora.");
    return res.status(200).send("OK");
  }

  // ─── 6. Recebendo documentos ───
  if (sessao.etapa === "aguardando_documentos" || sessao.etapa === "aguardando_mais_documentos") {
    if (isMedia) {
      // Nesta etapa todo anexo é sempre documento do caso (nunca modelo) —
      // a legenda não é considerada aqui. O único jeito de mandar um modelo
      // é pela etapa dedicada ("Devo usar um modelo específico?" → Sim).
      await salvarDocumentoRecebido(sessao, dadosEvt, tipoMensagem, "");
      await setSessao({ ...sessao, etapa: "aguardando_mais_documentos" });
      await enviarBotoes("Recebi. Mais algum documento, ou posso seguir?", ["Tem mais", "Pode seguir"]);
      return res.status(200).send("Documento recebido");
    }
    if (isTexto && sessao.etapa === "aguardando_documentos" && ehPular(texto)) {
      await setSessao({ ...sessao, etapa: "aguardando_gerar_minuta" });
      await enviarBotoes("Sem documentos por enquanto. Quer gerar/reeditar a minuta agora?", ["Sim", "Não"]);
      return res.status(200).send("Documentos pulados, seguindo para minuta");
    }
    if (isTexto && sessao.etapa === "aguardando_mais_documentos") {
      if (respostaAfirmativa(texto) && !/pode seguir/i.test(texto)) {
        await setSessao({ ...sessao, etapa: "aguardando_documentos" });
        await enviarTexto("Pode mandar.");
        return res.status(200).send("Aguardando mais documentos");
      }
      await setSessao({ ...sessao, etapa: "aguardando_gerar_minuta" });
      await enviarBotoes("Quer gerar/reeditar a minuta agora?", ["Sim", "Não"]);
      return res.status(200).send("Seguindo para minuta");
    }
    return res.status(200).send("Aguardando documento ou confirmação");
  }

  // ─── 7. Quer gerar/reeditar minuta agora? ───
  if (sessao.etapa === "aguardando_gerar_minuta" && isTexto) {
    if (respostaNegativa(texto)) {
      await setSessao({ ...sessao, etapa: "aguardando_mais_informacao" });
      await enviarTexto("Ok, sem gerar minuta agora. Mais alguma informação, ou já posso concluir?");
      return res.status(200).send("OK");
    }
    await setSessao({ ...sessao, etapa: "aguardando_usar_modelo" });
    await enviarBotoes("Devo usar um modelo específico?", ["Sim", "Não"]);
    return res.status(200).send("OK");
  }

  // ─── 8. Usar modelo específico? ───
  if (sessao.etapa === "aguardando_usar_modelo" && isTexto) {
    if (respostaAfirmativa(texto)) {
      await setSessao({ ...sessao, etapa: "aguardando_arquivo_modelo" });
      await enviarTexto("Pode mandar o arquivo modelo — não precisa de legenda especial, é só enviar.");
      return res.status(200).send("OK");
    }
    // Sem modelo: minuta a partir do que já está no card (comportamento já existente)
    await gerarMinutaDoCaso(sessao);
    await setSessao({ ...sessao, etapa: "aguardando_mais_informacao" });
    await enviarTexto("Minuta gerada e salva no Drive. Mais alguma informação, ou já posso concluir?");
    return res.status(200).send("Minuta gerada");
  }

  // ─── 9. Recebendo o arquivo-modelo ───
  if (sessao.etapa === "aguardando_arquivo_modelo" && isMedia) {
    await salvarDocumentoRecebido(sessao, dadosEvt, tipoMensagem, "modelo");
    await gerarMinutaDoCaso(sessao);
    await setSessao({ ...sessao, etapa: "aguardando_mais_informacao" });
    await enviarTexto("Minuta gerada com base no modelo enviado e salva no Drive. Mais alguma informação, ou já posso concluir?");
    return res.status(200).send("Minuta gerada com modelo");
  }

  // ─── 10. Mais informação ou concluir ───
  if (sessao.etapa === "aguardando_mais_informacao" && isTexto) {
    if (/conclu/i.test(texto)) {
      await clearSessao();
      return res.status(200).send("Atendimento concluído");
    }
    // Qualquer outra coisa vira observação anexada ao card
    if (sessao.casoId) {
      await httpReq(`https://${FIREBASE_HOST}/casos/${sessao.casoId}.json`, "PATCH", {
        obs: texto,
        atualizado: new Date().toISOString().split("T")[0]
      });
    }
    await enviarTexto("Anotado. Mais alguma informação, ou já posso concluir?");
    return res.status(200).send("OK");
  }

  return res.status(200).send("Mensagem recebida, fora de fluxo reconhecido");
};

// Helper que junta "gerar minuta" ao caso já existente, reaproveitando
// gerarECriarMinuta com os dados atualizados vindos do Firebase.
async function gerarMinutaDoCaso(sessao) {
  if (!sessao.casoId) return;
  const caso = await httpReq(`https://${FIREBASE_HOST}/casos/${sessao.casoId}.json`, "GET");
  if (!caso) return;
  const { driveUrl, docUrl } = await gerarECriarMinuta({ ...caso, nome: sessao.nomeCaso, casoId: sessao.casoId });
  const patch = {};
  if (driveUrl) patch.driveUrl = driveUrl;
  if (docUrl) patch.docUrl = docUrl;
  if (Object.keys(patch).length > 0) {
    await httpReq(`https://${FIREBASE_HOST}/casos/${sessao.casoId}.json`, "PATCH", patch);
  }
}
