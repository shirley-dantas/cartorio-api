// A página de pagamento do cliente (pagar.html), com o banco e o Apps Script fingidos: o caminho do dedo
// (conferir os valores, ver o recibo e o boleto, pagar, anexar o comprovante) até o que chega ao cartório.
//   node testes/pagar-tela.mjs        (imagens em testes/saida)
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {servir} from './servidor.mjs';
import {writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import assert from 'node:assert/strict';
const AQUI = dirname(fileURLToPath(import.meta.url));
const SAIDA = (n) => join(AQUI, 'saida', n);
mkdirSync(join(AQUI, 'saida'), {recursive: true});
const erros = [];
const passo = async (n, f) => { try { await f(); console.log('  ok  ' + n); } catch (e) { erros.push(n); console.log('FALHA ' + n + ' → ' + e.message); } };
const TOKEN = 'pG3dE6gH9jK2mN5pQ8sT1vX4';
const servidor = await servir(8199);
const b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const PNG = SAIDA('comprovante.png'); const PDF = SAIDA('comprovante.pdf');
{ const t = await b.newPage(); const base = await t.evaluate(() => { const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; const x = c.getContext('2d'); x.fillStyle = '#eee'; x.fillRect(0, 0, 3000, 2000); x.fillStyle = '#222'; x.font = '90px sans-serif'; x.fillText('COMPROVANTE PIX', 200, 400); return c.toDataURL('image/png').split(',')[1]; }); await t.close(); writeFileSync(PNG, Buffer.from(base, 'base64')); writeFileSync(PDF, '%PDF-1.4\n%%EOF'); }
const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const cobranca = ({itens = {escritura: true, registro: true}, orcamento = true, boletoPdf = true, comprovantes, concluidoEm, expiraEm} = {}) => ({
  meta: {casoId: '-Caso1', criadoEm: Date.now(), expiraEm: expiraEm || Date.now() + 864e5, itens, ...(concluidoEm ? {concluidoEm} : {}), ...(comprovantes ? {comprovantes} : {})},
  dados: {nome: 'Larissa Victoria', ato: 'Escritura de Compra e Venda', escritura: {valorCent: 303989}, registro: {valorCent: 386807, venc: '23/10/2026', codigo: '26091.90299 37227.373505 99600.000006 2 16080000386807', beneficiario: 'Prime Assessoria Jurídica e Imobiliária', cnpj: '47.141.731/0001-10'}},
  imagens: {recibo: IMG, boleto: IMG, ...(boletoPdf ? {boletoPdf: 'data:application/pdf;base64,JVBERi0x'} : {}), ...(orcamento ? {orcamento: IMG} : {})}
});
const erro = [];
async function abrir(opc = {}, {mobile = true, gas, codigo = TOKEN} = {}) {
  const pg = await b.newPage({viewport: mobile ? {width: 390, height: 844} : {width: 1100, height: 900}, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile});
  const chamadas = [];
  await pg.route('**/*', async (rota) => {
    const u = rota.request().url();
    if (u.includes('firebaseio.com/cobrancas/')) return rota.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(opc === null ? null : cobranca(opc))});
    if (u.includes('script.google.com')) { const corpo = JSON.parse(rota.request().postData()); chamadas.push(corpo); const r = gas ? gas(corpo) : {ok: true}; return rota.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(r)}); }
    if (u.startsWith('http://127.0.0.1')) return rota.continue();
    return rota.abort();
  });
  pg.on('pageerror', (e) => erro.push('pageerror: ' + e.message));
  pg.on('dialog', (d) => d.accept());
  await pg.goto(`http://127.0.0.1:8199/pagar.html?t=${codigo}`);
  await pg.waitForFunction(() => document.querySelector('#tela .cartao') || document.body.classList.contains('invalido'), null, {timeout: 6000}).catch(() => {});
  return {pg, chamadas};
}
const anexar = async (pg, arq = PNG) => { await pg.locator('input[data-anexo]').last().setInputFiles(arq); };
const noMeio = (pg, re) => pg.waitForFunction((s) => new RegExp(s, 'i').test(document.querySelector('#tela').innerText), re.source, {timeout: 6000});

await passo('sem código, link vencido ou já usado: a página diz que o link não serve e não mostra pagamento', async () => {
  const sem = await abrir(undefined, {codigo: 'curto'}); assert(await sem.pg.evaluate(() => document.body.classList.contains('invalido')));
  const v = await abrir({expiraEm: Date.now() - 1000}); assert(/venceu/.test(await v.pg.textContent('#motivo')));
  const u = await abrir({concluidoEm: Date.now()}); assert(/já foi usado/.test(await u.pg.textContent('#motivo')) && await u.pg.isHidden('#tela .cartao'));
  const nada = await abrir(null); assert(await nada.pg.evaluate(() => document.body.classList.contains('invalido')), 'cobrança que não existe');
});

