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
const b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']});

// Um RG de mentira, grande, para a redução ter o que reduzir.
const pgTmp = await b.newPage();
const png = await pgTmp.evaluate(() => { const c = document.createElement('canvas'); c.width = 3200; c.height = 2200; const x = c.getContext('2d'); x.fillStyle = '#cdbfa5'; x.fillRect(0, 0, 3200, 2200); x.fillStyle = '#333'; x.font = '220px sans-serif'; x.fillText('RG FRENTE', 300, 1100); return c.toDataURL('image/png').split(',')[1]; });
await pgTmp.close();
const RG = SAIDA('rg.png'); writeFileSync(RG, Buffer.from(png, 'base64'));
const PDF = SAIDA('cert.pdf'); writeFileSync(PDF, '%PDF-1.4\n%%EOF');

async function abrir(estado, {viewport = {width: 390, height: 844}, mobile = true, expira, gas, concluidoEm} = {}) {
  const pg = await b.newPage({viewport, deviceScaleFactor: mobile ? 2 : 1.4, isMobile: mobile, hasTouch: mobile});
  const pedidos = {[TOKEN]: {casoId: '-Caso1', ato: estado.tipo, criadoEm: Date.now(), ...(concluidoEm ? {concluidoEm} : {}), expiraEm: expira || Date.now() + 864e5, blocos: P.formulario(estado)}};
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

async function pg_espera(pg, id){ await pg.waitForSelector(`[data-bloco="${id}"]`); }
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
  assert(/Comprador\(a\)/.test(t) && /Pagamento/.test(t) && /Valor da transação/.test(t) && /Por que pedimos isto/.test(t));
  assert(!/Vendedor/.test(t) && !/Matrícula/.test(t));
});

await passo('não existe campo de CPF: o RG ou a CNH já traz, com um aviso para quando não trouxer', async () => {
  const {pg} = await abrir(compra); await pg.waitForSelector('[data-b="partes"]');
  const t = await pg.textContent('#formulario'); assert(!/^CPF$/m.test(t) && !/\bCPF \(opcional\)/.test(t));
  assert(/Se o seu RG não trouxer o CPF, anexe o CPF junto/.test(t));
});

await passo('pagamento: o sinal e a forma abrem os campos certos; o vendedor só vê a conta que recebe', async () => {
  const {pg} = await abrir(compra); await pg.waitForSelector('[data-cb="pagamento"]');
  assert.equal(await pg.locator('[data-f="sinalValor"]').count(), 0); assert.equal(await pg.locator('[data-banco]').count(), 0, 'conta só depois de escolher TED ou PIX');
  await pg.selectOption('[data-f="sinal"]', 'Sim'); assert.equal(await pg.locator('[data-f="sinalValor"]').count(), 1);
  await pg.selectOption('[data-f="forma"]', 'TED'); assert.equal(await pg.locator('[data-banco="pagamento.pagador"][data-f="banco"]').count(), 1);
  assert(/Conta de onde sairá o pagamento/.test(await pg.textContent('#formulario')) && !/Conta que receberá/.test(await pg.textContent('#formulario')));
  const v = await abrir({tipo: 'Escritura de Compra e Venda', publico: 'cliente', papel: 'vendedor', marc: {pagamento: true}}); await v.pg.waitForSelector('[data-banco]');
  const tv = await v.pg.textContent('#formulario'); assert(/Conta que receberá o pagamento/.test(tv) && /Por que pedimos isto/.test(tv)); assert.equal(await v.pg.locator('[data-f="valor"], [data-f="sinal"], [data-f="restante"]').count(), 0, 'o vendedor não preenche valor nem sinal');
});

await passo('o estado civil decide a certidão: solteiro → nascimento; casado → casamento + cônjuge; divorciado → casamento averbado', async () => {
  const {pg} = await abrir(compra); await pg.waitForSelector('[data-b="partes"]');
  await pg.selectOption('[data-f="ec"]', 'Solteiro(a)'); assert(/Certidão de nascimento/.test(await pg.textContent('#formulario')));
  await pg.selectOption('[data-f="ec"]', 'Casado(a)');
  let t = await pg.textContent('#formulario');
  assert(/Certidão de casamento/.test(t) && /cônjuge/i.test(t) && !/Certidão de nascimento/.test(t));
  await pg.selectOption('[data-f="ec"]', 'Divorciado(a)');
  t = await pg.textContent('#formulario'); assert(/averbação do divórcio/.test(t) && !/cônjuge/i.test(t));
});

