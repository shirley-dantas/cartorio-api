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
// (ver database.rules.json no repositório para a lista completa, incluindo
// /geracao-estado/, usado pela geração de minuta em pedaços — ver abaixo)
//
// CALENDAR: este script agora também cria/atualiza/exclui eventos no Google
// Calendar (mesma conta do Drive). Ao colar este código e salvar, o Apps
// Script vai pedir para reautorizar o projeto com o escopo do Calendar —
// aceite a permissão e implante uma nova versão (Implantar > Gerenciar
// implantações > editar > Nova versão).
//
// GATILHOS: a geração de minuta em pedaços (ver agendarContinuacaoMinuta)
// cria gatilhos de tempo (ScriptApp.newTrigger) para continuar uma minuta
// longa sem esbarrar no teto de 6 minutos por execução. Isso pede o escopo
// de gatilhos — aceite a reautorização se for pedida, e implante uma nova
// versão, do mesmo jeito que o Calendar acima.

const PASTA_RAIZ_ID = "1KDMZ-FJMoXEzpMXKSojeZgNeJ_p4lhSb";
const NOME_PASTA_MINUTAS = "0 - MINUTAS IA";
const FIREBASE_URL = "https://painel-cartorio-default-rtdb.firebaseio.com";

// Usado só para avisar pelo WhatsApp quando uma minuta pedida por lá (dados.
// notificarWhatsApp) termina de gerar — o Vercel não pode esperar isso (a
// geração de uma minuta fiel a um modelo detalhado pode levar minutos).
const EVOLUTION_INSTANCE = "escritorio";
const EVOLUTION_API_KEY = "escritorio@2025#EvAPI";
const EVOLUTION_HOST = "evolution-api-production-59b1.up.railway.app";
const NUMERO_OPERACIONAL = "5511947851816";

function enviarWhatsApp(texto) {
  try {
    UrlFetchApp.fetch(
      "https://" + EVOLUTION_HOST + "/message/sendText/" + EVOLUTION_INSTANCE,
      {
        method: "post",
        contentType: "application/json",
        headers: { apikey: EVOLUTION_API_KEY },
        payload: JSON.stringify({ number: NUMERO_OPERACIONAL, text: texto }),
        muteHttpExceptions: true
      }
    );
  } catch (e) {}
}

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
- Use **negrito** para: título da escritura, nomes das partes, matrícula, número de guia de tributo, e também:
  - o número/letra que identifica capítulo, cláusula, inciso ou parágrafo (ex: "**Cláusula 1ª**", "**§ 2º**", "**Capítulo I**") — SEM EXCEÇÃO
  - na descrição do imóvel: a referência ao próprio imóvel (ex: "**apartamento nº 1301**"), a matrícula, o número do contribuinte (cadastro municipal/IPTU) e o valor da transação — SEM EXCEÇÃO, toda vez que aparecerem
- PROIBIDO negrito em: CNPJ, nome do banco, agência, conta corrente, emolumentos, e qualquer texto do parágrafo final de pagamento
- REGRA CRÍTICA DE NEGRITO: cada par de asteriscos duplos que abre um negrito precisa fechar com outro par de asteriscos duplos na MESMA linha/parágrafo, sem exceção — nunca abra um negrito numa linha pretendendo fechá-lo só numa linha seguinte. Um negrito com o fechamento faltando faz os asteriscos aparecerem soltos e visíveis no documento final. Se, ao terminar de escrever uma linha, você não tiver certeza se todo negrito que abriu nela também fechou nela, releia a linha e corrija antes de seguir
- Na seção ARQUIVAMENTO: negrito SOMENTE na palavra "controle" e no valor/número que vem logo depois (______). Todo o restante dessa seção sem negrito
- NÃO deixe linhas em branco entre os parágrafos — o texto deve fluir contínuo
- Use # para o título principal (centralizado) e ## para seções e cláusulas
- Campos desconhecidos: ______

REGRA ABSOLUTA — ANÁLISE DOCUMENTAL:
NUNCA inclua no corpo do texto: tabelas, listas numeradas, seções intituladas "ANÁLISE DOCUMENTAL", "APONTAMENTOS TÉCNICOS", "PENDÊNCIAS DOCUMENTAIS" ou qualquer estrutura similar.
Cada pendência ou apontamento deve aparecer EXCLUSIVAMENTE como um marcador 【PENDÊNCIA: descrição objetiva e precisa do problema】 inserido diretamente no meio do texto, imediatamente após a palavra ou trecho ao qual se refere.
Esses marcadores serão automaticamente convertidos em balões de revisão no documento — portanto NÃO devem aparecer como texto solto, tabela ou lista separada.

REGRA ABSOLUTA — MODELO DE MINUTA (REFERÊNCIA):
Se algum documento fornecido tiver cabeçalho começando com "MODELO DE MINUTA (REFERÊNCIA" — seja "FORNECIDA PELA EQUIPE" (enviada manualmente) ou "APRENDIDA AUTOMATICAMENTE" (de um caso anterior do mesmo tipo de ato) — os dois exigem o MESMO nível de fidelidade (ver REGRAS DE FIDELIDADE abaixo). O objetivo é que o modelo aprendido automaticamente também vá ficando cada vez mais completo e confiável, reduzindo a necessidade de enviar um modelo manual no futuro.
- Use o modelo para orientar como organizar e redigir a minuta (ordem das cláusulas, tom, estrutura das frases)
- NUNCA copie nomes, CPF, RG, matrícula, endereços, valores, datas ou qualquer dado específico do modelo
- Todos os dados factuais da minuta devem vir EXCLUSIVAMENTE dos demais documentos e observações do caso atual
- Se o modelo mencionar uma cláusula que não se aplica ao caso atual, não a inclua
- IMPORTANTE — NÃO CONFUNDA as duas fontes: essa restrição vale APENAS para dados que aparecem dentro do bloco "MODELO DE MINUTA (REFERÊNCIA...)". Qualquer dado (nome, CPF, RG, endereço, valor, data) que apareça nos OUTROS documentos do caso (fora do bloco do modelo) é dado real do caso atual e deve ser usado normalmente, com total confiança — mesmo que esse mesmo tipo de campo também apareça preenchido no modelo. NÃO deixe um campo em branco (______) só porque um campo parecido existe no modelo; deixe em branco SOMENTE quando o dado não aparecer em nenhum lugar fora do bloco do modelo

REGRAS DE FIDELIDADE — válidas para QUALQUER modelo de referência, manual ou aprendido:
- MANTENHA O MESMO NÍVEL DE DETALHE E ABRANGÊNCIA do modelo — se o modelo tiver uma lista extensa e detalhada de poderes/cláusulas (ex: nomes de bancos específicos, órgãos públicos nomeados, poderes judiciais completos), a minuta nova deve ter uma lista igualmente extensa e detalhada, adaptada ao caso atual. NÃO resuma ou condense cláusulas do modelo em itens genéricos — reproduza a mesma quantidade e riqueza de detalhes, apenas trocando os dados específicos pelos do caso atual (ou removendo o item, se genuinamente não se aplicar)
- REGRA DE CONCLUSÃO — NÃO PARE CEDO: antes de considerar a minuta finalizada, verifique mentalmente se você já escreveu uma cláusula ou seção correspondente a CADA cláusula/seção que existe no modelo (mesma numeração, mesmos títulos de cláusula, mesmo número aproximado de itens). Se o modelo tem cláusulas 1 a 13, ou subcláusulas 6.1 a 6.10, sua minuta também precisa chegar até lá — NÃO termine no meio (ex: só até a cláusula 6.5) só porque o texto já "parece" completo. Um documento de referência longo e detalhado exige uma minuta igualmente longa e detalhada. Só finalize (com encerramento e assinaturas) depois de cobrir TODO o conteúdo equivalente ao modelo.
- SIGA O MODELO COMO CRITÉRIO PADRÃO, não como uma entre várias opções válidas: enquanto você não tiver autonomia total para redigir minutas do zero com segurança, o modelo (manual ou aprendido automaticamente) é a referência que prevalece sobre seu próprio estilo — não troque a estrutura, a ordem das cláusulas ou o jeito de escrever do modelo por uma versão "sua" só porque parece igualmente válida.

REGRA ABSOLUTA — MINUTA ATUAL (documento já pronto sendo atualizado, NÃO é um modelo de estilo):
Se algum documento fornecido tiver cabeçalho começando com "MINUTA ATUAL", esse texto é a MINUTA JÁ PRONTA E FINALIZADA deste mesmo caso — não é uma referência de outro caso. As regras de MODELO DE MINUTA acima (não copiar dados específicos, pode omitir cláusula que não se aplica) NÃO valem aqui — são o oposto do que fazer.
- Reproduza a MINUTA ATUAL INTEIRA, do início ao fim, palavra por palavra — nenhuma cláusula, nome, dado, valor ou trecho pode ficar de fora ou ser resumido
- Aplique SOMENTE a mudança pedida em "INSTRUÇÃO DE ATUALIZAÇÃO DA MINUTA" (ex: acrescentar mais um imóvel, mais uma parte, um dado novo) — não invente nem altere mais nada além do que foi pedido
- Sempre que a mudança pedida afetar quantidade (ex: passar de um imóvel para dois ou mais), ajuste a concordância singular/plural em TODO o texto onde fizer sentido — artigos, substantivos, adjetivos, pronomes e verbos relacionados (ex: "o imóvel" → "os imóveis", "a matrícula" → "as matrículas", "certidão apresentada" → "certidões apresentadas", "o vendedor vende o imóvel" → "os vendedores vendem os imóveis"). Não mude concordância de partes/trechos que não têm relação com a mudança pedida
- Dados novos (ex: do imóvel acrescentado) vêm apenas da instrução e dos outros documentos fornecidos — campo não informado: ______

