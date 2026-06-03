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
- Identificar o bem dado em pagamento (imóvel: matrícula completa)
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
- Use **negrito** SOMENTE para: título da escritura, nomes das partes, CPF, RG, matrícula, número de guia de tributo
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

function callClaude(userMessage) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 5000,
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
  let minuta = texto;

  // Remove seção de análise documental do corpo e converte linhas em comentários
  const idxSecao = minuta.search(/\n(?:---\s*\n)?(?:#{0,3}\s*)?(?:ANÁLISE|ANALISE|APONTAMENTO|PENDÊNCIA DOCUMENTAL|PENDENCIAS DOCUMENTAIS)/i);
  if (idxSecao !== -1) {
    const secao = minuta.slice(idxSecao);
    minuta = minuta.slice(0, idxSecao);
    secao.split("\n").forEach(linha => {
      // Captura linhas de tabela: | 01 | Documento | Titular | Obs |
      const m = linha.match(/\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|/);
      if (m) {
        const doc = m[2].trim();
        const titular = m[3].trim();
        const obs = m[4].trim();
        let txt = `Pendência ${m[1]}: ${doc}`;
        if (titular && titular !== "—") txt += ` — ${titular}`;
        if (obs && obs !== "—") txt += ` (${obs})`;
        comentarios.push(txt);
      }
    });
  }

  // Extrai marcadores 【PENDÊNCIA】 do texto e converte em comentários
  const regex = /【PENDÊNCIA: ([^】]+)】/g;
  let match;
  let num = comentarios.length + 1;
  while ((match = regex.exec(minuta)) !== null) {
    comentarios.push(`Pendência ${num}: ${match[1].trim()}`);
    num++;
  }

  // Remove marcadores do texto, remove negrito indevido no parágrafo de emolumentos
  minuta = minuta
    .replace(/【PENDÊNCIA: [^】]+】/g, "")
    .replace(/(CNPJ[^)]+\))\*\*/g, "$1")  // garante sem negrito após CNPJ
    .replace(/\n{3,}/g, "\n\n")
    .trim();

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

  const { nome, tipo, obs, documentos, instrucao, modalidade } = dados;

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

  try {
    const resposta = await callClaude(mensagem);
    const { minuta, comentarios } = parsearResposta(resposta);
    return res.status(200).json({ ok: true, minuta, comentarios });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message });
  }
};