await passo('regime que exige pacto pede o pacto e o registro; comunhão parcial não pede', async () => {
  const {pg} = await abrir(compra); await pg.waitForSelector('[data-b="partes"]');
  await pg.selectOption('[data-f="ec"]', 'Casado(a)');
  await pg.check('input[data-f="regime"][value="Comunhão parcial de bens"]', {force: true}); assert(!/pacto/i.test(await pg.textContent('#formulario')));
  await pg.check('input[data-f="regime"][value="Separação total de bens"]', {force: true});
  const t = await pg.textContent('#formulario'); assert(/Escritura do pacto/.test(t) && /registro do pacto/.test(t));
});

await passo('o CEP preenche a rua, o bairro e a cidade', async () => {
  const {pg} = await abrir(compra); await pg.waitForSelector('[data-b="partes"]');
  await pg.fill('[data-f="cep"]', '01452-000'); await pg.waitForSelector('[data-editend]');
  const txt = await pg.locator('[data-editend]').locator('xpath=..').innerText();
  assert.ok(/Rua das Palmeiras/.test(txt) && /São Paulo\/SP/.test(txt), 'o endereço resumido traz rua e cidade/UF: ' + txt);
  assert.equal(await pg.locator('[data-f="rua"]').count(), 0, 'rua, bairro, cidade e UF ficam recolhidos');
  await pg.click('[data-editend]'); assert.equal(await pg.inputValue('[data-f="rua"]'), 'Rua das Palmeiras');
  assert.equal(await pg.inputValue('[data-f="cidade"]'), 'São Paulo'); assert.equal(await pg.inputValue('[data-f="uf"]'), 'SP');
});

await passo('cabeçalho personalizado, certidão visível desde o início e câmera do computador', async () => {
  const {pg} = await abrir({...compra, tipo:'Escritura de Compra e Venda', publico:'cliente', papel:'comprador'}, {mobile: false, viewport: {width: 1100, height: 800}});
  await pg.waitForSelector('[data-b="partes"]');
  assert.equal(await pg.locator('#intro').count(), 0, 'sem frase explicativa no topo: o link já vem personalizado');
  assert.ok(!/cartorio-api/i.test(await pg.innerText('body')) && !/cartorio-api/i.test(await pg.title()), 'a página nunca mostra cartorio-api (só a imagem de prévia mora lá)');
  assert.ok(/og:title/.test(await pg.content()));
  assert.ok(await pg.locator('text=Certidão de estado civil').count() > 0, 'o espaço da certidão aparece antes de escolher o estado civil');
  assert.equal(await pg.locator('input[capture]').count(), 0, 'no computador não há capture');
  assert.ok(await pg.locator('[data-camera]').count() > 0, 'no computador, Tirar foto abre a webcam');
  await pg.locator('[data-camera]').first().click(); await pg.waitForSelector('#camera video');
  await pg.waitForFunction(() => document.querySelector('#camera video').videoWidth > 0);
  await pg.click('[data-cam="foto"]'); await pg.waitForSelector('.arq');
  assert.equal(await pg.locator('#camera').count(), 0);
});

// Com o teclado aberto o rodapé some (de propósito): quem toca no botão já tirou o foco do campo.
const clicarEnviar = async (pg) => { await pg.evaluate(() => document.activeElement && document.activeElement.blur()); await pg.waitForSelector('.rodape', {state: 'visible'}); await pg.click('#enviar'); };
async function preencher(pg) {
  await pg.fill('[data-f="nome"]', 'Maria da Silva'); await pg.selectOption('[data-f="ec"]', 'Solteiro(a)'); await pg.fill('[data-f="prof"]', 'Professora');
  await pg.fill('[data-f="cep"]', '01452000'); await pg.waitForSelector('[data-editend]'); await pg.fill('[data-f="num"]', '210');
  await pg.locator('input[type=file][multiple]').nth(0).setInputFiles(RG);
  await pg.locator('input[type=file][multiple]').nth(1).setInputFiles(PDF);
  await pg.fill('[data-cb="pagamento"][data-f="valor"]', '450.000,00');
  await pg.selectOption('[data-f="sinal"]', 'Sim'); await pg.fill('[data-f="sinalValor"]', '45.000,00');
  await pg.fill('[data-f="restante"]', '405.000,00'); await pg.selectOption('[data-f="forma"]', 'PIX');
  await pg.fill('[data-banco="pagamento.pagador"][data-f="banco"]', 'Banco do Brasil'); await pg.fill('[data-banco="pagamento.pagador"][data-f="agencia"]', '1234');
  await pg.fill('[data-banco="pagamento.pagador"][data-f="conta"]', '56789-0'); await pg.fill('[data-banco="pagamento.pagador"][data-f="titular"]', 'Maria da Silva');
}

