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
  await pg.waitForFunction(() => document.querySelector('#tela .p-tit') || document.body.classList.contains('invalido'), null, {timeout: 6000}).catch(() => {});
  return {pg, chamadas};
}
const anexar = async (pg, qual, arq = PNG) => { await pg.locator(`input[data-comp="${qual}"]`).last().setInputFiles(arq); };
const noMeio = (pg, re) => pg.waitForFunction((s) => new RegExp(s, 'i').test(document.querySelector('#tela').innerText), re.source, {timeout: 6000});

await passo('sem código, link vencido ou já usado: a página diz que o link não serve e não mostra pagamento', async () => {
  const sem = await abrir(undefined, {codigo: 'curto'}); assert(await sem.pg.evaluate(() => document.body.classList.contains('invalido')));
  const v = await abrir({expiraEm: Date.now() - 1000}); assert(/venceu/.test(await v.pg.textContent('#motivo')));
  const u = await abrir({concluidoEm: Date.now()}); assert(/já foi usado/.test(await u.pg.textContent('#motivo')) && await u.pg.isHidden('#tela .p-tit'));
  const nada = await abrir(null); assert(await nada.pg.evaluate(() => document.body.classList.contains('invalido')), 'cobrança que não existe');
});

await passo('primeira tela: os dois valores, o aviso de segurança, o recibo e o boleto reais, e o orçamento só se existir', async () => {
  const {pg} = await abrir(); const t = await pg.innerText('#tela');
  assert(/Olá, Larissa/i.test(t) && /Confira os valores/.test(t) && /R\$ 3\.039,89/.test(t) && /R\$ 3\.868,07/.test(t) && /Aviso de segurança/.test(t), t);
  assert(/CONFERÊNCIA/.test(t) && /PAGAMENTO DA ESCRITURA/.test(t) && /PAGAMENTO DO REGISTRO/.test(t), 'as etapas, do jeito dela');
  assert(/reveja seu orçamento aqui/.test(t), 'o botão do orçamento');
  assert(!/Pode fechar e voltar depois/.test(t), 'o rodapé em branco saiu');
  await pg.click('[data-vis="recibo"]'); assert(/Recibo da escritura/.test(await pg.innerText('#vis')) && await pg.locator('#vis img').count() === 1);
  await pg.click('[data-fechar]'); await pg.click('[data-vis="boleto"]'); const vb = await pg.innerText('#vis'); assert(/Boleto do registro/.test(vb) && /Baixar PDF/.test(vb));
  await pg.click('[data-fechar]'); assert(await pg.isHidden('#vis'));
  const sem = await abrir({orcamento: false}); assert.equal(await sem.pg.locator('[data-vis="orc"]').count(), 0, 'sem orçamento aprovado o botão não existe');
  assert((await pg.evaluate(() => document.documentElement.scrollWidth)) <= 391, 'não rola de lado');
  await pg.screenshot({path: SAIDA('pag-1-conferir.png'), fullPage: true});
});

await passo('o fluxo inteiro: a escritura, depois o registro, e só com o comprovante o botão liga; ao concluir o link fecha', async () => {
  const {pg, chamadas} = await abrir();
  await pg.click('[data-next]'); await noMeio(pg, /Pagamento da escritura/);
  let t = await pg.innerText('#tela'); assert(/45\.566\.502\/0001-12/.test(t) && /422032-3/.test(t) && /72195-7/.test(t) && /Ou por TED/i.test(t) && /ANEXE AQUI O SEU COMPROVANTE/i.test(t));
  assert(await pg.locator('[data-next]').isDisabled(), 'apagado sem comprovante');
  await pg.screenshot({path: SAIDA('pag-2-escritura.png'), fullPage: true});
  await anexar(pg, 'escritura'); await noMeio(pg, /✓ Anexado/);
  const up = chamadas.find((c) => c.acao === 'pagamento-arquivo'); assert(up && up.t === TOKEN && up.qual === 'escritura' && up.mimetype === 'image/jpeg' && up.base64.length > 100 && up.nomeArquivo === 'comprovante.png', JSON.stringify({...up, base64: '…'}));
  assert(!chamadas.some((c) => c.acao === 'pagamento-concluir'));
  await pg.click('[data-next]'); await noMeio(pg, /Pagamento do registro/);
  t = await pg.innerText('#tela'); assert(/26091\.90299 37227\.373505/.test(t) && /Prime Assessoria/.test(t) && /47\.141\.731\/0001-10/.test(t) && !/Vence em/.test(t) && !/não vai para o cartório de notas/.test(t), 'os dados do boleto; vencimento e explicação em branco ficam de fora');
  assert(await pg.locator('[data-next]').isDisabled());
  await pg.screenshot({path: SAIDA('pag-3-registro.png'), fullPage: true});
  await anexar(pg, 'registro', PDF); await noMeio(pg, /Tudo certo, pode concluir/);
  assert.equal(chamadas.find((c) => c.acao === 'pagamento-arquivo' && c.qual === 'registro').mimetype, 'application/pdf');
  await pg.click('[data-next]'); await noMeio(pg, /Pagamentos recebidos/);
  t = await pg.innerText('#tela'); assert(/Escritura: R\$ 3\.039,89, comprovante recebido/.test(t) && /Registro de imóveis: R\$ 3\.868,07/.test(t) && /nossa equipe entrará em contato/.test(t));
  assert.equal(chamadas.filter((c) => c.acao === 'pagamento-concluir').length, 1);
  await pg.screenshot({path: SAIDA('pag-4-fim.png'), fullPage: true});
});

