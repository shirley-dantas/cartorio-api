// ══ A JOANINHA CONSULTA O JURÍDICO ═══════════════════════════════════════
//
// Duas perguntas diferentes, a mesma base por baixo:
//
//   modo "interna" — a pergunta curta de quem está com a escritura na mão
//     ("posso fazer essa videoconferência pra SP?"). Resposta técnica, seca,
//     sem enfeite: é para ler entre um atendimento e outro.
//
//   modo "cliente" — a Shirley digita um termo curto ("desobrigação do ITCMD
//     nas escrituras") e recebe a mensagem pronta para colar no WhatsApp, na
//     linguagem do cliente, citando a norma.
//
// O que os dois têm em comum, e é o motivo de este arquivo existir em vez de
// virar mais um pedaço do /api/perguntar-joaninha: **nenhum dos dois pode
// dizer "já pode aplicar" sem dizer o que continua exigido.** É o critério da
// hierarquia normativa — competência do órgão e etapa por etapa —, e ele foi
// escrito porque o ITCMD quase escorregou nele: o CNJ dispensou o imposto
// para a escritura e o Registro de Imóveis continuou pedindo. Uma mensagem
// dizendo só a primeira metade teria mandado cliente embora achando que o
// imóvel já era dele.

const https = require("https");

const FIREBASE_HOST = "painel-cartorio-default-rtdb.firebaseio.com";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODELO = "claude-sonnet-4-6";
const DIAS_DE_RADAR = 14;

const CRITERIO_HIERARQUIA = `CRITÉRIO OBRIGATÓRIO — hierarquia normativa e etapas

Antes de dizer que alguma coisa mudou, ou que já pode ser aplicada, passe por estas quatro perguntas:

1. Competência — o órgão que publicou tem poder sobre essa matéria? O CNJ regula procedimento notarial e registral, mas não altera lei tributária estadual nem a Lei de Registros Públicos. A Corregedoria de SP regula a serventia, mas não muda lei federal.
2. Etapas — o ato tem mais de uma etapa (escritura, registro, averbação)? A mudança vale para todas, ou só para uma? Escritura e registro têm bases legais diferentes.
3. Alcance — vale para todo ato ou só para uma espécie? Vale em todo o país ou só onde a corregedoria local já se alinhou?
4. Vigência — já está valendo, ou depende de vacância ou regulamentação?

Daí decorrem três proibições, e elas não têm exceção:

- Nunca diga "está liberado", "não precisa mais" ou "foi dispensado" sem dizer, na mesma resposta, o que continua exigido — etapa por etapa.
- Se não der para verificar se a etapa seguinte já se adequou, diga "⚠️ aplicação parcial — confirmar" em vez de tratar como resolvido.
- Nunca invente número de Provimento, artigo, item de Normas de Serviço ou processo. Se o número não está na base, diga que a base não traz o número. Um número errado numa exigência é pior que nenhum número.

Quando a base trouxer um ponto marcado em "Atenção" (divergência de numeração, matéria não pacificada, ato não confirmado), repita esse ponto. Ele não é rodapé: é a parte que evita a exigência errada.`;

const PROMPT_INTERNA = `Você é a Joaninha, assistente do painel do 20º Tabelião de Notas da Capital de São Paulo.

Aqui você responde à escrevente — Shirley ou Grazi — que está com a escritura na mão e precisa saber uma coisa agora. Pergunta curta, resposta curta.

Como responder:
- Português do Brasil, texto corrido, sem markdown, sem listas, sem saudação, sem despedida.
- Vá direto ao ponto na primeira frase. Depois, se for o caso, a ressalva.
- No máximo 6 frases.
- Cite a norma entre parênteses quando ela estiver na base.
- Se a base não responder à pergunta, diga isso com todas as letras: "a base não traz isso" — e diga onde ela olharia (Normas de Serviço, CNJ, SEFAZ). Nunca preencha por conta.
- Isto é conversa interna: não formate para cliente, não suavize, não peça desculpas.

` + CRITERIO_HIERARQUIA;

