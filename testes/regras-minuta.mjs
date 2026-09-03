// O guarda-corpo da pesquisa de regras de elaboração de minuta, sem rede e
// sem navegador.
//
// Roda com: node testes/regras-minuta.mjs
//
// A mesma lição do Radar: documento marcado "dispensado" sem fundamento é o
// erro que quase deixou o ITCMD passar batido, e aqui o preço é maior porque
// o resultado alimenta a minuta direto, não só um relatório que alguém lê
// antes de agir. Isto testa só a peneira (lib/regras-minuta-triagem.js) — o
// resto (api/pesquisar-regras-minuta.js) fala com fontes de verdade e não dá
// pra testar sem internet.
import {createRequire} from 'node:module';
import {writeSync} from 'node:fs';

const require = createRequire(import.meta.url);
const {conferirDocumento, conferirRegrasMinuta} = require('../lib/regras-minuta-triagem.js');
const {TIPOS_PRINCIPAIS} = require('../lib/tipos-de-ato.js');
const {FONTES_BASE, fontesParaTipo} = require('../lib/regras-minuta-fontes.js');

const diga = t => writeSync(1, t + '\n');
const erros = [];
const passo = (n, f) => {
  try { f(); diga('  ok  ' + n); }
  catch (e) { erros.push(n + ' → ' + e.message); diga('FALHA ' + n + ' → ' + e.message); }
};
const igual = (a, b, m) => { if (a !== b) throw new Error((m || '') + ' → ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b)); };
const ok = (cond, m) => { if (!cond) throw new Error(m); };

diga('\n— conferirDocumento: o critério do ITCMD, por documento —');

passo('documento "dispensado" com fundamento passa como está', () => {
  const d = conferirDocumento({nome: 'CND federal', situacao: 'dispensado', fundamento: 'CNJ · PCA 0001611-12.2023.2.00.0000'});
  igual(d.situacao, 'dispensado');
  ok(!d.rebaixado, 'não devia ter sido rebaixado');
});

passo('documento "dispensado" SEM fundamento é rebaixado a "a confirmar"', () => {
  const d = conferirDocumento({nome: 'Certidão X', situacao: 'dispensado', fundamento: null});
  igual(d.situacao, 'a confirmar');
  ok(d.rebaixado === true, 'devia ter marcado rebaixado');
  ok(/sem fundamento/.test(d.observacao), 'a observação devia explicar o rebaixamento');
});

passo('situação desconhecida cai em "a confirmar", nunca trava', () => {
  igual(conferirDocumento({nome: 'X', situacao: 'sei-la'}).situacao, 'a confirmar');
  igual(conferirDocumento({}).situacao, 'a confirmar');
});

diga('\n— conferirRegrasMinuta: o resultado inteiro —');

passo('documento rebaixado aparece em atencao, não fica escondido', () => {
  const r = conferirRegrasMinuta({
    documentos: [{nome: 'Certidão de óbito', situacao: 'dispensado', fundamento: null}]
  });
  ok(r.atencao.some(a => /Certidão de óbito/.test(a)), 'o rebaixamento não apareceu em atencao');
});

passo('vedação (naoPodeConstar) sem fundamento também vira atencao', () => {
  const r = conferirRegrasMinuta({
    naoPodeConstar: [{texto: 'Cláusula de renúncia genérica a direitos futuros', fundamento: ''}]
  });
  ok(r.atencao.some(a => /Vedação sem fundamento/.test(a)), 'vedação sem fundamento não foi sinalizada');
});

passo('"pode constar" que fala em dispensa sem fundamento vira atencao', () => {
  const r = conferirRegrasMinuta({
    podeConstar: [{texto: 'A certidão fica dispensada nesse caso', fundamento: ''}]
  });
  ok(r.atencao.some(a => /fala em dispensa\/liberação sem fundamento/.test(a)), 'não sinalizou a dispensa sem base');
});

passo('resultado vazio não trava — listas nascem vazias, nunca undefined', () => {
  const r = conferirRegrasMinuta({});
  igual(r.documentos.length, 0);
  igual(r.podeConstar.length, 0);
  igual(r.naoPodeConstar.length, 0);
  igual(r.fundamentos.length, 0);
  ok(Array.isArray(r.atencao), 'atencao devia ser array mesmo vazio');
});

passo('documento com fundamento e situação válida não gera aviso à toa', () => {
  const r = conferirRegrasMinuta({
    documentos: [{nome: 'Matrícula atualizada', situacao: 'exigido', fundamento: 'NSCGJ/SP'}]
  });
  igual(r.atencao.length, 0, 'não devia ter gerado atencao sem motivo');
});

diga('\n— As fontes: mesmas instituições do Radar, procurar montado por tipo —');

passo('toda fonte tem id e diz se é primária', () => {
  FONTES_BASE.forEach(f => {
    ok(f.id, 'fonte sem id');
    ok(typeof f.primaria === 'boolean', `${f.id} não diz se é primária`);
  });
});

passo('fontesParaTipo monta o "procurar" com o tipo de ato pedido, sem mexer na lista base', () => {
  const fontes = fontesParaTipo('Escritura de Compra e Venda');
  igual(fontes.length, FONTES_BASE.length);
  ok(fontes.every(f => f.procurar.includes('Escritura de Compra e Venda')), 'o tipo não apareceu no procurar de alguma fonte');
  ok(!('procurar' in FONTES_BASE[0]), 'fontesParaTipo não devia mutar FONTES_BASE');
});

passo('a lista fechada de tipos de ato (lib/tipos-de-ato.js) é a mesma que a pesquisa valida', () => {
  ok(TIPOS_PRINCIPAIS.length >= 14, 'a lista fechada parece menor do que devia');
});

diga('\n' + (erros.length ? `${erros.length} falha(s).` : 'Tudo certo.'));
if (erros.length) process.exit(1);