await passo('link só da escritura ou só do registro: o fluxo some com o que não foi escolhido', async () => {
  const e = await abrir({itens: {escritura: true}}); let t = await e.pg.innerText('#tela');
  assert(/Confira o valor/.test(t) && /R\$ 3\.039,89/.test(t) && !/R\$ 3\.868,07/.test(t) && !/PAGAMENTO DO REGISTRO/.test(t) && /Fazer o pagamento da escritura/.test(t));
  await e.pg.click('[data-next]'); await noMeio(e.pg, /Pagamento da escritura/); await anexar(e.pg, 'escritura'); await noMeio(e.pg, /Tudo certo/);
  assert(/Concluir/.test(await e.pg.innerText('[data-next]')), 'sendo o último passo, o botão é "Concluir"');
  await e.pg.click('[data-next]'); await noMeio(e.pg, /Pagamentos recebidos/); const f = await e.pg.innerText('#tela'); assert(/Escritura:/.test(f) && !/Registro de imóveis:/.test(f));
  const r = await abrir({itens: {registro: true}}); t = await r.pg.innerText('#tela'); assert(/Fazer o pagamento do registro/.test(t) && !/PAGAMENTO DA ESCRITURA/.test(t) && !/R\$ 3\.039,89/.test(t));
  await r.pg.click('[data-next]'); await noMeio(r.pg, /Pagamento do registro/); assert(!/PASSO 1 DE 2/i.test(await r.pg.innerText('#tela')), 'sendo uma cobrança só, não diz "de 2"');
});

await passo('o aviso de segurança aparece também quando o link tem uma cobrança só', async () => {
  const e = await abrir({itens: {registro: true}}); assert(/Aviso de segurança/.test(await e.pg.innerText('#tela')));
});

await passo('comprovante que não subiu: o aviso aparece escrito, o botão continua apagado e dá para tentar de novo', async () => {
  let falha = true;
  const {pg, chamadas} = await abrir({}, {gas: (c) => (c.acao === 'pagamento-arquivo' && falha ? {ok: false, erro: 'não deu'} : {ok: true})});
  await pg.click('[data-next]'); await noMeio(pg, /Pagamento da escritura/);
  await anexar(pg, 'escritura'); await noMeio(pg, /Não enviou/);
  assert(await pg.locator('[data-next]').isDisabled() && /Falta anexar/i.test(await pg.innerText('#tela')));
  falha = false; await anexar(pg, 'escritura'); await noMeio(pg, /✓ Anexado/); assert(!(await pg.locator('[data-next]').isDisabled()));
});

await passo('concluir que o cartório recusa: o erro aparece e o link não fecha', async () => {
  const {pg} = await abrir({itens: {escritura: true}}, {gas: (c) => (c.acao === 'pagamento-concluir' ? {ok: false, erro: 'Falta o comprovante'} : {ok: true})});
  let aviso = ''; pg.removeAllListeners('dialog'); pg.on('dialog', (d) => { aviso = d.message(); d.accept(); });
  await pg.click('[data-next]'); await noMeio(pg, /Pagamento da escritura/); await anexar(pg, 'escritura'); await noMeio(pg, /Tudo certo/);
  await pg.click('[data-next]'); await pg.waitForTimeout(600);
  assert(/Falta o comprovante/.test(aviso) && !/Pagamentos recebidos/.test(await pg.innerText('#tela')), aviso);
});

await passo('voltar e abrir de novo: o comprovante que já subiu continua "✓ Anexado", e o botão de voltar leva ao passo anterior', async () => {
  const {pg} = await abrir({comprovantes: {escritura: {docKey: 'pag_x', nome: 'meu-pix.jpg'}}});
  await pg.click('[data-next]'); await noMeio(pg, /✓ Anexado/); assert(/meu-pix\.jpg/.test(await pg.innerText('#tela')) && !(await pg.locator('[data-next]').isDisabled()));
  await pg.click('[data-next]'); await noMeio(pg, /Pagamento do registro/); await pg.click('[data-voltar]'); await noMeio(pg, /Pagamento da escritura/);
});

await passo('copiar: a chave Pix e o código de barras vão para a área de transferência e o botão confirma', async () => {
  const {pg} = await abrir(); await pg.click('[data-next]'); await noMeio(pg, /Pagamento da escritura/);
  const btn = pg.locator('[data-copy]').first(); assert.equal(await btn.getAttribute('data-copy'), '45.566.502/0001-12');
  await btn.click(); assert(/Copiado!/.test(await btn.textContent()));
});

await passo('no computador também cabe e não rola de lado', async () => {
  const {pg} = await abrir({}, {mobile: false}); assert((await pg.evaluate(() => document.documentElement.scrollWidth)) <= 1101);
  await pg.screenshot({path: SAIDA('pag-desk.png'), fullPage: true});
});

await passo('nenhum erro de script em nenhuma tela', () => { assert.deepEqual(erro, []); });

await b.close(); servidor.close();
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
