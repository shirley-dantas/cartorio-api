// ══ PESQUISA DE REGRAS DE ELABORAÇÃO DA MINUTA ═══════════════════════════
//
// A função certa para "a IA ler e aprender as normas do cartório", pedida
// depois do mapeamento do tipo de ato: em vez de tentar isso numa conversa
// (que não teria como abrir as fontes primárias de verdade), roda aqui, na
// Vercel — mesma arquitetura do Radar Jurídico (api/radar-juridico.js), sem
// a restrição de rede que uma sessão interativa tem.
//
// Uso:
//   /api/pesquisar-regras-minuta?tipo=Escritura+de+Compra+e+Venda&chave=...
//
// Pesquisa UM tipo de ato por vez (a lista fechada de lib/tipos-de-ato.js),
// grava em /regras-minuta/{chave}. Três coisas que este arquivo NÃO faz, pelo
// mesmo motivo do Radar:
//
//   1. **Não escreve por cima do que ela já confirmou.** Tipo de ato com
//      `confirmado: true` não é regravado — a pesquisa nova entra em
//      `/regras-minuta/{chave}/proposta`, ao lado, esperando ela decidir.
//   2. **Não inventa quando a fonte não respondeu.** Fonte que falhou vira
//      `fontesNaoLidas` no resultado — silêncio de fonte não é ausência de
//      exigência.
//   3. **Não marca nada como confirmado sozinho.** Toda pesquisa nasce
//      `confirmado: false`. Confirmar é ação dela, na tela (a construir a
//      seguir), do mesmo jeito que a Base de Regras do Radar.

const https = require("https");
const { TIPOS_PRINCIPAIS } = require("../lib/tipos-de-ato");
const { fontesParaTipo } = require("../lib/regras-minuta-fontes");
const { REGRAS_MINUTA_SYSTEM_PROMPT } = require("../lib/regras-minuta-prompt");
const { lerJson, chaveDoTema, conferirRegrasMinuta } = require("../lib/regras-minuta-triagem");

const FIREBASE_HOST = "painel-cartorio-default-rtdb.firebaseio.com";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODELO = "claude-sonnet-4-6";
const LIMITE_POR_FONTE = 8000;
const ESPERA_FONTE_MS = 9000;

function firebase(caminho, metodo, corpo) {
  return new Promise((resolve) => {
    const payload = corpo ? JSON.stringify(corpo) : null;
    const options = { method: metodo, headers: { "Content-Type": "application/json" } };
    if (payload) options.headers["Content-Length"] = Buffer.byteLength(payload);
    const r = https.request(`https://${FIREBASE_HOST}/${caminho}`, options, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    r.on("error", () => resolve(null));
    if (payload) r.write(payload);
    r.end();
  });
}

// Mesma peneira de HTML do Radar (lib/radar-triagem.js soOTexto), copiada em
// vez de importada porque essa função não está exportada de lá — dá pra
// juntar as duas se algum dia isso ficar chato de manter em dois lugares.
function soOTexto(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function baixar(url, saltos = 0) {
  return new Promise((resolve) => {
    let respondeu = false;
    const acabou = (r) => { if (!respondeu) { respondeu = true; resolve(r); } };
    let req;
    try {
      req = https.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; RegrasMinuta/1.0; painel do 20o Tabeliao de Notas de Sao Paulo)",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "pt-BR,pt;q=0.9"
        }
      }, (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location && saltos < 3) {
          res.resume();
          const destino = new URL(res.headers.location, url).toString();
          return baixar(destino, saltos + 1).then(acabou);
        }
        if (status !== 200) { res.resume(); return acabou({ erro: "respondeu " + status }); }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", d => {
          data += d;
          if (data.length > LIMITE_POR_FONTE * 12) { req.destroy(); acabou({ html: data }); }
        });
        res.on("end", () => acabou({ html: data }));
      });
    } catch (e) { return acabou({ erro: e.message }); }
    req.on("error", (e) => acabou({ erro: e.message }));
    req.setTimeout(ESPERA_FONTE_MS, () => { req.destroy(); acabou({ erro: "não respondeu a tempo" }); });
  });
}

async function lerFonte(fonte) {
  const r = await baixar(fonte.url);
  if (!r || r.erro) return { ...fonte, erro: (r && r.erro) || "não respondeu" };
  const texto = soOTexto(r.html).slice(0, LIMITE_POR_FONTE);
  if (!texto) return { ...fonte, erro: "respondeu vazio" };
  return { ...fonte, texto };
}

