// A IA do Caderno da Rafaela. Uma porta só, duas ações:
//   acao: "corrigir"  → lê a questão, o raciocínio e as fotos dela e explica o erro
//   acao: "dicas"     → lê o resumo das estatísticas dela e escreve macetes
//   acao: "classificar" → lê a foto de uma questão que ela está adicionando ao acervo
//                         e sugere matéria e assunto (ela confere) + transcreve o texto
//
// Nada é guardado aqui: o que entra sai respondido, e quem guarda é o próprio
// aparelho dela. A chave da IA mora nas variáveis de ambiente da Vercel.
//
// Cada chamada custa, e o endereço é público. Duas trancas:
//  - só responde à própria página (mesma origem) ou às origens de RAFAELA_ORIGENS;
//  - se RAFAELA_CODIGO existir, exige o código no cabeçalho x-codigo.
const sdk = require("@anthropic-ai/sdk");
const Anthropic = sdk.default || sdk;

const MODELO = process.env.RAFAELA_MODELO || "claude-opus-5-5";
// A Vercel recusa corpo acima de 4,5 MB; a página já reduz as fotos antes de mandar.
const MAX_IMAGENS = 5;
const MAX_BASE64_TOTAL = 3.8 * 1024 * 1024;
const TIPOS_ERRO = ["conceito", "interpretação", "cálculo", "atenção", "método", "memorização", "tempo/chute", "indefinido"];

const REGRAS_COMUNS = `Você é a professora particular da Rafaela, que prepara ENEM, FUVEST e UNICAMP. Escreva em português do Brasil, com carinho e franqueza: sem condescendência, sem elogio vazio, sem sermão.
Escreva fórmulas em texto simples (x², √3, H₂O, →, ≤); nada de LaTeX, nada de markdown, nada de HTML.
Nunca invente fato: se não tem certeza de uma regra, data, fórmula ou de como uma banca costuma cobrar, diga que não tem certeza em vez de afirmar. Não cite estatística de "quantas vezes caiu" nem frequência por banca.`;

const SISTEMA_CORRIGIR = `${REGRAS_COMUNS}

Sua tarefa: analisar UMA questão que a Rafaela errou (ou uma dúvida dela) e ensinar.

REGRA PRINCIPAL — não presuma o motivo do erro. O diagnóstico sai do que ela ESCREVEU ou FOTOGRAFOU, nunca do palpite sobre o que "costuma" acontecer.
- Para dizer onde errou, cite o passo da resolução dela (copie o trecho, a linha da conta ou descreva o que a foto mostra) e diga em que ponto ele se afasta do correto.
- Se ela só marcou a alternativa e não deixou raciocínio nem foto legível, você NÃO sabe por que errou. Nesse caso: diagnostico_confiavel=false, tipo_erro="indefinido", padrao="" e, em onde_errou, diga só o que dá para afirmar (por exemplo, por que a alternativa marcada está incorreta). Faça de 1 a 3 perguntas específicas em perguntas_para_ela para descobrir o motivo de verdade (ex.: "Você chegou a calcular a massa molar ou foi direto na regra de três?").
- Se uma foto estiver ilegível, cortada ou não for da resolução, diga isso em aviso e não finja que leu.
- Se ela respondeu a perguntas suas antes (campo esclarecimentos), use essas respostas como parte do raciocínio dela.
- Se o gabarito não foi informado, resolva a questão por conta própria, diga em aviso que o gabarito não veio e que ela deve conferir com o oficial.
- Se for uma dúvida (tipo "duvida") e não um erro: explique o conceito pedido e, se ela escreveu um raciocínio, diga onde ele diverge. tipo_erro pode ser "indefinido" se não houve erro a diagnosticar.

Como ensinar:
- forma_correta: o caminho certo em passos curtos e numéricos, na ordem em que ela faria na prova, com a conta quando houver.
- como_reconhecer: de 2 a 4 sinais no enunciado que denunciam este tipo de questão e o que fazer ao reconhecê-los — para ela identificar questões parecidas em qualquer vestibular. Fale do tipo de questão, não de "o que a banca X sempre faz".
- para_fixar: uma regra de bolso de uma frase.

Classificação (ela usa isso nas estatísticas, então seja consistente):
- tipo_erro: exatamente um destes — ${TIPOS_ERRO.join(", ")}.
- padrao: rótulo curto (até 8 palavras) do erro em si, no estilo "esqueceu de converter gramas em mols". Se a lista padroes_ja_usados tiver um rótulo que descreve o MESMO erro, reutilize-o exatamente igual. Vazio se o diagnóstico não é confiável.
- tipo_questao: rótulo curto (até 6 palavras) do tipo de questão, no estilo "cálculo estequiométrico" ou "interpretação de gráfico". Reutilize exatamente um de tipos_ja_usados quando servir.
- materia e assunto: os que você considera corretos para a questão.

Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois, neste formato:
{
 "diagnostico_confiavel": true,
 "tipo_erro": "conceito",
 "padrao": "",
 "tipo_questao": "",
 "materia": "",
 "assunto": "",
 "onde_errou": "",
 "forma_correta": ["", ""],
 "resposta_correta": "",
 "como_reconhecer": ["", ""],
 "para_fixar": "",
 "perguntas_para_ela": [],
 "aviso": ""
}`;