REGRA ABSOLUTA — ATOS SECUNDÁRIOS (lavrados na MESMA escritura, não são um documento à parte):
Quando o caso trouxer "ATOS SECUNDÁRIOS LAVRADOS NA MESMA ESCRITURA", cada um deles precisa virar uma cláusula própria dentro desta MESMA minuta — não é uma escritura separada, é o mesmo instrumento cobrindo mais de um ato (ex: uma Escritura de Compra e Venda que também tem Confissão de Dívida do saldo, ou uma Doação com Usufruto reservado). Identifique os dados de cada ato secundário nos documentos e observações do caso, do mesmo jeito que faria para o ato principal — campo que não aparecer em documento nenhum: ______.

REGRA ABSOLUTA — VALIDADE DAS CERTIDÕES (conferir sempre, avisar sempre):
Hoje é {{DATA_HOJE}}. Para CADA documento anexado que seja uma certidão (negativa, positiva, distribuidor, ônus/matrícula, ITBI, IPTU, trabalhista, cível, criminal, protesto, vigência de procuração, ou qualquer outra), identifique:
- TIPO: "procuração" (certidão que comprova vigência/validade de uma procuração usada no ato), "matrícula" (certidão de matrícula/ônus reais do imóvel), ou "outra" (qualquer outra certidão).
- DATA DE EMISSÃO: a data que consta no próprio documento (se não encontrar, use "NÃO IDENTIFICADA").
- VALIDADE: para tipo "procuração", SEMPRE 90 dias corridos da emissão. Para tipo "matrícula", SEMPRE 30 dias corridos da emissão. Para tipo "outra", use o prazo de validade que o PRÓPRIO documento declarar (procure frases como "válida por", "válida até", "prazo de validade"); se o documento não declarar prazo nenhum, use "sem prazo declarado".
- STATUS: compare a data de vencimento calculada com {{DATA_HOJE}} e classifique como VENCIDA, VÁLIDA, ou INDETERMINADA (quando não for possível calcular — data de emissão não identificada, ou tipo "outra" sem prazo declarado).
Para cada certidão encontrada, emita UMA LINHA com o marcador abaixo, em qualquer ponto do texto (essas linhas nunca aparecem no corpo da minuta — são extraídas à parte):
【CERTIDÃO: nome do documento | tipo: procuração/matrícula/outra | emitida: DD/MM/AAAA ou NÃO IDENTIFICADA | validade: 90 dias corridos / 30 dias corridos / conforme documento (X dias) / sem prazo declarado | vence em: DD/MM/AAAA ou NÃO CALCULÁVEL | status: VENCIDA/VÁLIDA/INDETERMINADA】
Isso é OBRIGATÓRIO para toda certidão encontrada — nunca pule esse marcador, mesmo quando o status for VÁLIDA.

No CORPO da minuta (nas cláusulas que mencionam as certidões apresentadas):
- Para certidões do tipo "procuração" e "matrícula": mencione apenas que está **devidamente atualizada** — NUNCA escreva a data de emissão, o prazo ou a data de vencimento dessas duas no corpo do texto.
- Para as demais certidões ("outra"): depende do STATUS calculado acima.
  - STATUS VÁLIDA: entra normalmente, com os dados reais dela (data de emissão, número, validade quando fizer parte da qualificação usual da certidão) — é uma certidão em dia, não há necessidade de deixar nada em branco.
  - STATUS VENCIDA ou INDETERMINADA: deixe o campo da validade/data de emissão em branco (______) no corpo da minuta, mesmo que o documento atual informe uma data — esse espaço é preenchido à mão quando a nova certidão for obtida antes da lavratura (uma certidão vencida, ou que não deu pra confirmar se está vencida, não pode entrar na minuta como se estivesse em dia).

REGRA ABSOLUTA — DESCRIÇÃO DO IMÓVEL (cópia literal, NUNCA parafraseada):
A descrição do imóvel — localização, torre/bloco/pavimento, área privativa, área de uso comum, área real total, fração ideal e a referência à matrícula — vem SEMPRE copiada PALAVRA POR PALAVRA do documento que a traz, na mesma ordem e com os mesmos termos (ex: se o documento diz "área privativa principal e total", não vire "área privativa"). NUNCA reescreva, reordene, resuma ou "melhore" essa descrição, e NUNCA misture frases de documentos diferentes numa versão própria sua. Quando o caso trouxer mais de um documento com descrição do imóvel (ex: a matrícula da instituição do condomínio e a matrícula já individualizada da unidade), use a descrição do documento mais específico para aquela unidade — mas copiada por inteiro, exatamente como está nele, nunca reescrita.
CONFERÊNCIA OBRIGATÓRIA ANTES DE FINALIZAR: depois de escrever a descrição do imóvel na minuta, releia-a comparando palavra por palavra com o trecho correspondente do documento-fonte. Se qualquer palavra, número, ordem ou pontuação estiver diferente do original — mesmo que pareça "mais bem escrito" — REESCREVA a descrição na minuta até ficar idêntica ao documento-fonte. Isso vale para toda a descrição, do início ao fim, não só para os números.

REGRA ABSOLUTA — DATA DE NASCIMENTO (só nos atos que realmente exigem):
Ao qualificar pessoa física, NÃO inclua a data de nascimento — EXCETO nos seguintes tipos de ato, onde ela é obrigatória: Inventário, Divórcio, União Estável e Pacto Antenupcial. Em qualquer outro tipo de ato (Compra e Venda, Doação, Procuração, Cessão de Direitos, Renúncia, Dação em Pagamento, Testamento, Ata Notarial, etc.), mesmo que a data de nascimento apareça nos documentos fornecidos, NÃO a escreva na qualificação — não é campo desta minuta.

REGRA ABSOLUTA — CONTRIBUINTE E VALOR VENAL DE REFERÊNCIA (usar o dado individualizado, e proporcional à fração negociada):
A matrícula do imóvel às vezes descreve o contribuinte/cadastro municipal referente a uma área maior (ex: o terreno todo, antes do desmembramento ou da instituição do condomínio) — isso NÃO significa que não exista um cadastro já individualizado para a unidade específica deste ato.
- Antes de usar o contribuinte/valor venal de referência que está na matrícula, verifique se algum OUTRO documento anexado ao caso (guia de IPTU, negativa de IPTU, ficha cadastral, cadastro imobiliário, carnê, etc.) já traz o número de contribuinte E o valor venal de referência JÁ INDIVIDUALIZADOS para esta unidade específica. Se existir, use SEMPRE o dado individualizado — nunca o da área maior da matrícula.
- Se o valor venal de referência encontrado for do imóvel INTEIRO (100%) mas o ato transmite/inventaria apenas uma FRAÇÃO IDEAL dele (ex: metade, um terço), calcule e use o valor venal PROPORCIONAL à fração efetivamente tratada no ato — não o valor cheio. Deixe claro na minuta que o valor é proporcional à fração (ex: "correspondente a 50% (cinquenta por cento) sobre o valor venal de referência total de R$______").
- Se nenhum documento trouxer o dado individualizado, use o da matrícula mesmo (área maior) e registre a ressalva com o marcador 【PENDÊNCIA: ...】, explicando que o contribuinte usado é o da área maior, não individualizado.

REGRA ABSOLUTA — ESTADO CIVIL (fórmula fixa, não invente):
Quando o estado civil de uma parte vier das respostas do caso (não de um documento formal), use SEMPRE a fórmula fixa abaixo para Solteiro(a), Divorciado(a) e Viúvo(a) — mesma fórmula para os três, sem resumir, sem adaptar e sem trocar por sinônimo:
- "solteiro(a)/divorciado(a)/viúvo(a), maior e capaz, o(a) qual declara não conviver em união estável" (troque só a palavra do estado civil pela que couber)
Casado(a) e em União Estável NÃO usam essa fórmula: seguem a regra normal de qualificação (nome do cônjuge/companheiro(a), regime de bens quando informado) e exigem verificar se há outorga uxória/anuência conjugal a colher para o ato em questão (ver as instruções por tipo de ato acima, ex: "Verificar anuência conjugal se casado" na Escritura de Compra e Venda) — campo que faltar: ______.

ABERTURA DA MINUTA — escolha conforme a MODALIDADE do caso:

