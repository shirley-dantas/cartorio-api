// A capa do dossiê: a folha de papel que acompanha o caso físico, impressa pelo card.
//   node testes/capa.mjs
// O que se prova: o que vem do card entra, o resto fica em branco para a caneta, o dinheiro só entra para quem está no Financeiro, a folha soma o
// total que imprime e cabe numa página A4 de verdade (medida no Chromium, com nome de arquivo comprido).
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {abrirChromium} from './navegador-de-teste.mjs';
const AQUI = dirname(fileURLToPath(import.meta.url)), html = readFileSync(join(AQUI, '..', 'index.html'), 'utf8');
const erros = [];
const passo = async (n, f) => { try { await f(); console.log('  ok  ' + n); } catch (e) { erros.push(n); console.log('FALHA ' + n + ' → ' + (e && e.message)); } };
const ini = html.indexOf('// ── A capa do dossiê ──'), fim = html.indexOf('// ── fim: a capa do dossiê ──');
assert(ini > 0 && fim > ini, 'não achei o bloco da capa no index.html');
const motor = html.slice(html.indexOf('function orcValoresDaCapa'), html.indexOf('// O valor do negócio, que é o que a cliente reconhece'));
const gabarito = {totais: {escritura: 417624, registroComDespesas: 313328, total: 1652221}, despesas: [{item: '12', valor: 8014}, {item: '11', valor: 7654}, {item: 'taxa', valor: 30000, interna: true}], tributos: [{valor: 905601}]};
function mundo({finAuth = true, orc = gabarito, casos = {}, mats = ['187852']} = {}) {
  const impressos = [], quadros = [];
  const ctx = {
    finAuth: finAuth ? {uid: 'u'} : null, casos,
    escTxt: (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])),
    esc: (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])),
    orcMoeda: (c) => 'R$ ' + (Number(c) / 100).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
    orcUltimoDoCaso: () => orc ? {resultado: orc} : null,
    onrDoCaso: () => mats.length ? [{matriculas: mats}] : [],
    document: {body: {appendChild: (q) => { quadros.push(q); setTimeout(() => q.onload && q.onload(), 0); }}, createElement: () => { const q = {style: {}, setAttribute() {}, remove() {}, contentWindow: {focus() {}, print() { impressos.push(q.srcdoc); }}}; return q; }},
    window: {}, setTimeout, console
  };
  vm.createContext(ctx); vm.runInContext(motor + '\n' + html.slice(ini, fim) + '\nthis.__f={capaDados,capaHtml,capaFaixaHtml,orcValoresDaCapa};', ctx);
  ctx.impressos = impressos; ctx.quadros = quadros; return ctx;
}
const card = (o = {}) => ({id: 'C1', nome: 'REN. - DR JULIO – DIVORCIO WAGNER E ANDREA', tipo: 'Divórcio', resp: 'shirley', agendado: '2026-10-30T14:30', registroPrenotado: 'R-12', prenotacao: '1.204.331', livro: '2', folha: '33', controle: '51 0034', ...o});