await passo('trava: faltando algo o envio não sai; completo, pede confirmação e só envia no "Enviar agora"', async () => {
  const {pg, chamadas} = await abrir(compra); await pg.waitForSelector('[data-b="partes"]');
  assert(/faltam \d+ itens/i.test(await pg.innerText('#enviar')));
  await clicarEnviar(pg); assert(/Ainda falta preencher/.test(await pg.innerText('.folha')), 'mostra o que falta');
  await pg.click('[data-fecha]'); assert.equal(chamadas.length, 0, 'nada saiu');
  await preencher(pg); await pg.waitForFunction(() => /conferir e enviar/i.test(document.querySelector('#enviar').textContent));
  await clicarEnviar(pg); assert(/este link fecha/.test(await pg.innerText('.folha')));
  await pg.click('[data-fecha]'); assert(!chamadas.some((c) => c.acao === 'cliente-dados'), 'voltar e revisar não envia a ficha');
  await clicarEnviar(pg); await pg.click('[data-ok]'); await pg.waitForSelector('body.concluido');
  assert(chamadas.some((c) => c.acao === 'cliente-dados'), 'só agora a ficha vai');
});
await passo('link já usado (concluidoEm) mostra "já foi usado" e nenhum formulário', async () => {
  const {pg} = await abrir(compra, {concluidoEm: Date.now() - 1000});
  await pg.waitForSelector('body.invalido'); assert(/já foi usado/.test(await pg.innerText('#motivo'))); assert.equal(await pg.locator('[data-b]').count(), 0);
});
await passo('o CEP lê de novo mesmo com o endereço já preenchido pelo navegador, e um CEP novo troca a rua', async () => {
  const {pg} = await abrir(compra); await pg.waitForSelector('[data-b="partes"]');
  await pg.fill('[data-f="rua"]', 'Rua digitada antes'); await pg.fill('[data-f="cidade"]', 'Outra');
  await pg.fill('[data-f="cep"]', '01452000'); await pg.waitForSelector('[data-editend]');
  assert(/Rua das Palmeiras/.test(await pg.locator('[data-editend]').locator('xpath=..').innerText()));
  await pg.click('[data-editend]'); assert.equal(await pg.inputValue('[data-f="rua"]'), 'Rua das Palmeiras');
});
await passo('data de início da união: campo de texto com máscara dd/mm/aaaa, e só vale data de verdade', async () => {
  const {pg} = await abrir({tipo: 'União Estável', publico: 'cliente', papel: 'conv1'}); await pg.waitForSelector('[data-b="conviventes"]');
  const c = pg.locator('[data-cb="convivente.dados"][data-f="inicio"]'); assert.equal(await c.getAttribute('type'), 'text');
  await c.pressSequentially('15032019'); assert.equal(await c.inputValue(), '15/03/2019');
  await c.fill(''); await c.pressSequentially('31132019'); await clicarEnviar(pg);
  assert(/Data de início da união \(dd\/mm\/aaaa\)/.test(await pg.innerText('.folha')), 'mês 13 não vale');
});
await passo('convivente 1 acrescenta o outro: a pessoa nova é "Convivente 2", no formulário e na ficha', async () => {
  const {pg, chamadas} = await abrir({tipo: 'União Estável', publico: 'cliente', papel: 'conv1'}); await pg.waitForSelector('[data-b="conviventes"]');
  assert(/Acrescentar Convivente 2/.test(await pg.innerText('[data-mais]')));
  await pg.click('[data-mais]');
  const t = await pg.locator('.bloco h2').allInnerTexts(); assert(t.some((x) => /Convivente 1/.test(x)) && t.some((x) => /Convivente 2/.test(x)), t.join('|'));
  assert.equal(await pg.locator('[data-remover]').count(), 1);
});

