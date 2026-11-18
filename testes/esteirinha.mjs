// A esteirinha do card: as regras (puras) e a tela de verdade, com o banco fingido.
//   node testes/esteirinha.mjs
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {abrirChromium} from './navegador-de-teste.mjs';
import {servir} from './servidor.mjs';
const AQUI = dirname(fileURLToPath(import.meta.url)), html = readFileSync(join(AQUI, '..', 'index.html'), 'utf8');
const erros = [];
const J = (x) => JSON.parse(JSON.stringify(x));
const passo = async (n, f) => { try { await f(); console.log('  ok  ' + n); } catch (e) { erros.push(n); console.log('FALHA ' + n + ' → ' + (e && e.message)); } };

// ── as regras, sem navegador ──
const a = html.indexOf('// ── A esteirinha: regras ──'), b = html.indexOf('// ── fim: a esteirinha: regras ──');
assert(a > 0 && b > a, 'não achei o bloco das regras');
const R = vm.runInNewContext('(function(){' + html.slice(a, b) + '\nreturn {ESTEIRA_ETAPAS,ESTEIRA_OUTRAS,ESTEIRA_FUNCOES,esteiraEtapaDe,esteiraEtapaDaTrilha,esteiraDepDe,esteiraEventos,esteiraAplicar,esteiraTemControle,ESTEIRA_TQ};})()');
const DEPS = (html.match(/const DEPS=\[([^\]]*)\]/) || [])[1].split(',').map(x => x.trim().replace(/^'|'$/g, ''));

