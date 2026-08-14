const https = require("https");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Monta a lista de perguntas que a escrevente precisa responder ANTES de gerar
// a minuta. Existe porque boa parte do que a minuta pede não está em documento
// nenhum: profissão, regime de bens, se há outorga uxória, como o pagamento foi
// combinado, quem comparece por videoconferência. Sem isso a IA só tem o
// caminho de deixar ______ e a minuta volta cheia de buraco.
const SYSTEM_PROMPT = `Você é o assistente do 20º Tabelião de Notas de São Paulo, ajudando a escrevente a preparar a minuta de um ato notarial.

Sua tarefa: montar a lista de perguntas que ela precisa responder para a minuta sair o mais completa possível.

Você recebe o tipo de ato e TODO o material já disponível do caso (observações, documentos já lidos, minuta modelo, respostas dadas antes).

REGRAS:
- Pergunte SOMENTE o que ainda NÃO está no material recebido. Se o dado já aparece em qualquer parte do material, não pergunte de novo — essa é a regra mais importante.
- Priorize o que documento nenhum costuma trazer: estado civil e regime de bens, data e cartório do casamento, profissão, nacionalidade, endereço completo com CEP, necessidade de outorga uxória/anuência conjugal, forma e prazo de pagamento, dados bancários usados na transação, quem comparece e como (presencial, videoconferência ou híbrido), existência de procurador e poderes, usufruto ou cláusulas restritivas, valores e guias de imposto, quem retira o traslado.
- Adapte ao tipo de ato: inventário pergunta sobre herdeiros, meação e testamento; divórcio sobre filhos menores e partilha; procuração sobre poderes específicos e prazo; doação sobre reserva de usufruto e cláusulas; compra e venda sobre pagamento, quitação e entrega de chaves.
- No máximo 10 perguntas, da mais importante para a menos importante. Um assunto por pergunta.
- Escreva como quem fala com uma colega de cartório: direto, em português claro, sem juridiquês desnecessário e sem numerar a pergunta.
- "porque" é uma frase curta dizendo onde esse dado entra na minuta.
- "exemplo" é um exemplo curto do formato de resposta esperado, nunca um dado real de outro caso.

Responda SOMENTE com um JSON válido, sem markdown, sem texto antes ou depois, no formato exato:
{"perguntas":[{"pergunta":"texto da pergunta","porque":"onde isso entra na minuta","exemplo":"exemplo de resposta"}]}

Se o material recebido já cobrir tudo que a minuta precisa, responda {"perguntas":[]}.`;

function chamarClaude(mensagem) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
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
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido" });

  let dados;
  try { dados = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ ok: false, erro: "JSON inválido" }); }

  const { nome, tipo, modalidade, material } = dados;

  // O material pode ser longo (documentos inteiros já extraídos). Cortar aqui
  // é seguro: o começo é onde ficam as observações do caso e a identificação
  // das partes, que é o que decide quais perguntas ainda fazem falta.
  let materialTexto = String(material || "").trim() || "Nenhum material disponível ainda — o caso está começando do zero.";
  if (materialTexto.length > 40000) materialTexto = materialTexto.slice(0, 40000) + "\n\n[...material truncado por limite de tamanho...]";

  const mensagem = `CASO: ${nome || "Não informado"}
TIPO DE ATO: ${tipo || "Não informado"}
MODALIDADE: ${(modalidade || "digital").toUpperCase()}

MATERIAL JÁ DISPONÍVEL DO CASO:
${materialTexto}`;

  try {
    const resposta = await chamarClaude(mensagem);
    const parsed = extrairJson(resposta);
    const perguntas = (Array.isArray(parsed.perguntas) ? parsed.perguntas : [])
      .filter(p => p && p.pergunta)
      .slice(0, 10)
      .map(p => ({
        pergunta: String(p.pergunta).trim(),
        porque: String(p.porque || "").trim(),
        exemplo: String(p.exemplo || "").trim()
      }));
    res.status(200).json({ ok: true, perguntas });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
};
