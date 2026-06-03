const https = require("https");

const DRIVE_URL = "https://script.google.com/macros/s/AKfycbz6NoiizP5ThvPWZ1ZZ_HAvJworawPrmfzCAXyCfY2n9oB8Qx4oFfYw0trGgm5liXHY/exec";

function httpPost(url, body) {
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

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).send("Método não permitido");

  let dados;
  try { dados = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ ok: false, erro: "JSON inválido" }); }

  const { nome, tipo, minuta, comentarios } = dados;
  if (!minuta) return res.status(400).json({ ok: false, erro: "Minuta não fornecida" });

  try {
    const driveResp = await httpPost(DRIVE_URL, {
      acao: "criar-minuta-doc",
      nome: nome || "Caso",
      tipo: tipo || "",
      minuta,
      comentarios: comentarios || []
    });

    if (!driveResp || !driveResp.url) {
      return res.status(500).json({ ok: false, erro: "Apps Script não retornou URL" });
    }

    return res.status(200).json({
      ok: true,
      docUrl: driveResp.url,
      folderUrl: driveResp.folderUrl || null,
      docNome: driveResp.nome || null
    });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message });
  }
};
