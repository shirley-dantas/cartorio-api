// ══ A ALÍQUOTA DE FORA DA CAPITAL ════════════════════════════════════════
//
// O ITBI é municipal e o ITCMD é estadual. O painel sabe os de São Paulo — 3%
// e 4%, informados pela Shirley — e, para todo o resto, dizia apenas que não
// sabia. Ela lançou uma venda e compra de imóvel em Extrema-MG e o imposto
// saiu em branco: o número existe, está publicado no código tributário do
// município, e ela teria de procurar à mão no meio do atendimento.
//
// Então o painel procura. Esta função lê a web e devolve a alíquota com a
// fonte ao lado.
//
// TRÊS REGRAS, e nenhuma delas é detalhe:
//
//   1. O que volta daqui é HIPÓTESE, nunca fonte. Entra no painel como 🔴
//      incerta, o orçamento NÃO fecha como definitivo enquanto ela não
//      confirmar, e a confirmação é dela — um toque no botão. É a escada de
//      conhecimento do painel: degrau de baixo nunca vence degrau de cima, e
//      uma alíquota lida por máquina é o degrau mais baixo que existe.
//
//   2. Sem fonte, não há resposta. Se a busca não achar o ato que fixa a
//      alíquota, isto devolve `encontrado: false` e a razão. Um imposto
//      calculado sobre um número inventado é o erro mais caro que este
//      orçamento pode cometer, e é silencioso: o total parece certo.
//
//   3. Só o IMPOSTO se busca. A tabela de emolumentos não: o ato é praticado
//      em São Paulo, e vale a tabela de São Paulo sem exceção. Regra da
//      Shirley em 28/08/2026, e é por isso que esta função não tem nem um
//      caminho para procurar tabela de emolumentos de outro município.
//
// A resposta é guardada no banco por município, para a segunda escritura da
// mesma cidade não pagar outra busca — e para a confirmação dela valer para
// as próximas.

const https = require("https");

const FIREBASE_HOST = "painel-cartorio-default-rtdb.firebaseio.com";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODELO = "claude-opus-5";

// Web search com filtragem dinâmica — a variante que o Opus 5 suporta.
const FERRAMENTA_BUSCA = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 6
};

const PROMPT = `Você pesquisa alíquotas de imposto para um tabelionato de notas de São Paulo que precisa orçar uma escritura.

O que se pede é UM número: a alíquota vigente do imposto indicado, no município ou estado indicado.

Como trabalhar:
- Procure a fonte oficial: o código tributário municipal, a lei que fixou a alíquota, o decreto de regulamentação, ou a página da prefeitura/secretaria de fazenda. Portal de notícias e site de escritório de advocacia não são fonte — servem no máximo para achar o número da lei, que aí precisa ser conferido.
- O ITBI é MUNICIPAL: a alíquota é do município onde está o imóvel. Muitos municípios têm alíquota diferente para aquisição financiada pelo SFH e para a parte não financiada; se for o caso, informe a alíquota geral e diga isso na ressalva.
- O ITCMD é ESTADUAL: a alíquota é do estado. Vários estados têm alíquota progressiva por faixa; se for o caso, informe a menor alíquota e diga na ressalva que é progressiva, com as faixas.
- Não confunda a alíquota do ITBI com a do IPTU nem com taxa de serviço.

Se você NÃO encontrar a fonte que fixa a alíquota, diga que não encontrou. Não estime, não use "geralmente é 2%", não repita de memória. Um número errado aqui vira imposto cobrado a menos ou a mais na mão de uma cliente.

Responda SOMENTE com um bloco JSON, sem texto antes nem depois:

{
  "encontrado": true ou false,
  "aliquota": número decimal em porcentagem (ex: 2 para 2%, 2.5 para 2,5%) ou null,
  "fundamento": "a lei ou o ato que fixa a alíquota, com número e ano",
  "ressalva": "o que fica em aberto: progressividade, alíquota diferente para SFH, dúvida sobre vigência — ou string vazia",
  "fontes": ["url da fonte oficial", "..."],
  "porqueNao": "se encontrado for false, o que faltou"
}`;

