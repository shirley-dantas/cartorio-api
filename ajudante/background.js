// O Ajudante, por trás: recebe o pedido do painel, abre a JUCESP numa aba, acompanha o que a página faz e, quando o PDF abre,
// o baixa com a sessão dela (o certificado já entrou) e entrega ao Apps Script, que o guarda na pasta do caso.
// O endereço do Apps Script mora AQUI, e não vem do pedido: página nenhuma consegue desviar o arquivo para outro lugar.
'use strict';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbz6NoiizP5ThvPWZ1ZZ_HAvJworawPrmfzCAXyCfY2n9oB8Qx4oFfYw0trGgm5liXHY/exec';
const JUCESP = 'https://www.jucesponline.sp.gov.br';
const RIDIGITAL = 'https://ridigital.org.br';
const PREFEITURA_VALOR = 'https://itbi.prefeitura.sp.gov.br/valorreferencia/tvm/frm_tvm_consulta_valor.aspx';
const PREFEITURA_NEGATIVA = 'https://duc.prefeitura.sp.gov.br/certidoes/forms_anonimo/frmConsultaEmissaoCertificado.aspx';
// O que cada pedido da prefeitura é: onde começa, se pede data, e como o arquivo se chama no card.
const PREF_SERVICOS = {
  'valor-venal': { url: PREFEITURA_VALOR, data: true },
  'negativa-iptu': { url: PREFEITURA_NEGATIVA, data: false, tipo: 'NEGATIVA_IPTU', arquivo: 'NEGATIVA_IPTU', nome: 'Certidão tributária de IPTU' }
};
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
// O OK da JUCESP tem target=_blank: a lista de cópias abre numa aba NOVA, filha da do pedido. Ela também é do trabalho (senão o Ajudante nem roda nela).
async function jobDaAba(tabId) { const todos = await jobs(); return Object.values(todos).find((j) => !j.fim && (j.jucespTabId === tabId || (j.filhas || []).includes(tabId))) || null; }

// `fim` marca o último aviso do pedido: é por ele que o painel sabe que pode começar o próximo da fila.
function falar(job, estado, texto, fim, relatorio) {
  if (job.painelTabId == null) return;
  try { Promise.resolve(chrome.tabs.sendMessage(job.painelTabId, { tipo: 'progresso', id: job.id, estado, texto, fim: !!fim, relatorio })).catch(() => {}); } catch (_) { /* a aba do painel pode ter fechado */ }
}
async function terminar(id, estado, texto) {
  const job = await mudar(id, (j, todos) => { j.fim = true; j.estado = estado; j.texto = texto; ev(j, { fim: estado, texto: String(texto || '').slice(0, 90) }); if (!Object.values(todos).some((x) => !x.fim)) { popupsDaJucesp(false); bloquearTicket(false); } });
  if (job) {
    falar(job, estado, texto, true, job.site === 'onr' ? relatorioOnr(job) : job.site === 'pref' ? relatorioPref(job) : undefined);
    for (const t of [job.jucespTabId].concat(job.filhas || [])) { try { Promise.resolve(chrome.tabs.sendMessage(t, { tipo: 'fim', estado, texto })).catch(() => {}); } catch (_) { /* a aba pode já ter fechado */ } }
  }
}

function paraBase64(buffer) {
  const b = new Uint8Array(buffer); let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}

// O NIRE de cada CNPJ, aprendido na primeira busca: da segunda vez em diante o Ajudante vai direto à empresa e pula a pesquisa
// (e o captcha que ela traz). Se a JUCESP não deixar entrar direto, a página cai na pesquisa e o caminho de sempre continua.
async function nireConhecido(cnpj) { return ((await chrome.storage.local.get('nires')).nires || {})[cnpj] || null; }
async function lembrarNire(cnpj, nire) { await mexer(async () => { const n = (await chrome.storage.local.get('nires')).nires || {}; n[cnpj] = nire; await chrome.storage.local.set({ nires: n }); }); }

// A JUCESP abre o PDF numa janela nova, e o Chrome bloqueia essa janela quando o clique que a causou é de programa. Enquanto há pedido andando,
// os pop-ups SÓ do site da JUCESP ficam liberados (configuração da própria extensão, que o Chrome desfaz quando ela a limpa). Nada além desse endereço.
const PADRAO_JUCESP = JUCESP + '/*';
async function popupsDaJucesp(liberar) {
  try {
    const cs = chrome.contentSettings && chrome.contentSettings.popups; if (!cs) return 'sem a API';
    if (liberar) await cs.set({ primaryPattern: PADRAO_JUCESP, setting: 'allow' }); else await cs.clear({});
    return 'ok';
  } catch (e) { return 'erro: ' + String((e && e.message) || e).slice(0, 120); }   // a reserva da faixa (um clique dela) cobre
}
// O endereço do PDF (VisualizaTicket.aspx?sc=…) vale UMA vez: quando o Chrome o abre, o Ajudante já não consegue baixá-lo (foi o que o teste real mostrou:
// o PDF abria para ela e o card dizia "O que veio não é um PDF"). Então, enquanto há pedido andando, a NAVEGAÇÃO a esse endereço é bloqueada (regra do
// declarativeNetRequest, só para janelas e quadros — a busca do Ajudante é outro tipo e passa) e o Ajudante o baixa ele mesmo, uma vez só.
const REGRA_TICKET = 7001;
async function bloquearTicket(ligar) {
  try {
    const d = chrome.declarativeNetRequest; if (!d || !d.updateDynamicRules) return 'sem a API';
    await d.updateDynamicRules({ removeRuleIds: [REGRA_TICKET], addRules: ligar ? [{ id: REGRA_TICKET, priority: 1, action: { type: 'block' }, condition: { urlFilter: '||www.jucesponline.sp.gov.br/VisualizaTicket.aspx', resourceTypes: ['main_frame', 'sub_frame'] } }] : [] });
    return 'ok';
  } catch (e) { return 'erro: ' + String((e && e.message) || e).slice(0, 120); }
}
// Uma regra esquecida (a extensão fechou no meio) bloquearia os PDFs dela para sempre: ao acordar, sem pedido andando, a regra sai.
(async () => { try { const todos = await jobs(); if (!Object.values(todos).some((x) => !x.fim)) await bloquearTicket(false); } catch (_) { /* sem armazenamento ainda */ } })();

