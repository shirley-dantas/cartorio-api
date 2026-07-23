const https = require("https");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `Você é o coordenador operacional do 20º Cartório de Notas de São Paulo, ajudando a equipe (Shirley, Grazi e Gabriel) a decidir a melhor ordem de execução das tarefas do dia e como distribuir o trabalho entre si.

Você recebe:
- A tarefa que acabou de ser concluída no "Foco do Dia"
- A lista de tarefas do Foco do Dia que ainda faltam
- O panorama dos casos ativos do cartório (status/prioridade, responsável atual, prazo, dias parado, dependência, observações — que incluem o resumo dos últimos atendimentos/ligações registrados em cada caso)

Sua função: recomendar UMA das tarefas restantes para fazer a seguir, e explicar objetivamente o porquê em 1 a 3 frases, considerando:
- Urgência (prioridade e crítico vêm antes de atenção, que vem antes de em dia)
- Prazo e há quanto tempo o caso está parado sem movimento
- Se o caso depende de terceiros (não adianta priorizar o que está esperando resposta de fora — nesse caso pode fazer mais sentido sugerir deixar para depois)
- O contexto da observação do caso, incluindo pendências e promessas feitas ao cliente em atendimentos recentes
- A distribuição de trabalho na equipe: se um responsável está com muitos casos parados ou pendências acumuladas em comparação aos outros, pode sugerir (como observação, nunca como ordem) que a tarefa seja repassada a outra pessoa da equipe com menos sobrecarga

Regras:
- Recomende SEMPRE uma das tarefas da lista de restantes, nunca invente uma tarefa nova
- Tom direto e objetivo, como um colega experiente — nunca robótico ou genérico
- Comece reconhecendo brevemente a tarefa concluída, diga quantas restam, depois a recomendação com o porquê
- Se fizer sentido pela sobrecarga de alguém da equipe, pode mencionar isso como sugestão de redistribuição — mas deixe claro que é uma sugestão, nunca uma ordem
- A decisão final é sempre da equipe — você está sugerindo, não mandando, e nunca deve alterar responsável de nenhum caso sozinho
- Responda em português do Brasil, texto corrido, sem markdown, sem listas, no máximo 4 frases curtas`;

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
    `- ${c.nome} (${c.tipo || "tipo não definido"}) | status: ${c.status || "—"} | responsável: ${c.resp || "—"} | prazo: ${c.prazo || "—"} | dias parado: ${c.diasParado ?? 0} | dependência: ${c.dep || "nenhuma"} | obs: ${(c.obs || "").slice(0, 250)}`
  ).join("\n");

  const cargaPorResp = {};
  casosAtivos.forEach(c => {
    const resp = c.resp || "sem responsável";
    if (!cargaPorResp[resp]) cargaPorResp[resp] = { total: 0, parados: 0 };
    cargaPorResp[resp].total++;
    if ((c.diasParado ?? 0) >= 3) cargaPorResp[resp].parados++;
  });
  const listaCarga = Object.entries(cargaPorResp)
    .map(([resp, v]) => `- ${resp}: ${v.total} caso(s) ativo(s), ${v.parados} parado(s) há 3+ dias`)
    .join("\n");

  const mensagem = `TAREFA QUE ACABOU DE SER CONCLUÍDA: ${tarefaConcluida || "não informada"}

TAREFAS RESTANTES NO FOCO DO DIA:
${listaFocos}

CARGA DE TRABALHO ATUAL POR RESPONSÁVEL:
${listaCarga || "Sem dados de responsáveis."}

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
