const https = require("https");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `Você é o coordenador operacional do 20º Cartório de Notas de São Paulo. A equipe (Shirley, Grazi e Gabriel) acabou de pedir para subir manualmente UM caso específico para o Foco do Dia, e quer que você leia as observações desse caso (que incluem registros datados de atendimentos, ligações e pendências/promessas feitas a clientes, no formato "[DD/MM HH:MM] resumo — Pendência: ...") e escreva um aviso curto sobre o que precisa de atenção nele hoje.

Regras:
- Leia a observação inteira com atenção a datas, nomes e pendências mencionadas
- Se houver uma pendência, promessa ou data específica nas observações, mencione esse detalhe real no aviso
- Se a observação estiver vazia ou não tiver nada de relevante, escreva um aviso genérico mas útil baseado no tipo de ato, status, prazo e dependência do caso
- Nunca invente datas, nomes ou fatos que não estão explicitamente nos dados fornecidos

REGRA CRÍTICA — NÃO CONFUNDIR ASSINATURA DA ESCRITURA COM PENDÊNCIAS DATADAS:
- O campo "Assinatura da escritura agendada" é a ÚNICA fonte confiável de que o ato principal será (ou foi) assinado. Só diga que "a escritura será assinada hoje/nesta data" se esse campo tiver uma data e ela corresponder ao que está sendo descrito.
- Datas mencionadas dentro das observações quase sempre são sobre OUTRA coisa: uma pendência, um ajuste, uma ligação, ou a coleta da assinatura de UMA parte específica (ex: cônjuge, anuente, herdeiro) para complementar um ato que já foi ou será assinado em outro momento pelas partes principais. Isso NÃO é "a escritura será assinada hoje" — descreva com precisão o que a observação realmente diz (ex: "hoje é pra colher a assinatura de Fulano para complementar o ato", não "a escritura de Fulano será assinada hoje")
- Se não estiver claro se uma data/assinatura mencionada na observação é a assinatura principal do ato ou uma coleta de assinatura complementar, não afirme nenhuma das duas — descreva o fato tal como está escrito, sem arredondar para "vai assinar a escritura"
- Tom caloroso e pessoal, dirigido à Shirley, exatamente como os outros avisos e lembretes do painel — nunca clínico ou telegráfico
- Texto corrido, sem markdown, sem listas, no máximo 2 frases curtas
- Responda SOMENTE com o texto do aviso, nada mais`;

function chamarClaude(mensagem) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
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

  const caso = dados.caso || {};
  if (!caso.nome) return res.status(400).json({ ok: false, erro: "Caso não informado" });

  const mensagem = `CASO: ${caso.nome} (${caso.tipo || "tipo não definido"})
Status: ${caso.status || "—"} | Responsável: ${caso.resp || "—"} | Prazo: ${caso.prazo || "—"} | Dias parado: ${caso.diasParado ?? 0} | Dependência: ${caso.dep || "nenhuma"}
Assinatura da escritura agendada: ${caso.agendado ? new Date(caso.agendado).toLocaleString("pt-BR") : "não marcada"}
Observações: ${caso.obs || "nenhuma"}

Escreva o aviso para subir esse caso ao Foco do Dia.`;

  try {
    const texto = await chamarClaude(mensagem);
    res.status(200).json({ ok: true, aviso: texto.trim() });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
};