// O que o fundo viu, para o relatório: se os pop-ups foram liberados, que abas a página abriu, o que foi baixado e como acabou.
const ev = (job, o) => { (job.eventos = job.eventos || []).push(Object.assign({ t: Math.round((Date.now() - (job.iniciado || Date.now())) / 100) / 10 }, o)); if (job.eventos.length > 40) job.eventos.shift(); };
const semQuery = (u) => { try { const x = new URL(u); return x.pathname; } catch (_) { return String(u || '').split('?')[0]; } };

async function criarPedido(pedido, sender) {
  if (pedido && pedido.site === 'onr') return criarPedidoOnr(pedido, sender);
  if (pedido && pedido.site === 'pref') return criarPedidoPref(pedido, sender);
  const quero = Array.isArray(pedido && pedido.quero) ? pedido.quero.filter((q, i, a) => DOCS[q] && a.indexOf(q) === i) : [];
  if (!quero.length) return { ok: false, texto: 'Não entendi o que buscar.' };
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(String((pedido && pedido.casoId) || ''))) return { ok: false, texto: 'Caso inválido.' };
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(String((pedido && pedido.id) || ''))) return { ok: false, texto: 'Pedido inválido.' };
  if (!cnpjValido(pedido.cnpj)) return { ok: false, texto: 'Esse CNPJ não confere (confira os dígitos).' };
  // O contrato consolidado se acha pelo número que a ficha cadastral traz (a lista da JUCESP quase não tem descrição): a ficha vai primeiro, e fica no card.
  if (quero.includes('contrato')) { if (!quero.includes('ficha')) quero.push('ficha'); quero.sort((a, b) => (a === 'ficha' ? 0 : 1) - (b === 'ficha' ? 0 : 1)); }
  const job = { id: pedido.id, casoId: pedido.casoId, cnpj: String(pedido.cnpj).replace(/\D/g, ''), fila: quero.slice(), feitos: [], painelTabId: sender && sender.tab ? sender.tab.id : null, iniciado: Date.now() };
  const conhecido = await nireConhecido(job.cnpj);
  if (conhecido) { job.nire = conhecido; job.direto = true; }
  job.popups = await popupsDaJucesp(true);
  job.bloqueio = await bloquearTicket(true);
  const aba = await chrome.tabs.create({ url: conhecido ? JUCESP + '/Pre_Visualiza.aspx?nire=' + conhecido + '&idproduto=' : JUCESP + '/Default.aspx' });
  job.jucespTabId = aba.id;
  await mexer(async () => { const todos = await jobs(); todos[job.id] = job; await guardar(todos); });
  falar(job, 'andando', 'Abrindo a JUCESP…');
  return { ok: true };
}

async function enviarAoApps(job, qual, base64) {
  const d = DOCS[qual];
  const corpo = {
    acao: 'painel-arquivo', casoId: job.casoId, nomeArquivo: 'JUCESP_' + d.arquivo + '_' + job.cnpj + '.pdf', mimetype: 'application/pdf',
    base64, tipoSugerido: d.tipo, pessoaSugerida: job.empresa || '', origemAjudante: 'jucesp'
  };
  const r = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(corpo) });
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch (_) { throw new Error('O Apps Script não respondeu em JSON (precisa de nova versão?).'); }
  if (!j || !j.ok) throw new Error((j && j.erro) || 'O Apps Script recusou o arquivo.');
  return j;
}

// O PDF já em mãos (base64): confere, entrega ao Apps Script e anda a fila. Quem o trouxe — a aba do pedido, que o baixou pelo formulário,
// ou o endereço que abriu — não importa daqui para frente.
async function guardarPdf(job, base64) {
  const qual = job.fila[0], d = DOCS[qual];
  if (!d) return;
  try {
    if (!String(base64 || '').startsWith('JVBERi')) throw new Error('O que veio não é um PDF.');
    if (base64.length * 0.75 > MAX_BYTES) throw new Error('PDF maior que 10 MB.');
    const j = await enviarAoApps(job, qual, base64);
    if (job.abaDoPdf != null && job.abaDoPdf !== job.jucespTabId) { try { Promise.resolve(chrome.tabs.remove(job.abaDoPdf)).catch(() => {}); } catch (_) { /* já fechou */ } }   // a aba extra só existia para mostrar o PDF
    for (const t of (job.filhas || [])) { if (t !== job.jucespTabId && t !== job.abaDoPdf) { try { Promise.resolve(chrome.tabs.remove(t)).catch(() => {}); } catch (_) { /* já fechou */ } } }   // as abas que o OK abriu (a lista de cópias) já cumpriram o papel
    const atual = await mudar(job.id, (x) => { x.feitos.push(qual); x.fila.shift(); x.pdfUrl = null; x.abaDoPdf = null; x.manual = false; x.seguiu = false; x.filhas = []; if (qual === 'ficha') { x.fichaLida = true; x.consolidacao = (j && j.consolidacao) || null; } });
    const msg = d.nome + ': guardado no card como ' + j.nome + (j.confirmar ? ' (confirme o nome no card)' : '') + '.';
    if (atual.fila.length) { falar(atual, 'andando', msg + ' Agora: ' + DOCS[atual.fila[0]].nome + '…'); await irParaEmpresa(atual); }
    else {
      await terminar(job.id, 'ok', 'Pronto! ' + msg);
      // O PDF tentava abrir na própria aba do pedido, e o bloqueio a deixou numa página de erro: devolve-a ao site, em vez de deixá-la assim para ela.
      if (job.abaDoPdf != null && job.abaDoPdf === job.jucespTabId) { try { await chrome.tabs.update(job.jucespTabId, { url: JUCESP + '/Default.aspx' }); } catch (_) { /* a aba pode ter fechado */ } }
    }
  } catch (e) {
    await mudar(job.id, (x) => { x.pdfUrl = null; });
    await terminar(job.id, 'erro', 'Não consegui guardar ' + d.nome + ': ' + ((e && e.message) || e) + ' Salve o PDF (Ctrl+S) e arraste para a caixa do card.');
  }
}

