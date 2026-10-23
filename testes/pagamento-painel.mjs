// O lado do painel do pagamento: a janela de gerar o link (o que ela grava no banco), a faixa e o aviso do card,
// e a folha de impressão do comprovante. O trecho vem do index.html publicado, com o banco e o Drive fingidos.
//   node testes/pagamento-painel.mjs
import {abrirChromium} from './navegador-de-teste.mjs';
import {servir} from './servidor.mjs';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import assert from 'node:assert/strict';
const AQUI = dirname(fileURLToPath(import.meta.url));
const erros = [];
const passo = async (n, f) => { try { await f(); console.log('  ok  ' + n); } catch (e) { erros.push(n); console.log('FALHA ' + n + ' → ' + e.message); } };
const html = readFileSync(join(AQUI, '..', 'index.html'), 'utf8');
const ini = html.indexOf('const PAG_BENEFICIARIO'), fim = html.indexOf('// Pedir documentos: a lista do que pedir');
assert(ini > 0 && fim > ini, 'o trecho do pagamento não está no index.html');
const css = html.slice(html.indexOf('.pag-cola{'), html.indexOf('.cx-ped-rec{flex-basis:100%'));
writeFileSync(join(AQUI, 'harness-pagamento.html'), `<!doctype html><html><head><meta charset="utf-8"><style>.modal-overlay{display:none}.modal-overlay.open{display:block}${css}</style></head><body>
<div class="modal-overlay" id="modal-pagamento"><div id="pag-sub"></div><div id="pag-conteudo"></div></div><div id="cc-pagamentos"></div>
<script>
const esc=s=>(s||'').replace(/"/g,'&quot;'), escTxt=x=>String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const ENVIO_BASE_URL='https://painel.exemplo', GAS_URL='https://script.google.com/x', db={};
let casos={'-Caso1':{id:'-Caso1',nome:'Maria da Silva',tipo:'Escritura de Compra e Venda',controle:'43804'}};
window.__grav=[]; window.__orc=[];
const ref=(_,c)=>c;
const set=async(c,v)=>{ if(window.__recusar) throw new Error('PERMISSION_DENIED'); window.__grav.push(['set',c,JSON.parse(JSON.stringify(v))]); };
const update=async(c,v)=>{ if(window.__recusar) throw new Error('PERMISSION_DENIED'); window.__grav.push(['update',c,JSON.parse(JSON.stringify(v))]); return Promise.resolve(); };
const codigoDeEnvio=()=>'TOKENFIXOabcdefghij1234', finToast=m=>{window.__toast=m;};
const orcDoCaso=()=>window.__orc; const orcDesenharFolha=()=>{const c=document.createElement('canvas');c.width=800;c.height=1200;return c;};
function orcSemUndefined(v){return JSON.parse(JSON.stringify(v,(k,x)=>x===undefined?null:x));}
window.irParaCasoPorId=id=>{window.__foi=id;};
${html.slice(ini, fim)}
window.__casos=()=>casos; window.__setCasos=c=>{casos=c;};
</script></body></html>`);
const servidor = await servir(8199);
const b = await abrirChromium();
const abrir = async () => { const pg = await b.newPage({viewport: {width: 900, height: 900}}); pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message)); pg.on('dialog', (d) => d.accept()); await pg.goto('http://127.0.0.1:8199/harness-pagamento.html'); return pg; };
const LINHA = '26091.90299 37227.373505 99600.000006 2 16080000386807';
const IMG = join(AQUI, 'saida', 'comprovante.png');
{ const t = await b.newPage(); const base = await t.evaluate(() => { const c = document.createElement('canvas'); c.width = 2000; c.height = 1400; c.getContext('2d').fillRect(0, 0, 2000, 1400); return c.toDataURL('image/png').split(',')[1]; }); await t.close(); writeFileSync(IMG, Buffer.from(base, 'base64')); }
const PDF = join(AQUI, 'saida', 'comprovante.pdf');

await passo('"2.000" é dois mil, nunca dois reais: o dinheiro que ela digita vira centavos certos', async () => {
  const pg = await abrir();
  const r = await pg.evaluate(() => ['2.000', '2000', '3.039,89', '3039.89', 'R$ 3.868,07', '1.234.567,80', '', 'abc', '0'].map(pagCentavos));
  assert.deepEqual(r, [200000, 200000, 303989, 303989, 386807, 123456780, 0, 0, 0]);
  assert.deepEqual(await pg.evaluate(() => ['23/10/2026', '31/02/2026', '2026-10-23', '', '5/1/2026'].map(pagVencOk)), [true, false, false, false, false]);
});

await passo('a janela abre com os três jeitos de enviar, e só pede o que o jeito escolhido precisa', async () => {
  const pg = await abrir(); await pg.evaluate(() => abrirPagamento('-Caso1'));
  assert(/Maria da Silva/.test(await pg.textContent('#pag-sub')));
  let t = await pg.innerText('#pag-conteudo'); assert(/Escritura e registro/.test(t) && /Só a escritura/.test(t) && /Só o registro/.test(t) && /Valor a pagar/.test(t) && /Valor do boleto/.test(t));
  await pg.check('input[value="escritura"]'); t = await pg.innerText('#pag-conteudo'); assert(/Valor a pagar/.test(t) && !/Valor do boleto/.test(t));
  await pg.check('input[value="registro"]'); t = await pg.innerText('#pag-conteudo'); assert(!/Valor a pagar/.test(t) && /Valor do boleto/.test(t) && /1 · Registro/.test(t));
});

