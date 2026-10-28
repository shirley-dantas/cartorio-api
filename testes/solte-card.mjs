// Arrastar os arquivos do WhatsApp para o card: o que a caixa faz com cada arquivo, sem navegador.
//   node testes/solte-card.mjs
// O Apps Script (criar pasta, ler, nomear) é provado em testes/cliente-envio.mjs; aqui se prova o lado do painel:
// o que sai, o que é recusado antes de sair, o que aparece na lista, e o que acontece se o Apps Script for antigo.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const AQUI = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(AQUI, '..', 'index.html'), 'utf8');
const erros = [];
const passo = async (n, f) => { try { await f(); console.log('  ok  ' + n); } catch (e) { erros.push(n); console.log('FALHA ' + n + ' → ' + e.message); } };

const ini = html.indexOf('// ── Arrastar arquivos para o card'), fim = html.indexOf('// ── fim: arrastar arquivos para o card ──');
assert(ini > 0 && fim > ini, 'não achei o bloco no index.html');
const bloco = html.slice(ini, fim);
const i2 = html.indexOf('function pedidoRecebidosHtml(c){'); const recebidos = html.slice(i2, html.indexOf('\n}\n', i2) + 3);

function mundo({respostas} = {}) {
  const ouvintes = {}, enviados = [], elementos = {}, toasts = [];
  const el = (id) => (elementos[id] = elementos[id] || {id, innerHTML: '', textContent: '', value: '', disabled: false, classList: {add() {}, remove() {}}});
  let emVoo = 0, picoVoo = 0, n = 0;
  const caixa = {
    esc: (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])),
    escTxt: (t) => String(t == null ? '' : t).replace(/[&<>]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c])),
    GAS_URL: 'https://gas.exemplo/exec', casos: {C1: {documentos: {pnl_a: {nome: 'Maria_RG.jpg', origem: 'arrastado no card', tipoDocumento: 'RG_CNH', pessoa: 'Maria', confirmar: true, texto: 'x'}}}},
    finToast: (t) => toasts.push(t), btoa, atob, Uint8Array, String, Promise, console,
    setTimeout: () => 0,
    document: {addEventListener: (t, f) => { (ouvintes[t] = ouvintes[t] || []).push(f); }, getElementById: el},
    fetch: async (url, o) => {
      const c = JSON.parse(o.body); enviados.push(c); emVoo++; picoVoo = Math.max(picoVoo, emVoo);
      await new Promise((r) => setImmediate(r)); emVoo--; n++;
      const r = respostas ? respostas(c, n) : {ok: true, nome: 'Maria_RG_CNH_2026-10-28_1.jpg', confirmar: false};
      return {json: async () => r};
    }
  };
  vm.createContext(caixa); vm.runInContext(bloco + '\n' + recebidos + '\nthis.__f={solteReceber:window.solteReceber,solteTirar:window.solteTirar,renomearDocCard:window.renomearDocCard,SOLTE,solteHtml,pedidoRecebidosHtml};', Object.assign(caixa, {window: caixa}));
  const arquivo = (nome, tipo, bytes = 'abc') => ({name: nome, type: tipo, size: bytes.length, arrayBuffer: async () => new TextEncoder().encode(bytes).buffer});
  const esperar = async () => { for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r)); };
  return {caixa, f: caixa.__f, ouvintes, enviados, el, toasts, arquivo, esperar, pico: () => picoVoo};
}

