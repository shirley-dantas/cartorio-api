const https = require("https");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// A mesma lista de verificação por tipo de ato que o analisar-caso e o Apps
// Script já usam pra guiar a geração. As perguntas saem dela: é o roteiro que
// o cartório de fato confere em cada escritura, não uma lista inventada aqui.
const { instrucoesPorTipo } = require("../lib/instrucoes-por-tipo");

// Monta a lista de perguntas que a escrevente precisa responder ANTES de gerar
// a minuta. Existe porque boa parte do que a minuta pede não está em documento
// nenhum: profissão, regime de bens, se há outorga uxória, como o pagamento foi
// combinado, quem comparece por videoconferência. Sem isso a IA só tem o
// caminho de deixar ______ e a minuta volta cheia de buraco.
const SYSTEM_PROMPT = `Você é o assistente do 20º Tabelião de Notas de São Paulo, ajudando a escrevente a preparar a minuta de um ato notarial.

Sua tarefa: montar a lista de perguntas que ela precisa responder para a minuta sair o mais completa possível.

Você recebe o tipo de ato e TODO o material já disponível do caso (observações, documentos já lidos, minuta modelo, respostas dadas antes).

REGRA NÚMERO UM — NÃO PERGUNTE O QUE ESTÁ EM DOCUMENTO:
Os documentos do caso são sempre anexados e SEMPRE serão lidos pela IA na hora de gerar a minuta. Então NUNCA pergunte um dado que qualquer documento civil ou registral traz — mesmo que ele ainda não apareça no material abaixo. Assuma que a certidão, o RG e a matrícula vão chegar.

NUNCA pergunte (a IA lê no documento): nome completo, nome dos pais/filiação, data de nascimento, data do óbito, data e cartório do casamento, nacionalidade, RG, CPF, número e cartório da matrícula, descrição e confrontações do imóvel, endereço do imóvel, número e valor de guia de imposto, número de certidão, regime de bens quando consta na certidão de casamento.

SÓ pergunte o que não está escrito em documento nenhum — o que só uma pessoa do cartório ou o cliente sabe: profissão, endereço residencial atual de cada parte, estado civil de hoje (quando não houver certidão que prove), telefone e e-mail, se há outorga uxória/anuência conjugal a colher, forma e prazo de pagamento combinados, conta usada na transação, quem comparece e como, se há procurador e com quais poderes, cláusulas acordadas (usufruto, inalienabilidade, reversão), quem retira o traslado, e as decisões que a família ou as partes tomaram e ninguém registrou ainda.

COMO ESCREVER A PERGUNTA:
- Chame as pessoas pelo PRIMEIRO NOME, quando o material já disser quem são. Se ainda não souber quem são, pergunte de forma genérica ("de cada herdeiro", "do vendedor"), sem pedir a qualificação completa.
- Agrupe por pessoa e peça só os campos humanos de uma vez. Modelo bom: "Do Marcelo: profissão, endereço residencial e estado civil hoje?" Modelo ruim (NUNCA faça assim): "Quem são os falecidos? Me passa nome completo, data de nascimento, data do óbito, nacionalidade, profissão, estado civil e domicílio de cada um."
- Uma pergunta enorme pedindo oito campos é sempre errada. Máximo três campos por pergunta, e todos do mesmo assunto.

DEMAIS REGRAS:
- A CHECAGEM DO ATO, quando vier abaixo, é o roteiro que este cartório já usa para conferir esse tipo de escritura. Percorra item por item: cada item que o material não cobre E que documento nenhum resolve vira uma pergunta sua.
- Quando a checagem do ato não vier (tipo de ato fora da lista), use os itens equivalentes que a prática notarial pede para esse ato.
- No máximo 8 perguntas, da mais importante para a menos importante. Prefira menos: perguntar pouco e certo vale mais que cobrir tudo.
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

  const checagem = instrucoesPorTipo(tipo);

  const mensagem = `CASO: ${nome || "Não informado"}
TIPO DE ATO: ${tipo || "Não informado"}
MODALIDADE: ${(modalidade || "digital").toUpperCase()}
${checagem ? `\nCHECAGEM DO ATO (roteiro do cartório para esse tipo de escritura):${checagem}\n` : ""}
MATERIAL JÁ DISPONÍVEL DO CASO:
${materialTexto}`;

  try {
    const resposta = await chamarClaude(mensagem);
    const parsed = extrairJson(resposta);
    const perguntas = (Array.isArray(parsed.perguntas) ? parsed.perguntas : [])
      .filter(p => p && p.pergunta)
      .slice(0, 8)
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