await passo('onze etapas no caminho, três de espera, sete funções', () => {
  assert.equal(R.ESTEIRA_ETAPAS.length, 11); assert.equal(R.ESTEIRA_OUTRAS.length, 3); assert.equal(R.ESTEIRA_FUNCOES.length, 7);
});
await passo('toda etapa que já existia no banco é lida como alguma etapa — só o Jurídico Prime fica sem lugar, e a tela pede para escolher', () => {
  const sem = DEPS.filter(d => R.esteiraEtapaDe({dep: d, agendado: 'x'}) === null);
  assert.deepEqual(sem, ['Jurídico Prime']);
  assert.equal(R.esteiraEtapaDe({dep: 'Pré-conferência'}), 'minuta-aprov');
  assert.equal(R.esteiraEtapaDe({dep: 'Aguardando gerar ITBI'}), 'minuta-aprov');
  assert.equal(R.esteiraEtapaDe({dep: 'ITBI aguardando pagamento'}), 'minuta-aprov');
  assert.equal(R.esteiraEtapaDe({dep: 'Travar agenda', agendado: ''}), 'minuta-aprov');
  assert.equal(R.esteiraEtapaDe({dep: 'Travar agenda', agendado: '2026-11-10T10:00'}), 'sem-pend');
  assert.equal(R.esteiraEtapaDe({dep: ''}), 'sem-pend');
  assert.equal(R.esteiraEtapaDe({dep: 'Minutando', concluido: true}), 'concluido');
});
await passo('TQ, traslado e “traslado pronto” são a mesma pílula, e o estado de dentro é preservado', () => {
  for (const x of R.ESTEIRA_TQ) { assert.equal(R.esteiraEtapaDe({dep: x[0]}), 'tq'); assert.equal(R.esteiraDepDe('tq', {dep: x[0]}), x[0]); }
  assert.equal(R.esteiraDepDe('tq', {dep: 'Falta assinatura'}), 'Aguardando TQ');
});
await passo('as etapas de espera guardam de onde o caso saiu, e a trilha continua mostrando essa etapa', () => {
  const c = {dep: 'Aguardando cliente (outro)', depVolta: 'Minutando'};
  assert.equal(R.esteiraEtapaDe(c), 'aguard-cliente'); assert.equal(R.esteiraEtapaDaTrilha(c), 'minutando');
  assert.equal(R.esteiraEtapaDaTrilha({dep: 'Nota de exigência', depVolta: 'Registro de Imóveis'}), 'registro');
});
await passo('eventos: o que mudou entre duas fotos do caso', () => {
  const base = {documentos: {}, agendado: '', prenotacao: '', livro: '', folha: ''};
  assert.deepEqual(J(R.esteiraEventos(base, {...base, docUrl: 'https://d'})), ['minuta-pronta']);
  assert.deepEqual(J(R.esteiraEventos(base, {...base, agendado: '2026-11-10T10:00'})), ['agenda-travada']);
  assert.deepEqual(J(R.esteiraEventos(base, {...base, prenotacao: '123'})), ['prenotacao']);
  assert.deepEqual(J(R.esteiraEventos({...base, livro: '2'}, {...base, livro: '2', folha: '33'})), ['livro-folha']);
  assert.deepEqual(J(R.esteiraEventos(base, {...base, orcAprovacao: {em: 5}})), ['orc-aprovou']);
  assert.deepEqual(J(R.esteiraEventos(base, {...base, documentos: {x: {tipo: 'documento'}}})), ['docs-chegaram']);
  assert.deepEqual(J(R.esteiraEventos(base, {...base, documentos: {x: {tipo: 'documento', provisorio: true}}})), []);
  assert.deepEqual(J(R.esteiraEventos(base, base)), []);
  assert.deepEqual(J(R.esteiraEventos(null, base)), []);
});
await passo('movimentos sozinhos: só para a frente e só da etapa certa', () => {
  const mv = (dep, ev, extra = {}) => R.esteiraAplicar({dep, ...extra}, ev);
  assert.equal(mv('Minutando', 'minuta-pronta').dep, 'Aguardando aprovação da minuta');
  assert.equal(mv('Aguardando aprovação da minuta', 'agenda-travada').dep, '');
  assert.equal(mv('Pré-conferência', 'agenda-travada').dep, '');
  assert.equal(mv('Aguardando aprovação do orçamento', 'orc-aprovou').dep, 'Minutando');
  assert.equal(mv('Orçamento a enviar', 'orc-enviado').dep, 'Aguardando aprovação do orçamento');
  assert.equal(mv('Aguardando TQ', 'prenotacao').dep, 'Registro de Imóveis');
  assert.equal(mv('Falta documentos', 'docs-chegaram').dep, 'Minutando');
  assert.equal(mv('Falta assinatura', 'orc-enviado'), null, 'orçamento reenviado na assinatura não puxa para trás');
  assert.equal(mv('Registro de Imóveis', 'minuta-pronta'), null);
  assert.equal(mv('Nota de exigência', 'prenotacao'), null);
});
await passo('livro e folha só perguntam em “Sem pendências” — quem sabe se falta assinar é ela', () => {
  assert.deepEqual(J(R.esteiraAplicar({dep: ''}, 'livro-folha')), {pergunta: true});
  assert.equal(R.esteiraAplicar({dep: 'Falta assinatura'}, 'livro-folha'), null);
  assert.equal(R.esteiraAplicar({dep: 'Minutando'}, 'livro-folha'), null);
});
await passo('o Financeiro só aparece com o número de controle', () => {
  assert.equal(R.esteiraTemControle({controle: ''}), false); assert.equal(R.esteiraTemControle({controle: '  '}), false); assert.equal(R.esteiraTemControle({controle: '51 0034'}), true);
});

