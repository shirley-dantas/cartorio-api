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

function mundo({respostas, ...opcoes} = {}) {
  const ouvintes = {}, enviados = [], elementos = {}, toasts = [], dialogos = {alerts: [], confirmou: null, resposta: true};
  const el = (id) => (elementos[id] = elementos[id] || {id, innerHTML: '', textContent: '', value: '', disabled: false, classList: {add() {}, remove() {}}});
  let emVoo = 0, picoVoo = 0, n = 0;
  const caixa = {
    esc: (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])),
    escTxt: (t) => String(t == null ? '' : t).replace(/[&<>]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c])),
    GAS_URL: 'https://gas.exemplo/exec', casos: {C1: {documentos: {pnl_a: {nome: 'Maria_RG.jpg', origem: 'arrastado no card', tipoDocumento: 'RG_CNH', pessoa: 'Maria', confirmar: true, texto: 'x'}}}},
    finToast: (t) => toasts.push(t), alert: (t) => dialogos.alerts.push(t), confirm: (t) => { dialogos.confirmou = t; return dialogos.resposta; }, btoa, atob, Uint8Array, String, Promise, console,
    setTimeout: () => 0, location: {search: ''}, history: {replaceState() {}}, caches: opcoes.caches || {open: async () => ({keys: async () => [], match: async () => null, delete: async () => true})}, File, Blob,
    document: {addEventListener: (t, f) => { (ouvintes[t] = ouvintes[t] || []).push(f); }, getElementById: el},
    fetch: async (url, o) => {
      const c = JSON.parse(o.body); enviados.push(c); emVoo++; picoVoo = Math.max(picoVoo, emVoo);
      await new Promise((r) => setImmediate(r)); emVoo--; n++;
      const r = respostas ? respostas(c, n) : {ok: true, nome: 'Maria_RG_CNH_2026-10-28_1.jpg', confirmar: false};
      return {json: async () => r};
    }
  };
  vm.createContext(caixa); vm.runInContext(bloco + '\n' + recebidos + '\nthis.__f={entradaDefinir:window.entradaDefinir,entradaEscolherCaso:window.entradaEscolherCaso,entradaDescartar:window.entradaDescartar,solteReceber:window.solteReceber,solteTirar:window.solteTirar,renomearDocCard:window.renomearDocCard,SOLTE,solteHtml,pedidoRecebidosHtml};', Object.assign(caixa, {window: caixa}));
  const arquivo = (nome, tipo, bytes = 'abc') => ({name: nome, type: tipo, size: bytes.length, arrayBuffer: async () => new TextEncoder().encode(bytes).buffer});
  const esperar = async () => { for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r)); };
  return {caixa, f: caixa.__f, ouvintes, enviados, el, toasts, dialogos, arquivo, esperar, pico: () => picoVoo};
}