await passo('faltando dado ou arquivo, o aviso diz o que falta e NADA é gravado', async () => {
  const pg = await abrir(); await pg.evaluate(() => abrirPagamento('-Caso1')); await pg.click('#pag-gerar');
  const e = await pg.innerText('.pag-erro'); assert(/valor da escritura/.test(e) && /recibo do cartório/.test(e) && /valor do boleto/.test(e) && /vencimento/.test(e) && /código de barras/.test(e) && /boleto/.test(e), e);
  assert.equal((await pg.evaluate(() => window.__grav)).length, 0);
  await pg.fill('#pag-valE', '3.039,89'); await pg.fill('#pag-valR', '3.868,07'); await pg.fill('#pag-venc', '31/02/2026'); await pg.fill('#pag-codigo', '26091.90299 37227');
  await pg.click('#pag-gerar'); assert(/vencimento/.test(await pg.innerText('.pag-erro')) && /recibo/.test(await pg.innerText('.pag-erro')));
});

const colar = (pg, tipo = 'image/png') => pg.evaluate(async (t) => {
  const c = document.createElement('canvas'); c.width = 600; c.height = 400; c.getContext('2d').fillRect(0, 0, 600, 400);
  const blob = await new Promise((ok) => c.toBlob(ok, t)); const dt = new DataTransfer(); dt.items.add(new File([blob], 'image.png', {type: t}));
  const ev = new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}); document.dispatchEvent(ev); return ev.defaultPrevented;
}, tipo);

await passo('colar o print (Ctrl+V) no lugar de escolher arquivo: o recibo entra, aparece a miniatura e o link é gerado com ele', async () => {
  const pg = await abrir(); await pg.evaluate(() => abrirPagamento('-Caso1')); await pg.check('input[value="escritura"]');
  assert(/Clique aqui e aperte Ctrl\+V para colar o print/.test(await pg.innerText('#pag-conteudo')));
  assert.equal(await colar(pg), true, 'o colar foi tratado');
  const t = await pg.innerText('#pag-conteudo'); assert(/✓ Recibo 1/.test(t) && /print-recibo-\d{4}-\d{2}-\d{2}\.png/.test(t) && /cole mais um print/.test(t));
  assert.equal(await pg.locator('.pag-mini img').count(), 1, 'miniatura do print');
  await pg.fill('#pag-valE', '3.039,89'); await pg.click('#pag-gerar'); await pg.waitForSelector('#pag-msg');
  const v = (await pg.evaluate(() => window.__grav)).find((x) => x[1].startsWith('cobrancas/'))[2];
  assert(/^data:image\/jpeg;base64,/.test(v.imagens.recibo), 'o print vira a imagem do recibo');
});

await passo('com escritura e registro, o colar vai para onde ela clicou; sem clique, para o primeiro que falta', async () => {
  const pg = await abrir(); await pg.evaluate(() => abrirPagamento('-Caso1'));
  await colar(pg); let t = await pg.innerText('#pag-conteudo'); assert(/print-recibo/.test(t) && !/print-boleto/.test(t), 'sem clique: o recibo, que é o primeiro');
  await colar(pg); t = await pg.innerText('#pag-conteudo'); assert(/print-boleto/.test(t), 'o próximo que falta é o boleto');
  const pg2 = await abrir(); await pg2.evaluate(() => abrirPagamento('-Caso1'));
  await pg2.click('.pag-cola[data-alvo="boleto"]'); await colar(pg2);
  t = await pg2.innerText('#pag-conteudo'); assert(/print-boleto/.test(t) && !/print-recibo/.test(t), 'clicou no boleto: o print vai para o boleto');
});

await passo('colar texto (não imagem) não faz nada, e arrastar um arquivo para a caixa também funciona', async () => {
  const pg = await abrir(); await pg.evaluate(() => abrirPagamento('-Caso1')); await pg.check('input[value="escritura"]');
  const tratou = await pg.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/plain', 'R$ 10,00'); const ev = new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}); document.dispatchEvent(ev); return ev.defaultPrevented; });
  assert.equal(tratou, false, 'texto colado num campo segue o caminho normal');
  await pg.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(['x'], 'recibo.pdf', {type: 'application/pdf'})); const z = document.querySelector('.pag-cola'); z.dispatchEvent(new DragEvent('drop', {dataTransfer: dt, bubbles: true, cancelable: true})); });
  assert(/✓ Recibo 1/.test(await pg.innerText('#pag-conteudo')) && /recibo\.pdf/.test(await pg.innerText('#pag-conteudo')));
});

