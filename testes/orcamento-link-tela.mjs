// A página em que o cliente aprova o orçamento (orcamento.html), com o banco e o Apps Script fingidos.
//   node testes/orcamento-link-tela.mjs
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {servir} from './servidor.mjs';
import assert from 'node:assert/strict';
const erros = [];
const passo = async (n, f) => { try { await f(); console.log('  ok  ' + n); } catch (e) { erros.push(n); console.log('FALHA ' + n + ' → ' + e.message); } };
const TOKEN = 'pG3dE6gH9jK2mN5pQ8sT1vX4';
const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const servidor = await servir(8199);
const b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const cob = (meta = {}, extra = {}) => ({meta: {tipo: 'orcamento', casoId: '-Caso1', orcId: 'o1', versao: '2', criadoEm: Date.now(), expiraEm: Date.now() + 864e5, ...meta}, dados: {nome: 'Maria da Silva', ato: 'Escritura de Compra e Venda'}, imagens: {orcamento: IMG}, ...extra});
async function abrir(registro, {gas} = {}) {
  const pg = await b.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
  const chamadas = [];
  await pg.route('**/*', async (rota) => {
    const u = rota.request().url();
    if (u.includes('firebaseio.com/cobrancas/')) return rota.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(registro)});
    if (u.includes('script.google.com')) { const c = JSON.parse(rota.request().postData()); chamadas.push(c); return rota.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(gas ? gas(c) : {ok: true, em: Date.now()})}); }
    if (u.startsWith('http://127.0.0.1')) return rota.continue();
    return rota.abort();
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto('http://127.0.0.1:8199/orcamento.html?t=' + TOKEN);
  await pg.waitForFunction(() => document.querySelector('#folha').src || document.body.classList.contains('invalido') || document.body.classList.contains('aprovado'), null, {timeout: 6000}).catch(() => {});
  return {pg, chamadas};
}
const visivel = (pg, s) => pg.locator(s).isVisible();

await passo('o cliente vê a folha e UM botão "Aprovo este orçamento" — nada de dúvida', async () => {
  const {pg} = await abrir(cob());
  assert(await visivel(pg, '#folha') && await visivel(pg, '#aprovo'));
  assert.equal(await pg.locator('button').count(), 1, 'só o botão de aprovar');
  const t = await pg.innerText('body'); assert(/Olá, Maria/.test(t) && /Aprovo este orçamento/i.test(t) && !/dúvida/i.test(t));
  assert.equal(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'não rola de lado');
});

await passo('tocar em Aprovo chama o Apps Script com o código e mostra a tela de aprovado com data e hora', async () => {
  const {pg, chamadas} = await abrir(cob());
  await pg.click('#aprovo'); await pg.waitForFunction(() => document.body.classList.contains('aprovado'));
  assert.equal(chamadas.length, 1); assert.equal(chamadas[0].acao, 'orcamento-aprovar'); assert.equal(chamadas[0].t, TOKEN);
  assert(/Orçamento aprovado/.test(await pg.innerText('#final')) && /Recebemos a sua aprovação em \d\d\/\d\d\/\d{4} às \d\d:\d\d/.test(await pg.innerText('#quando')));
  assert(!(await visivel(pg, '#aprovo')));
});

await passo('se o registro falha, o motivo aparece escrito e o botão volta (nunca "aprovado" sem ter registrado)', async () => {
  const {pg} = await abrir(cob(), {gas: () => ({ok: false, erro: 'O banco recusou o registro (401).'})});
  await pg.click('#aprovo'); await pg.waitForSelector('#erro:not([hidden])');
  assert(/banco recusou/.test(await pg.innerText('#erro'))); assert.equal(await pg.locator('#aprovo').isEnabled(), true);
  assert.equal(await pg.evaluate(() => document.body.classList.contains('aprovado')), false);
});

await passo('link já aprovado abre direto na tela de aprovado, sem botão', async () => {
  const {pg} = await abrir(cob({aprovadoEm: 1760000000000}));
  assert(/Orçamento aprovado/.test(await pg.innerText('#final'))); assert(!(await visivel(pg, '#aprovo')));
});

await passo('link vencido, inexistente ou que não é de orçamento (é de pagamento): indisponível', async () => {
  for (const reg of [cob({expiraEm: Date.now() - 1000}), null, cob({tipo: undefined})]) {
    const {pg} = await abrir(reg); assert(/Link indisponível/.test(await pg.innerText('#invalido')) && await visivel(pg, '#invalido'));
    assert(!(await visivel(pg, '#aprovo')));
  }
});

await passo('e o link de pagamento recusa o link do orçamento', async () => {
  const pg = await b.newPage();
  await pg.route('**/*', (r) => { const u = r.request().url(); if (u.includes('firebaseio.com/cobrancas/')) return r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(cob({}, {dados: {nome: 'M', escritura: {valorCent: 100}}}))}); if (u.startsWith('http://127.0.0.1')) return r.continue(); return r.abort(); });
  await pg.goto('http://127.0.0.1:8199/pagar.html?t=' + TOKEN);
  await pg.waitForFunction(() => document.body.classList.contains('invalido'), null, {timeout: 6000});
});

await b.close(); servidor.close();
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
