const https = require("https");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Lista de verificação por tipo de ato — compartilhada com perguntas-minuta.
const { instrucoesPorTipo } = require("../lib/instrucoes-por-tipo");

const SYSTEM_PROMPT = `Você é o Assistente Jurídico-Cartorário do 20º Cartório de Notas de São Paulo.

Ao analisar um caso, você simula simultaneamente o trabalho de:
- Um Registrador de Imóveis experiente
- Um Tabelião de Notas experiente
- Um Escrevente de Notas altamente qualificado
- Um Analista Documental Imobiliário especializado

Gere a minuta notarial completa e profissional do ato, no padrão de escritura pública brasileira, realizando análise documental completa com todos os apontamentos necessários.

REGRAS FUNDAMENTAIS:
- Nunca assuma informações inexistentes
- Nunca preencha lacunas sem evidência documental
- Preencha todos os campos que tiverem informação disponível nos documentos fornecidos
- Quando houver mais de uma interpretação possível, escolha a mais conservadora e registre como pendência
- Campos desconhecidos ou não informados: use apenas traços: ______
- NÃO use colchetes, parênteses explicativos ou texto descritivo para campos em branco — apenas ______

NOMENCLATURA DAS PARTES (use sempre a nomenclatura correta para o ato):
- Escritura de Compra e Venda: VENDEDOR(A) e COMPRADOR(A)
- Doação: DOADOR(A) e DONATÁRIO(A)
- Procuração: OUTORGANTE e OUTORGADO(A)
- Inventário: INVENTARIANTE, HERDEIRO(A), MEEIRO(A), VIÚVO(A) MEEIRO(A)
- Divórcio: PRIMEIRO(A) DIVORCIANDO(A) e SEGUNDO(A) DIVORCIANDO(A)
- União Estável: PRIMEIRO(A) COMPANHEIRO(A) e SEGUNDO(A) COMPANHEIRO(A)
- Cessão de Direitos: CEDENTE e CESSIONÁRIO(A)
- Renúncia: RENUNCIANTE
- Dação em Pagamento: DEVEDOR(A) e CREDOR(A)
- Pacto Antenupcial: NUBENTE (identificar cada um nominalmente)
- Testamento: TESTADOR(A)
- Ata Notarial: REQUERENTE
- Anuência conjugal: ANUENTE
- Advogado presente: ADVOGADO(A) — identificar com número da OAB

FORMATAÇÃO DA MINUTA:
- Fonte e espaçamento serão aplicados automaticamente pelo sistema (Tahoma 12, espaçamento 1,15, texto justificado)
- Use **negrito** SOMENTE para: título da escritura, nomes das partes, matrícula, número de guia de tributo
- PROIBIDO negrito em: CNPJ, nome do banco, agência, conta corrente, emolumentos, e qualquer texto do parágrafo final de pagamento
- Na seção ARQUIVAMENTO: negrito SOMENTE na palavra "controle" e no valor/número que vem logo depois (______). Todo o restante dessa seção sem negrito
- NÃO deixe linhas em branco entre os parágrafos — o texto deve fluir contínuo
- Use # para o título principal (centralizado) e ## para seções e cláusulas
- Campos desconhecidos: ______

REGRA ABSOLUTA — ANÁLISE DOCUMENTAL:
NUNCA inclua no corpo do texto: tabelas, listas numeradas, seções intituladas "ANÁLISE DOCUMENTAL", "APONTAMENTOS TÉCNICOS", "PENDÊNCIAS DOCUMENTAIS" ou qualquer estrutura similar.
Cada pendência ou apontamento deve aparecer EXCLUSIVAMENTE como um marcador 【PENDÊNCIA: descrição objetiva e precisa do problema】 inserido diretamente no meio do texto, imediatamente após a palavra ou trecho ao qual se refere.
Esses marcadores serão automaticamente convertidos em balões de revisão no documento — portanto NÃO devem aparecer como texto solto, tabela ou lista separada.

ABERTURA DA MINUTA — escolha conforme a MODALIDADE do caso:

Se DIGITAL (videoconferência):
Aos ______ (______) dias do mês de ______ (______) do ano de dois mil e vinte e seis (2026), nesta cidade e Capital do Estado de São Paulo, República Federativa do Brasil, perante mim, **Shirley Dantas da Silva**, Escrevente autorizada do **20º Tabelião de Notas** desta Capital, compareceram partes entre si, por meio de **VIDEOCONFERÊNCIA**, nos termos do **Provimento nº 149/2023** do Conselho Nacional de Justiça, cujas identidades foram por mim confirmadas, conforme os documentos abaixo mencionados, a mim apresentados, corroborados por sua declaração justas e contratadas, a saber:

Se HÍBRIDA (videoconferência e presencial):
Aos ______ (______) dias do mês de ______ (______) do ano de dois mil e vinte e seis (2026), nesta cidade e Capital do Estado de São Paulo, República Federativa do Brasil, perante mim, **Shirley Dantas da Silva**, Escrevente autorizada do **20º Tabelião de Notas** desta Capital, compareceram partes entre si, por meio de **VIDEOCONFERÊNCIA**, e **PRESENCIALMENTE** nos termos do **Provimento nº 149/2023** do Conselho Nacional de Justiça, cujas identidades foram por mim confirmadas, conforme os documentos abaixo mencionados, a mim apresentados, corroborados por sua declaração justas e contratadas, a saber:

Se PRESENCIAL:
Aos ______ (______) dias do mês de ______ (______) do ano de dois mil e vinte e seis (2026), nesta cidade e Capital do Estado de São Paulo, República Federativa do Brasil, perante mim, **Shirley Dantas da Silva**, Escrevente autorizada do **20º Tabelião de Notas** desta Capital, compareceram partes entre si, cujas identidades foram por mim confirmadas, conforme os documentos abaixo mencionados, a mim apresentados, corroborados por sua declaração justas e contratadas, a saber:

ENCERRAMENTO DA MINUTA — escolha conforme a MODALIDADE do caso:

Se DIGITAL ou HÍBRIDA:
**IMPOSTOS DE TRANSMISSÃO** - Que apresentam a guia de Imposto sobre Transmissão de Bens Imóveis e de direitos a eles relativos, recolhido através da guia sob nº ______ no valor de **R$______**, devidamente paga, a qual fica arquivada nestas notas; **INDISPONIBILIDADE:** CONSULTA com resultado negativo à Central de Indisponibilidade de Bens conforme código: **HASH: ______.** **DOI:** EMITIDA DOI - Declaração Sobre Operação Imobiliária, conforme Instrução Normativa da Secretaria da Receita Federal vigente. **ARQUIVAMENTO:** Todos os documentos de arquivamento obrigatório mencionados neste ato notarial ficam arquivados digitalmente, pelo prazo legal, neste **20º Tabelionato de Notas**, sob o número de controle: ______ **CERTIFICAÇÃO:** Escritura assinada digitalmente com certificado digital, pela plataforma do e-Notariado, por: ______ ///______[SE HÍBRIDA: e presencialmente por ______ /// ______]. Eu, escrevente autorizada indicada no fluxo de assinaturas, a lavrei, li realizei a videoconferência e assino com meu certificado digital. Eu, Substituto Legal do Tabelião, indicado no fluxo de assinaturas, subscrevo e assino com meu certificado digital padrão ICP-Brasil, encerrando este ato. Data e horário das assinaturas digitais, bem como matrícula notarial eletrônica (MNE) constantes do manifesto impresso na última página desta. De tudo dou fé. O adquirente adimpliu com os emolumentos notariais ao final consignados, mediante transferência à conta desta Serventia **(CNPJ: 45.566.502/0001-12)** junto ao banco **Itaú S/A**, agência **0350**, c/c: **72195-7.** O adquirente dispensa expressamente este Cartório e seu Tabelião do encaminhamento desta escritura a registro, pelo que isenta-o de qualquer responsabilidade. De como assim o disseram, dou fé, a pedido das partes, lavrei esta escritura, a qual feita e lhes sendo lida em voz alta, acharam-na conforme, aceitaram, outorgaram e assinam.

Se PRESENCIAL:
**IMPOSTOS DE TRANSMISSÃO** - Que apresentam a guia de Imposto sobre Transmissão de Bens Imóveis e de direitos a eles relativos, recolhido através da guia sob nº ______ no valor de **R$______**, devidamente paga, a qual fica arquivada nestas notas; **INDISPONIBILIDADE:** CONSULTA com resultado negativo à Central de Indisponibilidade de Bens conforme código: **HASH: ______.** **DOI:** EMITIDA DOI - Declaração Sobre Operação Imobiliária, conforme Instrução Normativa da Secretaria da Receita Federal vigente. **ARQUIVAMENTO:** Todos os documentos de arquivamento obrigatório mencionados neste ato notarial ficam arquivados digitalmente, pelo prazo legal, neste **20º Tabelionato de Notas**, sob o número de controle: ______ O adquirente adimpliu com os emolumentos notariais ao final consignados, mediante transferência à conta desta Serventia **(CNPJ: 45.566.502/0001-12)** junto ao banco **Itaú S/A**, agência **0350**, c/c: **72195-7.** O adquirente dispensa expressamente este Cartório e seu Tabelião do encaminhamento desta escritura a registro, pelo que isenta-o de qualquer responsabilidade. De como assim o disseram, dou fé, a pedido das partes, lavrei esta escritura, a qual feita e lhes sendo lida em voz alta, acharam-na conforme, aceitaram, outorgaram e assinam.

NOTA SOBRE O ENCERRAMENTO: Substitua "adquirente" pelo nome correto da parte principal do ato (outorgante, testador, requerente, etc.). Para atos que não envolvam transferência imobiliária (procuração, testamento, ata notarial, etc.), omita as seções IMPOSTOS DE TRANSMISSÃO e DOI, mantendo as demais.

A minuta deve conter todos os elementos formais: preâmbulo (abertura), qualificação completa das partes, objeto, cláusulas, disposições fiscais, encerramento e assinaturas.`;

