// As fontes que a pesquisa de regras de minuta varre — mesmas instituições do
// Radar Jurídico (lib/radar-fontes.js), porque são as mesmas que regem o
// cartório. A diferença é o que se procura: o Radar lê a manchete do dia,
// isto aqui procura, dentro de cada fonte, o que rege UM tipo de ato
// específico — por isso o campo `procurar` é montado na hora, por
// `fontesParaTipo`, em vez de fixo.
//
// `primaria: false` é fonte de alerta: dá vocabulário e contexto, mas o
// prompt (lib/regras-minuta-prompt.js) sabe que ela nunca fundamenta uma
// exigência sozinha.

const FONTES_BASE = [
  {
    id: 'tjsp-cgj',
    nome: 'TJSP · Normas de Serviço da Corregedoria Geral da Justiça',
    url: 'https://www.tjsp.jus.br/Corregedoria',
    primaria: true
  },
  {
    id: 'cnj',
    nome: 'CNJ · Código Nacional de Normas do Foro Extrajudicial',
    url: 'https://www.cnj.jus.br/',
    primaria: true
  },
  {
    id: 'sefaz-sp',
    nome: 'SEFAZ/SP · ITCMD',
    url: 'https://portal.fazenda.sp.gov.br/',
    primaria: true
  },
  {
    id: 'pmsp',
    nome: 'Prefeitura de São Paulo · ITBI',
    url: 'https://prefeitura.sp.gov.br/',
    primaria: true
  },
  {
    id: 'cnbsp',
    nome: 'Colégio Notarial do Brasil · Seção São Paulo',
    url: 'https://cnbsp.org.br/',
    primaria: false
  },
  {
    id: 'anoregsp',
    nome: 'ANOREG/SP',
    url: 'https://www.anoregsp.org.br/',
    primaria: false
  }
];

// Monta a lista de fontes com o `procurar` específico do tipo de ato — é essa
// frase que entra na mensagem mandada pra IA, dizendo o que interessa dentro
// de cada fonte para ESTE tipo, não para os outros treze.
function fontesParaTipo(tipoAto) {
  const alvo = `documentos exigidos, dispensas e vedações para "${tipoAto}"`;
  return FONTES_BASE.map(f => Object.assign({}, f, { procurar: alvo }));
}

module.exports = { FONTES_BASE, fontesParaTipo };
