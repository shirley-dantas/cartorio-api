// As certidões do imóvel na Prefeitura de SP, etapa 1: o painel lê o contribuinte na matrícula e pede conferência.
//   node testes/prefeitura.mjs
// Os três textos abaixo são trechos REAIS de matrículas que ela mandou (29/10/2026): contribuinte em área maior com barra no dígito, alteração do
// número numa averbação (e uma "certidão nº 130.389/94-3" que parece contribuinte e não é), e área maior de condomínio HIS.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const AQUI = dirname(fileURLToPath(import.meta.url)), html = readFileSync(join(AQUI, '..', 'index.html'), 'utf8');
const erros = [];
const passo = async (n, f) => { try { await f(); console.log('  ok  ' + n); } catch (e) { erros.push(n); console.log('FALHA ' + n + ' → ' + (e && e.message)); } };
const ini = html.indexOf('// ── As certidões do imóvel na Prefeitura de São Paulo'), fim = html.indexOf('// ── fim: as certidões da prefeitura ──');
assert(ini > 0 && fim > ini, 'não achei o bloco da prefeitura');
const docs = html.slice(html.indexOf('function onrDocsDaMatricula'), html.indexOf('function onrDoCaso'));
const T136 = 'matrícula 79.253 ficha 01 São Paulo, 16 de setembro de 1985\nIMÓVEL: O APARTAMENTO Nº 136 - DUPLEX, TIPO "C", localizado nos 13º e 14º andares, de EDIFÍCIO "VILLAGE MORUMBI", à AVENIDA GIOVANNI GRONCHI, nº 4.381, no 13º Subdistrite - Butantã, com a área útil de 57,13m2. (Contribuinte 170.049.0003/6 em maior área).\n\nAv.2 em 25 de julho de 1994\nALTERAÇÃO DO NÚMERO DE CONTRIBUINTE\nProcede-se esta averbação, à vista da Carta de Sentença referida no R.4, para constar que o imóvel objeto da presente matrícula, atualmente vem sendo lançado pelo contribuinte nº. 170.049.0162-8, conforme prova a certidão nº 130.389/94-3, expedida em 7 de junho de 1994, pela Prefeitura desta Capital.\nO Escrevente Autorizado, Mauricio Gonçalves de Alvim';
const T2007 = 'matrícula 181.816 ficha 01 CNM 111138.2.0181816-25\nImóvel: O APARTAMENTO nº 2007 (HIS-2), localizado no 20° pavimento do SETOR RESIDENCIAL do Condomínio "DO IT PINHEIROS", à Rua FERNÃO DIAS, nº 370, no 45° subdistrito, Pinheiros, CEP nº 05427-000, cabendo-lhe a fração ideal de 0,0015930 no terreno descrito na matrícula nº 151.932, na qual sob nº 36 foi registrada a instituição e especificação parcial do condomínio, tendo sido a convenção registrada sob nº 16.777 no Livro nº 3 - Auxiliar desta Serventia.\nContribuinte: 083.042.0161-5, em área maior.';
function mundo(documentos = {}) {
  const ctx = {escTxt: (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])), esc: (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])), casos: {C1: {id: 'C1', documentos}}, document: {getElementById: () => null}, window: {}};
  vm.createContext(ctx); vm.runInContext(docs + '\n' + html.slice(ini, fim) + '\nthis.__f={prefExtrair,prefDocsDoCaso,prefFaixaHtml};', ctx); return ctx;
}
await passo('caso da alteração: acha os dois contribuintes, o da averbação é o atual, e a certidão nº 130.389/94-3 NÃO é contribuinte', () => {
  const x = mundo().__f.prefExtrair(T136);
  assert.deepEqual(Array.from(x.contribuintes.map((k) => k.sql)), ['170.049.0003-6', '170.049.0162-8'], JSON.stringify(x.contribuintes));
  assert.equal(x.contribuintes[0].areaMaior, true); assert.equal(x.contribuintes[1].areaMaior, false);
  assert.equal(x.contribuintes[0].onde, 'descrição do imóvel'); assert.equal(x.contribuintes[1].onde, 'Av.2', 'a citação "referida no R.4," não vira o lugar do número');
  assert.equal(x.contribuintes[1].alteracao, true); assert.equal(x.atual, 1);
  assert.equal(x.unidade.numero, '136'); assert.equal(x.unidade.compl, 'AP 136');
});
await passo('caso da área maior (HIS): um contribuinte, em área maior, o atual; a unidade é o apartamento 2007 → "AP 2007"; números de matrícula, CEP e livro não viram contribuinte', () => {
  const x = mundo().__f.prefExtrair(T2007);
  assert.deepEqual(Array.from(x.contribuintes.map((k) => k.sql)), ['083.042.0161-5']); assert.equal(x.contribuintes[0].areaMaior, true); assert.equal(x.atual, 0);
  assert.equal(x.unidade.compl, 'AP 2007'); assert.equal(x.unidade.tipo, 'apartamento');
});
await passo('o mesmo número repetido entra uma vez; sem contribuinte, sem chute; tipo de unidade sem regra da prefeitura fica sem complemento', () => {
  const f = mundo().__f;
  const x = f.prefExtrair('Contribuinte 083.042.0161-5 em área maior.\nAv.3 em 10 de maio de 2000 contribuinte 083.042.0161-5.'); assert.equal(x.contribuintes.length, 1); assert.equal(x.contribuintes[0].areaMaior, true);
  const y = f.prefExtrair('A SALA nº 12 do edifício, sem número nenhum.'); assert.equal(y.contribuintes.length, 0); assert.equal(y.atual, -1); assert.equal(y.unidade.compl, '');
  assert.equal(f.prefExtrair('').unidade, null);
});
await passo('a faixa do card: lista os contribuintes com o lugar, marca o atual, avisa a área maior e a necessidade de consultar a individualização; nada é escolhido sozinho', () => {
  const m = mundo({a: {tipo: 'documento', tipoDocumento: 'MATRICULA_IMOVEL', nome: 'Matricula_181816.pdf', texto: T2007}, b: {tipo: 'documento', tipoDocumento: 'MATRICULA_IMOVEL', nome: 'Matricula_79253.pdf', texto: T136}});
  const h = m.__f.prefFaixaHtml(m.casos.C1);
  for (const t of ['083.042.0161-5', '170.049.0003-6', '170.049.0162-8', 'Av.2', 'alteração do número', 'em área maior', 'o último da matrícula', 'AP 2007', 'confira contra o papel']) assert(h.includes(t), 'falta ' + t);
  assert(/consultar na prefeitura se já foi individualizado/.test(h) && /Contribuinte individual/.test(h));
  assert.equal((h.match(/type="radio"/g) || []).length, 3); assert.equal((h.match(/checked/g) || []).length, 2, 'um marcado por matrícula (o último), para ela conferir');
});
await passo('sem matrícula no card, a faixa não aparece; texto da matrícula nunca vira HTML', () => {
  assert.equal(mundo().__f.prefFaixaHtml({id: 'C1', documentos: {}}), '');
  const m = mundo({a: {tipo: 'documento', tipoDocumento: 'MATRICULA_IMOVEL', nome: '<img src=x onerror=1>.pdf', texto: 'O APARTAMENTO nº 5. Contribuinte 083.042.0161-5.'}});
  const h = m.__f.prefFaixaHtml(m.casos.C1); assert(!/<img src=x/.test(h) && h.includes('&lt;img'));
});
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