await passo('documentos na pílula de cada pessoa: dados, regime e cônjuge, e logo em seguida os arquivos dela, com o nome na frase', async () => {
  const {pg} = await abrir(compra); await pg.waitForSelector('[data-b="partes"]');
  await pg.fill('[data-f="nome"]', 'José da Silva'); await pg.selectOption('[data-f="ec"]', 'Casado(a)');
  const regimes = await pg.locator('input[data-f="regime"]').evaluateAll((l) => l.map((x) => x.value));
  assert.deepEqual(regimes, ['Comunhão parcial de bens', 'Comunhão universal de bens', 'Separação total de bens'], 'só os três regimes');
  await pg.fill('[data-c="nome"]', 'Maria Cristina');
  const caixa = await pg.evaluate(() => { const b = document.querySelector('[data-bloco="partes"]'); const t = b.innerText;
    const ordem = (re) => t.search(re); return {dentro: b.querySelectorAll('.slot').length, cab: ordem(/ANEXE OS DOCUMENTOS/i), conj: ordem(/DADOS DO CÔNJUGE/i), rg: ordem(/RG ou CNH/), t}; });
  assert(caixa.dentro >= 3, 'os slots estão dentro do cartão da pessoa: ' + caixa.dentro);
  assert(caixa.conj >= 0 && caixa.cab > caixa.conj && caixa.rg > caixa.cab, 'dados do cônjuge antes, documentos depois: ' + JSON.stringify([caixa.conj, caixa.cab, caixa.rg]));
  const seq = await pg.evaluate(() => { const t = document.querySelector('[data-bloco="partes"]').innerText.toUpperCase(); const i = (re) => t.search(re);
    return [i(/NOME COMPLETO/), i(/PROFISSÃO/), i(/ESTADO CIVIL/), i(/REGIME DE BENS/), i(/DADOS DO CÔNJUGE/), i(/CEP/), i(/ANEXE OS DOCUMENTOS/)]; });
  assert(seq.every((x, k) => x >= 0 && (k === 0 || x > seq[k - 1])), 'ordem: nome, profissão, estado civil, regime, cônjuge, endereço, documentos: ' + JSON.stringify(seq));
  assert(/RG ou CNH de José da Silva/.test(caixa.t), 'o RG diz de quem é');
  assert(/Certidão de casamento de José da Silva e Maria Cristina/.test(caixa.t), 'a certidão diz "de José e Maria"');
  assert(/RG ou CNH de Maria Cristina/.test(caixa.t), 'o RG do cônjuge diz o nome dela');
  await pg.fill('[data-f="nome"]', 'José Souza'); await pg.waitForFunction(() => /RG ou CNH de José Souza/.test(document.querySelector('[data-bloco="partes"]').innerText), null, {timeout: 3000}); // o nome na frase acompanha o que se digita
  assert.equal(await pg.locator('.chip:has-text("Falta anexar")').count() > 1, true, 'cada documento mostra se falta ou se já foi anexado');
});
await passo('vendedor e comprador: "Acrescentar vendedor(a)" fica depois das pílulas dos vendedores e "Acrescentar comprador(a)" depois das dos compradores', async () => {
  const {pg} = await abrir({tipo: 'Escritura de Compra e Venda', publico: 'cliente', papel: 'ambos'}); await pg.waitForSelector('[data-b="partes"]');
  const seq = () => pg.evaluate(() => [...document.querySelectorAll('[data-bloco="partes"], [data-papel]')].map((e) => e.hasAttribute('data-papel') ? '+' + e.dataset.papel : e.querySelector('h2').innerText.trim().replace(/^\d+\s*/, '')));
  assert.deepEqual(await seq(), ['Vendedor(a)', '+Vendedor(a)', 'Comprador(a)', '+Comprador(a)']);
  await pg.click('[data-papel="Vendedor(a)"]'); await pg.click('[data-papel="Comprador(a)"]'); await pg.click('[data-papel="Vendedor(a)"]');
  assert.deepEqual(await seq(), ['Vendedor(a)', 'Vendedor(a)', 'Vendedor(a)', '+Vendedor(a)', 'Comprador(a)', 'Comprador(a)', '+Comprador(a)']);
});
await passo('vários compradores: cada um com os seus dados e, logo abaixo, os documentos dele, na ordem', async () => {
  const {pg} = await abrir({tipo: 'Escritura de Compra e Venda', publico: 'cliente', papel: 'comprador'}); await pg.waitForSelector('[data-b="partes"]');
  await pg.fill('[data-b="partes"][data-i="0"][data-f="nome"]', 'João');
  await pg.click('[data-mais]'); await pg.fill('[data-b="partes"][data-i="1"][data-f="nome"]', 'José');
  await pg.click('[data-mais]'); await pg.fill('[data-b="partes"][data-i="2"][data-f="nome"]', 'Maria');
  const ordem = await pg.evaluate(() => [...document.querySelectorAll('[data-bloco="partes"]')].map((b) => ({ slots: b.querySelectorAll('.slot').length, txt: b.querySelector('.slot b').textContent })));
  assert.equal(ordem.length, 3); assert.deepEqual(ordem.map((o) => o.txt), ['RG ou CNH de João', 'RG ou CNH de José', 'RG ou CNH de Maria']);
  assert(ordem.every((o) => o.slots >= 2), 'cada cartão tem os arquivos dele');
});
await passo('envio ao anexar: o arquivo sobe na hora; no fim só vai a ficha, e a IA só lê DEPOIS do envio concluído', async () => {
  let n = 0;
  const {pg, chamadas} = await abrir(compra, {gas: (c) => c.acao === 'cliente-arquivo' ? {ok: true, docKey: 'cli_aB3dE6_' + (++n)} : {ok: true}});
  await pg.waitForSelector('[data-b="partes"]'); await preencher(pg);
  await pg.waitForFunction(() => document.querySelectorAll('.arq small.ok').length === 2);
  assert.equal(chamadas.filter((c) => c.acao === 'cliente-arquivo').length, 2, 'os dois arquivos já subiram antes do botão');
  assert(!chamadas.some((c) => c.acao === 'cliente-dados' || c.acao === 'cliente-ler'), 'sem ficha e sem leitura enquanto o cliente ainda preenche');
  await clicarEnviar(pg); await pg.click('[data-ok]'); await pg.waitForSelector('body.concluido');
  await new Promise((r) => setTimeout(r, 400));
  const ac = chamadas.map((c) => c.acao), iDados = ac.indexOf('cliente-dados');
  assert.equal(ac.filter((x) => x === 'cliente-arquivo').length, 2, 'nada foi reenviado no fim');
  const dados = chamadas[iDados]; assert.deepEqual([...dados.docKeys].sort(), ['cli_aB3dE6_1', 'cli_aB3dE6_2'], 'a ficha leva as chaves dos arquivos');
  const leituras = chamadas.filter((c) => c.acao === 'cliente-ler');
  assert.deepEqual(leituras.map((c) => c.docKey).sort(), ['cli_aB3dE6_1', 'cli_aB3dE6_2']); assert(leituras.every((c) => c.t === TOKEN));
  assert(ac.indexOf('cliente-ler') > iDados, 'a leitura só começa depois da ficha');
});
await passo('tirar um arquivo já enviado também o tira do servidor; e o que falhou tem "Tentar de novo"', async () => {
  let n = 0, falha = true;
  const {pg, chamadas} = await abrir(compra, {gas: (c) => c.acao === 'cliente-arquivo' ? (falha ? {ok: false, erro: 'não deu'} : {ok: true, docKey: 'cli_aB3dE6_' + (++n)}) : {ok: true}});
  await pg.waitForSelector('[data-b="partes"]');
  await pg.locator('input[type=file][multiple]').nth(0).setInputFiles(RG);
  await pg.waitForSelector('.arq small.erro'); assert(await pg.locator('[data-retry]').count() === 1, 'oferece tentar de novo');
  falha = false; await pg.click('[data-retry]'); await pg.waitForSelector('.arq small.ok');
  await pg.click('[data-tirar]'); await pg.waitForFunction(() => !document.querySelector('.arq'));
  const rem = chamadas.find((c) => c.acao === 'cliente-remover'); assert(rem && rem.docKey === 'cli_aB3dE6_1' && rem.t === TOKEN, 'o servidor foi avisado');
});
await passo('rascunho: o que já tinha sido enviado volta como "✓ Enviado" depois de recarregar a página', async () => {
  let n = 0;
  const {pg} = await abrir(compra, {gas: (c) => c.acao === 'cliente-arquivo' ? {ok: true, docKey: 'cli_aB3dE6_' + (++n)} : {ok: true}});
  await pg.waitForSelector('[data-b="partes"]'); await pg.fill('[data-f="nome"]', 'Maria da Silva');
  await pg.locator('input[type=file][multiple]').nth(0).setInputFiles(RG); await pg.waitForSelector('.arq small.ok');
  await pg.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await pg.reload(); await pg.waitForSelector('.recuperado');
  assert.equal(await pg.inputValue('[data-f="nome"]'), 'Maria da Silva'); assert(/Enviado/.test(await pg.innerText('.arq')), 'o arquivo continua como enviado');
  assert(/rg\.png/.test(await pg.innerText('.arq')), 'com o nome dele'); assert(/anexado/i.test(await pg.innerText('.chip.ok')));
});

