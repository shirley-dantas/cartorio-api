// ══ O GUARDA-CORPO DA PESQUISA DE REGRAS DE MINUTA ═══════════════════════
//
// A mesma lição do Radar (lib/radar-triagem.js), aplicada a documento em vez
// de novidade do dia: regra que só existe no prompt depende de o modelo ter
// lembrado dela naquela pesquisa. Documento marcado "dispensado" sem
// fundamento é exatamente o erro que quase deixou o ITCMD passar batido — e
// aqui o preço de errar é maior, porque o resultado alimenta a minuta
// diretamente, não só um relatório que a escrevente lê antes de agir.
//
// Fica num arquivo à parte porque é a parte testável sem rede
// (testes/regras-minuta.mjs). O resto (api/pesquisar-regras-minuta.js) é
// conversa com o mundo: sem internet não roda, e sem rodar não se testa.

const { lerJson, chaveDoTema, FALA_EM_DISPENSA } = require('./radar-triagem');

// Documento sem fundamento não pode virar "dispensado" — vira "a confirmar",
// e a razão entra em `atencao` para não sumir da tela. Mesma regra do
// `conferirItem` do Radar, adaptada de novidade do dia para item de checklist.
function conferirDocumento(doc) {
  const d = Object.assign({ nome: '', situacao: 'a confirmar', observacao: '', fundamento: null }, doc);
  const situacoesValidas = ['exigido', 'dispensado', 'depende', 'a confirmar'];
  if (!situacoesValidas.includes(d.situacao)) d.situacao = 'a confirmar';
  d.fundamento = d.fundamento ? String(d.fundamento).trim() : null;
  if (d.situacao === 'dispensado' && !d.fundamento) {
    d.situacao = 'a confirmar';
    d.rebaixado = true;
    d.observacao = (d.observacao ? d.observacao + ' ' : '') +
      'A pesquisa apontou dispensa sem fundamento citado — rebaixado para conferir antes de aplicar.';
  }
  return d;
}

// O mesmo teste do Radar (FALA_EM_DISPENSA) aplicado às listas de texto livre
// (podeConstar/naoPodeConstar/resumo): frase que fala em dispensa/liberação
// sem nenhum fundamento na pesquisa é sinal de a IA ter completado sozinha.
function itemFalaEmDispensaSemFundamento(item) {
  const texto = String((item && item.texto) || '');
  const fundamento = String((item && item.fundamento) || '').trim();
  return FALA_EM_DISPENSA.test(texto) && !fundamento;
}

// Confere o resultado inteiro da pesquisa de um tipo de ato. Nunca lança —
// quem chama decide o que fazer com os avisos.
function conferirRegrasMinuta(bruto) {
  const r = Object.assign({}, bruto);
  r.resumo = String(r.resumo || '').trim();
  r.documentos = (Array.isArray(r.documentos) ? r.documentos : []).map(conferirDocumento);
  r.podeConstar = Array.isArray(r.podeConstar) ? r.podeConstar : [];
  r.naoPodeConstar = Array.isArray(r.naoPodeConstar) ? r.naoPodeConstar : [];
  r.etapas = Array.isArray(r.etapas) ? r.etapas : [];
  r.fundamentos = Array.isArray(r.fundamentos) ? r.fundamentos : [];
  r.atencao = Array.isArray(r.atencao) ? r.atencao.slice() : [];
  r.fontesUsadas = Array.isArray(r.fontesUsadas) ? r.fontesUsadas : [];
  r.fontesSemNada = Array.isArray(r.fontesSemNada) ? r.fontesSemNada : [];

  const rebaixados = r.documentos.filter(d => d.rebaixado).map(d => d.nome);
  if (rebaixados.length) {
    r.atencao.push('Rebaixado(s) para "a confirmar" por falta de fundamento na pesquisa: ' + rebaixados.join(', ') + '.');
  }

  r.naoPodeConstar.forEach(item => {
    // naoPodeConstar não corre o risco de "dispensa sem fundamento" (é o
    // oposto: veda algo) — mas uma vedação sem fundamento também não deveria
    // virar regra usada sem conferência.
    if (!String((item && item.fundamento) || '').trim()) {
      r.atencao.push('Vedação sem fundamento citado: "' + String((item && item.texto) || '').slice(0, 80) + '" — conferir antes de tratar como regra.');
    }
  });
  r.podeConstar.forEach(item => {
    if (itemFalaEmDispensaSemFundamento(item)) {
      r.atencao.push('Item de "pode constar" fala em dispensa/liberação sem fundamento: "' + String(item.texto).slice(0, 80) + '" — conferir.');
    }
  });

  return r;
}

module.exports = { conferirDocumento, conferirRegrasMinuta, itemFalaEmDispensaSemFundamento, lerJson, chaveDoTema };
