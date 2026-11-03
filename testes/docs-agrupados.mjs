// A lista de documentos recebidos, agrupada: quem é de quem, o que precisa de confirmação, o que nunca some.
//   node testes/docs-agrupados.mjs
// Sai do index.html como está (o bloco entre os dois marcadores) e roda sem navegador.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const AQUI = dirname(fileURLToPath(import.meta.url)), html = readFileSync(join(AQUI, '..', 'index.html'), 'utf8');
const erros = [];
const passo = async (n, f) => { try { await f(); console.log('  ok  ' + n); } catch (e) { erros.push(n); console.log('FALHA ' + n + ' → ' + (e && e.message)); } };
const ini = html.indexOf('// ── A lista de documentos recebidos ──'), fim = html.indexOf('// ── fim: a lista de documentos recebidos ──');
assert(ini > 0 && fim > ini, 'não achei o bloco no index.html');
const linhaTipos = html.slice(html.indexOf('const SOLTE_TIPOS='), html.indexOf('\n', html.indexOf('const SOLTE_TIPOS=')));
function mundo() {
  const ouvintes = {}, esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const ctx = {esc, escTxt: (t) => String(t == null ? '' : t).replace(/[&<>]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c])), Date, String, Object, Array, Set, JSON,
    document: {addEventListener: (t, f) => { (ouvintes[t] = ouvintes[t] || []).push(f); }}};
  vm.createContext(ctx); vm.runInContext(linhaTipos + '\n' + html.slice(ini, fim) + '\nthis.__f={pedidoRecebidosHtml,docsAgrupar,docsRotulo,DOCS_ABERTOS};', ctx);
  ctx.toggle = (docs, aberto) => ouvintes.toggle.forEach((f) => f({target: {dataset: {docs}, open: aberto}}));
  return ctx;
}
const D = (nome, extra = {}) => ({nome, tipo: 'documento', origem: 'arrastado no card', texto: 'lido', salvoEm: '2026-10-29T10:00:00Z', link: 'https://drive/' + nome, ...extra});
const CASO = () => ({id: 'C1', documentos: {
  d1: D('Ficha.pdf', {tipoDocumento: 'FICHA_CADASTRAL_JUCESP', pessoa: 'JRL HOLDING LTDA', salvoEm: '2026-10-28T10:00:00Z'}),
  d2: D('Contrato.pdf', {tipoDocumento: 'CONTRATO_SOCIAL', pessoa: 'JRL HOLDING LTDA', salvoEm: '2026-10-28T10:01:00Z'}),
  d3: D('WhatsApp Image 14.32.11.jpeg', {confirmar: true, texto: null}),
  d4: D('WhatsApp Image 14.32.12.jpeg', {confirmar: true, texto: null}),
  d5: D('Recebido_20261029_1.pdf', {confirmar: true, texto: null}),
  d6: D('Maria_RG.jpg', {tipoDocumento: 'RG_CNH', pessoa: 'Maria da Silva'}),
  d7: D('Maria_Comp.pdf', {tipoDocumento: 'COMPROVANTE_ENDERECO', pessoa: 'MARIA DA SILVA'}),
  d8: D('Carlos_Cert.pdf', {tipoDocumento: 'CERTIDAO_CASAMENTO', pessoa: 'Carlos e Ana'}),
  d9: D('Matricula.pdf', {tipoDocumento: 'MATRICULA_IMOVEL'}),
  d10: D('VV.png', {tipoDocumento: 'VALOR_VENAL_REFERENCIA'}),
  d11: D('NEG.pdf', {tipoDocumento: 'NEGATIVA_IPTU'}),
  f1: {nome: 'DADOS_INFORMADOS_PELO_CLIENTE', tipo: 'informacoes', origem: 'link do cliente', texto: 't', salvoEm: '2026-10-29T11:00:00Z'},
  o1: D('Procuracao.pdf', {tipoDocumento: 'PROCURACAO'})}});
const titulos = (m, c) => m.__f.docsAgrupar(Object.entries(c.documentos).map(([k, d]) => ({k, d}))).map((g) => g.titulo + ':' + g.itens.length);