await passo('a tela única: os dois valores, o Pix e o código de barras, o recibo e o boleto, o orçamento só se existir, e tudo o que ela tirou fora', async () => {
  const {pg} = await abrir(); const t = await pg.innerText('#tela');
  assert(/R\$ 3\.039,89/.test(t) && /R\$ 3\.868,07/.test(t) && /45\.566\.502\/0001-12/.test(t) && /26091\.90299/.test(t), t);
  assert(await pg.locator('.cartao').count() === 3, 'dois pagamentos e o espaço dos comprovantes, cada um no seu cartão');
  assert(!/Olá, Larissa/i.test(t) && !/Confira os valores/.test(t) && !/Aviso de segurança/.test(t) && !/CONFERÊNCIA/.test(t) && !/Começar pelo/.test(t) && !/Compra e Venda/.test(t) && !/ANEXE AQUI O SEU/i.test(t) && !/Favorecido/i.test(t) && !/Beneficiário/.test(t), 'o que ela tirou');
  assert(/reveja seu orçamento aqui/.test(t), 'o botão do orçamento');
  assert(/Prefere pagar por TED/.test(t) && await pg.locator('details.c-ted').count() === 1 && !(await pg.locator('details.c-ted').evaluate((d) => d.open)), 'o TED fica recolhido');
  await pg.click('details.c-ted summary'); const t2 = await pg.innerText('.c-ted'); assert(/422032-3/.test(t2) && /72195-7/.test(t2), 'aberto, mostra os dois bancos');
  await pg.click('[data-vis="recibo"]'); assert(/Recibo da escritura/.test(await pg.innerText('#vis')) && await pg.locator('#vis img').count() === 1);
  await pg.click('#vis [data-fechar]'); await pg.click('[data-vis="boleto"]'); assert(/Boleto do registro/.test(await pg.innerText('#vis')));
  await pg.click('#vis [data-fechar]'); await pg.click('[data-vis="orc"]'); assert(await pg.locator('#vis img').count() === 1);
  await pg.screenshot({path: SAIDA('pag-celular-1.png'), fullPage: true});
  const sem = await abrir({orcamento: false}); assert(!/reveja seu orçamento/.test(await sem.pg.innerText('#tela')), 'sem orçamento, sem botão');
});

await passo('o fluxo inteiro: sem os dois comprovantes o botão fica apagado e diz o que falta; com eles liga, e ao enviar o link fecha', async () => {
  const {pg, chamadas} = await abrir();
  const btn = pg.locator('[data-enviar]');
  assert(await btn.isDisabled() && /Faltam 2 comprovantes/.test(await btn.innerText()));
  await anexar(pg); await pg.waitForFunction(() => /Falta 1 comprovante/.test(document.querySelector('[data-enviar]').innerText)); assert(await btn.isDisabled(), 'com um só ainda falta um');
  await anexar(pg); await pg.waitForFunction(() => /Tudo certo/.test(document.querySelector('[data-enviar]').innerText)); assert(!(await btn.isDisabled()));
  const subidas = chamadas.filter((c) => c.acao === 'pagamento-arquivo'); await pg.waitForFunction(() => document.querySelectorAll('.chip-arq.ok').length === 2);
  assert.equal(subidas.length, 2); assert(subidas.every((c) => /^c[a-z0-9]{4,16}$/.test(c.qual) && c.t === TOKEN && c.mimetype === 'image/jpeg' && c.base64.length > 100)); assert.notEqual(subidas[0].qual, subidas[1].qual, 'cada arquivo com o seu código');
  await btn.click(); await noMeio(pg, /Pagamentos recebidos/);
  const f = await pg.innerText('#tela'); assert(/Escritura: R\$ 3\.039,89/.test(f) && /Registro de imóveis: R\$ 3\.868,07/.test(f) && /Comprovantes recebidos com sucesso/.test(f) && /Agradecemos a parceria e a confiança\. Conte sempre conosco\./.test(f));
  assert(chamadas.some((c) => c.acao === 'pagamento-concluir' && c.t === TOKEN));
  await pg.screenshot({path: SAIDA('pag-celular-fim.png'), fullPage: true});
});