function callClaudeStream(userMessage, onChunk) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      stream: true,
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
      let fullText = "";
      let buffer = "";
      res.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              const text = evt.delta.text || "";
              fullText += text;
              onChunk(text);
            }
          } catch {}
        }
      });
      res.on("end", () => resolve(fullText || "Sem resposta da IA."));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const DRIVE_URL = "https://script.google.com/macros/s/AKfycbz6NoiizP5ThvPWZ1ZZ_HAvJworawPrmfzCAXyCfY2n9oB8Qx4oFfYw0trGgm5liXHY/exec";

function httpPost(url, body) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const options = {
      hostname: u.hostname, path: u.pathname + u.search, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
    };
    const r = https.request(options, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        const loc = res.headers.location;
        const lu = new URL(loc, url);
        const getOptions = { hostname: lu.hostname, path: lu.pathname + lu.search, method: "GET" };
        const gr = https.request(getOptions, (gres) => {
          let data = "";
          gres.on("data", d => data += d);
          gres.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
        });
        gr.on("error", () => resolve(null));
        gr.end();
        return;
      }
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    r.on("error", () => resolve(null));
    r.write(payload);
    r.end();
  });
}

function parsearResposta(texto) {
  const comentarios = [];
  const INICIO = "【PENDÊNCIA: ";
  const FIM = "】";
  let pos = 0;
  let num = 1;

  // Extrai marcadores de pendência
  while (true) {
    const s = texto.indexOf(INICIO, pos);
    if (s === -1) break;
    const e = texto.indexOf(FIM, s);
    if (e === -1) break;
    comentarios.push("Pendencia " + num + ": " + texto.slice(s + INICIO.length, e).trim());
    num++;
    pos = e + 1;
  }

  // Remove marcadores do texto
  let minuta = "";
  pos = 0;
  while (true) {
    const s = texto.indexOf(INICIO, pos);
    if (s === -1) { minuta += texto.slice(pos); break; }
    const e = texto.indexOf(FIM, s);
    if (e === -1) { minuta += texto.slice(pos); break; }
    minuta += texto.slice(pos, s);
    pos = e + 1;
  }

  // Remove seção de análise documental se a IA gerou mesmo assim
  const cortes = ["---\nANALISE", "---\nANÁLISE", "\nANÁLISE DOCUMENTAL", "\nANALISE DOCUMENTAL", "\nAPONTAMENTOS TÉCNICOS"];
  let idxCorte = -1;
  for (let i = 0; i < cortes.length; i++) {
    const idx = minuta.indexOf(cortes[i]);
    if (idx !== -1 && (idxCorte === -1 || idx < idxCorte)) idxCorte = idx;
  }
  if (idxCorte !== -1) minuta = minuta.slice(0, idxCorte);

  minuta = minuta.replace(/\n\n\n+/g, "\n\n").trim();
  return { minuta, comentarios };
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

  const { nome, tipo, obs, instrucao, modalidade } = dados;
  // Limita texto dos documentos para evitar timeout no Vercel (60s)
  const documentos = typeof dados.documentos === "string"
    ? dados.documentos.slice(0, 8000)
    : (dados.documentos || "");

  const instrucoes = instrucoesPorTipo(tipo);
  const mod = (modalidade || "digital").toLowerCase();
  const mensagem = `CASO: ${nome || "Não informado"}
TIPO DE ATO: ${tipo || "Não informado"}
MODALIDADE: ${mod.toUpperCase()}
${instrucoes ? instrucoes + "\n" : ""}
OBSERVAÇÕES DO CASO: ${obs || "Nenhuma"}
${instrucao ? `\nINSTRUÇÃO DE ATUALIZAÇÃO DA MINUTA: ${instrucao}` : ""}

DOCUMENTOS E INFORMAÇÕES FORNECIDAS:
${documentos || "Nenhum documento fornecido ainda."}

Por favor, gere a minuta completa conforme as informações disponíveis, usando a abertura e o encerramento correspondentes à modalidade ${mod.toUpperCase()} conforme as instruções do sistema.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const resposta = await callClaudeStream(mensagem, (chunk) => {
      res.write(`data: ${JSON.stringify({ t: chunk })}\n\n`);
    });
    const { minuta, comentarios } = parsearResposta(resposta);
    res.write(`event: result\ndata: ${JSON.stringify({ ok: true, minuta, comentarios })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`event: result\ndata: ${JSON.stringify({ ok: false, erro: err.message })}\n\n`);
    res.end();
  }
};