await passo('gerar: grava a cobrança (valores em centavos, recibo e boleto como imagem), o resumo no card, e devolve o link e a mensagem', async () => {
  const pg = await abrir(); await pg.evaluate(() => { window.__orc = [{id: 'o1', status: 'enviado', versao: 1, resultado: {}}, {id: 'o2', status: 'aceito', versao: 2, resultado: {}}]; abrirPagamento('-Caso1'); });
  await pg.fill('#pag-valE', '3.039,89'); await pg.locator('#pag-recibo').setInputFiles(IMG);
  await pg.fill('#pag-valR', '3.868,07'); await pg.fill('#pag-venc', '23/10/2026'); await pg.fill('#pag-codigo', '26091.90299 37227.373505 99600.000006 2 16080000386807'); await pg.locator('#pag-boleto').setInputFiles(IMG);
  assert.equal(await pg.inputValue('#pag-orc'), 'o2', 'nasce marcado o aprovado pelo cliente');
  await pg.click('#pag-gerar'); await pg.waitForSelector('#pag-msg');
  const g = await pg.evaluate(() => window.__grav);
  const cob = g.find((x) => x[1] === 'cobrancas/TOKENFIXOabcdefghij1234'); assert(cob && cob[0] === 'set', JSON.stringify(g.map((x) => x[1])));
  const v = cob[2]; assert.equal(v.meta.casoId, '-Caso1'); assert.deepEqual(v.meta.itens, {escritura: true, registro: true}); assert(v.meta.expiraEm > Date.now() + 14 * 864e5);
  assert.equal(v.dados.escritura.valorCent, 303989); assert.equal(v.dados.registro.valorCent, 386807); assert.equal(v.dados.registro.venc, '23/10/2026');
  assert.equal(v.dados.registro.beneficiario, 'Prime Assessoria Jurídica e Imobiliária'); assert.equal(v.dados.nome, 'Maria da Silva'); assert.equal(v.dados.ato, 'Escritura de Compra e Venda');
  assert(/^data:image\/jpeg;base64,/.test(v.imagens.recibo) && /^data:image\/jpeg;base64,/.test(v.imagens.boleto) && /^data:image\/jpeg;base64,/.test(v.imagens.orcamento), 'recibo, boleto e orçamento viram imagem');
  assert(!('boletoPdf' in v.imagens), 'boleto em foto não tem PDF para baixar');
  const idx = g.find((x) => x[1] === 'casos/-Caso1/pagamento'); assert(idx && idx[2].token === 'TOKENFIXOabcdefghij1234' && idx[2].status === 'aguardando' && idx[2].escrituraCent === 303989 && idx[2].registroCent === 386807 && idx[2].itens.registro === true);
  assert(!JSON.stringify(idx[2]).includes('data:image'), 'o resumo do card é leve: sem imagens');
  const link = await pg.inputValue('input[readonly]'); assert.equal(link, 'https://painel.exemplo/p/TOKENFIXOabcdefghij1234');
  const msg = await pg.inputValue('#pag-msg'); assert(/conferir e fazer os pagamentos da sua escritura/.test(msg) && msg.includes(link) && /20º Tabelião de Notas/.test(msg));
  assert(/Atualizar o link/.test(await pg.innerText('#pag-gerar')));
});

await passo('sem orçamento aprovado a imagem do orçamento não vai, e o aviso diz isso', async () => {
  const pg = await abrir(); await pg.evaluate(() => abrirPagamento('-Caso1')); await pg.check('input[value="escritura"]');
  assert(/ainda não tem orçamento salvo/.test(await pg.innerText('#pag-conteudo')));
  await pg.fill('#pag-valE', '3039,89'); await pg.locator('#pag-recibo').setInputFiles(IMG); await pg.click('#pag-gerar'); await pg.waitForSelector('#pag-msg');
  const v = (await pg.evaluate(() => window.__grav)).find((x) => x[1].startsWith('cobrancas/'))[2];
  assert(!('orcamento' in v.imagens) && v.dados.registro == null && v.dados.escritura.valorCent === 303989 && v.meta.itens.registro === false, JSON.stringify(v.dados));
  assert(/fazer o pagamento da sua escritura/.test(await pg.inputValue('#pag-msg')) && !/conferir e fazer/.test(await pg.inputValue('#pag-msg')), 'a mensagem muda com o que vai no link');
});

await passo('o orçamento a rever não depende do status "Aprovado pelo cliente": ela escolhe a versão, ou nenhuma', async () => {
  const pg = await abrir();
  await pg.evaluate(() => { window.__orc = [{id: 'o1', status: 'enviado', versao: 1, resultado: {}}, {id: 'o3', status: 'conferencia', versao: 3, resultado: {}}]; abrirPagamento('-Caso1'); });
  assert.equal(await pg.inputValue('#pag-orc'), 'o3', 'sem aprovado, nasce a versão mais recente');
  await pg.selectOption('#pag-orc', ''); await pg.check('input[value="escritura"]'); await pg.fill('#pag-valE', '100,00'); await pg.locator('#pag-recibo').setInputFiles(IMG); await pg.click('#pag-gerar'); await pg.waitForSelector('#pag-msg');
  assert(!('orcamento' in (await pg.evaluate(() => window.__grav)).find((x) => x[1].startsWith('cobrancas/'))[2].imagens), 'escolheu nenhum: a imagem não vai');
  const p2 = await abrir();
  await p2.evaluate(() => { window.__orc = [{id: 'o1', status: 'enviado', versao: 1, resultado: {}}, {id: 'o3', status: 'conferencia', versao: 3, resultado: {}}]; abrirPagamento('-Caso1'); });
  await p2.selectOption('#pag-orc', 'o1'); await p2.check('input[value="escritura"]'); await p2.fill('#pag-valE', '100,00'); await p2.locator('#pag-recibo').setInputFiles(IMG); await p2.click('#pag-gerar'); await p2.waitForSelector('#pag-msg');
  assert(/^data:image\/jpeg/.test((await p2.evaluate(() => window.__grav)).find((x) => x[1].startsWith('cobrancas/'))[2].imagens.orcamento), 'escolheu a versão 1: a imagem vai');
});