await passo('a caixa aparece no card, com o botão de escolher para quem não arrasta', () => {
  const m = mundo(); const h = m.f.solteHtml({id: 'C1'});
  assert(/ou clique aqui e cole \(Ctrl\+V\)/.test(h) && /tabindex="0"/.test(h) && /data-solte="C1"/.test(h) && /Solte aqui os arquivos recebidos do cliente/.test(h) && /data-solte-input="C1"/.test(h) && /id="solte-prog-C1"/.test(h));
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
await passo('copiar e colar: Ctrl+V com a foto copiada manda para a caixa onde ela clicou; texto colado segue como sempre', async () => {
  const m = mundo(); const zona = {dataset: {solte: 'C1'}};
  const evento = (alvo, arquivos, ehCampo) => ({target: Object.assign({closest: (s) => (s === '.cx-solte' ? alvo : null), matches: () => !!ehCampo}), clipboardData: {files: arquivos}, preventDefault() { this.feito = true; }});
  // colou com o foco dentro da caixa
  const e1 = evento(zona, [m.arquivo('image.png', 'image/png', 'print')]); m.ouvintes.paste[0](e1); await m.esperar();
  assert.equal(e1.feito, true); assert.equal(m.enviados.length, 1); assert.equal(m.enviados[0].casoId, 'C1'); assert.equal(m.enviados[0].mimetype, 'image/png');
  // sem foco na caixa, mas a última em que clicou foi a do C1 (o card pode ter se redesenhado)
  m.ouvintes.click[0]({target: {closest: (s) => (s === '.cx-solte' ? zona : null)}});
  const e2 = evento(null, [m.arquivo('IMG.jpg', 'image/jpeg')]); m.ouvintes.paste[0](e2); await m.esperar(); assert.equal(e2.feito, true); assert.equal(m.enviados.length, 2);
  // com o cursor num campo de texto de outro lugar, ela não é atrapalhada
  const e3 = evento(null, [m.arquivo('IMG.jpg', 'image/jpeg')], true); m.ouvintes.paste[0](e3); await m.esperar(); assert.notEqual(e3.feito, true); assert.equal(m.enviados.length, 2);
  // texto (sem arquivo) nunca é interceptado
  const e4 = evento(zona, []); m.ouvintes.paste[0](e4); assert.notEqual(e4.feito, true);
  // nenhuma caixa escolhida ainda: não adivinha o card
  const v = mundo(); const e5 = evento(null, [v.arquivo('a.jpg', 'image/jpeg')]); v.ouvintes.paste[0](e5); await v.esperar(); assert.notEqual(e5.feito, true); assert.equal(v.enviados.length, 0);
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
// ── Compartilhar do WhatsApp para o painel ──
function cacheFalso() {
  const mapa = new Map();
  return {mapa, open: async () => ({
    keys: async () => [...mapa.keys()].map((u) => ({url: u})), delete: async (k) => mapa.delete(k.url || k),
    put: async (req, resp) => { mapa.set(req.url || req, resp); }, match: async (k) => mapa.get(k.url || k) || null
  })};
}
await passo('service worker: o POST de /compartilhar guarda os arquivos no aparelho e volta ao painel com a contagem', async () => {
  const fonteSW = readFileSync(join(AQUI, '..', 'service-worker.js'), 'utf8');
  const cache = cacheFalso(); const ouvintes = {};
  class Req { constructor(u, o = {}) { this.url = new URL(u, 'https://painel.exemplo').href; this.method = o.method || 'GET'; this._form = o.form; } async formData() { return this._form; } }
  class Resp { constructor(corpo, o = {}) { this.corpo = corpo; this.headers = new Map(Object.entries(o.headers || {})); this.status = 200; } static redirect(u, s) { const r = new Resp(null); r.status = s; r.destino = u; return r; } }
  const caixa = {self: {addEventListener: (t, f) => { ouvintes[t] = f; }, skipWaiting() {}, clients: {claim() {}}}, caches: {open: (n) => { assert.equal(n, 'painel-compartilhado'); return cache.open(); }}, Request: Req, Response: Resp, URL, fetch: async () => 'rede'};
  vm.createContext(caixa); vm.runInContext(fonteSW, caixa);
  const f1 = new File(['rg'], 'IMG 1.jpeg', {type: 'image/jpeg'}), f2 = new File(['pdf'], 'Contrato Social.pdf', {type: 'application/pdf'}), vazio = new File([], 'vazio.jpg', {type: 'image/jpeg'});
  const form = {getAll: (n) => (n === 'arquivos' ? [f1, f2, vazio, 'texto'] : [])};
  let resposta; ouvintes.fetch({request: new Req('/compartilhar', {method: 'POST', form}), respondWith: (p) => { resposta = p; }}); const r = await resposta;
  assert.equal(r.status, 303); assert.equal(r.destino, '/?compartilhado=2'); assert.equal(cache.mapa.size, 2, 'só os arquivos de verdade ficam');
  assert.equal(decodeURIComponent([...cache.mapa.values()][1].headers.get('X-Nome')), 'Contrato Social.pdf');
  // um compartilhamento novo troca o anterior; qualquer outra requisição segue para a rede como sempre
  ouvintes.fetch({request: new Req('/compartilhar', {method: 'POST', form: {getAll: () => [f1]}}), respondWith: (p) => { resposta = p; }}); await resposta; assert.equal(cache.mapa.size, 1);
  let outra; ouvintes.fetch({request: new Req('/index.html'), respondWith: (p) => { outra = p; }}); assert.equal(await outra, 'rede');
  let get; ouvintes.fetch({request: new Req('/compartilhar'), respondWith: (p) => { get = p; }}); assert.equal(await get, 'rede', 'GET em /compartilhar não é compartilhamento');
});
await passo('manifest: o painel se oferece como destino de arquivos (PDF e imagem) no Compartilhar', () => {
  const m = JSON.parse(readFileSync(join(AQUI, '..', 'manifest.json'), 'utf8')); const st = m.share_target;
  assert.equal(st.action, '/compartilhar'); assert.equal(st.method, 'POST'); assert.equal(st.enctype, 'multipart/form-data');
  assert.equal(st.params.files[0].name, 'arquivos'); assert(st.params.files[0].accept.includes('application/pdf') && st.params.files[0].accept.includes('image/*'));
});
await passo('painel: abre perguntando "para qual caso?", filtra por nome, e o caso escolhido recebe os arquivos', async () => {
  const cache = cacheFalso(); const cp = cacheFalso();
  const guardados = [new File(['a'], 'RG.jpg', {type: 'image/jpeg'}), new File(['b'], 'Contrato Social.pdf', {type: 'application/pdf'})];
  const c = await cp.open(); let i = 0; for (const f of guardados) await c.put({url: '/__compartilhado/' + (++i)}, {headers: {get: (h) => ({'X-Nome': encodeURIComponent(f.name), 'Content-Type': f.type})[h]}, blob: async () => f});
  const m = mundo({caches: {open: () => cp.open()}});
  m.caixa.casos.C2 = {id: 'C2', nome: 'JRL Holding', tipo: 'Contrato social'}; m.caixa.casos.C3 = {id: 'C3', nome: 'Ana Antiga', concluido: true};
  const url = []; m.caixa.history.replaceState = (a, b, u) => url.push(u);
  m.caixa.window.irParaCasoPorId = (id) => url.push('abriu:' + id);
  m.caixa.document.getElementById('modal-compartilhado').classList.add = function () { m.caixa.__aberto = true; }; m.caixa.document.getElementById('modal-compartilhado').classList.remove = function () { m.caixa.__aberto = false; };
  await m.caixa.window.compartilhadoAbrir();
  assert.equal(m.caixa.__aberto, true); assert(/2 arquivos recebidos do WhatsApp/.test(m.el('cp-sub').textContent));
  const lista = m.el('cp-lista').innerHTML; assert(/JRL Holding/.test(lista) && /data-cp-caso="C1"|data-cp-caso="C2"/.test(lista)); assert(!/Ana Antiga/.test(lista), 'caso concluído não aparece');
  m.caixa.window.compartilhadoFiltrar('jrl'); assert(/JRL Holding/.test(m.el('cp-lista').innerHTML) && !/data-cp-caso="C1"/.test(m.el('cp-lista').innerHTML), 'filtra pelo nome, sem ligar para caixa ou acento');
  m.caixa.window.compartilhadoFiltrar('zzz'); assert(/Nenhum caso/.test(m.el('cp-lista').innerHTML));
  m.caixa.window.compartilhadoEscolher('C2'); await m.esperar();
  assert.equal(m.enviados.length, 2); assert(m.enviados.every((e) => e.casoId === 'C2' && e.acao === 'painel-arquivo')); assert.deepEqual(m.enviados.map((e) => e.nomeArquivo).sort(), ['Contrato Social.pdf', 'RG.jpg']);
  assert(url.includes('abriu:C2') && url.includes('/'), 'abre o card e limpa o endereço'); assert.equal(cp.mapa.size, 0, 'o que foi enviado sai do aparelho'); assert(m.toasts.some((t) => /2 arquivos enviados para JRL Holding/.test(t)));
  // fechar sem escolher descarta, e abrir sem nada guardado não mostra janela
  const vazio = mundo({caches: {open: async () => ({keys: async () => [], match: async () => null, delete: async () => true})}}); vazio.caixa.__aberto = false;
  vazio.caixa.document.getElementById('modal-compartilhado').classList.add = () => { vazio.caixa.__aberto = true; }; await vazio.caixa.window.compartilhadoAbrir(); assert.equal(vazio.caixa.__aberto, false);
});
// ── A caixa de entrada do WhatsApp (o aviso no topo e a escolha do caso) ──
const REG = (nome, extra = {}) => ({nome, remetente: '5511988887777', nomeRemetente: 'Reinaldo', mime: 'application/pdf', em: 1761660000000, ...extra});
const montarEntrada = (opcoes = {}) => { const m = mundo(opcoes); m.caixa.document.getElementById('cc-entrada').style = {}; m.caixa.casos.C2 = {id: 'C2', nome: 'JRL Holding', tipo: 'Contrato social'}; return m; };
await passo('entrada: o aviso no topo agrupa por quem mandou, com telefone legível e o nome dos arquivos; vazio, some', () => {
  const m = montarEntrada(); const cc = m.caixa.document.getElementById('cc-entrada');
  m.f.entradaDefinir({w_a: REG('JRL Holding - Contrato Social.pdf'), w_b: REG('JRL HOLDING LTDA - CNPJ.pdf'), w_c: REG('Foto.jpg', {remetente: '5511911112222', nomeRemetente: ''})});
  assert.equal(cc.style.display, 'grid'); const h = cc.innerHTML;
  assert(/Chegaram 2 arquivos pelo WhatsApp/.test(h) && /Reinaldo · \(11\) 98888-7777/.test(h) && /JRL Holding - Contrato Social\.pdf, JRL HOLDING LTDA - CNPJ\.pdf/.test(h));
  assert(/Chegaram 1 arquivo pelo WhatsApp/.test(h) && /\(11\) 91111-2222/.test(h)); assert(/Escolher o caso/.test(h) && /Descartar/.test(h));
  m.f.entradaDefinir(null); assert.equal(cc.style.display, 'none'); assert.equal(cc.innerHTML, '');
});
await passo('entrada: escolher o caso manda cada arquivo ao Apps Script (dois por vez), mostra o andamento no card e abre o card', async () => {
  const m = montarEntrada({respostas: (c) => ({ok: true, nome: 'Contrato_' + c.entradaId + '.pdf', confirmar: c.entradaId === 'w_b'})});
  m.f.entradaDefinir({w_a: REG('A.pdf'), w_b: REG('B.pdf'), w_c: REG('C.pdf'), w_d: REG('D.pdf')});
  const abriu = []; m.caixa.window.irParaCasoPorId = (id) => abriu.push(id);
  m.caixa.document.getElementById('modal-compartilhado').classList.add = () => { m.caixa.__aberto = true; }; m.caixa.document.getElementById('modal-compartilhado').classList.remove = () => { m.caixa.__aberto = false; };
  m.f.entradaEscolherCaso('5511988887777'); assert.equal(m.caixa.__aberto, true); assert(/4 arquivos de Reinaldo \(WhatsApp\)/.test(m.el('cp-sub').textContent)); assert(/JRL Holding/.test(m.el('cp-lista').innerHTML));
  m.caixa.window.compartilhadoEscolher('C2'); await m.esperar();
  const envios = m.enviados.filter((e) => e.acao === 'entrada-atribuir'); assert.equal(envios.length, 4); assert(envios.every((e) => e.casoId === 'C2')); assert.deepEqual(envios.map((e) => e.entradaId).sort(), ['w_a', 'w_b', 'w_c', 'w_d']); assert(m.pico() <= 2, 'pico de ' + m.pico());
  const l = m.f.SOLTE.C2; assert.equal(l.length, 4); assert.equal(l.filter((x) => x.estado === 'ok').length, 3); assert.equal(l.filter((x) => x.estado === 'confirmar').length, 1);
  assert.deepEqual(abriu, ['C2']); assert.equal(m.caixa.__aberto, false); assert(m.toasts.some((t) => /4 arquivos enviados para JRL Holding/.test(t)));
});
await passo('entrada: fechar a janela sem escolher não perde nada, e arquivo já tratado ou erro do Apps Script aparece escrito', async () => {
  const m = montarEntrada(); m.f.entradaDefinir({w_a: REG('A.pdf')}); m.caixa.document.getElementById('modal-compartilhado').classList.remove = () => {};
  m.f.entradaEscolherCaso('5511988887777'); m.caixa.window.fecharCompartilhado(); await m.esperar(); assert.equal(m.enviados.length, 0, 'nada saiu'); m.f.entradaDefinir({w_a: REG('A.pdf')}); assert(/Chegaram 1 arquivo/.test(m.el('cc-entrada').innerHTML), 'continua esperando');
  const e = montarEntrada({respostas: () => ({ok: false, erro: 'Esse arquivo já foi tratado ou não existe mais.'})}); e.f.entradaDefinir({w_a: REG('A.pdf')}); e.f.entradaEscolherCaso('5511988887777'); e.caixa.window.compartilhadoEscolher('C2'); await e.esperar();
  assert.equal(e.f.SOLTE.C2[0].estado, 'erro'); assert(/já foi tratado/.test(e.f.SOLTE.C2[0].msg));
  const v = montarEntrada({respostas: () => ({ok: false, erro: 'Ação desconhecida: entrada-atribuir'})}); v.f.entradaDefinir({w_a: REG('A.pdf')}); v.f.entradaEscolherCaso('5511988887777'); v.caixa.window.compartilhadoEscolher('C2'); await v.esperar(); assert(/Apps Script publicado ainda não recebe/.test(v.f.SOLTE.C2[0].msg));
});
await passo('entrada: descartar pergunta antes, manda para a lixeira cada arquivo do remetente e conta o que falhou', async () => {
  const m = montarEntrada(); m.f.entradaDefinir({w_a: REG('A.pdf'), w_b: REG('B.pdf'), w_x: REG('X.pdf', {remetente: '5511900000000'})});
  m.dialogos.resposta = false; await m.f.entradaDescartar('5511988887777'); assert(/Descartar 2 arquivos de Reinaldo/.test(m.dialogos.confirmou)); assert.equal(m.enviados.length, 0, 'disse que não: nada saiu');
  m.dialogos.resposta = true; await m.f.entradaDescartar('5511988887777'); assert.deepEqual(m.enviados.map((e) => [e.acao, e.entradaId]).sort(), [['entrada-descartar', 'w_a'], ['entrada-descartar', 'w_b']]);
  const f = montarEntrada({respostas: () => ({ok: false, erro: 'O banco recusou a remoção (401).'})}); f.f.entradaDefinir({w_a: REG('A.pdf')}); await f.f.entradaDescartar('5511988887777'); assert(/banco recusou/.test(f.dialogos.alerts.join(' ')));
});
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