await passo('viúvo: a certidão de casamento com a averbação do óbito basta; a de óbito só na lista de inventário', async () => {
  const {pg} = await abrir(compra); await pg.waitForSelector('[data-b="partes"]');
  await pg.selectOption('[data-f="ec"]', 'Viúvo(a)'); let t = await pg.textContent('#formulario');
  assert(/averbação do óbito/.test(t) && !/Certidão de óbito/.test(t), 'compra e venda não pede óbito');
  const inv = await abrir({tipo: 'Inventário', publico: 'advogado', bens: {urbano: true}}, {viewport: {width: 1100, height: 900}, mobile: false});
  await inv.pg.waitForSelector('[data-b="herdeiros"]'); await inv.pg.selectOption('[data-b="herdeiros"][data-f="ec"]', 'Viúvo(a)');
  t = await inv.pg.textContent('#formulario'); assert(/averbação do óbito/.test(t) && /Certidão de óbito do cônjuge/.test(t), 'inventário pede as duas');
});

await passo('topo: sem o nome PRIME; título, 20º Tabelião de Notas e, por último, a escrevente com o WhatsApp', async () => {
  const {pg} = await abrir(compra); await pg.waitForSelector('[data-b="partes"]');
  const t = await pg.innerText('body'); assert(!/PRIME/.test(t) && !(await pg.content()).includes('>PRIME<'), 'sem PRIME');
  const topo = await pg.innerText('header.topo'); const tl = topo.toLowerCase(); assert(tl.indexOf('envio de documentos') < tl.indexOf('20º tabelião de notas') && tl.indexOf('20º tabelião de notas') < tl.indexOf('escrevente shirley dantas'), topo);
  assert.equal(await pg.getAttribute('.escrevente a', 'href'), 'https://wa.me/5511954929643'); assert(/\(11\) 95492-9643/.test(topo));
});
await passo('casado, em qualquer ato, abre o regime de bens (divórcio e união também)', async () => {
  for (const [tipo, papel, bloco] of [['Divórcio', 'div1', 'divorciandos'], ['União Estável', 'conv1', 'conviventes']]) {
    const {pg} = await abrir({tipo, publico: 'cliente', papel}); await pg.waitForSelector(`[data-b="${bloco}"]`);
    await pg.selectOption('[data-b][data-f="ec"]', 'Casado(a)'); assert.equal(await pg.locator('input[data-b][data-f="regime"]').count(), 3, tipo);
  }
});
await passo('preenchimento do celular: campos com autocomplete certo, e o CEP troca só o endereço (não mexe no campo em que a pessoa está)', async () => {
  const {pg} = await abrir(compra); await pg.waitForSelector('[data-b="partes"]');
  const at = async (f) => pg.getAttribute(`[data-b][data-f="${f}"]`, 'autocomplete');
  assert.equal(await at('nome'), 'name'); assert.equal(await at('cep'), 'postal-code'); assert.equal(await at('rua'), 'address-line1'); assert.equal(await at('cidade'), 'address-level2');
  await pg.fill('[data-f="cep"]', '01452000'); await pg.focus('[data-f="prof"]'); await pg.keyboard.type('Prof');
  await pg.waitForSelector('[data-editend]');
  assert.equal(await pg.evaluate(() => document.activeElement.dataset.f), 'prof', 'o foco continua onde a pessoa estava'); assert.equal(await pg.inputValue('[data-f="prof"]'), 'Prof');
});
await passo('inventário: o falecido pergunta o estado civil na data do óbito e só então pede a certidão certa', async () => {
  const {pg} = await abrir({tipo: 'Inventário', publico: 'advogado', bens: {urbano: true}}, {viewport: {width: 1100, height: 900}, mobile: false});
  await pg.waitForSelector('[data-fal]'); let t = await pg.textContent('#formulario');
  assert(/Estado civil na data do óbito/.test(t) && !/Escritura do pacto/.test(t) && !/Certidão de casamento/.test(t) && /Certidão de estado civil/.test(t), 'antes de escolher, nada de casamento ou pacto');
  const ec = (v) => pg.selectOption('[data-fal][data-f="ec"]', v);
  await ec('Casado(a)'); assert.equal(await pg.locator('input[data-fal][data-f="regime"]').count(), 3); t = await pg.textContent('#formulario');
  assert(/Dados do cônjuge/.test(t) && /Certidão de casamento/.test(t) && /RG ou CNH do cônjuge/.test(t) && !/Escritura do pacto/.test(t), 'casado: cônjuge e casamento; pacto só com regime que exige');
  await pg.check('input[data-fal][data-f="regime"][value="Separação total de bens"]', {force: true}); t = await pg.textContent('#formulario');
  assert(/Escritura do pacto/.test(t) && /registro do pacto/.test(t), 'separação total pede o pacto e o registro');
  await pg.fill('[data-fal][data-fc="nome"]', 'Viúva Silva');
  await ec('Viúvo(a)'); t = await pg.textContent('#formulario'); assert(/averbação do óbito/.test(t) && !/Escritura do pacto/.test(t) && !/RG ou CNH do cônjuge/.test(t) && !/Dados do cônjuge/.test(t));
  await ec('Divorciado(a)'); assert(/averbação do divórcio/.test(await pg.textContent('#formulario')));
  await ec('Solteiro(a)'); t = await pg.textContent('#formulario'); assert(/Certidão de nascimento/.test(t) && !/Certidão de casamento/.test(t));
  assert(/Certidão de óbito/.test(t), 'a certidão de óbito vale para qualquer estado civil');
});