await passo('Gerar com a leitura ainda correndo: o botão avisa "Lendo os documentos…" (nunca parece morto) e depois gera', async () => {
  const pg = await abrir();
  let solta; const espera = new Promise((r) => { solta = r; });
  await pg.route('https://script.google.com/**', async (r) => { await espera; r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify({ok: true, dados: {total_das_custas: '100,00', total_recebido: '100,00', parcelas: ['100,00']}})}); });
  await pg.evaluate(() => abrirPagamento('-Caso1')); await pg.check('input[value="escritura"]'); await pg.locator('#pag-recibo').setInputFiles(IMG);
  await pg.click('#pag-gerar');
  await pg.waitForFunction(() => /Lendo os documentos/.test(document.querySelector('#pag-gerar').innerText));
  assert.equal(await pg.locator('#pag-gerar').isDisabled(), true);
  solta(); await pg.waitForSelector('#pag-msg');
  assert.equal((await pg.evaluate(() => window.__grav)).some((x) => x[1] === 'cobrancas/TOKENFIXOabcdefghij1234'), true);
});

await passo('mais de um recibo: cada um fecha as próprias contas, o valor é a soma, e tirar um refaz a soma', async () => {
  const pg = await abrir(); const totais = ['1.000,00', '2.039,89'];
  let n = 0; await pg.route('https://script.google.com/**', (r) => { const t = totais[n++ % 2]; r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify({ok: true, dados: {total_das_custas: t, total_recebido: t, parcelas: [t]}})}); });
  await pg.evaluate(() => abrirPagamento('-Caso1')); await pg.check('input[value="escritura"]');
  await pg.locator('#pag-recibo').setInputFiles([IMG, IMG]);
  await pg.waitForFunction(() => document.querySelector('#pag-valE').value === '3.039,89');
  const t = await pg.innerText('#pag-conteudo'); assert(/Recibo 1/.test(t) && /Recibo 2/.test(t) && /somado/.test(t) && /cole mais um print/.test(t));
  await pg.locator('[data-pag-rem="recibo:0"]').click();
  assert.equal(await pg.inputValue('#pag-valE'), '2.039,89'); assert(!/Recibo 2/.test(await pg.innerText('#pag-conteudo')));
  await pg.locator('#pag-recibo').setInputFiles(IMG); await pg.waitForFunction(() => document.querySelector('#pag-valE').value === '3.039,89');
  await pg.click('#pag-gerar'); await pg.waitForSelector('#pag-msg');
  const im = (await pg.evaluate(() => window.__grav)).find((x) => x[1].startsWith('cobrancas/'))[2].imagens;
  assert.equal(im.recibos.length, 2); assert.equal(im.recibo, im.recibos[0], 'o primeiro também vai no campo de sempre');
});

await passo('com um recibo que não fecha entre vários, o valor NÃO é somado e o motivo diz qual', async () => {
  const pg = await abrir(); let n = 0;
  await pg.route('https://script.google.com/**', (r) => { const ok = n++ === 0; r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify({ok: true, dados: ok ? {total_das_custas: '100,00', total_recebido: '100,00', parcelas: ['100,00']} : {total_das_custas: '50,00', total_recebido: '50,00', parcelas: ['10,00']}})}); });
  await pg.evaluate(() => abrirPagamento('-Caso1')); await pg.check('input[value="escritura"]');
  await pg.locator('#pag-recibo').setInputFiles([IMG, IMG]);
  await pg.waitForFunction(() => /recibo 2/.test(document.querySelector('#pag-conteudo').innerText));
  assert.equal(await pg.inputValue('#pag-valE'), '');
});

await passo('mais de um boleto: todos vão, o campo de sempre leva o primeiro, e o aviso diz que o código é do primeiro', async () => {
  const pg = await abrir();
  await pg.route('https://script.google.com/**', (r) => r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify({ok: true, dados: {linha_digitavel: LINHA, beneficiario: 'X LTDA', cnpj: '11.222.333/0001-81'}})}));
  await pg.evaluate(() => abrirPagamento('-Caso1')); await pg.check('input[value="registro"]');
  await pg.locator('#pag-boleto').setInputFiles([IMG, IMG]);
  await pg.waitForFunction(() => /mais de um boleto/.test(document.querySelector('#pag-conteudo').innerText));
  assert(/Boleto 2/.test(await pg.innerText('#pag-conteudo')));
  await pg.click('#pag-gerar'); await pg.waitForSelector('#pag-msg');
  const im = (await pg.evaluate(() => window.__grav)).find((x) => x[1].startsWith('cobrancas/'))[2].imagens;
  assert.equal(im.boletos.length, 2); assert.equal(im.boleto, im.boletos[0]);
});

