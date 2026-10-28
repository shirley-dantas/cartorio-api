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
  assert.deepEqual(m.permissions.sort(), ['storage', 'tabs']);
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
  assert.equal(JSON.stringify(p.postadas[0].m), JSON.stringify({fonte: 'ajudante', tipo: 'ajudante-progresso', id: 'ajteste1', estado: 'ok', texto: 'Pronto'}));
});

// ── O fundo ──
function mundoFundo({pdf = '%PDF-1.4 conteudo', tipoPdf = 'application/pdf', gas = {ok: true, nome: 'JRL_HOLDING_LTDA_FICHA_CADASTRAL_JUCESP_2026-10-28_1.pdf', confirmar: false}, gasTexto, statusPdf = 200} = {}) {
  const store = {}, enviadas = [], criadas = [], atualizadas = [], busca = [], ouv = {msg: null, upd: null, rem: null};
  const chrome = {
    storage: {local: {get: async (k) => (k in store ? {[k]: JSON.parse(JSON.stringify(store[k]))} : {}), set: async (o) => { for (const [k, v] of Object.entries(o)) store[k] = JSON.parse(JSON.stringify(v)); }}},
    tabs: {create: async (o) => { criadas.push(o); return {id: 70 + criadas.length}; }, update: async (id, o) => { atualizadas.push({id, ...o}); }, sendMessage: async (id, m) => { enviadas.push({tabId: id, ...m}); },
      onUpdated: {addListener: (f) => { ouv.upd = f; }}, onRemoved: {addListener: (f) => { ouv.rem = f; }}},
    runtime: {onMessage: {addListener: (f) => { ouv.msg = f; }}}
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
  const abrir = (url, aba) => { ouv.upd(aba, {url}, {url}); return esperar(); };
  return {store, enviadas, criadas, atualizadas, busca, msg, abrir, ouv, gasEnviado: () => busca.filter((b) => b.url.startsWith('https://script.google.com/')).map((b) => JSON.parse(b.o.body))};
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
  const fim = m.enviadas.filter((e) => e.estado === 'ok').pop(); assert(fim && /Pronto!/.test(fim.texto) && /Ficha cadastral completa/.test(fim.texto), JSON.stringify(m.enviadas.at(-1)));
  assert.equal(await m.msg({tipo: 'quem'}, 71), null, 'terminou: a aba deixa de ser acompanhada');
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
  copia: (linhas) => TOPO() + '<h2>Cópia Digitalizada de Documentos Arquivados</h2><table><tr><th></th><th>Sessão</th><th>Nº Registro</th><th>Protocolo</th><th>Descrição</th><th></th><th>Digitalização</th></tr>' +
    linhas.map((l, i) => `<tr><td><input type="radio" name="s" value="${i}"></td><td>${l.data}</td><td>${l.reg}</td><td>${l.prot}</td><td>${l.desc}</td><td><a href="#">DETALHES</a></td><td>${l.disp === false ? 'INDISPONÍVEL' : 'DISPONÍVEL'}</td></tr><tr class="det" style="display:none"><td colspan="7">${l.det}</td></tr>`).join('') +
    '</table><div>« < Anterior Mostrando 1 - ' + linhas.length + ' de ' + linhas.length + ' Próximo > »</div><input type="button" value="CONTINUAR">'
};
const L1 = {data: '20/09/2023', reg: '0', prot: 'SPP2330855821', desc: 'CONSTITUIÇÃO DE 35262229284', det: 'Ato: Constituição de Matriz'};
const L2 = {data: '02/04/2026', reg: '1.180.995/26-0', prot: 'SPN2612209383', desc: 'ALTERAÇÃO DE SOCIOS/TITULAR/DIRETOR ...', det: 'Atos: Consolidação da Matriz, Alteração de Capital e QSA'};
const L0 = {data: '10/01/2025', reg: '0.500.100/25-1', prot: 'SPN2500100001', desc: 'ALTERAÇÃO DE ENDEREÇO ...', det: 'Atos: Consolidação da Matriz, Alteração de Endereço'};

const navegador = await abrirChromium();
const pagina = await navegador.newPage();
async function plano(html, caminho, job) {
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
  const f = await plano(PAG.escolha(), '/Pre_Visualiza.aspx', job()); assert.equal(f.acao, 'escolher'); assert.match(f.radio, /^Ficha Cadastral Completa/); assert.equal(f.botao, 'OK');
  const c = await plano(PAG.escolha(), '/Pre_Visualiza.aspx', job({fila: ['contrato']})); assert.match(c.radio, /^Cópia Digitalizada/); assert.notEqual(c.acao, 'erro');
});
await passo('tela: na lista de cópias, pega a CONSOLIDAÇÃO mais recente (os detalhes ficam escondidos na linha)', async () => {
  const p = await plano(PAG.copia([L1, L2]), '/Restricted/Solicitacoes/Fotocopia/EscolheDocumentos.aspx', job({fila: ['contrato']}));
  assert.equal(p.acao, 'copia'); assert.match(p.radio, /02\/04\/2026/); assert.equal(p.botao, 'CONTINUAR'); assert.match(p.texto, /02\/04\/2026/); assert.match(p.texto, /1\.180\.995\/26-0/);
  const tres = await plano(PAG.copia([L0, L1, L2]), '/Restricted/Solicitacoes/Fotocopia/EscolheDocumentos.aspx', job({fila: ['contrato']}));
  assert.match(tres.radio, /02\/04\/2026/); assert.match(tres.texto, /havia 2, peguei a última/);
  const ordemTroca = await plano(PAG.copia([L2, L0, L1]), '/Restricted/Solicitacoes/Fotocopia/EscolheDocumentos.aspx', job({fila: ['contrato']})); assert.match(ordemTroca.radio, /02\/04\/2026/, 'não depende da ordem da lista');
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
  const rel = await pagina.evaluate(() => window.AJ_JUCESP.relatorio(document, '/Restricted/Solicitacoes/Fotocopia/EscolheDocumentos.aspx', {fila: ['contrato']}));
  const o = JSON.parse(rel); assert.equal(o.pagina, 'copia'); assert.equal(o.logada, true); assert.equal(o.linhas.length, 2); assert(!/sc=/.test(rel)); assert(o.botoes.includes('continuar'));
});