await passo('advogado: só sobe a carteira da OAB, sem número, nome nem endereço para digitar', async () => {
  const {pg} = await abrir({tipo: 'Inventário', publico: 'advogado', bens: {urbano: true}}, {viewport: {width: 1100, height: 900}, mobile: false});
  await pg.waitForSelector('[data-fal]'); assert.equal(await pg.locator('[data-adv]').count(), 0, 'nenhum campo de advogado');
  assert(/Carteira da OAB/.test(await pg.textContent('[data-bloco="advogado"]')), 'a carteira está no cartão do advogado');
  assert(!/Número da OAB/.test(await pg.textContent('#formulario')));
});
await passo('advogado (inventário e divórcio) e procuração: casado(a) NÃO abre regime de bens nem dados do cônjuge; as partes do ato continuam abrindo', async () => {
  const semConj = (pg, bloco) => pg.evaluate((id) => { const b = document.querySelector(`[data-bloco="${id}"]`); return {regime: b.querySelectorAll('input[data-f="regime"]').length, conj: b.querySelectorAll('[data-c="nome"]').length}; }, bloco);
  const grande = {viewport: {width: 1100, height: 900}, mobile: false};
  for (const [est, adv] of [[{tipo: 'Inventário', publico: 'advogado', bens: {urbano: true}}, 'advogado'], [{tipo: 'Divórcio', publico: 'advogado'}, 'advogado']]) {
    const {pg} = await abrir(est, grande); await pg.waitForSelector(`[data-bloco="${adv}"]`);
    await pg.selectOption(`[data-bloco="${adv}"] [data-f="ec"]`, 'Casado(a)');
    assert.deepEqual(await semConj(pg, adv), {regime: 0, conj: 0}, est.tipo + ': o advogado casado não pede regime nem cônjuge');
  }
  const inv = await abrir({tipo: 'Inventário', publico: 'advogado', bens: {urbano: true}}, grande); await pg_espera(inv.pg, 'herdeiros');
  await inv.pg.selectOption('[data-bloco="herdeiros"] [data-f="ec"]', 'Casado(a)');
  const h = await semConj(inv.pg, 'herdeiros'); assert(h.regime === 3 && h.conj === 1, 'o herdeiro (parte) continua pedindo regime e cônjuge: ' + JSON.stringify(h));
  for (const papel of ['outorgante', 'procurador', 'ambos']) {
    const {pg} = await abrir({tipo: 'Procuração', publico: 'cliente', papel}, grande); await pg.waitForSelector('[data-bloco]');
    for (const id of await pg.evaluate(() => [...document.querySelectorAll('[data-bloco]')].map((b) => b.dataset.bloco))) {
      const ec = pg.locator(`[data-bloco="${id}"] [data-f="ec"]`);
      if (await ec.count()) await ec.selectOption('Casado(a)');
      assert.deepEqual(await semConj(pg, id), {regime: 0, conj: 0}, 'procuração (' + papel + '/' + id + '): sem regime nem cônjuge');
    }
  }
});
await passo('união estável: quem não é casado marca "Vivo em união estável" e o espaço da escritura abre só nos documentos dele', async () => {
  const {pg} = await abrir({tipo: 'Escritura de Compra e Venda', publico: 'advogado'}, {viewport: {width: 1100, height: 900}, mobile: false});
  await pg.waitForSelector('[data-b="partes"]'); assert(!/união estável/i.test(await pg.textContent('#formulario')), 'sem escolher, nada de união estável');
  const ec = (i, v) => pg.locator(`select[data-b="partes"][data-i="${i}"][data-f="ec"]`).selectOption(v);
  await ec(0, 'Solteiro(a)'); await ec(1, 'Casado(a)');
  assert.equal(await pg.locator('[data-uniao]').count(), 1, 'a pergunta só aparece para quem não é casado');
  await pg.check('[data-uniao]', {force: true});
  const onde = await pg.evaluate(() => [...document.querySelectorAll('[data-bloco="partes"]')].map((b) => /união estável/i.test([...b.querySelectorAll('.slot b')].map((x) => x.textContent).join('|'))));
  assert.deepEqual(onde, [true, false], 'a escritura abre no cartão de quem marcou (o vendedor) e não no do comprador');
  await clicarEnviar(pg); assert(/escritura de união estável/.test(await pg.innerText('.folha')), 'e passa a faltar até anexar');
});
await passo('pacto: abre só para quem é casado em regime que exige pacto, na pílula dele', async () => {
  const {pg} = await abrir({tipo: 'Escritura de Compra e Venda', publico: 'advogado'}, {viewport: {width: 1100, height: 900}, mobile: false});
  await pg.waitForSelector('[data-b="partes"]'); assert(!/pacto/i.test(await pg.textContent('#formulario')));
  await pg.locator('select[data-b="partes"][data-i="1"][data-f="ec"]').selectOption('Casado(a)');
  await pg.check('input[data-i="1"][data-f="regime"][value="Comunhão parcial de bens"]', {force: true}); assert(!/pacto/i.test(await pg.textContent('#formulario')));
  await pg.check('input[data-i="1"][data-f="regime"][value="Comunhão universal de bens"]', {force: true});
  const t = await pg.textContent('#formulario'); assert(/Escritura do pacto/.test(t) && /registro do pacto/.test(t));
  assert((t.match(/Escritura do pacto antenupcial/g) || []).length === 1, 'só uma vez, na pessoa que escolheu');
});