await passo('link só da escritura ou só do registro: um cartão, um comprovante basta', async () => {
  const e = await abrir({itens: {escritura: true}}); const t = await e.pg.innerText('#tela');
  assert(/R\$ 3\.039,89/.test(t) && !/R\$ 3\.868,07/.test(t) && !/26091/.test(t) && await e.pg.locator('.cartao').count() === 2);
  assert(/Falta 1 comprovante/.test(await e.pg.locator('[data-enviar]').innerText()));
  await anexar(e.pg); await e.pg.waitForFunction(() => /Tudo certo/.test(document.querySelector('[data-enviar]').innerText));
  await e.pg.click('[data-enviar]'); await noMeio(e.pg, /Pagamentos recebidos/); const f = await e.pg.innerText('#tela'); assert(/Escritura:/.test(f) && !/Registro de imóveis:/.test(f));
  const r = await abrir({itens: {registro: true}}); const tr = await r.pg.innerText('#tela'); assert(/R\$ 3\.868,07/.test(tr) && !/R\$ 3\.039,89/.test(tr) && !/45\.566/.test(tr));
});

await passo('mais comprovantes do que pagamentos: dá para juntar quantos precisar, e tirar o que anexou errado', async () => {
  const {pg, chamadas} = await abrir({itens: {escritura: true}});
  await anexar(pg, [PNG, PNG, PNG]); await pg.waitForFunction(() => document.querySelectorAll('.chip-arq.ok').length === 3);
  assert(/Adicionar outro/.test(await pg.innerText('.anexos')));
  const id = await pg.locator('.chip-arq .rm').nth(1).getAttribute('data-rm');
  await pg.locator('.chip-arq .rm').nth(1).click(); await pg.waitForFunction(() => document.querySelectorAll('.chip-arq').length === 2);
  const rem = chamadas.find((c) => c.acao === 'pagamento-remover'); assert(rem && rem.t === TOKEN && rem.qual === id, 'o cartório é avisado para tirar do Drive');
  assert(!(await pg.locator('[data-enviar]').isDisabled()), 'ainda sobram comprovantes suficientes');
});

await passo('tirar o único comprovante apaga o botão de novo; se o cartório não consegue tirar, o aviso aparece e o arquivo fica', async () => {
  const a = await abrir({itens: {escritura: true}}); await anexar(a.pg); await a.pg.waitForFunction(() => document.querySelectorAll('.chip-arq.ok').length === 1);
  await a.pg.locator('.chip-arq .rm').click(); await a.pg.waitForFunction(() => document.querySelectorAll('.chip-arq').length === 0);
  assert(await a.pg.locator('[data-enviar]').isDisabled());
  const b2 = await abrir({itens: {escritura: true}}, {gas: (c) => (c.acao === 'pagamento-remover' ? {ok: false, erro: 'O banco recusou a remoção (401).'} : {ok: true})});
  await anexar(b2.pg); await b2.pg.waitForFunction(() => document.querySelectorAll('.chip-arq.ok').length === 1);
  await b2.pg.locator('.chip-arq .rm').click(); await b2.pg.waitForFunction(() => /recusou a remoção/.test(document.body.innerText));
  assert.equal(await b2.pg.locator('.chip-arq').count(), 1, 'o arquivo continua na lista, marcado com erro');
});

await passo('comprovante que não subiu: o aviso aparece escrito, o botão continua apagado e dá para anexar de novo', async () => {
  let falha = true;
  const {pg} = await abrir({itens: {escritura: true}}, {gas: (c) => (c.acao === 'pagamento-arquivo' && falha ? {ok: false, erro: 'não deu'} : {ok: true})});
  await anexar(pg); await noMeio(pg, /Não enviou/);
  const av = await pg.innerText('#tela'); assert(/não deu/.test(av) && !/internet/i.test(av), 'o erro do cartório é dito com as palavras dele');
  assert(await pg.locator('[data-enviar]').isDisabled());
  falha = false; await anexar(pg); await pg.waitForFunction(() => /Tudo certo/.test(document.querySelector('[data-enviar]').innerText)); assert(!(await pg.locator('[data-enviar]').isDisabled()));
});

await passo('o comprovante aparece anexado na hora (o envio segue em segundo plano) e o Enviar espera o envio terminar', async () => {
  const {pg, chamadas} = await abrir({itens: {escritura: true}});
  let solta; const espera = new Promise((r) => { solta = r; });
  await pg.route('https://script.google.com/**', async (rota) => { const c = JSON.parse(rota.request().postData()); chamadas.push(c); if (c.acao === 'pagamento-arquivo') await espera; rota.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({ok: true})}); });
  await anexar(pg); await pg.waitForFunction(() => /Tudo certo/.test(document.querySelector('[data-enviar]').innerText));
  await pg.click('[data-enviar]'); await pg.waitForTimeout(400);
  assert(!chamadas.some((c) => c.acao === 'pagamento-concluir'), 'não conclui com o envio ainda correndo');
  solta(); await pg.waitForFunction(() => /Pagamentos recebidos/i.test(document.body.innerText), null, {timeout: 6000});
  assert(chamadas.some((c) => c.acao === 'pagamento-concluir'));
});