const PROMPT_CLIENTE = `Você é a Joaninha, assistente do painel do 20º Tabelião de Notas da Capital de São Paulo.

Aqui você escreve a mensagem que a Shirley vai copiar e colar no WhatsApp do cliente. Ela digita um termo curto; você devolve a mensagem pronta.

O tom é o desta mensagem, que ela mesma aprovou e que é o modelo:

  Oi, [nome]! Boa pergunta 😊
  É verdade — no dia 18/08/2026 o CNJ decidiu que não é mais obrigatório pagar o ITCMD antes de lavrar a escritura de inventário e partilha (decisão do Plenário do CNJ, Pedido de Providências nº 0008622-24.2025.2.00.0000, que revogou parte do art. 15 da Resolução CNJ nº 35/2007). Então sim, já podemos seguir com a escritura da sua avó mesmo sem o imposto pago.
  Um detalhe importante, porém: essa dispensa vale só para a escritura. Se houver imóvel no inventário, o Registro de Imóveis continua exigindo a comprovação do ITCMD para efetivar a transferência (isso está no art. 289 da Lei de Registros Públicos e no item 117.1 das Normas de Serviço da Corregedoria de SP). Ou seja: a escritura sai, mas a transferência do imóvel só se completa depois do imposto pago.
  Na prática: dá pra avançar com a escritura agora. Se tiver imóvel na partilha, já vale ir organizando o pagamento do ITCMD, porque ele será necessário pra concluir o registro depois.
  Qualquer dúvida, é só chamar!

O que esse modelo tem, e a sua mensagem também precisa ter:
- Abertura curta e calorosa, com [nome] entre colchetes para ela trocar.
- A resposta direta primeiro.
- A norma citada por extenso, entre parênteses, sem sigla solta.
- Um parágrafo "um detalhe importante" com o que continua exigido — este parágrafo é obrigatório sempre que a mensagem falar em dispensa.
- Um parágrafo "na prática" dizendo o que o cliente faz agora.
- Fecho de uma linha.

Como escrever:
- Português do Brasil, linguagem de cliente: nada de "lavratura", "qualificação", "obstáculo registrário". Diga "fazer a escritura", "os dados das pessoas", "o cartório de imóveis vai pedir".
- Parágrafos curtos, separados por linha em branco. Um emoji, no máximo dois, e só na abertura.
- Não invente o nome do cliente, o parentesco nem detalhes do caso: use [nome] e, se precisar, [o imóvel] entre colchetes.
- Se a base não trouxer o assunto, não invente mensagem. Responda apenas: "A base não traz esse assunto ainda — não dá pra escrever essa mensagem sem inventar." E diga o que precisaria ser confirmado antes.
- Responda somente com a mensagem. Sem "aqui está", sem explicação antes ou depois.

` + CRITERIO_HIERARQUIA;

