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
//
// Sem a Meta (por enquanto): a mesma porta também atende o servidor Evolution ligado a um número PESSOAL dela
// (?via=evolution). O robô só RECEBE — nunca responde ninguém — e só aceita arquivo de quem está na lista
// ENTRADA_REMETENTES (o número do Business de onde ela encaminha), porque o pessoal recebe foto de todo mundo.
//   EVOLUTION_WEBHOOK_SEGREDO  (opcional) frase no endereço do webhook (?s=...); a Evolution não assina as chamadas
//   EVOLUTION_HOST, EVOLUTION_INSTANCE, EVOLUTION_API_KEY  o servidor dela (baixa a mídia)
//   ENTRADA_REMETENTES         números (só dígitos, separados por vírgula) cujos arquivos entram
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

const digitos = (x) => String(x || "").replace(/\D/g, "");

// O mesmo número aparece com e sem o 55 e com e sem o 9: compara pelos 8 últimos dígitos.
function remetenteAceito(candidatos, lista) {
  const permitidos = String(lista || "").split(",").map(digitos).filter((d) => d.length >= 8).map((d) => d.slice(-8));
  return candidatos.map(digitos).filter((d) => d.length >= 8).some((d) => permitidos.includes(d.slice(-8)));
}

// Do evento da Evolution, o arquivo (PDF ou imagem) de uma conversa individual; o resto é ignorado.
function arquivoDaEvolution(corpo) {
  if (!/messages[._]upsert/i.test(String((corpo && corpo.event) || ""))) return { ignorado: "evento " + ((corpo && corpo.event) || "?") };
  let d = corpo.data; if (Array.isArray(d)) d = d[0];
  const chave = (d && d.key) || {}, jid = String(chave.remoteJid || "");
  if (!chave.id) return { ignorado: "sem identificação" };
  if (/@g\.us$|status@broadcast/.test(jid)) return { ignorado: "grupo ou status" };
  let m = d.message || {};
  for (let i = 0; i < 3; i++) m = (m.documentWithCaptionMessage && m.documentWithCaptionMessage.message) || (m.ephemeralMessage && m.ephemeralMessage.message) || m;
  const doc = m.documentMessage || m.imageMessage;
  if (!doc) return { ignorado: "não é PDF nem imagem" };
  const mime = String(doc.mimetype || "").toLowerCase().split(";")[0];
  const ext = EXT[mime] || (m.imageMessage ? "jpg" : "pdf");
  return {
    candidatos: [jid, chave.remoteJidAlt, chave.senderPn, d.senderPn],
    item: { msgId: String(chave.id), remetente: digitos(chave.remoteJidAlt || chave.senderPn || jid), nomeRemetente: String(d.pushName || ""), mime, nomeArquivo: doc.fileName || ("WhatsApp_" + String(chave.id).slice(-8) + "." + ext) },
    chave, embutido: d.base64 || (d.message && d.message.base64) || ""
  };
}

async function baixarDaEvolution(a, env) {
  let base64 = a.embutido, mime = a.item.mime;
  if (!base64) {
    const r = await fetch("https://" + env.EVOLUTION_HOST + "/chat/getBase64FromMediaMessage/" + encodeURIComponent(env.EVOLUTION_INSTANCE), {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.EVOLUTION_API_KEY },
      body: JSON.stringify({ message: { key: a.chave }, convertToMp4: false })
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.base64) throw new Error("A Evolution não devolveu o arquivo (" + r.status + ").");
    base64 = j.base64; mime = String(j.mimetype || mime || "").toLowerCase().split(";")[0];
  }
  const bytes = Buffer.from(String(base64).replace(/^data:[^,]*,/, ""), "base64");
  if (bytes.length > MAX_BYTES) return { grande: true };
  return { bytes, mime };
}

// O que fica no registro da Vercel: só o motivo e o final do número (nunca o conteúdo, a chave ou o segredo).
const mascara = (j) => { const d = digitos(j); return (d ? "…" + d.slice(-4) : "?") + (/@(\w+)/.test(String(j || "")) ? "@" + String(j).split("@")[1] : ""); };
const anota = (...p) => { try { console.log("[entrada-evolution]", ...p); } catch (_) { /* o registro nunca derruba a resposta */ } };

async function viaEvolution(req, res) {
  const env = process.env;
  if (req.method !== "POST") return res.status(405).send("Método não permitido");
  anota("chamada recebida,", Array.isArray(req.body) ? "lista" : String((req.body && req.body.event) || "sem evento"));
  if (!env.EVOLUTION_HOST || !env.EVOLUTION_INSTANCE || !env.EVOLUTION_API_KEY || !env.ENTRADA_SEGREDO || !env.ENTRADA_REMETENTES) return res.status(500).send("Evolution não configurada na Vercel");
  // O segredo no endereço é opcional: sem ele, quem protege é a lista de remetentes (e nada vira caso sozinho).
  if (env.EVOLUTION_WEBHOOK_SEGREDO && !iguais((req.query || {}).s, env.EVOLUTION_WEBHOOK_SEGREDO)) return res.status(401).send("Segredo inválido");
  let corpo;
  try { corpo = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {}); } catch (e) { return res.status(400).send("JSON inválido"); }
  const a = arquivoDaEvolution(corpo);
  if (a.ignorado) { anota("ignorado:", a.ignorado); return res.status(200).json({ ok: true, ignorado: a.ignorado }); }
  if (!remetenteAceito(a.candidatos, env.ENTRADA_REMETENTES)) { anota("ignorado: remetente fora da lista; chegou de", a.candidatos.filter(Boolean).map(mascara).join(" | ")); return res.status(200).json({ ok: true, ignorado: "remetente fora da lista" }); }
  try {
    const arq = await baixarDaEvolution(a, env);
    if (arq.grande) { anota("ignorado: maior que 10 MB"); return res.status(200).json({ ok: true, ignorado: "maior que 10 MB" }); }
    if (!EXT[arq.mime]) { anota("ignorado: tipo", arq.mime); return res.status(200).json({ ok: true, ignorado: "tipo " + arq.mime }); }
    const r = await entregarAoApps(a.item, arq, env.ENTRADA_SEGREDO);
    anota(r.repetida ? "repetida" : "recebido", a.item.nomeArquivo, mascara(a.candidatos[0]));
    return res.status(200).json({ ok: true, recebido: !r.repetida, repetida: !!r.repetida });
  } catch (e) { anota("FALHOU:", String((e && e.message) || e).slice(0, 200)); return res.status(500).json({ ok: false, erro: String((e && e.message) || e).slice(0, 200) }); }
}

module.exports = async function whatsappEntrada(req, res) {
  const env = process.env;
  if (req.query && req.query.via === "evolution") return viaEvolution(req, res);
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
module.exports.arquivoDaEvolution = arquivoDaEvolution;
module.exports.remetenteAceito = remetenteAceito;
