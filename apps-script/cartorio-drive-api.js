// ══ CARTÓRIO DRIVE API — Apps Script ══
// Cole este código no projeto cartorio-drive-api em script.google.com
// Depois clique em Implantar > Gerenciar implantações > atualizar versão
//
// CONFIGURAÇÃO OBRIGATÓRIA:
// No Apps Script: Arquivo > Propriedades do projeto > Propriedades do script
// Adicionar: ANTHROPIC_API_KEY = sk-ant-...
//
// FIREBASE: Certifique-se que as regras do Realtime Database permitem escrita em /jobs/
// { "rules": { "jobs": { ".read": true, ".write": true } } }

const PASTA_RAIZ_ID = "1KDMZ-FJMoXEzpMXKSojeZgNeJ_p4lhSb";
const NOME_PASTA_MINUTAS = "0 - MINUTAS IA";
const FIREBASE_URL = "https://painel-cartorio-default-rtdb.firebaseio.com";

// ── Prompts ────────────────────────────────────────────────────────────────

const INSTRUCOES_POR_TIPO = {
  "Inventário": `ATENÇÃO — ATO: INVENTÁRIO / SOBREPARTILHA
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

  "Escritura de Compra e Venda": `ATENÇÃO — ATO: ESCRITURA DE COMPRA E VENDA
- Verificar matrícula atualizada (últimos 30 dias)
- Verificar cadeia dominial e continuidade registral
- Verificar certidões negativas do vendedor (Receita Federal, TRT, TJ, distribuidores cíveis e criminais, protestos)
- Verificar ITBI: guia paga ou a calcular, base de cálculo, valor venal × valor negociado
- Verificar laudêmio (se enfiteuse/terreno de marinha)
- Verificar forma de pagamento e quitação
- Verificar anuência conjugal se casado
- Verificar se há financiamento ou alienação fiduciária a cancelar
- Na minuta: preço, forma de pagamento, data de quitação, entrega de chaves, responsabilidade por débitos anteriores`,

  "Procuração": `ATENÇÃO — ATO: PROCURAÇÃO
- Identificar outorgante(s) e outorgado(s) com qualificação completa
- Definir poderes específicos (evitar cláusula "poderes gerais" sem especificação)
- Verificar se há substabelecimento e em que condições
- Verificar prazo de validade (se houver)
- Verificar finalidade: venda, representação, administração, judicial, etc.
- Se imóvel específico: identificar pela matrícula
- Verificar se outorgante é casado: anuência conjugal para atos de alienação
- Na minuta: declarar expressamente os poderes, o(s) bem(ns) se aplicável, prazo e cláusula de substabelecimento`,

  "Divórcio": `ATENÇÃO — ATO: DIVÓRCIO CONSENSUAL EXTRAJUDICIAL
- Verificar certidão de casamento atualizada
- Verificar se há filhos menores ou incapazes (se houver, não pode ser extrajudicial — obrigatório judicial)
- Verificar partilha de bens: listar todos os bens comuns
- Verificar se há imóveis: matrícula, ITBI ou ITCMD conforme o caso
- Verificar guarda, alimentos e visitas (somente se filhos maiores e capazes)
- Verificar nome após o divórcio
- Verificar se há dívidas comuns a partilhar
- Na minuta: qualificação, dissolução do vínculo, partilha detalhada, alimentos (se aplicável), retorno ou manutenção de nome`,

  "União Estável": `ATENÇÃO — ATO: UNIÃO ESTÁVEL
- Verificar documentos de ambos os companheiros (RG, CPF, certidão de nascimento ou casamento anterior)
- Verificar se há impedimentos matrimoniais
- Definir regime de bens (padrão: comunhão parcial)
- Verificar se é retroativa e desde quando
- Verificar se há bens a declarar na escritura
- Verificar cláusulas especiais (alimentos, herança, incomunicabilidade de bens específicos)
- Na minuta: qualificação completa, data de início, regime de bens, cláusulas específicas acordadas`,

  "Doação": `ATENÇÃO — ATO: DOAÇÃO
- Identificar doador e donatário com qualificação completa
- Identificar o bem doado (imóvel: matrícula; outros: descrição detalhada)
- Verificar aceitação expressa do donatário
- Verificar ITCMD: base de cálculo, alíquota SP (4%), isenções (ex: doação até R$ 2.500 — verificar tabela vigente)
- Verificar cláusulas restritivas: inalienabilidade, impenhorabilidade, incomunicabilidade, reversão
- Verificar se doador é casado: regime de bens e anuência conjugal
- Verificar se é doação com ou sem reserva de usufruto
- Na minuta: identificação do bem, aceitação, encargos (se houver), cláusulas restritivas, ITCMD recolhido`,

  "Renúncia": `ATENÇÃO — ATO: RENÚNCIA
- Identificar claramente o bem ou direito objeto da renúncia
- Verificar a que título o renunciante é titular (herdeiro, condômino, etc.)
- Verificar matrícula se imóvel
- Verificar se a renúncia é translativa (em favor de alguém) ou abdicativa (pura)
- Renúncia translativa pode gerar ITCMD ou ITBI — verificar incidência
- Verificar se renunciante é casado: anuência conjugal
- Verificar impacto registral: o que será averbado ou registrado no CRI
- Na minuta: qualificação, identificação do bem, natureza da renúncia, destinatário (se translativa), encargos fiscais`,

  "Cessão de Direitos": `ATENÇÃO — ATO: CESSÃO DE DIREITOS
- Identificar cedente e cessionário
- Identificar os direitos cedidos (hereditários, possessórios, contratuais, etc.)
- Verificar se há imóvel envolvido: matrícula
- Verificar valor da cessão e forma de pagamento
- Verificar ITBI (cessão onerosa) ou ITCMD (cessão gratuita)
- Verificar anuência conjugal se cedente for casado
- Na minuta: descrição precisa dos direitos cedidos, valor, forma de pagamento, tributos`,

  "Pacto Antenupcial": `ATENÇÃO — ATO: PACTO ANTENUPCIAL
- Verificar identidade e qualificação dos nubentes
- Confirmar regime de bens escolhido (comunhão universal, separação total, participação final nos aquestos)
- Verificar se há regime misto ou cláusulas especiais
- Verificar se há bens pré-nupciais a declarar/excluir
- Verificar data prevista do casamento e onde será realizado
- O pacto deve ser registrado no CRI do domicílio dos nubentes e averbado na certidão de casamento
- Na minuta: qualificação, regime escolhido, cláusulas especiais, bens excluídos (se aplicável)`,

  "Testamento": `ATENÇÃO — ATO: TESTAMENTO PÚBLICO
- Verificar se testador está em plena capacidade civil
- Identificar herdeiros necessários (cônjuge, descendentes, ascendentes) e a legítima (50%)
- Verificar se disposições respeitam a quota disponível (até 50%)
- Verificar legatários e legados específicos
- Verificar cláusulas de substituição, condição ou encargo
- Verificar nomeação de testamenteiro
- Verificar deserdação ou reconhecimento de filho (se aplicável)
- Na minuta: disposições claras, respeito à legítima, identificação precisa dos bens e beneficiários`,

  "Ata Notarial": `ATENÇÃO — ATO: ATA NOTARIAL
- Identificar o fato a ser constatado (acesso a site, conversa, estado de imóvel, etc.)
- Verificar se o fato é contemporâneo (ata constata o presente, não reconstitui o passado)
- Identificar o requerente
- Verificar se há necessidade de intimação de terceiros
- Verificar finalidade: judicial, administrativa, extrajudicial
- Na minuta: identificação do requerente, descrição objetiva do fato constatado, sem opinião jurídica`,

  "Dação em Pagamento": `ATENÇÃO — ATO: DAÇÃO EM PAGAMENTO
- Identificar credor e devedor
- Identificar a dívida original (valor, origem, data)
- Identificar o bem dado em pagamento (imóvel: matrícula completa)
- Verificar se o valor do bem é compatível com a dívida (saldo devedor)
- Verificar ITBI se imóvel urbano
- Verificar anuência conjugal do devedor se casado
- Verificar certidões do devedor
- Na minuta: identificação da dívida, bem dado, quitação expressa, valor atribuído ao bem, tributos`
};

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

REGRA ABSOLUTA — MODELO DE MINUTA (REFERÊNCIA):
Se algum documento fornecido tiver cabeçalho começando com "MODELO DE MINUTA (REFERÊNCIA", ele é apenas um EXEMPLO de estilo, estrutura, formatação e fraseado — vindo de outro caso, fornecido pela equipe ou aprendido de casos anteriores do mesmo tipo de ato.
- Use esse modelo SOMENTE para orientar como organizar e redigir a minuta (ordem das cláusulas, tom, estrutura das frases)
- NUNCA copie nomes, CPF, RG, matrícula, endereços, valores, datas ou qualquer dado específico do modelo
- Todos os dados factuais da minuta devem vir EXCLUSIVAMENTE dos demais documentos e observações do caso atual
- Se o modelo mencionar uma cláusula que não se aplica ao caso atual, não a inclua
- IMPORTANTE — NÃO CONFUNDA as duas fontes: essa restrição vale APENAS para dados que aparecem dentro do bloco "MODELO DE MINUTA (REFERÊNCIA...)". Qualquer dado (nome, CPF, RG, endereço, valor, data) que apareça nos OUTROS documentos do caso (fora do bloco do modelo) é dado real do caso atual e deve ser usado normalmente, com total confiança — mesmo que esse mesmo tipo de campo também apareça preenchido no modelo. NÃO deixe um campo em branco (______) só porque um campo parecido existe no modelo; deixe em branco SOMENTE quando o dado não aparecer em nenhum lugar fora do bloco do modelo
- MANTENHA O MESMO NÍVEL DE DETALHE E ABRANGÊNCIA do modelo — se o modelo tiver uma lista extensa e detalhada de poderes/cláusulas (ex: nomes de bancos específicos, órgãos públicos nomeados, poderes judiciais completos), a minuta nova deve ter uma lista igualmente extensa e detalhada, adaptada ao caso atual. NÃO resuma ou condense cláusulas do modelo em itens genéricos — reproduza a mesma quantidade e riqueza de detalhes, apenas trocando os dados específicos pelos do caso atual (ou removendo o item, se genuinamente não se aplicar)
- REGRA DE CONCLUSÃO — NÃO PARE CEDO: antes de considerar a minuta finalizada, verifique mentalmente se você já escreveu uma cláusula ou seção correspondente a CADA cláusula/seção que existe no modelo (mesma numeração, mesmos títulos de cláusula, mesmo número aproximado de itens). Se o modelo tem cláusulas 1 a 13, ou subcláusulas 6.1 a 6.10, sua minuta também precisa chegar até lá — NÃO termine no meio (ex: só até a cláusula 6.5) só porque o texto já "parece" completo. Um documento de referência longo e detalhado exige uma minuta igualmente longa e detalhada. Só finalize (com encerramento e assinaturas) depois de cobrir TODO o conteúdo equivalente ao modelo.

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

NOTA SOBRE O ENCERRAMENTO: Substitua "adquirente" pelo nome correto da parte principal do ato (outorgante, testador, requerente, etc.). Para atos que não envolvam transferência imobiliária (procuração, testamento, ata notarial, etc.), omita APENAS as seções IMPOSTOS DE TRANSMISSÃO e DOI. As demais seções — **INDISPONIBILIDADE**, **ARQUIVAMENTO**, **CERTIFICAÇÃO** e o parágrafo final de emolumentos — são OBRIGATÓRIAS em TODO ato, sem exceção, independentemente do tipo. NUNCA omita a frase de INDISPONIBILIDADE (consulta à Central de Indisponibilidade de Bens).

A minuta deve conter todos os elementos formais: preâmbulo (abertura), qualificação completa das partes, objeto, cláusulas, disposições fiscais, encerramento e assinaturas.`;

// ── Funções auxiliares ─────────────────────────────────────────────────────

function getPastaMinutasIA() {
  const busca = DriveApp.getFoldersByName(NOME_PASTA_MINUTAS);
  return busca.hasNext() ? busca.next() : DriveApp.createFolder(NOME_PASTA_MINUTAS);
}

function instrucoesPorTipo(tipo) {
  if (!tipo) return "";
  const chaves = Object.keys(INSTRUCOES_POR_TIPO);
  const chave = chaves.find(function(k) {
    return tipo.toLowerCase().indexOf(k.toLowerCase()) !== -1;
  });
  return chave ? INSTRUCOES_POR_TIPO[chave] : "";
}

// ── Biblioteca de modelos aprendidos por tipo de ato ────────────────────────
// A cada minuta gerada com sucesso, guardamos o texto como modelo daquele
// tipo de ato. Assim, com o tempo, a IA passa a ter uma referência de estilo
// automática mesmo quando a equipe não envia uma minuta "MODELO" pelo WhatsApp.

function chaveTipo(tipo) {
  if (!tipo) return "geral";
  const chaves = Object.keys(INSTRUCOES_POR_TIPO);
  const chave = chaves.find(function(k) {
    return tipo.toLowerCase().indexOf(k.toLowerCase()) !== -1;
  });
  const base = (chave || tipo).toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "geral";
}

function buscarModeloAprendido(tipo) {
  try {
    const chave = chaveTipo(tipo);
    const response = UrlFetchApp.fetch(FIREBASE_URL + "/modelos/" + chave + ".json", { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());
    if (data && data.texto) return data;
    return null;
  } catch (e) {
    return null;
  }
}

function salvarModeloAprendido(tipo, texto, nomeCaso) {
  try {
    const chave = chaveTipo(tipo);
    UrlFetchApp.fetch(FIREBASE_URL + "/modelos/" + chave + ".json", {
      method: "put",
      contentType: "application/json",
      payload: JSON.stringify({
        texto: texto.slice(0, 6000),
        origemCaso: nomeCaso || "",
        atualizado: new Date().toISOString()
      }),
      muteHttpExceptions: true
    });
  } catch (e) {}
}

function parsearResposta(texto) {
  var comentarios = [];
  var INICIO = "【PENDÊNCIA: ";
  var FIM = "】";
  var pos = 0;
  var num = 1;

  while (true) {
    var s = texto.indexOf(INICIO, pos);
    if (s === -1) break;
    var e = texto.indexOf(FIM, s);
    if (e === -1) break;
    comentarios.push("Pendencia " + num + ": " + texto.slice(s + INICIO.length, e).trim());
    num++;
    pos = e + 1;
  }

  var minuta = "";
  pos = 0;
  while (true) {
    var s2 = texto.indexOf(INICIO, pos);
    if (s2 === -1) { minuta += texto.slice(pos); break; }
    var e2 = texto.indexOf(FIM, s2);
    if (e2 === -1) { minuta += texto.slice(pos); break; }
    minuta += texto.slice(pos, s2);
    pos = e2 + 1;
  }

  // Corta apenas se uma LINHA INTEIRA for um título de seção proibido (ex: "## ANÁLISE
  // DOCUMENTAL"), nunca quando a palavra aparece dentro de uma frase normal (ex: cláusulas
  // bancárias que mencionam "análise de crédito" não devem disparar o corte).
  var proibidos = ["analise documental", "apontamentos tecnicos", "pendencias documentais"];
  var linhas = minuta.split("\n");
  var idxCorte = -1;
  var posAtual = 0;
  for (var li = 0; li < linhas.length; li++) {
    var linhaLimpa = linhas[li]
      .replace(/^#{1,6}\s*/, "")
      .replace(/\*\*/g, "")
      .replace(/[:\-—]+$/, "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (proibidos.indexOf(linhaLimpa) !== -1) { idxCorte = posAtual; break; }
    posAtual += linhas[li].length + 1;
  }
  if (idxCorte !== -1) minuta = minuta.slice(0, idxCorte);

  minuta = minuta.replace(/\n\n\n+/g, "\n\n").trim();
  return { minuta: minuta, comentarios: comentarios };
}

function chamarClaudeRaw(mensagem) {
  var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada. Vá em Projeto > Propriedades do script e adicione a chave.");

  var payload = {
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: mensagem }]
  };

  var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var data = JSON.parse(response.getContentText());
  if (data.error) throw new Error("Erro Claude API: " + (data.error.message || JSON.stringify(data.error)));
  return { texto: data.content[0].text, pararPorTamanho: data.stop_reason === "max_tokens" };
}

function chamarClaude(mensagem) {
  return chamarClaudeRaw(mensagem).texto;
}

// Gera a minuta em pedaços, continuando automaticamente de onde parou até terminar
// de verdade (ou até um limite de segurança). Isso permite minutas bem mais longas
// (50+ páginas) sem depender de acertar de antemão um tamanho máximo de resposta —
// cada pedaço é rápido (uma chamada à IA), e só continua se realmente precisar.
function gerarMinutaCompleta(mensagemBase) {
  var MAX_PEDACOS = 6;
  // Quando há um modelo de referência, a IA tende a "achar" que terminou cedo demais
  // (parar em ~1/3 do conteúdo do modelo). Por isso, sempre que houver modelo, forçamos
  // pelo menos uma rodada extra de autoverificação de cobertura, mesmo que a IA não tenha
  // batido no limite de tamanho — ela precisa confirmar explicitamente que terminou.
  var temModelo = mensagemBase.indexOf("MODELO DE MINUTA (REFERÊNCIA") !== -1;
  var textoCompleto = "";
  var rodadas = 0;
  for (var i = 0; i < MAX_PEDACOS; i++) {
    var mensagem = mensagemBase;
    if (i > 0) {
      var trechoFinal = textoCompleto.slice(-1500);
      mensagem = mensagemBase +
        "\n\n---\nATENÇÃO: você já escreveu o trecho abaixo desta MESMA minuta (isto é uma continuação, não um novo pedido). " +
        "NÃO repita esse trecho — continue EXATAMENTE de onde ele parou, mantendo a mesma formatação, numeração de cláusulas e estilo. " +
        "Antes de considerar concluído, confira se já cobriu TODAS as cláusulas/seções equivalentes às do modelo de referência (mesma numeração e escopo). " +
        "Se esse trecho já contiver o encerramento completo da minuta (assinaturas) E cobrir todo o conteúdo equivalente ao modelo, responda EXATAMENTE com a palavra CONCLUIDO, sem mais nada. " +
        "Caso contrário, continue escrevendo o restante.\n\n" +
        "TRECHO JÁ ESCRITO (final dele):\n..." + trechoFinal + "\n\nCONTINUE A PARTIR DAQUI (ou responda CONCLUIDO se já estiver completo):";
    }
    var res = chamarClaudeRaw(mensagem);
    rodadas++;
    var textoNovo = res.texto;
    var respostaLimpa = textoNovo.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (respostaLimpa === "CONCLUIDO") break;

    textoCompleto += textoNovo;

    var precisaContinuar = res.pararPorTamanho; // bateu no limite de tamanho, com certeza precisa continuar
    if (!precisaContinuar && temModelo && i === 0) {
      precisaContinuar = true; // primeira rodada com modelo: sempre confirma cobertura antes de aceitar
    }
    if (!precisaContinuar) break;
  }
  return { texto: textoCompleto, rodadas: rodadas, temModelo: temModelo };
}

function salvarJobFirebase(jobId, resultado) {
  UrlFetchApp.fetch(
    FIREBASE_URL + "/jobs/" + jobId + ".json",
    {
      method: "put",
      contentType: "application/json",
      payload: JSON.stringify(resultado),
      muteHttpExceptions: true
    }
  );
}

// ── Ações do doPost ────────────────────────────────────────────────────────

function doPost(e) {
  try {
    var dados = JSON.parse(e.postData.contents);
    var acao = dados.acao || "criar-pasta";
    if (acao === "criar-pasta") return criarPasta(dados);
    if (acao === "salvar-arquivo") return salvarArquivo(dados);
    if (acao === "criar-minuta-doc") return criarMinutaDoc(dados);
    if (acao === "gerar-e-criar-minuta") return gerarECriarMinuta(dados);
    if (acao === "criar-evento-agenda") return criarEventoAgenda(dados);
    return resp({ ok: false, erro: "Ação desconhecida" });
  } catch(err) {
    return resp({ ok: false, erro: err.message });
  }
}

function gerarECriarMinuta(dados) {
  var jobId = dados.jobId;

  try {
    var instrucoes = instrucoesPorTipo(dados.tipo);
    var mod = (dados.modalidade || "digital").toLowerCase();
    var documentosTexto = dados.documentos || "Nenhum documento fornecido ainda.";
    // Limite de segurança generoso: a causa real da demora era o envio cortado
    // pela metade (já corrigido no iniciar-minuta.js), não o tamanho do texto —
    // a IA lê o texto de entrada rápido; quem demora é a geração da resposta,
    // que já tem limite (max_tokens). Este limite aqui só evita casos extremos.
    if (documentosTexto.length > 100000) {
      documentosTexto = documentosTexto.slice(0, 100000) + "\n\n[...texto truncado por limite de tamanho...]";
    }

    // Se a equipe não enviou um modelo explícito ("MODELO" no WhatsApp), busca
    // automaticamente o último modelo aprendido para esse tipo de ato.
    if (documentosTexto.indexOf("MODELO DE MINUTA (REFERÊNCIA") === -1) {
      var modeloAprendido = buscarModeloAprendido(dados.tipo);
      if (modeloAprendido) {
        documentosTexto += "\n\n=== MODELO DE MINUTA (REFERÊNCIA APRENDIDA AUTOMATICAMENTE) — " + (dados.tipo || "") + " ===\n" + modeloAprendido.texto;
      }
    }

    var mensagem = "CASO: " + (dados.nome || "Não informado") + "\n" +
      "TIPO DE ATO: " + (dados.tipo || "Não informado") + "\n" +
      "MODALIDADE: " + mod.toUpperCase() + "\n" +
      (instrucoes ? instrucoes + "\n" : "") +
      "OBSERVAÇÕES DO CASO: " + (dados.obs || "Nenhuma") + "\n" +
      (dados.instrucao ? "\nINSTRUÇÃO DE ATUALIZAÇÃO DA MINUTA: " + dados.instrucao + "\n" : "") +
      "\nDOCUMENTOS E INFORMAÇÕES FORNECIDAS:\n" +
      documentosTexto +
      "\n\nPor favor, gere a minuta completa conforme as informações disponíveis, usando a abertura e o encerramento correspondentes à modalidade " + mod.toUpperCase() + " conforme as instruções do sistema.";

    var geracao = gerarMinutaCompleta(mensagem);
    var parsed = parsearResposta(geracao.texto);

    var docResult = _criarMinutaDocInterno({
      nome: dados.nome,
      tipo: dados.tipo,
      minuta: parsed.minuta,
      comentarios: parsed.comentarios
    });

    // Aprende com essa minuta: vira a referência automática do tipo para os próximos casos
    salvarModeloAprendido(dados.tipo, parsed.minuta, dados.nome);

    if (jobId) {
      salvarJobFirebase(jobId, {
        status: "done",
        ok: true,
        docUrl: docResult.url,
        folderUrl: docResult.folderUrl,
        docNome: docResult.nome,
        diagRodadas: geracao.rodadas,
        diagTemModelo: geracao.temModelo
      });
    }

    return resp({ ok: true, url: docResult.url, folderUrl: docResult.folderUrl, nome: docResult.nome });

  } catch(err) {
    if (jobId) {
      salvarJobFirebase(jobId, { status: "done", ok: false, erro: err.message });
    }
    return resp({ ok: false, erro: err.message });
  }
}

// ── Criar evento na Agenda do Google ──────────────────────────────────────
// Cria o evento direto na Agenda associada a esta conta (a mesma do Drive),
// em vez de só abrir um link para a equipe salvar manualmente.

function criarEventoAgenda(dados) {
  if (!dados.dataHora) return resp({ ok: false, erro: "Data e hora não informadas." });
  var inicio = new Date(dados.dataHora);
  if (isNaN(inicio.getTime())) return resp({ ok: false, erro: "Data e hora inválidas." });

  var duracaoMin = dados.duracaoMin || 60;
  var fim = new Date(inicio.getTime() + duracaoMin * 60000);
  var titulo = (dados.descricao || dados.tipo || "Compromisso") + " — " + (dados.nome || "");
  var descricao = "Cartório: " + (dados.tipo || "") + "\n" + (dados.obs || "");

  var evento = CalendarApp.getDefaultCalendar().createEvent(titulo, inicio, fim, { description: descricao });
  return resp({ ok: true, eventId: evento.getId() });
}

// ── Criar pasta ────────────────────────────────────────────────────────────

function criarPasta(dados) {
  var nomeCliente = (dados.nome || "Sem nome").toUpperCase();
  var tipoCaso = dados.tipo || "A classificar";
  var pastaMinutas = getPastaMinutasIA();

  var buscaCliente = pastaMinutas.getFoldersByName(nomeCliente);
  var pastaCliente = buscaCliente.hasNext() ? buscaCliente.next() : pastaMinutas.createFolder(nomeCliente);

  var buscaCaso = pastaCliente.getFoldersByName(tipoCaso);
  var pastaCaso = buscaCaso.hasNext() ? buscaCaso.next() : pastaCliente.createFolder(tipoCaso);

  return resp({ ok: true, url: pastaCaso.getUrl() });
}

// ── Salvar arquivo ─────────────────────────────────────────────────────────

function salvarArquivo(dados) {
  var nomeCliente = (dados.nome || "Sem nome").toUpperCase();
  var nomeArquivo = dados.nomeArquivo || "documento";
  var base64 = dados.base64 || "";
  var mimetype = dados.mimetype || "application/octet-stream";

  var pastaRaiz = DriveApp.getFolderById(PASTA_RAIZ_ID);
  var busca = pastaRaiz.getFoldersByName(nomeCliente);
  var pastaCliente = busca.hasNext() ? busca.next() : pastaRaiz.createFolder(nomeCliente);

  var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimetype, nomeArquivo);
  var arquivo = pastaCliente.createFile(blob);

  return resp({ ok: true, url: arquivo.getUrl(), nome: nomeArquivo });
}

// ── Criar minuta doc (via Vercel proxy — retorna resp()) ───────────────────

function criarMinutaDoc(dados) {
  var result = _criarMinutaDocInterno(dados);
  return resp({ ok: true, url: result.url, folderUrl: result.folderUrl, nome: result.nome });
}

function _criarMinutaDocInterno(dados) {
  var nomeCliente = (dados.nome || "Caso").toUpperCase();
  var pastaMinutas = getPastaMinutasIA();

  var buscaCliente = pastaMinutas.getFoldersByName(nomeCliente);
  var pastaCliente = buscaCliente.hasNext() ? buscaCliente.next() : pastaMinutas.createFolder(nomeCliente);

  var dataHoje = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
  var nomeDoc = "MINUTA — " + dados.nome + " — " + dataHoje;

  var doc = DocumentApp.create(nomeDoc);
  var docId = doc.getId();
  DriveApp.getFileById(docId).moveTo(pastaCliente);

  var body = doc.getBody();
  body.clear();

  if (dados.minuta) {
    var linhas = dados.minuta.split("\n");
    linhas.forEach(function(linha) {
      if (!linha.trim()) return;
      var textoMd = linha;
      var tipoHeading = 0;
      if (linha.indexOf("# ") === 0) { tipoHeading = 1; textoMd = linha.substring(2).trim(); }
      else if (linha.indexOf("## ") === 0) { tipoHeading = 2; textoMd = linha.substring(3).trim(); }
      else if (linha.indexOf("### ") === 0) { tipoHeading = 3; textoMd = linha.substring(4).trim(); }
      inserirParagrafoFormatado(body, textoMd, tipoHeading);
    });
  }

  doc.saveAndClose();

  var token = ScriptApp.getOAuthToken();
  var comentarios = dados.comentarios || [];
  comentarios.forEach(function(comentario) {
    try {
      UrlFetchApp.fetch(
        "https://www.googleapis.com/drive/v3/files/" + docId + "/comments?fields=id",
        {
          method: "post",
          headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
          payload: JSON.stringify({ content: comentario }),
          muteHttpExceptions: true
        }
      );
    } catch(e) {}
  });

  return {
    url: "https://docs.google.com/document/d/" + docId + "/edit",
    folderUrl: pastaCliente.getUrl(),
    nome: nomeDoc
  };
}

// ── Formatação do documento ────────────────────────────────────────────────

function inserirParagrafoFormatado(body, textoMd, tipoHeading) {
  var segmentos = [];
  var regex = /\*\*([^*]+)\*\*/g;
  var lastIndex = 0;
  var match;
  while ((match = regex.exec(textoMd)) !== null) {
    if (match.index > lastIndex) segmentos.push({ t: textoMd.slice(lastIndex, match.index), b: false });
    segmentos.push({ t: match[1], b: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < textoMd.length) segmentos.push({ t: textoMd.slice(lastIndex), b: false });
  if (segmentos.length === 0) segmentos.push({ t: textoMd, b: false });

  var textoLimpo = segmentos.map(function(s) { return s.t; }).join("");
  var para = body.appendParagraph(textoLimpo);
  para.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  para.setLineSpacing(1.15);
  para.setSpacingBefore(0);
  para.setSpacingAfter(0);
  if (tipoHeading === 1) {
    para.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  } else {
    para.setAlignment(DocumentApp.HorizontalAlignment.JUSTIFY);
  }

  var textEl = para.editAsText();
  if (textoLimpo.length > 0) {
    textEl.setFontFamily(0, textoLimpo.length - 1, "Tahoma");
    textEl.setFontSize(0, textoLimpo.length - 1, 12);
    textEl.setBold(0, textoLimpo.length - 1, false);
  }

  if (tipoHeading > 0 && textoLimpo.length > 0) {
    textEl.setBold(0, textoLimpo.length - 1, true);
  }

  var pos = 0;
  segmentos.forEach(function(seg) {
    if (seg.t.length > 0 && seg.b) {
      textEl.setBold(pos, pos + seg.t.length - 1, true);
    }
    pos += seg.t.length;
  });

  return para;
}

// ── Utilitários ────────────────────────────────────────────────────────────

function resp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return resp({ ok: true, status: "Cartório Drive API ativa" });
}