// A aba do pedido pode ter virado a página de erro do bloqueio (o PDF tentava abrir NELA) e já não serve para baixar. Então abre-se uma aba auxiliar do site
// da JUCESP — mesma origem, mesmos cookies —, o PDF é buscado de dentro dela uma vez e a aba fecha. Roda no mundo da página, onde o cookie `SameSite` é o dela.
function baixarNaPagina(u) {
  return fetch(u, { credentials: 'same-origin' }).then(async (r) => {
    const b = new Uint8Array(await r.arrayBuffer()), ok = b.length > 4 && String.fromCharCode(b[0], b[1], b[2], b[3]) === '%PDF';
    let t = ''; if (ok) for (let i = 0; i < b.length; i += 0x8000) t += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return { ok, base64: ok ? btoa(t) : '', status: r.status, tipo: r.headers.get('content-type') || '' };
  }).catch((e) => ({ ok: false, erro: String((e && e.message) || e) }));
}
async function buscarPelaAbaAuxiliar(url) {
  if (!chrome.scripting || !chrome.scripting.executeScript) return { ok: false, erro: 'sem a API scripting' };
  const aba = await chrome.tabs.create({ url: JUCESP + '/Default.aspx', active: false });
  try {
    for (let i = 0; i < 40; i++) { const t = await chrome.tabs.get(aba.id); if (t && t.status === 'complete') break; await new Promise((r) => setTimeout(r, 400)); }
    const [res] = await chrome.scripting.executeScript({ target: { tabId: aba.id }, func: baixarNaPagina, args: [url] });
    return (res && res.result) || { ok: false, erro: 'sem resultado' };
  } catch (e) { return { ok: false, erro: String((e && e.message) || e).slice(0, 120) }; }
  finally { try { await chrome.tabs.remove(aba.id); } catch (_) { /* já fechou */ } }
}

// O PDF abriu numa aba (a do pedido ou uma nova): baixa pelo endereço, com a sessão dela.
async function capturar(job, url) {
  const d = DOCS[job.fila[0]];
  if (!d) return;
  falar(job, 'andando', 'Baixando: ' + d.nome + '…');
  try { Promise.resolve(chrome.tabs.sendMessage(job.jucespTabId, { tipo: 'pdf' })).catch(() => {}); } catch (_) { /* a aba pode estar mudando de página */ }
  try {
    // Primeiro pela aba da JUCESP (a sessão e os cookies são os dela); só se a aba não puder, pelo fundo.
    let base64 = null;
    let viaAba = 'sem resposta';
    try { const r = await chrome.tabs.sendMessage(job.jucespTabId, { tipo: 'buscar-pdf', url }); if (r && r.ok && r.base64) { base64 = r.base64; viaAba = 'ok'; } else if (r) viaAba = 'não é PDF (' + (r.status || '?') + ', ' + (r.tipo || r.erro || '?') + ')'; } catch (_) { viaAba = 'aba indisponível'; }
    await mudar(job.id, (x) => { ev(x, { buscaPelaAba: viaAba }); });
    if (!base64) {
      const r = await buscarPelaAbaAuxiliar(url);
      if (r && r.ok && r.base64) base64 = r.base64;
      await mudar(job.id, (x) => { ev(x, { buscaPelaAbaAuxiliar: r && r.ok ? 'ok' : 'falhou (' + ((r && (r.erro || r.status + ' ' + r.tipo)) || '?') + ')' }); });
    }
    if (!base64) {
      const r = await fetch(url, { credentials: 'include' });
      if (!r.ok) throw new Error('A JUCESP respondeu ' + r.status + ' ao baixar o PDF.');
      const bytes = await r.arrayBuffer();
      await mudar(job.id, (x) => { ev(x, { buscaPeloFundo: r.status + ' ' + (r.headers.get('content-type') || '?') + ' ' + bytes.byteLength + 'B' }); });
      if (!bytes.byteLength) throw new Error('PDF vazio.');
      base64 = paraBase64(bytes);
    }
    await guardarPdf(job, base64);
  } catch (e) {
    await mudar(job.id, (x) => { x.pdfUrl = null; });
    await terminar(job.id, 'erro', 'Não consegui guardar ' + d.nome + ': ' + ((e && e.message) || e) + ' Salve o PDF (Ctrl+S) e arraste para a caixa do card.');
  }
}

async function irParaEmpresa(job) {
  if (job.nire) await chrome.tabs.update(job.jucespTabId, { url: JUCESP + '/Pre_Visualiza.aspx?nire=' + job.nire + '&idproduto=' });
  else await chrome.tabs.update(job.jucespTabId, { url: JUCESP + '/Default.aspx' });
}