const SISTEMA_DICAS = `${REGRAS_COMUNS}

Sua tarefa: escrever macetes, dicas práticas e estratégias para a Rafaela parar de repetir os erros dela.

Você recebe um resumo das estatísticas REAIS dela: os assuntos prioritários, quantos erros em cada, os padrões de erro, os tipos de questão e trechos do que ela mesma escreveu. Regras:
- Fale apenas dos assuntos e padrões que aparecem no resumo. Não acrescente assuntos que ela não errou.
- Cada item deve atacar o PADRÃO de erro dela naquele assunto, não o assunto em geral. Se o resumo diz que ela esquece de converter unidades em estequiometria, o macete é sobre isso — e traz o passo a passo para reconhecer e resolver esse tipo de exercício.
- Um macete só vale se estiver CORRETO. Se não houver um macete confiável para o assunto, entregue a estratégia (ordem de resolução, checagem final) e deixe macete vazio em vez de inventar um mnemônico duvidoso.
- Se o resumo tiver poucos registros, diga em aviso que as dicas ainda são gerais e que ficam mais precisas conforme ela registrar mais erros.
- Seja concreta: frases que ela possa aplicar na próxima prova, com um exemplo curto quando ajudar.

Responda SOMENTE com um objeto JSON válido neste formato:
{
 "resumo": "duas ou três frases sobre o que os registros dela mostram",
 "itens": [
  {
   "materia": "",
   "assunto": "",
   "padrao": "o erro que esta dica ataca",
   "macete": "",
   "dica_pratica": "",
   "como_reconhecer": "",
   "antes_de_marcar": ["", ""]
  }
 ],
 "aviso": ""
}`;

const SISTEMA_CLASSIFICAR = `${REGRAS_COMUNS}

Sua tarefa: a Rafaela fotografou uma questão (de vestibular ou da escola) para guardá-la no acervo dela. Você deve:
1. Transcrever fielmente o enunciado e as alternativas, em texto simples. Figuras, gráficos e tabelas: uma frase entre colchetes, no estilo [figura: reação química com dois reagentes]. NÃO resolva a questão e NÃO diga qual é a alternativa correta — o gabarito é decisão dela.
2. Escolher a matéria, exatamente uma da lista "materias" que vem no pedido.
3. Dar o assunto específico em até 6 palavras. Se a lista "assuntos" tiver um assunto que descreve o mesmo conteúdo, repita-o exatamente igual.

Se a imagem estiver ilegível, cortada, desfocada ou não for uma questão, responda legivel=false, deixe materia, assunto e texto vazios e explique o motivo em aviso. Não adivinhe a partir de trechos que você não consegue ler.

Responda SOMENTE com um objeto JSON válido neste formato:
{
 "legivel": true,
 "materia": "",
 "assunto": "",
 "texto": "",
 "aviso": ""
}`;

