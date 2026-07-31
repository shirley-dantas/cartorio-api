const https = require("https");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `Você é o coordenador operacional do 20º Cartório de Notas de São Paulo. Sua tarefa é revisar o panorama de todos os casos ativos e separar três coisas bem diferentes:

1. ALERTAS — casos realmente parados/esquecidos, sem nada programado, que precisam de uma cutucada
2. AGENDA DE HOJE — casos que JÁ TÊM algo programado para hoje (assinatura de escritura, compromisso combinado) e só precisam de uma checagem rápida, não de um alerta de atraso
3. AGENDA DE AMANHÃ — casos com algo programado para amanhã, para avisar com 1 dia de antecedência e ninguém ser pego de surpresa

Você recebe, para cada caso: nome, tipo de ato, responsável, prazo, dias parado sem movimento, dependência, a data de "assinatura da escritura" agendada (se houver — é só a PRIMEIRA/principal data), a "assinatura de segunda parte" quando o caso tiver uma (construtora, escritório, fundo, pessoa física etc — já vem com a relação com hoje calculada, igual a principal) e o texto de observações (que inclui registros datados de atendimentos, ligações e pendências/promessas feitas a clientes, no formato "[DD/MM HH:MM] resumo — Pendência: ...").

ATENÇÃO — o campo "prazo" NÃO é uma data de assinatura: é só um rótulo genérico de urgência do card, e vem como o texto literal "Hoje" por padrão em todo card novo, mesmo sem nenhuma data real definida. NUNCA use o campo "prazo" para decidir se uma assinatura é hoje ou amanhã — use SOMENTE a "assinatura da escritura agendada" e datas explícitas mencionadas no texto das observações.

REGRA MAIS IMPORTANTE — leia a observação inteira, com atenção a QUALQUER data mencionada:
- Casos podem ter MAIS DE UM assinante em datas diferentes (ex: assinatura principal já feita, e uma assinatura complementar de outra pessoa em outra data). Quando o caso tiver "assinatura de segunda parte" já estruturada, use ela (já vem com a relação com hoje calculada, é a fonte mais confiável) — só procure datas adicionais soltas no texto da observação quando NÃO houver segunda parte estruturada. As duas datas (principal e segunda parte) podem estar certas ao mesmo tempo (datas diferentes, pessoas diferentes).
- Se alguma dessas datas (do campo OU do texto) for HOJE, isso NUNCA é um alerta de atraso — vai para AGENDA DE HOJE, mesmo que a dependência diga "Falta assinatura"/"Aguardando cliente" ou o caso esteja com dias parados.
- Se alguma dessas datas for AMANHÃ, gere um aviso em AGENDA DE AMANHÃ.
- Se uma data mencionada já passou e não há nenhum registro mais recente confirmando que aconteceu, aí sim é um ALERTA de verdade sobre aquela pendência específica.
- Nunca invente datas, nomes ou fatos que não estão explicitamente no texto fornecido.
- Datas no formato DD/MM ou DD/MM/AAAA mencionadas no texto das observações já vêm anotadas automaticamente logo em seguida com a relação correta (ex: "03/08 — isso é daqui a 3 dias") — CONFIE nessa anotação, nunca recalcule por conta própria. Só para datas escritas por extenso ou como dia da semana (sem essa anotação), confira com cuidado redobrado contra a "DATA DE HOJE" antes de decidir se é hoje, amanhã ou já passou.

Para ALERTAS, gere SOMENTE quando houver uma razão objetiva e específica de algo parado/esquecido:
- Uma promessa ou prazo mencionado nas observações cuja data já deveria ter passado, sem confirmação de que aconteceu
- Um caso com dependência de terceiro ou pendência clara, parado há muitos dias sem NADA programado
- Um prazo formal (campo prazo) que parece vencido pela quantidade de dias parado
- Um "lembrete para travar agenda com [alguém]" cuja data já passou sem que a assinatura da segunda parte tenha sido definida — gerencie isso de forma ativa e crescente: quanto mais dias passaram do lembrete, mais urgente e direto o tom do alerta (ex: "já se passaram 3 dias desde o prazo pra travar a agenda com a Construtora X — vale ligar hoje pra não perder mais tempo"), sempre nomeando quem precisa ser contatado

ATENÇÃO — data agendada antiga não é a mesma coisa que pendência aberta: se a "assinatura da escritura agendada" já passou há muitos dias (a anotação já vem calculada, ex: "isso já passou há 296 dias") e o caso ainda tem uma dependência clara (ex: "Nota de exigência", "Falta assinatura"), essa data antiga é HISTÓRICO — foi quando algo JÁ FOI assinado no passado, não algo que ainda precisa acontecer nela. NUNCA escreva o alerta como se essa data velha precisasse ser "travada" ou fosse uma data futura a confirmar. O alerta deve focar EXCLUSIVAMENTE na dependência em si (o que falta fazer agora, ex: providenciar/assinar uma retificação pra cumprir a nota de exigência) — pode citar a data antiga só como contexto de quanto tempo já se passou, nunca como algo ainda pendente de agendar.

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
  // Fuso de Brasília, não UTC — entre 21h e meia-noite (horário de SP) o UTC
  // já é o dia seguinte, fazendo a IA achar que um compromisso de hoje à
  // noite já tinha passado (ou vice-versa, confundir ontem com hoje).
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  if (!casosAtivos.length) {
    return res.status(200).json({ ok: true, alertas: [] });
  }

  // Divide em lotes e consulta a IA em paralelo, para o tempo de resposta
  // não crescer conforme a quantidade de casos ativos aumenta.
  const TAMANHO_LOTE = 12;
  const lotes = [];
  for (let i = 0; i < casosAtivos.length; i += TAMANHO_LOTE) {
    lotes.push(casosAtivos.slice(i, i + TAMANHO_LOTE));
  }

  // Calcula em código a relação da data agendada com hoje, em vez de deixar
  // a IA comparar as datas sozinha — ela errava essa conta (ex: tratava uma
  // data de 7 dias atrás como "hoje"), mesmo com a data de hoje informada.
  const relacaoComHoje = (agendadoISO) => {
    if (!agendadoISO) return "";
    const dataAgendada = agendadoISO.slice(0, 10);
    const diffDias = Math.round((new Date(dataAgendada) - new Date(hoje)) / 86400000);
    if (diffDias === 0) return " — ATENÇÃO: ISSO É HOJE";
    if (diffDias === 1) return " — ATENÇÃO: ISSO É AMANHÃ";
    if (diffDias > 1) return ` — isso é daqui a ${diffDias} dias`;
    if (diffDias === -1) return " — isso foi ONTEM";
    return ` — isso já passou há ${Math.abs(diffDias)} dias`;
  };

  // Mesmo princípio do relacaoComHoje, mas para datas soltas dentro do texto
  // livre das observações (ex: "...cobrar aprovação até 03/08..."). Antes,
  // só as datas em campos estruturados eram calculadas em código — datas
  // mencionadas apenas no texto ficavam por conta da IA, que errava a conta
  // (ex: tratou "03/08" como "amanhã" quando faltavam 3 dias). Anota toda
  // data em formato DD/MM ou DD/MM/AAAA encontrada no texto, na hora, com a
  // relação já calculada — sem exigir que a IA faça essa aritmética sozinha.
  const anotarDatasNoTexto = (texto) => {
    if (!texto) return texto;
    const anoAtual = hoje.slice(0, 4);
    return texto.replace(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g, (match, d, m, y) => {
      const dia = d.padStart(2, "0");
      const mes = m.padStart(2, "0");
      const ano = y ? (y.length === 2 ? "20" + y : y) : anoAtual;
      const iso = `${ano}-${mes}-${dia}`;
      if (isNaN(new Date(iso).getTime())) return match;
      return match + relacaoComHoje(iso);
    });
  };

  // Descreve a "assinatura de segunda parte" (estruturada pelo fluxo guiado
  // do card) em texto pronto pra IA, com a mesma relação-com-hoje calculada
  // em código — nunca deixa a IA fazer essa conta sozinha.
  const linhaSegundaParte = (sp) => {
    if (!sp || !sp.status || sp.status === "juntos" || sp.status === "pendente") return "";
    if (sp.status === "data_definida" && sp.data) {
      return ` | assinatura de segunda parte (${sp.quem || "não identificado"}): ${new Date(sp.data).toLocaleString("pt-BR")}${relacaoComHoje(sp.data)}`;
    }
    if (sp.status === "lembrete" && sp.lembreteData) {
      return ` | lembrete para travar agenda com ${sp.quem || "não identificado"}: ${new Date(sp.lembreteData).toLocaleDateString("pt-BR")}${relacaoComHoje(sp.lembreteData)} (data da assinatura em si ainda não definida)`;
    }
    return "";
  };

  const montarMensagem = (lote) => {
    const listaCasos = lote.map(c =>
      `- ${c.nome} (${c.tipo || "tipo não definido"}) | responsável: ${c.resp || "—"} | prazo: ${c.prazo || "—"} | dias parado: ${c.diasParado ?? 0} | dependência: ${c.dep || "nenhuma"} | assinatura da escritura agendada: ${c.agendado ? new Date(c.agendado).toLocaleString("pt-BR") + relacaoComHoje(c.agendado) : "não marcada"}${linhaSegundaParte(c.segundaParte)}\n  observações: ${anotarDatasNoTexto((c.obs || "nenhuma").slice(0, 400))}`
    ).join("\n\n");

    return `DATA DE HOJE: ${hoje}

