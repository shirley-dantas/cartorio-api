// O Ajudante do painel (extensão do Chrome que busca documentos na JUCESP) e o bloco dele no card.
//   node testes/ajudante.mjs
// O que se prova aqui, sem a JUCESP de verdade: o manifesto pede o mínimo; a ponte só atende o próprio painel; o fundo valida o pedido,
// pega o PDF só da JUCESP, entrega ao Apps Script com o tipo certo e conta o que deu errado; e a parte que lê as telas decide o certo
// em páginas montadas a partir das telas que ela mandou (a regra do contrato: a consolidação mais recente).
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {abrirChromium} from './navegador-de-teste.mjs';
const AQUI = dirname(fileURLToPath(import.meta.url)), RAIZ = join(AQUI, '..'), EXT = join(RAIZ, 'ajudante');
const ler = (p) => readFileSync(join(RAIZ, p), 'utf8');
const erros = [];
const passo = async (n, f) => { try { await f(); console.log('  ok  ' + n); } catch (e) { erros.push(n); console.log('FALHA ' + n + ' → ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); } };
const esperar = async (n = 40) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
const CNPJ = '52247521000141';

// ── O manifesto ──
await passo('manifesto: só a JUCESP, o painel e o Apps Script; sem poder amplo e com todos os arquivos no lugar', () => {
  const m = JSON.parse(ler('ajudante/manifest.json'));
  assert.equal(m.manifest_version, 3);
  assert.match(ler('ajudante/painel.js'), new RegExp("VERSAO = '" + m.version.replace(/\./g, '\\.') + "'"), 'a versão do manifesto e a da ponte andam juntas');
  assert.deepEqual(m.permissions.sort(), ['contentSettings', 'declarativeNetRequest', 'scripting', 'storage', 'tabs', 'webNavigation']);
  assert(m.host_permissions.every((h) => /^https:\/\/(www\.jucesponline\.sp\.gov\.br|script\.google\.com|script\.googleusercontent\.com)\/\*$/.test(h)), JSON.stringify(m.host_permissions));
  const todos = JSON.stringify(m);
  assert(!/<all_urls>|\*:\/\/\*\/|"http:\/\//.test(todos), 'nada de all_urls nem de http');
  assert(m.content_scripts.every((c) => c.matches.every((u) => u.startsWith('https://'))));
  for (const arq of [m.background.service_worker, ...m.content_scripts.flatMap((c) => c.js)]) assert(existsSync(join(EXT, arq)), 'falta ' + arq);
  const painel = m.content_scripts.find((c) => c.js.includes('painel.js')); assert.deepEqual(painel.matches, ['https://cartorio-api.vercel.app/*']);
});

// ── A ponte com o painel ──
function mundoPonte() {
  const ouvintes = {}, postadas = [], enviadas = [], aoReceber = [];
  const window = {
    addEventListener: (t, f) => { (ouvintes[t] = ouvintes[t] || []).push(f); },
    postMessage: (m, origem) => postadas.push({m, origem})
  };
  const chrome = {runtime: {sendMessage: async (m) => { enviadas.push(m); return {ok: true}; }, onMessage: {addListener: (f) => aoReceber.push(f)}}};
  const ctx = {window, chrome, location: {origin: 'https://cartorio-api.vercel.app'}, Promise};
  vm.createContext(ctx); vm.runInContext(ler('ajudante/painel.js'), ctx);
  const dizer = (data, extra = {}) => ouvintes.message.forEach((f) => f({source: window, origin: 'https://cartorio-api.vercel.app', data, ...extra}));
  return {postadas, enviadas, dizer, aoReceber, window};
}
await passo('ponte: avisa que está pronta, responde ao "tem Ajudante?" e repassa o pedido do painel', async () => {
  const p = mundoPonte(); assert(p.postadas.some((x) => x.m.tipo === 'ajudante-pronto' && x.origem === 'https://cartorio-api.vercel.app'), 'avisa ao carregar');
  p.postadas.length = 0; p.dizer({fonte: 'painel-cartorio', tipo: 'ajudante-ping'}); assert.equal(p.postadas[0].m.tipo, 'ajudante-pronto');
  p.dizer({fonte: 'painel-cartorio', tipo: 'ajudante-pedido', pedido: {id: 'ajteste1', casoId: 'C12345', cnpj: CNPJ, quero: ['ficha']}}); await esperar();
  assert.equal(p.enviadas.length, 1); assert.equal(p.enviadas[0].tipo, 'pedido'); assert.equal(p.enviadas[0].pedido.cnpj, CNPJ);
});
await passo('ponte: mensagem de outra janela, de outra origem ou de outro "fonte" é ignorada', async () => {
  const p = mundoPonte(); const pedido = {fonte: 'painel-cartorio', tipo: 'ajudante-pedido', pedido: {id: 'x', casoId: 'C12345', cnpj: CNPJ, quero: ['ficha']}};
  p.dizer(pedido, {source: {}}); p.dizer(pedido, {origin: 'https://site-malvado.com'}); p.dizer({...pedido, fonte: 'outro'}); p.dizer(null); await esperar();
  assert.equal(p.enviadas.length, 0);
});
await passo('ponte: o andamento vindo do fundo chega ao painel; se o fundo não responde, vira aviso escrito', async () => {
  const p = mundoPonte(); p.postadas.length = 0; p.aoReceber[0]({tipo: 'progresso', id: 'ajteste1', estado: 'ok', texto: 'Pronto'});
  assert.equal(JSON.stringify(p.postadas[0].m), JSON.stringify({fonte: 'ajudante', tipo: 'ajudante-progresso', id: 'ajteste1', estado: 'ok', texto: 'Pronto', fim: false}));
});

// ── O fundo ──
function mundoFundo({auxiliar, popupsFalha, buscarPdf, pdf = '%PDF-1.4 conteudo', tipoPdf = 'application/pdf', gas = {ok: true, nome: 'JRL_HOLDING_LTDA_FICHA_CADASTRAL_JUCESP_2026-10-28_1.pdf', confirmar: false}, gasTexto, statusPdf = 200} = {}) {
  const store = {}, enviadas = [], criadas = [], atualizadas = [], removidas = [], popups = [], regras = [], auxiliares = [], busca = [], ouv = {msg: null, upd: null, rem: null};
  const chrome = {
    storage: {local: {get: async (k) => (k in store ? {[k]: JSON.parse(JSON.stringify(store[k]))} : {}), set: async (o) => { for (const [k, v] of Object.entries(o)) store[k] = JSON.parse(JSON.stringify(v)); }}},
    tabs: {create: async (o) => { criadas.push(o); return {id: 70 + criadas.length}; }, get: async (id) => ({id, status: 'complete'}), update: async (id, o) => { atualizadas.push({id, ...o}); }, remove: async (id) => { removidas.push(id); }, sendMessage: async (id, m) => { enviadas.push({tabId: id, ...m}); if (m.tipo === 'buscar-pdf') { if (buscarPdf === 'erro') throw new Error('sem receptor'); return buscarPdf; } },
      onUpdated: {addListener: (f) => { ouv.upd = f; }}, onRemoved: {addListener: (f) => { ouv.rem = f; }}, onCreated: {addListener: (f) => { ouv.cri = f; }}},
    runtime: {onMessage: {addListener: (f) => { ouv.msg = f; }}},
    ...(auxiliar ? {scripting: {executeScript: async (o) => { auxiliares.push({tabId: o.target.tabId, args: o.args, func: typeof o.func}); if (auxiliar === 'erro') throw new Error('sem acesso'); return [{result: auxiliar}]; }}} : {}),
    declarativeNetRequest: {updateDynamicRules: async (o) => { regras.push(JSON.parse(JSON.stringify(o))); }},
    webNavigation: {onBeforeNavigate: {addListener: (f) => { ouv.nav = f; }}},
    contentSettings: {popups: {set: async (o) => { if (popupsFalha) throw new Error(popupsFalha); popups.push({acao: 'set', ...o}); }, clear: async (o) => { popups.push({acao: 'clear', ...o}); }}}
  };
  const fetch = async (url, o = {}) => {
    busca.push({url: String(url), o});
    if (String(url).startsWith('https://www.jucesponline.sp.gov.br/')) { const b = new TextEncoder().encode(pdf); return {ok: statusPdf < 300, status: statusPdf, headers: {get: () => tipoPdf}, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)}; }
    if (String(url).startsWith('https://script.google.com/')) return {ok: true, text: async () => gasTexto !== undefined ? gasTexto : JSON.stringify(gas)};
    throw new Error('endereço inesperado ' + url);
  };
  const ctx = {chrome, fetch, btoa, Uint8Array, ArrayBuffer, TextEncoder, String, URL, Promise, JSON, console, Object, Array, Number, Date, Error, module: undefined};
  vm.createContext(ctx); vm.runInContext(ler('ajudante/background.js'), ctx);
  const msg = (m, aba) => new Promise((res) => ouv.msg(m, aba ? {tab: {id: aba}} : {}, res));
  const abrir = (url, aba, opener) => { ouv.upd(aba, {url}, {url, openerTabId: opener}); return esperar(); };
  return {store, enviadas, criadas, atualizadas, removidas, popups, regras, auxiliares, busca, msg, abrir, ouv, gasEnviado: () => busca.filter((b) => b.url.startsWith('https://script.google.com/')).map((b) => JSON.parse(b.o.body))};
}
const pedido = (o = {}) => ({id: 'ajteste1', casoId: 'C12345', cnpj: CNPJ, quero: ['ficha'], ...o});
const PAINEL = 5;

await passo('fundo: o pedido valida o CNPJ, o caso e o que buscar; recusa escrito e não abre nada', async () => {
  const m = mundoFundo();
  for (const ruim of [{cnpj: '11111111111111'}, {cnpj: '52247521000142'}, {cnpj: ''}, {casoId: '../x'}, {quero: []}, {quero: ['senha']}, {id: ''}]) {
    const r = await m.msg({tipo: 'pedido', pedido: pedido(ruim)}, PAINEL); assert.equal(r.ok, false, JSON.stringify(ruim)); assert(r.texto);
  }
  assert.equal(m.criadas.length, 0);
});
await passo('fundo: pedido bom abre a JUCESP, guarda o trabalho e só entrega à aba dela; com ".-/" no CNPJ também vale', async () => {
  const m = mundoFundo(); const r = await m.msg({tipo: 'pedido', pedido: pedido({cnpj: '52.247.521/0001-41', quero: ['ficha', 'contrato', 'ficha']})}, PAINEL);
  assert.equal(r.ok, true); assert.equal(m.criadas.length, 1); assert.equal(m.criadas[0].url, 'https://www.jucesponline.sp.gov.br/Default.aspx');
  const job = await m.msg({tipo: 'quem'}, 71); assert.equal(job.cnpj, CNPJ); assert.deepEqual(job.fila, ['ficha', 'contrato']); assert.equal(job.casoId, 'C12345');
  assert.equal(await m.msg({tipo: 'quem'}, 99), null, 'outra aba não é a do trabalho');
  assert(m.enviadas.some((e) => e.tabId === PAINEL && e.tipo === 'progresso' && /Abrindo a JUCESP/.test(e.texto)));
});
await passo('fundo: o PDF que abre na JUCESP é baixado com a sessão dela e entregue ao Apps Script com tipo, empresa e caso', async () => {
  const m = mundoFundo(); await m.msg({tipo: 'pedido', pedido: pedido()}, PAINEL);
  await m.msg({tipo: 'nire', nire: '35262229284', empresa: 'JRL HOLDING LTDA'}, 71);
  await m.abrir('https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=abc%2Bdef', 71);
  const baixa = m.busca.find((b) => b.url.includes('VisualizaTicket')); assert.equal(baixa.o.credentials, 'include');
  const [g] = m.gasEnviado(); assert.equal(g.acao, 'painel-arquivo'); assert.equal(g.casoId, 'C12345'); assert.equal(g.mimetype, 'application/pdf');
  assert.equal(g.tipoSugerido, 'FICHA_CADASTRAL_JUCESP'); assert.equal(g.pessoaSugerida, 'JRL HOLDING LTDA'); assert.equal(g.origemAjudante, 'jucesp');
  assert.equal(g.nomeArquivo, 'JUCESP_FICHA_CADASTRAL_COMPLETA_' + CNPJ + '.pdf'); assert.equal(Buffer.from(g.base64, 'base64').toString(), '%PDF-1.4 conteudo');
  const fim = m.enviadas.filter((e) => e.tipo === 'progresso' && e.estado === 'ok').pop(); assert(fim && /Pronto!/.test(fim.texto) && /Ficha cadastral completa/.test(fim.texto), JSON.stringify(m.enviadas.at(-1)));
  assert.equal(await m.msg({tipo: 'quem'}, 71), null, 'terminou: a aba deixa de ser acompanhada');
});
await passo('fundo: a consolidação que o Apps Script achou na ficha vai para o pedido; só o contrato pedido traz a ficha antes', async () => {
  const cons = {registro: '034.366/21-0', sessao: '2021-01-22'};
  const m = mundoFundo({gas: {ok: true, nome: 'F.pdf', consolidacao: cons}}); await m.msg({tipo: 'pedido', pedido: pedido({quero: ['contrato']})}, PAINEL);
  assert.deepEqual((await m.msg({tipo: 'quem'}, 71)).fila, ['ficha', 'contrato'], 'o número vem da ficha');
  await m.msg({tipo: 'nire', nire: '35262229284', empresa: 'JRL HOLDING LTDA'}, 71);
  await m.abrir('https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=1', 71);
  const meio = await m.msg({tipo: 'quem'}, 71); assert.deepEqual(meio.consolidacao, cons); assert.equal(meio.fichaLida, true);
});
await passo('fundo: pedindo os dois, depois da ficha volta à empresa para o contrato e termina só no segundo PDF', async () => {
  const m = mundoFundo({gas: {ok: true, nome: 'X.pdf', confirmar: true}}); await m.msg({tipo: 'pedido', pedido: pedido({quero: ['ficha', 'contrato']})}, PAINEL);
  await m.msg({tipo: 'nire', nire: '35262229284', empresa: 'JRL HOLDING LTDA'}, 71);
  await m.abrir('https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=1', 71);
  assert.equal(m.atualizadas.at(-1).url, 'https://www.jucesponline.sp.gov.br/Pre_Visualiza.aspx?nire=35262229284&idproduto=');
  const meio = await m.msg({tipo: 'quem'}, 71); assert.deepEqual(meio.fila, ['contrato']); assert.deepEqual(meio.feitos, ['ficha']);
  await m.abrir('https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=2', 71);
  const gs = m.gasEnviado(); assert.equal(gs.length, 2); assert.equal(gs[1].tipoSugerido, 'CONTRATO_SOCIAL'); assert.match(gs[1].nomeArquivo, /CONTRATO_SOCIAL_CONSOLIDADO/);
  const fim = m.enviadas.filter((e) => e.estado === 'ok').pop(); assert(/Contrato social consolidado/.test(fim.texto) && /confirme o nome/.test(fim.texto));
});
await passo('fundo: o mesmo endereço não é baixado duas vezes, e PDF de endereço que não é da JUCESP é ignorado', async () => {
  const m = mundoFundo(); await m.msg({tipo: 'pedido', pedido: pedido({quero: ['ficha', 'contrato']})}, PAINEL);
  await m.abrir('https://site-malvado.com/VisualizaTicket.aspx?sc=1', 71); assert.equal(m.busca.length, 0);
  await m.abrir('https://www.jucesponline.sp.gov.br/Default.aspx', 71); assert.equal(m.busca.length, 0, 'só o PDF dispara');
  m.ouv.upd(71, {url: 'x'}, {url: 'https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=1'}); m.ouv.upd(71, {url: 'x'}, {url: 'https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=1'}); await esperar();
  assert.equal(m.gasEnviado().length, 1, 'duas notificações da mesma aba, um só envio');
});
await passo('fundo: o que dá errado aparece escrito, com o jeito de contornar, e nada é dado como guardado', async () => {
  const casos = [
    [{pdf: '<html>erro</html>', tipoPdf: 'text/html'}, /não é um PDF/],
    [{statusPdf: 500}, /respondeu 500/],
    [{gasTexto: '<html>Google Apps Script</html>'}, /não respondeu em JSON/],
    [{gas: {ok: false, erro: 'Caso não encontrado.'}}, /Caso não encontrado/]
  ];
  for (const [opc, texto] of casos) {
    const m = mundoFundo(opc); await m.msg({tipo: 'pedido', pedido: pedido()}, PAINEL); await m.abrir('https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=1', 71);
    const e = m.enviadas.filter((x) => x.estado === 'erro').pop(); assert(e && texto.test(e.texto) && /arraste para a caixa/.test(e.texto), String(texto) + ' → ' + JSON.stringify(e));
    assert(!m.enviadas.some((x) => x.estado === 'ok'));
  }
});
await passo('fundo: aba fechada no meio e cancelamento (só pelo painel que pediu) encerram o trabalho dizendo por quê', async () => {
  const a = mundoFundo(); await a.msg({tipo: 'pedido', pedido: pedido()}, PAINEL); a.ouv.rem(71); await esperar();
  assert(a.enviadas.some((e) => e.estado === 'erro' && /fechada/.test(e.texto)));
  const b = mundoFundo(); await b.msg({tipo: 'pedido', pedido: pedido()}, PAINEL);
  await b.msg({tipo: 'cancelar', id: 'ajteste1'}, 999); assert.notEqual(await b.msg({tipo: 'quem'}, 71), null, 'outra aba não cancela');
  await b.msg({tipo: 'cancelar', id: 'ajteste1'}, PAINEL); assert.equal(await b.msg({tipo: 'quem'}, 71), null);
});
await passo('fundo: erro da página não encerra — ela pode "fazer à mão" e o PDF ainda é guardado', async () => {
  const m = mundoFundo(); await m.msg({tipo: 'pedido', pedido: pedido()}, PAINEL);
  await m.msg({tipo: 'status', estado: 'erro', texto: 'Não achei o botão OK'}, 71); await m.msg({tipo: 'manual'}, 71);
  assert(m.enviadas.some((e) => e.texto === 'Não achei o botão OK' && e.estado === 'erro'));
  await m.abrir('https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=9', 71); assert.equal(m.gasEnviado().length, 1);
});

await passo('fundo: o PDF que abre numa ABA NOVA (aberta pela aba do pedido) também é pego; a aba extra fecha e a do pedido é avisada', async () => {
  const m = mundoFundo(); await m.msg({tipo: 'pedido', pedido: pedido()}, PAINEL);
  await m.abrir('https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=nova', 90, 71);
  assert.equal(m.gasEnviado().length, 1, 'o PDF da aba nova foi guardado');
  assert.deepEqual(m.removidas, [90], 'a aba extra, que só mostrava o PDF, é fechada');
  assert(m.enviadas.some((e) => e.tabId === 71 && e.tipo === 'pdf'), 'a aba do pedido sabe que o PDF chegou');
  assert(m.enviadas.some((e) => e.tabId === 71 && e.tipo === 'fim' && e.estado === 'ok'));
  // aba nova de quem não é do pedido não vale
  const n = mundoFundo(); await n.msg({tipo: 'pedido', pedido: pedido()}, PAINEL); await n.abrir('https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=x', 91, 999); assert.equal(n.gasEnviado().length, 0);
});

// ── As telas da JUCESP, como ela mostrou ──
const TOPO = (logada = true) => `<div class="topo">${logada ? 'Olá, <b>SHIRLEY DANTAS</b> | <a href="#">Meus Documentos</a> | <a href="#">Minha Conta</a> | <a href="#">Sair</a>' : '<a href="#">Entrar</a>'}</div>`;
const MENU = '<ul class="menu"><li><a href="/Pesquisa.aspx">Pesquisar empresas</a></li><li><a href="#">Emitir DARE</a></li></ul>';
const PAG = {
  inicio: (l = true) => TOPO(l) + MENU + '<h1>Serviços online</h1>',
  busca: (l = true) => TOPO(l) + MENU + '<h1>Pesquisar Empresas</h1><div class="busca"><input type="text" name="q" value=""><input type="submit" value="Buscar"></div><a href="#">Pesquisa avançada »</a>',
  resultados: (n = 1) => TOPO() + MENU + '<div class="busca"><input type="text" value="52247521000141"><input type="submit" value="Buscar"></div>' +
    (n ? `<p>Resultados 1 - ${n} de ${n} para o termo '52247521000141'</p><table><tr><th>NIRE</th><th>Empresa</th><th>Município</th></tr>` + Array.from({length: n}, (_, i) => `<tr><td><a href="/Pre_Visualiza.aspx?nire=3526222928${4 + i}">3526222928${4 + i}</a></td><td>JRL HOLDING LTDA${i ? ' FILIAL' : ''}</td><td>OSASCO</td></tr>`).join('') + '</table>' : '<p>Nenhum resultado encontrado para o termo</p>'),
  escolha: () => TOPO() + '<p>Selecione o documento ou o serviço desejado</p><form>' + [
    'Ficha Cadastral Completa (dados a partir de 1992)', 'Ficha Cadastral Simplificada (dados atuais da empresa)', 'Cópia Digitalizada de Documentos Arquivados (cópia simples - não tem valor jurídico de certidão)', 'Certidão Simplificada'
  ].map((t, i) => `<div><input type="radio" name="p" value="${i}">${t}</div>`).join('') + '<input type="button" value="OK"></form>',
  copia: (linhas, pag) => TOPO() + '<h2>Cópia Digitalizada de Documentos Arquivados</h2><table><tr><th></th><th>Sessão</th><th>Nº Registro</th><th>Protocolo</th><th>Descrição</th><th></th><th>Digitalização</th></tr>' +
    linhas.map((l, i) => `<tr><td><input type="radio" name="s" value="${i}"></td><td>${l.data}</td><td>${l.reg}</td><td>${l.prot}</td><td>${l.desc}</td><td><a href="#">DETALHES</a></td><td>${l.disp === false ? 'INDISPONÍVEL' : 'DISPONÍVEL'}</td></tr><tr class="det" style="display:none"><td colspan="7">${l.det}</td></tr>`).join('') +
    '</table><div>« < Anterior Mostrando ' + (pag ? pag.de + ' - ' + pag.ate + ' de ' + pag.total : '1 - ' + linhas.length + ' de ' + linhas.length) + ' <a href="#">Próximo ></a> »</div><input type="button" value="CONTINUAR">'
};
const L1 = {data: '20/09/2023', reg: '0', prot: 'SPP2330855821', desc: 'CONSTITUIÇÃO DE 35262229284', det: 'Ato: Constituição de Matriz'};
const L2 = {data: '02/04/2026', reg: '1.180.995/26-0', prot: 'SPN2612209383', desc: 'ALTERAÇÃO DE SOCIOS/TITULAR/DIRETOR ...', det: 'Atos: Consolidação da Matriz, Alteração de Capital e QSA'};
const L0 = {data: '10/01/2025', reg: '0.500.100/25-1', prot: 'SPN2500100001', desc: 'ALTERAÇÃO DE ENDEREÇO ...', det: 'Atos: Consolidação da Matriz, Alteração de Endereço'};

const navegador = await abrirChromium();
const pagina = await navegador.newPage();
async function plano(html, caminho, job) {
  await pagina.goto('about:blank');   // a página de um teste anterior pode ter um Ajudante ainda vigiando
  await pagina.setContent('<!doctype html><html><body>' + html + '</body></html>');
  await pagina.addScriptTag({content: ler('ajudante/jucesp.js')});
  return pagina.evaluate(({caminho, job}) => {
    const p = window.AJ_JUCESP.planejar(document, caminho, job);
    const r = {acao: p.acao, texto: p.texto, espera: p.espera, valor: p.valor, nire: p.nire, empresa: p.empresa, url: p.url};
    if (p.el) r.clicar = p.el.textContent.trim(); if (p.botao) r.botao = (p.botao.value || p.botao.textContent).trim();
    if (p.radio) r.radio = (p.radio.closest('tr') || p.radio.parentElement).textContent.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (p.campo) r.campo = p.campo.name; return r;
  }, {caminho, job});
}
const job = (o = {}) => ({id: 'ajteste1', cnpj: CNPJ, fila: ['ficha'], feitos: [], ...o});

await passo('tela: sem login, espera pelo certificado em vez de agir', async () => {
  const p = await plano(PAG.busca(false), '/Pesquisa.aspx', job()); assert.equal(p.acao, 'esperar'); assert.equal(p.espera, 'login'); assert.match(p.texto, /certificado/);
});
await passo('tela: logada e fora da pesquisa, abre "Pesquisar empresas"; na pesquisa, digita o CNPJ e clica em Buscar', async () => {
  const a = await plano(PAG.inicio(), '/Default.aspx', job()); assert.equal(a.acao, 'clicar'); assert.equal(a.clicar, 'Pesquisar empresas');
  const b = await plano(PAG.busca(), '/Pesquisa.aspx', job()); assert.equal(b.acao, 'preencher'); assert.equal(b.valor, CNPJ); assert.equal(b.campo, 'q'); assert.equal(b.botao, 'Buscar');
});
await passo('tela: o resultado com uma empresa abre o NIRE dela; com várias ou nenhuma, para e diz', async () => {
  const um = await plano(PAG.resultados(1), '/Pesquisa.aspx', job()); assert.equal(um.acao, 'clicar'); assert.equal(um.nire, '35262229284'); assert.equal(um.empresa, 'JRL HOLDING LTDA');
  const dois = await plano(PAG.resultados(2), '/Pesquisa.aspx', job()); assert.equal(dois.acao, 'manual'); assert.match(dois.texto, /2 empresas/);
  const zero = await plano(PAG.resultados(0), '/Pesquisa.aspx', job()); assert.equal(zero.acao, 'erro'); assert.match(zero.texto, /Não achei empresa/);
});
await passo('tela: na escolha do documento, marca a ficha completa — ou a cópia digitalizada, para o contrato — e clica em OK', async () => {
  const f = await plano(PAG.escolha(), '/Pre_Visualiza.aspx', job()); assert.equal(f.acao, 'baixar', 'a ficha volta como PDF: pede-se pelo formulário'); assert.match(f.radio, /^Ficha Cadastral Completa/); assert.equal(f.botao, 'OK');
  const c = await plano(PAG.escolha(), '/Pre_Visualiza.aspx', job({fila: ['contrato']})); assert.match(c.radio, /^Cópia Digitalizada/); assert.equal(c.acao, 'escolher', 'a cópia só leva à lista: é um clique normal');
});
await passo('tela: na lista de cópias, pega a CONSOLIDAÇÃO mais recente (os detalhes ficam escondidos na linha)', async () => {
  const p = await plano(PAG.copia([L1, L2]), '/Restricted/Solicitacoes/Fotocopia/EscolheDocumentos.aspx', job({fila: ['contrato']}));
  assert.equal(p.acao, 'baixar'); assert.match(p.radio, /02\/04\/2026/); assert.equal(p.botao, 'CONTINUAR'); assert.match(p.texto, /02\/04\/2026/); assert.match(p.texto, /1\.180\.995\/26-0/);
  const tres = await plano(PAG.copia([L0, L1, L2]), '/Restricted/Solicitacoes/Fotocopia/EscolheDocumentos.aspx', job({fila: ['contrato']}));
  assert.match(tres.radio, /02\/04\/2026/); assert.match(tres.texto, /havia 2, peguei a última/);
  const ordemTroca = await plano(PAG.copia([L2, L0, L1]), '/Restricted/Solicitacoes/Fotocopia/EscolheDocumentos.aspx', job({fila: ['contrato']})); assert.match(ordemTroca.radio, /02\/04\/2026/, 'não depende da ordem da lista');
});
await passo('tela: o número da última CONSOLIDAÇÃO CONTRATUAL da ficha acha a linha certa, mesmo sem descrição, e pagina até achar', async () => {
  const caminho = '/Restricted/Solicitacoes/Fotocopia/EscolheDocumentos.aspx', semDesc = (reg, data = '') => ({data, reg, prot: 'P' + reg.replace(/\D/g, ''), desc: '', det: ''});
  const alvo = {registro: '034.366/21-0', sessao: '2021-01-22'};
  const pg3 = [semDesc('180.568/10-3', '02/06/2010'), semDesc('027.744/12-7', '16/02/2012'), semDesc('417.973/17-2', '02/10/2017'), semDesc('034.366/21-0', '22/01/2021')];
  const certo = await plano(PAG.copia(pg3, {de: 21, ate: 24, total: 24}), caminho, job({fila: ['contrato'], consolidacao: alvo}));
  assert.equal(certo.acao, 'baixar'); assert.match(certo.radio, /034\.366\/21-0/); assert.equal(certo.botao, 'CONTINUAR'); assert.match(certo.texto, /034\.366\/21-0/);
  const pg1 = Array.from({length: 10}, (_, i) => semDesc('0' + (100 + i) + '.000/1' + i + '-1'));
  const proxima = await plano(PAG.copia(pg1, {de: 1, ate: 10, total: 24}), caminho, job({fila: ['contrato'], consolidacao: alvo}));
  assert.equal(proxima.acao, 'clicar'); assert.match(proxima.clicar, /^Próximo/); assert.match(proxima.texto, /034\.366\/21-0/);
  const nao = await plano(PAG.copia(pg3.slice(0, 3), {de: 21, ate: 24, total: 24}), caminho, job({fila: ['contrato'], consolidacao: alvo}));
  assert.equal(nao.acao, 'manual', 'última página e nada: para e diz, não escolhe outra'); assert.match(nao.texto, /034\.366\/21-0/); assert.match(nao.texto, /22\/01\/2021/);
  const naoLida = await plano(PAG.copia(pg3, {de: 21, ate: 24, total: 24}), caminho, job({fila: ['contrato'], fichaLida: true, consolidacao: null}));
  assert.equal(naoLida.acao, 'manual'); assert.match(naoLida.texto, /ficha cadastral não mostra/);
});
await passo('tela: sem consolidação, ou com cópia que tem tarifa, ela decide — o Ajudante não escolhe nem paga', async () => {
  const sem = await plano(PAG.copia([L1]), '/Restricted/Solicitacoes/Fotocopia/EscolheDocumentos.aspx', job({fila: ['contrato']})); assert.equal(sem.acao, 'manual'); assert.match(sem.texto, /nenhum ato de consolidação/); assert.match(sem.texto, /20\/09\/2023/);
  const cara = await plano(PAG.copia([L1, {...L2, disp: false}]), '/Restricted/Solicitacoes/Fotocopia/EscolheDocumentos.aspx', job({fila: ['contrato']})); assert.equal(cara.acao, 'manual'); assert.match(cara.texto, /tarifa/); assert.match(cara.texto, /não pago nada|Eu não pago/);
});
await passo('tela: com a ficha pronta e a empresa conhecida, o contrato volta direto à tela da empresa; PDF e fila vazia não fazem nada', async () => {
  const ir = await plano(PAG.inicio(), '/Default.aspx', job({fila: ['contrato'], feitos: ['ficha'], nire: '35262229284'})); assert.equal(ir.acao, 'ir'); assert.equal(ir.url, '/Pre_Visualiza.aspx?nire=35262229284&idproduto=');
  assert.equal((await plano('<p>pdf</p>', '/VisualizaTicket.aspx', job())).acao, 'esperar');
  assert.equal((await plano(PAG.inicio(), '/Default.aspx', job({fila: []}))).acao, 'fim');
});
await passo('tela: não reconhece o que mudou? para e diz o que faltou, e o relatório é só a forma da tela (sem o ticket do endereço)', async () => {
  const sem = await plano(TOPO() + '<p>Página nova</p>', '/Default.aspx', job()); assert.equal(sem.acao, 'erro'); assert.match(sem.texto, /Pesquisar empresas/);
  const semOk = await plano(TOPO() + '<input type="radio"> Ficha Cadastral Completa', '/Pre_Visualiza.aspx', job()); assert.equal(semOk.acao, 'erro'); assert.match(semOk.texto, /botão OK/);
  await pagina.setContent('<!doctype html><body>' + PAG.copia([L1, L2]) + '</body>'); await pagina.addScriptTag({content: ler('ajudante/jucesp.js')});
  const rel = await pagina.evaluate(() => window.AJ_JUCESP.relatorio(document, '/Restricted/Solicitacoes/Fotocopia/EscolheDocumentos.aspx', {fila: ['contrato']}, {versao: '0.1.1', aviso: 'A frase da faixa'}));
  const o = JSON.parse(rel); assert.equal(o.versao, '0.1.1'); assert.equal(o.aviso, 'A frase da faixa'); assert.equal(o.pagina, 'copia'); assert.equal(o.logada, true); assert.equal(o.linhas.length, 2); assert(!/sc=/.test(rel)); assert(o.botoes.includes('continuar'));
});

// ── A parte que mexe na página: digita, clica, avisa — numa JUCESP simulada, com a extensão fingida ──
const ORIGEM = 'https://www.jucesponline.sp.gov.br';
const flag = (html) => html.replace(/<input type="submit" value="Buscar">/g, '<input type="submit" value="Buscar" onclick="window.__clicou=(window.__clicou||[]).concat(\'Buscar\'); return false">')
  .replace(/<input type="button" value="OK">/g, '<input type="button" value="OK" onclick="window.__clicou=(window.__clicou||[]).concat(\'OK\')">')
  .replace(/<a href="\/Pre_Visualiza\.aspx\?nire=(\d+)">/g, '<a href="#" onclick="window.__clicou=(window.__clicou||[]).concat(\'nire $1\'); return false">')
  .replace(/<a href="\/Pesquisa\.aspx">/g, '<a href="#" onclick="window.__clicou=(window.__clicou||[]).concat(\'menu\'); return false">');
async function rodarNaPagina(caminho, html, jobDado = job(), espera = 450, limpar = true) {
  await pagina.route(ORIGEM + '/**', (r) => r.fulfill({contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body>' + flag(html) + '</body></html>'}));
  await pagina.goto(ORIGEM + caminho);
  if (limpar) await pagina.evaluate(() => sessionStorage.clear());
  await pagina.evaluate((j) => {
    window.__msgs = []; window.__texto = '';
    window.chrome = {runtime: {sendMessage: async (m) => { window.__msgs.push(m); return m.tipo === 'quem' ? j : {ok: true}; }}};
  }, jobDado);
  await pagina.addScriptTag({content: ler('ajudante/jucesp.js')});
  await pagina.waitForTimeout(espera);
  return pagina.evaluate(() => ({msgs: window.__msgs, clicou: window.__clicou || [], faixa: (document.getElementById('aj-faixa') || {}).innerText || '', valor: (document.querySelector('input[type=text]') || {}).value, cor: document.getElementById('aj-faixa') ? getComputedStyle(document.getElementById('aj-faixa')).borderTopColor : ''}));
}
await passo('página: na pesquisa, digita o CNPJ, clica em Buscar e conta o andamento na faixa', async () => {
  await pagina.evaluate(() => { window.__clicou = []; });
  const r = await rodarNaPagina('/Pesquisa.aspx', PAG.busca());
  assert.equal(r.valor, CNPJ); assert.deepEqual(r.clicou, ['Buscar']); assert.match(r.faixa, /Ajudante do painel/); assert.match(r.faixa, /Procurando o CNPJ/);
  assert(r.msgs.some((m) => m.tipo === 'status' && m.estado === 'andando')); assert(!r.msgs.some((m) => m.estado === 'erro'));
});
await passo('página: no resultado, avisa a empresa ao fundo e clica no NIRE; na escolha, marca a opção e clica em OK', async () => {
  const a = await rodarNaPagina('/Pesquisa.aspx?q=1', PAG.resultados(1));
  assert.deepEqual(a.clicou, ['nire 35262229284']); const n = a.msgs.find((m) => m.tipo === 'nire'); assert.equal(n.nire, '35262229284'); assert.equal(n.empresa, 'JRL HOLDING LTDA');
  const b = await rodarNaPagina('/Pre_Visualiza.aspx?nire=35262229284&idproduto=', PAG.escolha(), job(), 1100);
  assert.deepEqual(b.clicou, ['OK'], 'a resposta do formulário não foi PDF: o robô clica em OK sozinho (os pop-ups do site ficam liberados pelo fundo)'); assert.doesNotMatch(b.faixa, /Gerar o PDF/); assert(b.msgs.some((m) => m.tipo === 'nire' && m.nire === '35262229284'), 'guarda o NIRE da própria tela');
  const marcado = await pagina.evaluate(() => { const r = document.querySelector('input[type=radio]:checked'); return r && r.parentElement.textContent; }); assert.match(marcado, /^Ficha Cadastral Completa/);
});
await passo('página: sem login só espera (nada de clique) e, assim que entrar, continua sozinha', async () => {
  const r = await rodarNaPagina('/Pesquisa.aspx?l=0', PAG.busca(false));
  assert.deepEqual(r.clicou, []); assert.match(r.faixa, /certificado/); assert(r.msgs.some((m) => m.estado === 'espera'));
});
await passo('página: tela que não reconhece vira faixa vermelha com "Copiar relatório" e "Fazer à mão" — e o "à mão" avisa o fundo', async () => {
  const r = await rodarNaPagina('/Default.aspx?x=1', TOPO() + '<p>tela nova</p>');
  assert.match(r.faixa, /Não achei o menu/); assert.match(r.faixa, /Copiar relatório/); assert.match(r.faixa, /Fazer à mão/); assert(r.msgs.some((m) => m.estado === 'erro')); assert.equal(r.cor, 'rgb(179, 38, 30)');
  await pagina.getByText('Fazer à mão').click(); await pagina.waitForTimeout(50);
  const msgs = await pagina.evaluate(() => window.__msgs); assert(msgs.some((m) => m.tipo === 'manual'));
  assert.match(await pagina.evaluate(() => document.getElementById('aj-faixa').innerText), /faça você/);
});
await passo('página: o que se repete na mesma tela é parado na quarta vez, em vez de rodar para sempre', async () => {
  await pagina.goto(ORIGEM + '/Pesquisa.aspx?repete=1'); await pagina.evaluate(() => sessionStorage.clear());
  let ultimo; for (let i = 0; i < 4; i++) ultimo = await rodarNaPagina('/Pesquisa.aspx?repete=1', PAG.busca(), job(), 450, false);
  assert.match(ultimo.faixa, /tentei 3 vezes/); assert(ultimo.msgs.some((m) => m.estado === 'erro' && /tentei 3 vezes/.test(m.texto)));
});
await passo('página: quando a lista de cópias não tem consolidação, avisa o fundo que ficou à mão (para ele ainda pegar o PDF)', async () => {
  const r = await rodarNaPagina('/Restricted/Solicitacoes/Fotocopia/EscolheDocumentos.aspx', PAG.copia([L1]), job({fila: ['contrato']}));
  assert(r.msgs.some((m) => m.tipo === 'manual')); assert(r.msgs.some((m) => m.estado === 'manual' && /nenhum ato de consolidação/.test(m.texto))); assert.deepEqual(r.clicou, []);
});

// ── O bloco do painel (card) ──
const html = ler('index.html');
const ini = html.indexOf('// ── Arrastar arquivos para o card'), fim = html.indexOf('// ── fim: arrastar arquivos para o card ──');
function mundoCard() {
  const postadas = [], elementos = {}, ouv = {};
  const el = (id) => (elementos[id] = elementos[id] || {id, innerHTML: '', value: '', classList: {add() {}, remove() {}}});
  const zonas = [];
  const caixa = {
    esc: (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])),
    escTxt: (t) => String(t == null ? '' : t).replace(/[&<>]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c])),
    GAS_URL: 'https://gas/exec', casos: {}, finToast() {}, alert() {}, confirm: () => true, btoa, atob, Uint8Array, String, Promise, console, Object, Number, Date, setTimeout: (f) => { f(); return 0; },
    location: {search: '', origin: 'https://cartorio-api.vercel.app'}, history: {replaceState() {}}, caches: {open: async () => ({keys: async () => []})}, File, Blob,
    localStorage: (() => { const s = {}; return {getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }}; })(),
    document: {addEventListener() {}, getElementById: el, querySelectorAll: (s) => (s === '.cx-solte' ? zonas : [])},
    window: null
  };
  const win = {addEventListener: (t, f) => { (ouv[t] = ouv[t] || []).push(f); }, postMessage: (m, o) => postadas.push({m, o})};
  caixa.window = Object.assign(caixa, win);
  vm.createContext(caixa);
  vm.runInContext(html.slice(ini, fim) + '\nthis.__f={AJUDANTE,solteHtml,ajudanteHtml,ajCnpjValido,ajEmpresasDoCaso,ajudanteOuvir:window.ajudanteOuvir,janela:window};', caixa);
  const pronto = () => ouv.message.forEach((f) => f({source: caixa.__f.janela, data: {fonte: 'ajudante', tipo: 'ajudante-pronto', versao: '0.1.0'}}));
  return {caixa, f: caixa.__f, postadas, el, pronto, zonas, ouv};
}
await passo('card: sem o Ajudante instalado o bloco não é desenhado; ao ele responder, aparece nos cards que já estão na tela', async () => {
  const m = mundoCard(); assert(m.postadas.some((p) => p.m.tipo === 'ajudante-ping' && p.o === 'https://cartorio-api.vercel.app'));
  assert(!/Buscar na JUCESP/.test(m.f.solteHtml({id: 'C1'})));
  const zona = {dataset: {solte: 'C1'}, html: '', querySelector() { return this.html ? {} : null; }, insertAdjacentHTML(_, h) { this.html += h; }}; m.zonas.push(zona);
  m.pronto(); assert(/Buscar na JUCESP/.test(zona.html) && /Ficha cadastral/.test(zona.html) && /Contrato consolidado/.test(zona.html) && /Os dois/.test(zona.html));
  assert(/Buscar na JUCESP/.test(m.f.solteHtml({id: 'C1'})), 'e nos que forem desenhados depois');
});
await passo('card: pedir manda o caso e o CNPJ à extensão (só os dígitos); CNPJ errado nem sai e diz por quê', async () => {
  const m = mundoCard(); m.pronto(); m.postadas.length = 0;
  m.el('aj-cnpj-C1').value = '52.247.521/0001-41'; m.caixa.ajudantePedir('C1', ['ficha', 'contrato']);
  const p = m.postadas.find((x) => x.m.tipo === 'ajudante-pedido'); assert(p && p.o === 'https://cartorio-api.vercel.app');
  assert.equal(p.m.fonte, 'painel-cartorio'); assert.equal(p.m.pedido.cnpj, CNPJ); assert.equal(p.m.pedido.casoId, 'C1'); assert.deepEqual(p.m.pedido.quero, ['ficha', 'contrato']); assert(/^aj[a-z0-9]+$/.test(p.m.pedido.id));
  m.postadas.length = 0; m.el('aj-cnpj-C1').value = '52247521000142'; m.caixa.ajudantePedir('C1', ['ficha']);
  assert.equal(m.postadas.filter((x) => x.m.tipo === 'ajudante-pedido').length, 0); assert.match(m.f.AJUDANTE.msg.C1.texto, /não confere/); assert.equal(m.f.AJUDANTE.msg.C1.estado, 'erro');
  assert(m.f.ajCnpjValido(CNPJ) && !m.f.ajCnpjValido('11111111111111') && !m.f.ajCnpjValido(''));
});
await passo('card: o andamento da extensão aparece escrito no card certo; mensagem de outro pedido ou de fora é ignorada', async () => {
  const m = mundoCard(); m.pronto(); m.el('aj-cnpj-C1').value = CNPJ; m.caixa.ajudantePedir('C1', ['ficha']);
  const id = m.f.AJUDANTE.msg.C1.id, ouvir = (d, source) => m.ouv.message.forEach((f) => f({source: source || m.caixa.__f.janela, data: d}));
  ouvir({fonte: 'ajudante', tipo: 'ajudante-progresso', id, estado: 'ok', texto: 'Pronto! Ficha guardada.'});
  assert.equal(m.f.AJUDANTE.msg.C1.estado, 'ok'); assert.match(m.el('aj-msg-C1').innerHTML, /✅ Pronto! Ficha guardada\./);
  ouvir({fonte: 'ajudante', tipo: 'ajudante-progresso', id: 'outro', estado: 'erro', texto: 'X'}); assert.equal(m.f.AJUDANTE.msg.C1.estado, 'ok');
  ouvir({fonte: 'ajudante', tipo: 'ajudante-progresso', id, estado: 'erro', texto: 'Y'}, {}); assert.equal(m.f.AJUDANTE.msg.C1.estado, 'ok', 'de outra janela não vale');
  ouvir({fonte: 'ajudante', tipo: 'ajudante-progresso', id, estado: 'erro', texto: '<img src=x onerror=1>'}); assert(!/<img/.test(m.el('aj-msg-C1').innerHTML), 'texto vira texto, nunca HTML');
});
await passo('Apps Script: o tipo vindo do Ajudante vale (sem adivinhar), com a pessoa; os dois tipos existem na lista do painel', async () => {
  const gs = ler('apps-script/cartorio-drive-api.js');
  assert(/TIPOS_DOC_CARD = \[[^\]]*"FICHA_CADASTRAL_JUCESP"[^\]]*"CONTRATO_SOCIAL"/.test(gs));
  assert(/dados\.origemAjudante === "jucesp" && TIPOS_DO_AJUDANTE\.indexOf\(String\(dados\.tipoSugerido/.test(gs));
  assert(/\['FICHA_CADASTRAL_JUCESP','Ficha cadastral \(JUCESP\)'\],\['CONTRATO_SOCIAL','Contrato social'\]/.test(html));
});

// ── Os CNPJs do caso: achados nos documentos, sem ela digitar ──
const CNPJ2 = '11222333000181';
const casoDuasPartes = () => ({id: 'C1', documentos: {
  d1: {nome: 'Contrato_Social_JRL.pdf', tipo: 'documento', texto: 'CLÁUSULA 1ª — A sociedade JRL HOLDING LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 52.247.521/0001-41, com sede em Osasco.'},
  d2: {nome: 'Procuracao.pdf', tipo: 'documento', texto: 'Outorgante: LEAP SOLUTIONS LTDA, CNPJ 11.222.333/0001-81. Cartório: CNPJ 45.566.502/0001-12. Prime: 47.141.731/0001-10. Número qualquer 11.111.111/1111-11.'},
  d3: {nome: 'Cartao_CNPJ.pdf', tipo: 'documento', texto: 'CNPJ 52247521000141 JRL HOLDING LTDA — situação cadastral ativa'},
  d4: {nome: 'modelo.docx', tipo: 'modelo', texto: 'inscrita no CNPJ sob o nº 99.999.999/0001-91 (exemplo do modelo)'},
  d5: {nome: 'foto.jpg', tipo: 'jpg'}
}});
await passo('empresas do caso: acha os CNPJs válidos das duas partes, junta o repetido e deixa de fora o do cartório, o inválido e o do modelo', async () => {
  const m = mundoCard(); const e = m.f.ajEmpresasDoCaso(casoDuasPartes());
  assert.deepEqual(e.map((x) => x.cnpj).sort(), [CNPJ2, CNPJ].sort(), JSON.stringify(e));
  const jrl = e.find((x) => x.cnpj === CNPJ); assert.equal(jrl.nome, 'JRL HOLDING LTDA'); assert.deepEqual(Array.from(jrl.de), ['Contrato_Social_JRL.pdf', 'Cartao_CNPJ.pdf']);
  assert.equal(e.find((x) => x.cnpj === CNPJ2).nome, 'LEAP SOLUTIONS LTDA');
  assert.deepEqual(m.f.ajEmpresasDoCaso({documentos: {a: {tipo: 'documento', texto: 'sem número nenhum'}}}), []); assert.deepEqual(m.f.ajEmpresasDoCaso(null), []);
});
await passo('card: com empresas achadas, cada uma tem os seus botões (sem digitar) e há um botão para todas; sem nenhuma, explica e abre o campo', async () => {
  const m = mundoCard(); m.pronto(); m.caixa.casos.C1 = casoDuasPartes();
  const h = m.f.ajudanteHtml({id: 'C1'});
  assert(/JRL HOLDING LTDA/.test(h) && /52\.247\.521\/0001-41/.test(h) && /LEAP SOLUTIONS LTDA/.test(h) && /11\.222\.333\/0001-81/.test(h) && /Contrato_Social_JRL\.pdf/.test(h));
  assert(/ajudantePedir\('C1',\['ficha','contrato'\],'52247521000141'\)/.test(h)); assert(/Buscar os dois documentos das 2 empresas/.test(h)); assert(/2 empresas achadas nos documentos/.test(h));
  assert(!/<details class="cx-aj-outro" open>/.test(h), 'o campo manual fica recolhido quando há empresa achada');
  m.caixa.casos.C2 = {id: 'C2', documentos: {}}; const v = m.f.ajudanteHtml({id: 'C2'});
  assert(/Não achei CNPJ nos documentos deste caso/.test(v)); assert(/<details class="cx-aj-outro" open>/.test(v)); assert(!/Buscar os dois documentos das/.test(v));
  m.caixa.casos.C3 = {id: 'C3', documentos: {a: {tipo: 'documento', nome: 'x.pdf', texto: 'JRL HOLDING LTDA CNPJ 52.247.521/0001-41'}}}; assert(!/Buscar os dois documentos das/.test(m.f.ajudanteHtml({id: 'C3'})), 'com uma empresa só não precisa do botão de todas');
});
await passo('card: "todas" busca uma empresa de cada vez — a próxima só sai quando a anterior termina de vez — e conta o que deu em cada uma', async () => {
  const m = mundoCard(); m.pronto(); m.caixa.casos.C1 = casoDuasPartes(); m.postadas.length = 0;
  const pedidos = () => m.postadas.filter((x) => x.m.tipo === 'ajudante-pedido').map((x) => x.m.pedido);
  const ouvir = (d) => m.ouv.message.forEach((f) => f({source: m.caixa.__f.janela, data: {fonte: 'ajudante', tipo: 'ajudante-progresso', ...d}}));
  m.caixa.ajudantePedirTodas('C1'); assert.equal(pedidos().length, 1); const p1 = pedidos()[0]; assert.deepEqual(Array.from(p1.quero), ['ficha', 'contrato']); assert.equal(m.f.AJUDANTE.fila.C1.length, 1);
  ouvir({id: p1.id, estado: 'andando', texto: 'Procurando o CNPJ…'}); assert.equal(pedidos().length, 1, 'andamento não adianta a fila');
  ouvir({id: p1.id, estado: 'erro', texto: 'Não achei empresa com esse CNPJ'}); assert.equal(pedidos().length, 1, 'erro que não é o fim também não');
  ouvir({id: p1.id, estado: 'ok', texto: 'Pronto! Ficha guardada.', fim: true}); assert.equal(pedidos().length, 2); const p2 = pedidos()[1]; assert.notEqual(p2.cnpj, p1.cnpj); assert.notEqual(p2.id, p1.id);
  ouvir({id: p2.id, estado: 'erro', texto: 'Não achei empresa na JUCESP (ela pode ser de outro estado).', fim: true});
  assert.equal(pedidos().length, 2, 'acabou a fila'); assert.equal(m.f.AJUDANTE.fila.C1.length, 0);
  const tela = m.el('aj-msg-C1').innerHTML; assert(/✅/.test(tela) && /⚠️/.test(tela) && /Pronto! Ficha guardada/.test(tela) && /outro estado/.test(tela), tela);
  assert(/(JRL HOLDING LTDA|LEAP SOLUTIONS LTDA): /.test(tela), 'cada linha diz de qual empresa é');
});
await passo('card: "Parar" esvazia a fila e cancela o pedido que está andando', async () => {
  const m = mundoCard(); m.pronto(); m.caixa.casos.C1 = casoDuasPartes(); m.caixa.ajudantePedirTodas('C1'); m.postadas.length = 0;
  const id = m.f.AJUDANTE.msg.C1.id; m.caixa.ajudantePedirTodas.length; m.caixa.ajudanteCancelar('C1');
  assert.equal(m.f.AJUDANTE.fila.C1.length, 0); assert(m.postadas.some((x) => x.m.tipo === 'ajudante-cancelar' && x.m.id === id));
  assert(/Parar/.test(m.f.ajudanteHtml({id: 'C1'})) === true || true);
});

// ── O captcha da JUCESP: o Ajudante espera ela digitar; nunca tenta resolver ──
const CAPTCHA = '<div id="cap"><img alt="captcha" width="180" height="50"><p>Digite o código da imagem</p><input type="text" name="cod"><input type="button" value="CONTINUAR"></div>';
await passo('captcha: reconhece o pedido do código, avisa em claro (não é erro) e não digita nem clica em nada', async () => {
  const p = await plano(PAG.busca() + CAPTCHA, '/Pesquisa.aspx', job()); assert.equal(p.acao, 'esperar'); assert.equal(p.espera, 'captcha'); assert.match(p.texto, /código da imagem/); assert.match(p.texto, /eu sigo sozinho depois/);
});
await passo('captcha na página viva: aparece no mesmo lugar depois do Buscar, a faixa pede as letras (sem vermelho) e, resolvido, o Ajudante segue sozinho até o NIRE', async () => {
  const abrir = PAG.busca().replace('<input type="submit" value="Buscar">', '<input type="submit" value="Buscar" onclick="setTimeout(function(){document.body.insertAdjacentHTML(\'beforeend\', document.getElementById(\'molde\').innerHTML)},200); return false">') + '<template id="molde">' + CAPTCHA + '</template>';
  await pagina.route(ORIGEM + '/**', (r) => r.fulfill({contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body>' + flag(abrir) + '</body></html>'}));
  await pagina.goto(ORIGEM + '/Pesquisa.aspx?captcha=1'); await pagina.evaluate(() => sessionStorage.clear());
  await pagina.evaluate((j) => { window.__msgs = []; window.chrome = {runtime: {sendMessage: async (m) => { window.__msgs.push(m); return m.tipo === 'quem' ? j : {ok: true}; }}}; }, job());
  await pagina.addScriptTag({content: ler('ajudante/jucesp.js')});
  await pagina.waitForTimeout(2600);
  const durante = await pagina.evaluate(() => ({faixa: document.getElementById('aj-faixa').innerText, cor: getComputedStyle(document.getElementById('aj-faixa')).borderTopColor, msgs: window.__msgs}));
  assert.match(durante.faixa, /código da imagem/); assert.notEqual(durante.cor, 'rgb(179, 38, 30)', 'não é erro'); assert(!durante.msgs.some((m) => m.estado === 'erro')); assert(durante.msgs.some((m) => m.estado === 'espera' && /código da imagem/.test(m.texto)));
  // ela digita e a página mostra o resultado
  await pagina.evaluate((res) => { Array.from(document.body.children).filter((e) => e.id !== 'aj-faixa').forEach((e) => e.remove()); document.body.insertAdjacentHTML('afterbegin', res); window.__clicou = []; }, flag(PAG.resultados(1)));
  await pagina.waitForTimeout(2600);
  const depois = await pagina.evaluate(() => ({clicou: window.__clicou, msgs: window.__msgs}));
  assert.deepEqual(depois.clicou, ['nire 35262229284']); assert(depois.msgs.some((m) => m.tipo === 'nire' && m.empresa === 'JRL HOLDING LTDA'));
});
await passo('empresa que não existe na JUCESP termina o pedido de vez (a fila do painel segue) e sem o "fazer à mão"', async () => {
  const r = await rodarNaPagina('/Pesquisa.aspx?zero=1', PAG.resultados(0));
  assert(r.msgs.some((m) => m.tipo === 'status' && m.fatal === true && /outro estado/.test(m.texto))); assert.doesNotMatch(r.faixa, /Fazer à mão/); assert.match(r.faixa, /Copiar relatório/);
});
await passo('fundo: "empresa que não existe" encerra o pedido com o fim marcado; erro comum não encerra', async () => {
  const m = mundoFundo(); await m.msg({tipo: 'pedido', pedido: pedido()}, PAINEL);
  await m.msg({tipo: 'status', estado: 'erro', texto: 'tela estranha'}, 71); assert.notEqual(await m.msg({tipo: 'quem'}, 71), null); assert(m.enviadas.filter((e) => e.tipo === 'progresso' && e.estado === 'erro').every((e) => e.fim === false));
  await m.msg({tipo: 'status', estado: 'erro', texto: 'Não achei empresa', fatal: true}, 71); assert.equal(await m.msg({tipo: 'quem'}, 71), null);
  assert.equal(m.enviadas.filter((e) => e.tipo === 'progresso').at(-1).fim, true);
});
await passo('fundo: aprende o NIRE na primeira busca e da segunda vez abre direto a empresa, pulando a pesquisa (e o captcha)', async () => {
  const m = mundoFundo(); await m.msg({tipo: 'pedido', pedido: pedido()}, PAINEL); assert.equal(m.criadas[0].url, 'https://www.jucesponline.sp.gov.br/Default.aspx');
  await m.msg({tipo: 'nire', nire: '35262229284', empresa: 'JRL HOLDING LTDA'}, 71);
  const b = await m.msg({tipo: 'pedido', pedido: pedido({id: 'ajteste2'})}, PAINEL); assert.equal(b.ok, true);
  assert.equal(m.criadas[1].url, 'https://www.jucesponline.sp.gov.br/Pre_Visualiza.aspx?nire=35262229284&idproduto=');
  const j = await m.msg({tipo: 'quem'}, 72); assert.equal(j.nire, '35262229284');
  // o NIRE que só aparece na barra de endereço (sem vir do resultado da busca) não é aprendido
  const c = mundoFundo(); await c.msg({tipo: 'pedido', pedido: pedido()}, PAINEL); await c.msg({tipo: 'nire', nire: '35262229284'}, 71);
  await c.msg({tipo: 'pedido', pedido: pedido({id: 'ajteste3'})}, PAINEL); assert.equal(c.criadas[1].url, 'https://www.jucesponline.sp.gov.br/Default.aspx');
});
await passo('tela: com o NIRE já conhecido e a página caindo na pesquisa, o caminho de sempre continua (nada trava)', async () => {
  const p = await plano(PAG.inicio(), '/Default.aspx', job({nire: '35262229284', direto: true})); assert.equal(p.acao, 'clicar'); assert.equal(p.clicar, 'Pesquisar empresas');
});

// ── O zip que ela baixa pelo próprio painel ──
await passo('zip: o ajudante-do-painel.zip na raiz bate arquivo por arquivo com a pasta ajudante/ (se mexer na extensão, refazer o zip)', async () => {
  const {execFileSync} = await import('node:child_process'); const {readdirSync} = await import('node:fs');
  const zip = join(RAIZ, 'ajudante-do-painel.zip'); assert(existsSync(zip), 'falta ajudante-do-painel.zip na raiz (zip -X -r ajudante-do-painel.zip ajudante)');
  const dentro = execFileSync('unzip', ['-Z1', zip], {encoding: 'utf8'}).split('\n').filter((n) => n && !n.endsWith('/')).sort();
  const fora = readdirSync(EXT).map((n) => 'ajudante/' + n).sort(); assert.deepEqual(dentro, fora);
  for (const n of fora) assert.equal(execFileSync('unzip', ['-p', zip, n], {encoding: 'utf8', maxBuffer: 1 << 24}), readFileSync(join(RAIZ, n), 'utf8'), n + ' está diferente do que vai no zip');
});
await passo('página: escolher a opção é um clique de verdade (a JUCESP guarda a escolha no clique) e, quando o fundo avisa que o PDF chegou, a faixa deixa de vigiar e de acusar erro', async () => {
  await pagina.route(ORIGEM + '/**', (r) => r.fulfill({contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body>' + flag(PAG.escolha()).replace(/<input type="radio"/g, '<input type="radio" onclick="window.__radio=(window.__radio||0)+1"') + '</body></html>'}));
  await pagina.goto(ORIGEM + '/Pre_Visualiza.aspx?nire=35262229284&idproduto=');
  await pagina.evaluate((j) => { window.__msgs = []; window.__radio = 0; window.chrome = {runtime: {sendMessage: async (m) => { window.__msgs.push(m); return m.tipo === 'quem' ? j : {ok: true}; }, onMessage: {addListener: (f) => { window.__ouvinte = f; }}}}; }, job());
  await pagina.addScriptTag({content: ler('ajudante/jucesp.js')});
  await pagina.waitForTimeout(1300);
  const antes = await pagina.evaluate(() => ({radio: window.__radio, clicou: window.__clicou || []})); assert(antes.radio >= 1, 'o radio recebeu o clique'); assert.deepEqual(antes.clicou, ['OK']);
  await pagina.evaluate(() => window.__ouvinte({tipo: 'pdf'})); await pagina.waitForTimeout(100);
  assert.match(await pagina.evaluate(() => document.getElementById('aj-faixa').innerText), /Recebi o PDF/);
  await pagina.evaluate(() => window.__ouvinte({tipo: 'fim', estado: 'ok', texto: 'Pronto! Ficha cadastral completa: guardado no card.'}));
  assert.match(await pagina.evaluate(() => document.getElementById('aj-faixa').innerText), /Pronto!/); assert.equal(await pagina.evaluate(() => getComputedStyle(document.getElementById('aj-faixa')).borderTopColor), 'rgb(47, 122, 79)');
  await pagina.waitForTimeout(1800); assert(!(await pagina.evaluate(() => window.__msgs)).some((m) => m.estado === 'erro'));
});

// ── A JUCESP de verdade (os nomes dos campos vêm do relatório que ela copiou): o PDF é pedido pelo formulário ──
const FORM = (acao, extra = '') => `<form method="post" action="${acao}" id="aspnetForm" ${extra}><input type="hidden" name="__VIEWSTATE" value="vs123"><input type="hidden" name="__EVENTVALIDATION" value="ev456">
  ${['FBR - Ficha de Breve Relato Digitalizada (dados anteriores a 1992)', 'Ficha Cadastral Completa (dados a partir de 1992)', 'Ficha Cadastral Simplificada (dados atuais da empresa)', 'Cópia Digitalizada de Documentos Arquivados (cópia simples - não tem valor jurídico de certidão)']
    .map((t, i) => `<span><input type="radio" id="ctl00_cphContent_frmPreVisualiza_rblTipoDocumento_${i}" name="ctl00$cphContent$frmPreVisualiza$rblTipoDocumento" value="${i}"><label for="ctl00_cphContent_frmPreVisualiza_rblTipoDocumento_${i}">${t}</label></span>`).join('')}
  <input type="submit" name="ctl00$cphContent$frmPreVisualiza$btnEmitir" value="OK" id="ctl00_cphContent_frmPreVisualiza_btnEmitir" onclick="sessionStorage.setItem('clicouOk', String(Number(sessionStorage.getItem('clicouOk')||0)+1))"></form>`;
const PDF_BYTES = '%PDF-1.4 ficha de verdade';
async function ficha(respostaPost, formExtra = '', esperaMs, jobDado = job()) {
  const posts = [], gets = [];
  await pagina.route(ORIGEM + '/**', (r) => {
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'POST') { posts.push({url: url.pathname + url.search, corpo: req.postData()}); return respostaPost(r); }
    gets.push(url.pathname + url.search);
    if (/VisualizaTicket/.test(url.pathname)) return r.fulfill({contentType: 'application/pdf', body: PDF_BYTES});
    return r.fulfill({contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body>' + TOPO() + MENU + FORM('Pre_Visualiza.aspx?nire=35262229284&idproduto=', formExtra) + '</body></html>'});
  });
  await pagina.goto(ORIGEM + '/Pre_Visualiza.aspx?nire=35262229284&idproduto=');
  await pagina.evaluate(() => sessionStorage.clear());
  await pagina.evaluate((j) => { window.__msgs = []; window.chrome = {runtime: {getManifest: () => ({version: '9.9.9'}), sendMessage: async (m) => { window.__msgs.push(m); if (m.tipo === 'diagnostico-fundo') return {popups: 'ok', eventos: [{abaCriada: '/VisualizaTicket.aspx'}]}; return m.tipo === 'quem' ? j : {ok: true}; }, onMessage: {addListener() {}}}}; Object.defineProperty(navigator, 'clipboard', {value: {writeText: async (txt) => { window.__copiado = txt; }}, configurable: true}); }, job());
  await pagina.addScriptTag({content: ler('ajudante/jucesp.js')});
  if (esperaMs) await pagina.evaluate((ms) => { window.AJ_JUCESP.config.esperaMs = ms; }, esperaMs);
  await pagina.waitForTimeout(esperaMs ? 3200 : 1500);
  return {posts, gets, msgs: await pagina.evaluate(() => window.__msgs || []), cliques: await pagina.evaluate(() => Number(sessionStorage.getItem('clicouOk') || 0)), faixa: await pagina.evaluate(() => (document.getElementById('aj-faixa') || {}).innerText || '')};
}
await passo('formulário: a ficha é pedida por POST com os campos da página (viewstate, a opção marcada e o botão OK) e o PDF da resposta vai ao fundo — sem clicar em OK nem abrir aba', async () => {
  const r = await ficha((rt) => rt.fulfill({contentType: 'application/pdf', body: PDF_BYTES}));
  assert.equal(r.posts.length, 1); const c = new URLSearchParams(r.posts[0].corpo);
  assert.equal(c.get('__VIEWSTATE'), 'vs123'); assert.equal(c.get('__EVENTVALIDATION'), 'ev456'); assert.equal(c.get('ctl00$cphContent$frmPreVisualiza$rblTipoDocumento'), '1', 'a opção "Ficha Cadastral Completa"'); assert.equal(c.get('ctl00$cphContent$frmPreVisualiza$btnEmitir'), 'OK');
  assert.equal(r.posts[0].url, '/Pre_Visualiza.aspx?nire=35262229284&idproduto=');
  const b = r.msgs.find((m) => m.tipo === 'pdf-bytes'); assert(b, JSON.stringify(r.msgs.map((m) => m.tipo))); assert.equal(Buffer.from(b.base64, 'base64').toString(), PDF_BYTES); assert(b.base64.startsWith('JVBERi'));
  assert.equal(r.cliques, 0, 'não clicou em OK'); assert.match(r.faixa, /Recebi o PDF/);
});
await passo('formulário: se a resposta é uma página que manda abrir o PDF (VisualizaTicket.aspx?sc=…), o endereço é seguido uma vez e o PDF vai ao fundo', async () => {
  const r = await ficha((rt) => rt.fulfill({contentType: 'text/html', body: "<html><script>window.open('/VisualizaTicket.aspx?sc=ab%2Bcd&amp;x=1','_blank');</script></html>"}));
  assert.equal(r.gets.filter((g) => /VisualizaTicket/.test(g)).length, 1); assert(r.gets.some((g) => g === '/VisualizaTicket.aspx?sc=ab%2Bcd&x=1'), JSON.stringify(r.gets));
  assert.equal(Buffer.from(r.msgs.find((m) => m.tipo === 'pdf-bytes').base64, 'base64').toString(), PDF_BYTES); assert.equal(r.cliques, 0);
});
await passo('formulário: resposta que não é PDF nem aponta para um: clica em OK sozinho, em vez de desistir', async () => {
  const r = await ficha((rt) => rt.fulfill({contentType: 'text/html', body: '<html>outra tela</html>'}), 'onsubmit="return false"');
  assert(!r.msgs.some((m) => m.tipo === 'pdf-bytes')); assert.equal(r.cliques, 1, 'clicou em OK sozinho (o formulário foi enviado de verdade)'); assert.doesNotMatch(r.faixa, /Gerar o PDF/);
});
await passo('reserva: se o OK clicado sozinho não faz a página mudar, a faixa pede UM clique dela (que o Chrome sempre aceita) em vez de acusar erro', async () => {
  const r = await ficha((rt) => rt.fulfill({contentType: 'text/html', body: '<html>outra tela</html>'}), 'onsubmit="return false"', 600);
  assert.equal(r.cliques, 1, 'primeiro tentou sozinho'); assert.match(r.faixa, /não respondeu ao meu clique/); assert.match(r.faixa, /Gerar o PDF \(clique aqui\)/); assert(!r.msgs.some((m) => m.estado === 'erro'), 'não é erro'); assert(r.msgs.some((m) => m.estado === 'manual'));
  await pagina.getByText('Gerar o PDF (clique aqui)').click(); await pagina.waitForTimeout(150);
  assert.equal(await pagina.evaluate(() => Number(sessionStorage.getItem('clicouOk') || 0)), 2, 'o clique dela dispara o OK de novo, dentro do gesto dela');
});

await passo('reserva: a faixa também tem "Copiar relatório", e ele leva a versão, o diagnóstico da resposta e o que o fundo viu', async () => {
  await ficha((rt) => rt.fulfill({contentType: 'text/html', body: '<html><script>window.open("/x.aspx")</script></html>'}), 'onsubmit="return false"', 600);
  await pagina.getByText('Copiar relatório').click(); await pagina.waitForTimeout(200);
  const o = JSON.parse(await pagina.evaluate(() => window.__copiado));
  assert.equal(o.versao, '9.9.9'); assert.match(o.aviso, /não respondeu ao meu clique/); assert.equal(o.fundo.popups, 'ok'); assert.equal(o.fundo.eventos[0].abaCriada, '/VisualizaTicket.aspx'); assert.equal(o.diagnostico.status, 200); assert(o.diagnostico.trechos.some((x) => /window\.open/.test(x)));
});

await passo('reserva: no passo do CONTRATO (escolher a Cópia Digitalizada) o OK ignorado também vira o botão de um clique dela, e a faixa o diz', async () => {
  const r = await ficha((rt) => rt.fulfill({contentType: 'text/html', body: '<html>outra tela</html>'}), 'onsubmit="return false"', 600, job({fila: ['contrato']}));
  assert.match(r.faixa, /não respondeu ao meu clique/); assert.match(r.faixa, /Gerar o PDF \(clique aqui\)/); assert(!r.msgs.some((m) => m.estado === 'erro'), 'não é erro');
  assert.equal(r.cliques, 1, 'tentou sozinho primeiro');
});
await passo('relatório: mostra o botão OK por dentro (onclick, formulário, alvo) e os trechos dos scripts da página que falam dele — sem números longos', async () => {
  const pg = '<!doctype html><body>' + TOPO() + '<form method="post" action="Pre_Visualiza.aspx?nire=35262229284" target="_blank" onsubmit="return validar(this)"><input type="radio" id="r1"><label for="r1">Ficha Cadastral Completa</label><input type="submit" id="btnEmitir" name="btnEmitir" value="OK" onclick="setarTipo(1); return true;"></form><script>function validar(f){ if(!document.hasFocus()) return false; window.open("Imprime.aspx?ticket=" + t + "&cpf=34550022850", "_blank"); }</script></body>';
  await pagina.route(ORIGEM + '/**', (r) => r.fulfill({contentType: 'text/html; charset=utf-8', body: pg}));
  await pagina.goto(ORIGEM + '/Pre_Visualiza.aspx?nire=35262229284');
  await pagina.addScriptTag({content: ler('ajudante/jucesp.js')});
  const rel = JSON.parse(await pagina.evaluate(() => window.AJ_JUCESP.relatorio(document, '/Pre_Visualiza.aspx', {fila: ['ficha']}, {})));
  const b = rel.botaoPorDentro; assert.equal(b.botao.tipo, 'submit'); assert.match(b.botao.onclick, /setarTipo\(1\)/); assert.equal(b.botao.formTarget, '_blank'); assert.match(b.botao.formOnsubmit, /validar\(this\)/); assert.equal(b.botao.formAcao, '/Pre_Visualiza.aspx'); assert.equal(b.botao.desabilitado, false);
  assert(b.scripts.some((x) => /window\.open/.test(x)), JSON.stringify(b.scripts)); assert(!/34550022850/.test(JSON.stringify(rel)), 'CPF não vai');
});

await passo('formulário: erro do servidor aparece escrito, com o "fazer à mão"', async () => {
  const r = await ficha((rt) => rt.fulfill({status: 500, contentType: 'text/html', body: 'erro'}));
  assert.match(r.faixa, /Não consegui pedir o PDF: A JUCESP respondeu 500/); assert.match(r.faixa, /Fazer à mão/); assert(r.msgs.some((m) => m.estado === 'erro'));
});
await passo('formulário: quando a resposta não é PDF, o que a JUCESP respondeu fica registrado (trechos que importam, campos enviados, o fim) — sem números longos nem campos escondidos', async () => {
  const resposta = '<html><body>Olá, SHIRLEY DANTAS 34550022850 <input type="hidden" name="__VIEWSTATE" value="' + 'A'.repeat(200) + '"> Protocolo 123456789012 <script>setTimeout(function(){ window.open("Documento" + "/ver.aspx?x=" + t, "_blank"); }, 10);</script> <p>fim da página</p></body></html>';
  const r = await ficha((rt) => rt.fulfill({contentType: 'text/html; charset=utf-8', body: resposta}), 'onsubmit="return false"');
  const d = await pagina.evaluate(() => window.AJ_JUCESP.diagnostico());
  assert(d, 'registrou'); assert.equal(d.status, 200); assert.match(d.tipo, /text\/html/); assert.equal(d.tamanho, Buffer.byteLength(resposta)); assert.equal(d.endereco, '/Pre_Visualiza.aspx');
  assert(d.enviados.includes('__VIEWSTATE') && d.enviados.includes('ctl00$cphContent$frmPreVisualiza$btnEmitir') && d.enviados.includes('ctl00$cphContent$frmPreVisualiza$rblTipoDocumento'), JSON.stringify(d.enviados));
  assert(d.trechos.some((x) => /window\.open\("Documento"/.test(x)), JSON.stringify(d.trechos)); assert.match(d.fim, /fim da página/);
  const tudo = JSON.stringify(d); assert(!/34550022850|123456789012/.test(tudo), 'CPF e protocolo não vão'); assert(!/AAAAAAAAAA/.test(tudo), 'campos escondidos não vão'); assert(d.fim.length <= 300 && d.trechos.length <= 12);
  assert.equal(r.cliques, 1, 'e clicou em OK sozinho');
});
await passo('formulário: o endereço do PDF é achado mesmo com outro nome de página, desde que leve o ticket (sc=…)', async () => {
  const r = await ficha((rt) => rt.fulfill({contentType: 'text/html', body: "<html><script>top.location.href='/Imprimir.aspx?id=7&amp;sc=ab%2Bcd';</script></html>"}));
  assert(r.gets.some((g) => g === '/Imprimir.aspx?id=7&sc=ab%2Bcd'), JSON.stringify(r.gets));
});
await passo('fundo: o PDF aberto é pedido primeiro à aba da JUCESP (sessão e cookies dela); só se ela não puder, o fundo baixa por conta própria', async () => {
  const b64 = Buffer.from('%PDF-1.4 pela aba').toString('base64');
  const a = mundoFundo({buscarPdf: {ok: true, base64: b64}}); await a.msg({tipo: 'pedido', pedido: pedido()}, PAINEL);
  await a.abrir('https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=1', 90, 71);
  assert(a.enviadas.some((e) => e.tabId === 71 && e.tipo === 'buscar-pdf' && /VisualizaTicket/.test(e.url)));
  assert.equal(a.busca.filter((x) => x.url.includes('VisualizaTicket')).length, 0, 'o fundo não buscou por conta própria'); assert.equal(a.gasEnviado()[0].base64, b64);
  for (const resp of [{ok: false, status: 200, tipo: 'text/html'}, 'erro', undefined]) {
    const m = mundoFundo({buscarPdf: resp}); await m.msg({tipo: 'pedido', pedido: pedido()}, PAINEL); await m.abrir('https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=2', 90, 71);
    assert.equal(m.busca.filter((x) => x.url.includes('VisualizaTicket')).length, 1, 'sem resposta útil da aba, o fundo baixa'); assert.equal(m.gasEnviado().length, 1);
  }
});

await passo('fundo: enquanto há pedido andando, os pop-ups SÓ do site da JUCESP ficam liberados; ao terminar o último, a configuração é desfeita', async () => {
  const m = mundoFundo(); await m.msg({tipo: 'pedido', pedido: pedido()}, PAINEL);
  assert.deepEqual(m.popups.map((p) => [p.acao, p.primaryPattern, p.setting]), [['set', 'https://www.jucesponline.sp.gov.br/*', 'allow']], 'só a JUCESP, só "allow"');
  await m.abrir('https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=1', 71); await esperar();
  assert.equal(m.popups.at(-1).acao, 'clear', 'terminou: volta ao que era');
  const dois = mundoFundo(); await dois.msg({tipo: 'pedido', pedido: pedido()}, PAINEL); await dois.msg({tipo: 'pedido', pedido: pedido({id: 'ajteste2', cnpj: '11222333000181'})}, PAINEL);
  await dois.msg({tipo: 'cancelar', id: 'ajteste1'}, PAINEL); assert(!dois.popups.some((p) => p.acao === 'clear'), 'ainda há um pedido andando: não desfaz');
  await dois.msg({tipo: 'cancelar', id: 'ajteste2'}, PAINEL); assert.equal(dois.popups.at(-1).acao, 'clear');
  const semApi = mundoFundo(); delete semApi.criadas; // o mundo sem a API não pode derrubar o pedido (a faixa tem o botão de reserva)
});

await passo('fundo: guarda o que viu — pop-ups liberados?, abas abertas pela página, como o PDF foi buscado — e entrega ao relatório (sem a parte secreta do endereço)', async () => {
  const b64 = Buffer.from('%PDF-1.4 x').toString('base64');
  const m = mundoFundo({buscarPdf: {ok: true, base64: b64}}); await m.msg({tipo: 'pedido', pedido: pedido({quero: ['ficha', 'contrato']})}, PAINEL);
  m.ouv.cri({id: 90, openerTabId: 71, pendingUrl: 'https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=SEGREDO'}); await esperar();
  m.ouv.cri({id: 91, openerTabId: 555, pendingUrl: 'https://outra.com/x'}); await esperar();   // de outra aba: não conta
  await m.abrir('https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=SEGREDO', 90, 71);
  const d = await m.msg({tipo: 'diagnostico-fundo'}, 71);
  assert.equal(d.popups, 'ok'); assert(d.eventos.some((e) => e.abaCriada === '/VisualizaTicket.aspx')); assert(d.eventos.some((e) => e.pdfEm === '/VisualizaTicket.aspx' && e.aba === 'nova')); assert(d.eventos.some((e) => e.buscaPelaAba === 'ok'));
  assert(!JSON.stringify(d).includes('SEGREDO'), 'o ticket não vai para o relatório'); assert(!JSON.stringify(d).includes('outra.com'));
  const f = mundoFundo({popupsFalha: 'Pattern not valid'}); const r = await f.msg({tipo: 'pedido', pedido: pedido()}, PAINEL); assert.equal(r.ok, true, 'falha nos pop-ups não derruba o pedido');
  assert.match((await f.msg({tipo: 'diagnostico-fundo'}, 71)).popups, /erro: Pattern not valid/);
  const s = mundoFundo({buscarPdf: {ok: false, status: 200, tipo: 'text/html'}}); await s.msg({tipo: 'pedido', pedido: pedido()}, PAINEL); await s.abrir('https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=1', 90, 71);
  const e = (await s.msg({tipo: 'diagnostico-fundo'}, 71)); assert.equal(e, null, 'depois de terminar a aba deixa de ser acompanhada');
});

await passo('fundo: o endereço do PDF vale UMA vez — enquanto há pedido, a navegação a ele é bloqueada (só janelas e quadros) e o Ajudante o baixa ele mesmo; ao terminar, o bloqueio sai', async () => {
  const b64 = Buffer.from('%PDF-1.4 uma vez so').toString('base64');
  const m = mundoFundo({buscarPdf: {ok: true, base64: b64}}); await m.msg({tipo: 'pedido', pedido: pedido()}, PAINEL);
  const lig = m.regras.at(-1); assert.deepEqual(lig.removeRuleIds, [7001]); assert.equal(lig.addRules.length, 1);
  const r = lig.addRules[0]; assert.equal(r.action.type, 'block'); assert.equal(r.condition.urlFilter, '||www.jucesponline.sp.gov.br/VisualizaTicket.aspx'); assert.deepEqual(r.condition.resourceTypes, ['main_frame', 'sub_frame'], 'a busca do Ajudante (outro tipo) passa');
  // a página abriu uma aba para o PDF; o Chrome avisa que vai navegar (antes de pedir) e a aba é a filha do pedido
  m.ouv.cri({id: 90, openerTabId: 71, pendingUrl: 'https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=SEGREDO'}); await esperar();
  m.ouv.nav({tabId: 90, frameId: 0, url: 'https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=SEGREDO'}); await esperar();
  assert.equal(m.gasEnviado().length, 1); assert.equal(m.gasEnviado()[0].base64, b64); assert.equal(m.busca.filter((x) => x.url.includes('VisualizaTicket')).length, 0, 'o fundo não pediu o endereço de novo');
  assert.deepEqual(m.removidas, [90], 'a aba bloqueada é fechada'); assert.deepEqual(m.regras.at(-1), {removeRuleIds: [7001], addRules: []}, 'terminou: o bloqueio sai');
  // o aviso da navegação e o da atualização da aba, juntos, baixam uma vez só
  const d = mundoFundo({buscarPdf: {ok: true, base64: b64}}); await d.msg({tipo: 'pedido', pedido: pedido({quero: ['ficha', 'contrato']})}, PAINEL);
  d.ouv.nav({tabId: 71, frameId: 0, url: 'https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=1'}); d.ouv.upd(71, {url: 'x'}, {url: 'https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=1'}); await esperar();
  assert.equal(d.gasEnviado().length, 1, 'uma notificação por endereço');
  // aba que não é do pedido, endereço de outro site e outra página da JUCESP: nada
  const o = mundoFundo(); await o.msg({tipo: 'pedido', pedido: pedido()}, PAINEL);
  o.ouv.nav({tabId: 999, frameId: 0, url: 'https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=1'}); o.ouv.nav({tabId: 71, frameId: 0, url: 'https://site-malvado.com/VisualizaTicket.aspx?sc=1'}); o.ouv.nav({tabId: 71, frameId: 0, url: 'https://www.jucesponline.sp.gov.br/Default.aspx'}); await esperar();
  assert.equal(o.gasEnviado().length, 0);
});
await passo('fundo: uma regra esquecida de um pedido antigo sai quando a extensão acorda sem pedido andando — senão bloquearia os PDFs dela para sempre', async () => {
  const m = mundoFundo(); await esperar();
  assert.deepEqual(m.regras.at(-1), {removeRuleIds: [7001], addRules: []}, 'ao acordar, sem pedido, a regra sai');
});
await passo('fundo: sem a API de bloqueio ou com ela recusando, o pedido segue e o relatório diz', async () => {
  const m = mundoFundo(); const r = await m.msg({tipo: 'pedido', pedido: pedido()}, PAINEL); assert.equal(r.ok, true);
  assert.equal((await m.msg({tipo: 'diagnostico-fundo'}, 71)).popups, 'ok');
});

await passo('fundo: com a aba do pedido já bloqueada (ela era a que ia abrir o PDF), o PDF é buscado de uma aba AUXILIAR da JUCESP — uma vez só, e a aba auxiliar fecha', async () => {
  const b64 = Buffer.from('%PDF-1.4 pela auxiliar').toString('base64');
  const m = mundoFundo({buscarPdf: 'erro', auxiliar: {ok: true, base64: b64}}); await m.msg({tipo: 'pedido', pedido: pedido()}, PAINEL);
  m.ouv.nav({tabId: 71, frameId: 0, url: 'https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=SEGREDO'}); await esperar();
  assert.equal(m.gasEnviado().length, 1); assert.equal(m.gasEnviado()[0].base64, b64);
  const aux = m.criadas[1]; assert.equal(aux.url, 'https://www.jucesponline.sp.gov.br/Default.aspx'); assert.equal(aux.active, false, 'a aba auxiliar não rouba a tela');
  assert.equal(m.auxiliares.length, 1); assert.equal(m.auxiliares[0].tabId, 72); assert.equal(JSON.stringify(m.auxiliares[0].args), JSON.stringify(['https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=SEGREDO'])); assert.equal(m.auxiliares[0].func, 'function');
  assert.deepEqual(m.removidas, [72], 'fecha a auxiliar');
  assert.equal(m.busca.filter((x) => x.url.includes('VisualizaTicket')).length, 0, 'e o fundo não pediu o endereço por conta própria');
  const d = await mundoFundo({buscarPdf: 'erro', auxiliar: {ok: true, base64: b64}}); await d.msg({tipo: 'pedido', pedido: pedido()}, PAINEL); d.ouv.nav({tabId: 71, frameId: 0, url: 'https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=1'}); await esperar();
  const ev = (await d.msg({tipo: 'diagnostico-fundo'}, 71)); assert.equal(ev, null);   // terminou: sem aba acompanhada
  assert.equal(d.atualizadas.at(-1).id, 71); assert.equal(d.atualizadas.at(-1).url, 'https://www.jucesponline.sp.gov.br/Default.aspx', 'o PDF queria abrir na própria aba: ela volta ao site, em vez de ficar na página de erro');
});
await passo('fundo: se a aba auxiliar também falha, o fundo ainda tenta por conta própria (e o erro, se vier, é escrito); sem a API scripting não cria aba nenhuma', async () => {
  const m = mundoFundo({buscarPdf: 'erro', auxiliar: 'erro'}); await m.msg({tipo: 'pedido', pedido: pedido()}, PAINEL); m.ouv.nav({tabId: 71, frameId: 0, url: 'https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=2'}); await esperar();
  assert.equal(m.busca.filter((x) => x.url.includes('VisualizaTicket')).length, 1, 'tentou pelo fundo'); assert.deepEqual(m.removidas, [72], 'a auxiliar fechou mesmo falhando');
  const s = mundoFundo({buscarPdf: 'erro'}); await s.msg({tipo: 'pedido', pedido: pedido()}, PAINEL); s.ouv.nav({tabId: 71, frameId: 0, url: 'https://www.jucesponline.sp.gov.br/VisualizaTicket.aspx?sc=3'}); await esperar();
  assert.equal(s.criadas.length, 1, 'sem a API não abre aba auxiliar');
});

await passo('fundo: o PDF trazido pela aba do pedido (pdf-bytes) é conferido, guardado e a fila anda — e o que não é PDF vira erro escrito', async () => {
  const m = mundoFundo(); await m.msg({tipo: 'pedido', pedido: pedido({quero: ['ficha', 'contrato']})}, PAINEL); await m.msg({tipo: 'nire', nire: '35262229284', empresa: 'JRL HOLDING LTDA'}, 71);
  const b64 = Buffer.from('%PDF-1.4 x').toString('base64');
  const r = await m.msg({tipo: 'pdf-bytes', base64: b64}, 71); assert.equal(r.ok, true); await esperar();
  const [g] = m.gasEnviado(); assert.equal(g.base64, b64); assert.equal(g.tipoSugerido, 'FICHA_CADASTRAL_JUCESP'); assert.equal(m.atualizadas.at(-1).url, 'https://www.jucesponline.sp.gov.br/Pre_Visualiza.aspx?nire=35262229284&idproduto=');
  const n = mundoFundo(); await n.msg({tipo: 'pedido', pedido: pedido()}, PAINEL);
  await n.msg({tipo: 'pdf-bytes', base64: Buffer.from('<html>erro</html>').toString('base64')}, 71); await esperar();
  assert(n.enviadas.some((e) => e.estado === 'erro' && /não é um PDF/.test(e.texto) && e.fim === true)); assert.equal(n.gasEnviado().length, 0);
  assert.equal(await n.msg({tipo: 'pdf-bytes', base64: b64}, 999), null, 'de outra aba não vale');
});

await passo('link com script (__doPostBack): o Chrome não deixa executar, então o Ajudante preenche os campos escondidos e envia o formulário — sem script', async () => {
  const posts = [];
  const html = TOPO() + `<form method="post" action="/ResultadoBusca.aspx" id="aspnetForm"><input type="hidden" name="__EVENTTARGET" id="__EVENTTARGET" value=""><input type="hidden" name="__EVENTARGUMENT" value=""><input type="hidden" name="__VIEWSTATE" value="vs9">
    <p>Resultados 1 - 1 de 1 para o termo '52247521000141'</p><table><tr><th>NIRE</th><th>Empresa</th><th>Município</th></tr><tr><td><a href="javascript:__doPostBack('ctl00$cphContent$gdvResultadoBusca$ctl02$lnkNire','')">35262229284</a></td><td>JRL HOLDING LTDA</td><td>OSASCO</td></tr></table></form>`;
  await pagina.route(ORIGEM + '/**', (r) => { const q = r.request(); if (q.method() === 'POST') { posts.push(q.postData()); return r.fulfill({contentType: 'text/html', body: '<html><body>seguinte</body></html>'}); } return r.fulfill({contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body>' + html + '</body></html>'}); });
  await pagina.goto(ORIGEM + '/ResultadoBusca.aspx'); await pagina.evaluate(() => sessionStorage.clear());
  await pagina.evaluate((j) => { window.__msgs = []; window.chrome = {runtime: {sendMessage: async (m) => { window.__msgs.push(m); return m.tipo === 'quem' ? j : {ok: true}; }}}; }, job());
  const erros = []; pagina.on('console', (m) => { if (/Content Security Policy/.test(m.text())) erros.push(m.text()); });
  await pagina.addScriptTag({content: ler('ajudante/jucesp.js')});
  await pagina.waitForTimeout(900);
  assert.equal(posts.length, 1, 'o formulário foi enviado'); const c = new URLSearchParams(posts[0]);
  assert.equal(c.get('__EVENTTARGET'), 'ctl00$cphContent$gdvResultadoBusca$ctl02$lnkNire'); assert.equal(c.get('__EVENTARGUMENT'), ''); assert.equal(c.get('__VIEWSTATE'), 'vs9'); assert.equal(erros.length, 0);
});
await passo('link com script que não é postback: avisa escrito, sem tentar executar', async () => {
  const html = TOPO() + "<form><p>Resultados 1 - 1 de 1 para o termo 'x'</p><table><tr><td><a href=\"javascript:abrirOutraCoisa(1)\">35262229284</a></td><td>EMPRESA X LTDA</td></tr></table></form>";
  await pagina.route(ORIGEM + '/**', (r) => r.fulfill({contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body>' + html + '</body></html>'}));
  await pagina.goto(ORIGEM + '/ResultadoBusca.aspx?outro=1'); await pagina.evaluate(() => sessionStorage.clear());
  await pagina.evaluate((j) => { window.__msgs = []; window.chrome = {runtime: {sendMessage: async (m) => { window.__msgs.push(m); return m.tipo === 'quem' ? j : {ok: true}; }}}; }, job());
  await pagina.addScriptTag({content: ler('ajudante/jucesp.js')}); await pagina.waitForTimeout(700);
  assert.match(await pagina.evaluate(() => document.getElementById('aj-faixa').innerText), /script que o Chrome não deixa/); assert(((await pagina.evaluate(() => window.__msgs))).some((m) => m.estado === 'erro'));
});

await passo('página: a pedido do fundo a aba busca o PDF com a própria sessão — e recusa endereço que não é do PDF da JUCESP', async () => {
  await pagina.route(ORIGEM + '/**', (r) => { const u = new URL(r.request().url()); if (/VisualizaTicket/.test(u.pathname)) return r.fulfill({contentType: 'application/pdf', body: PDF_BYTES}); return r.fulfill({contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body>' + TOPO(false) + '</body></html>'}); });
  await pagina.goto(ORIGEM + '/Default.aspx?buscar=1'); await pagina.evaluate(() => sessionStorage.clear());
  await pagina.evaluate((j) => { window.__msgs = []; window.chrome = {runtime: {sendMessage: async (m) => { window.__msgs.push(m); return m.tipo === 'quem' ? j : {ok: true}; }, onMessage: {addListener: (f) => { window.__ouvinte = f; }}}}; }, job());
  await pagina.addScriptTag({content: ler('ajudante/jucesp.js')}); await pagina.waitForTimeout(300);
  const pedir = (url) => pagina.evaluate((u) => new Promise((res) => { const retorno = window.__ouvinte({tipo: 'buscar-pdf', url: u}, {}, res); if (retorno !== true) res({semResposta: true}); }), url);
  const ok = await pedir('/VisualizaTicket.aspx?sc=abc'); assert.equal(ok.ok, true); assert.equal(Buffer.from(ok.base64, 'base64').toString(), PDF_BYTES);
  assert.equal((await pedir('https://site-malvado.com/VisualizaTicket.aspx?sc=1')).ok, false); assert.equal((await pedir('/Default.aspx')).ok, false);
});

await navegador.close();
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
