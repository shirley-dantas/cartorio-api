const https = require("https");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `Você é o coordenador operacional do 20º Cartório de Notas de São Paulo. Sua tarefa é revisar o panorama de todos os casos ativos e identificar alertas coerentes que a equipe precisa saber — coisas que podem estar sendo esquecidas.

Você recebe, para cada caso: nome, tipo de ato, responsável, prazo, dias parado sem movimento, dependência e o texto de observações (que inclui registros datados de atendimentos, ligações e pendências/promessas feitas a clientes, no formato "[DD/MM HH:MM] resumo — Pendência: ...").

Gere um alerta SOMENTE quando houver uma razão objetiva e específica, como:
- Uma promessa ou prazo mencionado nas observações (ex: "cliente disse que manda amanhã", "prometeu retornar sexta") cuja data, a julgar pela data do registro e o quanto o caso está parado, já deveria ter passado
- Um caso com dependência "Aguardando cliente" ou pendência clara, parado há muitos dias sem nenhum movimento
- Um prazo formal (campo prazo) que parece vencido pela quantidade de dias parado

Regras:
- NUNCA invente datas, promessas ou fatos que não estão explicitamente no texto fornecido
- Se não houver nada preocupante em um caso, não gere alerta para ele — silêncio é melhor que alerta forçado
- No máximo 6 alertas, ordenados do mais urgente para o menos urgente
- Cada alerta deve ser uma frase objetiva, mencionando o nome do caso e o motivo específico (baseado no texto real), sem generalidades
- Responda SOMENTE com um JSON válido, sem markdown, no formato exato:
{"alertas": [{"nome": "nome do caso", "urgencia": "alta|media", "mensagem": "texto do alerta"}]}
- Se não houver nenhum alerta coerente para gerar, responda {"alertas": []}`;

function chamarClaude(mensagem) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
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

  const casosAtivos = Array.isArray(dados.casosAtivos) ? dados.casosAtivos : [];
  const hoje = new Date().toISOString().split("T")[0];

  if (!casosAtivos.length) {
    return res.status(200).json({ ok: true, alertas: [] });
  }

  const listaCasos = casosAtivos.map(c =>
    `- ${c.nome} (${c.tipo || "tipo não definido"}) | responsável: ${c.resp || "—"} | prazo: ${c.prazo || "—"} | dias parado: ${c.diasParado ?? 0} | dependência: ${c.dep || "nenhuma"}\n  observações: ${(c.obs || "nenhuma").slice(0, 400)}`
  ).join("\n\n");

  const mensagem = `DATA DE HOJE: ${hoje}

PANORAMA DOS CASOS ATIVOS:

${listaCasos}

Revise e gere os alertas coerentes, se houver.`;

  try {
    const resposta = await chamarClaude(mensagem);
    const parsed = extrairJson(resposta);
    res.status(200).json({ ok: true, alertas: Array.isArray(parsed.alertas) ? parsed.alertas : [] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
};
