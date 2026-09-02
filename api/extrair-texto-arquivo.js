const https = require("https");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Teto de saída da extração. Documento comum e modelo/minuta anexados usam o
// mesmo teto generoso: o corte de 1.024 tokens (documento comum) e 4.000
// (modelo) era o resumo virar o único material que a IA da minuta via — a
// matrícula, o RG, a certidão nunca eram lidos de verdade. Isso não elimina o
// corte (o teto continua existindo, é limite de saída da API), mas ele deixa
// de ser silencioso: ver EXTRACAO_MAX_TOKENS abaixo e o campo `truncou`.
const EXTRACAO_MAX_TOKENS = 8000;

// Extração de texto de um arquivo (PDF/imagem) via Claude. preservarIntegral=true
// pede transcrição completa, sem resumir (uso: minuta pronta a seguir à risca);
// false pede extração jurídica objetiva (uso: documento comum de apoio).
// Devolve {texto, truncou} — truncou=true quando a resposta da IA foi cortada
// pelo teto de tokens (stop_reason==="max_tokens"), nunca em silêncio.
function chamarClaudeArquivo(base64, mimetype, preservarIntegral) {
  const blocoArquivo = mimetype === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: mimetype, data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mimetype, data: base64 } };
  const textoInstrucao = preservarIntegral
    ? "Este documento é uma escritura ou ato notarial já pronto. Transcreva o texto completo do documento, na íntegra, sem resumir, sem comentar e sem omitir nenhuma parte. Apenas o texto puro da minuta."
    : "Na primeira linha da resposta, identifique em poucas palavras o TIPO deste documento (ex: RG, CNH, Certidão de Nascimento, Certidão de Casamento, Certidão de Óbito, Matrícula do Imóvel, IPTU, Comprovante de Residência, Procuração, Contrato Social, Extrato Bancário, Guia de ITBI, Guia de ITCMD, etc.), no formato exato: \"TIPO_DOCUMENTO: <tipo>\". Depois, numa nova linha, transcreva com fidelidade as informações jurídicas relevantes deste documento: partes (nome, CPF, RG, estado civil, endereço), dados do imóvel (matrícula, endereço, área), valores, datas e qualquer dado importante para elaboração de minuta notarial. Não resuma nem selecione o que parece mais relevante — transcreva tudo que encontrar.";

  const body = JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: EXTRACAO_MAX_TOKENS,
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
        try {
          const json = JSON.parse(data);
          resolve({ texto: json?.content?.[0]?.text || null, truncou: json?.stop_reason === "max_tokens" });
        }
        catch { resolve({ texto: null, truncou: false }); }
      });
    });
    req.on("error", () => resolve({ texto: null, truncou: false }));
    req.write(body);
    req.end();
  });
}

// Mesma extração jurídica objetiva, a partir de texto puro (usada depois do
// mammoth ler um .docx que NÃO seja a minuta pronta a seguir à risca).
// Devolve {texto, truncou}, mesma convenção de chamarClaudeArquivo.
function chamarClaudeTexto(textoBruto) {
  const body = JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: EXTRACAO_MAX_TOKENS,
    messages: [{
      role: "user",
      content: `Na primeira linha da resposta, identifique em poucas palavras o TIPO deste documento (ex: RG, CNH, Certidão de Nascimento, Certidão de Casamento, Certidão de Óbito, Matrícula do Imóvel, IPTU, Comprovante de Residência, Procuração, Contrato Social, Extrato Bancário, Guia de ITBI, Guia de ITCMD, etc.), no formato exato: "TIPO_DOCUMENTO: <tipo>". Depois, numa nova linha, transcreva com fidelidade as informações jurídicas relevantes deste documento: partes (nome, CPF, RG, estado civil, endereço), dados do imóvel (matrícula, endereço, área), valores, datas e qualquer dado importante para elaboração de minuta notarial. Não resuma nem selecione o que parece mais relevante — transcreva tudo que encontrar.\n\nDOCUMENTO:\n${textoBruto}`
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
        try {
          const json = JSON.parse(data);
          resolve({ texto: json?.content?.[0]?.text || null, truncou: json?.stop_reason === "max_tokens" });
        }
        catch { resolve({ texto: null, truncou: false }); }
      });
    });
    req.on("error", () => resolve({ texto: null, truncou: false }));
    req.write(body);
    req.end();
  });
}

// Devolve {texto, truncou} — igual às outras. Um .docx transcrito pelo
// mammoth nunca é truncado (é leitura local, sem teto de tokens); só a
// extração jurídica objetiva (não-integral) pode truncar.
async function extrairTextoDocx(base64, preservarIntegral) {
  const mammoth = require("mammoth");
  const buffer = Buffer.from(base64, "base64");
  const resultado = await mammoth.extractRawText({ buffer });
  const textoBruto = (resultado && resultado.value && resultado.value.trim()) || null;
  if (!textoBruto) return { texto: null, truncou: false };
  if (preservarIntegral) return { texto: textoBruto, truncou: false };
  const extraido = await chamarClaudeTexto(textoBruto);
  return { texto: extraido.texto || textoBruto, truncou: extraido.truncou };
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

  // Caminho leve: o .docx já foi lido no navegador (mammoth.browser) — só o
  // texto (bem menor que o arquivo original) chega aqui pra passar pela
  // extração jurídica objetiva. Evita reenviar o arquivo inteiro (que pode vir
  // com imagens embutidas e passar do limite de tamanho de requisição).
  if (dados.textoBruto) {
    try {
      const extraido = await chamarClaudeTexto(dados.textoBruto);
      return res.status(200).json({ ok: true, texto: extraido.texto || dados.textoBruto, truncou: extraido.truncou });
    } catch (err) {
      return res.status(500).json({ ok: false, erro: err.message });
    }
  }

  const base64 = dados.base64 || "";
  const mimetype = dados.mimetype || "application/pdf";
  const nomeArquivo = dados.nomeArquivo || "";
  const preservarIntegral = !!dados.preservarIntegral;
  if (!base64) return res.status(400).json({ ok: false, erro: "Arquivo vazio" });

  const isDocx = mimetype.indexOf("wordprocessingml.document") !== -1 || /\.docx$/i.test(nomeArquivo);

  try {
    const extraido = isDocx
      ? await extrairTextoDocx(base64, preservarIntegral)
      : await chamarClaudeArquivo(base64, mimetype, preservarIntegral);
    return res.status(200).json({ ok: true, texto: extraido.texto || "", truncou: extraido.truncou });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message });
  }
};
