const https = require("https");
const { assinaturaValida, nomePadronizado, dataSaoPaulo, lerPayload, cardIdValido, nomeSeguro } = require("../lib/tally-upload");

const FIREBASE_HOST = "painel-cartorio-default-rtdb.firebaseio.com";
const DRIVE_URL = "https://script.google.com/macros/s/AKfycbz6NoiizP5ThvPWZ1ZZ_HAvJworawPrmfzCAXyCfY2n9oB8Qx4oFfYw0trGgm5liXHY/exec";
const TAMANHO_MAX = 25 * 1024 * 1024;

// A assinatura é do corpo cru: o parser da Vercel precisa ficar de fora.
module.exports.config = { api: { bodyParser: false } };

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const partes = [];
    req.on("data", (d) => partes.push(d));
    req.on("end", () => resolve(Buffer.concat(partes)));
    req.on("error", reject);
  });
}

function baixar(url, saltos = 3) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    if (u.protocol !== "https:") return reject(new Error("link não é https"));
    const r = https.get(u, { timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && saltos > 0) {
        res.resume();
        return resolve(baixar(new URL(res.headers.location, url).toString(), saltos - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error("download HTTP " + res.statusCode)); }
      const partes = []; let total = 0;
      res.on("data", (d) => {
        total += d.length;
        if (total > TAMANHO_MAX) { r.destroy(new Error("arquivo maior que 25 MB")); return; }
        partes.push(d);
      });
      res.on("end", () => resolve(Buffer.concat(partes)));
      res.on("error", reject);
    });
    r.on("timeout", () => r.destroy(new Error("download demorou demais")));
    r.on("error", reject);
  });
}

function firebaseGet(caminho) {
  return new Promise((resolve) => {
    https.get(`https://${FIREBASE_HOST}/${caminho}.json`, (res) => {
      let d = ""; res.on("data", (x) => d += x);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(undefined); } });
    }).on("error", () => resolve(undefined));
  });
}

// O Apps Script responde com redirecionamento (302) para o resultado.
function postDrive(corpo) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(corpo);
    const u = new URL(DRIVE_URL);
    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } }, (res) => {
      const ler = (resp) => { let d = ""; resp.on("data", (x) => d += x); resp.on("end", () => { try { resolve(JSON.parse(d)); } catch { reject(new Error("resposta do Drive ilegível")); } }); };
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        res.resume();
        const lu = new URL(res.headers.location, DRIVE_URL);
        https.get(lu, ler).on("error", reject);
        return;
      }
      ler(res);
    });
    r.on("error", reject);
    r.write(payload); r.end();
  });
}

module.exports = Object.assign(async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Método não permitido");

  const cru = await lerCorpo(req);
  if (!assinaturaValida(cru, req.headers["tally-signature"], process.env.TALLY_SIGNING_SECRET)) {
    return res.status(401).json({ ok: false, erro: "assinatura inválida" });
  }

  let payload;
  try { payload = JSON.parse(cru.toString("utf8")); } catch { return res.status(400).json({ ok: false, erro: "JSON inválido" }); }
  const { cardId, responseId, arquivos } = lerPayload(payload);

  if (!cardIdValido(cardId)) { console.log("[tally] cardId ausente ou inválido"); return res.status(404).json({ ok: false, erro: "card não encontrado" }); }
  const caso = await firebaseGet(`casos/${cardId}`);
  if (!caso || typeof caso !== "object") { console.log("[tally] card não existe:", cardId); return res.status(404).json({ ok: false, erro: "card não encontrado" }); }

  const nomeCard = caso.nome || "Sem nome";
  const data = dataSaoPaulo();
  const existentes = caso.documentos && typeof caso.documentos === "object" ? caso.documentos : {};
  const resultados = [];
  const contagem = {};

  for (let i = 0; i < arquivos.length; i++) {
    const a = arquivos[i];
    const docKey = nomeSeguro(`tally_${responseId || Date.now()}_${i}`);
    try {
      // Reenvio do mesmo aviso (o Tally tenta de novo): não duplica.
      if (existentes[docKey]) { resultados.push({ ok: true, repetido: true }); continue; }
      const prefixo = `${nomeSeguro(nomeCard)}_${a.tipo}_${data}_`;
      const jaNoCard = Object.values(existentes).filter((d) => d && String(d.nome || "").startsWith(prefixo)).length;
      contagem[a.tipo] = (contagem[a.tipo] || 0) + 1;
      const n = jaNoCard + contagem[a.tipo];
      const nomeArquivo = nomePadronizado({ nomeCard, tipo: a.tipo, data, n, nomeOriginal: a.name, mime: a.mimeType });
      const buf = await baixar(a.url);
      const r = await postDrive({
        acao: "receber-documento-cliente", cardId, docKey, nome: nomeCard, folderUrl: caso.driveUrl || "",
        nomeArquivo, tipoDocumento: a.tipo, mimetype: a.mimeType || "application/octet-stream", base64: buf.toString("base64")
      });
      if (!r || !r.ok) throw new Error((r && r.erro) || "Drive não respondeu");
      resultados.push({ ok: true, nome: nomeArquivo, leu: !!r.leu });
    } catch (err) {
      // Nunca loga o link do arquivo: ele dá acesso ao documento.
      console.log(`[tally] arquivo ${i + 1} de ${arquivos.length} falhou:`, err.message);
      resultados.push({ ok: false, erro: err.message });
    }
  }

  const falhas = resultados.filter((r) => !r.ok).length;
  // Se algum arquivo falhou, responde 500 para o Tally reenviar; os que já
  // entraram são reconhecidos pela chave e não duplicam.
  return res.status(falhas ? 500 : 200).json({ ok: !falhas, recebidos: resultados.length - falhas, falhas });
}, { config: module.exports.config });
