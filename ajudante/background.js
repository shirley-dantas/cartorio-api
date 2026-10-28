// O Ajudante, por trás: recebe o pedido do painel, abre a JUCESP numa aba, acompanha o que a página faz e, quando o PDF abre,
// o baixa com a sessão dela (o certificado já entrou) e entrega ao Apps Script, que o guarda na pasta do caso.
// O endereço do Apps Script mora AQUI, e não vem do pedido: página nenhuma consegue desviar o arquivo para outro lugar.
'use strict';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbz6NoiizP5ThvPWZ1ZZ_HAvJworawPrmfzCAXyCfY2n9oB8Qx4oFfYw0trGgm5liXHY/exec';
const JUCESP = 'https://www.jucesponline.sp.gov.br';
const MAX_BYTES = 10 * 1024 * 1024;
const DOCS = {
  ficha: { nome: 'Ficha cadastral completa', arquivo: 'FICHA_CADASTRAL_COMPLETA', tipo: 'FICHA_CADASTRAL_JUCESP' },
  contrato: { nome: 'Contrato social consolidado', arquivo: 'CONTRATO_SOCIAL_CONSOLIDADO', tipo: 'CONTRATO_SOCIAL' }
};

function cnpjValido(c) {
  c = String(c || '').replace(/\D/g, '');
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dv = (n) => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += Number(c[i]) * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
}

// Os jobs ficam no armazenamento da extensão: o service worker dorme e acorda, e a memória some.
let trava = Promise.resolve();
function mexer(f) { const p = trava.then(f); trava = p.catch(() => {}); return p; }
async function jobs() { return (await chrome.storage.local.get('jobs')).jobs || {}; }
async function guardar(j) { await chrome.storage.local.set({ jobs: j }); }
async function mudar(id, f) {
  return mexer(async () => { const todos = await jobs(), job = todos[id]; if (!job) return null; const r = await f(job, todos); await guardar(todos); return r === undefined ? job : r; });
}
async function jobDaAba(tabId) { const todos = await jobs(); return Object.values(todos).find((j) => j.jucespTabId === tabId && !j.fim) || null; }

function falar(job, estado, texto) {
  if (job.painelTabId == null) return;
  try { Promise.resolve(chrome.tabs.sendMessage(job.painelTabId, { tipo: 'progresso', id: job.id, estado, texto })).catch(() => {}); } catch (_) { /* a aba do painel pode ter fechado */ }
}
async function terminar(id, estado, texto) {
  const job = await mudar(id, (j) => { j.fim = true; j.estado = estado; j.texto = texto; });
  if (job) falar(job, estado, texto);
}

function paraBase64(buffer) {
  const b = new Uint8Array(buffer); let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}

async function criarPedido(pedido, sender) {
  const quero = Array.isArray(pedido && pedido.quero) ? pedido.quero.filter((q, i, a) => DOCS[q] && a.indexOf(q) === i) : [];
  if (!quero.length) return { ok: false, texto: 'Não entendi o que buscar.' };
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(String((pedido && pedido.casoId) || ''))) return { ok: false, texto: 'Caso inválido.' };
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(String((pedido && pedido.id) || ''))) return { ok: false, texto: 'Pedido inválido.' };
  if (!cnpjValido(pedido.cnpj)) return { ok: false, texto: 'Esse CNPJ não confere (confira os dígitos).' };
  const job = { id: pedido.id, casoId: pedido.casoId, cnpj: String(pedido.cnpj).replace(/\D/g, ''), fila: quero.slice(), feitos: [], painelTabId: sender && sender.tab ? sender.tab.id : null, iniciado: Date.now() };
  const aba = await chrome.tabs.create({ url: JUCESP + '/Default.aspx' });
  job.jucespTabId = aba.id;
  await mexer(async () => { const todos = await jobs(); todos[job.id] = job; await guardar(todos); });
  falar(job, 'andando', 'Abrindo a JUCESP…');
  return { ok: true };
}

async function enviarAoApps(job, qual, bytes) {
  const d = DOCS[qual];
  const corpo = {
    acao: 'painel-arquivo', casoId: job.casoId, nomeArquivo: 'JUCESP_' + d.arquivo + '_' + job.cnpj + '.pdf', mimetype: 'application/pdf',
    base64: paraBase64(bytes), tipoSugerido: d.tipo, pessoaSugerida: job.empresa || '', origemAjudante: 'jucesp'
  };
  const r = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(corpo) });
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch (_) { throw new Error('O Apps Script não respondeu em JSON (precisa de nova versão?).'); }
  if (!j || !j.ok) throw new Error((j && j.erro) || 'O Apps Script recusou o arquivo.');
  return j;
}