Se DIGITAL (videoconferência):
Aos ______ (______) dias do mês de ______ (______) do ano de {{ANO_EXTENSO}} ({{ANO}}), nesta cidade e Capital do Estado de São Paulo, República Federativa do Brasil, perante mim, **Shirley Dantas da Silva**, Escrevente autorizada do **20º Tabelião de Notas** desta Capital, compareceram partes entre si, por meio de **VIDEOCONFERÊNCIA**, nos termos do **Provimento nº 149/2023** do Conselho Nacional de Justiça, cujas identidades foram por mim confirmadas, conforme os documentos abaixo mencionados, a mim apresentados, corroborados por sua declaração justas e contratadas, a saber:

Se HÍBRIDA (videoconferência e presencial):
Aos ______ (______) dias do mês de ______ (______) do ano de {{ANO_EXTENSO}} ({{ANO}}), nesta cidade e Capital do Estado de São Paulo, República Federativa do Brasil, perante mim, **Shirley Dantas da Silva**, Escrevente autorizada do **20º Tabelião de Notas** desta Capital, compareceram partes entre si, por meio de **VIDEOCONFERÊNCIA**, e **PRESENCIALMENTE** nos termos do **Provimento nº 149/2023** do Conselho Nacional de Justiça, cujas identidades foram por mim confirmadas, conforme os documentos abaixo mencionados, a mim apresentados, corroborados por sua declaração justas e contratadas, a saber:

Se PRESENCIAL:
Aos ______ (______) dias do mês de ______ (______) do ano de {{ANO_EXTENSO}} ({{ANO}}), nesta cidade e Capital do Estado de São Paulo, República Federativa do Brasil, perante mim, **Shirley Dantas da Silva**, Escrevente autorizada do **20º Tabelião de Notas** desta Capital, compareceram partes entre si, cujas identidades foram por mim confirmadas, conforme os documentos abaixo mencionados, a mim apresentados, corroborados por sua declaração justas e contratadas, a saber:

ENCERRAMENTO DA MINUTA — escolha conforme a MODALIDADE do caso:

Se DIGITAL ou HÍBRIDA:
**IMPOSTOS DE TRANSMISSÃO** - Que apresentam a guia de Imposto sobre Transmissão de Bens Imóveis e de direitos a eles relativos, recolhido através da guia sob nº ______ no valor de **R$______**, devidamente paga, a qual fica arquivada nestas notas; **INDISPONIBILIDADE:** CONSULTA com resultado negativo à Central de Indisponibilidade de Bens conforme código: **HASH: ______.** **DOI:** EMITIDA DOI - Declaração Sobre Operação Imobiliária, conforme Instrução Normativa da Secretaria da Receita Federal vigente. **ARQUIVAMENTO:** Todos os documentos de arquivamento obrigatório mencionados neste ato notarial ficam arquivados digitalmente, pelo prazo legal, neste **20º Tabelionato de Notas**, sob o número de controle: ______ **CERTIFICAÇÃO:** Escritura assinada digitalmente com certificado digital, pela plataforma do e-Notariado, por: **[nomes das partes que assinam ONLINE, conforme a modalidade e os documentos/observações do caso]** ///______[SE HÍBRIDA: e presencialmente por **[nomes das partes que assinam PRESENCIALMENTE]** /// ______]. Eu, escrevente autorizada indicada no fluxo de assinaturas, a lavrei, li realizei a videoconferência e assino com meu certificado digital. Eu, Substituto Legal do Tabelião, indicado no fluxo de assinaturas, subscrevo e assino com meu certificado digital padrão ICP-Brasil, encerrando este ato. Data e horário das assinaturas digitais, bem como matrícula notarial eletrônica (MNE) constantes do manifesto impresso na última página desta. De tudo dou fé. O adquirente adimpliu com os emolumentos notariais ao final consignados, mediante transferência à conta desta Serventia **(CNPJ: 45.566.502/0001-12)** junto ao banco **Itaú S/A**, agência **0350**, c/c: **72195-7.** O adquirente dispensa expressamente este Cartório e seu Tabelião do encaminhamento desta escritura a registro, pelo que isenta-o de qualquer responsabilidade. De como assim o disseram, dou fé, a pedido das partes, lavrei esta escritura, a qual feita e lhes sendo lida em voz alta, acharam-na conforme, aceitaram, outorgaram e assinam.

Se PRESENCIAL:
**IMPOSTOS DE TRANSMISSÃO** - Que apresentam a guia de Imposto sobre Transmissão de Bens Imóveis e de direitos a eles relativos, recolhido através da guia sob nº ______ no valor de **R$______**, devidamente paga, a qual fica arquivada nestas notas; **INDISPONIBILIDADE:** CONSULTA com resultado negativo à Central de Indisponibilidade de Bens conforme código: **HASH: ______.** **DOI:** EMITIDA DOI - Declaração Sobre Operação Imobiliária, conforme Instrução Normativa da Secretaria da Receita Federal vigente. **ARQUIVAMENTO:** Todos os documentos de arquivamento obrigatório mencionados neste ato notarial ficam arquivados digitalmente, pelo prazo legal, neste **20º Tabelionato de Notas**, sob o número de controle: ______ O adquirente adimpliu com os emolumentos notariais ao final consignados, mediante transferência à conta desta Serventia **(CNPJ: 45.566.502/0001-12)** junto ao banco **Itaú S/A**, agência **0350**, c/c: **72195-7.** O adquirente dispensa expressamente este Cartório e seu Tabelião do encaminhamento desta escritura a registro, pelo que isenta-o de qualquer responsabilidade. De como assim o disseram, dou fé, a pedido das partes, lavrei esta escritura, a qual feita e lhes sendo lida em voz alta, acharam-na conforme, aceitaram, outorgaram e assinam.

NOTA SOBRE O ENCERRAMENTO: Substitua "adquirente" pelo nome correto da parte principal do ato (outorgante, testador, requerente, etc.). Para atos que não envolvam transferência imobiliária (procuração, testamento, ata notarial, etc.), omita APENAS as seções IMPOSTOS DE TRANSMISSÃO e DOI. As demais seções — **INDISPONIBILIDADE**, **ARQUIVAMENTO**, **CERTIFICAÇÃO** e o parágrafo final de emolumentos — são OBRIGATÓRIAS em TODO ato, sem exceção, independentemente do tipo. NUNCA omita a frase de INDISPONIBILIDADE (consulta à Central de Indisponibilidade de Bens).

NA CERTIFICAÇÃO, NUNCA deixe "______" no lugar do nome de quem assina: preencha com o nome de cada parte, no grupo correto (online ou presencial), usando a MODALIDADE do caso e as observações/documentos para saber quem assina de qual jeito — se MODALIDADE for DIGITAL, todas as partes vão no grupo online; se PRESENCIAL, todas no grupo presencial; se HÍBRIDA, distribua conforme o que constar nas observações do caso (quem assina online e quem assina presencialmente); só use ______ se, mesmo em modalidade HÍBRIDA, não houver NENHUMA indicação de quem assina em qual grupo.

A minuta deve conter todos os elementos formais: preâmbulo (abertura), qualificação completa das partes, objeto, cláusulas, disposições fiscais, encerramento e assinaturas.