function chamarClaude(mensagem) {
  return new Promise((resolve, reject) => {
    if (!ANTHROPIC_API_KEY) return reject(new Error("ANTHROPIC_API_KEY não configurada"));
    const body = JSON.stringify({
      model: MODELO,
      max_tokens: 8000,
      system: REGRAS_MINUTA_SYSTEM_PROMPT,
      messages: [{ role: "user", content: mensagem }]
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
          resolve((p.content && p.content[0] && p.content[0].text) || "");
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function pesquisar(tipoAto) {
  const fontes = fontesParaTipo(tipoAto);
  const lidas = await Promise.all(fontes.map(lerFonte));
  const comTexto = lidas.filter(f => f.texto);
  const falharam = lidas.filter(f => !f.texto);

  if (!comTexto.length) {
    return {
      tipoAto, status: "falhou",
      resumo: "Nenhuma fonte respondeu — a pesquisa não leu nada.",
      documentos: [], podeConstar: [], naoPodeConstar: [], etapas: [], fundamentos: [],
      atencao: ["Nenhuma fonte respondeu nesta tentativa. Isso não quer dizer que não há regra — quer dizer que ninguém leu."],
      fontesUsadas: [], fontesSemNada: [],
      fontesNaoLidas: falharam.map(f => ({ id: f.id, nome: f.nome, erro: f.erro }))
    };
  }

  const mensagem =
`TIPO DE ATO PESQUISADO: ${tipoAto}

FONTES QUE NÃO RESPONDERAM:
${falharam.length ? falharam.map(f => `- ${f.nome} (${f.id}): ${f.erro}`).join("\n") : "Nenhuma — todas responderam."}

CONTEÚDO LIDO:
${comTexto.map(f =>
`──────────────────────────────────────────
FONTE: ${f.nome}
id: ${f.id} · ${f.primaria ? "PRIMÁRIA" : "DE ALERTA (nunca fundamenta sozinha)"}
o que procurar aqui: ${f.procurar}
──────────────────────────────────────────
${f.texto}`).join("\n\n")}

Levante as regras de elaboração deste tipo de ato e responda no formato JSON combinado.`;

  const bruto = await chamarClaude(mensagem);
  const j = conferirRegrasMinuta(lerJson(bruto));
  j.tipoAto = tipoAto;
  j.status = "ok";
  j.fontesNaoLidas = falharam.map(f => ({ id: f.id, nome: f.nome, erro: f.erro }));
  return j;
}

function autorizado(req) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return true;
  const url = new URL(req.url, "http://x");
  return url.searchParams.get("chave") === segredo;
}

module.exports = async (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ ok: false, erro: "não autorizado" });

  const url = new URL(req.url, "http://x");
  const tipoAto = url.searchParams.get("tipo");
  if (!tipoAto || !TIPOS_PRINCIPAIS.includes(tipoAto)) {
    return res.status(400).json({
      ok: false,
      erro: "Passe ?tipo= com um dos tipos da lista fechada.",
      tiposValidos: TIPOS_PRINCIPAIS
    });
  }

  const chave = chaveDoTema(tipoAto);

  try {
    const resultado = await pesquisar(tipoAto);
    resultado.pesquisadoEm = new Date().toISOString();

    const existente = await firebase(`regras-minuta/${chave}.json`, "GET");
    if (existente && existente.confirmado === true) {
      // Ela já conferiu isto. A pesquisa nova não apaga — fica ao lado,
      // esperando decisão, do mesmo jeito que a Base de Regras do Radar.
      await firebase(`regras-minuta/${chave}/proposta.json`, "PUT", resultado);
      return res.status(200).json({
        ok: true, tipoAto, chave, gravadoEm: "proposta",
        motivo: "Já existe uma versão confirmada — a pesquisa nova ficou em /proposta, sem sobrescrever."
      });
    }

    resultado.confirmado = false;
    await firebase(`regras-minuta/${chave}.json`, "PUT", resultado);
    res.status(200).json({
      ok: true, tipoAto, chave, gravadoEm: "principal (ainda não confirmado)",
      documentos: resultado.documentos.length,
      atencao: resultado.atencao.length,
      fontesNaoLidas: resultado.fontesNaoLidas.map(f => f.id)
    });
  } catch (err) {
    console.error("[regras-minuta] falhou:", err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
};
