const ia = require("../lib/ia.js");


const SYSTEM_PROMPT = `Você é assistente do 20º Cartório de Notas de São Paulo.

Você recebe o relato (falado ou digitado) de um atendimento — ligação, e-mail, WhatsApp ou atendimento presencial — feito sobre um caso em andamento no cartório.

Sua tarefa: organizar esse relato em um registro claro para o histórico do caso.

Regras:
- Nunca invente informação que não foi dita no relato
- Resuma objetivamente em até 2-3 frases, em terceira pessoa, tom neutro de registro profissional
- Liste pendências e próximos passos identificados, se houver — incluindo qualquer promessa feita ao cliente (prazo de retorno, envio de documento, etc.)
- Se não houver pendências, retorne uma lista vazia
- Responda SOMENTE com um JSON válido, sem markdown, sem texto antes ou depois, no formato exato:
{"resumo": "texto do resumo", "pendencias": ["pendência 1", "pendência 2"]}`;

async function chamarIA(mensagem) {
  const opcoes = {
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: mensagem }]
  };
  return ia.texto(opcoes);
}

function extrairJson(texto) {
  const s = texto.indexOf("{");
  const e = texto.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("Resposta da IA não veio em formato reconhecível.");
  return JSON.parse(texto.slice(s, e + 1));
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

  const { nome, tipo, texto } = dados;
  if (!texto || !texto.trim()) return res.status(400).json({ ok: false, erro: "Texto do atendimento não informado" });

  const mensagem = `CASO: ${nome || "Não informado"}
TIPO DE ATO: ${tipo || "Não informado"}

RELATO DO ATENDIMENTO:
${texto}`;

  try {
    const resposta = await chamarIA(mensagem);
    const parsed = extrairJson(resposta);
    res.status(200).json({
      ok: true,
      resumo: parsed.resumo || "",
      pendencias: Array.isArray(parsed.pendencias) ? parsed.pendencias : []
    });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
};