async function capturar(job, url) {
  const qual = job.fila[0], d = DOCS[qual];
  if (!d) return;
  falar(job, 'andando', 'Baixando: ' + d.nome + '…');
  try {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error('A JUCESP respondeu ' + r.status + ' ao baixar o PDF.');
    const tipo = String(r.headers.get('content-type') || '').toLowerCase();
    const bytes = await r.arrayBuffer();
    if (!/pdf/.test(tipo) && String.fromCharCode.apply(null, new Uint8Array(bytes.slice(0, 4))) !== '%PDF') throw new Error('O que abriu não é um PDF.');
    if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) throw new Error('PDF vazio ou maior que 10 MB.');
    const j = await enviarAoApps(job, qual, bytes);
    const atual = await mudar(job.id, (x) => { x.feitos.push(qual); x.fila.shift(); x.pdfUrl = null; x.manual = false; });
    const msg = d.nome + ': guardado no card como ' + j.nome + (j.confirmar ? ' (confirme o nome no card)' : '') + '.';
    if (atual.fila.length) { falar(atual, 'andando', msg + ' Agora: ' + DOCS[atual.fila[0]].nome + '…'); await irParaEmpresa(atual); }
    else await terminar(job.id, 'ok', 'Pronto! ' + msg);
  } catch (e) {
    await mudar(job.id, (x) => { x.pdfUrl = null; });
    await terminar(job.id, 'erro', 'Não consegui guardar ' + d.nome + ': ' + ((e && e.message) || e) + ' Salve o PDF (Ctrl+S) e arraste para a caixa do card.');
  }
}

async function irParaEmpresa(job) {
  if (job.nire) await chrome.tabs.update(job.jucespTabId, { url: JUCESP + '/Pre_Visualiza.aspx?nire=' + job.nire + '&idproduto=' });
  else await chrome.tabs.update(job.jucespTabId, { url: JUCESP + '/Default.aspx' });
}

chrome.runtime.onMessage.addListener((m, sender, responder) => {
  (async () => {
    if (!m) return responder(null);
    if (m.tipo === 'pedido') return responder(await criarPedido(m.pedido, sender));
    const job = sender && sender.tab ? await jobDaAba(sender.tab.id) : null;
    if (m.tipo === 'quem') return responder(job);
    if (m.tipo === 'cancelar') {
      const todos = await jobs(), alvo = todos[m.id];
      if (alvo && sender.tab && sender.tab.id === alvo.painelTabId) await terminar(m.id, 'erro', 'Cancelado.');
      return responder({ ok: true });
    }
    if (!job) return responder(null);
    // Um erro da página não encerra o pedido: ela pode escolher "Fazer à mão" e o PDF ainda será pego.
    if (m.tipo === 'status') { falar(job, m.estado, m.texto); return responder({ ok: true }); }
    if (m.tipo === 'nire') { await mudar(job.id, (x) => { x.nire = String(m.nire || '').replace(/\D/g, '') || x.nire; if (m.empresa) x.empresa = String(m.empresa).slice(0, 120); }); return responder({ ok: true }); }
    if (m.tipo === 'manual') { await mudar(job.id, (x) => { x.manual = true; }); return responder({ ok: true }); }
    responder(null);
  })().catch(() => responder(null));
  return true;
});

// O PDF abre na própria aba; é aí que ele é pego. Vale tanto para o caminho automático quanto para quando ela assumiu à mão.
chrome.tabs.onUpdated.addListener((tabId, info, aba) => {
  const url = (aba && aba.url) || info.url || '';
  if (!/\/VisualizaTicket\.aspx/i.test(url) || new URL(url).origin !== JUCESP) return;
  mexer(async () => {
    const todos = await jobs(), job = Object.values(todos).find((j) => j.jucespTabId === tabId && !j.fim);
    if (!job || job.pdfUrl === url) return null;
    job.pdfUrl = url; await guardar(todos); return job;
  }).then((job) => { if (job) return capturar(job, url); }).catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => {
  mexer(async () => { const todos = await jobs(); const job = Object.values(todos).find((j) => j.jucespTabId === tabId && !j.fim); return job ? { ...job } : null; })
    .then((job) => { if (job) return terminar(job.id, 'erro', 'A aba da JUCESP foi fechada antes de terminar.'); }).catch(() => {});
});

if (typeof module !== 'undefined') module.exports = { cnpjValido, paraBase64, DOCS };
