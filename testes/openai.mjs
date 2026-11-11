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
  assert.equal(p.model, 'gpt-6-luna'); assert.equal(p.store, false);
  assert.equal(p.instructions, opcoes.system); assert.equal(p.max_output_tokens, 2000);
  assert.equal(p.input[0].content, 'Teste fictício');
  assert.equal(openaiPayload(opcoes, 'modelo-configurado').model, 'modelo-configurado');
});
test('Luna preserva o orçamento de saída para texto; configuração não altera GPT-4.1', () => {
  const luna = openaiPayload(opcoes, 'gpt-6-luna');
  assert.equal(luna.model, 'gpt-6-luna');
  assert.deepEqual(luna.reasoning, {effort:'none'});
  assert.equal(luna.max_output_tokens, 2000);
  assert.equal(openaiPayload(opcoes, 'gpt-4.1').reasoning, undefined);
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
test('429 distingue falta de cota, frequência e volume excessivo sem revelar o erro bruto', async () => {
  for (const [code, message, esperado] of [
    ['insufficient_quota', 'segredo conta', /sem cota disponível/],
    ['billing_hard_limit_reached', 'segredo conta', /sem cota disponível/],
    ['rate_limit_exceeded', 'Rate limit reached segredo conta', /limite temporário/],
    ['rate_limit_exceeded', 'Request too large segredo conta', /volume de dados/],
    ['desconhecido', 'segredo conta', /não detalhou/]
  ]) {
    await comFetch(async () => Response.json({error: {code, message}}, {status: 429}), async () => {
      await assert.rejects(ia.texto(opcoes), e => e.status === 429 && esperado.test(e.message) && !/segredo/.test(e.message));
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

test('Apps Script aguarda limite temporário sem reduzir a minuta; cota e volume excessivo não são repetidos', () => {
  for (const code of ['rate_limit_exceeded','insufficient_quota','grande']) {
    let chamadas=0;const esperas=[],pedidos=[];
    const ctx={PropertiesService:{getScriptProperties:()=>({getProperty:n=>n==='OPENAI_API_KEY'?'ficticia':null})},Utilities:{sleep:n=>esperas.push(n)},UrlFetchApp:{fetch:(url,req)=>{
      chamadas++;pedidos.push(req.payload);
      const falha=code!=='rate_limit_exceeded'||chamadas===1;
      return {getResponseCode:()=>falha?429:200,getAllHeaders:()=>({'Retry-After':'2'}),getContentText:()=>JSON.stringify(falha?{error:{code:code==='grande'?'rate_limit_exceeded':code,message:code==='grande'?'Request too large':'temporário'}}:completo('Minuta completa.'))};
    }}};
    vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../apps-script/openai.js',import.meta.url),'utf8'),ctx);
    if(code==='rate_limit_exceeded'){
      assert.equal(ctx.chamarOpenAI({...opcoes,max_tokens:16000}).texto,'Minuta completa.');
      assert.deepEqual(esperas,[2000]);assert.equal(chamadas,2);assert.equal(pedidos[0],pedidos[1]);assert.equal(JSON.parse(pedidos[0]).max_output_tokens,16000);
    }else{assert.throws(()=>ctx.chamarOpenAI(opcoes));assert.equal(chamadas,1);assert.deepEqual(esperas,[]);}
  }
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

test('Joaninha compacta 116 casos sem perder campos, registros ou separadores', async () => {
  const casosAtivos = Array.from({length:116}, (_,i) => ({nome:'Pessoa fictícia '+i, tipo:'Compra e venda', status:'atencao', resp:'Equipe', prazo:'hoje', diasParado:i, dep:'Falta documentos', obs:'Observação fictícia com | delimitador e\nquebra de linha.'}));
  const antigo = casosAtivos.map(c => `- ${c.nome} (${c.tipo}) | status: ${c.status} | responsável: ${c.resp} | prazo: ${c.prazo} | dias parado: ${c.diasParado} | dependência: ${c.dep} | obs: ${c.obs}`).join('\n');
  let recebido;
  const handler = require('../api/perguntar-joaninha.js');
  const res = {setHeader(){},status(n){assert.equal(n,200);return this;},json(j){assert.equal(j.ok,true);}};
  await comFetch(async (url, req) => {
    recebido=JSON.parse(req.body).input[0].content;
    return Response.json(completo('Teste concluído.'));
  }, async () => handler({method:'POST',url:'/api/perguntar-joaninha',headers:{},body:{pergunta:'Teste fictício',casosAtivos,focosRestantes:['Foco fictício']}},res));
  const tabela = JSON.parse(recebido.split('observações.\n')[1].split('\n\nResponda')[0]);
  assert.equal(tabela.length,116);
  for(let i=0;i<116;i++) {
    const c=casosAtivos[i];
    assert.deepEqual(tabela[i],[c.nome,c.tipo,c.status,c.resp,c.prazo,c.diasParado,c.dep,c.obs]);
  }
  assert.ok(recebido.includes('Foco fictício'));
  assert.ok(JSON.stringify(tabela).length < antigo.length * 0.8);
});

test('minuta longa com Luna mantém 16.000 tokens por rodada e junta a continuação inteira', () => {
  const inicio = 'Cláusula fictícia integral.\n'.repeat(3000);
  const fim = 'Encerramento fictício, leitura e assinaturas.';
  const respostas = [
    {...completo(inicio), status:'incomplete', incomplete_details:{reason:'max_output_tokens'}},
    completo(fim)
  ];
  const pedidos = [], agendados = [], finalizados = [], erros = [];
  const ctx = {
    PropertiesService:{getScriptProperties:()=>({getProperty:n=>({OPENAI_API_KEY:'teste-ficticio',OPENAI_MODEL:'gpt-6-luna'})[n]||null})},
    Logger:{log(){}},
    UrlFetchApp:{fetch:(url, req)=>{
      assert.equal(url,'https://api.openai.com/v1/responses');
      pedidos.push(JSON.parse(req.payload));
      const data=respostas.shift();
      return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(data)};
    }}
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../apps-script/openai.js',import.meta.url),'utf8'),ctx);
  vm.runInContext(readFileSync(new URL('../apps-script/cartorio-drive-api.js',import.meta.url),'utf8'),ctx);
  ctx.agendarContinuacaoMinuta=(job,estado)=>agendados.push({job,estado:structuredClone(estado)});
  ctx.finalizarGeracaoMinuta=(job,estado,truncada)=>finalizados.push({job,estado:structuredClone(estado),truncada});
  ctx.salvarJobFirebase=(job,estado)=>erros.push({job,estado});
  ctx.processarRodadaMinuta('teste-longo',{mensagemBase:'Somente documentos fictícios.',rodadas:0,textoAcumulado:'',temModelo:false,ano:2026,notificarWhatsApp:false});
  assert.equal(finalizados.length,0);
  assert.equal(agendados.length,1);
  assert.equal(agendados[0].estado.textoAcumulado,inicio);
  ctx.processarRodadaMinuta(agendados[0].job,agendados[0].estado);
  assert.equal(erros.length,0);
  assert.equal(finalizados.length,1);
  assert.equal(finalizados[0].truncada,false);
  assert.equal(finalizados[0].estado.textoAcumulado,inicio+fim);
  assert.equal(pedidos.length,2);
  for(const p of pedidos){assert.equal(p.model,'gpt-6-luna');assert.equal(p.max_output_tokens,16000);assert.equal(p.reasoning.effort,'none');}
  assert.ok(pedidos[1].input[0].content.includes(inicio.slice(-1500)));
});
