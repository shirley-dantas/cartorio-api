// Upload de documentos por link (Tally) → card + Drive.
// Parte pura (sem rede): conferir assinatura, ler o payload, dar nome aos
// arquivos. A rede mora em api/tally-webhook.js, para esta parte ter teste.
const crypto = require("crypto");

// Tally assina o corpo cru: HMAC SHA256, em base64, no cabeçalho
// "tally-signature". Compara em tempo constante.
function assinaturaValida(corpoCru, assinatura, segredo) {
  if (!segredo || !assinatura) return false;
  const esperado = crypto.createHmac("sha256", segredo).update(corpoCru).digest("base64");
  const a = Buffer.from(esperado);
  const b = Buffer.from(String(assinatura));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function normalizar(t) {
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// O tipo vem do nome (label) do campo do formulário.
function tipoPeloCampo(label) {
  const t = normalizar(label);
  if (/\brg\b|\bcnh\b/.test(t)) return "RG_CNH";
  if (/certid/.test(t)) return "CERTIDAO";
  if (/comprovante|residenc/.test(t)) return "COMPROVANTE_RESIDENCIA";
  return "OUTROS";
}

// Sem acento, sem caractere que o Drive ou o Firebase estranhem.
function nomeSeguro(texto) {
  return String(texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_").replace(/^_|_$/g, "")
    .slice(0, 60) || "SEM_NOME";
}

function extensaoDe(nomeOriginal, mime) {
  const m = String(nomeOriginal || "").match(/\.([A-Za-z0-9]{1,5})$/);
  if (m) return m[1].toLowerCase();
  const porMime = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
  return porMime[mime] || "bin";
}

function dataSaoPaulo(d = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(d);
}

// {NomeDoCard}_{TipoDocumento}_{AAAA-MM-DD}_{n}.{extensão}
function nomePadronizado({ nomeCard, tipo, data, n, nomeOriginal, mime }) {
  return `${nomeSeguro(nomeCard)}_${tipo}_${data}_${n}.${extensaoDe(nomeOriginal, mime)}`;
}

// Lê o payload do Tally: { cardId, nomeCliente, responseId, arquivos:[{tipo,id,name,url,mimeType,size}] }
function lerPayload(p) {
  const d = (p && p.data) || {};
  const campos = Array.isArray(d.fields) ? d.fields : [];
  let cardId = "", nomeCliente = "";
  const arquivos = [];
  for (const c of campos) {
    const rotulo = normalizar(c.label);
    if (c.type === "HIDDEN_FIELDS" || rotulo === "cardid") {
      if (rotulo === "cardid") cardId = String(c.value || "").trim();
    } else if (c.type === "FILE_UPLOAD" && Array.isArray(c.value)) {
      for (const f of c.value) if (f && f.url) arquivos.push({ tipo: tipoPeloCampo(c.label), id: f.id, name: f.name, url: f.url, mimeType: f.mimeType, size: f.size });
    } else if (/nome/.test(rotulo) && typeof c.value === "string") {
      nomeCliente = c.value.trim();
    }
  }
  return { cardId, nomeCliente, responseId: String(d.responseId || d.submissionId || ""), arquivos };
}

// O cardId vira caminho do Firebase: só aceita o que o push() gera.
const cardIdValido = (id) => /^[A-Za-z0-9_-]{6,40}$/.test(id);

module.exports = { assinaturaValida, tipoPeloCampo, nomeSeguro, nomePadronizado, dataSaoPaulo, lerPayload, cardIdValido };
