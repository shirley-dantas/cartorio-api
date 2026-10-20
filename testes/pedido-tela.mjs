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
  assert(/por este link, pelo celular:\nhttps:\/\/painel\.exemplo\/enviar\.html\?t=TOKENFIXO/.test(await msg(pg)));
  assert(!/Pode enviar as fotos/.test(await msg(pg)), 'com link, não manda enviar "por aqui"');
  assert(!/•/.test(await msg(pg)) && (await msg(pg)).split('\n').length <= 5, 'com link a mensagem é curta: o recado e o link, sem a lista (ela já está na página)');
});
await passo('pedir mais: arquivo ou informação, e para um lado só quando o link vai para os dois', async () => {
  const pg = await abrir('tipo=Escritura%20de%20Compra%20e%20Venda&link=1');
  await pg.click('summary:has-text("Mais opções")');
  await pg.fill('#ped-extra', 'Número do IPTU'); await pg.selectOption('#ped-extra-tipo', 'info'); await pg.selectOption('#ped-extra-para', 'comprador'); await pg.click('[data-acao="extra"]');
  await pg.fill('#ped-extra', 'Comprovante de residência'); await pg.click('[data-acao="extra"]');
  assert(/Comprador: Informe: Número do IPTU/.test(await msg(pg)) && /• Comprovante de residência/.test(await msg(pg)), await msg(pg));
  await pg.click('[data-acao="papel:vendedor"]');
  assert(!/IPTU/.test(await msg(pg)), 'o que é do comprador não vai para o vendedor');
  assert.equal(await pg.locator('#ped-extra-para').count(), 0, 'com um lado só, não há para quem');
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
  const t = await msg(pg); assert(t.startsWith('Oi! Minha mensagem.') && /link, pelo celular:\nhttps:\/\/painel/.test(t) && t.trim().endsWith('20º Tabelião de Notas'));
});