await passo('o envio em segundo plano falha: o link não fecha e o motivo aparece', async () => {
  const {pg, chamadas} = await abrir({itens: {escritura: true}}, {gas: (c) => (c.acao === 'pagamento-arquivo' ? {ok: false, erro: 'O banco recusou o registro (401).'} : {ok: true})});
  await anexar(pg); await noMeio(pg, /banco recusou/);
  assert(!chamadas.some((c) => c.acao === 'pagamento-concluir')); assert(await pg.locator('[data-enviar]').isDisabled());
});

await passo('sem rede de verdade: tenta de novo sozinho uma vez e só então fala em internet', async () => {
  const {pg} = await abrir({itens: {escritura: true}});
  let n = 0; await pg.route('https://script.google.com/**', (r) => { n++; r.abort('failed'); });
  await anexar(pg); await noMeio(pg, /Não enviou/);
  assert(/internet/i.test(await pg.innerText('#tela')), 'falha de rede fala em internet'); assert.equal(n, 2, 'uma tentativa a mais antes de desistir');
});

await passo('enviar que o cartório recusa: o erro aparece e o link não fecha', async () => {
  const {pg} = await abrir({itens: {escritura: true}}, {gas: (c) => (c.acao === 'pagamento-concluir' ? {ok: false, erro: 'Faltam comprovantes'} : {ok: true})});
  let msg = ''; pg.removeAllListeners('dialog'); pg.on('dialog', (d) => { msg = d.message(); d.accept(); });
  await anexar(pg); await pg.waitForFunction(() => /Tudo certo/.test(document.querySelector('[data-enviar]').innerText));
  await pg.click('[data-enviar]'); await pg.waitForFunction(() => !!document.querySelector('[data-enviar]') && !/Enviando/.test(document.querySelector('[data-enviar]').innerText));
  assert(/Faltam comprovantes/.test(msg)); assert(!/Pagamentos recebidos/.test(await pg.innerText('#tela')), 'o link não fechou');
});

await passo('abrir de novo: os comprovantes que já subiram continuam anexados, com ×', async () => {
  const {pg} = await abrir({itens: {escritura: true}, comprovantes: {c1abcd: {docKey: 'pag_x', nome: 'meu-pix.jpg', em: 1}}});
  assert(/meu-pix\.jpg/.test(await pg.innerText('.anexos')) && await pg.locator('.chip-arq .rm').count() === 1 && !(await pg.locator('[data-enviar]').isDisabled()));
});

await passo('vários recibos: ver o recibo mostra todos, legendados "Recibo 1 de 2"; com um só, sem legenda', async () => {
  for (const [lista, esperaCap, n] of [[true, true, 2], [false, false, 1]]) {
    const {pg} = await abrir({});
    await pg.route('https://painel-cartorio-default-rtdb.firebaseio.com/cobrancas/**', (r) => { const c = cobranca({}); if (lista) c.imagens.recibos = [IMG, IMG]; r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(c)}); });
    await pg.reload(); await pg.waitForSelector('#tela .cartao');
    await pg.click('[data-vis="recibo"]'); await pg.waitForSelector('#vis:not([hidden]) img');
    assert.equal(await pg.locator('#vis img').count(), n); assert.equal(await pg.locator('#vis .cap').count() > 0, esperaCap);
    if (esperaCap) assert(/Recibo 1 de 2/.test(await pg.innerText('#vis')) && /Recibo 2 de 2/.test(await pg.innerText('#vis')));
  }
});