ÚLTIMA CONFERÊNCIA ANTES DE TERMINAR — não pule isto: releia a lista de documentos anexados a este caso. Para CADA UM que for uma certidão (negativa, positiva, distribuidor, ônus/matrícula, ITBI, IPTU, trabalhista, cível, criminal, protesto, vigência de procuração, ou qualquer outra), confirme que você já emitiu o marcador 【CERTIDÃO: ...】 correspondente, conforme a REGRA ABSOLUTA — VALIDADE DAS CERTIDÕES acima. Um documento anexado que seja certidão e não tiver esse marcador é uma falha grave desta minuta — mesmo que o corpo do texto já mencione a certidão normalmente.`;

// ── Ano por extenso ──────────────────────────────────────────────────────
// A abertura da minuta trazia "dois mil e vinte e seis (2026)" escrito à mão
// no SYSTEM_PROMPT — funcionava em 2026 e ficaria errado sozinho em 2027.
// Agora o prompt carrega os marcadores {{ANO_EXTENSO}}/{{ANO}}, preenchidos
// na hora da chamada por montarSystemPrompt(). Cobre 2000–2099 (a faixa que
// realmente ocorre em cartório); fora dela cai pro numeral puro, sem travar.
function anoPorExtenso(ano) {
  var DEZ_A_DEZENOVE = ["dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  var DEZENAS = ["", "dez", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  var UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  if (ano < 2000 || ano > 2099) return String(ano);
  var resto = ano - 2000;
  if (resto === 0) return "dois mil";
  if (resto < 10) return "dois mil e " + UNIDADES[resto];
  if (resto < 20) return "dois mil e " + DEZ_A_DEZENOVE[resto - 10];
  var dezena = Math.floor(resto / 10);
  var unidade = resto % 10;
  return "dois mil e " + DEZENAS[dezena] + (unidade ? " e " + UNIDADES[unidade] : "");
}
// {{DATA_HOJE}} é sempre o dia real em que a minuta está sendo gerada (não
// depende do `ano` do caso, que é só o ano da abertura) — é o que a REGRA
// ABSOLUTA — VALIDADE DAS CERTIDÕES usa para calcular se uma certidão já
// venceu.
function dataHojeFormatada() {
  var hoje = new Date();
  var dia = ("0" + hoje.getDate()).slice(-2);
  var mes = ("0" + (hoje.getMonth() + 1)).slice(-2);
  return dia + "/" + mes + "/" + hoje.getFullYear();
}
function montarSystemPrompt(ano) {
  return SYSTEM_PROMPT
    .split("{{ANO_EXTENSO}}").join(anoPorExtenso(ano))
    .split("{{ANO}}").join(String(ano))
    .split("{{DATA_HOJE}}").join(dataHojeFormatada());
}

// ── Funções auxiliares ─────────────────────────────────────────────────────

// Pasta "0 - MINUTAS IA" dentro da pasta raiz — é onde ficam as pastas de
// cliente deste sistema, separadas das outras pastas que já existem na raiz
// (que não têm relação com o painel).
function getPastaMinutasIA() {
  const pastaRaiz = DriveApp.getFolderById(PASTA_RAIZ_ID);
  const busca = pastaRaiz.getFoldersByName(NOME_PASTA_MINUTAS);
  return busca.hasNext() ? busca.next() : pastaRaiz.createFolder(NOME_PASTA_MINUTAS);
}

// Pasta única do cliente, dentro de "0 - MINUTAS IA" — documentos anexados E
// minuta gerada ficam juntos aqui (antes a minuta ia para uma pasta separada
// e os documentos para outra, espalhando o material do mesmo caso).
function getPastaCliente(nomeCliente) {
  const pastaMinutas = getPastaMinutasIA();
  const busca = pastaMinutas.getFoldersByName(nomeCliente);
  return busca.hasNext() ? busca.next() : pastaMinutas.createFolder(nomeCliente);
}

function instrucoesPorTipo(tipo) {
  if (!tipo) return "";
  const chaves = Object.keys(INSTRUCOES_POR_TIPO);
  const chave = chaves.find(function(k) {
    return tipo.toLowerCase().indexOf(k.toLowerCase()) !== -1;
  });
  return chave ? INSTRUCOES_POR_TIPO[chave] : "";
}

// ── Abreviação do tipo de ato (usada só no nome do documento de minuta) ────
const ABREVIACOES_TIPO_ATO = {
  "Inventário": "INV.",
  "Escritura de Compra e Venda": "V/C",
  "Procuração": "PROC.",
  "Divórcio": "DIV.",
  "União Estável": "U.E.",
  "Doação": "DOA",
  "Renúncia": "RENÚNC.",
  "Cessão de Direitos": "CESSÃO",
  "Pacto Antenupcial": "PACTO",
  "Testamento": "TEST.",
  "Ata Notarial": "ATA",
  "Dação em Pagamento": "DAÇÃO PGTO.",
  "Escritura Declaratória": "DECLAR.",
  "Usucapião": "USUC."
};
function abreviarTipoAto(tipo) {
  if (!tipo) return "ATO";
  const chaves = Object.keys(ABREVIACOES_TIPO_ATO);
  const chave = chaves.find(function(k) {
    return tipo.toLowerCase().indexOf(k.toLowerCase()) !== -1;
  });
  return chave ? ABREVIACOES_TIPO_ATO[chave] : tipo.toUpperCase();
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

// Teto de segurança do modelo aprendido. O corte antigo (6000 caracteres) era
// o motivo mais provável de "a minuta não segue os modelos": uma minuta de
// 30.000+ caracteres virava referência cortada no meio de uma frase, sem
// encerramento — e o SYSTEM_PROMPT manda, em maiúsculas, cobrir até o fim do
// modelo. Este teto é só um limite de segurança (evita um caso extremo travar
// a gravação no Firebase); quando bate, fica declarado em `truncado`.
const MODELO_APRENDIDO_MAX_CHARS = 100000;
// `tipo` fica gravado por extenso (tipoOriginal), além da chave normalizada
// — a chave (ex: "escritura-de-compra-e-venda") é o que indexa o registro,
// mas é o tipoOriginal que a tela de curadoria mostra pra ela reconhecer do
// que se trata.
function salvarModeloAprendido(tipo, texto, nomeCaso) {
  try {
    const chave = chaveTipo(tipo);
    const truncou = texto.length > MODELO_APRENDIDO_MAX_CHARS;
    UrlFetchApp.fetch(FIREBASE_URL + "/modelos/" + chave + ".json", {
      method: "put",
      contentType: "application/json",
      payload: JSON.stringify({
        texto: truncou ? texto.slice(0, MODELO_APRENDIDO_MAX_CHARS) : texto,
        truncado: truncou,
        tipoOriginal: tipo || "",
        origemCaso: nomeCaso || "",
        atualizado: new Date().toISOString()
      }),
      muteHttpExceptions: true
    });
  } catch (e) {}
}

// Mesma ideia do extrairIdPasta (mais abaixo), mas para o link de um Google
// Doc: .../document/d/ID/edit, .../document/d/ID/edit?usp=..., ou o id sozinho.
function extrairIdDocumento(referencia) {
  var s = String(referencia || "").trim();
  if (!s) return "";
  var m = s.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s;
  return "";
}

// ── Curadoria do modelo aprendido (Etapa 2) ─────────────────────────────
// Antes, TODA minuta gerada virava o modelo do tipo — boa ou ruim (uma
// minuta com trinta ______ virava a referência do próximo caso). Agora só
// entra quando ela decide, clicando em "Marcar como modelo" no painel.
// Lê o texto ATUAL do Doc, não o que a IA gerou originalmente: se ela editou
// antes de marcar, é a versão editada — a boa de verdade — que vira modelo.
function marcarModelo(dados) {
  try {
    var docId = extrairIdDocumento(dados.docUrl || "");
    if (!docId) return resp({ ok: false, erro: "Não reconheci o link do documento." });
    var doc = DocumentApp.openById(docId);
    var texto = doc.getBody().getText().trim();
    if (!texto) return resp({ ok: false, erro: "O documento está vazio." });
    salvarModeloAprendido(dados.tipo, texto, dados.nome);
    return resp({ ok: true });
  } catch (err) {
    return resp({ ok: false, erro: err.message });
  }
}

// Heurística simples, só pelo NOME do documento anexado — usada apenas como
// rede de segurança (ver finalizarGeracaoMinuta) para avisar quando a IA não
// emitiu marcador de certidão nenhum, mas claramente havia certidão no caso.
var PALAVRAS_CERTIDAO = ["certid", "cnd", "cndt", "iptu", "distribuidor", "onus", "ônus", "protesto", "matricula", "matrícula", "procuracao", "procuração", "dau", "itbi"];
function documentosParecemTerCertidao(documentosTexto) {
  var texto = String(documentosTexto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  var regexNome = /=== documento: ([^=]*?) ===/g;
  var m;
  while ((m = regexNome.exec(texto)) !== null) {
    var nome = m[1];
    if (PALAVRAS_CERTIDAO.some(function (p) { return nome.indexOf(p.normalize("NFD").replace(/[̀-ͯ]/g, "")) !== -1; })) return true;
  }
  return false;
}

// Um marcador 【CERTIDÃO: nome | tipo: ... | emitida: ... | validade: ... |
// vence em: ... | status: ...】 vira este objeto. Campo que a IA não incluiu
// (ou escreveu fora do formato) fica com string vazia — nunca derruba o
// parse dos outros marcadores da mesma minuta.
function parsearMarcadorCertidao(conteudo) {
  var partes = conteudo.split("|").map(function (p) { return p.trim(); });
  if (!partes.length || !partes[0]) return null;
  var campo = function (prefixo) {
    var achado = partes.find(function (p) { return p.toLowerCase().indexOf(prefixo.toLowerCase()) === 0; });
    return achado ? achado.slice(prefixo.length).trim() : "";
  };
  return {
    nome: partes[0],
    tipo: (campo("tipo:") || "outra").toLowerCase(),
    emitida: campo("emitida:"),
    validade: campo("validade:"),
    venceEm: campo("vence em:"),
    status: (campo("status:") || "INDETERMINADA").toUpperCase()
  };
}

function parsearResposta(texto) {
  var comentarios = [];
  var certidoes = [];
  var num = 1;
  var ABRE = "【";
  var FECHA = "】";

  // Um único passe: todo marcador 【...】 é retirado do corpo (nenhum dos dois
  // tipos pode sobrar na minuta). 【PENDÊNCIA: ...】 vira comentário de revisão
  // no Doc; 【CERTIDÃO: ...】 vira o dado que alimenta o alerta de validade no
  // painel (ver REGRA ABSOLUTA — VALIDADE DAS CERTIDÕES no SYSTEM_PROMPT).
  var minuta = "";
  var pos = 0;
  while (true) {
    var s = texto.indexOf(ABRE, pos);
    if (s === -1) { minuta += texto.slice(pos); break; }
    var e = texto.indexOf(FECHA, s);
    if (e === -1) { minuta += texto.slice(pos); break; }
    minuta += texto.slice(pos, s);
    var conteudo = texto.slice(s + ABRE.length, e).trim();
    if (conteudo.indexOf("PENDÊNCIA:") === 0) {
      comentarios.push("Pendencia " + num + ": " + conteudo.slice("PENDÊNCIA:".length).trim());
      num++;
    } else if (conteudo.indexOf("CERTIDÃO:") === 0) {
      var certidao = parsearMarcadorCertidao(conteudo.slice("CERTIDÃO:".length).trim());
      if (certidao) certidoes.push(certidao);
    }
    pos = e + FECHA.length;
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
  return { minuta: minuta, comentarios: comentarios, certidoes: certidoes };
}

function chamarClaudeRaw(mensagem, ano) {
  var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada. Vá em Projeto > Propriedades do script e adicione a chave.");

  // 8000 fazia qualquer minuta um pouco mais longa parar no meio e precisar
  // de outro pedaço — e cada pedaço custa uma volta inteira pelo Firebase e
  // pelo gatilho (ver agendarContinuacaoMinuta/continuarGeracaoMinuta), não
  // só o tempo da IA escrevendo. 16000 é o mesmo teto que api/aliquota-
  // municipal.js já usa com este mesmo modelo, sem cabeçalho especial: menos
  // pedaços, mesmo texto, mesma IA — só menos idas e vindas.
  var payload = {
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    system: montarSystemPrompt(ano || new Date().getFullYear()),
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

// "CONCLUIDO." (com ponto), "concluído" ou qualquer variação com espaço/
// pontuação sobrando na resposta da IA entrava LITERALMENTE no fim da
// escritura, porque a comparação exigia igualdade exata com "CONCLUIDO".
function respostaIndicaConclusao(texto) {
  var limpa = String(texto || "").trim().toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[.!\s]+$/, "");
  return limpa === "CONCLUIDO";
}

// Cola dois pedaços da mesma minuta (rodadas diferentes de geração). Sem
// verificar a borda, um pedaço terminando sem espaço e o próximo começando
// sem espaço grudavam as duas frases numa palavra só.
function unirTextoMinuta(a, b) {
  if (!a) return b || "";
  if (!b) return a;
  var precisaEspaco = !/\s/.test(a.slice(-1)) && !/\s/.test(b.slice(0, 1));
  return a + (precisaEspaco ? " " : "") + b;
}

// A geração para no limite de rodadas (MAX_PEDACOS) sem ter certeza de que
// terminou de verdade quando a última rodada ainda sinalizava que precisava
// continuar — isso é truncamento, não sucesso silencioso.
function precisouTruncarGeracao(rodadas, maxPedacos, aindaPrecisaContinuar) {
  return rodadas >= maxPedacos && !!aindaPrecisaContinuar;
}

// A minuta é gerada em pedaços (até 6 rodadas de IA), mas cada rodada agora
// roda numa EXECUÇÃO PRÓPRIA do Apps Script, não dentro de um loop na mesma
// chamada. Motivo: o Apps Script tem um teto de 6 minutos por execução, e um
// caso grande (documentos longos, minuta extensa) pode precisar de mais
// tempo que isso somando as rodadas — foi o que travou a minuta da RL Fátima
// em 09/09/2026, com "Tempo esgotado aguardando geração da minuta".
//
// UrlFetchApp não serve para disparar a próxima rodada sem esperar: ele é
// SEMPRE síncrono no Apps Script (ao contrário do https do Node, usado em
// iniciar-minuta.js, que pode resolver assim que os dados saem, sem esperar
// a resposta) — chamar a rodada seguinte por HTTP manteria a chamada de fora
// travada até a de dentro terminar, e o relógio da rodada 1 continuaria
// correndo enquanto espera. O jeito certo de "terminar aqui e continuar
// depois, sem ninguém esperando" é um gatilho de tempo (ScriptApp): agenda
// uma função pra rodar daqui a pouco, como uma execução nova e independente,
// com seu próprio teto de 6 minutos, e a chamada atual pode terminar.
//
// Gatilho de tempo não aceita parâmetro nenhum — só chama a função pelo
// nome. O estado da geração (o que já foi escrito, quantas rodadas, etc.)
// PRECISA ir pro Firebase, não pras Propriedades do script: uma minuta em
// andamento facilmente passa dos ~9KB por valor que o PropertiesService
// aceita (é o texto de uma escritura inteira, às vezes de dezenas de
// páginas). As Propriedades guardam só uma migalha — o jobId, indexado pelo
// id único do gatilho (event.triggerUid) — o suficiente pra saber qual
// registro buscar no Firebase, mesmo com duas minutas sendo geradas ao
// mesmo tempo.
var GERACAO_MAX_PEDACOS = 6;

function agendarContinuacaoMinuta(jobId, estado) {
  UrlFetchApp.fetch(FIREBASE_URL + "/geracao-estado/" + jobId + ".json", {
    method: "put",
    contentType: "application/json",
    payload: JSON.stringify(estado),
    muteHttpExceptions: true
  });
  var trigger = ScriptApp.newTrigger("continuarGeracaoMinuta").timeBased().after(2000).create();
  PropertiesService.getScriptProperties().setProperty("cont_" + trigger.getUniqueId(), jobId);
}

// Chamada pelo gatilho de tempo. Lê o jobId pelo triggerUid do evento (não
// por parâmetro — gatilho de tempo não aceita nenhum), busca o estado de
// verdade no Firebase e limpa os dois rastros: a propriedade (pequena) e o
// registro no Firebase (que pode ser grande) — um gatilho só serve pra uma
// rodada, nunca é reaproveitado, e um estado velho parado no Firebase não
// serve pra nada.
function continuarGeracaoMinuta(e) {
  var props = PropertiesService.getScriptProperties();
  var chave = "cont_" + (e && e.triggerUid);
  var jobId = props.getProperty(chave);
  if (!jobId) return; // gatilho órfão (propriedade já consumida, ou evento sem triggerUid) — nada a fazer
  props.deleteProperty(chave);
  var url = FIREBASE_URL + "/geracao-estado/" + jobId + ".json";
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var estado = JSON.parse(response.getContentText());
  UrlFetchApp.fetch(url, { method: "delete", muteHttpExceptions: true });
  if (!estado) return; // estado sumiu (não devia acontecer) — sem ele não tem como continuar
  processarRodadaMinuta(jobId, estado);
}

// Uma única rodada: monta a mensagem (com o trecho já escrito, se for
// continuação), chama a IA uma vez, e decide entre agendar a próxima rodada
// ou finalizar. Nunca faz duas chamadas à IA na mesma execução — é isso que
// mantém cada execução bem abaixo do teto de 6 minutos, mesmo num caso que
// precise das 6 rodadas inteiras.
function processarRodadaMinuta(jobId, estado) {
  try {
    var mensagem = estado.mensagemBase;
    if (estado.rodadas > 0) {
      var trechoFinal = estado.textoAcumulado.slice(-1500);
      mensagem = estado.mensagemBase +
        "\n\n---\nATENÇÃO: você já escreveu o trecho abaixo desta MESMA minuta (isto é uma continuação, não um novo pedido). " +
        "NÃO repita esse trecho — continue EXATAMENTE de onde ele parou, mantendo a mesma formatação, numeração de cláusulas e estilo. " +
        "Antes de considerar concluído, confira se já cobriu TODAS as cláusulas/seções equivalentes às do modelo de referência (mesma numeração e escopo). " +
        "Se esse trecho já contiver o encerramento completo da minuta (assinaturas) E cobrir todo o conteúdo equivalente ao modelo, responda EXATAMENTE com a palavra CONCLUIDO, sem mais nada. " +
        "Caso contrário, continue escrevendo o restante.\n\n" +
        "TRECHO JÁ ESCRITO (final dele):\n..." + trechoFinal + "\n\nCONTINUE A PARTIR DAQUI (ou responda CONCLUIDO se já estiver completo):";
    }

    var res = chamarClaudeRaw(mensagem, estado.ano);
    estado.rodadas++;
    var precisaContinuar = false;
    if (respostaIndicaConclusao(res.texto)) {
      precisaContinuar = false;
    } else {
      estado.textoAcumulado = unirTextoMinuta(estado.textoAcumulado, res.texto);
      precisaContinuar = res.pararPorTamanho; // bateu no limite de tamanho, com certeza precisa continuar
      if (!precisaContinuar && estado.temModelo && estado.rodadas === 1) {
        precisaContinuar = true; // primeira rodada com modelo: sempre confirma cobertura antes de aceitar
      }
    }

    if (precisaContinuar && estado.rodadas < GERACAO_MAX_PEDACOS) {
      agendarContinuacaoMinuta(jobId, estado);
      return;
    }

    finalizarGeracaoMinuta(jobId, estado, precisouTruncarGeracao(estado.rodadas, GERACAO_MAX_PEDACOS, precisaContinuar));
  } catch (err) {
    if (jobId) salvarJobFirebase(jobId, { status: "done", ok: false, erro: err.message });
    if (estado.notificarWhatsApp) {
      enviarWhatsApp("⚠️ Não consegui gerar a minuta de " + (estado.nome || "caso") + " agora: " + err.message + ". Tente pedir de novo.");
    }
  }
}

// Depois da última rodada (concluiu, ou esgotou as 6): cria o documento,
// audita, avisa — mesma cauda que gerarECriarMinuta sempre teve, só que
// agora chamada de dentro de processarRodadaMinuta em vez de no fim de um
// loop na mesma execução.
function finalizarGeracaoMinuta(jobId, estado, truncada) {
  var parsed = parsearResposta(estado.textoAcumulado);
  var conferencia = conferirMinuta(parsed.minuta, estado.mod);

  var docResult = _criarMinutaDocInterno({
    nome: estado.nome,
    tipo: estado.tipo,
    minuta: parsed.minuta,
    comentarios: parsed.comentarios
  });

  // Nada aqui sai calado: minuta truncada na 6ª rodada, seção obrigatória de
  // encerramento faltando, abertura incompatível com a modalidade ou
  // documento que a IA não leu — tudo vira aviso, nunca um "✅ sucesso" liso.
  var avisos = conferencia.avisos.slice();
  if (estado.avisosDocumentos) avisos.push("Documento(s) que a IA pode não ter lido por completo: " + estado.avisosDocumentos);
  // Rede de segurança: o marcador 【CERTIDÃO: ...】 depende da IA lembrar de
  // emiti-lo (ver REGRA ABSOLUTA — VALIDADE DAS CERTIDÕES). Se ela não emitiu
  // nenhum, mas o nome de algum documento anexado tem cara de certidão, o
  // painel avisa mesmo assim — silêncio total é pior que um aviso genérico.
  if (parsed.certidoes.length === 0 && documentosParecemTerCertidao(estado.documentosTexto)) {
    avisos.push("A IA não identificou nenhuma certidão automaticamente neste caso, mas há documento(s) anexado(s) com nome de certidão — confira manualmente a validade de cada uma antes de lavrar.");
  }

  if (jobId) {
    salvarJobFirebase(jobId, {
      status: "done",
      ok: true,
      truncada: truncada,
      avisos: avisos,
      docUrl: docResult.url,
      folderUrl: docResult.folderUrl,
      docNome: docResult.nome,
      diagRodadas: estado.rodadas,
      diagTemModelo: estado.temModelo,
      diagBrancos: conferencia.brancos,
      certidoes: parsed.certidoes
    });
  }

  if (estado.casoId) {
    // Auditoria: uma chamada SEPARADA da que gerou a minuta, depois do
    // documento já pronto e do job já marcado como pronto acima — o painel
    // já liberou a tela nesse instante, então isto roda fora do caminho
    // crítico. Nunca reescreve a minuta, só confere e aponta.
    var achadosAuditoria = auditarMinuta(parsed.minuta, estado.documentosTexto);
    var patchCaso = { driveUrl: docResult.folderUrl, docUrl: docResult.url };
    if (achadosAuditoria !== null) {
      patchCaso.auditoria = { achados: achadosAuditoria, atualizado: new Date().toISOString() };
    }
    UrlFetchApp.fetch(FIREBASE_URL + "/casos/" + estado.casoId + ".json", {
      method: "patch",
      contentType: "application/json",
      payload: JSON.stringify(patchCaso),
      muteHttpExceptions: true
    });
  }
  if (estado.notificarWhatsApp) {
    if (truncada || avisos.length) {
      var motivos = truncada ? ["a geração pode ter parado antes do fim (limite de rodadas)"].concat(avisos) : avisos;
      enviarWhatsApp("⚠️ Minuta de " + (estado.nome || "caso") + " gerada, mas com ressalva — confira antes de usar: " + motivos.join(" | ") + ". " + docResult.url);
    } else {
      enviarWhatsApp("✅ Minuta de " + (estado.nome || "caso") + " pronta! " + docResult.url);
    }
  }
}

// Conferência da minuta gerada — uma segunda camada de detecção de corte,
// independente do stop_reason da API: sinaliza quando o texto saiu sem as
// seções obrigatórias de encerramento, com abertura incompatível com a
// modalidade do ato, ou com um marcador de pendência que ficou aberto (sinal
// de corte no meio de um 【PENDÊNCIA: ...】). Nunca reescreve a minuta — só
// relata, para a tela avisar em vez de anunciar sucesso calado.
function conferirMinuta(texto, modalidade) {
  var avisos = [];
  var t = String(texto || "");
  var mod = String(modalidade || "").toLowerCase();

  // Obrigatórias em TODO ato, sem exceção (ver NOTA SOBRE O ENCERRAMENTO no SYSTEM_PROMPT).
  if (t.indexOf("INDISPONIBILIDADE") === -1) avisos.push("Não encontrei a seção INDISPONIBILIDADE no encerramento — confira se a minuta saiu completa.");
  if (t.indexOf("ARQUIVAMENTO") === -1) avisos.push("Não encontrei a seção ARQUIVAMENTO no encerramento — confira se a minuta saiu completa.");
  // CERTIFICAÇÃO só existe no encerramento digital/híbrido (assinatura por certificado digital).
  if ((mod === "digital" || mod === "hibrida") && t.indexOf("CERTIFICAÇÃO") === -1) {
    avisos.push("Não encontrei a seção CERTIFICAÇÃO no encerramento (obrigatória em ato digital/híbrido) — confira se a minuta saiu completa.");
  }

  if (mod === "presencial" && t.indexOf("VIDEOCONFERÊNCIA") !== -1) {
    avisos.push("A abertura menciona VIDEOCONFERÊNCIA, mas o ato é PRESENCIAL — confira a abertura.");
  }
  if (mod === "digital" && t.indexOf("VIDEOCONFERÊNCIA") === -1) {
    avisos.push("A abertura não menciona VIDEOCONFERÊNCIA, mas o ato é DIGITAL — confira a abertura.");
  }
  if (mod === "hibrida" && (t.indexOf("VIDEOCONFERÊNCIA") === -1 || t.indexOf("PRESENCIALMENTE") === -1)) {
    avisos.push("A abertura não parece cobrir os dois comparecimentos (videoconferência e presencial) do ato HÍBRIDO — confira a abertura.");
  }

  var abre = (t.match(/【/g) || []).length;
  var fecha = (t.match(/】/g) || []).length;
  if (abre !== fecha) avisos.push("Ficou um marcador 【 de pendência sem fechar no texto — sinal de corte no meio da geração.");

  var brancos = (t.match(/______/g) || []).length;

  return { avisos: avisos, brancos: brancos };
}

// ── Auditoria (Etapa 2) ──────────────────────────────────────────────────
// Uma segunda chamada à IA, separada da que gerou a minuta, que só CONFERE —
// nunca reescreve. Roda depois da minuta pronta (ver gerarECriarMinuta).
const AUDITORIA_SYSTEM_PROMPT = `Você é o auditor de minutas do 20º Tabelião de Notas de São Paulo.