let tela;
await passo('preencher e enviar: cada arquivo chega com o papel e o tipo, e os dados vão por último', async () => {
  const {pg, chamadas} = await abrir(compra); tela = pg; await pg.waitForSelector('[data-b="partes"]');
  await preencher(pg);
  await pg.fill('#obs', 'Quero constar o nome de solteira.');
  await pg.waitForFunction(() => /Tudo preenchido|anexado/.test(document.querySelector('#resumo').textContent));
  await pg.screenshot({path: SAIDA('env-cel-cheio.png'), fullPage: true});
  await clicarEnviar(pg); await pg.click('[data-ok]'); await pg.waitForSelector('body.concluido');
  const arqs = chamadas.filter((c) => c.acao === 'cliente-arquivo'), dados = chamadas.find((c) => c.acao === 'cliente-dados');
  assert.equal(arqs.length, 2); assert(chamadas.indexOf(dados) === chamadas.length - 1, 'os dados vão depois dos arquivos');
  const rg = arqs.find((a) => a.tipo === 'RG_CNH'); assert(rg && rg.papel === 'Comprador(a)' && rg.pessoa === 'Maria da Silva' && rg.t === TOKEN);
  assert(rg.mimetype === 'image/jpeg' && Buffer.from(rg.base64, 'base64').length < 600000, 'a foto foi reduzida antes de sair');
  assert.equal(dados.dados.pessoas[0].nome, 'Maria da Silva'); assert.equal(dados.dados.pessoas[0].estadoCivil, 'Solteiro(a)');
  assert(/Rua das Palmeiras, 210/.test(dados.dados.pessoas[0].endereco));
  const pag = dados.dados.campos.pagamento; assert.equal(pag.valor, '450.000,00'); assert.equal(pag.sinal, 'Sim'); assert.equal(pag.sinalValor, '45.000,00'); assert.equal(pag.restante, '405.000,00'); assert.equal(pag.forma, 'PIX');
  assert.equal(dados.dados.banco['pagamento.pagador'].banco, 'Banco do Brasil'); assert(!dados.dados.banco['pagamento.recebedor'], 'o comprador não informa a conta que recebe');
  assert.equal(dados.dados.observacoes, 'Quero constar o nome de solteira.');
  await pg.screenshot({path: SAIDA('env-cel-final.png')});
});

