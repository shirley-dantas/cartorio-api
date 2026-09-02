// A lista fechada de tipo de ato — Etapa 3 do trabalho de minutas. Nasceu de
// mapear as quatro listas que já existiam soltas no código (INSTRUCOES_POR_TIPO,
// ABREVIACOES_TIPO_ATO, ORC_ATOS e a classificarServico morta em salvar-caso.js)
// e confirmar com a Shirley o que sobra. Ficou de fora: Reconhecimento de Firma,
// Autenticação, Alienação Fiduciária e Regularização Imobiliária — são serviço de
// balcão, nunca viram card. Usucapião entrou porque esse sim vira card.
//
// Cada card tem UM tipo principal (a lista abaixo) e ZERO OU MAIS atos
// secundários — o mesmo ato pode aparecer nas duas listas (ex: Procuração):
// sozinho, ele é o principal do card; lavrado junto de uma escritura, ele é
// secundário. "Escritura + Confissão de Dívida" deixa de precisar existir como
// tipo composto: é Escritura de Compra e Venda (principal) com Confissão de
// Dívida marcada como secundário do mesmo card.
const TIPOS_PRINCIPAIS = [
  "Escritura de Compra e Venda",
  "Doação",
  "Inventário",
  "Divórcio",
  "União Estável",
  "Procuração",
  "Renúncia",
  "Cessão de Direitos",
  "Pacto Antenupcial",
  "Testamento",
  "Ata Notarial",
  "Dação em Pagamento",
  "Escritura Declaratória",
  "Usucapião"
];

const ATOS_SECUNDARIOS = [
  "Confissão de Dívida",
  "Garantia (alienação fiduciária ou hipoteca)",
  "Novação",
  "Usufruto",
  "Cláusula Resolutiva",
  "Procuração (com ou sem valor econômico)",
  "Ata Notarial",
  "Escritura sem Valor Declarado",
  "Convenção de Condomínio"
];

module.exports = { TIPOS_PRINCIPAIS, ATOS_SECUNDARIOS };