Você recebe uma minuta já pronta e os documentos/informações originais do caso. Sua ÚNICA tarefa é CONFERIR dados — nunca reescrever a minuta, nunca sugerir mudança de redação, nunca opinar sobre estilo ou cláusula.

Confira especificamente, comparando a minuta contra os documentos originais:
- Nome de cada parte
- CPF
- RG
- Número da matrícula do imóvel
- Área do imóvel
- Números por extenso × o algarismo entre parênteses que os acompanha (ex: "três (3)", "cem mil reais (R$ 100.000,00)") — o extenso e o número precisam dizer a mesma coisa

REGRAS:
- Aponte SÓ divergência real e concreta entre o que a minuta diz e o que os documentos originais dizem.
- Campo que a minuta deixou em branco (______) não é divergência — é ausência, e já está sinalizado na própria minuta. Não aponte.
- Dado que não aparece em nenhum documento original também não é divergência — não aponte.
- Ignore qualquer trecho sob um cabeçalho "=== MODELO DE MINUTA (REFERÊNCIA...)" — é só referência de estilo de outro caso, nunca dado deste caso. Os demais documentos (e a MINUTA ATUAL, quando houver) são a fonte da verdade deste caso.
- Cada achado é uma frase objetiva e curta dizendo o que diverge e de onde veio cada versão (ex: "CPF da Maria na minuta é 111.111.111-11, mas a certidão de casamento traz 111.111.111-12").
- Se não encontrar divergência nenhuma, devolva a lista vazia.