let cliente = null;
let clienteDeTeste = null;
const obterCliente = () => clienteDeTeste || cliente || (cliente = new Anthropic());

// Aceita só o necessário e corta o excesso: o texto dela vai para o prompt.
const txt = (v, n) => String(v == null ? "" : v).slice(0, n);

function origemPermitida(req) {
  const origem = req.headers.origin || "";
  if (!origem) return true; // chamada do próprio servidor / ferramentas locais
  let host = "";
  try { host = new URL(origem).host; } catch { return false; }
  if (host === (req.headers["x-forwarded-host"] || req.headers.host)) return true;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return true;
  return String(process.env.RAFAELA_ORIGENS || "").split(",").map(s => s.trim()).filter(Boolean).includes(origem);
}

function extrairJSON(texto) {
  const t = String(texto || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch { /* cai para o recorte abaixo */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* sem JSON */ } }
  return null;
}

const lista = (v, n, tam) => (Array.isArray(v) ? v : []).map(x => txt(x, tam)).filter(Boolean).slice(0, n);

function limparCorrecao(j) {
  const tipo = TIPOS_ERRO.includes(j.tipo_erro) ? j.tipo_erro : "indefinido";
  const confiavel = j.diagnostico_confiavel !== false;
  return {
    diagnostico_confiavel: confiavel,
    tipo_erro: tipo,
    padrao: confiavel ? txt(j.padrao, 90) : "",
    tipo_questao: txt(j.tipo_questao, 70),
    materia: txt(j.materia, 40),
    assunto: txt(j.assunto, 80),
    onde_errou: txt(j.onde_errou, 2500),
    forma_correta: lista(j.forma_correta, 12, 900),
    resposta_correta: txt(j.resposta_correta, 300),
    como_reconhecer: lista(j.como_reconhecer, 6, 600),
    para_fixar: txt(j.para_fixar, 400),
    perguntas_para_ela: lista(j.perguntas_para_ela, 3, 300),
    aviso: txt(j.aviso, 500)
  };
}

function limparDicas(j) {
  return {
    resumo: txt(j.resumo, 900),
    itens: (Array.isArray(j.itens) ? j.itens : []).slice(0, 8).map(i => ({
      materia: txt(i.materia, 40),
      assunto: txt(i.assunto, 80),
      padrao: txt(i.padrao, 160),
      macete: txt(i.macete, 700),
      dica_pratica: txt(i.dica_pratica, 900),
      como_reconhecer: txt(i.como_reconhecer, 700),
      antes_de_marcar: lista(i.antes_de_marcar, 5, 240)
    })),
    aviso: txt(j.aviso, 500)
  };
}

function limparClassificacao(j, materias) {
  const lista = (Array.isArray(materias) ? materias : []).map(m => txt(m, 40));
  const materia = lista.includes(j.materia) ? j.materia : "";
  const legivel = j.legivel !== false && !!txt(j.texto, 5);
  return {
    legivel,
    materia: legivel ? materia : "",
    assunto: legivel ? txt(j.assunto, 80) : "",
    texto: legivel ? txt(j.texto, 6000) : "",
    aviso: txt(j.aviso, 400)
  };
}