await passo('a caixa aparece no card, com o botão de escolher para quem não arrasta', () => {
  const m = mundo(); const h = m.f.solteHtml({id: 'C1'});
  assert(/data-solte="C1"/.test(h) && /Solte aqui os arquivos recebidos do cliente/.test(h) && /data-solte-input="C1"/.test(h) && /id="solte-prog-C1"/.test(h));
  assert.equal(m.f.solteHtml(null), '');
});
await passo('soltar na caixa: cada arquivo vai para o Apps Script com o caso certo e o conteúdo em base64', async () => {
  const m = mundo(); const drop = m.ouvintes.drop[0];
  const zona = {dataset: {solte: 'C1'}, classList: {remove() {}}};
  drop({target: {closest: (s) => (s === '.cx-solte' ? zona : null)}, preventDefault() {}, dataTransfer: {files: [m.arquivo('WhatsApp Image.jpeg', 'image/jpeg', 'conteudo-rg'), m.arquivo('cert.pdf', 'application/pdf', 'pdf!')]}});
  await m.esperar();
  assert.equal(m.enviados.length, 2); const a = m.enviados[0];
  assert.equal(a.acao, 'painel-arquivo'); assert.equal(a.casoId, 'C1'); assert.equal(a.nomeArquivo, 'WhatsApp Image.jpeg'); assert.equal(a.mimetype, 'image/jpeg');
  assert.equal(Buffer.from(a.base64, 'base64').toString(), 'conteudo-rg');
  assert(m.f.SOLTE.C1.every((x) => x.estado === 'ok'), JSON.stringify(m.f.SOLTE.C1));
  const solto = m.ouvintes.drop[0]; assert(solto);
  // soltar fora da caixa não faz nada
  const antes = m.enviados.length; drop({target: {closest: () => null}, preventDefault() {}, dataTransfer: {files: [m.arquivo('x.jpg', 'image/jpeg')]}}); await m.esperar(); assert.equal(m.enviados.length, antes);
});
await passo('recusa antes de sair: áudio, Word, arquivo vazio e arquivo maior que 10 MB — com o motivo escrito', async () => {
  const m = mundo();
  const grande = {name: 'enorme.pdf', type: 'application/pdf', size: 11 * 1024 * 1024, arrayBuffer: async () => new ArrayBuffer(0)};
  m.f.solteReceber('C1', [m.arquivo('audio.ogg', 'audio/ogg'), m.arquivo('a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), m.arquivo('vazio.jpg', 'image/jpeg', ''), grande]);
  await m.esperar(); assert.equal(m.enviados.length, 0, 'nada saiu');
  const l = m.f.SOLTE.C1; assert(l.every((x) => x.estado === 'erro')); assert(/Só PDF e imagem/.test(l[0].msg) && /vazio/.test(l[2].msg) && /10 MB/.test(l[3].msg));
  assert(/solte-erro/.test(m.el('solte-prog-C1').innerHTML) && /aria-label="Tirar da lista"/.test(m.el('solte-prog-C1').innerHTML));
});
await passo('o que a IA não tem certeza aparece como "confirmar", com o nome salvo e o caminho do lápis', async () => {
  const m = mundo({respostas: () => ({ok: true, nome: 'Recebido_2026-10-28_ab12.jpg', confirmar: true, aviso: 'A IA não lê este formato (HEIC).'})});
  m.f.solteReceber('C1', [m.arquivo('IMG.heic', 'image/heic')]); await m.esperar();
  const it = m.f.SOLTE.C1[0]; assert.equal(it.estado, 'confirmar'); assert(/Recebido_2026/.test(it.msg) && /lápis/.test(it.msg) && /não lê este formato/.test(it.msg));
});
await passo('Apps Script antigo ou banco recusando: o motivo aparece escrito e o arquivo não some da lista', async () => {
  const m = mundo({respostas: () => ({ok: false, erro: 'Ação desconhecida: painel-arquivo'})});
  m.f.solteReceber('C1', [m.arquivo('a.jpg', 'image/jpeg')]); await m.esperar();
  assert.equal(m.f.SOLTE.C1[0].estado, 'erro'); assert(/Apps Script publicado ainda não recebe arquivos/.test(m.f.SOLTE.C1[0].msg));
  const r = mundo({respostas: () => ({ok: false, erro: 'O banco recusou o registro (401).'})}); r.f.solteReceber('C1', [r.arquivo('a.jpg', 'image/jpeg')]); await r.esperar();
  assert(/banco recusou/.test(r.f.SOLTE.C1[0].msg));
  const c = mundo(); c.caixa.fetch = async () => { throw new Error('sem rede'); }; c.f.solteReceber('C1', [c.arquivo('a.jpg', 'image/jpeg')]); await c.esperar();
  assert(/Erro de conexão/.test(c.f.SOLTE.C1[0].msg));
});
await passo('vários arquivos de uma vez sobem no máximo dois por vez (o Apps Script não é invadido)', async () => {
  const m = mundo(); m.f.solteReceber('C1', Array.from({length: 7}, (_, i) => m.arquivo('f' + i + '.jpg', 'image/jpeg'))); await m.esperar();
  assert.equal(m.enviados.length, 7); assert(m.pico() <= 2, 'pico de ' + m.pico()); assert(m.f.SOLTE.C1.every((x) => x.estado === 'ok'));
});
await passo('a lista de recebidos mostra o que foi arrastado: "confirmar o nome" e o lápis (só nele)', () => {
  const m = mundo(); const h = m.f.pedidoRecebidosHtml({id: 'C1', documentos: {
    pnl_a: {nome: 'Maria_RG.jpg', origem: 'arrastado no card', confirmar: true, texto: 'x', salvoEm: '2026-10-28T10:00:00Z'},
    cli_b: {nome: 'RG.jpg', origem: 'link do cliente', texto: 'x', salvoEm: '2026-10-28T09:00:00Z'},
    z: {nome: 'bot.jpg', origem: 'foto do bot'}}});
  assert(/confirmar o nome/.test(h)); assert(/renomearDocCard\('C1','pnl_a'\)/.test(h)); assert(!/renomearDocCard\('C1','cli_b'\)/.test(h), 'o do link não tem lápis');
  assert(!/bot\.jpg/.test(h), 'documento de outra origem continua fora');
});
await passo('corrigir: abre a janela com o tipo e a pessoa de agora, e manda a correção ao Apps Script', async () => {
  const m = mundo({respostas: (c) => (c.acao === 'painel-renomear' ? {ok: true, nome: 'Maria_da_Silva_RG_CNH_2026-10-28_1.jpg'} : {ok: true})});
  m.f.renomearDocCard('C1', 'pnl_a');
  assert(/value="RG_CNH" selected/.test(m.el('dn-tipo').innerHTML) && /Certidão de casamento/.test(m.el('dn-tipo').innerHTML)); assert.equal(m.el('dn-pessoa').value, 'Maria');
  m.el('dn-tipo').value = 'CERTIDAO_CASAMENTO'; m.el('dn-pessoa').value = 'João e Maria';
  await m.el('dn-salvar').onclick(); await m.esperar();
  const c = m.enviados.find((x) => x.acao === 'painel-renomear'); assert(c && c.casoId === 'C1' && c.docKey === 'pnl_a' && c.tipo === 'CERTIDAO_CASAMENTO' && c.pessoa === 'João e Maria');
  assert(m.toasts.some((t) => /Renomeado/.test(t)));
  const e = mundo({respostas: () => ({ok: false, erro: 'Ação desconhecida: painel-renomear'})}); e.f.renomearDocCard('C1', 'pnl_a'); await e.el('dn-salvar').onclick();
  assert(/ainda não conhece/.test(e.el('dn-erro').textContent)); assert.equal(e.el('dn-salvar').disabled, false, 'o botão volta, para tentar de novo');
});
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
