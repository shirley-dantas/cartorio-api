// A caixa de entrada do WhatsApp, do lado da Vercel: a verificação da Meta, a assinatura, o que é arquivo e o que não é,
// o download com o token e a entrega ao Apps Script — tudo com a Meta e o Google fingidos.
//   node testes/whatsapp-entrada.mjs
import {createRequire} from 'node:module';
import {createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const erros = [];
const passo = async (n, f) => { try { await f(); console.log('  ok  ' + n); } catch (e) { erros.push(n); console.log('FALHA ' + n + ' → ' + e.message); } };

// O Bússola e a Joaninha usam o SDK da IA, que não precisa estar instalado para este teste.
const Module = require('node:module'); const carregarOriginal = Module._load;
Module._load = function (pedido, ...resto) { return pedido === '@anthropic-ai/sdk' ? {default: class {}} : carregarOriginal.call(this, pedido, ...resto); };
const entrada = require('../lib/whatsapp-entrada.js');
const porta = require('../api/perguntar-joaninha.js');

const SEG = 'segredo-do-app-na-meta', TOKEN = 'token-permanente', VERIFICA = 'frase-combinada', ENTRADA = 'segredo-do-apps-script';
Object.assign(process.env, {WHATSAPP_APP_SECRET: SEG, WHATSAPP_TOKEN: TOKEN, WHATSAPP_VERIFY_TOKEN: VERIFICA, ENTRADA_SEGREDO: ENTRADA});
const assina = (cru, seg = SEG) => 'sha256=' + createHmac('sha256', seg).update(cru).digest('hex');
const resp = () => { const r = {cabecalhos: {}, status: 200, corpo: undefined}; r.setHeader = (k, v) => { r.cabecalhos[k] = v; }; r.status = (c) => { r.codigo = c; return r; }; r.send = (b) => { r.corpo = b; return r; }; r.json = (b) => { r.corpo = b; return r; }; r.end = () => r; return r; };
const msg = (extra) => ({id: 'wamid.ABC123', from: '5511988887777', timestamp: '1', ...extra});
const corpoMeta = (mensagens, contatos = [{wa_id: '5511988887777', profile: {name: 'Reinaldo'}}]) => ({object: 'whatsapp_business_account', entry: [{changes: [{value: {contacts: contatos, messages: mensagens}}]}]});

// A Meta e o Apps Script fingidos
function rede({tamanho = 5, mime = 'application/pdf', appsResp = {ok: true}, metaFalha = false} = {}) {
  const chamadas = [];
  globalThis.fetch = async (url, o = {}) => {
    chamadas.push({url: String(url), o});
    if (String(url).startsWith('https://graph.facebook.com/')) {
      assert.equal(o.headers.Authorization, 'Bearer ' + TOKEN, 'a Meta só responde com o token');
      if (metaFalha) return {ok: false, status: 500, json: async () => ({})};
      return {ok: true, status: 200, json: async () => ({url: 'https://lookaside.fbsbx.com/arq/' + String(url).split('/').pop(), mime_type: mime, file_size: tamanho})};
    }
    if (String(url).startsWith('https://lookaside.fbsbx.com/')) { assert.equal(o.headers.Authorization, 'Bearer ' + TOKEN); return {ok: true, status: 200, arrayBuffer: async () => Buffer.alloc(tamanho === 11 * 1024 * 1024 ? 11 * 1024 * 1024 : 5, 7).buffer}; }
    if (String(url).startsWith('https://script.google.com/')) return {ok: true, status: 200, json: async () => appsResp};
    throw new Error('endereço inesperado: ' + url);
  };
  return chamadas;
}
const post = async (corpo, {cabecalho, cru} = {}) => { const c = cru !== undefined ? cru : JSON.stringify(corpo), r = resp(); await entrada({method: 'POST', headers: {'x-hub-signature-256': cabecalho === undefined ? assina(c) : cabecalho}, rawBody: c, body: corpo}, r); return r; };

await passo('verificação da Meta: devolve o desafio só com o token combinado', async () => {
  const ok = resp(); await entrada({method: 'GET', query: {'hub.mode': 'subscribe', 'hub.verify_token': VERIFICA, 'hub.challenge': '1158201444'}}, ok); assert.equal(ok.codigo, 200); assert.equal(ok.corpo, '1158201444');
  const errado = resp(); await entrada({method: 'GET', query: {'hub.mode': 'subscribe', 'hub.verify_token': 'outro', 'hub.challenge': 'x'}}, errado); assert.equal(errado.codigo, 403);
  const sem = resp(); await entrada({method: 'GET', query: {}}, sem); assert.equal(sem.codigo, 403);
  const metodo = resp(); await entrada({method: 'PUT'}, metodo); assert.equal(metodo.codigo, 405);
});
await passo('assinatura: sem ela, com a errada ou com o corpo alterado, a chamada é recusada e nada é baixado', async () => {
  const chamadas = rede(); const corpo = corpoMeta([msg({type: 'document', document: {id: 'M1', filename: 'a.pdf', mime_type: 'application/pdf'}})]);
  assert.equal((await post(corpo, {cabecalho: ''})).codigo, 401); assert.equal((await post(corpo, {cabecalho: assina(JSON.stringify(corpo), 'outro-segredo')})).codigo, 401);
  const cru = JSON.stringify(corpo); const alterado = await post(corpo, {cabecalho: assina(cru), cru: cru.replace('a.pdf', 'b.pdf')}); assert.equal(alterado.codigo, 401);
  assert.equal(chamadas.length, 0, 'não falou com a Meta nem com o Google');
  assert(entrada.assinaturaConfere(cru, assina(cru), SEG)); assert(!entrada.assinaturaConfere(cru, assina(cru), '')); assert(!entrada.assinaturaConfere(cru, null, SEG));
});
await passo('sem as variáveis na Vercel, avisa em voz alta em vez de fingir que recebeu', async () => {
  const guardado = process.env.WHATSAPP_TOKEN; delete process.env.WHATSAPP_TOKEN; const r = await post(corpoMeta([])); assert.equal(r.codigo, 500); assert(/não configurado/.test(r.corpo)); process.env.WHATSAPP_TOKEN = guardado;
});
await passo('documento: baixa da Meta com o token e entrega ao Apps Script com o segredo, o remetente e o nome do arquivo', async () => {
  const chamadas = rede(); const r = await post(corpoMeta([msg({type: 'document', document: {id: 'M1', filename: 'JRL Holding - Contrato Social.pdf', mime_type: 'application/pdf'}})]));
  assert.equal(r.codigo, 200); assert.equal(r.corpo.recebidos, 1);
  const apps = chamadas.find((c) => c.url.startsWith('https://script.google.com/')); const dados = JSON.parse(apps.o.body);
  assert.equal(dados.acao, 'entrada-receber'); assert.equal(dados.segredo, ENTRADA); assert.equal(dados.msgId, 'wamid.ABC123'); assert.equal(dados.remetente, '5511988887777'); assert.equal(dados.nomeRemetente, 'Reinaldo');
  assert.equal(dados.nomeArquivo, 'JRL Holding - Contrato Social.pdf'); assert.equal(dados.mimetype, 'application/pdf'); assert.equal(Buffer.from(dados.base64, 'base64').length, 5);
});
await passo('foto: ganha nome próprio (a Meta não manda) e vários arquivos de uma vez entram todos', async () => {
  const chamadas = rede({mime: 'image/jpeg'}); const corpo = corpoMeta([msg({id: 'wamid.F1', type: 'image', image: {id: 'M2', mime_type: 'image/jpeg'}}), msg({id: 'wamid.F2', type: 'image', image: {id: 'M3', mime_type: 'image/jpeg'}}), msg({id: 'wamid.D1', type: 'document', document: {id: 'M4', filename: 'RG.pdf', mime_type: 'application/pdf'}})]);
  const r = await post(corpo); assert.equal(r.corpo.recebidos, 3);
  const nomes = chamadas.filter((c) => c.url.startsWith('https://script.google.com/')).map((c) => JSON.parse(c.o.body)).map((d) => d.nomeArquivo).sort();
  assert(nomes.every((n) => n.length > 3) && nomes.filter((n) => /^WhatsApp_.*\.jpg$/.test(n)).length === 2 && nomes.includes('RG.pdf'), JSON.stringify(nomes));
});
await passo('o que não é arquivo (texto, áudio, figurinha) é ignorado sem tocar na rede; arquivo grande ou de tipo estranho também', async () => {
  const chamadas = rede(); const r1 = await post(corpoMeta([msg({type: 'text', text: {body: 'oi'}}), msg({id: 'a', type: 'audio', audio: {id: 'A1'}}), msg({id: 's', type: 'sticker', sticker: {id: 'S1'}})]));
  assert.equal(r1.codigo, 200); assert.equal(chamadas.length, 0); assert.equal(r1.corpo.ignorados, 3);
  const g = rede({tamanho: 11 * 1024 * 1024}); const r2 = await post(corpoMeta([msg({type: 'document', document: {id: 'G', filename: 'enorme.pdf', mime_type: 'application/pdf'}})])); assert.equal(r2.codigo, 200); assert.equal(r2.corpo.ignorados, 1); assert(!g.some((c) => c.url.startsWith('https://script.google.com/')));
  const e = rede({mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}); const r3 = await post(corpoMeta([msg({type: 'document', document: {id: 'W', filename: 'a.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}})])); assert.equal(r3.corpo.ignorados, 1); assert(!e.some((c) => c.url.startsWith('https://script.google.com/')));
});
await passo('falha da Meta ou do Apps Script devolve 500 (a Meta reentrega) e diz qual mensagem falhou; mensagem repetida não conta como falha', async () => {
  rede({metaFalha: true}); const a = await post(corpoMeta([msg({type: 'document', document: {id: 'M1', filename: 'a.pdf', mime_type: 'application/pdf'}})])); assert.equal(a.codigo, 500); assert.equal(a.corpo.falhas[0].msgId, 'wamid.ABC123');
  rede({appsResp: {ok: false, erro: 'Não autorizado.'}}); const b = await post(corpoMeta([msg({type: 'document', document: {id: 'M1', filename: 'a.pdf', mime_type: 'application/pdf'}})])); assert.equal(b.codigo, 500); assert(/Não autorizado/.test(b.corpo.falhas[0].motivo));
  rede({appsResp: {ok: true, repetida: true}}); const c = await post(corpoMeta([msg({type: 'document', document: {id: 'M1', filename: 'a.pdf', mime_type: 'application/pdf'}})])); assert.equal(c.codigo, 200); assert.equal(c.corpo.recebidos, 0);
});
await passo('a porta da Joaninha: o webhook passa por ela (com o corpo cru), e o resto continua como era', async () => {
  const chamadas = rede(); const corpo = corpoMeta([msg({type: 'document', document: {id: 'M1', filename: 'a.pdf', mime_type: 'application/pdf'}})]), cru = JSON.stringify(corpo);
  const {Readable} = require('node:stream');
  const req = Object.assign(Readable.from([cru.slice(0, 40), cru.slice(40)]), {method: 'POST', url: '/api/perguntar-joaninha?acao=whatsapp', query: {acao: 'whatsapp'}, headers: {'content-type': 'application/json', 'x-hub-signature-256': assina(cru)}});
  const r = resp(); await porta(req, r); assert.equal(r.codigo, 200, JSON.stringify(r.corpo)); assert(chamadas.some((c) => c.url.startsWith('https://script.google.com/')));
  assert.equal(porta.config.api.bodyParser, false, 'o corpo chega cru');
  const g = resp(); await porta({method: 'GET', url: '/api/perguntar-joaninha?acao=whatsapp', query: {acao: 'whatsapp', 'hub.mode': 'subscribe', 'hub.verify_token': VERIFICA, 'hub.challenge': 'ok'}, headers: {}}, g); assert.equal(g.corpo, 'ok');
  // a pergunta da Joaninha, com o corpo já pronto (como os outros testes chamam), segue o caminho de sempre
  const j = resp(); await porta({method: 'POST', url: '/api/perguntar-joaninha', headers: {}, body: {pergunta: ''}}, j); assert.equal(j.codigo, 400); assert(/Pergunta vazia/.test(j.corpo.erro));
  const o = resp(); await porta({method: 'OPTIONS', url: '/api/perguntar-joaninha', headers: {}}, o); assert.equal(o.codigo, 200);
});
await passo('vercel.json: /whatsapp chega na porta certa e a função tem tempo para baixar vários arquivos', async () => {
  const v = require('../vercel.json'); const rw = v.rewrites.find((r) => r.source === '/whatsapp'); assert.equal(rw.destination, '/api/perguntar-joaninha?acao=whatsapp');
  assert(v.functions['api/perguntar-joaninha.js'].maxDuration >= 60);
  const fs = require('node:fs'); assert(fs.readdirSync(new URL('../api/', import.meta.url)).filter((n) => n.endsWith('.js')).length <= 12, 'a Vercel aceita no máximo 12 funções');
});

// ── Sem a Meta: a Evolution ligada ao número pessoal, só recebendo ──
Object.assign(process.env, {EVOLUTION_WEBHOOK_SEGREDO: 'frase-do-webhook', EVOLUTION_HOST: 'evo.exemplo.app', EVOLUTION_INSTANCE: 'escritorio', EVOLUTION_API_KEY: 'chave-da-evolution', ENTRADA_REMETENTES: '(11) 94785-0000'});
const evo = (data, event = 'messages.upsert') => ({event, instance: 'escritorio', data});
const evoDoc = (extra = {}) => evo({key: {remoteJid: '5511947850000@s.whatsapp.net', fromMe: false, id: '3EB0ABCDEF12345678'}, pushName: 'Cartório Business', message: {documentMessage: {mimetype: 'application/pdf', fileName: 'RG Maria.pdf'}}, ...extra});
function redeEvo({base64 = Buffer.from('conteudo').toString('base64'), mime = 'application/pdf', status = 200, appsResp = {ok: true}} = {}) {
  const chamadas = [];
  globalThis.fetch = async (url, o = {}) => {
    chamadas.push({url: String(url), o});
    if (String(url).startsWith('https://evo.exemplo.app/chat/getBase64FromMediaMessage/escritorio')) { assert.equal(o.headers.apikey, 'chave-da-evolution'); return {ok: status < 300, status, json: async () => ({base64, mimetype: mime})}; }
    if (String(url).startsWith('https://script.google.com/')) return {ok: true, status: 200, json: async () => appsResp};
    throw new Error('endereço inesperado: ' + url);
  };
  return chamadas;
}
const postEvo = async (corpo, s = 'frase-do-webhook', metodo = 'POST') => { const r = resp(); await porta({method: metodo, url: '/api/perguntar-joaninha?acao=whatsapp&via=evolution', query: {acao: 'whatsapp', via: 'evolution', s}, headers: {}, body: corpo}, r); return r; };

await passo('Evolution: arquivo de quem está na lista é baixado com a apikey e entregue ao Apps Script com o segredo', async () => {
  const c = redeEvo(); const r = await postEvo(evoDoc()); assert.equal(r.codigo, 200); assert.equal(r.corpo.recebido, true);
  const apps = JSON.parse(c.find((x) => x.url.startsWith('https://script.google.com/')).o.body);
  assert.equal(apps.acao, 'entrada-receber'); assert.equal(apps.segredo, ENTRADA); assert.equal(apps.msgId, '3EB0ABCDEF12345678'); assert.equal(apps.nomeArquivo, 'RG Maria.pdf'); assert.equal(apps.remetente, '5511947850000'); assert.equal(apps.nomeRemetente, 'Cartório Business'); assert.equal(apps.mimetype, 'application/pdf'); assert.equal(Buffer.from(apps.base64, 'base64').toString(), 'conteudo');
  assert.equal(c.filter((x) => /sendText|sendMessage/.test(x.url)).length, 0, 'o robô nunca responde ninguém');
});
await passo('Evolution: sem o segredo do endereço ou com outro, nada acontece', async () => {
  const c = redeEvo(); assert.equal((await postEvo(evoDoc(), '')).codigo, 401); assert.equal((await postEvo(evoDoc(), 'outra')).codigo, 401); assert.equal(c.length, 0);
  const guardado = process.env.ENTRADA_REMETENTES; delete process.env.ENTRADA_REMETENTES; assert.equal((await postEvo(evoDoc())).codigo, 500, 'sem a lista de remetentes, não aceita ninguém'); process.env.ENTRADA_REMETENTES = guardado;
  assert.equal((await postEvo(evoDoc(), 'frase-do-webhook', 'GET')).codigo, 405);
  const seg = process.env.EVOLUTION_WEBHOOK_SEGREDO; delete process.env.EVOLUTION_WEBHOOK_SEGREDO; redeEvo();
  assert.equal((await postEvo(evoDoc(), undefined)).codigo, 200, 'sem segredo no endereço, a lista de remetentes é a guarda');
  assert.equal((await postEvo(evo({key: {remoteJid: '5511999990000@s.whatsapp.net', fromMe: false, id: 'Z9'}, message: {imageMessage: {mimetype: 'image/jpeg'}}}), undefined)).corpo.ignorado, 'remetente fora da lista');
  process.env.EVOLUTION_WEBHOOK_SEGREDO = seg;
});
await passo('Evolution: foto de outra pessoa, grupo, status, texto e áudio são ignorados — o número pessoal recebe de todo mundo', async () => {
  const c = redeEvo(); const base = {fromMe: false, id: 'X1'};
  const outro = await postEvo(evo({key: {...base, remoteJid: '5511999990000@s.whatsapp.net'}, message: {imageMessage: {mimetype: 'image/jpeg'}}})); assert.equal(outro.corpo.ignorado, 'remetente fora da lista');
  const grupo = await postEvo(evo({key: {...base, remoteJid: '120363@g.us'}, message: {imageMessage: {mimetype: 'image/jpeg'}}})); assert.equal(grupo.corpo.ignorado, 'grupo ou status');
  const status = await postEvo(evo({key: {...base, remoteJid: 'status@broadcast'}, message: {imageMessage: {}}})); assert.equal(status.corpo.ignorado, 'grupo ou status');
  const texto = await postEvo(evo({key: {...base, remoteJid: '5511947850000@s.whatsapp.net'}, message: {conversation: 'oi'}})); assert.equal(texto.corpo.ignorado, 'não é PDF nem imagem');
  const audio = await postEvo(evo({key: {...base, remoteJid: '5511947850000@s.whatsapp.net'}, message: {audioMessage: {}}})); assert.equal(audio.corpo.ignorado, 'não é PDF nem imagem');
  const outroEvento = await postEvo(evo({}, 'connection.update')); assert.match(outroEvento.corpo.ignorado, /evento/);
  assert.equal(c.length, 0, 'nada foi baixado nem entregue');
});
await passo('Evolution: o número da lista casa com e sem o 55 e o 9; legenda embrulhada e base64 já embutido funcionam', async () => {
  assert(entrada.remetenteAceito(['5511947850000@s.whatsapp.net'], '11 94785-0000')); assert(entrada.remetenteAceito(['551147850000@s.whatsapp.net'], '+55 11 94785-0000')); assert(!entrada.remetenteAceito(['5511947851111@s.whatsapp.net'], '11947850000')); assert(!entrada.remetenteAceito([''], ''));
  const c = redeEvo(); const emb = evo({key: {remoteJid: '5511947850000@s.whatsapp.net', fromMe: false, id: 'E1'}, base64: Buffer.from('foto').toString('base64'), message: {documentWithCaptionMessage: {message: {documentMessage: {mimetype: 'application/pdf', fileName: 'x.pdf'}}}}});
  const r = await postEvo(emb); assert.equal(r.corpo.recebido, true); assert.equal(c.filter((x) => /getBase64/.test(x.url)).length, 0, 'não baixa de novo o que já veio embutido');
  const img = await postEvo(evo({key: {remoteJid: '5511947850000@s.whatsapp.net', fromMe: false, id: 'ABCDEFGH12'}, message: {imageMessage: {mimetype: 'image/jpeg'}}})); assert.equal(img.corpo.recebido, true);
  assert.equal(JSON.parse(c.filter((x) => x.url.startsWith('https://script.google.com/')).pop().o.body).nomeArquivo, 'WhatsApp_CDEFGH12.jpg', 'imagem sem nome ganha um');
});
await passo('Evolution: falha da Evolution ou do Apps Script devolve 500 escrito; mensagem repetida e tipo estranho não quebram', async () => {
  redeEvo({status: 500}); const f = await postEvo(evoDoc()); assert.equal(f.codigo, 500); assert.match(f.corpo.erro, /Evolution/);
  redeEvo({appsResp: {ok: false, erro: 'Não autorizado.'}}); const g = await postEvo(evoDoc()); assert.equal(g.codigo, 500); assert.match(g.corpo.erro, /Não autorizado/);
  redeEvo({appsResp: {ok: true, repetida: true}}); const h = await postEvo(evoDoc()); assert.equal(h.corpo.repetida, true);
  redeEvo({mime: 'video/mp4'}); const v = await postEvo(evoDoc()); assert.match(v.corpo.ignorado, /tipo/);
});
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