// ── A RI Digital (ONR): visualização de matrícula e matrícula atualizada ────────────────────────────────────────────────────────────
// O pedido da ONR guarda estado, cidade, cartório e as matrículas (todas do MESMO registro de imóveis). O Ajudante leva a aba até a escolha do pagamento e
// PARA: pagar é clique dela. O PDF que o site baixa depois é pego aqui (downloads), e tudo o que acontece nesse momento fica no registro do pedido —
// como o pedido é pago, não dá para ficar testando, então o relatório diz o que o site fez, mesmo quando o arquivo não chegou ao card.
const rotuloOnr = (job) => (job.servico === 'certidao' ? 'Atualizada' : 'Visualizacao');
async function criarPedidoOnr(p, sender) {
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(String(p.casoId || ''))) return { ok: false, texto: 'Caso inválido.' };
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(String(p.id || ''))) return { ok: false, texto: 'Pedido inválido.' };
  if (p.servico !== 'visualizacao' && p.servico !== 'certidao') return { ok: false, texto: 'Não entendi qual serviço pedir.' };
  const uf = String(p.uf || '').toUpperCase(); if (!/^[A-Z]{2}$/.test(uf)) return { ok: false, texto: 'Estado inválido (use a sigla, como SP).' };
  const cidade = String(p.cidade || '').replace(/[\u0000-\u001f]/g, '').trim(); if (cidade.length < 2 || cidade.length > 80) return { ok: false, texto: 'Falta a cidade do registro de imóveis.' };
  const cartorio = String(p.cartorio || '').replace(/\D/g, ''); if (cartorio.length > 3) return { ok: false, texto: 'Número de cartório inválido.' };
  const mats = (Array.isArray(p.matriculas) ? p.matriculas : []).map((m) => String(m).replace(/\D/g, '')).filter((m, i, a) => m && a.indexOf(m) === i);
  if (!mats.length || mats.some((m) => m.length < 3 || m.length > 12)) return { ok: false, texto: 'Confira o número da matrícula.' };
  if (p.servico === 'visualizacao' && mats.length !== 1) return { ok: false, texto: 'A visualização é uma matrícula por vez.' };
  if (mats.length > 100) return { ok: false, texto: 'O site aceita no máximo 100 matrículas por pedido.' };
  const job = { id: p.id, casoId: p.casoId, site: 'onr', servico: p.servico, uf, cidade, cartorio, matriculas: mats, fila: [], feitos: [], arquivos: [], painelTabId: sender && sender.tab ? sender.tab.id : null, iniciado: Date.now() };
  const aba = await chrome.tabs.create({ url: RIDIGITAL + '/ServicosOnline.aspx' });
  job.jucespTabId = aba.id;   // o campo guarda "a aba do pedido", seja qual for o site
  await mexer(async () => { const todos = await jobs(); for (const x of Object.values(todos)) if (!x.fim && x.site === 'onr') { x.fim = true; x.estado = 'erro'; ev(x, { fim: 'substituido por um pedido novo' }); } todos[job.id] = job; await guardar(todos); });
  falar(job, 'andando', 'Abrindo a RI Digital…');
  return { ok: true };
}
function relatorioOnr(job) {
  let versao = ''; try { versao = chrome.runtime.getManifest().version; } catch (_) { /* sem manifesto */ }
  return JSON.stringify({ versao, site: 'onr', servico: job.servico, uf: job.uf, cidade: job.cidade, cartorio: job.cartorio, matriculas: job.matriculas, pagouEm: job.pagouEm ? Math.round((job.pagouEm - job.iniciado) / 100) / 10 : null, arquivos: (job.arquivos || []).map((a) => a.nome), falhas: job.falhas || [], eventos: job.eventos || [] }, null, 1);
}
function onrResumo(job) {
  const a = job.arquivos || [];
  return 'Pronto! ' + (a.length === 1 ? 'Guardei no card: ' : 'Guardei ' + a.length + ' arquivos no card: ') + a.map((x) => x.nome).join(', ') + '.' + ((job.falhas || []).length ? ' Atenção: ' + job.falhas.length + ' download(s) não pude levar — veja a pasta Downloads.' : '');
}
function onrSemPdf(job) {
  const f = (job.falhas || []);
  if (f.length) return 'O site baixou ' + (f.length === 1 ? 'um arquivo' : f.length + ' arquivos') + ' para a sua pasta Downloads (' + f.map((x) => x.nome || '?').join(', ') + '), mas não consegui levar ao card (' + f[0].erro + '). Arraste o arquivo para a caixa “Solte aqui os arquivos” do card. Copie o relatório e me mande.';
  return 'Passaram 2 minutos desde o pagamento e nenhum arquivo baixou. Veja a pasta Downloads; se o PDF estiver lá, arraste para a caixa do card. Copie o relatório e me mande.';
}
const hostRi = (u) => { try { const h = new URL(u).hostname; return h === 'ridigital.org.br' || h.endsWith('.ridigital.org.br'); } catch (_) { return false; } };
const ehDoRi = (item) => !!item && [item.url, item.finalUrl, item.referrer].some((u) => hostRi(u) || /^blob:https:\/\/([a-z0-9-]+\.)*ridigital\.org\.br\//.test(String(u || '')));
const nomeBase = (n) => String(n || '').split(/[\\/]/).pop().slice(0, 80);
const tipoDoBase64 = (b) => (b.startsWith('JVBERi') ? 'application/pdf' : b.startsWith('iVBOR') ? 'image/png' : b.startsWith('/9j/') ? 'image/jpeg' : null);
const EXT_ONR = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };
// O pedido vivo é o mais recente: um pedido velho que ficou sem terminar (aba fechada, teste pago interrompido) não pode engolir o PDF do pedido de agora.
async function onrJobAtivo() { const todos = await jobs(); return Object.values(todos).filter((j) => !j.fim && j.site === 'onr').sort((a, b) => (b.iniciado || 0) - (a.iniciado || 0))[0] || null; }

