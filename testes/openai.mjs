// Contrato real da Responses API, simulado sem créditos nem dados de clientes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const {openaiPayload, openaiResultado} = require('../apps-script/openai.js');
const ia = require('../lib/ia.js');
const opcoes = {system: 'Não invente dados.', max_tokens: 2000, messages: [{role: 'user', content: 'Teste fictício'}]};
const completo = (texto = 'Concluído.') => ({status: 'completed', output: [{type: 'message', content: [{type: 'output_text', text: texto}]}]});
const comFetch = async (fake, f) => {
  const anterior = globalThis.fetch, chave = process.env.OPENAI_API_KEY;
  globalThis.fetch = fake; process.env.OPENAI_API_KEY = 'teste-nao-utilizavel';
  try {await f();} finally {globalThis.fetch = anterior; if (chave === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = chave;}
};

test('texto, instruções e limite são preservados; resposta não é armazenada', () => {
  const p = openaiPayload(opcoes);
  assert.equal(p.model, 'gpt-4.1'); assert.equal(p.store, false);
  assert.equal(p.instructions, opcoes.system); assert.equal(p.max_output_tokens, 2000);
  assert.equal(p.input[0].content, 'Teste fictício');
  assert.equal(openaiPayload(opcoes, 'modelo-configurado').model, 'modelo-configurado');
});
test('PDF e imagens seguem o formato multimodal da OpenAI', () => {
  const p = openaiPayload({...opcoes, messages: [{role: 'user', content: [
    {type: 'document', source: {type: 'base64', media_type: 'application/pdf', data: 'UEZERg=='}},
    {type: 'image', source: {type: 'base64', media_type: 'image/png', data: 'UE5H'}},
    {type: 'text', text: 'Leia sem resumir.'}
  ]}]});
  assert.equal(p.input[0].content[0].type, 'input_file');
  assert.equal(p.input[0].content[0].file_data, 'data:application/pdf;base64,UEZERg==');
  assert.equal(p.input[0].content[1].image_url, 'data:image/png;base64,UE5H');
  assert.equal(p.input[0].content[2].text, 'Leia sem resumir.');
});
test('pesquisa inclui fontes visitadas e citações, sem duplicar', () => {
  const p = openaiPayload({...opcoes, tools: [{type: 'web_search'}]});
  assert.deepEqual(p.tools, [{type: 'web_search'}]);
  assert.deepEqual(p.include, ['web_search_call.action.sources']);
  const d = completo();
  d.output.push({type: 'web_search_call', action: {sources: [{url: 'https://oficial.gov.br/lei'}]}});
  d.output[0].content[0].annotations = [{type: 'url_citation', url: 'https://oficial.gov.br/lei'}];
  assert.deepEqual(openaiResultado(d).urls, ['https://oficial.gov.br/lei']);
});
test('limite de tokens, recusa e resposta interrompida permanecem distintos', () => {
  assert.equal(openaiResultado({...completo(), status: 'incomplete', incomplete_details: {reason: 'max_output_tokens'}}).truncou, true);
  assert.equal(openaiResultado({output: [{content: [{type: 'refusal'}]}]}).recusa, true);
  assert.throws(() => openaiResultado({status: 'incomplete', incomplete_details: {reason: 'content_filter'}}));
  assert.throws(() => openaiResultado({status: 'failed'}));
});
test('chamada usa Responses e somente a chave OpenAI, com timeout', async () => {
  await comFetch(async (url, req) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(req.headers.Authorization, 'Bearer teste-nao-utilizavel');
    assert.equal(req.signal instanceof AbortSignal, true);
    assert.equal(JSON.parse(req.body).store, false);
    return Response.json(completo());
  }, async () => assert.equal(await ia.texto(opcoes), 'Concluído.'));
});
test('erros HTTP não expõem corpo nem credenciais e preservam status', async () => {
  for (const status of [401, 429, 500]) {
    await comFetch(async () => new Response('detalhe confidencial', {status}), async () => {
      await assert.rejects(ia.gerar(opcoes), e => e.status === status && !/confidencial|teste-nao/.test(e.message));
    });
  }
});
test('sem chave não há requisição; JSON inválido não vira resposta vazia', async () => {
  await comFetch(async () => {throw Error('não deve chamar');}, async () => {
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(ia.texto(opcoes), /OPENAI_API_KEY/);
  });
  await comFetch(async () => new Response('gateway indisponível'), async () => {
    await assert.rejects(ia.texto(opcoes), /formato reconhecível/);
  });
});
function stream(events, chunkSize = 7) {
  const bytes = new TextEncoder().encode(events.map(e => 'data: '+JSON.stringify(e)+'\r\n\r\n').join(''));
  return new Response(new ReadableStream({start(c) {for(let i=0;i<bytes.length;i+=chunkSize) c.enqueue(bytes.slice(i,i+chunkSize));c.close();}}));
}
test('streaming recompõe UTF-8 e eventos divididos sem perder texto', async () => {
  const events = [{type: 'response.output_text.delta', delta: 'Olá, '}, {type: 'response.output_text.delta', delta: 'ação!'}, {type: 'response.completed', response: completo('Olá, ação!')}];
  const pedacos = [];
  await comFetch(async () => stream(events, 1), async () => {
    assert.equal(await ia.texto(opcoes, t => pedacos.push(t)), 'Olá, ação!');
  });
  assert.equal(pedacos.join(''), 'Olá, ação!');
});
test('stream desconectado, erro ou truncamento nunca confirma sucesso', async () => {
  for (const events of [[], [{type: 'error'}], [{type: 'response.incomplete', response: {...completo(), status: 'incomplete', incomplete_details: {reason: 'max_output_tokens'}}}]]) {
    await comFetch(async () => stream(events), async () => assert.rejects(ia.texto(opcoes, () => {})));
  }
});
test('Apps Script usa o mesmo protocolo, chave das propriedades e detecta falhas HTTP', () => {
  let status = 200, pedido;
  const ctx = {PropertiesService: {getScriptProperties: () => ({getProperty: n => n === 'OPENAI_API_KEY' ? 'teste-script' : null})}, UrlFetchApp: {fetch: (url, req) => {
    pedido = {url, req}; return {getResponseCode: () => status, getContentText: () => JSON.stringify(completo('Minuta fictícia.'))};
  }}};
  vm.createContext(ctx); vm.runInContext(readFileSync(new URL('../apps-script/openai.js', import.meta.url), 'utf8'), ctx);
  assert.equal(ctx.chamarOpenAI(opcoes).texto, 'Minuta fictícia.');
  assert.equal(pedido.req.headers.Authorization, 'Bearer teste-script');
  assert.equal(JSON.parse(pedido.req.payload).store, false);
  status = 401; assert.throws(() => ctx.chamarOpenAI(opcoes), /HTTP 401/);
});