PANORAMA DOS CASOS ATIVOS:

${listaCasos}
${aprendizados.length ? `\nAPRENDIZADOS DA EQUIPE (correções que já fizeram em alertas/agenda anteriores — leve em consideração antes de decidir):\n${aprendizados.join("\n")}` : ""}

Revise e separe em alertas (coisa parada), agenda de hoje e agenda de amanhã (coisa programada), se houver.`;
  };

  const resultados = await Promise.allSettled(
    lotes.map(lote => chamarClaude(montarMensagem(lote)).then(extrairJson))
  );

  const alertas = [];
  const agendaHoje = [];
  const agendaAmanha = [];
  let algumSucesso = false;
  let primeiroErro = null;

  resultados.forEach(r => {
    if (r.status === "fulfilled") {
      algumSucesso = true;
      const parsed = r.value;
      if (Array.isArray(parsed.alertas)) alertas.push(...parsed.alertas);
      if (Array.isArray(parsed.agendaHoje)) agendaHoje.push(...parsed.agendaHoje);
      if (Array.isArray(parsed.agendaAmanha)) agendaAmanha.push(...parsed.agendaAmanha);
    } else if (!primeiroErro) {
      primeiroErro = r.reason && r.reason.message;
    }
  });

  if (!algumSucesso) {
    return res.status(500).json({ ok: false, erro: primeiroErro || "Erro desconhecido" });
  }

  res.status(200).json({
    ok: true,
    alertas: alertas.slice(0, 6),
    agendaHoje: agendaHoje.slice(0, 4),
    agendaAmanha: agendaAmanha.slice(0, 4)
  });
};
