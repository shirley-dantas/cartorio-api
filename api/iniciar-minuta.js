const https = require("https");

const DRIVE_URL = "https://script.google.com/macros/s/AKfycbz6NoiizP5ThvPWZ1ZZ_HAvJworawPrmfzCAXyCfY2n9oB8Qx4oFfYw0trGgm5liXHY/exec";

function dispararAppsScript(payload) {
  const body = JSON.stringify(payload);
  const u = new URL(DRIVE_URL);
  const options = {
    hostname: u.hostname,
    path: u.pathname + u.search,
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
  };
  const req = https.request(options, (res) => {
    res.resume(); // descarta resposta — não precisamos dela
  });
  req.on("error", () => {}); // ignora erros — Apps Script processa independente
  req.write(body);
  req.end();
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido" });

  let dados;
  try { dados = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ ok: false, erro: "JSON inválido" }); }

  const jobId = Date.now() + "-" + Math.random().toString(36).slice(2, 8);

  dispararAppsScript({
    acao: "gerar-e-criar-minuta",
    jobId,
    nome: dados.nome,
    tipo: dados.tipo,
    obs: dados.obs,
    documentos: dados.documentos,
    instrucao: dados.instrucao || "",
    modalidade: dados.modalidade || "digital"
  });

  return res.status(200).json({ ok: true, jobId });
};