// ── A IA, com a web aberta ───────────────────────────────────────────────
function chamarClaude(pergunta) {
  return new Promise((resolve, reject) => {
    if (!ANTHROPIC_API_KEY) return reject(new Error("ANTHROPIC_API_KEY não configurada"));
    const body = JSON.stringify({
      model: MODELO,
      max_tokens: 16000,
      system: PROMPT,
      tools: [FERRAMENTA_BUSCA],
      messages: [{ role: "user", content: pergunta }]
    });
    const req = https.request({
      hostname: "api.anthropic.com", path: "/v1/messages", method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body)
      }
    }, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try {
          const p = JSON.parse(data);
          if (p.error) return reject(new Error(p.error.message || "erro na API Claude"));
          // A resposta traz blocos de busca e blocos de texto; o JSON está no
          // texto. Junta-se todo o texto porque o modelo pode quebrá-lo em
          // mais de um bloco quando intercala buscas.
          const texto = (p.content || [])
            .filter(b => b && b.type === "text")
            .map(b => b.text).join("\n");
          resolve({ texto, urls: urlsDaBusca(p.content || []) });
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// As URLs que a busca de fato abriu. Servem de conferência do que o modelo
// diz ter lido: fonte declarada que não aparece aqui é fonte que ele não viu.
// Erro de ferramenta volta como objeto em `content`, e não como exceção — daí
// o Array.isArray antes de percorrer.
function urlsDaBusca(blocos) {
  const urls = [];
  blocos.forEach(b => {
    if (!b || b.type !== "web_search_tool_result") return;
    if (!Array.isArray(b.content)) return;   // veio erro, não resultado
    b.content.forEach(r => { if (r && r.url) urls.push(r.url); });
  });
  return [...new Set(urls)];
}

function extrairJson(texto) {
  const a = texto.indexOf("{");
  const b = texto.lastIndexOf("}");
  if (a === -1 || b === -1 || b < a) return null;
  try { return JSON.parse(texto.slice(a, b + 1)); } catch (e) { return null; }
}

// ── O banco ──────────────────────────────────────────────────────────────
function firebase(caminho, metodo, corpo) {
  return new Promise((resolve, reject) => {
    const body = corpo === undefined ? null : JSON.stringify(corpo);
    const req = https.request({
      hostname: FIREBASE_HOST, path: "/" + caminho, method: metodo,
      headers: Object.assign({ "Content-Type": "application/json" },
        body ? { "Content-Length": Buffer.byteLength(body) } : {})
    }, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        if (res.statusCode >= 400) return reject(new Error("firebase " + res.statusCode + ": " + data));
        try { resolve(data ? JSON.parse(data) : null); } catch (e) { resolve(null); }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// A chave de cada município: sem acento, sem caixa, sem espaço. É a mesma
// ideia do finClienteDe() — quem agrupa é o nome normalizado, porque cadastro
// de município não existe aqui.
function chaveDoLugar(imposto, municipio, uf) {
  const limpo = s => String(s || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return imposto === "itcmd" ? `itcmd-${limpo(uf)}` : `itbi-${limpo(municipio)}-${limpo(uf)}`;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ erro: "use POST" });
  const { imposto, municipio, uf, forcar } = req.body || {};

  if (imposto !== "itbi" && imposto !== "itcmd")
    return res.status(400).json({ erro: 'imposto deve ser "itbi" ou "itcmd"' });
  if (imposto === "itbi" && !String(municipio || "").trim())
    return res.status(400).json({ erro: "o ITBI é municipal: informe o município" });
  if (!String(uf || "").trim())
    return res.status(400).json({ erro: "informe o estado" });

  const chave = chaveDoLugar(imposto, municipio, uf);

  try {
    // Já procurado antes? A segunda escritura da mesma cidade não paga outra
    // busca — e se ela já confirmou, vem confirmada.
    if (!forcar) {
      const guardado = await firebase(`orcamento-aliquotas/${chave}.json`, "GET");
      if (guardado && guardado.aliquota != null)
        return res.status(200).json(Object.assign({}, guardado, { doCache: true }));
    }

    const onde = imposto === "itcmd"
      ? `no estado ${String(uf).trim()}`
      : `no município de ${String(municipio).trim()} — ${String(uf).trim()}`;
    const achado = await chamarClaude(
      `Qual é a alíquota vigente do ${imposto.toUpperCase()} ${onde}?`);
    const j = extrairJson(achado.texto);

    if (!j) return res.status(200).json({
      encontrado: false, aliquota: null,
      porqueNao: "a busca respondeu, mas não em formato que o painel saiba ler",
      fontes: achado.urls, chave });

    if (!j.encontrado || j.aliquota == null || !(Number(j.aliquota) > 0))
      return res.status(200).json({
        encontrado: false, aliquota: null,
        porqueNao: j.porqueNao || "a busca não localizou o ato que fixa a alíquota",
        fontes: achado.urls, chave });

    const registro = {
      chave, imposto,
      municipio: imposto === "itbi" ? String(municipio).trim() : null,
      uf: String(uf).trim().toUpperCase(),
      encontrado: true,
      aliquota: Number(j.aliquota),
      fundamento: String(j.fundamento || "").slice(0, 600),
      ressalva: String(j.ressalva || "").slice(0, 600),
      // As fontes que a busca de fato abriu, não só as que o modelo citou.
      fontes: (Array.isArray(j.fontes) ? j.fontes : []).concat(achado.urls)
        .filter((u, i, a) => u && a.indexOf(u) === i).slice(0, 6),
      // 🔴 sempre. Ela promove com um toque; nada sobe de degrau sozinho.
      confianca: "incerta",
      confirmadaPor: null, confirmadaEm: null,
      buscadaEm: new Date().toISOString().slice(0, 10)
    };
    await firebase(`orcamento-aliquotas/${chave}.json`, "PUT", registro);
    return res.status(200).json(registro);

  } catch (e) {
    // Falar. O painel inteiro aprendeu isto na noite de 28/08: dizer que deu
    // certo quando não deu é pior que não ter feito.
    return res.status(200).json({
      encontrado: false, aliquota: null, chave,
      porqueNao: "a busca falhou: " + (e && e.message ? e.message : "erro desconhecido")
    });
  }
};
