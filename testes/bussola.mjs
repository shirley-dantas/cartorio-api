// O Bússola (planner pessoal da Shirley, pasta bussola/) no navegador.
//
// Roda com: node testes/bussola.mjs
//
// O banco do painel é fingido aqui dentro (casos, lembretes /focos e o
// Financeiro), e a entrada no Firebase também — o teste nunca toca no banco
// de verdade. Termina com as fotos em testes/saida/bussola-*.png, num tablet
// e num iPhone 13.
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {servir} from './servidor.mjs';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {gerar, DESTINO} from '../scripts/gerar-bussola-fin.mjs';

const SAIDA = (n) => join(dirname(fileURLToPath(import.meta.url)), 'saida', n);
const erros = [];
const passo = async (n, f) => { try { await f(); console.log('  ok  ' + n); } catch (e) { erros.push(n + ' → ' + e.message); console.log('FALHA ' + n + ' → ' + e.message); } };
const igual = (a, b, o) => { if (a !== b) throw new Error(`${o}: esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };

await passo('a conta do salário é a mesma que está no index.html do painel', async () => {
  if (readFileSync(DESTINO, 'utf8') !== gerar()) throw new Error('bussola/fin-motor.js ficou para trás: rode node scripts/gerar-bussola-fin.mjs');
});

// O plano da Vercel aceita no máximo 12 funções em api/. Uma 13ª (a primeira
// ler-letra.js) fez a Vercel recusar a publicação do painel inteiro em
// 22/09/2026 — e nada avisou: o painel só ficou parado na versão anterior.
await passo('o painel continua com no máximo 12 funções (limite da Vercel)', async () => {
  const {readdirSync} = await import('node:fs');
  const funcoes = readdirSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'api')).filter(f => /\.(js|mjs|ts)$/.test(f));
  if (funcoes.length > 12) throw new Error(funcoes.length + ' funções em api/ — a Vercel recusa a publicação acima de 12');
});

// A leitura da letra (lib/ler-letra.js, pela porta da Joaninha) só abre para
// o Bússola: cada leitura custa, e porta aberta a qualquer site é conta aberta.
{
  const {createRequire} = await import('node:module');
  const joaninha = createRequire(import.meta.url)('../api/perguntar-joaninha.js');
  const chamar = async (origin, method, body) => {
    const r = { code: 0, headers: {}, corpo: null };
    const res = { setHeader: (k, v) => { r.headers[k] = v; }, status(c) { r.code = c; return this; }, json(j) { r.corpo = j; return this; }, end() { return this; }, send() { return this; } };
    await joaninha({ headers: { origin }, method, body, url: '/api/perguntar-joaninha?acao=ler-letra', query: { acao: 'ler-letra' } }, res);
    return r;
  };
  await passo('a leitura da letra recusa quem não é o Bússola', async () => {
    igual((await chamar('https://outro-site.com', 'POST', { imagem: 'x' })).code, 403, 'origem estranha');
    igual((await chamar('https://bussola-mu.vercel.app', 'OPTIONS')).code, 200, 'o Bússola passa');
    const conferir = await chamar(undefined, 'GET');
    igual(conferir.code, 200, 'aberta no navegador');
    igual(conferir.corpo.funcao, 'ler-letra', 'a conferência se identifica');
    if (JSON.stringify(conferir.corpo).includes('sk-')) throw new Error('a conferência mostrou a chave');
    const chaveAntes = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const semChave = await chamar('https://bussola-mu.vercel.app', 'POST', { imagem: 'x' });
    igual(semChave.code, 500, 'sem a chave da IA');
    if (!/chave da IA/.test(semChave.corpo.erro)) throw new Error('sem chave, a mensagem não disse');
    process.env.ANTHROPIC_API_KEY = 'teste';
    igual((await chamar('https://bussola-mu.vercel.app', 'POST', {})).code, 400, 'sem imagem');
    igual((await chamar('https://bussola-mu.vercel.app', 'POST', { imagem: 'a'.repeat(3 * 1024 * 1024) })).code, 413, 'imagem grande demais');
    if (chaveAntes === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = chaveAntes;
  });
}

// A ação de convite do Apps Script, rodada com o Google fingido: o convite
// leva os e-mails válidos, manda o aviso, e sem hora vira dia inteiro.
await passo('o Apps Script cria o evento com os convidados e manda o convite', async () => {
  const vm = await import('node:vm');
  const codigo = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'apps-script', 'bussola-agenda.js'), 'utf8');
  const criados = [];
  const cal = {
    createEvent: (t, i, f, o) => { criados.push({ t, i, f, o, dia: false }); return { getId: () => 'ev-' + criados.length }; },
    createAllDayEvent: (t, d, o) => { criados.push({ t, d, o, dia: true }); return { getId: () => 'ev-' + criados.length }; }
  };
  const ctx = { CalendarApp: { getDefaultCalendar: () => cal },
    ContentService: { createTextOutput: (t) => ({ setMimeType: () => t }), MimeType: { JSON: 'json' } },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'dantasshy@gmail.com' }) }, console };
  vm.runInNewContext(codigo, ctx);
  const chamar = (d) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ acao: 'convidar-evento-calendar', ...d }) } }));
  const r1 = chamar({ titulo: 'Almoço', data: '2026-10-02', hora: '12:30', convidados: ['ana@x.com', 'isso não', 'joao@y.com.br'] });
  igual(r1.ok, true, 'criou'); igual(criados[0].o.guests, 'ana@x.com,joao@y.com.br', 'convidados'); igual(criados[0].o.sendInvites, true, 'manda o convite');
  igual(criados[0].f - criados[0].i, 3600000, 'uma hora');
  igual(criados[0].i.toISOString(), '2026-10-02T15:30:00.000Z', '12h30 de São Paulo, seja qual for o fuso do projeto');
  igual(JSON.parse(ctx.doGet()).conta, 'dantasshy@gmail.com', 'a conferência diz de qual conta é a agenda');
  const r2 = chamar({ titulo: 'Aniversário', data: '2026-10-05', convidados: ['ana@x.com'] });
  igual(r2.ok, true, 'dia inteiro'); igual(criados[1].dia, true, 'sem hora vira dia inteiro');
  igual(chamar({ titulo: 'x', data: '2026-10-05', convidados: ['nada'] }).ok, false, 'sem e-mail válido não cria');
});

const p2 = (n) => String(n).padStart(2, '0');
const dia = (o) => { const x = new Date(); x.setDate(x.getDate() + o); return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`; };
const HOJE = dia(0);

// O cofre do Meu financeiro é montado pelo finCriarCofre() do próprio painel,
// recortado do index.html: o Bússola tem de abrir exatamente o que o painel grava.
async function cofreDoPainel(senha, lancamentos) {
  const vm = await import('node:vm');
  const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');
  const entre = (a, b) => { const i = html.indexOf(a); return html.slice(i, html.indexOf(b, i)); };
  const codigo = entre('const FIN_PBKDF2_VOLTAS=', 'let finCofreBruto=null;') + entre('function finB64(buf){', 'async function finDestrancar(') +
    `let finChaveMestra=null, finMestraB64=null, finDadosPessoais=null, finCodigoNovo=null, gravado=null;
     const finPessoalRef=null; const set=async(r,v)=>{gravado=v;};
     (async()=>{ await finCriarCofre(SENHA); gravado.dados = await finCifrar(finChaveMestra, {lancamentos: LANC}); FIM(gravado); })();`;
  return new Promise(ok => vm.runInNewContext(codigo, { crypto: globalThis.crypto, TextEncoder, TextDecoder, btoa, atob, Uint8Array,
    SENHA: senha, LANC: lancamentos, FIM: ok }));
}

// ── O banco fingido ──
const banco = {
  casos: { a: { id: 'a', nome: 'TANIA — compra e venda', agendado: HOJE + 'T10:30' } },
  resolucoesCentral: {},
  focos: [{ id: 'f1', text: 'Ligar para o RI', done: false, resp: 'grazi' }],
  financeiro: {
    lancamentos: {
      l1: { status: 'pago', dataPagamento: HOJE, parteTabeliao: '3.427,23', arranjoId: 'direto', descricao: 'TANIA' },
      l2: { status: 'pendente', vencimento: HOJE, parteTabeliao: 1000, arranjoId: 'direto' }
    },
    config: null,
    pessoal: null
  }
};
banco.financeiro.pessoal = await cofreDoPainel('cofre-da-shirley', [
  { id: 'mp1', tipo: 'extra', valor: 3858.07, data: HOJE, descricao: 'wagner fernandes' },
  { id: 'mp2', tipo: 'salario', valor: 100, data: HOJE, descricao: 'ajuste' },
  { id: 'mp3', tipo: 'extra', valor: 999, data: '2020-01-10', descricao: 'de outro fechamento' },
  { id: 'mp4', tipo: 'despesa', valor: 50, data: HOJE, descricao: 'despesa de lá' }
]);
let escritas = 0, recusarFocos = false;
const leituras = [];
const pedidosGoogle = [];
let respostaConvite = { ok: false, erro: 'Ação desconhecida' };
let proximaLeitura = { ok: true, texto: 'leite condensado' };
function caminho(url) { return decodeURIComponent(new URL(url).pathname).replace(/^\//, '').replace(/\.json$/, '').split('/').filter(Boolean); }
function ler(partes) { return partes.reduce((o, k) => (o == null ? undefined : o[k]), banco); }
function gravar(partes, valor) {
  let o = banco;
  partes.slice(0, -1).forEach(k => { if (o[k] == null) o[k] = {}; o = o[k]; });
  const k = partes[partes.length - 1];
  if (valor === undefined) { if (Array.isArray(o)) o[k] = null; else delete o[k]; } else o[k] = valor;
}

const servidor = await servir(8197);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function abrir(opts) {
  // O service worker do Bússola repassaria os pedidos por fora do banco
  // fingido (o Playwright não intercepta o que sai de um service worker).
  const ctx = await b.newContext({ ...opts, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => erros.push('pageerror: ' + e.message));
  pg.on('dialog', async d => {
    const m = d.message();
    if (m.startsWith('Quanto foi')) await d.accept('180,00');
    else if (m.includes('rosto')) await d.dismiss();
    else await d.accept();
  });
  await pg.route('**/*firebaseio.com/**', async r => {
    const req = r.request(), partes = caminho(req.url());
    const cors = { 'access-control-allow-origin': '*' };
    if (partes[0] === 'financeiro' && !/auth=token-ok/.test(req.url())) return r.fulfill({ status: 401, json: { error: 'Permission denied' }, headers: cors });
    if (partes[0] === 'focos' && recusarFocos && req.method() !== 'GET') return r.fulfill({ status: 401, json: { error: 'Permission denied' }, headers: cors });
    if (req.method() === 'GET') return r.fulfill({ json: ler(partes) ?? null, headers: cors });
    escritas++;
    if (req.method() === 'PUT') gravar(partes, JSON.parse(req.postData()));
    else if (req.method() === 'PATCH') Object.assign(ler(partes), JSON.parse(req.postData()));
    else if (req.method() === 'DELETE') gravar(partes, undefined);
    return r.fulfill({ json: null, headers: cors });
  });
  await pg.route('**/identitytoolkit.googleapis.com/**', r => {
    const corpo = JSON.parse(r.request().postData());
    if (corpo.password !== 'senha-certa') return r.fulfill({ status: 400, json: { error: { message: 'INVALID_LOGIN_CREDENTIALS' } }, headers: { 'access-control-allow-origin': '*' } });
    return r.fulfill({ json: { email: corpo.email, idToken: 'token-ok', refreshToken: 'renova', expiresIn: '3600' }, headers: { 'access-control-allow-origin': '*' } });
  });
  await pg.route('**/script.google.com/**', async r => {
    const corpo = JSON.parse(r.request().postData() || '{}');
    if (r.request().method() !== 'GET') pedidosGoogle.push(corpo);
    if (r.request().method() === 'GET') return r.fulfill({ body: JSON.stringify({ ok: true, funcao: 'agenda-bussola', conta: 'dantasshy@gmail.com' }), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
    const resposta = corpo.acao === 'convidar-evento-calendar' ? respostaConvite : { ok: true };
    return r.fulfill({ body: JSON.stringify(resposta), headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json' });
  });
  await pg.route(u => u.href.includes('/api/perguntar-joaninha') && u.href.includes('acao=ler-letra'), async r => {
    const req = r.request();
    const cors = { 'access-control-allow-origin': req.headers().origin || '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { ...cors, 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'POST' } });
    leituras.push(JSON.parse(req.postData()).imagem);
    if (proximaLeitura === '__sem_resposta__') return r.abort('failed');
    if (proximaLeitura === '__erro_404__') return r.fulfill({ status: 404, body: 'The page could not be found', headers: cors });
    return r.fulfill({ json: proximaLeitura, headers: cors });
  });
  // Sem internet, as fontes do Google não chegam e as fotos saem na letra de
  // reserva. BUSSOLA_FONTES aponta para um CSS local com as mesmas fontes,
  // quando se quer a foto fiel (a cursiva, principalmente).
  const fontes = process.env.BUSSOLA_FONTES ? readFileSync(process.env.BUSSOLA_FONTES, 'utf8') : null;
  await pg.route('**/fonts.g*/**', r => fontes && r.request().url().includes('/css2')
    ? r.fulfill({ body: fontes, contentType: 'text/css' }) : r.abort());
  await pg.goto('http://127.0.0.1:8197/bussola/index.html');
  await pg.waitForSelector('#painelSyncTxt');
  await pg.waitForFunction(() => /conferido/.test(document.getElementById('painelSyncTxt').textContent));
  return pg;
}
const guardado = (pg) => pg.evaluate(() => localStorage.getItem('bussola-planner-v1'));
const estado = async (pg) => JSON.parse(await guardado(pg));
async function escreverComCaneta(pg, seletorCampo) {
  await pg.click(`${seletorCampo} + .caneta-btn`);
  await pg.waitForSelector('.caneta-fundo:not([hidden])');
  const r = await (await pg.$('#canetaCanvas')).boundingBox();
  await pg.mouse.move(r.x + 30, r.y + 50); await pg.mouse.down();
  for (let i = 0; i < 14; i++) await pg.mouse.move(r.x + 30 + i * 18, r.y + 50 + (i % 4) * 10);
  await pg.mouse.up();
  await pg.click('#canetaPronto');
}
const aba = async (pg, v) => { await pg.click(`.view-switch button[data-view="${v}"]`); await pg.waitForTimeout(250); };

const pg = await abrir({ viewport: { width: 1024, height: 1366 } });

await passo('a Linha do tempo agora se chama Agenda, e a assinatura do painel está nela', async () => {
  const h = await pg.textContent('#view-dia .day-left .panel:nth-child(2) h2');
  if (!h.startsWith('Agenda')) throw new Error('título: ' + h);
  if (!(await pg.textContent('#timeline')).includes('TANIA')) throw new Error('a assinatura não veio');
});

await passo('os Hábitos saíram e o Diário ocupou o lugar, trancado desde a primeira vez', async () => {
  if (await pg.$('#habitList')) throw new Error('os hábitos continuam na tela');
  if (!(await pg.textContent('#diarioPainel')).includes('Criar meu diário')) throw new Error('não oferece criar o diário');
});

// ── Tarefa profissional vai ao painel ──
await passo('tarefa profissional vira lembrete no Bloco de Notas do painel, na aba Shirley', async () => {
  await pg.click('#quickCat [data-cat="profissional"]');
  await pg.fill('#quickInput', 'Conferir minuta do Gustavo');
  await pg.press('#quickInput', 'Enter');
  await pg.waitForFunction(() => /no painel/.test(document.getElementById('taskList').textContent));
  const f = banco.focos.find(x => x && x.text === 'Conferir minuta do Gustavo');
  if (!f) throw new Error('não chegou ao /focos');
  igual(f.resp, 'shirley', 'responsável'); igual(f.origem, 'bussola', 'origem'); igual(f.done, false, 'done');
  igual(banco.focos[0].text, 'Ligar para o RI', 'o lembrete que já estava lá continua intacto');
});
await passo('tarefa pessoal não vai para o painel', async () => {
  await pg.click('#quickCat [data-cat="pessoal"]');
  await pg.fill('#quickInput', 'Comprar presente da mãe');
  await pg.press('#quickInput', 'Enter');
  await pg.waitForTimeout(300);
  if (banco.focos.some(x => x && /presente/.test(x.text))) throw new Error('a pessoal vazou para o painel');
});
await passo('concluir no Bússola conclui no painel', async () => {
  const id = (await estado(pg)).tasks.find(t => t.painel).id;
  await pg.click(`[data-role="toggle-task"][data-id="${id}"]`);
  await pg.waitForFunction(() => true);
  await pg.waitForTimeout(400);
  igual(banco.focos.find(x => x && x.origem === 'bussola').done, true, 'done no painel');
});
await passo('concluir (ou reabrir) no painel vale no Bússola na próxima conferência', async () => {
  banco.focos.find(x => x && x.origem === 'bussola').done = false;
  await pg.click('#painelSyncBtn');
  await pg.waitForTimeout(500);
  const t = (await estado(pg)).tasks.find(t => t.painel);
  igual(t.done, false, 'a tarefa reabriu no Bússola');
});
await passo('se o painel recusar, a tarefa diz que não chegou — e chega na conferência seguinte', async () => {
  recusarFocos = true;
  await pg.click('#quickCat [data-cat="profissional"]');
  await pg.fill('#quickInput', 'Pedir certidão');
  await pg.press('#quickInput', 'Enter');
  await pg.waitForFunction(() => /ainda não chegou ao painel/.test(document.getElementById('taskList').textContent));
  recusarFocos = false;
  await pg.click('#painelSyncBtn');
  await pg.waitForFunction(() => !/ainda não chegou/.test(document.getElementById('taskList').textContent));
  if (!banco.focos.some(x => x && x.text === 'Pedir certidão')) throw new Error('não subiu depois');
});

// ── Página livre → bloco ──
await passo('o que se escreve na página livre vira cartão no bloco ao lado', async () => {
  const c = await pg.$('#pageSketchCanvas'); const r = await c.boundingBox();
  await pg.mouse.move(r.x + 40, r.y + 60); await pg.mouse.down();
  for (let i = 0; i < 12; i++) await pg.mouse.move(r.x + 40 + i * 15, r.y + 60 + (i % 3) * 12);
  await pg.mouse.up();
  proximaLeitura = { ok: true, texto: 'Ligar para o dentista' };
  await pg.click('#pageToBloco');
  await pg.waitForFunction(() => /Ligar para o dentista/.test(document.getElementById('notesGrid').textContent));
  const st = await estado(pg);
  const n = st.notes.find(n => n.text === 'Ligar para o dentista');
  igual(n.aMao, true, 'a nota lida da página nasce em cursiva');
  igual(n.date, HOJE, 'data da nota');
  igual((st.pages[HOJE] || { strokes: [] }).strokes.length, 0, 'a página ficou limpa');
  if (!await pg.$('#notesGrid .cursiva')) throw new Error('o cartão não está em cursiva');
});
await passo('desenho que a IA não lê vira cartão de desenho, sem se perder', async () => {
  const c = await pg.$('#pageSketchCanvas'); const r = await c.boundingBox();
  await pg.mouse.move(r.x + 80, r.y + 80); await pg.mouse.down();
  for (let i = 0; i < 10; i++) await pg.mouse.move(r.x + 80 + i * 12, r.y + 80 + (i % 2) * 30);
  await pg.mouse.up();
  proximaLeitura = { ok: true, texto: '', ilegivel: true };
  await pg.click('#pageToBloco');
  await pg.waitForSelector('#notesGrid [data-role="sketch-thumb"]');
  if (!/guardei como desenho/.test(await pg.textContent('#pageMsg'))) throw new Error('não avisou');
  proximaLeitura = '__sem_resposta__';
  await pg.mouse.move(r.x + 60, r.y + 60); await pg.mouse.down(); await pg.mouse.move(r.x + 160, r.y + 90); await pg.mouse.up();
  await pg.click('#pageToBloco');
  await pg.waitForFunction(() => document.querySelectorAll('#notesGrid [data-role="sketch-thumb"]').length === 2);
  proximaLeitura = { ok: true, texto: 'leite condensado' };
});
await passo('"→ amanhã" leva a nota para o dia seguinte', async () => {
  await pg.fill('#noteInput', 'Ligar para a escola');
  await pg.press('#noteInput', 'Enter');
  const id = (await estado(pg)).notes.find(n => n.text === 'Ligar para a escola').id;
  await pg.click(`[data-role="note-amanha"][data-id="${id}"]`);
  if ((await pg.textContent('#notesGrid')).includes('Ligar para a escola')) throw new Error('continuou hoje');
  await pg.click('#dayNext');
  if (!(await pg.textContent('#notesGrid')).includes('Ligar para a escola')) throw new Error('não apareceu amanhã');
  await pg.click('#dayPrev');
});

// ── Diário ──
const SEGREDO = 'Sonhei com a casa de Ubatuba e a varanda azul';
let codigo = '';
await passo('criar o diário mostra o código de recuperação uma vez', async () => {
  await pg.click('[data-role="diario-comecar"]');
  await pg.fill('#diarioPainel [name="s1"]', 'curta');
  await pg.fill('#diarioPainel [name="s2"]', 'curta');
  await pg.click('#diarioPainel button[type="submit"]');
  if (!(await pg.textContent('#diarioPainel')).includes('pelo menos 6')) throw new Error('aceitou senha curta');
  await pg.fill('#diarioPainel [name="s1"]', 'jardim2026');
  await pg.fill('#diarioPainel [name="s2"]', 'jardim2026');
  await pg.click('#diarioPainel button[type="submit"]');
  await pg.waitForSelector('#diarioPainel .diario-codigo', { timeout: 15000 });
  codigo = (await pg.textContent('#diarioPainel .diario-codigo')).trim();
  if (!/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(codigo)) throw new Error('código estranho: ' + codigo);
  await pg.click('[data-role="diario-guardei"]');
});
await passo('escrever no diário guarda o texto cifrado — nada legível no armazenamento', async () => {
  await pg.click('[data-role="diario-tipo"][data-id="sonho"]');
  await pg.fill('#diarioPainel textarea', SEGREDO);
  await pg.click('#diarioPainel button[type="submit"]');
  await pg.waitForFunction(s => document.getElementById('diarioPainel').textContent.includes(s), SEGREDO);
  if ((await guardado(pg)).includes('Ubatuba')) throw new Error('o texto foi guardado às claras');
  if (!(await pg.textContent('#diarioPainel')).includes('🌙 Sonho')) throw new Error('o tipo não apareceu');
});
await passo('trancado, o diário fica opaco e o texto nem está na página', async () => {
  await pg.click('#diarioPainel [data-role="diario-travar"]');
  if ((await pg.content()).includes('Ubatuba')) throw new Error('o texto continua na página');
  if (!await pg.$('#diarioPainel .diario-borrao')) throw new Error('sem o véu');
});
await passo('senha errada não abre; a certa abre', async () => {
  await pg.fill('#diarioPainel [name="s"]', 'errada123');
  await pg.click('#diarioPainel form button[type="submit"]');
  await pg.waitForFunction(() => /não confere/.test(document.getElementById('diarioPainel').textContent), null, { timeout: 15000 });
  await pg.fill('#diarioPainel [name="s"]', 'jardim2026');
  await pg.click('#diarioPainel form button[type="submit"]');
  await pg.waitForFunction(s => document.getElementById('diarioPainel').textContent.includes(s), SEGREDO, { timeout: 15000 });
});
await passo('sair do app tranca o diário sozinho', async () => {
  await pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
  if ((await pg.content()).includes('Ubatuba')) throw new Error('continuou aberto');
});
await passo('esqueci a senha: o código abre e troca a senha', async () => {
  await pg.click('#diarioPainel [data-role="diario-esqueci"]');
  await pg.fill('#diarioPainel [name="c"]', codigo.toLowerCase());
  await pg.fill('#diarioPainel [name="s1"]', 'novasenha1');
  await pg.click('#diarioPainel form button[type="submit"]');
  await pg.waitForFunction(s => document.getElementById('diarioPainel').textContent.includes(s), SEGREDO, { timeout: 20000 });
  await pg.click('#diarioPainel [data-role="diario-travar"]');
  await pg.fill('#diarioPainel [name="s"]', 'novasenha1');
  await pg.click('#diarioPainel form button[type="submit"]');
  await pg.waitForFunction(s => document.getElementById('diarioPainel').textContent.includes(s), SEGREDO, { timeout: 15000 });
});
await passo('na aba Diário, o mês marca o dia escrito e a busca acha sem acento', async () => {
  await aba(pg, 'diario');
  if (!await pg.$(`#diarioAba .month-cell.tem-diario[data-id="${HOJE}"]`)) throw new Error('o dia não está marcado');
  await pg.fill('#diarioBusca', 'VARANDA');
  const r = await pg.textContent('#diarioResultado');
  if (!r.includes('1 resultado')) throw new Error('busca: ' + r.slice(0, 80));
  if (!await pg.$('#diarioResultado mark')) throw new Error('sem destaque');
  await pg.fill('#diarioBusca', 'ubatúba');
  if (!(await pg.textContent('#diarioResultado')).includes('1 resultado')) throw new Error('não ignorou o acento');
  await pg.fill('#diarioBusca', '');
  await pg.screenshot({ path: SAIDA('bussola-diario.png') });
});

// ── Finanças e contas ──
await passo('conta que vence hoje (e a atrasada) vira tarefa do dia, sem bronca', async () => {
  await aba(pg, 'financas');
  await pg.click('[data-role="contas-abrir"]');
  await pg.fill('#contaNome', 'IPTU'); await pg.fill('#contaValor', '350,00');
  await pg.fill('#contaVenc', dia(-28)); await pg.selectOption('#contaRepete', 'mes');
  await pg.click('#contaForm button[type="submit"]');
  await pg.fill('#contaNome', 'Faxina (Maria)'); await pg.fill('#contaVenc', HOJE); await pg.selectOption('#contaRepete', 'semana');
  await pg.click('#contaForm button[type="submit"]');
  await pg.fill('#contaNome', 'Gás'); await pg.fill('#contaValor', '120,00'); await pg.fill('#contaVenc', dia(2)); await pg.selectOption('#contaRepete', 'mes');
  await pg.click('#contaForm button[type="submit"]');
  await pg.click('[data-role="contas-fechar"]');
  await aba(pg, 'dia');
  const t = await pg.textContent('#taskList');
  if (!t.includes('IPTU') || !t.includes('venceu há 28 dias')) throw new Error(t);
  if (!t.includes('Faxina') || !t.includes('vence hoje')) throw new Error(t);
  if (t.includes('Gás')) throw new Error('o gás de daqui a dois dias já entrou nas tarefas de hoje');
  const b = await pg.textContent('#contasBanner');
  if (!b.includes('Gás') || !b.includes('vence em 2 dias')) throw new Error('o aviso dos próximos dias: ' + b);
  if (b.includes('IPTU') || b.includes('Faxina')) throw new Error('as de hoje continuaram no aviso também');
  if ((await pg.textContent('#timeline')).includes('Faxina')) throw new Error('a conta continuou na Agenda');
  await pg.click('#taskFilter [data-f="profissional"]');
  if ((await pg.textContent('#taskList')).includes('IPTU')) throw new Error('conta apareceu no filtro Profissional');
  await pg.click('#taskFilter [data-f="todas"]');
  // No dia do vencimento do gás, ele aparece nas tarefas daquele dia.
  await pg.click('#dayNext'); await pg.click('#dayNext');
  if (!(await pg.textContent('#taskList')).includes('Gás')) throw new Error('o gás não entrou nas tarefas do dia dele');
  await pg.click('#dayPrev'); await pg.click('#dayPrev');
  await pg.evaluate(() => window.scrollTo(0, 0));
  await pg.screenshot({ path: SAIDA('bussola-contas-tarefas.png'), clip: { x: 0, y: 0, width: 1024, height: 900 } });
});
await passo('marcar a conta nas tarefas é o "Paguei": lança na planilha e empurra o vencimento', async () => {
  const st = await estado(pg);
  const iptu = st.contas.find(c => c.nome === 'IPTU'), fax = st.contas.find(c => c.nome.startsWith('Faxina'));
  await pg.click(`#taskList [data-role="conta-paguei"][data-id="${iptu.id}"]`);
  await pg.click(`#taskList [data-role="conta-paguei"][data-id="${fax.id}"]`);
  const st2 = await estado(pg);
  const i2 = st2.contas.find(c => c.id === iptu.id), f2 = st2.contas.find(c => c.id === fax.id);
  const esperadoIptu = (() => { const d = new Date(dia(-28) + 'T12:00'); const alvo = new Date(d.getFullYear(), d.getMonth() + 1, 1); const ult = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate(); return `${alvo.getFullYear()}-${p2(alvo.getMonth() + 1)}-${p2(Math.min(d.getDate(), ult))}`; })();
  igual(i2.venc, esperadoIptu, 'próximo IPTU');
  igual(f2.venc, dia(7), 'próxima faxina');
  const lanc = st2.financas.lancamentos;
  igual(lanc.find(l => l.descricao === 'IPTU').valor, 350, 'IPTU na planilha');
  igual(lanc.find(l => l.descricao.startsWith('Faxina')).valor, 180, 'faxina (valor perguntado) na planilha');
});
await passo('a planilha soma o mês e mostra para onde foi', async () => {
  await aba(pg, 'financas');
  await pg.fill('#finDesc', 'Mercado do mês'); await pg.fill('#finValor', '1.234,56');
  await pg.selectOption('#finCat', 'Mercado');
  await pg.click('#finAddForm button[type="submit"]');
  const r = (await pg.textContent('#finResumo')).replace(/\s/g, ' ');
  if (!r.includes('1.764,56')) throw new Error('saídas: ' + r);
  if (!r.includes('sem o salário')) throw new Error('não avisou que falta o salário');
  if (!(await pg.textContent('#finGraficoGastos')).includes('Mercado')) throw new Error('sem as categorias');
});
await passo('senha errada do Financeiro diz o que houve', async () => {
  await pg.fill('#finEmail', 'cartorio@shirleydantas.com'); await pg.fill('#finSenha', 'errada');
  await pg.click('#finLoginForm button[type="submit"]');
  await pg.waitForFunction(() => /não conferem/.test(document.getElementById('finPlanilha').textContent));
});
await passo('entrando no Financeiro, o salário vem do painel pela mesma conta dele', async () => {
  await pg.fill('#finEmail', 'cartorio@shirleydantas.com'); await pg.fill('#finSenha', 'senha-certa');
  await pg.click('#finLoginForm button[type="submit"]');
  await pg.waitForFunction(() => /R\$\s?428,40/.test(document.getElementById('finPlanilha').textContent));
  const t = await pg.textContent('#finPlanilha');
  if (!/1 escritura paga/.test(t)) throw new Error('contou escrituras erradas: ' + t.slice(0, 160));
  const r = (await pg.textContent('#finResumo')).replace(/\s/g, ' ');
  if (r.includes('sem o salário')) throw new Error('o aviso ficou');
  if ((await guardado(pg)).includes('3.427')) throw new Error('lançamentos do Financeiro foram parar no armazenamento');
  if (!(await pg.evaluate(() => localStorage.getItem('bussola-fin-sessao'))).includes('renova')) throw new Error('não lembrou a entrada');
  if ((await pg.evaluate(() => localStorage.getItem('bussola-fin-sessao'))).includes('senha')) throw new Error('guardou a senha');
});
await passo('os serviços extras do Meu financeiro pedem a senha de lá, e entram no mês', async () => {
  if (!await pg.$('#finCofreForm')) throw new Error('não pediu a senha do Meu financeiro');
  if (!(await pg.textContent('#finResumo')).includes('sem os serviços extras')) throw new Error('não avisou que faltam os extras');
  await pg.fill('#finCofreSenha', 'errada');
  await pg.click('#finCofreForm button[type="submit"]');
  await pg.waitForFunction(() => /não confere/.test(document.getElementById('finPlanilha').textContent), null, { timeout: 20000 });
  await pg.fill('#finCofreSenha', 'cofre-da-shirley');
  await pg.click('#finCofreForm button[type="submit"]');
  await pg.waitForFunction(() => /Serviços extras[\s\S]*3\.858,07/.test(document.getElementById('finPlanilha').textContent), null, { timeout: 20000 });
  const t = (await pg.textContent('#finPlanilha')).replace(/\s/g, ' ');
  if (t.includes('wagner')) throw new Error('trouxe a descrição do extra — ela pediu só o valor');
  if (!t.includes('528,40')) throw new Error('o salário lançado à mão no Meu financeiro não somou: ' + t.slice(0, 200));
  if (t.includes('de outro fechamento')) throw new Error('entrou extra de outro fechamento');
  if (t.includes('despesa de lá')) throw new Error('a despesa do Meu financeiro não devia entrar');
  const r = (await pg.textContent('#finResumo')).replace(/\s/g, ' ');
  if (!r.includes('4.386,47')) throw new Error('entrou: ' + r);
  if ((await guardado(pg)).includes('wagner')) throw new Error('o extra foi parar no armazenamento do Bússola');
  await pg.screenshot({ path: SAIDA('bussola-financas.png') });
});
await passo('ao sair do app, o cofre tranca — mas volta sozinho, sem pedir a senha de novo neste aparelho', async () => {
  await pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
  if ((await pg.textContent('#finPlanilha')).includes('3.858,07')) throw new Error('continuou aberto em memória');
  if (!await pg.$('#finCofreForm')) throw new Error('não trancou de novo');
  // Ela já digitou a senha uma vez neste aparelho (passo anterior): reabrir a
  // aba destranca sozinho, com a chave guardada — sem pedir a senha de novo.
  await pg.click('.view-switch [data-view="financas"]');
  await pg.waitForFunction(() => /Serviços extras[\s\S]*3\.858,07/.test(document.getElementById('finPlanilha').textContent), null, { timeout: 20000 });
  if (await pg.$('#finCofreForm')) throw new Error('pediu a senha de novo, mesmo já tendo sido digitada neste aparelho');
});
await passo('sair da conta esquece a chave guardada dos extras', async () => {
  await pg.click('[data-role="fin-sair"]');
  await pg.waitForSelector('#finLoginForm');
  if (await pg.evaluate(() => localStorage.getItem('bussola-fin-cofre-chave'))) throw new Error('a chave dos extras continuou guardada depois de sair');
});

// ── Escrita à mão e Mercado ──
await passo('todo campo de escrever tem o ✍️ ao lado', async () => {
  for (const sel of ['#quickInput', '#apptTitle', '#noteInput', '#mercadoInput', '#finDesc', '#contaNome']) {
    if (!await pg.$(`${sel} + .caneta-btn`)) throw new Error('sem caneta em ' + sel);
  }
});
await aba(pg, 'dia');
await passo('escrito à mão no Mercado vira texto e aparece em cursiva', async () => {
  await pg.fill('#mercadoInput', 'Café'); await pg.press('#mercadoInput', 'Enter');
  await escreverComCaneta(pg, '#mercadoInput');
  await pg.waitForFunction(() => document.getElementById('mercadoInput').value === 'leite condensado');
  if (!leituras.length || !leituras[0].startsWith('data:image/png;base64,')) throw new Error('não mandou a imagem da escrita');
  await pg.press('#mercadoInput', 'Enter');
  const itens = await pg.$$eval('#mercadoLista .mercado-nome', els => els.map(e => [e.textContent, e.classList.contains('cursiva')]));
  igual(JSON.stringify(itens), JSON.stringify([['Café', false], ['leite condensado', true]]), 'lista');
});
await passo('peguei risca, "tirar os já pegos" limpa, e o que acabou volta como atalho', async () => {
  const id = (await estado(pg)).mercado.itens.find(i => i.nome === 'Café').id;
  await pg.click(`[data-role="mercado-pegar"][data-id="${id}"]`);
  if (!await pg.$('#mercadoLista .mercado-item.pego')) throw new Error('não riscou');
  await pg.click('[data-role="mercado-limpar"]');
  if ((await pg.textContent('#mercadoLista')).includes('Café')) throw new Error('não limpou');
  await pg.click('[data-role="mercado-de-novo"][data-id="cafe"]');
  if (!(await pg.textContent('#mercadoLista')).includes('Café')) throw new Error('o atalho não devolveu o café');
  await pg.fill('#mercadoInput', 'cafe'); await pg.press('#mercadoInput', 'Enter');
  igual((await estado(pg)).mercado.itens.filter(i => /caf/i.test(i.nome)).length, 1, 'café repetido na lista');
});
await passo('tarefa escrita à mão fica em cursiva; a digitada, não', async () => {
  proximaLeitura = { ok: true, texto: 'Buscar vestido na costureira' };
  await pg.click('#quickCat [data-cat="pessoal"]');
  await escreverComCaneta(pg, '#quickInput');
  await pg.waitForFunction(() => document.getElementById('quickInput').value === 'Buscar vestido na costureira');
  const fonte = await pg.$eval('#quickInput', el => getComputedStyle(el).fontFamily);
  if (!/Dancing Script/.test(fonte)) throw new Error('no campo, a letra que voltou não está em cursiva: ' + fonte);
  await pg.press('#quickInput', 'Enter');
  const depois = await pg.$eval('#quickInput', el => getComputedStyle(el).fontFamily);
  if (/Dancing Script/.test(depois)) throw new Error('o campo vazio continuou em cursiva');
  const t = await pg.$$eval('#taskList .task-text', els => els.map(e => [e.textContent, e.classList.contains('cursiva')]));
  if (!t.some(([x, c]) => x === 'Buscar vestido na costureira' && c)) throw new Error('não ficou em cursiva');
  if (t.some(([x, c]) => x === 'Comprar presente da mãe' && c)) throw new Error('a digitada virou cursiva');
  await pg.fill('#quickInput', 'Digitada depois'); await pg.press('#quickInput', 'Enter');
  const d = await pg.$$eval('#taskList .task-text', els => els.map(e => [e.textContent, e.classList.contains('cursiva')]));
  if (d.some(([x, c]) => x === 'Digitada depois' && c)) throw new Error('a cursiva vazou para a próxima tarefa digitada');
});
await passo('letra que a IA não leu: avisa e deixa tentar de novo', async () => {
  proximaLeitura = { ok: true, texto: '', ilegivel: true };
  await escreverComCaneta(pg, '#noteInput');
  await pg.waitForFunction(() => /Não consegui ler/.test(document.getElementById('canetaMsg').textContent));
  if (await pg.$('.caneta-fundo[hidden]')) throw new Error('fechou sem ter lido');
  await pg.click('#canetaCancelar');
  igual(await pg.inputValue('#noteInput'), '', 'o campo ficou vazio');
});
await passo('quando o leitor da letra não responde, a mensagem diz o motivo', async () => {
  proximaLeitura = '__sem_resposta__';
  await escreverComCaneta(pg, '#noteInput');
  await pg.waitForFunction(() => /sem resposta do servidor/.test(document.getElementById('canetaMsg').textContent));
  proximaLeitura = '__erro_404__';
  await pg.click('#canetaPronto');
  await pg.waitForFunction(() => /erro 404/.test(document.getElementById('canetaMsg').textContent));
  await pg.click('#canetaCancelar');
});
await passo('a lista do mercado vai para o WhatsApp do contato, já escrita', async () => {
  await pg.evaluate(() => { window.__aberto = []; window.open = (u) => { window.__aberto.push(u); return null; }; });
  if (!await pg.$('#mercadoContatoForm')) throw new Error('sem contato, não pediu o número');
  let alerta = null; const pegar = d => { alerta = d.message(); };
  pg.once('dialog', pegar);
  await pg.fill('#mercadoContatoNome', 'Maria'); await pg.fill('#mercadoContatoNumero', '9876');
  await pg.click('#mercadoContatoForm button[type="submit"]');
  await pg.waitForTimeout(200);
  if (!/não parece um celular/.test(alerta || '')) throw new Error('aceitou número errado');
  await pg.fill('#mercadoContatoNumero', '(11) 98765-4321');
  await pg.click('#mercadoContatoForm button[type="submit"]');
  const id = (await estado(pg)).mercado.contatos[0].id;
  await pg.click(`[data-role="mercado-zap"][data-id="${id}"]`);
  const url = (await pg.evaluate(() => window.__aberto))[0] || '';
  if (!url.startsWith('https://wa.me/5511987654321?text=')) throw new Error('endereço: ' + url);
  const texto = decodeURIComponent(url.split('text=')[1]);
  if (!texto.startsWith('Mercado:') || !texto.includes('• leite condensado')) throw new Error('texto: ' + texto);
});
await passo('para convidar, liga-se a agenda pessoal uma vez — e ela diz de qual conta é', async () => {
  await pg.click('#toggleApptForm');
  if (await pg.isVisible('#apptConvidados')) throw new Error('pediu convidados sem agenda ligada');
  await pg.fill('#agendaUrlCampo', 'https://exemplo.com/qualquer');
  await pg.click('[data-role="agenda-ligar"]');
  if (!/não é o do script/.test(await pg.textContent('#agendaLigacao'))) throw new Error('aceitou endereço errado');
  // Com duas contas Google no navegador, o endereço vem com /u/1/ no meio.
  await pg.fill('#agendaUrlCampo', 'https://script.google.com/macros/u/1/s/AKfyTESTE_123/exec');
  await pg.click('[data-role="agenda-ligar"]');
  await pg.waitForFunction(() => /dantasshy@gmail\.com/.test(document.getElementById('agendaLigacao').textContent));
  if (!await pg.isVisible('#apptConvidados')) throw new Error('o campo de convidados não apareceu');
  igual((await estado(pg)).agendaUrl, 'https://script.google.com/macros/s/AKfyTESTE_123/exec', 'o /u/1/ saiu do endereço');
  await pg.click('#toggleApptForm');
});
await passo('compromisso com e-mail vira convite na agenda do Google', async () => {
  await pg.click('#toggleApptForm');
  await pg.fill('#apptTitle', 'Almoço com a Ana'); await pg.fill('#apptTime', '12:30');
  await pg.fill('#apptConvidados', 'ana@exemplo.com, joao@exemplo.com.br');
  await pg.click('#apptForm button[type="submit"]');
  await pg.waitForFunction(() => /convite não saiu/.test(document.getElementById('timeline').textContent));
  const p = pedidosGoogle.find(x => x.acao === 'convidar-evento-calendar');
  igual(JSON.stringify(p.convidados), JSON.stringify(['ana@exemplo.com', 'joao@exemplo.com.br']), 'convidados');
  igual(p.hora, '12:30', 'hora'); igual(p.data, HOJE, 'data');
  // Um script que não conhece a ação recusa: o compromisso fica, e o motivo aparece.
  const a = (await estado(pg)).appointments.find(x => x.title === 'Almoço com a Ana');
  if (!/script da agenda está desatualizado/.test(a.convite.erro)) throw new Error('motivo: ' + a.convite.erro);
  respostaConvite = { ok: true, eventId: 'ev-123' };
  await pg.click('[data-role="convite-tentar"]');
  await pg.waitForFunction(() => /convite enviado · 2/.test(document.getElementById('timeline').textContent));
  await pg.click('#toggleApptForm');
  await pg.fill('#apptTitle', 'Aniversário da Ana'); await pg.fill('#apptConvidados', 'ana@exemplo.com');
  await (await pg.$('#timeline')).evaluate(el => el.closest('.panel').scrollIntoView());
  await (await pg.$('#timeline')).evaluate(el => el.closest('.panel')).then(() => null);
  const painel = await pg.$('#view-dia .day-left .panel:nth-child(2)');
  await painel.screenshot({ path: SAIDA('bussola-convite.png') });
  await pg.fill('#apptTitle', ''); await pg.fill('#apptConvidados', ''); await pg.click('#toggleApptForm');
});
await passo('e-mail errado não deixa salvar o compromisso', async () => {
  await pg.click('#toggleApptForm');
  await pg.fill('#apptTitle', 'Reunião'); await pg.fill('#apptConvidados', 'ana-sem-arroba');
  let alerta = null; pg.once('dialog', d => { alerta = d.message(); });
  await pg.click('#apptForm button[type="submit"]');
  await pg.waitForTimeout(200);
  if (!/não parecem certos/.test(alerta || '')) throw new Error('não avisou');
  if ((await estado(pg)).appointments.some(x => x.title === 'Reunião')) throw new Error('salvou mesmo assim');
  await pg.fill('#apptConvidados', ''); await pg.click('#toggleApptForm');
});
await passo('apagar o compromisso apaga também o evento do Google', async () => {
  const a = (await estado(pg)).appointments.find(x => x.title === 'Almoço com a Ana');
  await pg.click(`[data-role="del-appt"][data-id="${a.id}"]`);
  await pg.waitForFunction(() => true);
  await pg.waitForTimeout(300);
  if (!pedidosGoogle.some(x => x.acao === 'excluir-evento-calendar' && x.eventId === 'ev-123')) throw new Error('não pediu para apagar no Google');
});
await passo('no Diário, a caneta também escreve — e continua cifrado', async () => {
  proximaLeitura = { ok: true, texto: 'Ideia: aula de cerâmica aos sábados' };
  if (await pg.$('#diarioPainel [name="s"]')) {
    await pg.fill('#diarioPainel [name="s"]', 'novasenha1');
    await pg.click('#diarioPainel form button[type="submit"]');
  }
  await pg.waitForSelector('#diarioPainel textarea', { timeout: 15000 });
  await escreverComCaneta(pg, '#diarioPainel textarea');
  await pg.waitForFunction(() => /cerâmica/.test(document.querySelector('#diarioPainel textarea').value));
  await pg.click('#diarioPainel form button[type="submit"]');
  await pg.waitForSelector('#diarioPainel .diario-entrada-texto.cursiva');
  if ((await guardado(pg)).includes('cerâmica')) throw new Error('o texto foi guardado às claras');
});

// Foto da janela da caneta aberta, com uma escrita no quadro.
await aba(pg, 'dia');
await pg.click('#mercadoInput + .caneta-btn');
await pg.waitForSelector('.caneta-fundo:not([hidden])');
{
  const r = await (await pg.$('#canetaCanvas')).boundingBox();
  const letra = [[0,40],[10,10],[20,40],[30,12],[40,40],[55,20],[70,40],[85,15],[100,40],[120,25],[140,40],[160,18],[180,40],[200,22],[220,40]];
  await pg.mouse.move(r.x + 60 + letra[0][0] * 2, r.y + 60 + letra[0][1] * 2); await pg.mouse.down();
  for (const [x, y] of letra) await pg.mouse.move(r.x + 60 + x * 2, r.y + 60 + y * 2, { steps: 4 });
  await pg.mouse.up();
}
await pg.screenshot({ path: SAIDA('bussola-caneta.png') });
await pg.click('#canetaCancelar');
await aba(pg, 'dia');
// A foto do Dia sai com o diário trancado — é assim que ela o encontra.
await pg.click('#diarioPainel [data-role="diario-travar"]');
await pg.evaluate(() => window.scrollTo(0, 0));
await pg.screenshot({ path: SAIDA('bussola-dia.png'), fullPage: true });

// ── iPhone 13 ──
const cel = await abrir({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
for (const v of ['dia', 'diario', 'financas']) {
  await passo(`no celular, a aba ${v} cabe sem rolar de lado`, async () => {
    await aba(cel, v);
    const larg = await cel.evaluate(() => document.documentElement.scrollWidth);
    if (larg > 391) throw new Error('largura ' + larg);
  });
}
await aba(cel, 'dia');
await cel.screenshot({ path: SAIDA('bussola-celular.png'), fullPage: true });

await b.close();
servidor.close();
console.log(erros.length ? `\n${erros.length} falha(s):\n` + erros.join('\n') : '\nTudo certo.');
process.exit(erros.length ? 1 : 0);