await passo('o valor do boleto tem de bater com o que o código de barras carrega: se divergir, o aviso diz os dois e nada é gravado', async () => {
  const pg = await abrir(); await pg.evaluate(() => abrirPagamento('-Caso1')); await pg.check('input[value="registro"]');
  await pg.fill('#pag-valR', '3.000,00'); await pg.fill('#pag-venc', '23/10/2026'); await pg.fill('#pag-codigo', '26091.90299 37227.373505 99600.000006 2 16080000386807');
  await pg.locator('#pag-boleto').setInputFiles(IMG); await pg.route('https://script.google.com/**', (r) => r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify({ok: false, erro: 'x'})}));
  await pg.click('#pag-gerar'); await pg.waitForSelector('.pag-erro');
  const e = await pg.innerText('.pag-erro'); assert(/código de barras diz R\$\s*3\.868,07/.test(e) && /R\$\s*3\.000,00/.test(e), e);
  assert.equal((await pg.evaluate(() => window.__grav)).length, 0);
  await pg.fill('#pag-valR', '3.868,07'); await pg.click('#pag-gerar'); await pg.waitForSelector('#pag-msg');
});

await passo('só o registro: a mensagem fala do registro e a escritura não entra', async () => {
  const pg = await abrir(); await pg.evaluate(() => abrirPagamento('-Caso1')); await pg.check('input[value="registro"]');
  await pg.fill('#pag-valR', '100,00'); await pg.fill('#pag-venc', '23/10/2026'); await pg.fill('#pag-codigo', '123'); await pg.locator('#pag-boleto').setInputFiles(IMG); await pg.click('#pag-gerar'); await pg.waitForSelector('#pag-msg');
  assert(/pagamento do registro de imóveis/.test(await pg.inputValue('#pag-msg')));
  const v = (await pg.evaluate(() => window.__grav)).find((x) => x[1].startsWith('cobrancas/'))[2]; assert.deepEqual(v.meta.itens, {escritura: false, registro: true}); assert(v.dados.escritura == null && !('recibo' in v.imagens));
});

await passo('PDF sem o leitor carregado: o aviso é escrito (nunca "gerou" sem a imagem)', async () => {
  const pg = await abrir(); await pg.evaluate(() => abrirPagamento('-Caso1')); await pg.check('input[value="escritura"]');
  await pg.fill('#pag-valE', '10,00'); await pg.locator('#pag-recibo').setInputFiles(PDF); await pg.click('#pag-gerar'); await pg.waitForSelector('.pag-erro');
  assert(/leitor de PDF/.test(await pg.innerText('.pag-erro')) && (await pg.evaluate(() => window.__grav)).length === 0 && await pg.locator('#pag-msg').count() === 0);
});

await passo('o banco recusa: o aviso manda publicar as regras (FIREBASE.md) e não aparece link', async () => {
  const pg = await abrir(); await pg.evaluate(() => { window.__recusar = true; abrirPagamento('-Caso1'); }); await pg.check('input[value="escritura"]');
  await pg.fill('#pag-valE', '10,00'); await pg.locator('#pag-recibo').setInputFiles(IMG); await pg.click('#pag-gerar'); await pg.waitForSelector('.pag-erro');
  assert(/FIREBASE\.md/.test(await pg.innerText('.pag-erro')) && await pg.locator('#pag-msg').count() === 0);
});

await passo('a faixa do card: sem link, aguardando e recebido (com imprimir)', async () => {
  const pg = await abrir();
  const f = await pg.evaluate(() => { const c = {id: '-Caso1'}; return [pagFaixaHtml(c), pagFaixaHtml({...c, pagamento: {token: 'T'.repeat(20), criadoEm: 1760000000000, status: 'aguardando', itens: {escritura: true, registro: true}, escrituraCent: 303989, registroCent: 386807}}),
    pagFaixaHtml({...c, pagamento: {token: 'T'.repeat(20), status: 'recebido', recebidoEm: 1760000000000, itens: {escritura: true, registro: true}, escrituraCent: 303989, registroCent: 386807}}),
    pagFaixaHtml({...c, pagamento: {token: 'T'.repeat(20), status: 'recebido', recebidoEm: 1760000000000, itens: {escritura: true}, escrituraCent: 303989}})]; });
  assert(/Gerar link de pagamento/.test(f[0]) && !/imprimir/i.test(f[0]));
  assert(/aguardando o cliente/.test(f[1]) && /Copiar link/.test(f[1]) && /R\$ 3\.039,89/.test(f[1]) && !/imprimirComprovante/.test(f[1]));
  assert(/Comprovantes recebidos/.test(f[2]) && (f[2].match(/imprimirComprovante\('-Caso1'\)/g) || []).length === 1 && /Imprimir comprovantes/.test(f[2]), 'um botão só, que imprime todos');
  assert((f[3].match(/imprimirComprovante/g) || []).length === 1, 'link só da escritura: o mesmo botão único');
});