await passo('dá para baixar o recibo e o boleto: um botão com o nome certo, e um por arquivo quando são vários', async () => {
  const {pg} = await abrir({});
  await pg.click('[data-vis="recibo"]'); const r = pg.locator('#vis .tt a[download]');
  assert.equal(await r.count(), 1); assert(/Baixar recibo/.test(await r.innerText())); assert.equal(await r.getAttribute('download'), 'recibo.jpg'); assert(/^data:image\//.test(await r.getAttribute('href')));
  await pg.click('#vis [data-fechar]'); await pg.click('[data-vis="boleto"]');
  assert(/Baixar PDF/.test(await pg.innerText('#vis .tt')) && (await pg.locator('#vis .tt a[download]').getAttribute('download')) === 'boleto.pdf', 'o boleto com PDF continua baixando o PDF');
  const sem = await abrir({boletoPdf: false}); await sem.pg.click('[data-vis="boleto"]');
  assert(/Baixar boleto/.test(await sem.pg.innerText('#vis .tt')) && (await sem.pg.locator('#vis .tt a[download]').getAttribute('download')) === 'boleto.jpg', 'sem PDF, baixa a imagem');
  const v = await abrir({}); await v.pg.route('https://painel-cartorio-default-rtdb.firebaseio.com/cobrancas/**', (rota) => { const c = cobranca({}); c.imagens.recibos = [IMG, IMG]; rota.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(c)}); });
  await v.pg.reload(); await v.pg.waitForSelector('#tela .cartao'); await v.pg.click('[data-vis="recibo"]');
  assert.equal(await v.pg.locator('#vis .cap a[download]').count(), 2); assert.equal(await v.pg.locator('#vis .tt a[download]').count(), 0, 'com vários, o botão fica em cada um');
  assert.deepEqual(await v.pg.locator('#vis .cap a[download]').evaluateAll((l) => l.map((a) => a.getAttribute('download'))), ['recibo-1.jpg', 'recibo-2.jpg']);
});

await passo('Pix copia e cola, sem nada a mais na tela: o Copiar da chave leva a chave E o valor (CRC conferido)', async () => {
  const {pg} = await abrir();
  assert.equal(await pg.locator('.c-pix, .c-dica').count(), 0, 'nenhum botão ou aviso a mais');
  const btn = pg.locator('.c-bloco [data-copy]').first(); const rot = await pg.locator('.c-bloco').first().innerText(); assert(/45\.566\.502\/0001-12/.test(rot) && /Pix Copia e Cola/.test(rot) && !/Chave Pix/.test(rot), 'o rótulo diz Pix Copia e Cola (o que ela esqueceu uma vez) e a chave continua visível');
  const code = await btn.getAttribute('data-copy');
  const tlv = (str) => { const o = {}; let i = 0; while (i < str.length) { const id = str.slice(i, i + 2), n = +str.slice(i + 2, i + 4); o[id] = str.slice(i + 4, i + 4 + n); i += 4 + n; } return o; };
  const crc = (str) => { let c = 0xFFFF; for (const ch of str) { c ^= ch.charCodeAt(0) << 8; for (let k = 0; k < 8; k++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, '0'); };
  assert.equal(crc('123456789'), '29B1'); assert.equal(code.slice(-4), crc(code.slice(0, -4)), 'o CRC fecha');
  const t = tlv(code); const conta = tlv(t['26']);
  assert.equal(t['00'], '01'); assert.equal(t['01'], '11'); assert.equal(conta['00'], 'br.gov.bcb.pix'); assert.equal(conta['01'], '45566502000112', 'a chave do 20º Tabelião');
  assert.equal(t['54'], '3039.89', 'o valor da escritura'); assert.equal(t['53'], '986'); assert.equal(t['58'], 'BR'); assert.equal(t['59'], '20 TABELIAO DE NOTAS'); assert.equal(t['60'], 'SAO PAULO');
  assert(!/[^\x20-\x7E]/.test(code), 'só ASCII');
  await btn.click(); assert(/Copiado!/.test(await btn.textContent()));
});

await passo('copiar: a chave Pix e o código de barras vão para a área de transferência e o botão confirma', async () => {
  const {pg} = await abrir(); const btn = pg.locator('.c-bloco [data-copy]').first(); assert(/^000201010211/.test(await btn.getAttribute('data-copy')), 'o Copiar do Pix leva o copia e cola');
  await btn.click(); assert(/Copiado!/.test(await btn.textContent()));
  assert.equal(await pg.locator('.c-bloco [data-copy]').nth(1).getAttribute('data-copy'), '26091902993722737350599600000006216080000386807', 'o código vai só com os 47 dígitos, que todo banco aceita');
  assert(/26091\.90299 37227\.373505/.test(await pg.locator('.c-bloco').nth(1).innerText()), 'na tela continua legível, com pontos e espaços');
});

await passo('no celular nada rola de lado, e no computador também cabe', async () => {
  const {pg} = await abrir(); assert((await pg.evaluate(() => document.documentElement.scrollWidth)) <= 391, 'celular');
  const d = await abrir({}, {mobile: false}); assert((await d.pg.evaluate(() => document.documentElement.scrollWidth)) <= 1101);
  await d.pg.screenshot({path: SAIDA('pag-desk.png'), fullPage: true});
});

await passo('nenhum erro de script em nenhuma tela', () => { assert.deepEqual(erro, []); });

await b.close(); servidor.close();
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
