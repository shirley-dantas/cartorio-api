const https = require("https");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `Você é a Joaninha, a assistente do painel PRIME do 20º Cartório de Notas de São Paulo. A equipe (Shirley, Grazi e Gabriel) te faz perguntas soltas sobre a operação do dia — tipo "o que eu faço agora?", "qual cliente espera há mais tempo?", "quais processos dependem da construtora?".

Você recebe o panorama dos casos ativos (nome, tipo, status, responsável, prazo, dias parado, dependência, observações) e as tarefas do Foco do dia.

Regras estritas:
- Responda SOMENTE com base nos dados fornecidos. Nunca invente nome de cliente, prazo, valor, documento ou processo que não esteja nos dados.
- Se a pergunta pedir uma informação que os dados não contêm (ex.: tempo estimado de uma tarefa, algo que não foi registrado), diga claramente que essa informação não está disponível no painel — não tente adivinhar.
- Você nunca decide nem executa nada sozinha (não muda responsável, status, prazo). Você só observa e sugere.
- Tom: colega direta, calorosa e objetiva — nunca robótica, nunca genérica.
- Português do Brasil, texto corrido, sem markdown, sem listas, no máximo 4 frases curtas.`;

function chamarClaude(mensagem) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 350,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: mensagem }]
    });
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
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message || "Erro na API Claude"));
          resolve((parsed.content && parsed.content[0] && parsed.content[0].text) || "");
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const lerLetra = require("../lib/ler-letra.js");
const whatsappEntrada = require("../lib/whatsapp-entrada.js");

// O corpo é lido aqui, à mão, porque a assinatura do WhatsApp (lib/whatsapp-entrada.js) é feita sobre os bytes CRUS —
// com o leitor automático da Vercel eles já chegariam refeitos. Quem chega com o corpo pronto (os testes) passa direto.
function lerCorpoCru(req) {
  return new Promise((resolve, reject) => {
    let d = ""; req.setEncoding && req.setEncoding("utf8");
    req.on("data", (c) => { d += c; }); req.on("end", () => resolve(d)); req.on("error", reject);
  });
}
async function prepararCorpo(req) {
  if (req.body !== undefined || typeof req.on !== "function" || req.method === "GET" || req.method === "OPTIONS") return;
  req.rawBody = await lerCorpoCru(req);
  const tipo = String((req.headers && req.headers["content-type"]) || "");
  try { req.body = /json/i.test(tipo) && req.rawBody ? JSON.parse(req.rawBody) : req.rawBody; } catch (_) { req.body = req.rawBody; }
}

module.exports = async (req, res) => {
  await prepararCorpo(req);
  // A leitura da letra de mão do Bússola e a caixa de entrada do WhatsApp entram por esta mesma porta (ver
  // lib/ler-letra.js e lib/whatsapp-entrada.js): o plano da Vercel não comporta uma 13ª função.
  if (String(req.url || "").includes("acao=whatsapp") || (req.query && req.query.acao === "whatsapp")) return whatsappEntrada(req, res);
  if (String(req.url || "").includes("acao=ler-letra") || (req.query && req.query.acao === "ler-letra")) return lerLetra(req, res);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).send("Método não permitido");

  let dados;
  try { dados = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ ok: false, erro: "JSON inválido" }); }

  const pergunta = (dados.pergunta || "").trim();
  const casosAtivos = Array.isArray(dados.casosAtivos) ? dados.casosAtivos : [];
  const focosRestantes = Array.isArray(dados.focosRestantes) ? dados.focosRestantes : [];

  if (!pergunta) return res.status(400).json({ ok: false, erro: "Pergunta vazia" });

  const listaCasos = casosAtivos.map(c =>
    `- ${c.nome} (${c.tipo || "tipo não definido"}) | status: ${c.status || "—"} | responsável: ${c.resp || "—"} | prazo: ${c.prazo || "—"} | dias parado: ${c.diasParado ?? 0} | dependência: ${c.dep || "nenhuma"} | obs: ${(c.obs || "").slice(0, 250)}`
  ).join("\n");
  const listaFocos = focosRestantes.length ? focosRestantes.map((f, i) => `${i + 1}. ${f}`).join("\n") : "Nenhuma prioridade definida para hoje.";

  const mensagem = `PERGUNTA DA EQUIPE: ${pergunta}

FOCO DO DIA (tarefas ainda não concluídas):
${listaFocos}

PANORAMA DOS CASOS ATIVOS DO CARTÓRIO:
${listaCasos || "Nenhum caso ativo cadastrado."}

Responda à pergunta usando só esses dados.`;

  try {
    const texto = await chamarClaude(mensagem);
    res.status(200).json({ ok: true, resposta: texto.trim() });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
};

// Sem o leitor automático: o corpo cru é preciso para conferir a assinatura do WhatsApp (ver prepararCorpo).
module.exports.config = { api: { bodyParser: false } };