function firebase(caminho) {
  return new Promise((resolve) => {
    const r = https.get(`https://${FIREBASE_HOST}/${caminho}`, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    r.on("error", () => resolve(null));
    r.setTimeout(8000, () => { r.destroy(); resolve(null); });
  });
}

function chamarClaude(system, mensagem, maxTokens) {
  return new Promise((resolve, reject) => {
    if (!ANTHROPIC_API_KEY) return reject(new Error("ANTHROPIC_API_KEY não configurada"));
    const body = JSON.stringify({
      model: MODELO, max_tokens: maxTokens, system,
      messages: [{ role: "user", content: mensagem }]
    });
    const req = https.request({
      hostname: "api.anthropic.com", path: "/v1/messages", method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body)
      }
    }, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try {
          const p = JSON.parse(data);
          if (p.error) return reject(new Error(p.error.message || "erro na API Claude"));
          resolve((p.content && p.content[0] && p.content[0].text) || "");
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── A base, escrita para ser lida pela IA ────────────────────────────────
function temaEmTexto(chave, t) {
  if (!t) return "";
  const linhas = [`### ${t.titulo || chave}  (tema: ${chave})`];
  if (t.resumo) linhas.push(t.resumo);
  if (Array.isArray(t.naMesa) && t.naMesa.length)
    linhas.push("Na mesa:\n" + t.naMesa.map(x => "- " + x).join("\n"));
  if (Array.isArray(t.etapas) && t.etapas.length)
    linhas.push("Etapas:\n" + t.etapas.map(e => `- ${e.etapa}: ${e.situacao}${e.base ? " (" + e.base + ")" : ""}`).join("\n"));
  if (Array.isArray(t.fundamentos) && t.fundamentos.length)
    linhas.push("Fundamentos:\n" + t.fundamentos.map(f => `- ${f.ref}: ${f.texto}`).join("\n"));
  if (Array.isArray(t.atencao) && t.atencao.length)
    linhas.push("ATENÇÃO (repetir na resposta):\n" + t.atencao.map(x => "- " + x).join("\n"));
  if (t.atualizacoes && typeof t.atualizacoes === "object") {
    const u = Object.keys(t.atualizacoes).sort()
      .map(d => `- ${d}: ${t.atualizacoes[d] && t.atualizacoes[d].texto}`).join("\n");
    if (u) linhas.push("Acrescentado pelo Radar depois da carga inicial:\n" + u);
  }
  if (t.mensagemCliente)
    linhas.push("Mensagem de cliente já aprovada para este tema (use como base, adaptando):\n" + t.mensagemCliente);
  return linhas.join("\n");
}

function radarEmTexto(radar) {
  if (!radar || typeof radar !== "object") return "Nada no Radar ainda.";
  const dias = Object.keys(radar).sort().reverse();
  const linhas = [];
  for (const d of dias) {
    const itens = (radar[d] && Array.isArray(radar[d].itens) ? radar[d].itens : []).filter(i => i && i.selo !== "⚪");
    for (const i of itens) {
      linhas.push(`- ${d} ${i.selo} [${i.especie}] ${i.titulo} — ${i.orgao || "órgão não informado"}, ${i.referencia || "sem referência"}`
        + (i.oQueMuda ? `\n    muda: ${i.oQueMuda}` : "")
        + (i.oQueNaoMuda ? `\n    continua exigido: ${i.oQueNaoMuda}` : "")
        + (i.parcial ? `\n    ⚠️ aplicação parcial — confirmar${i.aConfirmar ? ": " + i.aConfirmar : ""}` : ""));
    }
  }
  return linhas.length ? linhas.join("\n") : "Nada relevante no Radar dos últimos dias.";
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

  const pergunta = String((dados && dados.pergunta) || "").trim();
  const modo = (dados && dados.modo) === "cliente" ? "cliente" : "interna";
  if (!pergunta) return res.status(400).json({ ok: false, erro: "Pergunta vazia" });

  try {
    const [base, radar] = await Promise.all([
      firebase("base-regras.json"),
      firebase(`radar-juridico.json?orderBy=%22%24key%22&limitToLast=${DIAS_DE_RADAR}`)
    ]);

    const temas = base && typeof base === "object" ? Object.keys(base) : [];
    if (!temas.length) {
      return res.status(200).json({
        ok: true, modo,
        resposta: "A base de regras ainda está vazia — não dá pra responder sem inventar. Rode a varredura do Radar uma vez (/api/radar-juridico?semear=1) para plantar a carga inicial.",
        semBase: true
      });
    }

    const mensagem =
`${modo === "cliente" ? "TERMO QUE ELA DIGITOU" : "PERGUNTA DA MESA"}: ${pergunta}

═══ BASE DE REGRAS DO CARTÓRIO ═══
${temas.map(k => temaEmTexto(k, base[k])).filter(Boolean).join("\n\n")}

═══ RADAR JURÍDICO — o que apareceu nos últimos dias ═══
${radarEmTexto(radar)}

Responda usando só o que está acima. ${modo === "cliente"
  ? "Devolva apenas a mensagem pronta para o WhatsApp."
  : "Responda em no máximo 6 frases, sem markdown."}`;

    const texto = await chamarClaude(
      modo === "cliente" ? PROMPT_CLIENTE : PROMPT_INTERNA,
      mensagem,
      modo === "cliente" ? 1200 : 500
    );
    res.status(200).json({ ok: true, modo, resposta: texto.trim(), temas: temas.length });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
};
