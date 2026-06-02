const https = require("https");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const INSTRUCOES_POR_TIPO = {
  "Inventário": `
ATENÇÃO — ATO: INVENTÁRIO / SOBREPARTILHA
- Verificar certidão de óbito (nome, data, estado civil, filiação)
- Identificar todos os herdeiros e meeiro (se houver)
- Verificar regime de bens do casamento do falecido
- Solicitar certidão de casamento ou nascimento de cada herdeiro
- Verificar se há testamento registrado
- Listar todos os bens do espólio (imóveis, veículos, contas, cotas, etc.)
- Verificar ITCMD: base de cálculo, alíquota SP (4%), isenções
- Verificar se há bens em outros estados (inventário parcial)
- Verificar meação × herança claramente
- Verificar dívidas do espólio e passivo
- Na minuta: incluir qualificação do falecido, herdeiros, partilha detalhada, recolhimento do ITCMD`,

  "Escritura de Compra e Venda": `
ATENÇÃO — ATO: ESCRITURA DE COMPRA E VENDA
- Verificar matrícula atualizada (últimos 30 dias)
- Verificar cadeia dominial e continuidade registral
- Verificar certidões negativas do vendedor (Receita Federal, TRT, TJ, distribuidores cíveis e criminais, protestos)
- Verificar ITBI: guia paga ou a calcular, base de cálculo, valor venal × valor negociado
- Verificar laudêmio (se enfiteuse/terreno de marinha)
- Verificar forma de pagamento e quitação
- Verificar anuência conjugal se casado
- Verificar se há financiamento ou alienação fiduciária a cancelar
- Na minuta: preço, forma de pagamento, data de quitação, entrega de chaves, responsabilidade por débitos anteriores`,

  "Procuração": `
ATENÇÃO — ATO: PROCURAÇÃO
- Identificar outorgante(s) e outorgado(s) com qualificação completa
- Definir poderes específicos (evitar cláusula "poderes gerais" sem especificação)
- Verificar se há substabelecimento e em que condições
- Verificar prazo de validade (se houver)
- Verificar finalidade: venda, representação, administração, judicial, etc.
- Se imóvel específico: identificar pela matrícula
- Verificar se outorgante é casado: anuência conjugal para atos de alienação
- Na minuta: declarar expressamente os poderes, o(s) bem(ns) se aplicável, prazo e cláusula de substabelecimento`,

  "Divórcio": `
ATENÇÃO — ATO: DIVÓRCIO CONSENSUAL EXTRAJUDICIAL
- Verificar certidão de casamento atualizada
- Verificar se há filhos menores ou incapazes (se houver, não pode ser extrajudicial — obrigatório judicial)
- Verificar partilha de bens: listar todos os bens comuns
- Verificar se há imóveis: matrícula, ITBI ou ITCMD conforme o caso
- Verificar guarda, alimentos e visitas (somente se filhos maiores e capazes)
- Verificar nome após o divórcio
- Verificar se há dívidas comuns a partilhar
- Na minuta: qualificação, dissolução do vínculo, partilha detalhada, alimentos (se aplicável), retorno ou manutenção de nome`,

  "União Estável": `
ATENÇÃO — ATO: UNIÃO ESTÁVEL
- Verificar documentos de ambos os companheiros (RG, CPF, certidão de nascimento ou casamento anterior)
- Verificar se há impedimentos matrimoniais
- Definir regime de bens (padrão: comunhão parcial)
- Verificar se é retroativa e desde quando
- Verificar se há bens a declarar na escritura
- Verificar cláusulas especiais (alimentos, herança, incomunicabilidade de bens específicos)
- Na minuta: qualificação completa, data de início, regime de bens, cláusulas específicas acordadas`,

  "Doação": `
ATENÇÃO — ATO: DOAÇÃO
- Identificar doador e donatário com qualificação completa
- Identificar o bem doado (imóvel: matrícula; outros: descrição detalhada)
- Verificar aceitação expressa do donatário
- Verificar ITCMD: base de cálculo, alíquota SP (4%), isenções (ex: doação até R$ 2.500 — verificar tabela vigente)
- Verificar cláusulas restritivas: inalienabilidade, impenhorabilidade, incomunicabilidade, reversão
- Verificar se doador é casado: regime de bens e anuência conjugal
- Verificar se é doação com ou sem reserva de usufruto
- Na minuta: identificação do bem, aceitação, encargos (se houver), cláusulas restritivas, ITCMD recolhido`,

  "Renúncia": `
ATENÇÃO — ATO: RENÚNCIA
- Identificar claramente o bem ou direito objeto da renúncia
- Verificar a que título o renunciante é titular (herdeiro, condômino, etc.)
- Verificar matrícula se imóvel
- Verificar se a renúncia é translativa (em favor de alguém) ou abdicativa (pura)
- Renúncia translativa pode gerar ITCMD ou ITBI — verificar incidência
- Verificar se renunciante é casado: anuência conjugal
- Verificar impacto registral: o que será averbado ou registrado no CRI
- Na minuta: qualificação, identificação do bem, natureza da renúncia, destinatário (se translativa), encargos fiscais`,

  "Cessão de Direitos": `
ATENÇÃO — ATO: CESSÃO DE DIREITOS
- Identificar cedente e cessionário
- Identificar os direitos cedidos (hereditários, possessórios, contratuais, etc.)
- Verificar se há imóvel envolvido: matrícula
- Verificar valor da cessão e forma de pagamento
- Verificar ITBI (cessão onerosa) ou ITCMD (cessão gratuita)
- Verificar anuência conjugal se cedente for casado
- Na minuta: descrição precisa dos direitos cedidos, valor, forma de pagamento, tributos`,

  "Pacto Antenupcial": `
ATENÇÃO — ATO: PACTO ANTENUPCIAL
- Verificar identidade e qualificação dos nubentes
- Confirmar regime de bens escolhido (comunhão universal, separação total, participação final nos aquestos)
- Verificar se há regime misto ou cláusulas especiais
- Verificar se há bens pré-nupciais a declarar/excluir
- Verificar data prevista do casamento e onde será realizado
- O pacto deve ser registrado no CRI do domicílio dos nubentes e averbado na certidão de casamento
- Na minuta: qualificação, regime escolhido, cláusulas especiais, bens excluídos (se aplicável)`,

  "Testamento": `
ATENÇÃO — ATO: TESTAMENTO PÚBLICO
- Verificar se testador está em plena capacidade civil
- Identificar herdeiros necessários (cônjuge, descendentes, ascendentes) e a legítima (50%)
- Verificar se disposições respeitam a quota disponível (até 50%)
- Verificar legatários e legados específicos
- Verificar cláusulas de substituição, condição ou encargo
- Verificar nomeação de testamenteiro
- Verificar deserdação ou reconhecimento de filho (se aplicável)
- Na minuta: disposições claras, respeito à legítima, identificação precisa dos bens e beneficiários`,

  "Ata Notarial": `
ATENÇÃO — ATO: ATA NOTARIAL
- Identificar o fato a ser constatado (acesso a site, conversa, estado de imóvel, etc.)
- Verificar se o fato é contemporâneo (ata constata o presente, não reconstitui o passado)
- Identificar o requerente
- Verificar se há necessidade de intimação de terceiros
- Verificar finalidade: judicial, administrativa, extrajudicial
- Na minuta: identificação do requerente, descrição objetiva do fato constatado, sem opinião jurídica`,

  "Dação em Pagamento": `
ATENÇÃO — ATO: DAÇÃO EM PAGAMENTO
- Identificar credor e devedor
- Identificar a dívida original (valor, origem, data)
<br>- Identificar o bem dado em pagamento (imóvel: matrícula completa)
- Verificar se o valor do bem é compatível com a dívida (saldo devedor)
- Verificar ITBI se imóvel urbano
- Verificar anuência conjugal do devedor se casado
- Verificar certidões do devedor
- Na minuta: identificação da dívida, bem dado, quitação expressa, valor atribuído ao bem, tributos`,
};

function instrucoesPorTipo(tipo) {
  if (!tipo) return "";
  const chave = Object.keys(INSTRUCOES_POR_TIPO).find(k =>
    tipo.toLowerCase().includes(k.toLowerCase())
  );
  return chave ? INSTRUCOES_POR_TIPO[chave] : "";
}

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
      max_tokens: 8000,
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

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).send("Método não permitido");

  let dados;
  try { dados = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ ok: false, erro: "JSON inválido" }); }

  const { nome, tipo, obs, documentos } = dados;

  const instrucoes = instrucoesPorTipo(tipo);
  const mensagem = `CASO: ${nome || "Não informado"}
TIPO DE ATO: ${tipo || "Não informado"}
${instrucoes ? instrucoes + "\n" : ""}
OBSERVAÇÕES DO CASO: ${obs || "Nenhuma"}

DOCUMENTOS E INFORMAÇÕES FORNECIDAS:
${documentos || "Nenhum documento fornecido ainda."}

Por favor, realize a análise completa conforme seu protocolo.`;

  try {
    const resposta = await callClaude(mensagem);
    return res.status(200).json({ ok: true, analise: resposta });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message });
  }
};
