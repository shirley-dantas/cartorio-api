const https = require("https");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Extração de texto de um arquivo (PDF/imagem) via Claude. preservarIntegral=true
// pede transcrição completa, sem resumir (uso: minuta pronta a seguir à risca);
// false pede extração jurídica objetiva (uso: documento comum de apoio).
function chamarClaudeArquivo(base64, mimetype, preservarIntegral) {
  const blocoArquivo = mimetype === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: mimetype, data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mimetype, data: base64 } };
  const textoInstrucao = preservarIntegral
    ? "Este documento é uma escritura ou ato notarial já pronto. Transcreva o texto completo do documento, na íntegra, sem resumir, sem comentar e sem omitir nenhuma parte. Apenas o texto puro da minuta."
    : "Na primeira linha da resposta, identifique em poucas palavras o TIPO deste documento (ex: RG, CNH, Certidão de Nascimento, Certidão de Casamento, Certidão de Óbito, Matrícula do Imóvel, IPTU, Comprovante de Residência, Procuração, Contrato Social, Extrato Bancário, Guia de ITBI, Guia de ITCMD, etc.), no formato exato: \"TIPO_DOCUMENTO: <tipo>\". Depois, numa nova linha, extraia as informações jurídicas relevantes deste documento: partes (nome, CPF, RG, estado civil, endereço), dados do imóvel (matrícula, endereço, área), valores, datas e qualquer dado importante para elaboração de minuta notarial. Seja objetivo e liste tudo que encontrar.";

  const body = JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: preservarIntegral ? 4000 : 1024,
    messages: [{ role: "user", content: [blocoArquivo, { type: "text", text: textoInstrucao }] }]
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

// Mesma extração jurídica objetiva, a partir de texto puro (usada depois do
// mammoth ler um .docx que NÃO seja a minuta pronta a seguir à risca).
function chamarClaudeTexto(textoBruto) {
  const body = JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `Na primeira linha da resposta, identifique em poucas palavras o TIPO deste documento (ex: RG, CNH, Certidão de Nascimento, Certidão de Casamento, Certidão de Óbito, Matrícula do Imóvel, IPTU, Comprovante de Residência, Procuração, Contrato Social, Extrato Bancário, Guia de ITBI, Guia de ITCMD, etc.), no formato exato: "TIPO_DOCUMENTO: <tipo>". Depois, numa nova linha, extraia as informações jurídicas relevantes deste documento: partes (nome, CPF, RG, estado civil, endereço), dados do imóvel (matrícula, endereço, área), valores, datas e qualquer dado importante para elaboração de minuta notarial. Seja objetivo e liste tudo que encontrar.\n\nDOCUMENTO:\n${textoBruto}`
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

async function extrairTextoDocx(base64, preservarIntegral) {
  const mammoth = require("mammoth");
  const buffer = Buffer.from(base64, "base64");
  const resultado = await mammoth.extractRawText({ buffer });
  const textoBruto = (resultado && resultado.value && resultado.value.trim()) || null;
  if (!textoBruto) return null;
  if (preservarIntegral) return textoBruto;
  const dadosExtraidos = await chamarClaudeTexto(textoBruto);
  return dadosExtraidos || textoBruto;
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

  const base64 = dados.base64 || "";
  const mimetype = dados.mimetype || "application/pdf";
  const nomeArquivo = dados.nomeArquivo || "";
  const preservarIntegral = !!dados.preservarIntegral;
  if (!base64) return res.status(400).json({ ok: false, erro: "Arquivo vazio" });

  const isDocx = mimetype.indexOf("wordprocessingml.document") !== -1 || /\.docx$/i.test(nomeArquivo);

  try {
    const texto = isDocx
      ? await extrairTextoDocx(base64, preservarIntegral)
      : await chamarClaudeArquivo(base64, mimetype, preservarIntegral);
    return res.status(200).json({ ok: true, texto: texto || "" });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message });
  }
};