// ── a tela, com o banco fingido ──
const srv = await servir(), nav = await abrirChromium();
const ctx = await nav.newContext({viewport: {width: 1280, height: 1000}}), p = await ctx.newPage();
const hoje = new Date().toISOString().slice(0, 10);
const doc = (nome, extra = {}) => ({nome, tipo: 'documento', origem: 'arrastado no card', texto: 'lido', tipoDocumento: 'RG_CNH', pessoa: 'Maria', ...extra});
const caso = (id, extra = {}) => ({id, nome: 'CASO ' + id, tipo: 'Compra e venda', status: 'atencao', resp: 'grazi', dep: 'Minutando', depDesde: hoje, atualizado: hoje, documentos: {d1: doc('a.pdf')}, ...extra});
await p.addInitScript(() => { try { localStorage.setItem('painel_usuario', 'Shirley'); } catch (e) {} });
await p.addInitScript(([c]) => { window.__RAIZ = {casos: c}; window.__UPD = []; window.__CB = {}; }, [{A: caso('A'), B: caso('B', {dep: 'Jurídico Prime'}), C: caso('C', {controle: '51 0034', dep: 'Registro de Imóveis'}), D: caso('D', {dep: 'Aguardando cliente (outro)', depVolta: 'Minutando', esperaMotivo: 'RG'}), E: caso('E', {dep: 'Nota de exigência', depVolta: 'Registro de Imóveis'})}]);
const stubs = {
  'firebase-app.js': 'export const initializeApp=()=>({});',
  'firebase-database.js': `const R=()=>window.__RAIZ;const get_=(p)=>p.split('/').filter(Boolean).reduce((o,k)=>o&&o[k]!==undefined?o[k]:undefined,R());
const snap=(p)=>{const v=get_(p);return {val:()=>v===undefined?null:JSON.parse(JSON.stringify(v)),exists:()=>v!==undefined,key:p.split('/').pop(),forEach:(f)=>{Object.entries(v||{}).forEach(([k,x])=>f({key:k,val:()=>x}));}}};
export const getDatabase=()=>({});export const ref=(_,p)=>({p:p||'',key:(p||'').split('/').pop()});
export const onValue=(r,cb)=>{(window.__CB[r.p]=window.__CB[r.p]||[]).push(cb);setTimeout(()=>cb(snap(r.p)),50);return ()=>{}};export const get=async(r)=>snap(r.p);
window.__emitir=(p)=>(window.__CB[p]||[]).forEach(cb=>cb(snap(p)));
export const set=async()=>{};export const update=async(r,o)=>{window.__UPD.push({p:r.p,o});};export const remove=async()=>{};export const push=(r)=>({p:r.p+'/n1',key:'n1'});export const runTransaction=async()=>{throw new Error('Transação não prevista nesta suíte de leitura da esteira.');};`,
  'firebase-auth.js': 'export const getAuth=()=>({currentUser:null});export const signInWithEmailAndPassword=async()=>{throw new Error("x")};export const sendPasswordResetEmail=async()=>{};export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(null),10);return ()=>{}};export const signOut=async()=>{};',
  'firebase-storage.js': 'export const getStorage=()=>({});export const ref=()=>({});export const uploadBytes=async()=>({});export const getDownloadURL=async()=>"";'};
await p.route('https://www.gstatic.com/firebasejs/**', (r) => { const n = r.request().url().split('/').pop(); r.fulfill({status: 200, contentType: 'text/javascript', body: stubs[n] || 'export {}'}); });
await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { if (r.request().url().includes('gstatic.com/firebasejs')) return r.fallback(); r.abort(); });
// O card clássico continua disponível como alternativa; Signature tem suíte própria.
await p.goto(srv.url + '/index.html?layout=classico'); await p.waitForTimeout(1800);
const upd = () => p.evaluate(() => window.__UPD.splice(0));
const txt = (sel) => p.$$eval(sel, (els) => els.map((e) => e.textContent.trim()));

