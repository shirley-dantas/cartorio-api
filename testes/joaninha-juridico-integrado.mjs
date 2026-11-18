import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {consultar,fonteOficial,DOMINIOS}=require('../lib/joaninha-conhecimento');
const P=require('../lib/joaninha-protocolo');
const {openaiPayload}=require('../apps-script/openai');
const base={inventario:{titulo:'Inventário e ITCMD',resumo:'Regra fictícia para teste.',etapas:[{etapa:'Escritura',situacao:'Confirmar no ato vigente'}],atencao:['A numeração deste item precisa ser confirmada.']}};
test('consulta recupera base e Radar, exige fontes oficiais e preserva ressalvas fora do texto do modelo',async()=>{
  const leituras=[];let pedido;
  const r=await consultar({pergunta:'Qual a regra do ITCMD no inventário?'},{firebase:async p=>{leituras.push(p);return p.startsWith('base-')?base:{};},gerar:async p=>{pedido=p;return {texto:'Orientação fictícia com ressalva.',urls:['https://www.cnj.jus.br/atos/','https://blog.example/','javascript:alert(1)','https://www.cnj.jus.br/atos/']};}});
  assert.equal(leituras.length,2);assert.match(pedido.messages[0].content,/Regra fictícia/);assert.match(pedido.messages[0].content,/PADRÕES INTERNOS/);
  assert.match(pedido.system,/Competência/);assert.match(pedido.system,/Não invente artigo/);assert.match(pedido.system,/CPF/);
  assert.deepEqual(pedido.tools[0].filters.allowed_domains,DOMINIOS);
  assert.equal(pedido.pesquisarSempre,true);
  assert.deepEqual(r.fontes,['https://www.cnj.jus.br/atos/']);assert.match(r.atencao[0],/numeração/);assert.equal(r.semConfirmacao,false);
});
test('base é relida em cada pergunta; resposta sem fontes e sem base não vira orientação inventada',async()=>{
  let versao=0;const dependencia={firebase:async p=>p.startsWith('base-')?{tema:{titulo:'Tema',resumo:'Versão '+(++versao)}}:{},gerar:async p=>({texto:p.messages[0].content.includes('Versão 2')?'Segunda':'Primeira',urls:[]})};
  assert.equal((await consultar({pergunta:'Dúvida fictícia'},dependencia)).resposta,'Primeira');
  assert.equal((await consultar({pergunta:'Dúvida fictícia'},dependencia)).resposta,'Segunda');
  const r=await consultar({pergunta:'Dúvida sem fundamento'},{firebase:async()=>({error:'Permission denied'}),gerar:async()=>({texto:'Dispensa inventada.',urls:[]})});
  assert.equal(r.semConfirmacao,true);assert.doesNotMatch(r.resposta,/Dispensa inventada/);
});
test('fontes respeitam domínio real e HTTPS; pesquisa mantém filtros e limite de chamadas na Responses API',()=>{
  for(const u of ['http://www.cnj.jus.br/','https://cnj.jus.br.evil.test/','https://evilcnj.jus.br/','javascript:alert(1)'])assert.equal(fonteOficial(u),null);
  const p=openaiPayload({max_tokens:1000,messages:[{role:'user',content:'Pergunta'}],tools:[{type:'web_search',filters:{allowed_domains:DOMINIOS},user_location:{type:'approximate',country:'BR'}}],pesquisarSempre:true,max_tool_calls:4});
  assert.deepEqual(p.tools[0].filters.allowed_domains,DOMINIOS);assert.equal(p.tools[0].user_location.country,'BR');assert.equal(p.max_tool_calls,4);
  assert.equal(p.tool_choice,'required');
});
test('consulta jurídica é leitura sem card, e não pode ser misturada com gravação antes da resposta',()=>{
  const consulta={tipo:'consultar_juridico',casoId:null,dados:{pergunta:'Posso lavrar este ato?',formato:'cliente'}};
  const p=P.plano({resposta:'Vou consultar.',acoes:[consulta]},[]);assert.equal(p.acoes[0].casoId,null);assert.ok(P.LEITURAS.includes('consultar_juridico'));
  assert.throws(()=>P.plano({acoes:[consulta,{tipo:'anotar_caso',casoId:'C1',dados:{texto:'Orientação ainda desconhecida'}}]},['C1']),/consulta jurídica precisa terminar/);
  assert.throws(()=>P.acao({...consulta,casoId:'C2'},['C1']),/não está disponível/);
});
test('recusa, texto vazio e resposta truncada não são apresentados como orientação concluída',async()=>{
  for(const resposta of [{texto:'',recusa:true},{texto:'Parcial',truncou:true},{texto:''}])await assert.rejects(consultar({pergunta:'Questão fictícia'},{firebase:async()=>base,gerar:async()=>resposta}),/não foi concluída/);
});
test('padrões internos correspondem aos usados nas minutas e não incluem configurações privadas',()=>{
  const s=readFileSync(new URL('../apps-script/cartorio-drive-api.js',import.meta.url),'utf8');const c={};vm.createContext(c);
  vm.runInContext(s.slice(s.indexOf('const INSTRUCOES_POR_TIPO ='),s.indexOf('function anoPorExtenso('))+'\nthis.dados={instrucoesPorTipo:INSTRUCOES_POR_TIPO,padroesRedacao:SYSTEM_PROMPT};',c);
  const real=require('../lib/juridico-padroes.json');assert.deepEqual(real,JSON.parse(JSON.stringify(c.dados)));
  assert.doesNotMatch(JSON.stringify(real),/API_KEY|Bearer|sk-ant-/);
});
test('aba jurídica anterior mantém consulta à base e o modo cliente',async()=>{
  const https=require('node:https'),getAnterior=https.get,fetchAnterior=globalThis.fetch,chave=process.env.OPENAI_API_KEY;
  https.get=(url,callback)=>{
    const req=new EventEmitter();req.setTimeout=()=>req;req.destroy=()=>{};
    queueMicrotask(()=>{const res=new EventEmitter();callback(res);res.emit('data',JSON.stringify(String(url).includes('base-regras')?base:{}));res.emit('end');});return req;
  };
  process.env.OPENAI_API_KEY='ficticia';let pedido;
  globalThis.fetch=async(url,r)=>{pedido=JSON.parse(r.body);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:'Mensagem fictícia para o cliente.'}]}]});};
  try{
    let status,saida;const res={setHeader(){},status(s){status=s;return this;},json(d){saida=d;return this;}};
    await require('../api/joaninha-juridico')({method:'POST',body:{pergunta:'Assunto fictício',modo:'cliente'}},res);
    assert.equal(status,200);assert.equal(saida.modo,'cliente');assert.equal(saida.temas,1);assert.match(pedido.instructions,/hierarquia normativa/);assert.equal(saida.resposta,'Mensagem fictícia para o cliente.');
  }finally{https.get=getAnterior;globalThis.fetch=fetchAnterior;if(chave===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=chave;}
});
test('API jurídica encaminha conversa principal sem exigir card ou executar alterações',async()=>{
  const servico=require('../lib/joaninha-conhecimento'),anterior=servico.consultar;let recebido;
  servico.consultar=async d=>{recebido=d;return {resposta:'Orientação fictícia',fontes:[],consultadoEm:'2026-11-12'};};
  try{
    let status,saida;const res={setHeader(){},status(s){status=s;return this;},json(d){saida=d;return this;}};
    await require('../api/joaninha-juridico')({method:'POST',body:{pergunta:'Dúvida fictícia',modo:'conversa'}},res);
    assert.equal(status,200);assert.equal(saida.ok,true);assert.equal(recebido.pergunta,'Dúvida fictícia');
  }finally{servico.consultar=anterior;}
});