await passo('o aviso do topo: só o que chegou e ainda não foi visto; "Já vi" e "Abrir o card" marcam como visto', async () => {
  const pg = await abrir();
  const h = await pg.evaluate(() => pagAvisosHtml({a: {id: 'a', nome: 'Maria', pagamento: {status: 'recebido', recebidoEm: 1760000000000, itens: {escritura: true, registro: true}}}, b: {id: 'b', nome: 'Visto', pagamento: {status: 'recebido', visto: true}}, c: {id: 'c', nome: 'Aguardando', pagamento: {status: 'aguardando'}}, d: {id: 'd', nome: 'Sem'}}));
  assert(/Cliente enviou os comprovantes de pagamento/.test(h) && /Maria/.test(h) && /escritura e registro/.test(h) && !/Visto|Aguardando|Sem/.test(h));
  await pg.evaluate(() => { window.__setCasos({a: {id: 'a', nome: 'Maria', pagamento: {status: 'recebido', itens: {escritura: true}}}}); renderPagamentos(); });
  assert(await pg.locator('#cc-pagamentos .cc-envio').count() === 1);
  await pg.evaluate(() => abrirPagamentoRecebido('a')); await pg.waitForTimeout(100);
  assert.equal(await pg.evaluate(() => window.__foi), 'a'); assert((await pg.evaluate(() => window.__grav)).some((x) => x[1] === 'casos/a/pagamento' && x[2].visto === true));
});

await passo('imprimir: busca o comprovante no Drive (pelo Apps Script) e abre a folha com o que o financeiro precisa', async () => {
  const pg = await abrir();
  await pg.evaluate(() => {
    window.__setCasos({'-Caso1': {id: '-Caso1', nome: 'Maria da Silva', tipo: 'Escritura de Compra e Venda', controle: '43804', pagamento: {token: 'T'.repeat(20), status: 'recebido', recebidoEm: 1760000000000, itens: {escritura: true}, escrituraCent: 303989}}});
    window.__pedidos = []; window.fetch = async (u, o) => { window.__pedidos.push(JSON.parse(o.body)); return {json: async () => ({ok: true, itens: [{mime: 'image/jpeg', nome: 'pix.jpg', base64: 'AAAA'}, {mime: 'image/jpeg', nome: 'ted.jpg', base64: 'BBBB'}], mime: 'image/jpeg', nome: 'pix.jpg', base64: 'AAAA'})}; };
    const w = {_h: '', document: {write(x) { w._h += x; }, open() { w._h = ''; }, close() {}, querySelector: () => ({complete: true})}, focus() {}, print() { window.__imprimiu = true; }, close() {}};
    window.__w = w; window.open = () => w;
  });
  await pg.evaluate(() => imprimirComprovante('-Caso1')); await pg.waitForFunction(() => window.__imprimiu, null, {timeout: 3000});
  assert.deepEqual(await pg.evaluate(() => window.__pedidos[0]), {acao: 'pagamento-ver', casoId: '-Caso1', qual: 'todos'});
  const h = await pg.evaluate(() => window.__w._h);
  assert(/Comprovante de pagamento — escritura/.test(h) && /Maria da Silva/.test(h) && /43804/.test(h) && /R\$ 3\.039,89/.test(h) && /data:image\/jpeg;base64,AAAA/.test(h) && /data:image\/jpeg;base64,BBBB/.test(h) && /financeiro do cartório/.test(h), h.slice(0, 400));
});

await passo('imprimir com erro (Apps Script antigo ou sem comprovante): o motivo aparece escrito e a janela fecha', async () => {
  const pg = await abrir(); let aviso = '';
  pg.removeAllListeners('dialog'); pg.on('dialog', (d) => { aviso = d.message(); d.accept(); });
  await pg.evaluate(() => {
    window.__setCasos({'-Caso1': {id: '-Caso1', nome: 'M', pagamento: {status: 'recebido'}}});
    window.fetch = async () => ({json: async () => ({ok: false, erro: 'Ainda não há comprovante desta cobrança.'})});
    window.__fechou = false; window.open = () => ({document: {write() {}}, close() { window.__fechou = true; }});
  });
  await pg.evaluate(() => imprimirComprovante('-Caso1')); await pg.waitForFunction(() => window.__fechou, null, {timeout: 3000});
  assert(/Ainda não há comprovante/.test(aviso), aviso);
});

await passo('janela de impressão bloqueada pelo navegador: o aviso explica', async () => {
  const pg = await abrir(); let aviso = ''; pg.removeAllListeners('dialog'); pg.on('dialog', (d) => { aviso = d.message(); d.accept(); });
  await pg.evaluate(() => { window.open = () => null; }); await pg.evaluate(() => imprimirComprovante('-Caso1')); await pg.waitForTimeout(200);
  assert(/bloqueou a janela/.test(aviso));
});


// ── A leitura do recibo e do boleto ──
const responder = async (pg, resposta) => { await pg.route('https://script.google.com/**', (r) => { const c = JSON.parse(r.request().postData()); (globalThis.__pedidos ||= []).push(c); r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(typeof resposta === 'function' ? resposta(c) : resposta)}); }); };
const anexar = async (pg, alvo) => { await pg.setInputFiles('#pag-' + alvo, IMG); };