// Os bytes do que o site baixou: data: decodifica; blob: só a página lê; o resto, o fundo busca com a sessão dela e, se não der, a própria aba.
async function lerDoDownload(job, url) {
  const via = [];
  const daAba = async () => {
    try { const fresco = (await jobs())[job.id] || job, r = await chrome.tabs.sendMessage(fresco.abaAtiva != null ? fresco.abaAtiva : fresco.jucespTabId, { tipo: 'buscar-url', url }); if (r && r.ok && r.base64) return r.base64; via.push('aba: ' + ((r && (r.erro || r.status)) || 'sem resposta')); }
    catch (_) { via.push('aba indisponível'); }
    return null;
  };
  let b64 = null;
  if (/^data:[^,]*;base64,/i.test(url)) b64 = url.slice(url.indexOf(',') + 1);
  else if (/^blob:/i.test(url)) b64 = await daAba();
  else {
    try {
      const r = await fetch(url, { credentials: 'include' }), buf = await r.arrayBuffer();
      if (r.ok && buf.byteLength) b64 = paraBase64(buf); else via.push('fundo: ' + r.status + ' ' + buf.byteLength + 'B');
    } catch (e) { via.push('fundo: ' + String((e && e.message) || e).slice(0, 60)); }
    if (!b64 || !tipoDoBase64(b64)) { if (b64) via.push('fundo: não é PDF/imagem'); b64 = await daAba(); }
  }
  return { b64, via };
}
async function capturarOnr(job, item, opc) {
  const url = String(item.finalUrl || item.url || '');
  const nome = nomeBase(item.filename);
  try {
    const { b64, via } = item.base64 ? { b64: item.base64, via: [item.via || 'bytes'] } : await lerDoDownload(job, url);
    const mime = b64 && tipoDoBase64(b64);
    await mudar(job.id, (x) => { ev(x, { leitura: mime ? 'ok ' + mime : 'falhou', via: via.join('; ').slice(0, 160) }); });
    if (!mime && opc && opc.silencioso) return;   // página que só parecia ser o arquivo (HTML): não é falha
    if (!mime) throw new Error('não consegui ler o arquivo pelo endereço do download' + (via.length ? ' (' + via[0] + ')' : ''));
    if (b64.length * 0.75 > MAX_BYTES) throw new Error('arquivo maior que 10 MB');
    const atual = (await jobs())[job.id]; if (!atual || atual.fim) { await mudar(job.id, (x) => { ev(x, { semPedido: 'o pedido já tinha terminado' }); (x.falhas = x.falhas || []).push({ nome, erro: 'o pedido já tinha terminado quando o arquivo chegou' }); }); return; }
    const marca = b64.length + ':' + b64.slice(200, 260);   // o mesmo PDF pode chegar por dois caminhos (resposta, download, aba): guarda uma vez
    if ((atual.marcas || []).includes(marca)) { await mudar(atual.id, (x) => { ev(x, { repetido: true }); }); return; }
    await mudar(atual.id, (x) => { (x.marcas = x.marcas || []).push(marca); });
    const tag = atual.matriculas.find((m) => (nome + url).includes(m)) || (atual.matriculas.length === 1 ? atual.matriculas[0] : '');
    const rot = rotuloOnr(atual);
    const corpo = { acao: 'painel-arquivo', casoId: atual.casoId, nomeArquivo: 'RIDIGITAL_' + rot.toUpperCase() + '_' + (tag || 'matricula') + '.' + EXT_ONR[mime], mimetype: mime, base64: b64, tipoSugerido: 'MATRICULA_IMOVEL', pessoaSugerida: rot + (tag ? ' ' + tag : ''), origemAjudante: 'onr' };
    await mudar(atual.id, (x) => { ev(x, { enviando: corpo.nomeArquivo, caso: String(atual.casoId).slice(0, 12), kb: Math.round(b64.length * 0.75 / 1024) }); });
    const r = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(corpo) });
    const txt = await r.text();
    let j; try { j = JSON.parse(txt); } catch (_) { throw new Error('o Apps Script não respondeu em JSON (precisa de nova versão?): ' + txt.replace(/\s+/g, ' ').slice(0, 60)); }
    if (!j || !j.ok) throw new Error((j && j.erro) || 'o Apps Script recusou o arquivo');
    const depois = await mudar(atual.id, (x) => { (x.arquivos = x.arquivos || []).push({ nome: j.nome, mat: tag }); x.ultimoArquivoEm = Date.now(); ev(x, { guardado: j.nome }); });
    falar(depois, 'andando', 'Guardei no card: ' + j.nome + (j.confirmar ? ' (confirme o nome no card)' : '') + '.');
    try { Promise.resolve(chrome.tabs.sendMessage(depois.jucespTabId, { tipo: 'progresso-onr', texto: 'Guardei no card: ' + j.nome + '.' })).catch(() => {}); } catch (_) { /* a aba pode ter fechado */ }
  } catch (e) {
    await mudar(job.id, (x) => { (x.falhas = x.falhas || []).push({ nome, erro: String((e && e.message) || e).slice(0, 140) }); });
  }
}
async function onrBaixou(item) {
  if (!ehDoRi(item)) return;
  const job = await onrJobAtivo(); if (!job) return;
  await mudar(job.id, (x) => { ev(x, { download: { id: item.id, url: String(item.finalUrl || item.url || '').slice(0, 60).replace(/\?.*$/, ''), mime: item.mime || '', nome: nomeBase(item.filename) } }); });
  await capturarOnr(job, item);
}
chrome.downloads && chrome.downloads.onCreated && chrome.downloads.onCreated.addListener((item) => { onrBaixou(item).catch(() => {}); });
chrome.downloads && chrome.downloads.onChanged && chrome.downloads.onChanged.addListener((d) => {
  if (!d || !d.state || !chrome.downloads.search) return;
  (async () => {
    const job = await onrJobAtivo(); if (!job) return;
    const [item] = await chrome.downloads.search({ id: d.id }); if (!ehDoRi(item)) return;
    await mudar(job.id, (x) => { ev(x, { downloadFim: { id: d.id, estado: d.state.current, nome: nomeBase(item.filename), bytes: item.fileSize || item.totalBytes || 0, erro: (d.error && d.error.current) || '' } }); });
  })().catch(() => {});
});

// ── A Prefeitura de São Paulo: valor venal de referência ──
// Sem login nem pagamento: a página responde na mesma tela, e o que se guarda é a FOTO dela (o que ela fazia ao imprimir a tela).
// O que importa é que o arquivo seja do contribuinte pedido — quem confere isso é a página (prefeitura.js), que só entrega o resultado
// quando o SQL da resposta é o do pedido.
function dataValida(d) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(d || '')); if (!m) return false;
  const dt = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return dt.getFullYear() === Number(m[3]) && dt.getMonth() === Number(m[2]) - 1 && dt.getDate() === Number(m[1]);
}
const sqlFormatado = (d) => d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 10) + '-' + d.slice(10);
async function criarPedidoPref(p, sender) {
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(String(p.casoId || ''))) return { ok: false, texto: 'Caso inválido.' };
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(String(p.id || ''))) return { ok: false, texto: 'Pedido inválido.' };
  const srv = PREF_SERVICOS[p.servico]; if (!srv) return { ok: false, texto: 'Não entendi qual certidão pedir.' };
  const sql = String(p.sql || '').replace(/\D/g, ''); if (sql.length !== 11) return { ok: false, texto: 'O número do contribuinte precisa ter 11 dígitos (setor, quadra, lote e dígito).' };
  const data = String(p.data || '').trim(); if (srv.data && !dataValida(data)) return { ok: false, texto: 'Escreva a data como dd/mm/aaaa (uma data que exista).' };
  const job = { id: p.id, casoId: p.casoId, site: 'pref', servico: p.servico, sql, sqlFormatado: sqlFormatado(sql), data: srv.data ? data : '', fila: [], feitos: [], arquivos: [], painelTabId: sender && sender.tab ? sender.tab.id : null, iniciado: Date.now() };
  const aba = await chrome.tabs.create({ url: srv.url });
  job.jucespTabId = aba.id; job.windowId = aba.windowId;   // o campo guarda "a aba do pedido", seja qual for o site
  await mexer(async () => { const todos = await jobs(); for (const x of Object.values(todos)) if (!x.fim && x.site === 'pref') { x.fim = true; x.estado = 'erro'; ev(x, { fim: 'substituido por um pedido novo' }); } todos[job.id] = job; await guardar(todos); });
  falar(job, 'andando', srv.data ? 'Abrindo a consulta de valor venal da prefeitura…' : 'Abrindo a emissão da certidão na prefeitura…');
  return { ok: true };
}
function relatorioPref(job) {
  let versao = ''; try { versao = chrome.runtime.getManifest().version; } catch (_) { /* sem manifesto */ }
  return JSON.stringify({ versao, site: 'pref', servico: job.servico, sql: job.sqlFormatado, data: job.data, arquivos: (job.arquivos || []).map((a) => a.nome), falhas: job.falhas || [], eventos: job.eventos || [] }, null, 1);
}
// A foto da aba do pedido: a captura é da aba que está à frente na janela, então ela é trazida para a frente antes.
async function fotoDaAba(job, sender) {
  const janela = (sender && sender.tab && sender.tab.windowId) != null ? sender.tab.windowId : job.windowId;
  try { await chrome.tabs.update(job.jucespTabId, { active: true }); } catch (_) { /* a aba pode ter sido movida */ }
  await new Promise((r) => setTimeout(r, 350));
  const url = await chrome.tabs.captureVisibleTab(janela, { format: 'png' });
  const b64 = String(url || '').slice(String(url || '').indexOf(',') + 1);
  if (!b64 || !b64.startsWith('iVBOR')) throw new Error('a foto da tela não saiu em PNG');
  return b64;
}
async function guardarPref(job, r, sender) {
  const b64 = await fotoDaAba(job, sender);
  if (b64.length * 0.75 > MAX_BYTES) throw new Error('a foto da tela ficou maior que 10 MB');
  await mudar(job.id, (x) => { ev(x, { enviando: 'VALOR_VENAL_REFERENCIA', kb: Math.round(b64.length * 0.75 / 1024) }); });
  const corpo = { acao: 'painel-arquivo', casoId: job.casoId, nomeArquivo: 'VALOR_VENAL_REFERENCIA_' + job.sql + '.png', mimetype: 'image/png', base64: b64, tipoSugerido: 'VALOR_VENAL_REFERENCIA', pessoaSugerida: job.sqlFormatado, origemAjudante: 'prefeitura' };
  const resp = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(corpo) });
  const txt = await resp.text();
  let j; try { j = JSON.parse(txt); } catch (_) { throw new Error('o Apps Script não respondeu em JSON (precisa de nova versão?): ' + txt.replace(/\s+/g, ' ').slice(0, 60)); }
  if (!j || !j.ok) throw new Error((j && j.erro) || 'o Apps Script recusou o arquivo');
  await mudar(job.id, (x) => { (x.arquivos = x.arquivos || []).push({ nome: j.nome }); ev(x, { guardado: j.nome }); });
  await terminar(job.id, 'ok', 'Valor venal de referência ' + r.valor + ' em ' + job.data + ' — ' + r.sql + ', ' + String(r.endereco || '').slice(0, 90) + '. Guardei no card: ' + j.nome + (j.confirmar ? ' (confirme o nome no card)' : '') + '.');
}

