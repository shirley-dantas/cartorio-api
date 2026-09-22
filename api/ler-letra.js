// Lê letra de mão e devolve o texto. Quem chama é o Bússola (o planner
// pessoal da Shirley, bussola-mu.vercel.app): ela escreve com a caneta num
// quadro, o Bússola manda a imagem, e o que volta vira o texto do campo — que
// aparece em cursiva, para ela saber o que foi escrito à mão.
//
// Ela autorizou em 22/09/2026 que a imagem passe pela IA em todos os campos,
// inclusive o Diário. Nada é guardado aqui: a imagem entra, o texto sai.
//
// Só responde ao próprio Bússola (e ao teste local): cada leitura custa, e
// uma porta aberta para qualquer site seria uma conta aberta.
const sdk = require("@anthropic-ai/sdk");
const Anthropic = sdk.default || sdk;

const ORIGENS = [
  "https://bussola-mu.vercel.app",
  "https://cartorio-api.vercel.app",
  "http://127.0.0.1:8197",
  "http://localhost:8197"
];
// Um quadro de caneta em PNG fica bem abaixo disto; acima, é outra coisa.
const MAX_BASE64 = 2 * 1024 * 1024;

const SISTEMA = `Você transcreve letra de mão em português do Brasil, escrita com caneta num tablet.
Devolva somente o texto escrito, exatamente como está: acentos, números, valores em reais e pontuação.
Mantenha as quebras de linha que houver.
Não comente, não explique, não use aspas nem formatação.
Se não houver nada legível na imagem, devolva exatamente: (ilegível)`;

let cliente = null;

module.exports = async (req, res) => {
  const origem = req.headers.origin || "";
  const permitida = ORIGENS.includes(origem);
  if (permitida) {
    res.setHeader("Access-Control-Allow-Origin", origem);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(permitida ? 200 : 403).end();
  // Aberto no navegador, diz se a função está no ar e se tem a chave da IA —
  // é o jeito de conferir sem ferramenta nenhuma. Não revela a chave.
  if (req.method === "GET") return res.status(200).json({ ok: true, funcao: "ler-letra", chaveDaIA: !!process.env.ANTHROPIC_API_KEY });
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido" });
  if (!permitida) return res.status(403).json({ ok: false, erro: "Origem não autorizada" });

  let dados;
  try { dados = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {}); }
  catch { return res.status(400).json({ ok: false, erro: "JSON inválido" }); }

  const imagem = String(dados.imagem || "").replace(/^data:image\/png;base64,/, "");
  if (!imagem) return res.status(400).json({ ok: false, erro: "Faltou a imagem" });
  if (imagem.length > MAX_BASE64) return res.status(413).json({ ok: false, erro: "Imagem grande demais" });

  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ ok: false, erro: "A chave da IA não está configurada no painel." });
  try {
    if (!cliente) cliente = new Anthropic();
    const resposta = await cliente.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 2000,
      // Transcrever é tarefa curta: esforço baixo basta e responde mais rápido.
      output_config: { effort: "low" },
      // Se o modelo recusar por engano, o próprio servidor tenta outro.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SISTEMA,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: imagem } },
          { type: "text", text: "Transcreva o que está escrito." }
        ]
      }]
    });
    if (resposta.stop_reason === "refusal") {
      return res.status(422).json({ ok: false, erro: "Não consegui ler esta escrita." });
    }
    const texto = resposta.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .trim();
    if (!texto || texto === "(ilegível)") return res.status(200).json({ ok: true, texto: "", ilegivel: true });
    return res.status(200).json({ ok: true, texto });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ ok: false, erro: "Muitas leituras seguidas. Tente de novo em instantes." });
    if (e instanceof Anthropic.AuthenticationError) return res.status(500).json({ ok: false, erro: "A chave da IA não está configurada." });
    if (e instanceof Anthropic.BadRequestError) return res.status(400).json({ ok: false, erro: "A IA não aceitou esta imagem." });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ ok: false, erro: "A IA não respondeu agora." });
    return res.status(502).json({ ok: false, erro: "Não deu para ler agora (" + String(e && e.message || e).slice(0, 120) + ")." });
  }
};