Responda SOMENTE com um JSON válido, sem markdown, sem texto antes ou depois, no formato exato:
{"achados":["texto do achado 1","texto do achado 2"]}

Se não houver divergência nenhuma, responda exatamente {"achados":[]}.`;

function extrairJsonAuditoria(texto) {
  var s = texto.indexOf("{");
  var e = texto.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("Resposta da IA não veio em formato reconhecível.");
  return JSON.parse(texto.slice(s, e + 1));
}

// Devolve a lista de achados (pode ser vazia — "conferi e está tudo certo"),
// ou `null` quando a própria auditoria não rodou (falha de rede, JSON
// inválido, chave ausente). A distinção importa: null nunca vira pílula no
// painel, porque "não sei" não pode ter a mesma cara de "conferi e não achei
// nada". Nunca lança erro — uma auditoria que falha não pode derrubar uma
// minuta que já foi gerada com sucesso.
function auditarMinuta(minutaTexto, documentosTexto) {
  try {
    var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
    if (!apiKey) return null;
    var doc = String(documentosTexto || "");
    if (doc.length > 100000) doc = doc.slice(0, 100000) + "\n\n[...texto truncado por limite de tamanho...]";
    var mensagem = "MINUTA PRONTA (a auditar):\n" + minutaTexto +
      "\n\n---\n\nDOCUMENTOS E INFORMAÇÕES ORIGINAIS DO CASO (fonte da verdade):\n" + doc;

    var payload = {
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: AUDITORIA_SYSTEM_PROMPT,
      messages: [{ role: "user", content: mensagem }]
    };
    var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
      method: "post",
      contentType: "application/json",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var data = JSON.parse(response.getContentText());
    if (data.error) return null;
    var texto = (data.content && data.content[0] && data.content[0].text) || "";
    var parsed = extrairJsonAuditoria(texto);
    return (Array.isArray(parsed.achados) ? parsed.achados : [])
      .map(function (a) { return String(a || "").trim(); })
      .filter(Boolean);
  } catch (e) {
    return null;
  }
}

// ── Extração de texto de arquivo grande (job assíncrono) ───────────────────
// O painel manda PDF/imagem grande — ou com muitas páginas — direto pra cá,
// não pela Vercel: a Vercel tem um teto fixo de 60s por chamada (plano
// Hobby) e ~4,5MB no corpo da requisição, e um documento de muitas páginas
// passa dos dois (foi o que aconteceu em produção em 08/09/2026 com a "3ª
// Alteração Contratual" e outros anexos — HTTP 504, servidor "recusando"
// arquivos que já cabiam no limite de tamanho). O Apps Script roda até 6
// minutos por chamada e aceita corpos bem maiores, então lê do mesmo jeito
// (mesmo prompt, mesmas passadas de continuação de api/extrair-texto-
// arquivo.js) sem esbarrar em nenhum dos dois tetos. Devolve pelo Firebase
// (job), nunca pela resposta HTTP — o painel não fica esperando a chamada
// terminar, o mesmo padrão de gerarECriarMinuta acima.
var EXTRACAO_ARQUIVO_MAX_TOKENS = 8000;
var EXTRACAO_ARQUIVO_MAX_PASSADAS = 4;

function chamarClaudeArquivoRaw(content) {
  var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");
  var payload = {
    model: "claude-sonnet-4-6",
    max_tokens: EXTRACAO_ARQUIVO_MAX_TOKENS,
    messages: [{ role: "user", content: content }]
  };
  var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var data = JSON.parse(response.getContentText());
  if (data.error) throw new Error("Erro Claude API: " + (data.error.message || JSON.stringify(data.error)));
  return {
    texto: (data.content && data.content[0] && data.content[0].text) || null,
    truncou: data.stop_reason === "max_tokens"
  };
}

function instrucaoContinuarExtracaoArquivo(trechoFinal) {
  return "Você já extraiu/transcreveu o trecho abaixo a partir deste MESMO documento (é a mesma extração continuando — não é um novo pedido, e não repita os campos TIPO_DOCUMENTO/NOME_PESSOA já identificados no início, se houver). NÃO repita esse trecho — continue EXATAMENTE de onde ele parou, sem reintroduções.\n\nTRECHO JÁ ESCRITO (final dele):\n..." + trechoFinal + "\n\nCONTINUE A PARTIR DAQUI:";
}

function unirTextoExtracaoArquivo(a, b) {
  if (!a) return b || "";
  if (!b) return a;
  var precisaEspaco = !/\s/.test(a.slice(-1)) && !/\s/.test(b.slice(0, 1));
  return a + (precisaEspaco ? " " : "") + b;
}

// Mesma ideia de extrairComContinuacao em api/extrair-texto-arquivo.js:
// chama de novo enquanto bater no teto de tokens, até completar ou esgotar
// EXTRACAO_ARQUIVO_MAX_PASSADAS (nesse caso raro, truncou continua true).
function extrairArquivoComContinuacao(montarConteudo) {
  var texto = "";
  var truncou = false;
  for (var i = 0; i < EXTRACAO_ARQUIVO_MAX_PASSADAS; i++) {
    var r = chamarClaudeArquivoRaw(montarConteudo(i, texto));
    if (!r.texto) break;
    texto = unirTextoExtracaoArquivo(texto, r.texto);
    truncou = r.truncou;
    if (!truncou) break;
  }
  return { texto: texto || null, truncou: truncou };
}

function extrairTextoArquivoJob(dados) {
  var jobId = dados.jobId;
  try {
    var base64 = dados.base64 || "";
    var mimetype = dados.mimetype || "application/pdf";
    var preservarIntegral = !!dados.preservarIntegral;
    if (!base64) throw new Error("Arquivo vazio");

    var blocoArquivo = mimetype === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: mimetype, data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mimetype, data: base64 } };
    var instrucaoInicial = preservarIntegral
      ? "Este documento é uma escritura ou ato notarial já pronto. Transcreva o texto completo do documento, na íntegra, sem resumir, sem comentar e sem omitir nenhuma parte. Apenas o texto puro da minuta."
      : "Na primeira linha da resposta, identifique em poucas palavras o TIPO deste documento (ex: RG, CNH, Certidão de Nascimento, Certidão de Casamento, Certidão de Óbito, Matrícula do Imóvel, IPTU, Comprovante de Residência, Procuração, Contrato Social, Extrato Bancário, Guia de ITBI, Guia de ITCMD, etc.), no formato exato: \"TIPO_DOCUMENTO: <tipo>\". Depois, numa nova linha, transcreva com fidelidade as informações jurídicas relevantes deste documento: partes (nome, CPF, RG, estado civil, endereço), dados do imóvel (matrícula, endereço, área), valores, datas e qualquer dado importante para elaboração de minuta notarial. Não resuma nem selecione o que parece mais relevante — transcreva tudo que encontrar.";

    var resultado = extrairArquivoComContinuacao(function (pass, textoAteAqui) {
      return [
        blocoArquivo,
        { type: "text", text: pass === 0 ? instrucaoInicial : instrucaoContinuarExtracaoArquivo(textoAteAqui.slice(-1500)) }
      ];
    });

    if (jobId) {
      salvarJobFirebase(jobId, { status: "done", ok: true, texto: resultado.texto || "", truncou: resultado.truncou });
    }
    return resp({ ok: true });
  } catch (err) {
    if (jobId) {
      salvarJobFirebase(jobId, { status: "done", ok: false, erro: err.message });
    }
    return resp({ ok: false, erro: err.message });
  }
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
    if (acao === "excluir-pasta") return excluirPasta(dados);
    if (acao === "salvar-arquivo") return salvarArquivo(dados);
    if (acao === "criar-minuta-doc") return criarMinutaDoc(dados);
    if (acao === "gerar-e-criar-minuta") return gerarECriarMinuta(dados);
    if (acao === "extrair-texto-arquivo") return extrairTextoArquivoJob(dados);
    if (acao === "marcar-modelo") return marcarModelo(dados);
    if (acao === "sincronizar-evento-calendar") return sincronizarEventoCalendar(dados);
    if (acao === "excluir-evento-calendar") return excluirEventoCalendar(dados);
    return resp({ ok: false, erro: "Ação desconhecida" });
  } catch(err) {
    return resp({ ok: false, erro: err.message });
  }
}

// ── Calendar (compromisso "agendado" de cada caso) ─────────────────────────
// Usa o calendário principal da mesma conta Google que roda este Apps Script
// (a mesma do Drive). Cria o evento na primeira sincronização e, nas próximas,
// atualiza o mesmo evento (dados.eventId) em vez de duplicar.

function sincronizarEventoCalendar(dados) {
  try {
    var cal = CalendarApp.getDefaultCalendar();
    var inicio = new Date(dados.dataHora);
    var fim = new Date(inicio.getTime() + 60 * 60 * 1000); // duração padrão: 1h
    var titulo = (dados.nome || "Caso") + (dados.tipo ? " — " + dados.tipo : "");
    var descricao = dados.descricao || "";

    var evento = null;
    if (dados.eventId) {
      try { evento = cal.getEventById(dados.eventId); } catch (e) { evento = null; }
    }

    if (evento) {
      evento.setTitle(titulo);
      evento.setTime(inicio, fim);
      evento.setDescription(descricao);
    } else {
      evento = cal.createEvent(titulo, inicio, fim, { description: descricao });
    }

    return resp({ ok: true, eventId: evento.getId() });
  } catch (err) {
    return resp({ ok: false, erro: err.message });
  }
}

function excluirEventoCalendar(dados) {
  try {
    if (dados.eventId) {
      var cal = CalendarApp.getDefaultCalendar();
      var evento = cal.getEventById(dados.eventId);
      if (evento) evento.deleteEvent();
    }
    return resp({ ok: true });
  } catch (err) {
    return resp({ ok: false, erro: err.message });
  }
}

function gerarECriarMinuta(dados) {
  var jobId = dados.jobId;

  try {
    var instrucoes = instrucoesPorTipo(dados.tipo);
    // A modalidade decide a abertura e o encerramento inteiros da escritura
    // (videoconferência × presencial). Não é assumida: um caso sem modalidade
    // definida falha aqui, com erro claro, em vez de sair como "digital"
    // calado numa escritura presencial.
    var MODALIDADES_VALIDAS = { digital: true, hibrida: true, presencial: true };
    var mod = String(dados.modalidade || "").toLowerCase();
    if (!MODALIDADES_VALIDAS[mod]) {
      throw new Error("Modalidade do ato não informada — escolha Digital, Híbrida ou Presencial antes de gerar a minuta.");
    }
    var ano = new Date().getFullYear();
    var documentosTexto = dados.documentos || "Nenhum documento fornecido ainda.";
    // Limite de segurança generoso: a causa real da demora era o envio cortado
    // pela metade (já corrigido no iniciar-minuta.js), não o tamanho do texto —
    // a IA lê o texto de entrada rápido; quem demora é a geração da resposta,
    // que já tem limite (max_tokens). Este limite aqui só evita casos extremos.
    if (documentosTexto.length > 100000) {
      documentosTexto = documentosTexto.slice(0, 100000) + "\n\n[...texto truncado por limite de tamanho...]";
    }

    // Se a equipe não enviou um modelo explícito ("MODELO" no WhatsApp) nem uma
    // MINUTA ATUAL a seguir à risca, busca automaticamente o último modelo
    // aprendido para esse tipo de ato. Com MINUTA ATUAL presente, NÃO soma modelo
    // de estilo — misturaria a regra de "não copiar dados" com a de "seguir à risca".
    if (documentosTexto.indexOf("MODELO DE MINUTA (REFERÊNCIA") === -1 && documentosTexto.indexOf("MINUTA ATUAL") === -1) {
      var modeloAprendido = buscarModeloAprendido(dados.tipo);
      if (modeloAprendido) {
        documentosTexto += "\n\n=== MODELO DE MINUTA (REFERÊNCIA APRENDIDA AUTOMATICAMENTE) — " + (dados.tipo || "") + " ===\n" + modeloAprendido.texto;
      }
    }

    // Tipo de ato estruturado (Etapa 3): zero ou mais atos secundários lavrados
    // na MESMA escritura do tipo principal — ver lib/tipos-de-ato.js. Substitui
    // o antigo "tipo composto" em texto livre ("Escritura + Confissão de
    // Dívida"), que só casava com metade das listas de checklist/abreviação.
    var atosSecundarios = Array.isArray(dados.atosSecundarios) ? dados.atosSecundarios.filter(Boolean) : [];

    var mensagemBase = "CASO: " + (dados.nome || "Não informado") + "\n" +
      "TIPO DE ATO: " + (dados.tipo || "Não informado") + "\n" +
      (atosSecundarios.length ? "ATOS SECUNDÁRIOS LAVRADOS NA MESMA ESCRITURA: " + atosSecundarios.join(", ") + "\n" : "") +
      "MODALIDADE: " + mod.toUpperCase() + "\n" +
      (instrucoes ? instrucoes + "\n" : "") +
      "OBSERVAÇÕES DO CASO: " + (dados.obs || "Nenhuma") + "\n" +
      (dados.instrucao ? "\nINSTRUÇÃO DE ATUALIZAÇÃO DA MINUTA: " + dados.instrucao + "\n" : "") +
      "\nDOCUMENTOS E INFORMAÇÕES FORNECIDAS:\n" +
      documentosTexto +
      (documentosTexto.indexOf("MINUTA ATUAL") !== -1
        ? "\n\nPor favor, ATUALIZE a MINUTA ATUAL acima conforme a INSTRUÇÃO DE ATUALIZAÇÃO DA MINUTA, reproduzindo-a por inteiro e ajustando concordância onde a mudança pedida exigir, conforme as instruções do sistema."
        : "\n\nPor favor, gere a minuta completa conforme as informações disponíveis, usando a abertura e o encerramento correspondentes à modalidade " + mod.toUpperCase() + " conforme as instruções do sistema.");

    // Quando há um modelo de referência (manual ou aprendido automaticamente) OU
    // uma MINUTA ATUAL sendo seguida à risca, a IA tende a "achar" que terminou
    // cedo demais (parar em ~1/3 do conteúdo) — ver temModelo em processarRodadaMinuta.
    var temModelo = mensagemBase.indexOf("MODELO DE MINUTA (REFERÊNCIA") !== -1 || mensagemBase.indexOf("MINUTA ATUAL") !== -1;

    // Curadoria (Etapa 2): NÃO aprende sozinho mais. Toda minuta gerada virava
    // modelo antes — boa ou ruim — e é a explicação mais provável de "a minuta
    // não segue os modelos". Agora só entra quando ela mesma marca uma minuta
    // pronta como modelo (ação "marcar-modelo", ver marcarModelo acima).

    // A primeira rodada roda aqui mesmo, na mesma execução — é rápida (uma
    // chamada à IA) e mantém o comportamento de sempre para o caso comum (1-2
    // rodadas). Se precisar de mais, processarRodadaMinuta agenda a próxima
    // rodada por gatilho em vez de continuar aqui — ver o comentário grande
    // logo antes de agendarContinuacaoMinuta.
    processarRodadaMinuta(jobId, {
      ano: ano,
      mensagemBase: mensagemBase,
      temModelo: temModelo,
      mod: mod,
      documentosTexto: documentosTexto,
      textoAcumulado: "",
      rodadas: 0,
      nome: dados.nome,
      tipo: dados.tipo,
      casoId: dados.casoId,
      notificarWhatsApp: dados.notificarWhatsApp,
      avisosDocumentos: dados.avisosDocumentos
    });

    return resp({ ok: true, emAndamento: true });

  } catch(err) {
    if (jobId) {
      salvarJobFirebase(jobId, { status: "done", ok: false, erro: err.message });
    }
    if (dados.notificarWhatsApp) {
      enviarWhatsApp("⚠️ Não consegui gerar a minuta de " + (dados.nome || "caso") + " agora: " + err.message + ". Tente pedir de novo.");
    }
    return resp({ ok: false, erro: err.message });
  }
}

// ── Criar pasta ────────────────────────────────────────────────────────────

function criarPasta(dados) {
  var nomeCliente = (dados.nome || "Sem nome").toUpperCase();
  var pastaCliente = getPastaCliente(nomeCliente);
  return resp({ ok: true, url: pastaCliente.getUrl() });
}

// ── Excluir pasta ──────────────────────────────────────────────────────────
// Manda a pasta do caso para a LIXEIRA do Drive (setTrashed), não apaga de
// vez: a lixeira segura por 30 dias, então um clique errado continua sendo
// reversível pelo próprio Drive, sem precisar de backup nenhum aqui.
// Aceita o link (é o que o painel guarda em driveUrl) ou o id direto.
function excluirPasta(dados) {
  var id = extrairIdPasta(dados.folderId || dados.folderUrl || "");
  if (!id) return resp({ ok: false, erro: "Não reconheci o link da pasta." });
  var pasta = DriveApp.getFolderById(id);
  var nome = pasta.getName();
  pasta.setTrashed(true);
  return resp({ ok: true, nome: nome });
}

// Formatos que aparecem na prática: .../folders/ID, .../folders/ID?usp=...,
// ...open?id=ID, ou o id colado sozinho.
function extrairIdPasta(referencia) {
  var s = String(referencia || "").trim();
  if (!s) return "";
  var m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s;
  return "";
}

// ── Salvar arquivo ─────────────────────────────────────────────────────────

function salvarArquivo(dados) {
  var nomeCliente = (dados.nome || "Sem nome").toUpperCase();
  var nomeArquivo = dados.nomeArquivo || "documento";
  var base64 = dados.base64 || "";
  var mimetype = dados.mimetype || "application/octet-stream";

  var pastaCliente = getPastaCliente(nomeCliente);

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
  var pastaCliente = getPastaCliente(nomeCliente);

  var nomeDoc = "MINUTA - " + abreviarTipoAto(dados.tipo) + " - " + dados.nome;

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
  // Negrito com número ÍMPAR de "**" na linha (a IA abriu e não fechou, ou
  // fechou numa linha diferente — mais fácil de acontecer agora que o negrito
  // é pedido em muito mais lugares, ver FORMATAÇÃO DA MINUTA) nunca pode virar
  // asterisco literal no documento: essa linha perde o negrito (fica só
  // texto normal) em vez de arriscar mostrar "**" pra ela.
  if (((textoMd.match(/\*\*/g) || []).length) % 2 !== 0) textoMd = textoMd.split("**").join("");

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
