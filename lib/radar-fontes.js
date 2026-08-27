// As fontes que o Radar Jurídico varre toda manhã.
//
// A ordem aqui é a ordem de importância, e ela não é decorativa: quando a
// varredura estoura o tempo da função (ou uma fonte não responde), o que
// sobra é o começo da lista. Corregedoria de SP e CNJ vêm primeiro porque
// são as duas que mudam a rotina da mesa no dia seguinte.
//
// `primaria: false` marca fonte de alerta — ANOREG e CNB avisam antes, mas
// quem confirma é o texto oficial. O prompt do Radar sabe dessa diferença e
// nunca deixa uma notícia virar norma sozinha.
//
// `direto: true` é o achado do teste manual: a ANOREG/SP não aparece em
// busca genérica, tem que ser lida na cara do site. Como todas aqui são
// lidas por fetch direto, o campo hoje é só documentação de por que não
// existe um caminho "por buscador" — se um dia existir, ele começa aqui.

const FONTES_RADAR = [
  {
    id: 'tjsp-cgj',
    nome: 'TJSP · Corregedoria Geral da Justiça',
    url: 'https://www.tjsp.jus.br/Corregedoria',
    prioridade: 'maxima',
    primaria: true,
    direto: true,
    procurar: 'Normas de Serviço, Provimentos e Comunicados que alcancem Tabelionato de Notas'
  },
  {
    id: 'cnj',
    nome: 'CNJ · Corregedoria Nacional de Justiça',
    url: 'https://www.cnj.jus.br/',
    prioridade: 'maxima',
    primaria: true,
    direto: true,
    procurar: 'Provimentos, Resoluções e o Código Nacional de Normas do Foro Extrajudicial'
  },
  {
    id: 'cnbsp',
    nome: 'Colégio Notarial do Brasil · Seção São Paulo',
    url: 'https://cnbsp.org.br/',
    prioridade: 'maxima',
    // Não é fonte primária, mas antecipa: foi o CNB que provocou no CNJ a
    // mudança do ITCMD. O que aparece aqui costuma virar norma depois.
    primaria: false,
    direto: true,
    procurar: 'Pedidos e representações do notariado que possam virar norma'
  },
  {
    id: 'anoregsp',
    nome: 'ANOREG/SP',
    url: 'https://www.anoregsp.org.br/',
    prioridade: 'alta',
    primaria: false,
    direto: true,
    procurar: 'Alerta e contexto — confirmar sempre na fonte primária'
  },
  {
    id: 'sefaz-sp',
    nome: 'SEFAZ/SP · ITCMD',
    url: 'https://portal.fazenda.sp.gov.br/',
    prioridade: 'maxima',
    primaria: true,
    direto: true,
    procurar: 'ITCMD: alíquota, base de cálculo, declaração, isenção, prazo'
  },
  {
    id: 'pmsp',
    nome: 'Prefeitura de São Paulo · ITBI',
    url: 'https://prefeitura.sp.gov.br/',
    prioridade: 'maxima',
    primaria: true,
    direto: true,
    procurar: 'ITBI: guia, base de cálculo, valor venal de referência'
  },
  {
    id: 'legis-sp',
    nome: 'Legislação Municipal de São Paulo',
    url: 'https://legislacao.prefeitura.sp.gov.br/',
    prioridade: 'alta',
    primaria: true,
    direto: true,
    procurar: 'Leis e decretos municipais sobre ITBI, HIS/HMP e emolumentos'
  },
  {
    id: 'doe-sp',
    nome: 'Diário Oficial do Estado de São Paulo',
    url: 'https://www.doe.sp.gov.br/',
    prioridade: 'alta',
    primaria: true,
    direto: true,
    procurar: 'Publicações do dia que citem os termos filtrados'
  },
  {
    id: 'stj',
    nome: 'STJ',
    url: 'https://www.stj.jus.br/',
    prioridade: 'media',
    primaria: true,
    direto: true,
    procurar: 'Sucessões, inventário, partilha, doação, imóveis, procurações e responsabilidade civil de notários'
  },
  {
    id: 'stf',
    nome: 'STF',
    url: 'https://portal.stf.jus.br/',
    prioridade: 'media',
    primaria: true,
    direto: true,
    procurar: 'ITBI, ITCMD, imunidades, transmissão de bens e sucessão'
  }
];

// O filtro do Diário Oficial. Serve também de peneira geral: página que não
// encosta em nenhum destes termos quase nunca interessa à mesa.
const TERMOS_RADAR = [
  'Tabelionato de Notas',
  'extrajudicial',
  'notarial',
  'registral',
  'Corregedoria Geral da Justiça',
  'Provimento',
  'ITCMD',
  'Secretaria da Fazenda',
  'serventias extrajudiciais'
];

module.exports = { FONTES_RADAR, TERMOS_RADAR };