function montarPedidoCorrigir(d) {
  const r = d.registro || {};
  const linhas = [
    `TIPO: ${r.tipo === "duvida" ? "dúvida" : "erro"}`,
    `BANCA/ANO: ${txt(r.banca, 40) || "não informada"} ${txt(r.ano, 6)}${r.numero ? ` · questão nº ${txt(r.numero, 6)}` : ""}`,
    `MATÉRIA: ${txt(r.materia, 40) || "não informada"} · ASSUNTO: ${txt(r.assunto, 80) || "não informado"}`,
    `ALTERNATIVA QUE ELA MARCOU: ${txt(r.minhaResposta, 3) || "não informada"}`,
    `GABARITO: ${txt(r.gabarito, 3) || "não informado"}`,
    `COMO ELA RESOLVEU (escrito por ela): ${txt(r.raciocinio, 4000) || "(não escreveu)"}`,
    `ONDE ELA SENTIU DIFICULDADE (escrito por ela): ${txt(r.dificuldade, 3000) || "(não escreveu)"}`,
    `OBSERVAÇÕES DELA: ${txt(r.obs, 2000) || "(nenhuma)"}`
  ];
  if (d.questaoTexto) linhas.push(`TEXTO DA QUESTÃO (extraído do acervo, pode ter falhas):\n${txt(d.questaoTexto, 3500)}`);
  const esc = Array.isArray(d.esclarecimentos) ? d.esclarecimentos.slice(-3) : [];
  if (esc.length) {
    linhas.push("ESCLARECIMENTOS ANTERIORES:\n" + esc.map(e => `Perguntas suas: ${lista(e.perguntas, 3, 300).join(" | ")}\nResposta dela: ${txt(e.resposta, 2000)}`).join("\n---\n"));
  }
  const pad = lista(d.padroes, 25, 90), tip = lista(d.tipos, 25, 70);
  linhas.push(`padroes_ja_usados: ${pad.length ? pad.join(" | ") : "(nenhum ainda)"}`);
  linhas.push(`tipos_ja_usados: ${tip.length ? tip.join(" | ") : "(nenhum ainda)"}`);
  return linhas.join("\n");
}