// A lista de recebidos que o card mostra: a função sai do index.html como está.
await passo('o card lista o que o cliente mandou: arquivos com link, lidos e sem leitura, e os dados digitados', () => {
  const html = readFileSync(join(AQUI, '..', 'index.html'), 'utf8');
  const i = html.indexOf('function pedidoRecebidosHtml(c){'); const f = html.slice(i, html.indexOf('\n}\n', i) + 3);
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;'), escTxt = (t) => String(t).replace(/</g, '&lt;');
  const caixa = {esc, escTxt}; vm.createContext(caixa); vm.runInContext(f, caixa);
  assert.equal(caixa.pedidoRecebidosHtml({documentos: {a: {nome: 'x.pdf', origem: 'foto do bot'}}}), '', 'documento de outra origem não entra');
  const h = caixa.pedidoRecebidosHtml({id: '-Caso1', documentos: {
    a: {nome: 'Comprador_RG_1.jpg', origem: 'link do cliente', link: 'https://drive/x', texto: 'lido', salvoEm: '2026-10-19T10:00:00Z'},
    b: {nome: 'Comprador_CERT_1.pdf', origem: 'link do cliente', link: 'https://drive/y', salvoEm: '2026-10-19T10:01:00Z'},
    c: {nome: 'DADOS_INFORMADOS_PELO_CLIENTE', tipo: 'informacoes', origem: 'link do cliente', texto: 't', salvoEm: '2026-10-19T10:02:00Z'}}});
  assert(/2 arquivos \(1 lidos\) \+ dados digitados/.test(h), h);
  assert.equal((h.match(/excluirDocCliente\('-Caso1'/g) || []).length, 3, 'um botão de excluir por item, inclusive os dados digitados');
  assert.equal((h.match(/relerDocCliente\('-Caso1'/g) || []).length, 1, 'só o arquivo sem leitura ganha "Ler de novo"'); assert(/relerDocCliente\('-Caso1','b'/.test(h));
  assert(/excluirDocCliente\('-Caso1','a'/.test(h) && /excluirDocCliente\('-Caso1','c'/.test(h)); assert(/href="https:\/\/drive\/x"/.test(h) && /sem leitura/.test(h) && /dados digitados<\/span>/.test(h));
});
await passo('a faixa Documentos tem o botão da pasta do Drive, só quando o card tem a pasta e o link é https', () => {
  const html = readFileSync(join(AQUI, '..', 'index.html'), 'utf8');
  const i = html.indexOf('function pedidoPastaHtml(c){'); const f = html.slice(i, html.indexOf('\n}\n', i) + 3);
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const caixa = {esc}; vm.createContext(caixa); vm.runInContext(f, caixa);
  const h = caixa.pedidoPastaHtml({driveUrl: 'https://drive.google.com/drive/folders/abc'});
  assert(/href="https:\/\/drive\.google\.com\/drive\/folders\/abc"/.test(h) && /target="_blank"/.test(h) && /noopener/.test(h) && /Abrir pasta no Drive/.test(h));
  assert.equal(caixa.pedidoPastaHtml({}), ''); assert.equal(caixa.pedidoPastaHtml({driveUrl: ''}), '');
  assert.equal(caixa.pedidoPastaHtml({driveUrl: 'javascript:alert(1)'}), '', 'link que não é https nunca vira botão');
  assert(/\$\{pedidoPastaHtml\(c\)\}/.test(html), 'o card chama a função');
});
await passo('excluir pelo painel: pergunta antes, chama o Apps Script com o caso e o documento, e erro aparece escrito', async () => {
  const html = readFileSync(join(AQUI, '..', 'index.html'), 'utf8');
  const i = html.indexOf('window.excluirDocCliente=async function'); const f = html.slice(i, html.indexOf('\n};\n', i) + 4);
  const rodar = async ({confirma = true, resposta = {ok: true}, falha = false} = {}) => {
    const chamadas = [], avisos = []; const btn = {disabled: false, innerHTML: '<i></i>'};
    const caixa = {window: {}, casos: {C1: {documentos: {d1: {nome: 'RG.pdf', texto: 'x'}, f1: {nome: 'FICHA', tipo: 'informacoes'}}}}, GAS_URL: 'https://gas', JSON, console,
      confirm: (m) => { avisos.push('confirm:' + m); return confirma; }, alert: (m) => avisos.push('alert:' + m),
      fetch: async (u, o) => { if (falha) throw new Error('sem rede'); chamadas.push(JSON.parse(o.body)); return {json: async () => resposta}; }};
    vm.createContext(caixa); vm.runInContext(f, caixa);
    await caixa.window.excluirDocCliente('C1', 'd1', btn); return {chamadas, avisos, btn};
  };
  let r = await rodar({confirma: false}); assert.equal(r.chamadas.length, 0, 'recusou na pergunta: nada é chamado'); assert(/lixeira do Drive/.test(r.avisos[0]));
  r = await rodar(); assert.deepEqual(r.chamadas, [{acao: 'cliente-excluir', casoId: 'C1', docKey: 'd1'}]); assert.equal(r.avisos.length, 1, 'só a pergunta, sem alarme');
  r = await rodar({resposta: {ok: true, arquivo: 'sem selo'}}); assert(r.avisos.some((a) => /continua no Drive/.test(a)), 'avisa quando o arquivo ficou no Drive');
  r = await rodar({resposta: {ok: false, erro: 'O banco recusou a exclusão (401).'}}); assert(r.avisos.some((a) => /Não consegui excluir: O banco recusou/.test(a))); assert.equal(r.btn.disabled, false, 'o botão volta');
  r = await rodar({resposta: {ok: false, erro: 'ação desconhecida: cliente-excluir'}}); assert(r.avisos.some((a) => /ainda não conhece a exclusão/.test(a)), 'Apps Script desatualizado diz o que fazer');
  r = await rodar({falha: true}); assert(r.avisos.some((a) => /Erro de conexão/.test(a)));
});
await passo('aviso de envio no topo do painel: só o que ainda não foi visto, o card abre, "visto" é gravado', async () => {
  const html = readFileSync(join(AQUI, '..', 'index.html'), 'utf8');
  const i = html.indexOf('function renderEnvios()'); const f = html.slice(i, html.indexOf('function renderJornal()', i));
  const el = {style: {}, innerHTML: ''}; const gravou = []; const abriu = [];
  const caixa = {document: {getElementById: (id) => id === 'cc-envios' ? el : null}, window: {irParaCasoPorId: (id) => abriu.push(id)}, Date, JSON, Object, db: {}, ref: (_, c) => c, escTxt: (x) => String(x), esc: (x) => String(x), alert: () => {},
    update: (c, d) => { gravou.push([c, d]); return Promise.resolve(); },
    casos: {A: {id: 'A', nome: 'RENATO TESTE', envioCliente: {em: Date.now(), arquivos: 3, ato: 'União Estável', visto: false}}, B: {id: 'B', nome: 'JA VISTO', envioCliente: {em: 1, visto: true}}, C: {id: 'C', nome: 'SEM ENVIO'}}};
  vm.createContext(caixa); vm.runInContext(f, caixa); vm.runInContext('renderEnvios()', caixa);
  assert.equal(el.style.display, 'grid'); assert(/RENATO TESTE/.test(el.innerHTML) && /3 arquivos/.test(el.innerHTML) && /link já foi fechado/.test(el.innerHTML));
  assert(!/JA VISTO|SEM ENVIO/.test(el.innerHTML), 'só o que não foi visto');
  await caixa.window.abrirEnvioCliente('A'); assert.deepEqual(abriu, ['A']); assert.equal(gravou[0][0], 'casos/A/envioCliente'); assert.equal(gravou[0][1].visto, true);
  caixa.casos.A.envioCliente.visto = true; vm.runInContext('renderEnvios()', caixa); assert.equal(el.style.display, 'none', 'sem pendência, o aviso some');
});
await b.close(); servidor.close();
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
