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

const p2 = (n) => String(n).padStart(2, '0');
const dia = (o) => { const x = new Date(); x.setDate(x.getDate() + o); return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`; };
const HOJE = dia(0);

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
    config: null
  }
};
let escritas = 0, recusarFocos = false;
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
  await pg.route('**/fonts.g*/**', r => r.abort());
  await pg.goto('http://127.0.0.1:8197/bussola/index.html');
  await pg.waitForSelector('#painelSyncTxt');
  await pg.waitForFunction(() => /conferido/.test(document.getElementById('painelSyncTxt').textContent));
  return pg;
}
const guardado = (pg) => pg.evaluate(() => localStorage.getItem('bussola-planner-v1'));
const estado = async (pg) => JSON.parse(await guardado(pg));
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
  await pg.click('#pageToBloco');
  const st = await estado(pg);
  const n = st.notes.find(n => n.type === 'drawing');
  if (!n) throw new Error('não virou nota');
  igual(n.date, HOJE, 'data da nota');
  igual((st.pages[HOJE] || { strokes: [] }).strokes.length, 0, 'a página ficou limpa');
  if (!await pg.$('#notesGrid [data-role="sketch-thumb"]')) throw new Error('o cartão não apareceu no bloco');
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
await passo('conta vencida aparece no Dia, com os dias, sem bronca', async () => {
  await aba(pg, 'financas');
  await pg.fill('#contaNome', 'IPTU'); await pg.fill('#contaValor', '350,00');
  await pg.fill('#contaVenc', dia(-28)); await pg.selectOption('#contaRepete', 'mes');
  await pg.click('#contaForm button[type="submit"]');
  await pg.fill('#contaNome', 'Faxina (Maria)'); await pg.fill('#contaVenc', HOJE); await pg.selectOption('#contaRepete', 'semana');
  await pg.click('#contaForm button[type="submit"]');
  await aba(pg, 'dia');
  const t = await pg.textContent('#contasBanner');
  if (!t.includes('IPTU') || !t.includes('venceu há 28 dias')) throw new Error(t);
  if (!t.includes('Faxina') || !t.includes('vence hoje')) throw new Error(t);
  if (!(await pg.textContent('#timeline')).includes('Pagar: Faxina')) throw new Error('a faxina não entrou na Agenda de hoje');
});
await passo('"Paguei" lança na planilha e empurra o vencimento', async () => {
  const st = await estado(pg);
  const iptu = st.contas.find(c => c.nome === 'IPTU'), fax = st.contas.find(c => c.nome.startsWith('Faxina'));
  await pg.click(`#contasBanner [data-role="conta-paguei"][data-id="${iptu.id}"]`);
  await pg.click(`#contasBanner [data-role="conta-paguei"][data-id="${fax.id}"]`);
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
  if (!(await pg.textContent('#finCats')).includes('Mercado')) throw new Error('sem as categorias');
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
  await pg.screenshot({ path: SAIDA('bussola-financas.png') });
});

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