await passo('a linha digitável do boleto real entrega o valor e o vencimento, conferindo os dígitos', async () => {
  const pg = await abrir();
  const r = await pg.evaluate((l) => pagLerLinhaDigitavel(l, new Date(Date.UTC(2026, 9, 20))), LINHA);
  assert.equal(r.centavos, 386807); assert.equal(r.venc, '23/10/2026'); assert.equal(r.linha, LINHA);
  assert.equal(await pg.evaluate((l) => pagLerLinhaDigitavel(l.replace('37227.373505', '37227.373506')), LINHA), null, 'um dígito trocado deve reprovar');
  assert.equal(await pg.evaluate(() => pagLerLinhaDigitavel('123')), null);
  assert.equal(await pg.evaluate((l) => pagAcharLinhaNoTexto('Boleto ' + l + ' Pague'), LINHA), LINHA);
});

await passo('o recibo só preenche o valor quando as contas fecham', async () => {
  const pg = await abrir();
  const c = (d) => pg.evaluate((x) => pagConferirRecibo(x), d);
  assert.deepEqual(await c({total_das_custas: '3.039,89', total_recebido: '3.039,89', parcelas: ['1.810,12', '1.229,77']}), {ok: true, centavos: 303989});
  assert.equal((await c({total_das_custas: '3.039,89', total_recebido: '3.039,88', parcelas: ['3.039,89']})).ok, false, 'totais diferentes');
  assert.equal((await c({total_das_custas: '3.039,89', total_recebido: '3.039,89', parcelas: ['1.810,12', '1.229,78']})).ok, false, 'soma não bate');
  assert.equal((await c({total_das_custas: '3.039,89', total_recebido: null, parcelas: ['3.039,89', null]})).ok, false, 'linha ilegível');
  assert.equal((await c({parcelas: []})).ok, false);
});

await passo('anexar o recibo preenche o valor da escritura e avisa para conferir', async () => {
  const pg = await abrir(); globalThis.__pedidos = [];
  await responder(pg, {ok: true, dados: {total_das_custas: '3.039,89', total_recebido: '3.039,89', parcelas: ['1.810,12', '1.229,77']}});
  await pg.evaluate(() => abrirPagamento('-Caso1')); await anexar(pg, 'recibo');
  await pg.waitForFunction(() => document.querySelector('#pag-valE').value !== '');
  assert.equal(await pg.inputValue('#pag-valE'), '3.039,89');
  const t = await pg.innerText('#pag-conteudo'); assert(/lido do documento/i.test(t) && /conferido/i.test(t), t);
  assert.equal(globalThis.__pedidos[0].acao, 'pagamento-ler'); assert.equal(globalThis.__pedidos[0].tipo, 'recibo');
});

await passo('o que ela já digitou nunca é trocado pela leitura', async () => {
  const pg = await abrir();
  await responder(pg, {ok: true, dados: {total_das_custas: '3.039,89', total_recebido: '3.039,89', parcelas: ['3.039,89']}});
  await pg.evaluate(() => abrirPagamento('-Caso1')); await pg.fill('#pag-valE', '100,00'); await anexar(pg, 'recibo');
  await pg.waitForFunction(() => /não mexi/.test(document.querySelector('#pag-conteudo').innerText));
  assert.equal(await pg.inputValue('#pag-valE'), '100,00');
});

await passo('recibo que não fecha: o valor fica em branco e o motivo aparece escrito', async () => {
  const pg = await abrir();
  await responder(pg, {ok: true, dados: {total_das_custas: '3.039,89', total_recebido: '3.039,89', parcelas: ['1.000,00']}});
  await pg.evaluate(() => abrirPagamento('-Caso1')); await anexar(pg, 'recibo');
  await pg.waitForFunction(() => /não preenchi/.test(document.querySelector('#pag-conteudo').innerText));
  assert.equal(await pg.inputValue('#pag-valE'), '');
});

await passo('anexar o boleto preenche valor, vencimento, código, beneficiário e CNPJ', async () => {
  const pg = await abrir();
  await pg.addInitScript(() => { const D = Date; globalThis.Date = class extends D { constructor(...a) { a.length ? super(...a) : super(D.UTC(2026, 9, 20)); } static now() { return D.UTC(2026, 9, 20); } }; });
  await responder(pg, {ok: true, dados: {linha_digitavel: LINHA, beneficiario: 'OUTRA ASSESSORIA LTDA', cnpj: '11.222.333/0001-81'}});
  await pg.goto('http://127.0.0.1:8199/harness-pagamento.html');
  await pg.evaluate(() => abrirPagamento('-Caso1')); await anexar(pg, 'boleto');
  await pg.waitForFunction(() => document.querySelector('#pag-codigo').value !== '');
  assert.equal(await pg.inputValue('#pag-valR'), '3.868,07'); assert.equal(await pg.inputValue('#pag-venc'), '23/10/2026');
  assert.equal(await pg.inputValue('#pag-codigo'), LINHA);
  assert.equal(await pg.inputValue('#pag-benef'), 'OUTRA ASSESSORIA LTDA'); assert.equal(await pg.inputValue('#pag-cnpj'), '11.222.333/0001-81');
});

await passo('código de barras com dígito errado não é preenchido, e o aviso diz isso', async () => {
  const pg = await abrir();
  await responder(pg, {ok: true, dados: {linha_digitavel: LINHA.replace('99600.000006', '99600.000007'), beneficiario: null, cnpj: null}});
  await pg.evaluate(() => abrirPagamento('-Caso1')); await anexar(pg, 'boleto');
  await pg.waitForFunction(() => /não passou na conferência/.test(document.querySelector('#pag-conteudo').innerText));
  assert.equal(await pg.inputValue('#pag-codigo'), ''); assert.equal(await pg.inputValue('#pag-valR'), '');
});

