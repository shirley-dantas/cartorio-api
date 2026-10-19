// A página de envio do cliente (enviar.html), com o banco e o Apps Script
// fingidos: o caminho do dedo até o que chega ao cartório.
//   node testes/enviar-tela.mjs        (imagens em testes/saida)
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {servir} from './servidor.mjs';
import {createRequire} from 'node:module';
import {writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import assert from 'node:assert/strict';
const AQUI = dirname(fileURLToPath(import.meta.url));
const SAIDA = (n) => join(AQUI, 'saida', n);
mkdirSync(join(AQUI, 'saida'), {recursive: true});
const P = createRequire(import.meta.url)('../pedido-docs.js');
const erros = [];
const passo = async (n, f) => { try { await f(); console.log('  ok  ' + n); } catch (e) { erros.push(n); console.log('FALHA ' + n + ' → ' + e.message); } };
const TOKEN = 'aB3dE6gH9jK2mN5pQ8sT1vX4';
const servidor = await servir(8199);
const b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});

// Um RG de mentira, grande, para a redução ter o que reduzir.
const pgTmp = await b.newPage();
const png = await pgTmp.evaluate(() => { const c = document.createElement('canvas'); c.width = 3200; c.height = 2200; const x = c.getContext('2d'); x.fillStyle = '#cdbfa5'; x.fillRect(0, 0, 3200, 2200); x.fillStyle = '#333'; x.font = '220px sans-serif'; x.fillText('RG FRENTE', 300, 1100); return c.toDataURL('image/png').split(',')[1]; });
await pgTmp.close();
const RG = SAIDA('rg.png'); writeFileSync(RG, Buffer.from(png, 'base64'));
const PDF = SAIDA('cert.pdf'); writeFileSync(PDF, '%PDF-1.4\n%%EOF');

async function abrir(estado, {viewport = {width: 390, height: 844}, mobile = true, expira, gas} = {}) {
  const pg = await b.newPage({viewport, deviceScaleFactor: mobile ? 2 : 1.4, isMobile: mobile, hasTouch: mobile});
  const pedidos = {[TOKEN]: {casoId: '-Caso1', ato: estado.tipo, criadoEm: Date.now(), expiraEm: expira || Date.now() + 864e5, blocos: P.formulario(estado)}};
  const chamadas = [];
  await pg.route('**/*', async (rota) => {
    const u = rota.request().url();
    if (u.includes('firebaseio.com/pedidos/')) { const t = u.split('/pedidos/')[1].replace('.json', ''); return rota.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(pedidos[t] || null)}); }
    if (u.includes('script.google.com')) { const corpo = JSON.parse(rota.request().postData()); chamadas.push(corpo); const r = gas ? gas(corpo) : {ok: true}; return rota.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(r)}); }
    if (u.includes('viacep.com.br')) return rota.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({logradouro: 'Rua das Palmeiras', bairro: 'Jardins', localidade: 'São Paulo', uf: 'SP'})});
    if (u.startsWith('http://127.0.0.1')) return rota.continue();
    return rota.abort();
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  pg.on('dialog', (d) => d.accept());
  await pg.goto(`http://127.0.0.1:8199/enviar.html?t=${TOKEN}`);
  return {pg, chamadas};
}
const compra = {tipo: 'Escritura de Compra e Venda', publico: 'cliente', papel: 'comprador'};

await passo('sem código, ou com código vencido, a página diz que o link não serve e não mostra formulário', async () => {
  const pg = await b.newPage({viewport: {width: 390, height: 844}});
  await pg.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await pg.goto('http://127.0.0.1:8199/enviar.html'); await pg.waitForSelector('body.invalido');
  assert(await pg.isHidden('#formulario'));
  const v = await abrir(compra, {expira: Date.now() - 1000}); await v.pg.waitForSelector('body.invalido');
  assert(/venceu/.test(await v.pg.textContent('#motivo')));
});

await passo('a página pede o que foi marcado: comprador → seus dados, banco e valor; nada do vendedor', async () => {
  const {pg} = await abrir(compra); await pg.waitForSelector('[data-b="partes"]');
  const t = await pg.textContent('#formulario');
  assert(/Comprador\(a\)/.test(t) && /Dados bancários/.test(t) && /Valor da transação/.test(t));
  assert(!/Vendedor/.test(t) && !/Matrícula/.test(t));
});

await passo('o estado civil decide a certidão: solteiro → nascimento; casado → casamento + cônjuge; divorciado → casamento averbado', async () => {
  const {pg} = await abrir(compra); await pg.waitForSelector('[data-b="partes"]');
  await pg.selectOption('[data-f="ec"]', 'Solteiro(a)'); assert(/Certidão de nascimento/.test(await pg.textContent('#formulario')));
  await pg.selectOption('[data-f="ec"]', 'Casado(a)');
  let t = await pg.textContent('#formulario');
  assert(/Certidão de casamento/.test(t) && /Cônjuge/.test(t) && !/Certidão de nascimento/.test(t));
  await pg.selectOption('[data-f="ec"]', 'Divorciado(a)');
  t = await pg.textContent('#formulario'); assert(/averbação do divórcio/.test(t) && !/Cônjuge/.test(t));
});