async function chamar(sistema, conteudo, maxTokens) {
  const resposta = await obterCliente().messages.create({
    model: MODELO,
    max_tokens: maxTokens,
    system: sistema,
    messages: [{ role: "user", content: conteudo }]
  });
  if (resposta.stop_reason === "refusal") return { recusou: true };
  const texto = (resposta.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  return { json: extrairJSON(texto), cortou: resposta.stop_reason === "max_tokens" };
}

async function corrigir(d) {
  const imagens = (Array.isArray(d.imagens) ? d.imagens : []).slice(0, MAX_IMAGENS)
    .map(i => ({ rotulo: txt(i && i.rotulo, 80), dados: String((i && i.dados) || "").replace(/^data:image\/[a-z]+;base64,/, ""), tipo: /^image\/(jpeg|png|webp)$/.test(i && i.tipo) ? i.tipo : "image/jpeg" }))
    .filter(i => i.dados);
  const conteudo = [];
  imagens.forEach(i => {
    conteudo.push({ type: "text", text: `[${i.rotulo || "Imagem"}]` });
    conteudo.push({ type: "image", source: { type: "base64", media_type: i.tipo, data: i.dados } });
  });
  conteudo.push({ type: "text", text: montarPedidoCorrigir(d) });
  const r = await chamar(SISTEMA_CORRIGIR, conteudo, 4000);
  if (r.recusou) return { status: 422, corpo: { ok: false, erro: "Não consegui analisar esta questão." } };
  if (!r.json) return { status: 502, corpo: { ok: false, erro: "A resposta da IA veio num formato que não consegui ler. Tente de novo." } };
  return { status: 200, corpo: { ok: true, correcao: limparCorrecao(r.json), modelo: MODELO } };
}

async function classificar(d) {
  const im = d.imagem || {};
  const dados = String(im.dados || "").replace(/^data:image\/[a-z]+;base64,/, "");
  if (!dados) return { status: 400, corpo: { ok: false, erro: "Faltou a foto da questão." } };
  const materias = Array.isArray(d.materias) ? d.materias.slice(0, 30) : [];
  const assuntos = lista(d.assuntos, 60, 80);
  const conteudo = [
    { type: "image", source: { type: "base64", media_type: /^image\/(jpeg|png|webp)$/.test(im.tipo) ? im.tipo : "image/jpeg", data: dados } },
    { type: "text", text: `materias: ${materias.map(m => txt(m, 40)).join(" | ")}\nassuntos: ${assuntos.join(" | ") || "(nenhum ainda)"}` }
  ];
  const r = await chamar(SISTEMA_CLASSIFICAR, conteudo, 3500);
  if (r.recusou) return { status: 422, corpo: { ok: false, erro: "Não consegui ler esta questão." } };
  if (!r.json) return { status: 502, corpo: { ok: false, erro: "A resposta da IA veio num formato que não consegui ler. Tente de novo." } };
  return { status: 200, corpo: { ok: true, classificacao: limparClassificacao(r.json, materias), modelo: MODELO } };
}

async function dicas(d) {
  const resumo = d.resumo;
  if (!resumo || !Array.isArray(resumo.prioridades) || !resumo.prioridades.length) {
    return { status: 400, corpo: { ok: false, erro: "Ainda não há registros suficientes para gerar dicas." } };
  }
  const texto = "RESUMO REAL DAS ESTATÍSTICAS DA RAFAELA (JSON):\n" + JSON.stringify(resumo).slice(0, 14000) +
    (d.foco ? `\n\nFOCO PEDIDO: gere dicas só para ${txt(d.foco, 120)}.` : "");
  const r = await chamar(SISTEMA_DICAS, [{ type: "text", text: texto }], 4500);
  if (r.recusou) return { status: 422, corpo: { ok: false, erro: "Não consegui gerar as dicas." } };
  if (!r.json) return { status: 502, corpo: { ok: false, erro: "A resposta da IA veio num formato que não consegui ler. Tente de novo." } };
  return { status: 200, corpo: { ok: true, dicas: limparDicas(r.json), modelo: MODELO } };
}

async function handler(req, res) {
  const origem = req.headers.origin || "";
  if (origem && origemPermitida(req)) {
    res.setHeader("Access-Control-Allow-Origin", origem);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-codigo");
  if (req.method === "OPTIONS") return res.status(origemPermitida(req) ? 200 : 403).end();
  // Aberto no navegador, diz se a função está no ar e se tem a chave. Não revela a chave.
  if (req.method === "GET") return res.status(200).json({ ok: true, funcao: "ia", chaveDaIA: !!process.env.ANTHROPIC_API_KEY, pedeCodigo: !!process.env.RAFAELA_CODIGO });
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido" });
  if (!origemPermitida(req)) return res.status(403).json({ ok: false, erro: "Origem não autorizada" });
  if (process.env.RAFAELA_CODIGO && req.headers["x-codigo"] !== process.env.RAFAELA_CODIGO) {
    return res.status(401).json({ ok: false, erro: "Código de acesso incorreto ou ausente.", codigo: true });
  }

  let d;
  try { d = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {}); }
  catch { return res.status(400).json({ ok: false, erro: "JSON inválido" }); }

  if (!["corrigir", "dicas", "classificar"].includes(d.acao)) return res.status(400).json({ ok: false, erro: "Ação desconhecida" });
  if (!clienteDeTeste && !process.env.ANTHROPIC_API_KEY) return res.status(500).json({ ok: false, erro: "A chave da IA não está configurada neste painel." });

  if (d.acao === "corrigir" || d.acao === "classificar") {
    const total = (d.acao === "classificar" ? [d.imagem] : (Array.isArray(d.imagens) ? d.imagens : [])).reduce((s, i) => s + String((i && i.dados) || "").length, 0);
    if (total > MAX_BASE64_TOTAL) return res.status(413).json({ ok: false, erro: "As fotos ficaram grandes demais. Tente com menos fotos." });
  }

  try {
    const r = d.acao === "corrigir" ? await corrigir(d) : d.acao === "classificar" ? await classificar(d) : await dicas(d);
    return res.status(r.status).json(r.corpo);
  } catch (e) {
    if (Anthropic.RateLimitError && e instanceof Anthropic.RateLimitError) return res.status(429).json({ ok: false, erro: "Muitos pedidos seguidos. Tente de novo em instantes." });
    console.error("ia:", e && e.message);
    return res.status(500).json({ ok: false, erro: "A IA não respondeu agora. Tente de novo em instantes." });
  }
}

module.exports = handler;
module.exports.__teste = { extrairJSON, limparClassificacao, limparCorrecao, limparDicas, montarPedidoCorrigir, origemPermitida, definirCliente: c => { clienteDeTeste = c; } };
