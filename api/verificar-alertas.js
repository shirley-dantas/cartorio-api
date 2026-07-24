const https = require("https");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `Você é o coordenador operacional do 20º Cartório de Notas de São Paulo. Sua tarefa é revisar o panorama de todos os casos ativos e separar três coisas bem diferentes:

1. ALERTAS — casos realmente parados/esquecidos, sem nada programado, que precisam de uma cutucada
2. AGENDA DE HOJE — casos que JÁ TÊM algo programado para hoje (assinatura de escritura, compromisso combinado) e só precisam de uma checagem rápida, não de um alerta de atraso
3. AGENDA DE AMANHÃ — casos com algo programado para amanhã, para avisar com 1 dia de antecedência e ninguém ser pego de surpresa

Você recebe, para cada caso: nome, tipo de ato, responsável, prazo, dias parado sem movimento, dependência, a data de "assinatura da escritura" agendada (se houver — é só a PRIMEIRA/principal data, pode haver outras datas de outros assinantes mencionadas só no texto) e o texto de observações (que inclui registros datados de atendimentos, ligações e pendências/promessas feitas a clientes, no formato "[DD/MM HH:MM] resumo — Pendência: ...").

REGRA MAIS IMPORTANTE — leia a observação inteira, com atenção a QUALQUER data mencionada:
- Casos podem ter MAIS DE UM assinante em datas diferentes (ex: assinatura principal já feita, e uma assinatura complementar de outra pessoa em outra data). A data adicional só aparece escrita no texto da observação, não no campo estruturado — procure por qualquer menção a uma data de assinatura/compromisso futuro no texto, mesmo que já exista uma data diferente no campo estruturado. As duas podem estar certas ao mesmo tempo (datas diferentes, pessoas diferentes).
- Se alguma dessas datas (do campo OU do texto) for HOJE, isso NUNCA é um alerta de atraso — vai para AGENDA DE HOJE, mesmo que a dependência diga "Falta assinatura"/"Aguardando cliente" ou o caso esteja com dias parados.
- Se alguma dessas datas for AMANHÃ, gere um aviso em AGENDA DE AMANHÃ.
- Se uma data mencionada já passou e não há nenhum registro mais recente confirmando que aconteceu, aí sim é um ALERTA de verdade sobre aquela pendência específica.
- Nunca invente datas, nomes ou fatos que não estão explicitamente no texto fornecido.

Para ALERTAS, gere SOMENTE quando houver uma razão objetiva e específica de algo parado/esquecido:
- Uma promessa ou prazo mencionado nas observações cuja data já deveria ter passado, sem confirmação de que aconteceu
- Um caso com dependência de terceiro ou pendência clara, parado há muitos dias sem NADA programado
- Um prazo formal (campo prazo) que parece vencido pela quantidade de dias parado

Para AGENDA DE HOJE e AGENDA DE AMANHÃ, gere um item por caso, escrito como mensagem calorosa e pessoal dirigida à Shirley, mencionando os detalhes reais da observação (quem está envolvido, horário), terminando com uma pergunta de confirmação. Deixe claro no texto se é hoje ou amanhã. Exemplos de tom (adapte aos dados reais, nunca copie o exemplo): "Oi Shirley, a escritura do Carlos Cesar vai ser assinada hoje pelo Reinaldo às 14:30 — já está tudo certo?" ou "Lembrete: amanhã tem a assinatura do Reinaldo no caso do Carlos Cesar, às 14:30 — já está tudo encaminhado?"

Regras gerais:
- Se não houver nada preocupante ou programado em um caso, não gere nada para ele — silêncio é melhor que alerta forçado
- No máximo 6 alertas e 4 itens em cada lista de agenda, ordenados do mais urgente/próximo para o menos
- Tom sempre conversado e humano, nunca clínico ou telegráfico
- Responda SOMENTE com um JSON válido, sem markdown, no formato exato:
{"alertas": [{"nome": "nome do caso", "urgencia": "alta|media", "mensagem": "texto do alerta"}], "agendaHoje": [{"nome": "nome do caso", "mensagem": "mensagem sobre o compromisso de hoje"}], "agendaAmanha": [{"nome": "nome do caso", "mensagem": "mensagem sobre o compromisso de amanhã"}]}
- Se não houver nada em alguma das listas, responda com array vazio nela`;

function chamarClaude(mensagem) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
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
  const aprendizados = Array.isArray(dados.aprendizados) ? dados.aprendizados : [];
  const hoje = new Date().toISOString().split("T")[0];

  if (!casosAtivos.length) {
    return res.status(200).json({ ok: true, alertas: [] });
  }

  const listaCasos = casosAtivos.map(c =>
    `- ${c.nome} (${c.tipo || "tipo não definido"}) | responsável: ${c.resp || "—"} | prazo: ${c.prazo || "—"} | dias parado: ${c.diasParado ?? 0} | dependência: ${c.dep || "nenhuma"} | assinatura da escritura agendada: ${c.agendado ? new Date(c.agendado).toLocaleString("pt-BR") : "não marcada"}\n  observações: ${(c.obs || "nenhuma").slice(0, 400)}`
  ).join("\n\n");

  const mensagem = `DATA DE HOJE: ${hoje}

PANORAMA DOS CASOS ATIVOS:

${listaCasos}
${aprendizados.length ? `\nAPRENDIZADOS DA EQUIPE (correções que já fizeram em alertas/agenda anteriores — leve em consideração antes de decidir):\n${aprendizados.join("\n")}` : ""}

Revise e separe em alertas (coisa parada), agenda de hoje e agenda de amanhã (coisa programada), se houver.`;

  try {
    const resposta = await chamarClaude(mensagem);
    const parsed = extrairJson(resposta);
    res.status(200).json({
      ok: true,
      alertas: Array.isArray(parsed.alertas) ? parsed.alertas : [],
      agendaHoje: Array.isArray(parsed.agendaHoje) ? parsed.agendaHoje : [],
      agendaAmanha: Array.isArray(parsed.agendaAmanha) ? parsed.agendaAmanha : []
    });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
};
