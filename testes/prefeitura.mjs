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
function mundo(documentos = {}, {pref = false, tipo = 'Compra e venda', campos = {}} = {}) {
  const postadas = [], atualizadas = [], esc_ = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const ctx = {escTxt: esc_, esc: esc_, casos: {C1: {id: 'C1', tipo, documentos}}, location: {origin: 'https://cartorio-api.vercel.app'},
    document: {getElementById: (id) => (id in campos ? {value: campos[id]} : null)},
    AJUDANTE: {pronto: pref, pref, onr: pref, versao: '0.3.0', msg: {}, fila: {}, atual: {}, log: {}, rel: {}},
    ajudanteAtualizar: (id) => atualizadas.push(id), ajMsgHtml: () => '',
    window: {postMessage: (m) => postadas.push(m)}};
  vm.createContext(ctx); vm.runInContext(docs + '\n' + html.slice(ini, fim) + '\nthis.__f={prefExtrair,prefDocsDoCaso,prefFaixaHtml,prefPedirHtml};', ctx); ctx.postadas = postadas; ctx.atualizadas = atualizadas; return ctx;
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
const DOC = {a: {tipo: 'documento', tipoDocumento: 'MATRICULA_IMOVEL', nome: 'Matricula_79253.pdf', texto: T136}};
const DOC_AREA = {a: {tipo: 'documento', tipoDocumento: 'MATRICULA_IMOVEL', nome: 'Matricula_181816.pdf', texto: T2007}};
await passo('o botão do valor venal: sem o Ajudante novo avisa, com ele traz a data de hoje (e vazia no inventário); contribuinte em área maior fica sem botão', () => {
  assert(/instale o Ajudante do painel na versão 0\.3\.3/.test(mundo(DOC).__f.prefFaixaHtml(mundo(DOC).casos.C1)));
  const m = mundo(DOC, {pref: true}), h = m.__f.prefFaixaHtml(m.casos.C1), hoje = new Date();
  assert(/Valor venal de referência/.test(h) && /pref-data-C1-0/.test(h)); assert(h.includes(String(hoje.getFullYear())), 'a data de hoje já vem escrita'); assert(/É a data de hoje/.test(h));
  const inv = mundo(DOC, {pref: true, tipo: 'Inventário e partilha'}), hi = inv.__f.prefFaixaHtml(inv.casos.C1); assert(/id="pref-data-C1-0" value=""/.test(hi) && /digite a data do óbito/.test(hi));
  const am = mundo(DOC_AREA, {pref: true}), ha = am.__f.prefFaixaHtml(am.casos.C1); assert(!/Valor venal de referência<\/button>/.test(ha) && /ficam desligados enquanto o contribuinte escolhido estiver em área maior/.test(ha));
});
await passo('pedir o valor venal: manda ao Ajudante o contribuinte ESCOLHIDO e a data; recusa data vazia (inventário), inexistente e área maior — escrito, sem mandar nada', () => {
  const m = mundo(DOC, {pref: true, campos: {'pref-data-C1-0': '30/10/2026'}}); m.window.prefPedirValorVenal('C1', 0);
  assert.equal(m.postadas.length, 1); const p = m.postadas[0]; assert.equal(p.fonte, 'painel-cartorio'); assert.equal(p.tipo, 'ajudante-pedido');
  assert.equal(p.pedido.site, 'pref'); assert.equal(p.pedido.servico, 'valor-venal'); assert.equal(p.pedido.sql, '170.049.0162-8', 'o último da matrícula, que é o atual'); assert.equal(p.pedido.data, '30/10/2026'); assert.equal(p.pedido.casoId, 'C1');
  m.window.prefEscolher && 0; m.window.prefEscolher('C1', 0, 0); m.window.prefPedirValorVenal('C1', 0); assert.equal(m.postadas.length, 1, 'o antigo está em área maior: não pede');
  assert(/área maior/.test(m.AJUDANTE.msg.C1.texto));
  const inv = mundo(DOC, {pref: true, tipo: 'Inventário', campos: {'pref-data-C1-0': ''}}); inv.window.prefPedirValorVenal('C1', 0); assert.equal(inv.postadas.length, 0); assert(/data do óbito/.test(inv.AJUDANTE.msg.C1.texto));
  const ruim = mundo(DOC, {pref: true, campos: {'pref-data-C1-0': '31/02/2026'}}); ruim.window.prefPedirValorVenal('C1', 0); assert.equal(ruim.postadas.length, 0); assert(/uma data que exista/.test(ruim.AJUDANTE.msg.C1.texto));
});
await passo('pedir a negativa de IPTU: manda o contribuinte escolhido, sem data; recusa área maior', () => {
  assert(/Negativa de IPTU/.test(mundo(DOC, {pref: true}).__f.prefFaixaHtml(mundo(DOC, {pref: true}).casos.C1)) || true);
  const m = mundo(DOC, {pref: true}); m.window.prefPedirNegativa('C1', 0);
  assert.equal(m.postadas.length, 1); const p = m.postadas[0].pedido; assert.equal(p.site, 'pref'); assert.equal(p.servico, 'negativa-iptu'); assert.equal(p.sql, '170.049.0162-8'); assert.equal(p.data, undefined); assert.equal(p.casoId, 'C1');
  m.window.prefEscolher('C1', 0, 0); m.window.prefPedirNegativa('C1', 0); assert.equal(m.postadas.length, 1, 'em área maior não pede'); assert(/área maior/.test(m.AJUDANTE.msg.C1.texto));
  const h = mundo(DOC, {pref: true}); assert(/Negativa de IPTU<\/button>/.test(h.__f.prefFaixaHtml(h.casos.C1)) && /código da imagem/.test(h.__f.prefFaixaHtml(h.casos.C1)));
});
await passo('dados cadastrais no painel: sem campo de CPF/CNPJ nem exercício — só o botão; o pedido leva só o contribuinte (o proprietário é digitado por ela na prefeitura); recusa área maior', () => {
  const DOCD = {a: {tipo: 'documento', tipoDocumento: 'MATRICULA_IMOVEL', nome: 'M.pdf', texto: T136 + ' Proprietário CPF 529.982.247-25.'}};
  const m = mundo(DOCD, {pref: true}), h = m.__f.prefFaixaHtml(m.casos.C1);
  assert(/Dados cadastrais<\/button>/.test(h) && /e-gov/.test(h) && /CPF\/CNPJ do proprietário/.test(h)); assert(!/pref-doc-C1-0|pref-ex-C1-0|529\.982\.247-25/.test(h), 'nada de campo de CPF, exercício ou sugestão');
  m.window.prefPedirCadastrais('C1', 0);
  assert.equal(m.postadas.length, 1); const p = m.postadas[0].pedido; assert.equal(p.servico, 'dados-cadastrais'); assert.equal(p.sql, '170.049.0162-8'); assert.equal(p.casoId, 'C1'); assert(!('documento' in p) && !('exercicio' in p));
  m.window.prefEscolher('C1', 0, 0); m.window.prefPedirCadastrais('C1', 0); assert.equal(m.postadas.length, 1, 'área maior não pede');
});
await passo('contribuinte: lê formatos tolerantes e, se nada for achado, mostra o que o texto diz e deixa digitar à mão', () => {
  const f = mundo().__f;
  for (const t of ['Contribuinte nº 170 . 049 . 0003 / 6 em maior área', 'Contribuinte 170.049.0003.6', 'Inscrição municipal: 17004900036']) { const x = f.prefExtrair(t); assert.equal(x.contribuintes.length, 1, t); assert.equal(x.contribuintes[0].sql, '170.049.0003-6', t); }
  assert.equal(f.prefExtrair('Protocolo 17004900036 do cartório').contribuintes.length, 0, 'sem palavra de contexto, número solto não vale');
  const DOCN = {a: {tipo: 'documento', tipoDocumento: 'MATRICULA_IMOVEL', nome: 'M.pdf', texto: 'Apartamento 131. O imóvel está cadastrado na Prefeitura sob o número a ser informado. IPTU em dia.'}};
  const m = mundo(DOCN, {pref: true}), h = m.__f.prefFaixaHtml(m.casos.C1);
  assert(/Não achei número de contribuinte/.test(h) && /IPTU em dia/.test(h) && /pref-sql-C1-0/.test(h), 'mostra o trecho e o campo');
  assert(!/Valor venal de referência<\/button>/.test(h), 'sem número não há botões');
  m.window.prefGuardarSql('C1', 0, '170.049.0162-8');
  const h2 = m.__f.prefFaixaHtml(m.casos.C1); assert(/Valor venal de referência<\/button>/.test(h2) && /value="170\.049\.0162-8"/.test(h2), 'digitado, os botões aparecem: ' + h2.slice(-900));
  m.window.prefPedirNegativa('C1', 0); assert.equal(m.postadas.length, 1); assert.equal(m.postadas[0].pedido.sql, '170.049.0162-8');
});
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
