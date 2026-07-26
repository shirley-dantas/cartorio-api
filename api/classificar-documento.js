const PARADAS = new Set(["de","da","do","das","dos","e","a","o","as","os","um","uma","para","com","em","no","na","por"]);

function normalizar(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

function tokens(s) {
  return normalizar(s).split(/\s+/).filter(t => t.length >= 3 && !PARADAS.has(t));
}

function extrairTextoDocx(base64) {
  try {
    const mammoth = require("mammoth");
    const buffer = Buffer.from(base64, "base64");
    return mammoth.extractRawText({ buffer }).then(r => r.value || "");
  } catch (e) {
    return Promise.resolve("");
  }
}

function sugerirCaso(textoBusca, casosAtivos) {
  const tokensBusca = new Set(tokens(textoBusca));
  if (!tokensBusca.size) return null;
  let melhor = null, melhorScore = 0;
  for (const c of casosAtivos) {
    const tokensCaso = tokens(c.nome);
    if (!tokensCaso.length) continue;
    const acertos = tokensCaso.filter(t => tokensBusca.has(t)).length;
    if (acertos > melhorScore) { melhorScore = acertos; melhor = c; }
  }
  if (!melhor || melhorScore < 1) return null;
  return { id: melhor.id, nome: melhor.nome, tipo: melhor.tipo || "", confianca: melhorScore };
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

  const nomeArquivo = dados.nomeArquivo || "";
  const ext = (dados.ext || "").toLowerCase();
  const casosAtivos = Array.isArray(dados.casosAtivos) ? dados.casosAtivos : [];

  let texto = "";
  if (ext === "docx" && dados.base64) {
    texto = await extrairTextoDocx(dados.base64);
  }

  const busca = `${nomeArquivo} ${texto.slice(0, 3000)}`;
  const sugestao = sugerirCaso(busca, casosAtivos);
  res.status(200).json({ ok: true, sugestao, textoExtraido: !!texto });
};