await passo('o que o card sabe entra: título, arquivo, escrevente, data e horário, registro, matrícula (do documento), livro, folha, prenotação, controle', () => {
  const m = mundo(); const h = m.__f.capaHtml(m.__f.capaDados(card()));
  for (const t of ['DIVÓRCIO', 'REN. - DR JULIO – DIVORCIO WAGNER E ANDREA', 'Shirley', '30/10/2026', '14:30', 'R-12', '187852', '1.204.331', '51 0034'])
    assert(h.includes(t), 'falta ' + t);
  assert(/<b>LIVRO<\/b><span>2<\/span>/.test(h) && /<b>FOLHA<\/b><span>33<\/span>/.test(h));
});
await passo('o resto fica em branco para a caneta: minuta, solicitante, outorgantes, outorgados, pendências, dias e rodapé', () => {
  const m = mundo(); const h = m.__f.capaHtml(m.__f.capaDados(card({agendado: '', resp: ''})));
  assert(/MINUTA Nº _{8,}/.test(h) && /DATA: ___\/___\/___/.test(h) && /HORÁRIO: _____/.test(h));
  assert(/<b>SOLICITANTE<\/b><span><\/span>/.test(h) && /<b>OUTORGANTE\(S\)<\/b><span><\/span>/.test(h) && /<b>OUTORGADO\(S\)<\/b><span><\/span>/.test(h));
  assert.equal((h.match(/class="p">☐/g) || []).length, 6); assert.equal((h.match(/class="dia"/g) || []).length, 7);
  for (const d of ['SEGUNDA', 'DOMINGO', 'ÚLTIMA ATUALIZAÇÃO', 'PRÓXIMO PASSO', 'RESPONSÁVEL / PRAZO']) assert(h.includes(d), d);
});
await passo('o orçamento do 1301 sai com os seis valores e a folha fecha o total impresso', () => {
  const m = mundo(); const h = m.__f.capaHtml(m.__f.capaDados(card()));
  for (const v of ['R$ 4.176,24', 'R$ 76,54', 'R$ 3.133,28', 'R$ 80,14', 'R$ 9.056,01', 'R$ 16.522,21']) assert(h.includes(v), 'falta ' + v);
  const d = m.__f.capaDados(card()); assert.equal(d.orc.outros, 0);
  assert.equal(d.orc.escritura + d.orc.matricula + d.orc.registro + d.orc.prenotacao + d.orc.imposto, d.orc.total);
});
await passo('outra despesa do ato vira "Outras despesas" — a folha continua somando o total', () => {
  const m = mundo({orc: {...gabarito, totais: {...gabarito.totais, total: gabarito.totais.total + 12345}}}); const d = m.__f.capaDados(card());
  assert.equal(d.orc.outros, 12345); const h = m.__f.capaHtml(d); assert(/Outras despesas/.test(h) && h.includes('R$ 123,45'));
  assert.equal(d.orc.escritura + d.orc.matricula + d.orc.registro + d.orc.prenotacao + d.orc.imposto + d.orc.outros, d.orc.total);
});
await passo('sem entrar no Financeiro, nenhum valor sai (o painel operacional não tem senha de propósito); sem orçamento, também em branco', () => {
  for (const o of [{finAuth: false}, {orc: null}]) {
    const m = mundo(o); const h = m.__f.capaHtml(m.__f.capaDados(card()));
    assert(!/R\$ \d/.test(h), 'vazou valor'); assert.equal((h.match(/R\$ ______/g) || []).length, 6);
  }
  assert(/entre no Financeiro/.test(mundo({finAuth: false}).__f.capaFaixaHtml(card()))); assert(/ainda não tem orçamento/.test(mundo({orc: null}).__f.capaFaixaHtml(card())));
});
await passo('texto do card nunca vira HTML (nome de arquivo com tag não executa)', () => {
  const m = mundo(); const h = m.__f.capaHtml(m.__f.capaDados(card({nome: '<img src=x onerror=alert(1)>', livro: '"><script>1</script>'})));
  assert(!/<img src=x/.test(h) && !/<script>1/.test(h)); assert(h.includes('&lt;img src=x'));
});
await passo('o botão está na faixa do card e imprime num quadro escondido, sem abrir janela', async () => {
  const m = mundo({casos: {C1: card()}}); assert(/capaImprimir\('C1'\)/.test(m.__f.capaFaixaHtml(card())) && /Imprimir capa/.test(m.__f.capaFaixaHtml(card())));
  m.window.capaImprimir('C1'); await new Promise((r) => setTimeout(r, 20));
  assert.equal(m.quadros.length, 1, 'um quadro escondido'); assert.equal(m.impressos.length, 1, 'mandou imprimir'); assert(m.impressos[0].includes('DIVÓRCIO') && m.impressos[0].includes('187852'), 'imprime a capa deste card');
});
await passo('a capa cabe numa página A4 de verdade, mesmo com nome de arquivo comprido e tudo preenchido', async () => {
  const m = mundo(); const longo = 'REN. - DR JULIO – DIVORCIO CONSENSUAL WAGNER FERREIRA MOREIRA KLEIN E ANDREA SORENI MOREIRA KLEIN COM PARTILHA DE DOIS IMÓVEIS E PENSÃO';
  const h = m.__f.capaHtml(m.__f.capaDados(card({nome: longo, matriculas: 1})));
  const nav = await abrirChromium(); try {
    const pg = await nav.newPage({viewport: {width: 794, height: 1123}}); await pg.setContent(h);
    const med = await pg.evaluate(() => { const f = document.querySelector('.fl'); return {sh: f.scrollHeight, ch: f.clientHeight, sw: f.scrollWidth, cw: f.clientWidth}; });
    assert(med.sh <= med.ch + 1, 'estourou a altura: ' + JSON.stringify(med)); assert(med.sw <= med.cw + 1, 'estourou a largura: ' + JSON.stringify(med));
    const pdf = await pg.pdf({format: 'A4', printBackground: true}); const paginas = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    assert.equal(paginas, 1, 'a capa passou de uma página: ' + paginas);
  } finally { await nav.close(); }
});
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
