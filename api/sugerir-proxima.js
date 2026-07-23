const https = require("https");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `Você é o coordenador operacional do 20º Cartório de Notas de São Paulo, ajudando a escrevente Shirley a decidir a melhor ordem de execução das tarefas do dia.

Você recebe:
- A tarefa que ela acabou de concluir no "Foco do Dia"
- A lista de tarefas do Foco do Dia que ainda faltam
- O panorama dos casos ativos do cartório (status/prioridade, responsável, prazo, dias parado, dependência, observações)

Sua função: recomendar UMA das tarefas restantes para ela fazer a seguir, e explicar objetivamente o porquê em 1 a 3 frases, considerando:
- Urgência (prioridade e crítico vêm antes de atenção, que vem antes de em dia)
- Prazo e há quanto tempo o caso está parado sem movimento
- Se o caso depende de terceiros (não adianta priorizar o que está esperando resposta de fora — nesse caso pode fazer mais sentido sugerir deixar para depois)
- O contexto da observação do caso

Regras:
- Recomende SEMPRE uma das tarefas da lista de restantes, nunca invente uma tarefa nova
- Tom direto e objetivo, como um colega experiente — nunca robótico ou genérico
- Comece reconhecendo brevemente a tarefa concluída, diga quantas restam, depois a recomendação com o porquê
- A decisão final é sempre dela — você está sugerindo, não mandando
- Responda em português do Brasil, texto corrido, sem markdown, sem listas, no máximo 3 frases curtas`;

function chamarClaude(mensagem) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
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

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).send("Método não permitido");

  let dados;
  try { dados = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ ok: false, erro: "JSON inválido" }); }

  const tarefaConcluida = dados.tarefaConcluida || "";
  const focosRestantes = Array.isArray(dados.focosRestantes) ? dados.focosRestantes : [];
  const casosAtivos = Array.isArray(dados.casosAtivos) ? dados.casosAtivos : [];

  if (!focosRestantes.length) {
    return res.status(200).json({ ok: true, sugestao: null });
  }

  const listaFocos = focosRestantes.map((f, i) => `${i + 1}. ${f}`).join("\n");
  const listaCasos = casosAtivos.map(c =>
    `- ${c.nome} (${c.tipo || "tipo não definido"}) | status: ${c.status || "—"} | responsável: ${c.resp || "—"} | prazo: ${c.prazo || "—"} | dias parado: ${c.diasParado ?? 0} | dependência: ${c.dep || "nenhuma"} | obs: ${(c.obs || "").slice(0, 150)}`
  ).join("\n");

  const mensagem = `TAREFA QUE ACABOU DE SER CONCLUÍDA: ${tarefaConcluida || "não informada"}

TAREFAS RESTANTES NO FOCO DO DIA:
${listaFocos}

PANORAMA DOS CASOS ATIVOS DO CARTÓRIO:
${listaCasos || "Nenhum caso ativo cadastrado."}

Recomende qual tarefa restante fazer a seguir, com uma explicação objetiva.`;

  try {
    const texto = await chamarClaude(mensagem);
    res.status(200).json({ ok: true, sugestao: texto.trim() });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
};