// ── A certidão tributária de IPTU: o PDF sai quando ela clica em Emitir (o captcha é dela) ──
// A prefeitura gera o arquivo na hora e avisa na tela; ele chega como download (ou abre numa aba). Pega-se pelo mesmo caminho da RI Digital:
// download do site da prefeitura enquanto há pedido esperando arquivo, bytes lidos com a sessão dela. Nunca se cancela nem se apaga o download dela.
const hostPref = (u) => { try { const h = new URL(u).hostname; return h === 'prefeitura.sp.gov.br' || h.endsWith('.prefeitura.sp.gov.br'); } catch (_) { return false; } };
const ehDaPref = (item) => !!item && [item.url, item.finalUrl, item.referrer].some((u) => hostPref(u) || /^blob:https:\/\/([a-z0-9-]+\.)*prefeitura\.sp\.gov\.br\//.test(String(u || '')));
async function prefJobEsperandoArquivo() {
  const todos = await jobs();
  return Object.values(todos).filter((j) => !j.fim && j.site === 'pref' && j.servico === 'negativa-iptu').sort((a, b) => (b.iniciado || 0) - (a.iniciado || 0))[0] || null;
}
async function capturarPref(job, item, opc) {
  const url = String(item.finalUrl || item.url || ''), nome = nomeBase(item.filename), srv = PREF_SERVICOS[job.servico];
  try {
    const { b64, via } = item.base64 ? { b64: item.base64, via: [item.via || 'bytes'] } : await lerDoDownload(job, url);
    const mime = b64 && tipoDoBase64(b64);
    await mudar(job.id, (x) => { ev(x, { leitura: mime ? 'ok ' + mime : 'falhou', via: via.join('; ').slice(0, 160) }); });
    if (!mime && opc && opc.silencioso) return;   // página que só parecia ser o arquivo (HTML): não é falha
    if (!mime) throw new Error('não consegui ler o arquivo pelo endereço do download' + (via.length ? ' (' + via[0] + ')' : ''));
    if (b64.length * 0.75 > MAX_BYTES) throw new Error('arquivo maior que 10 MB');
    const atual = (await jobs())[job.id]; if (!atual || atual.fim) return;
    const marca = b64.length + ':' + b64.slice(200, 260);
    if ((atual.marcas || []).includes(marca)) { await mudar(atual.id, (x) => { ev(x, { repetido: true }); }); return; }
    await mudar(atual.id, (x) => { (x.marcas = x.marcas || []).push(marca); ev(x, { enviando: srv.tipo, kb: Math.round(b64.length * 0.75 / 1024) }); });
    const corpo = { acao: 'painel-arquivo', casoId: atual.casoId, nomeArquivo: srv.arquivo + '_' + atual.sql + '.' + EXT_ONR[mime], mimetype: mime, base64: b64, tipoSugerido: srv.tipo, pessoaSugerida: atual.sqlFormatado, origemAjudante: 'prefeitura' };
    const resp = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(corpo) }), txt = await resp.text();
    let j; try { j = JSON.parse(txt); } catch (_) { throw new Error('o Apps Script não respondeu em JSON (precisa de nova versão?): ' + txt.replace(/\s+/g, ' ').slice(0, 60)); }
    if (!j || !j.ok) throw new Error((j && j.erro) || 'o Apps Script recusou o arquivo');
    await mudar(atual.id, (x) => { (x.arquivos = x.arquivos || []).push({ nome: j.nome }); ev(x, { guardado: j.nome }); });
    await terminar(atual.id, 'ok', srv.nome + ' do imóvel ' + atual.sqlFormatado + ': guardei no card como ' + j.nome + (j.confirmar ? ' (confirme o nome no card)' : '') + '. Abra o PDF e confira se é a certidão NEGATIVA.');
  } catch (e) {
    await mudar(job.id, (x) => { (x.falhas = x.falhas || []).push({ nome, erro: String((e && e.message) || e).slice(0, 140) }); });
    await terminar(job.id, 'erro', 'A prefeitura emitiu, mas não consegui guardar o PDF no card: ' + String((e && e.message) || e).slice(0, 120) + '. Ele está na pasta Downloads — arraste para a caixa do card.');
  }
}
chrome.downloads && chrome.downloads.onCreated && chrome.downloads.onCreated.addListener((item) => {
  (async () => { if (!ehDaPref(item)) return; const job = await prefJobEsperandoArquivo(); if (!job) return; await mudar(job.id, (x) => { ev(x, { download: { id: item.id, url: String(item.finalUrl || item.url || '').slice(0, 60).replace(/\?.*$/, ''), mime: item.mime || '', nome: nomeBase(item.filename) } }); }); await capturarPref(job, item); })().catch(() => {});
});
// O PDF também pode abrir numa aba nova (ou em blob:), sem "download": quando uma aba do pedido vai para um endereço assim, tenta-se ler.
async function prefAba(tabId, info, aba) {
  const url = String((aba && aba.url) || info.url || ''); if (!url) return;
  if (!(hostPref(url) || /^blob:https:\/\/([a-z0-9-]+\.)*prefeitura\.sp\.gov\.br\//.test(url))) return;
  const job = await prefJobEsperandoArquivo(); if (!job) return;
  const filha = tabId !== job.jucespTabId && ((job.filhas || []).includes(tabId) || (aba && aba.openerTabId === job.jucespTabId));
  let caminho = ''; try { caminho = new URL(url).pathname; } catch (_) { /* blob: sem caminho */ }
  if (!(filha || (tabId === job.jucespTabId && (/^blob:/.test(url) || /(pdf|download|arquivo|imprime|\.ashx)/i.test(caminho))))) return;
  const chave = url.slice(0, 120);
  const novo = await mudar(job.id, (x) => { if ((x.urlsVistas || []).includes(chave)) return null; (x.urlsVistas = x.urlsVistas || []).push(chave); ev(x, { aba: filha ? 'filha' : 'pedido', url: semQuery(url).slice(0, 70) }); return x; });
  if (!novo) return;
  await capturarPref(job, { url, filename: '' }, { silencioso: true });
}

chrome.runtime.onMessage.addListener((m, sender, responder) => {
  (async () => {
    if (!m) return responder(null);
    if (m.tipo === 'pedido') return responder(await criarPedido(m.pedido, sender));
    const job = sender && sender.tab ? await jobDaAba(sender.tab.id) : null;
    if (m.tipo === 'quem') {
      // A aba nova assumiu: a aba do pedido para de vigiar o OK que ela mesma clicou.
      if (job && job.jucespTabId !== sender.tab.id && !job.seguiu) { await mudar(job.id, (x) => { x.seguiu = true; ev(x, { seguiuNaAba: sender.tab.id }); }); try { Promise.resolve(chrome.tabs.sendMessage(job.jucespTabId, { tipo: 'seguiu' })).catch(() => {}); } catch (_) { /* a aba pode ter fechado */ } }
      return responder(job);
    }
    if (m.tipo === 'cancelar') {
      const todos = await jobs(), alvo = todos[m.id];
      if (alvo && sender.tab && sender.tab.id === alvo.painelTabId) await terminar(m.id, 'erro', 'Cancelado.');
      return responder({ ok: true });
    }
    if (!job) return responder(null);
    // Um erro da página não encerra o pedido: ela pode escolher "Fazer à mão" e o PDF ainda será pego.
    if (m.tipo === 'status') { if (m.fatal) await terminar(job.id, 'erro', String(m.texto || '')); else falar(job, m.estado, m.texto); return responder({ ok: true }); }
    if (m.tipo === 'nire') {
      const x = await mudar(job.id, (j) => { j.nire = String(m.nire || '').replace(/\D/g, '') || j.nire; if (m.empresa) j.empresa = String(m.empresa).slice(0, 120); });
      if (m.empresa && x && /^\d{11}$/.test(x.nire || '')) await lembrarNire(x.cnpj, x.nire);   // só o que veio do resultado da busca por esse CNPJ
      return responder({ ok: true });
    }
    if (job.site === 'pref') {
      if (m.tipo === 'pref-pagina') { await mudar(job.id, (x) => { x.abaAtiva = sender.tab.id; ev(x, { pagina: String(m.texto || '').slice(0, 80), registro: m.registro ? String(m.registro).slice(0, 40) : undefined }); }); falar(job, m.estado === 'espera' ? 'espera' : 'andando', String(m.texto || '').slice(0, 160)); return responder({ ok: true }); }
      if (m.tipo === 'pref-emitida') { await mudar(job.id, (x) => { x.abaAtiva = sender.tab.id; if (!x.emitidaEm) { x.emitidaEm = Date.now(); ev(x, { emitida: true }); } }); falar(job, 'andando', 'A prefeitura emitiu a certidão — guardando o PDF…'); return responder({ ok: true }); }
      if (m.tipo === 'pref-vigia') {
        if (job.emitidaEm && !(job.arquivos || []).length && Date.now() - job.emitidaEm > 90000) await terminar(job.id, 'erro', 'A prefeitura emitiu, mas o PDF não chegou até mim em 90 segundos. Veja a pasta Downloads: se estiver lá, arraste para a caixa do card.');
        return responder({ ok: true });
      }
      if (m.tipo === 'pref-erro') { await mudar(job.id, (x) => { ev(x, { erro: String(m.texto || '').slice(0, 120) }); }); await terminar(job.id, 'erro', String(m.texto || '').slice(0, 300)); return responder({ ok: true }); }
      if (m.tipo === 'pref-resultado' && job.servico === 'valor-venal') {
        responder({ ok: true });
        const r = { sql: String(m.sql || ''), valor: String(m.valor || '').slice(0, 40), endereco: String(m.endereco || '').slice(0, 200) };
        await mudar(job.id, (x) => { ev(x, { resultado: r.valor }); });
        try { await guardarPref(job, r, sender); }
        catch (e) { await mudar(job.id, (x) => { (x.falhas = x.falhas || []).push({ erro: String((e && e.message) || e).slice(0, 140) }); }); await terminar(job.id, 'erro', 'A prefeitura respondeu (' + r.valor + ') mas não consegui guardar a foto no card: ' + String((e && e.message) || e).slice(0, 120) + '. Tire um print da tela e arraste para a caixa do card.'); }
        return;
      }
    }
    if (job.site === 'onr') {
      if (m.tipo === 'onr-pagina') { await mudar(job.id, (x) => { x.abaAtiva = sender.tab.id; const u = (x.eventos || []).filter((e) => e.tela).pop(); if (!u || u.tela !== m.tela || u.caminho !== m.caminho) ev(x, { tela: String(m.tela || '').slice(0, 20), caminho: semQuery(String(m.caminho || '')).slice(0, 80) }); }); return responder({ ok: true }); }
      if (m.tipo === 'onr-pagou') { await mudar(job.id, (x) => { x.pagouEm = x.pagouEm || Date.now(); ev(x, { pagou: String(m.botao || '').slice(0, 40) }); }); return responder({ ok: true }); }
      if (m.tipo === 'onr-bytes') { responder({ ok: true }); await capturarOnr(job, { base64: String(m.base64 || ''), via: String(m.via || 'bytes'), url: '', filename: '' }); return; }
      if (m.tipo === 'onr-diag') { await mudar(job.id, (x) => { ev(x, { diag: JSON.stringify(m.diag || {}).slice(0, 500) }); }); return responder({ ok: true }); }
      if (m.tipo === 'onr-vigia') {
        const agora = Date.now(), n = (job.arquivos || []).length;
        if (n && agora - (job.ultimoArquivoEm || 0) > 25000) await terminar(job.id, 'ok', onrResumo(job));
        else if (!n && job.pagouEm && agora - job.pagouEm > 120000) await terminar(job.id, 'erro', onrSemPdf(job));
        return responder({ ok: true });
      }
    }
    if (m.tipo === 'diagnostico-fundo') return responder({ popups: job.popups || '', bloqueio: job.bloqueio || '', eventos: job.eventos || [] });
    // A aba do pedido pediu o PDF pelo formulário e o trouxe de volta (sem abrir aba nenhuma): é o caminho normal.
    if (m.tipo === 'pdf-bytes') { responder({ ok: true }); await guardarPdf(job, String(m.base64 || '')); return; }
    if (m.tipo === 'manual') { await mudar(job.id, (x) => { x.manual = true; }); return responder({ ok: true }); }
    responder(null);
  })().catch(() => responder(null));
  return true;
});

// O PDF abre na própria aba; é aí que ele é pego. Vale tanto para o caminho automático quanto para quando ela assumiu à mão.
// O PDF abre na própria aba do pedido ou numa aba nova aberta por ela (a JUCESP faz as duas coisas, conforme o botão).
function avisarTicket(tabId, url, opener) {
  mexer(async () => {
    const todos = await jobs(), job = Object.values(todos).find((j) => !j.fim && (j.jucespTabId === tabId || (j.filhas || []).includes(tabId) || (opener != null && j.jucespTabId === opener)));
    if (!job || job.pdfUrl === url) return null;
    job.pdfUrl = url; job.abaDoPdf = tabId; ev(job, { pdfEm: semQuery(url), aba: tabId === job.jucespTabId ? 'a do pedido' : 'nova' }); await guardar(todos); return job;
  }).then((job) => { if (job) return capturar(job, url); }).catch(() => {});
}
// A matrícula pode abrir como PDF numa aba nova (ou em blob:), sem "download": quando uma aba do pedido da RI Digital vai para um endereço assim, tenta-se ler o arquivo.
async function onrAba(tabId, info, aba) {
  const url = String((aba && aba.url) || info.url || ''); if (!url) return;
  const ri = hostRi(url) || /^blob:https:\/\/([a-z0-9-]+\.)*ridigital\.org\.br\//.test(url); if (!ri) return;
  const job = await onrJobAtivo(); if (!job) return;
  const filha = tabId !== job.jucespTabId && ((job.filhas || []).includes(tabId) || (aba && aba.openerTabId === job.jucespTabId));
  let caminho = ''; try { caminho = new URL(url).pathname; } catch (_) { /* blob: sem caminho */ }
  if (!(filha || (tabId === job.jucespTabId && (/^blob:/.test(url) || /(pdf|download|arquivo|baixar|\.ashx)/i.test(caminho))))) return;
  const chave = url.slice(0, 120);
  const novo = await mudar(job.id, (x) => { if ((x.urlsVistas || []).includes(chave)) return null; (x.urlsVistas = x.urlsVistas || []).push(chave); ev(x, { aba: filha ? 'filha' : 'pedido', url: semQuery(url).slice(0, 70) }); return x; });
  if (!novo) return;
  await capturarOnr(job, { url, filename: '' }, { silencioso: true });
}
chrome.tabs.onUpdated.addListener((tabId, info, aba) => {
  onrAba(tabId, info, aba).catch(() => {});
  prefAba(tabId, info, aba).catch(() => {});
  const url = (aba && aba.url) || info.url || '';
  if (!/\/VisualizaTicket\.aspx/i.test(url) || new URL(url).origin !== JUCESP) return;
  avisarTicket(tabId, url, aba && aba.openerTabId);
});

chrome.tabs.onCreated && chrome.tabs.onCreated.addListener((aba) => {
  if (!aba || aba.openerTabId == null) return;
  mudar_se_job_da_aba(aba.openerTabId, (j) => { ev(j, { abaCriada: semQuery(aba.pendingUrl || aba.url || '') || '(sem endereço)' }); (j.filhas = j.filhas || []).push(aba.id); });
});

// O Chrome avisa que vai navegar ao endereço do PDF ANTES de pedi-lo (e a regra acima impede o pedido): é a hora de baixá-lo, uma vez só.
chrome.webNavigation && chrome.webNavigation.onBeforeNavigate.addListener((d) => {
  if (!d || !/\/VisualizaTicket\.aspx/i.test(d.url || '')) return;
  let origem; try { origem = new URL(d.url).origin; } catch (_) { return; }
  if (origem !== JUCESP) return;
  avisarTicket(d.tabId, d.url);
});
async function mudar_se_job_da_aba(tabId, f) {
  const todos = await jobs(), job = Object.values(todos).find((j) => !j.fim && j.jucespTabId === tabId);
  if (job) await mudar(job.id, f);
}

chrome.tabs.onRemoved.addListener((tabId) => {
  mexer(async () => { const todos = await jobs(); const job = Object.values(todos).find((j) => j.jucespTabId === tabId && !j.fim); return job ? { ...job } : null; })
    .then((job) => { if (!job) return; if (job.site === 'onr' && (job.arquivos || []).length) return terminar(job.id, 'ok', onrResumo(job)); return terminar(job.id, 'erro', 'A aba ' + (job.site === 'onr' ? 'da RI Digital' : 'da JUCESP') + ' foi fechada antes de terminar.'); }).catch(() => {});
});

if (typeof module !== 'undefined') module.exports = { cnpjValido, paraBase64, DOCS };