// ── A parte que mexe na página: digita, clica, avisa — numa JUCESP simulada, com a extensão fingida ──
const ORIGEM = 'https://www.jucesponline.sp.gov.br';
const flag = (html) => html.replace(/<input type="submit" value="Buscar">/g, '<input type="submit" value="Buscar" onclick="window.__clicou=(window.__clicou||[]).concat(\'Buscar\'); return false">')
  .replace(/<input type="button" value="OK">/g, '<input type="button" value="OK" onclick="window.__clicou=(window.__clicou||[]).concat(\'OK\')">')
  .replace(/<a href="\/Pre_Visualiza\.aspx\?nire=(\d+)">/g, '<a href="#" onclick="window.__clicou=(window.__clicou||[]).concat(\'nire $1\'); return false">')
  .replace(/<a href="\/Pesquisa\.aspx">/g, '<a href="#" onclick="window.__clicou=(window.__clicou||[]).concat(\'menu\'); return false">');
async function rodarNaPagina(caminho, html, jobDado = job()) {
  await pagina.route(ORIGEM + '/**', (r) => r.fulfill({contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body>' + flag(html) + '</body></html>'}));
  await pagina.goto(ORIGEM + caminho);
  await pagina.evaluate((j) => {
    window.__msgs = []; window.__texto = '';
    window.chrome = {runtime: {sendMessage: async (m) => { window.__msgs.push(m); return m.tipo === 'quem' ? j : {ok: true}; }}};
  }, jobDado);
  await pagina.addScriptTag({content: ler('ajudante/jucesp.js')});
  await pagina.waitForTimeout(450);
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
  const b = await rodarNaPagina('/Pre_Visualiza.aspx?nire=35262229284&idproduto=', PAG.escolha());
  assert.deepEqual(b.clicou, ['OK']); assert(b.msgs.some((m) => m.tipo === 'nire' && m.nire === '35262229284'), 'guarda o NIRE da própria tela');
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
  let ultimo; for (let i = 0; i < 4; i++) ultimo = await rodarNaPagina('/Pesquisa.aspx?repete=1', PAG.busca());
  assert.match(ultimo.faixa, /tentei 3 vezes/); assert(ultimo.msgs.some((m) => m.estado === 'erro' && /tentei 3 vezes/.test(m.texto)));
});
await passo('página: quando a lista de cópias não tem consolidação, avisa o fundo que ficou à mão (para ele ainda pegar o PDF)', async () => {
  const r = await rodarNaPagina('/Restricted/Solicitacoes/Fotocopia/EscolheDocumentos.aspx', PAG.copia([L1]), job({fila: ['contrato']}));
  assert(r.msgs.some((m) => m.tipo === 'manual')); assert(r.msgs.some((m) => m.estado === 'manual' && /nenhum ato de consolidação/.test(m.texto))); assert.deepEqual(r.clicou, []);
});
await navegador.close();

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
    GAS_URL: 'https://gas/exec', casos: {}, finToast() {}, alert() {}, confirm: () => true, btoa, atob, Uint8Array, String, Promise, console, Object, Number, Date, setTimeout: () => 0,
    location: {search: '', origin: 'https://cartorio-api.vercel.app'}, history: {replaceState() {}}, caches: {open: async () => ({keys: async () => []})}, File, Blob,
    localStorage: (() => { const s = {}; return {getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }}; })(),
    document: {addEventListener() {}, getElementById: el, querySelectorAll: (s) => (s === '.cx-solte' ? zonas : [])},
    window: null
  };
  const win = {addEventListener: (t, f) => { (ouv[t] = ouv[t] || []).push(f); }, postMessage: (m, o) => postadas.push({m, o})};
  caixa.window = Object.assign(caixa, win);
  vm.createContext(caixa);
  vm.runInContext(html.slice(ini, fim) + '\nthis.__f={AJUDANTE,solteHtml,ajudanteHtml,ajCnpjValido,ajudanteOuvir:window.ajudanteOuvir,janela:window};', caixa);
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

console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