await passo('se o cartório recusa um arquivo, ele fica marcado e os dados NÃO são enviados como se estivesse tudo certo', async () => {
  const {pg, chamadas} = await abrir(compra, {gas: (c) => c.acao === 'cliente-arquivo' ? {ok: false, erro: 'não deu'} : {ok: true}});
  await pg.waitForSelector('[data-b="partes"]'); await preencher(pg);
  await pg.waitForFunction(() => document.querySelectorAll('.arq small.erro').length === 2);
  await clicarEnviar(pg); assert(/Ainda falta/.test(await pg.innerText('.folha')), 'o botão não deixa enviar com arquivo que falhou');
  assert(!chamadas.some((c) => c.acao === 'cliente-dados'), 'dados não podem ir se um arquivo falhou');
  assert(await pg.isHidden('#final'));
});

await passo('o advogado manda vários herdeiros: acrescentar e remover pessoa', async () => {
  const {pg} = await abrir({tipo: 'Inventário', publico: 'advogado', bens: {urbano: true}}, {viewport: {width: 1100, height: 900}, mobile: false});
  await pg.waitForSelector('[data-b="herdeiros"]');
  await pg.click('[data-mais="herdeiros"]'); assert.equal(await pg.locator('[data-b="herdeiros"][data-f="nome"]').count(), 2);
  await pg.click('[data-remover]'); assert.equal(await pg.locator('[data-b="herdeiros"][data-f="nome"]').count(), 1);
  const t = await pg.textContent('#formulario'); assert(/Falecido/.test(t) && /Carteira da OAB/.test(t) && !/Número da OAB/.test(t) && /Matrícula do imóvel urbano/.test(t));
  await pg.screenshot({path: SAIDA('env-desk-inventario.png'), fullPage: true});
});

await b.close(); servidor.close();
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