await passo('os documentos se agrupam por quem é de quem, e o que pede confirmação vem primeiro', () => {
  const m = mundo(); const t = titulos(m, CASO());
  assert.deepEqual(Array.from(t), ['A confirmar:3', 'Carlos e Ana:1', 'Maria da Silva:2', 'Empresa · JRL HOLDING LTDA:2', 'Imóvel:3', 'Dados digitados pelo cliente:1', 'Outros documentos:1'], JSON.stringify(t));
});
await passo('a mesma pessoa escrita de dois jeitos (caixa e acento) é um grupo só', () => {
  const m = mundo(); const t = titulos(m, {documentos: {a: D('a.jpg', {tipoDocumento: 'RG_CNH', pessoa: 'José Álvares'}), b: D('b.jpg', {tipoDocumento: 'CPF', pessoa: 'JOSE ALVARES'})}});
  assert.deepEqual(Array.from(t), ['José Álvares:2']);
});
await passo('documento antigo, sem tipo, vai para "Outros" — nunca para "A confirmar" e nunca some', () => {
  const m = mundo(); const c = {id: 'C1', documentos: {a: D('velho.pdf', {texto: null}), b: D('velho2.pdf', {tipoDocumento: 'RG_CNH'})}};
  assert.deepEqual(Array.from(titulos(m, c)), ['Outros documentos:2']);
  const h = m.__f.pedidoRecebidosHtml(c); assert(/velho\.pdf/.test(h) && /velho2\.pdf|RG ou CNH/.test(h)); assert(!/a confirmar/.test(h));
});
await passo('o nome que ela lê é o tipo do documento; o nome do arquivo fica no título; sem tipo, aparece o nome do arquivo', () => {
  const m = mundo(); const h = m.__f.pedidoRecebidosHtml(CASO());
  assert(/>RG ou CNH<\/a>/.test(h) && /title="Maria_RG\.jpg"/.test(h)); assert(/>Valor venal de referência<\/a>/.test(h) && />Negativa de IPTU<\/a>/.test(h));
  assert(/WhatsApp Image 14\.32\.11\.jpeg<\/a>/.test(h), 'sem tipo conhecido, mostra o nome do arquivo');
});
await passo('a linha de cima diz quantos faltam confirmar, e só conta o que pede confirmação', () => {
  const m = mundo(); const h = m.__f.pedidoRecebidosHtml(CASO());
  assert(/<b>3 a confirmar<\/b>/.test(h), h.slice(0, 600)); assert(/ \+ dados digitados/.test(h));
  const limpo = m.__f.pedidoRecebidosHtml({id: 'C1', documentos: {a: D('a.pdf', {tipoDocumento: 'RG_CNH', pessoa: 'Ana'})}}); assert(!/a confirmar/.test(limpo));
});
await passo('arquivo que o cliente ainda não concluiu fica num grupo próprio, no alto', () => {
  const m = mundo(); const c = {id: 'C1', documentos: {a: D('a.jpg', {origem: 'link do cliente', provisorio: true, tipoDocumento: 'RG_CNH', pessoa: 'Ana'}), b: D('b.jpg', {tipoDocumento: 'CPF', pessoa: 'Bia'})}};
  assert.deepEqual(Array.from(titulos(m, c)), ['Aguardando o cliente concluir o envio:1', 'Bia:1']);
  assert(/1 aguardando o cliente concluir/.test(m.__f.pedidoRecebidosHtml(c)));
});
await passo('os botões de antes continuam: excluir em todos, lápis só no arrastado, "Ler de novo" só no sem leitura', () => {
  const m = mundo(); const c = CASO(); c.documentos.cli = D('cli.pdf', {origem: 'link do cliente', texto: null, tipoDocumento: 'CPF', pessoa: 'Zé'});
  const h = m.__f.pedidoRecebidosHtml(c), n = Object.keys(c.documentos).length;
  assert.equal((h.match(/excluirDocCliente\('C1'/g) || []).length, n);
  assert(/renomearDocCard\('C1','d6'\)/.test(h)); assert(!/renomearDocCard\('C1','cli'\)/.test(h), 'o do link não tem lápis'); assert(!/renomearDocCard\('C1','f1'\)/.test(h));
  assert(/relerDocCliente\('C1','cli'/.test(h)); assert(!/relerDocCliente\('C1','d6'/.test(h));
});
await passo('abrir e fechar a lista não se perde quando o card se redesenha', () => {
  const m = mundo(); const c = CASO();
  assert(!/<details[^>]* open/.test(m.__f.pedidoRecebidosHtml(c)), 'nasce fechada');
  m.toggle('C1', true); assert(/<details[^>]* open/.test(m.__f.pedidoRecebidosHtml(c)), 'o painel atualiza e a lista continua aberta');
  assert(!/<details[^>]* open/.test(m.__f.pedidoRecebidosHtml({...c, id: 'OUTRO'})), 'só a lista deste card');
  m.toggle('C1', false); assert(!/<details[^>]* open/.test(m.__f.pedidoRecebidosHtml(c)), 'minimizou: fica fechada');
});
await passo('nome de pessoa, de arquivo e papel com HTML nunca viram HTML', () => {
  const m = mundo(); const h = m.__f.pedidoRecebidosHtml({id: 'C1', documentos: {a: D('<img src=x onerror=1>.pdf', {tipoDocumento: 'RG_CNH', pessoa: '<script>alert(1)</script>', papel: '"><b>'})}});
  assert(!/<script>|<img src|<b>/.test(h.replace(/<b>(\d+ a confirmar|aguardando[^<]*|confirmar o nome|sem leitura)<\/b>/g, '')), h);
  assert(/&lt;script&gt;/.test(h));
});
await passo('quando todos os documentos da pessoa têm o mesmo papel, ele aparece ao lado do nome', () => {
  const m = mundo(); const h = m.__f.pedidoRecebidosHtml({id: 'C1', documentos: {a: D('a.jpg', {origem: 'link do cliente', tipoDocumento: 'RG_CNH', pessoa: 'Ana', papel: 'Vendedor'}), b: D('b.jpg', {origem: 'link do cliente', tipoDocumento: 'CPF', pessoa: 'Ana', papel: 'Vendedor'})}});
  assert(/Ana <small>\(Vendedor\)<\/small>/.test(h));
});
await passo('sem documentos do cliente, a lista não aparece; documento de outra origem continua fora', () => {
  const m = mundo(); assert.equal(m.__f.pedidoRecebidosHtml({id: 'C1', documentos: {}}), ''); assert.equal(m.__f.pedidoRecebidosHtml({id: 'C1', documentos: {a: {nome: 'x', origem: 'foto do bot'}}}), '');
});
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