test('Joaninha e perguntas da minuta mantêm o contrato que o painel já lê', async () => {
  for (const [arquivo, body, resposta] of [
    ['perguntar-joaninha', {pergunta: 'Qual a prioridade?', casosAtivos: []}, 'Não há casos ativos.'],
    ['perguntas-minuta', {tipo: 'Compra e venda', nome: 'Caso fictício', documentos: 'Dados fictícios'}, '{"perguntas":[{"pergunta":"Qual a modalidade?","porque":"","exemplo":""}]}']
  ]) {
    const handler = require('../api/'+arquivo+'.js');
    let status, saida;
    const res = {setHeader() {}, status(n) {status=n; return this;}, json(j) {saida=j; return this;}, send(s) {saida=s; return this;}};
    await comFetch(async () => Response.json(completo(resposta)), async () => {
      await handler({method: 'POST', body, headers: {}, url: '/api/'+arquivo}, res);
    });
    assert.equal(status, 200, JSON.stringify(saida));
    assert.equal(saida.ok, true);
    assert.equal(arquivo === 'perguntar-joaninha' ? saida.resposta : JSON.stringify({perguntas: saida.perguntas}), resposta);
  }
});

test('leitura da escrita mantém texto, ilegibilidade e recusa separados', async () => {
  const handler = require('../lib/ler-letra.js');
  for (const [data, code, esperado] of [
    [completo('Ação de teste'), 200, {ok:true, texto:'Ação de teste'}],
    [completo('(ilegível)'), 200, {ok:true, texto:'', ilegivel:true}],
    [{status:'completed', output:[{type:'message', content:[{type:'refusal'}]}]}, 422, {ok:false, erro:'Não consegui ler esta escrita.'}]
  ]) {
    let status, saida;
    const res = {setHeader() {}, status(n) {status=n; return this;}, json(j) {saida=j; return this;}};
    await comFetch(async () => Response.json(data), async () => {
      await handler({method:'POST', headers:{origin:'https://bussola-mu.vercel.app'}, body:{imagem:'UE5H'}}, res);
    });
    assert.equal(status, code); assert.deepEqual(saida, esperado);
  }
});
