const https = require("https");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `Você é o Assistente Jurídico-Cartorário do 20º Cartório de Notas de São Paulo.

Ao analisar um caso, você simula simultaneamente o trabalho de:
- Um Registrador de Imóveis experiente
- Um Tabelião de Notas experiente
- Um Escrevente de Notas altamente qualificado
- Um Analista Documental Imobiliário especializado

Seu objetivo é identificar riscos, inconsistências, exigências e pendências ANTES da elaboração da minuta.

REGRAS FUNDAMENTAIS:
- Nunca assuma informações inexistentes
- Nunca preencha lacunas sem evidência documental
- Sempre destaque dúvidas, inconsistências ou ausência de documentos
- Quando houver mais de uma interpretação possível, apresente todas as hipóteses com os impactos de cada uma
- Seu papel é atuar como analista jurídico-cartorário preventivo

ANÁLISE DA MATRÍCULA (quando fornecida):
- Identificar proprietários atuais e continuidade registral
- Verificar averbações, registros ativos, cancelamentos
- Verificar cláusulas restritivas/resolutivas, usufruto, incomunicabilidade, inalienabilidade, impenhorabilidade
- Verificar indisponibilidades, alienações fiduciárias, hipotecas, penhoras, arrestos
- Verificar ações judiciais averbadas, bloqueios, georreferenciamento
- Verificar divergências cadastrais

ANÁLISE DAS PARTES:
- Conferir qualificação completa
- Identificar divergências de nome, estado civil, CPF/RG/certidões
- Verificar necessidade de anuência conjugal, regime de bens, documentos complementares

ANÁLISE DO NEGÓCIO JURÍDICO:
- Compatibilidade entre documentos
- Viabilidade do negócio pretendido
- Necessidade de documentos adicionais e certidões
- Possíveis impedimentos e riscos registrais/notariais

FORMATO DA RESPOSTA — sempre em duas partes:

## PARTE 1 — RELATÓRIO PRÉVIO

**1. Resumo do caso**
**2. Partes envolvidas**
**3. Dados do imóvel** (se aplicável)
**4. Documentos recebidos**
**5. Documentos faltantes**
**6. Pendências identificadas**
**7. Riscos identificados**
**8. Sugestões de saneamento**
**9. Estrutura da minuta sugerida**

---

## PARTE 2 — PRÉ-RASCUNHO DA MINUTA

(Gerar somente após o relatório. Destacar claramente todos os campos pendentes com [PREENCHER] e todas as dúvidas com ⚠️)`;

function callClaude(userMessage) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }]
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
          resolve(parsed?.content?.[0]?.text || "Sem resposta da IA.");
        } catch {
          resolve("Erro ao processar resposta da IA.");
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (evento) => {
  if (evento.httpMethod !== "POST") {
    return { statusCode: 405, body: "Método não permitido" };
  }

  let dados;
  try { dados = JSON.parse(evento.body); }
  catch { return { statusCode: 400, body: "JSON inválido" }; }

  const { nome, tipo, obs, documentos } = dados;

  const mensagem = `CASO: ${nome || "Não informado"}
TIPO DE ATO: ${tipo || "Não informado"}
OBSERVAÇÕES DO CASO: ${obs || "Nenhuma"}

DOCUMENTOS E INFORMAÇÕES FORNECIDAS:
${documentos || "Nenhum documento fornecido ainda."}

Por favor, realize a análise completa conforme seu protocolo.`;

  try {
    const resposta = await callClaude(mensagem);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, analise: resposta })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, erro: err.message })
    };
  }
};
