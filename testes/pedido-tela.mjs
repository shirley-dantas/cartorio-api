// "Pedir documentos" na tela: o botão de gerar link, e a lista do que chegou no card.
//   node testes/pedido-tela.mjs
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {servir} from './servidor.mjs';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const AQUI = dirname(fileURLToPath(import.meta.url));
const erros = [];
const passo = async (n, f) => { try { await f(); console.log('  ok  ' + n); } catch (e) { erros.push(n); console.log('FALHA ' + n + ' → ' + e.message); } };
const servidor = await servir(8199);
const b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const url = (q) => 'http://127.0.0.1:8199/harness-pedido.html?' + q;
const abrir = async (q) => { const pg = await b.newPage({viewport: {width: 1100, height: 900}}); pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message)); await pg.goto(url(q)); await pg.waitForFunction(() => window.__pronto); return pg; };
const msg = (pg) => pg.inputValue('#ped-msg');

await passo('sem criarLink (o painel não sabe gerar), o botão nem aparece', async () => {
  const pg = await abrir('tipo=Doa%C3%A7%C3%A3o'); assert.equal(await pg.locator('[data-acao="link"]').count(), 0);
});
await passo('gerar link: o pedido sai com a lista marcada, o link entra na mensagem e vira "Copiar link"', async () => {
  const pg = await abrir('tipo=Escritura%20de%20Compra%20e%20Venda&link=1');
  await pg.click('[data-acao="papel:comprador"]'); await pg.click('[data-acao="link"]');
  await pg.waitForSelector('[data-acao="copiar-link"]');
  const l = await pg.evaluate(() => window.__links); assert.equal(l.length, 1);
  assert(l[0].blocos.some((x) => x.k === 'pessoa' && x.papeis[0] === 'Comprador(a)') && !JSON.stringify(l[0].blocos).includes('Vendedor'), 'só o comprador');
  assert(/Envie tudo por este link, pelo celular: https:\/\/painel\.exemplo\/enviar\.html\?t=TOKENFIXO/.test(await msg(pg)));
  assert(!/Pode enviar as fotos/.test(await msg(pg)), 'com link, não manda enviar "por aqui"');
});
await passo('mudar a lista depois do link avisa que está velha; atualizar mantém o MESMO código', async () => {
  const pg = await abrir('tipo=Escritura%20de%20Compra%20e%20Venda&link=1');
  await pg.click('[data-acao="link"]'); await pg.waitForSelector('[data-acao="copiar-link"]');
  assert(!/A lista mudou/.test(await pg.textContent('.ped-dir')));
  await pg.uncheck('[data-acao="item:imovel.mat"]');
  assert(/A lista mudou depois que o link foi gerado/.test(await pg.textContent('.ped-dir')));
  await pg.click('[data-acao="link"]'); await pg.waitForFunction(() => !/A lista mudou/.test(document.querySelector('.ped-dir').textContent));
  const l = await pg.evaluate(() => window.__links); assert.equal(l.length, 2); assert.equal(l[1].token, 'TOKENFIXO0123456789abcd');
  assert(!l[1].blocos.some((x) => x.id === 'imovel.mat'), 'o item desmarcado saiu do pedido');
});
await passo('se o banco recusa, o erro aparece escrito e o link NÃO é mostrado como pronto', async () => {
  const pg = await abrir('tipo=Doa%C3%A7%C3%A3o&link=1&negar=1'); await pg.click('[data-acao="link"]');
  await pg.waitForFunction(() => /Não consegui gerar o link/.test(document.querySelector('.ped-dir').textContent));
  assert(/banco recusou/.test(await pg.textContent('.ped-dir'))); assert.equal(await pg.locator('[data-acao="copiar-link"]').count(), 0);
  assert(!/painel\.exemplo/.test(await msg(pg)));
});
await passo('texto editado à mão recebe o link no fim, antes da assinatura, sem apagar a edição', async () => {
  const pg = await abrir('tipo=Doa%C3%A7%C3%A3o&link=1');
  await pg.fill('#ped-msg', 'Oi! Minha mensagem.\n\n20º Tabelião de Notas'); await pg.click('[data-acao="link"]'); await pg.waitForSelector('[data-acao="copiar-link"]');
  const t = await msg(pg); assert(t.startsWith('Oi! Minha mensagem.') && /link, pelo celular: https:\/\/painel/.test(t) && t.trim().endsWith('20º Tabelião de Notas'));
});

// A lista de recebidos que o card mostra: a função sai do index.html como está.
await passo('o card lista o que o cliente mandou: arquivos com link, lidos e sem leitura, e os dados digitados', () => {
  const html = readFileSync(join(AQUI, '..', 'index.html'), 'utf8');
  const i = html.indexOf('function pedidoRecebidosHtml(c){'); const f = html.slice(i, html.indexOf('\n}\n', i) + 3);
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;'), escTxt = (t) => String(t).replace(/</g, '&lt;');
  const caixa = {esc, escTxt}; vm.createContext(caixa); vm.runInContext(f, caixa);
  assert.equal(caixa.pedidoRecebidosHtml({documentos: {a: {nome: 'x.pdf', origem: 'foto do bot'}}}), '', 'documento de outra origem não entra');
  const h = caixa.pedidoRecebidosHtml({documentos: {
    a: {nome: 'Comprador_RG_1.jpg', origem: 'link do cliente', link: 'https://drive/x', texto: 'lido', salvoEm: '2026-10-19T10:00:00Z'},
    b: {nome: 'Comprador_CERT_1.pdf', origem: 'link do cliente', link: 'https://drive/y', salvoEm: '2026-10-19T10:01:00Z'},
    c: {nome: 'DADOS_INFORMADOS_PELO_CLIENTE', tipo: 'informacoes', origem: 'link do cliente', texto: 't', salvoEm: '2026-10-19T10:02:00Z'}}});
  assert(/2 arquivos \(1 lidos\) \+ dados digitados/.test(h), h); assert(/href="https:\/\/drive\/x"/.test(h) && /sem leitura/.test(h) && /dados digitados<\/span>/.test(h));
});
await b.close(); servidor.close();
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