await passo('boleto lido sem beneficiário: o aviso diz que o nome é o de sempre e manda corrigir', async () => {
  const pg = await abrir();
  await responder(pg, {ok: true, dados: {linha_digitavel: LINHA, beneficiario: null, cnpj: null}});
  await pg.evaluate(() => abrirPagamento('-Caso1')); await anexar(pg, 'boleto');
  await pg.waitForFunction(() => /NÃO foi lido do boleto/.test(document.querySelector('#pag-conteudo').innerText));
});

await passo('a leitura falha (Apps Script antigo ou IA fora): não trava nada, ela digita à mão', async () => {
  const pg = await abrir();
  await responder(pg, {ok: false, erro: 'Ação desconhecida'});
  await pg.evaluate(() => abrirPagamento('-Caso1')); await anexar(pg, 'recibo');
  await pg.waitForFunction(() => /Digite o valor/.test(document.querySelector('#pag-conteudo').innerText));
  await pg.fill('#pag-valE', '3.039,89'); assert.equal(await pg.inputValue('#pag-valE'), '3.039,89');
  assert.equal(await pg.evaluate(() => pagEst.recibos.length), 1);
});


await passo('link do orçamento: grava o registro de tipo orçamento com a folha e o resumo no card, e copia a mensagem', async () => {
  const pg = await abrir();
  await pg.evaluate(() => { window.__orc = [{id: 'o1', casoId: '-Caso1', status: 'enviado', versao: 1, resultado: {}}, {id: 'o2', casoId: '-Caso1', status: 'enviado', versao: 2, resultado: {}}]; });
  await pg.evaluate(() => orcLinkAprovacao('-Caso1', 'o2'));
  const g = await pg.evaluate(() => window.__grav);
  const cob = g.find((x) => x[1] === 'cobrancas/TOKENFIXOabcdefghij1234'); assert(cob, JSON.stringify(g.map((x) => x[1])));
  assert.equal(cob[2].meta.tipo, 'orcamento'); assert.equal(cob[2].meta.orcId, 'o2'); assert.equal(cob[2].meta.versao, '2'); assert.equal(cob[2].meta.casoId, '-Caso1'); assert(cob[2].meta.expiraEm > Date.now() + 14 * 864e5);
  assert(/^data:image\/jpeg;base64,/.test(cob[2].imagens.orcamento)); assert.equal(cob[2].dados.nome, 'Maria da Silva');
  const l = g.find((x) => x[1] === 'casos/-Caso1/orcLink'); assert(l && l[2].token === 'TOKENFIXOabcdefghij1234' && l[2].versao === '2');
  const m = await pg.evaluate(() => window.__ultimoLinkOrc); assert.equal(m.link, 'https://painel.exemplo/o/TOKENFIXOabcdefghij1234'); assert(/aprovar o seu orçamento/.test(m.msg) && m.msg.includes(m.link));
});

await passo('a aprovação do cliente: aparece na faixa e no topo, e a janela de pagamento já nasce com a versão aprovada', async () => {
  const pg = await abrir();
  const r = await pg.evaluate(() => {
    window.__orc = [{id: 'o1', casoId: '-Caso1', status: 'enviado', versao: 1, resultado: {}}, {id: 'o2', casoId: '-Caso1', status: 'conferencia', versao: 2, resultado: {}}];
    const c = {id: '-Caso1', nome: 'Maria da Silva'};
    const antes = pagFaixaHtml({...c, orcLink: {token: 'T'.repeat(20), versao: '1', criadoEm: 1760000000000}});
    const ap = {orcId: 'o1', versao: '1', em: 1760000000000, visto: false};
    const depois = pagFaixaHtml({...c, orcAprovacao: ap});
    window.__setCasos({'-Caso1': {...c, tipo: 'Escritura', orcAprovacao: ap}});
    abrirPagamento('-Caso1');
    return {antes, depois, topo: pagAvisosHtml(window.__casos()), sel: document.querySelector('#pag-orc').value, rot: document.querySelector('#pag-orc option[value="o1"]').textContent};
  });
  assert(/aguardando a aprovação do cliente/.test(r.antes)); assert(/Cliente aprovou o orçamento/.test(r.depois) && /versão 1/.test(r.depois));
  assert(/Cliente aprovou o orçamento/.test(r.topo) && /abrirAprovacao/.test(r.topo)); assert.equal(r.sel, 'o1', 'mesmo havendo versão mais nova, vem a que o cliente aprovou'); assert(/aprovada pelo cliente/.test(r.rot));
  const visto = await pg.evaluate(async () => { await vistoAprovacao('-Caso1'); return window.__grav.find((x) => x[1] === 'casos/-Caso1/orcAprovacao'); });
  assert.equal(visto[2].visto, true);
  const sem = await pg.evaluate(() => pagAvisosHtml({'-Caso1': {id: '-Caso1', nome: 'M', orcAprovacao: {em: 1, visto: true}}}));
  assert(!/aprovou/.test(sem), 'depois de visto, o aviso some');
});

await b.close(); servidor.close();
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
