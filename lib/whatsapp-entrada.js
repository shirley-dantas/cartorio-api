// A caixa de entrada do WhatsApp: o que chega no número do cartório (API oficial da Meta) vira aviso no painel.
// Mora em lib/ e é atendido pela porta da Joaninha (api/perguntar-joaninha.js?acao=whatsapp, com a reescrita
// /whatsapp no vercel.json): o plano da Vercel aceita no máximo 12 funções em api/.
//
// A Meta chama este endereço de duas formas:
//   GET  — a verificação, uma vez, ao cadastrar o webhook: devolve o desafio se o token combinado confere;
//   POST — cada mensagem nova. Só PDF e imagem interessam; o arquivo é baixado da Meta aqui e entregue ao
//          Apps Script (entrada-receber), que o guarda numa pasta de espera. Nada vira caso sozinho: ela escolhe.
//
// Três variáveis de ambiente na Vercel (nunca no código):
//   WHATSAPP_TOKEN        o token permanente do usuário do sistema (baixa a mídia)
//   WHATSAPP_APP_SECRET   o segredo do aplicativo na Meta (confere a assinatura de cada chamada)
//   WHATSAPP_VERIFY_TOKEN uma frase escolhida por ela, a mesma digitada no cadastro do webhook
//   ENTRADA_SEGREDO       o segredo combinado com o Apps Script (a mesma propriedade lá)
const crypto = require("crypto");

const GRAPH = "https://graph.facebook.com/v21.0";
const DRIVE_URL = "https://script.google.com/macros/s/AKfycbz6NoiizP5ThvPWZ1ZZ_HAvJworawPrmfzCAXyCfY2n9oB8Qx4oFfYw0trGgm5liXHY/exec";
const MAX_BYTES = 10 * 1024 * 1024;
const PARALELO = 3;
const EXT = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic", "image/heif": "heif" };

function iguais(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

// A assinatura vem no cabeçalho como "sha256=<hex>", feita sobre o corpo CRU: refazer o JSON mudaria os bytes.
function assinaturaConfere(corpoCru, cabecalho, segredo) {
  if (!segredo || !cabecalho) return false;
  const esperado = "sha256=" + crypto.createHmac("sha256", segredo).update(corpoCru).digest("hex");
  return iguais(cabecalho, esperado);
}

// Do corpo da Meta, só o que é arquivo que o painel sabe receber.
function arquivosDaMensagem(corpo) {
  const itens = [], ignorados = [];
  for (const e of (corpo && corpo.entry) || []) for (const c of (e.changes || [])) {
    const v = c.value || {}, nomes = {};
    for (const ct of (v.contacts || [])) nomes[ct.wa_id] = (ct.profile && ct.profile.name) || "";
    for (const m of (v.messages || [])) {
      const mid = m.id || "", doc = m.type === "document" ? m.document : m.type === "image" ? m.image : null;
      if (!doc || !doc.id) { ignorados.push({ id: mid, motivo: "tipo " + (m.type || "?") }); continue; }
      const mime = String(doc.mime_type || "").toLowerCase().split(";")[0];
      const ext = EXT[mime] || (m.type === "image" ? "jpg" : "pdf");
      itens.push({ msgId: mid, mediaId: doc.id, mime, remetente: m.from || "", nomeRemetente: nomes[m.from] || "", nomeArquivo: doc.filename || ("WhatsApp_" + (mid.slice(-8) || "arquivo") + "." + ext) });
    }
  }
  return { itens, ignorados };
}

async function baixarDaMeta(item, token) {
  const aut = { headers: { Authorization: "Bearer " + token } };
  const meta = await (await fetch(GRAPH + "/" + encodeURIComponent(item.mediaId), aut)).json();
  if (!meta || !meta.url) throw new Error("A Meta não devolveu o endereço do arquivo.");
  if (Number(meta.file_size) > MAX_BYTES) return { grande: true };
  const r = await fetch(meta.url, aut);
  if (!r.ok) throw new Error("A Meta recusou o download (" + r.status + ").");
  const bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.length > MAX_BYTES) return { grande: true };
  return { bytes, mime: String(meta.mime_type || item.mime || "").toLowerCase().split(";")[0] };
}

async function entregarAoApps(item, arquivo, segredo) {
  const r = await fetch(DRIVE_URL, {
    method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ acao: "entrada-receber", segredo, msgId: item.msgId, remetente: item.remetente, nomeRemetente: item.nomeRemetente, nomeArquivo: item.nomeArquivo, mimetype: arquivo.mime, base64: arquivo.bytes.toString("base64") })
  });
  const j = await r.json().catch(() => null);
  if (!j || !j.ok) throw new Error((j && j.erro) || "O Apps Script não respondeu.");
  return j;
}

async function emLotes(itens, n, f) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => { while (i < itens.length) { const k = i++; out[k] = await f(itens[k]); } }));
  return out;
}

module.exports = async function whatsappEntrada(req, res) {
  const env = process.env;
  if (req.method === "GET") {
    const q = req.query || {};
    if (q["hub.mode"] === "subscribe" && iguais(q["hub.verify_token"], env.WHATSAPP_VERIFY_TOKEN)) return res.status(200).send(String(q["hub.challenge"] || ""));
    return res.status(403).send("Token de verificação inválido");
  }
  if (req.method !== "POST") return res.status(405).send("Método não permitido");
  if (!env.WHATSAPP_APP_SECRET || !env.WHATSAPP_TOKEN || !env.ENTRADA_SEGREDO) return res.status(500).send("WhatsApp não configurado na Vercel");

  const cru = typeof req.rawBody === "string" ? req.rawBody : typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  if (!assinaturaConfere(cru, (req.headers || {})["x-hub-signature-256"], env.WHATSAPP_APP_SECRET)) return res.status(401).send("Assinatura inválida");

  let corpo;
  try { corpo = JSON.parse(cru); } catch (e) { return res.status(400).send("JSON inválido"); }
  const { itens, ignorados } = arquivosDaMensagem(corpo);

  const resultados = await emLotes(itens, PARALELO, async (item) => {
    try {
      const arq = await baixarDaMeta(item, env.WHATSAPP_TOKEN);
      if (arq.grande) return { msgId: item.msgId, estado: "ignorado", motivo: "maior que 10 MB" };
      if (!EXT[arq.mime]) return { msgId: item.msgId, estado: "ignorado", motivo: "tipo " + arq.mime };
      const r = await entregarAoApps(item, arq, env.ENTRADA_SEGREDO);
      return { msgId: item.msgId, estado: r.repetida ? "repetida" : "recebido" };
    } catch (e) { return { msgId: item.msgId, estado: "falhou", motivo: String((e && e.message) || e).slice(0, 200) }; }
  });

  const falhou = resultados.filter((r) => r.estado === "falhou");
  // Se algo falhou, a Meta tenta de novo (e a mensagem que já entrou é reconhecida e não duplica).
  return res.status(falhou.length ? 500 : 200).json({ ok: !falhou.length, recebidos: resultados.filter((r) => r.estado === "recebido").length, ignorados: ignorados.length + resultados.filter((r) => r.estado === "ignorado").length, falhas: falhou });
};
module.exports.assinaturaConfere = assinaturaConfere;
module.exports.arquivosDaMensagem = arquivosDaMensagem;