await passo('regime que exige pacto pede o pacto e o registro; comunhão parcial não pede', async () => {
  const {pg} = await abrir(compra); await pg.waitForSelector('[data-b="partes"]');
  await pg.selectOption('[data-f="ec"]', 'Casado(a)');
  await pg.selectOption('[data-f="regime"]', 'Comunhão parcial de bens'); assert(!/pacto/i.test(await pg.textContent('#formulario')));
  await pg.selectOption('[data-f="regime"]', 'Separação convencional de bens');
  const t = await pg.textContent('#formulario'); assert(/Escritura do pacto/.test(t) && /registro do pacto/.test(t));
});

await passo('o CEP preenche a rua, o bairro e a cidade', async () => {
  const {pg} = await abrir(compra); await pg.waitForSelector('[data-b="partes"]');
  await pg.fill('[data-f="cep"]', '01452-000'); await pg.waitForFunction(() => document.querySelector('[data-f="rua"]').value === 'Rua das Palmeiras');
  assert.equal(await pg.inputValue('[data-f="cidade"]'), 'São Paulo'); assert.equal(await pg.inputValue('[data-f="uf"]'), 'SP');
});

let tela;
await passo('preencher e enviar: cada arquivo chega com o papel e o tipo, e os dados vão por último', async () => {
  const {pg, chamadas} = await abrir(compra); tela = pg; await pg.waitForSelector('[data-b="partes"]');
  await pg.fill('[data-f="nome"]', 'Maria da Silva'); await pg.selectOption('[data-f="ec"]', 'Solteiro(a)'); await pg.fill('[data-f="prof"]', 'Professora');
  await pg.fill('[data-f="cep"]', '01452000'); await pg.waitForFunction(() => document.querySelector('[data-f="rua"]').value); await pg.fill('[data-f="num"]', '210');
  await pg.locator('input[type=file][multiple]').nth(0).setInputFiles(RG);
  await pg.locator('input[type=file][multiple]').nth(2).setInputFiles(PDF);
  await pg.fill('[data-banco] >> nth=0', 'Banco do Brasil'); await pg.fill('[data-f="agencia"]', '1234'); await pg.fill('[data-f="conta"]', '56789-0'); await pg.fill('[data-f="titular"]', 'Maria da Silva');
  await pg.fill('[data-cb="comprador.valor"]', '450.000,00');
  await pg.fill('#obs', 'Quero constar o nome de solteira.');
  await pg.waitForFunction(() => /anexados/.test(document.querySelector('#resumo').textContent));
  await pg.screenshot({path: SAIDA('env-cel-cheio.png'), fullPage: true});
  await pg.click('#enviar'); await pg.waitForSelector('body.concluido');
  const arqs = chamadas.filter((c) => c.acao === 'cliente-arquivo'), dados = chamadas.find((c) => c.acao === 'cliente-dados');
  assert.equal(arqs.length, 2); assert(chamadas.indexOf(dados) === chamadas.length - 1, 'os dados vão depois dos arquivos');
  const rg = arqs.find((a) => a.tipo === 'RG_CNH'); assert(rg && rg.papel === 'Comprador(a)' && rg.pessoa === 'Maria da Silva' && rg.t === TOKEN);
  assert(rg.mimetype === 'image/jpeg' && Buffer.from(rg.base64, 'base64').length < 600000, 'a foto foi reduzida antes de sair');
  assert.equal(dados.dados.pessoas[0].nome, 'Maria da Silva'); assert.equal(dados.dados.pessoas[0].estadoCivil, 'Solteiro(a)');
  assert(/Rua das Palmeiras, 210/.test(dados.dados.pessoas[0].endereco));
  assert.equal(dados.dados.campos['comprador.valor'].valor, '450.000,00'); assert.equal(dados.dados.banco['partes.banco'].banco, 'Banco do Brasil');
  assert.equal(dados.dados.observacoes, 'Quero constar o nome de solteira.');
  await pg.screenshot({path: SAIDA('env-cel-final.png')});
});

await passo('se o cartório recusa um arquivo, ele fica marcado e os dados NÃO são enviados como se estivesse tudo certo', async () => {
  const {pg, chamadas} = await abrir(compra, {gas: (c) => c.acao === 'cliente-arquivo' ? {ok: false, erro: 'não deu'} : {ok: true}});
  await pg.waitForSelector('[data-b="partes"]');
  await pg.locator('input[type=file][multiple]').nth(0).setInputFiles(RG);
  await pg.waitForFunction(() => document.querySelector('.arq small')?.textContent.includes('KB'));
  await pg.click('#enviar'); await pg.waitForFunction(() => document.querySelector('.arq small.erro'));
  assert(!chamadas.some((c) => c.acao === 'cliente-dados'), 'dados não podem ir se um arquivo falhou');
  assert(await pg.isHidden('#final'));
});

await passo('o advogado manda vários herdeiros: acrescentar e remover pessoa', async () => {
  const {pg} = await abrir({tipo: 'Inventário', publico: 'advogado', bens: {urbano: true}}, {viewport: {width: 1100, height: 900}, mobile: false});
  await pg.waitForSelector('[data-b="herdeiros"]');
  await pg.click('[data-mais="herdeiros"]'); assert.equal(await pg.locator('[data-b="herdeiros"][data-f="nome"]').count(), 2);
  await pg.click('[data-remover]'); assert.equal(await pg.locator('[data-b="herdeiros"][data-f="nome"]').count(), 1);
  const t = await pg.textContent('#formulario'); assert(/Falecido/.test(t) && /Número da OAB/.test(t) && /Matrícula do imóvel urbano/.test(t));
  await pg.screenshot({path: SAIDA('env-desk-inventario.png'), fullPage: true});
});

await b.close(); servidor.close();
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