await passo('o card novo: nome, assinatura + registro, status, trilha de 11 pílulas, abas, painel — nessa ordem', async () => {
  const ord = await p.evaluate(() => { const c = document.getElementById('card-A'); const q = (s) => { const e = c.querySelector(s); return e ? [...c.querySelectorAll('*')].indexOf(e) : -1; }; return ['.cx-topo', '.cx-linha-topo', '.est-status', '.est-trilha', '.est-abas', '.est-painel', '.cx-drive', '.card-obs', '.cx-acoes'].map(q); });
  assert(ord.every((x) => x >= 0) && ord.every((x, i) => i === 0 || x > ord[i - 1]), ord.join(','));
  assert.equal((await txt('#card-A .est-trilha .est-pil')).length, 11);
  assert.equal((await txt('#card-A .est-trilha .est-atual'))[0].replace(/^\d+/, ''), 'Minutando');
});
await passo('Etapa e Responsável não existem mais no card novo; Status continua, com a borda e o selo de sempre', async () => {
  const t = await p.$eval('#card-A', (e) => e.innerText);
  assert(!/respons[aá]vel/i.test(t)); assert((await p.$$('#card-A select')).length >= 1);
  assert(await p.$('#card-A .cx-nome-linha .badge, #card-A .cx-nome-linha [class*="st"]'), 'o selo de status sumiu');
  assert(/atencao/.test(await p.$eval('#card-A', (e) => e.className)));
  assert.equal((await p.$$('[data-filtro="shirley"], [data-filtro="grazi"], [data-filtro="gabriel"]')).length, 0, 'os filtros por pessoa saíram da barra');
});
await passo('a aba abre pela etapa (Minutando → Documentos) e as sete funções estão à mão em qualquer etapa', async () => {
  assert.deepEqual(await txt('#card-A .est-abas .est-aba'), ['Orçamento', 'Documentos', 'Certidões', 'Minuta', 'Capa do dossiê', 'Livro, folha e controle', 'Pagamento']);
  assert.equal((await txt('#card-A .est-aba.on'))[0], 'Documentos');
  assert(await p.$('#card-A .est-painel .cx-ped'), 'o painel de documentos não abriu');
});
await passo('trocar de aba mostra só aquela função, no alto, e não mexe no banco', async () => {
  await upd();
  await p.click('#card-A .est-aba:has-text("Orçamento")'); await p.waitForTimeout(100);
  assert.equal((await txt('#card-A .est-aba.on'))[0], 'Orçamento');
  assert(await p.$('#card-A .est-painel .cx-orc-rot'), 'sem o painel do orçamento'); assert(!(await p.$('#card-A .est-painel .cx-ped')));
  await p.click('#card-A .est-aba:has-text("Minuta")'); await p.waitForTimeout(100);
  assert(/Minuta/.test(await p.$eval('#card-A .est-minuta', (e) => e.innerText)) && await p.$('#card-A .est-minuta [onclick*="abrirReeditar"]'));
  await p.click('#card-A .est-aba:has-text("Capa do dossiê")'); await p.waitForTimeout(100);
  assert(/Imprimir capa/.test(await p.$eval('#card-A .est-painel', (e) => e.innerText)));
  assert.equal((await upd()).length, 0);
});
await passo('clicar numa pílula grava a etapa (o mesmo dep de sempre) e a data da mudança', async () => {
  await upd(); await p.click('#card-A .est-pil:has-text("Aprovação da minuta")'); await p.waitForTimeout(100);
  const u = await upd(); assert.equal(u.length, 1); assert.equal(u[0].p, 'casos/A'); assert.equal(u[0].o.dep, 'Aguardando aprovação da minuta'); assert(u[0].o.depDesde && u[0].o.atualizado);
});
await passo('financeiro: só aparece com o número de controle (caso C), não no A', async () => {
  assert(!(await p.$('#card-A .cx-fin'))); assert(await p.$('#card-C .cx-fin'));
});
await passo('etapa que saiu do fluxo (Jurídico Prime) pede para escolher, sem pílula marcada', async () => {
  assert(/Escolha a etapa/.test(await p.$eval('#card-B .est-aviso', (e) => e.textContent)));
  assert.equal((await p.$$('#card-B .est-trilha .est-atual')).length, 0);
});
await passo('Aguardando cliente: pede o motivo; Nota de exigência volta ao Registro ou conclui; sair da espera volta à etapa de origem', async () => {
  assert(await p.$('#card-D .est-sub input'));
  assert.equal((await txt('#card-D .est-trilha .est-atual'))[0].replace(/^\d+/, ''), 'Minutando');
  await upd(); await p.click('#card-D .est-sub .cx-btn'); await p.waitForTimeout(80);
  const u = await upd(); assert.equal(u[0].o.dep, 'Minutando');
  const bt = await txt('#card-E .est-sub .cx-btn'); assert(bt.some((x) => /Registro/.test(x)) && bt.some((x) => /Concluir/.test(x)), bt.join('|'));
});
await passo('ir para uma espera guarda de onde o caso saiu', async () => {
  await p.click('#card-A .est-esp:has-text("Falta documentos")'); await p.waitForTimeout(80);
  const u = await upd(); assert.equal(u[0].o.dep, 'Falta documentos'); assert.equal(u[0].o.depVolta, 'Minutando');
});
await passo('a primeira foto do banco nunca move caso; a seguinte, sim — uma vez só', async () => {
  assert.equal((await upd()).length, 0);
  await p.evaluate(() => { window.__RAIZ.casos.A = {...window.__RAIZ.casos.A, dep: 'Minutando'}; window.__emitir('casos'); });
  await p.waitForTimeout(100); await upd();
  await p.evaluate(() => { window.__RAIZ.casos.A = {...window.__RAIZ.casos.A, docUrl: 'https://docs.google.com/d/1'}; window.__emitir('casos'); });
  await p.waitForTimeout(150);
  const u = await upd(); assert.equal(u.length, 1, JSON.stringify(u)); assert.equal(u[0].o.dep, 'Aguardando aprovação da minuta'); assert(/minuta ficou pronta/.test(u[0].o.esteiraAviso.porque));
});
await passo('o aviso “movido sozinho” aparece com Desfazer, e desfazer volta à etapa de antes', async () => {
  await p.evaluate(() => { window.__RAIZ.casos.A = {...window.__RAIZ.casos.A, dep: 'Aguardando aprovação da minuta', esteiraAviso: {em: Date.now(), de: 'Minutando', para: 'minuta-aprov', porque: 'a minuta ficou pronta no Drive'}}; window.__emitir('casos'); });
  await p.waitForTimeout(150);
  assert(/Movido sozinho/.test(await p.$eval('#card-A .est-auto', (e) => e.textContent)));
  await upd(); await p.click('#card-A .est-desfazer'); await p.waitForTimeout(80);
  assert.equal((await upd())[0].o.dep, 'Minutando');
});
await passo('livro e folha em “Sem pendências” fazem a pergunta, e nada é movido sem a resposta dela', async () => {
  await p.evaluate(() => { window.__RAIZ.casos.A = {...window.__RAIZ.casos.A, dep: '', esteiraAviso: null, livro: '2'}; window.__emitir('casos'); });
  await p.waitForTimeout(100); await upd();
  await p.evaluate(() => { window.__RAIZ.casos.A = {...window.__RAIZ.casos.A, folha: '33'}; window.__emitir('casos'); });
  await p.waitForTimeout(150);
  assert.equal((await upd()).length, 0); assert(/Falta alguém assinar/.test(await p.$eval('#card-A .est-pergunta', (e) => e.textContent)));
  await p.click('#card-A .est-pergunta .cx-btn.destaque'); await p.waitForTimeout(80);
  assert.equal((await upd())[0].o.dep, 'Falta assinatura');
});
await passo('“Usar o card antigo” devolve o desenho de antes, com Etapa e Responsável; e volta', async () => {
  await p.click('#cx-modo-card'); await p.waitForTimeout(150);
  const t = await p.$eval('#card-A', (e) => e.innerText); assert(/respons[aá]vel/i.test(t) && /etapa/i.test(t)); assert(!(await p.$('#card-A .est-trilha')));
  assert(await p.$('#card-A .cx-orc.cx-ped')); assert(await p.$('#card-A [onclick*="abrirMinuta"]'));
  assert(/novo/.test(await p.$eval('#cx-modo-card', (e) => e.textContent)));
  await p.click('#cx-modo-card'); await p.waitForTimeout(150); assert(await p.$('#card-A .est-trilha'));
});
await passo('no celular a trilha quebra em linhas e nada estoura para o lado', async () => {
  await p.setViewportSize({width: 390, height: 900}); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
});
await nav.close(); srv.close();
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
