import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),P=require('../lib/joaninha-protocolo.js');
const {criarPonteJoaninha}=await import('../lib/joaninha-ponte.js');
const handler=require('../lib/joaninha-assistente.js');
const acao=(tipo,dados={},casoId='C1')=>({tipo,casoId,descricao:'Pedido de teste',dados});
const clone=x=>JSON.parse(JSON.stringify(x));
function motor(){
  const s=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const a=s.indexOf('// ══ O MOTOR DE ORÇAMENTOS'),b=s.indexOf('// ══ O AMBIENTE ORÇAMENTOS');
  assert(a>0&&b>a);
  const ctx={window:{},isoHoje:()=> '2026-11-11',finNum:v=>Number(v)||0,finMoeda:v=>(v/100).toFixed(2),finBr:v=>(v/100).toFixed(2)};
  vm.createContext(ctx);vm.runInContext(s.slice(a,b)+'\nthis.calcular=orcCalcular;',ctx);return ctx.calcular;
}
function mundo({autorizado=true,recusarEscrita=false}={}){
  const data={casos:{C1:{id:'C1',nome:'JRL fictícia',tipo:'Compra e venda',obs:'Observação anterior.',modalidade:'presencial',documentos:{D1:{nome:'RG fictício',tipo:'documento',texto:'Texto fictício do documento.'}}}},orcamentos:{},jobs:{}};
  const caminhos=[],agendados=[],minutas=[];let seq=0;
  const partes=p=>p.split('/').filter(Boolean);
  const get=p=>partes(p).reduce((v,k)=>v?.[k],data)??null;
  function set(p,v){const ps=partes(p);let o=data;for(const k of ps.slice(0,-1))o=o[k]??={};o[ps.at(-1)]=clone(v);}
  const ref=(db,path='')=>({path});
  const env={db:{},ref,protocolo:P,casos:()=>data.casos,atos:()=>[],usuario:()=> 'Shirley',chaveUsuario:()=> 'teste',acessoOrcamentos:()=>autorizado,
    get:async r=>({val:()=>clone(get(r.path))}),
    set:async(r,v)=>set(r.path,v),
    update:async(r,patch)=>{if(recusarEscrita)throw Error('Banco recusou');for(const [k,v]of Object.entries(patch)){caminhos.push(k);set([r.path,k].filter(Boolean).join('/'),v);}},
    runTransaction:async(r,fn)=>{if(recusarEscrita)throw Error('Banco recusou');const v=fn(clone(get(r.path)));if(v!==undefined)set(r.path,v);return {committed:v!==undefined,snapshot:{val:()=>clone(get(r.path))}};},
    push:r=>({...r,path:r.path+'/O'+(++seq),key:'O'+seq}),
    hoje:()=> '2026-11-11',prepararTabelas:async()=>{},calcularOrcamento:motor(),semUndefined:v=>clone(v),desenharOrcamento:()=>({toDataURL:()=> 'data:image/png;base64,UE5H'}),
    montarObservacao:(antes,texto)=>antes+'\n'+texto,confirmar:async()=>true,agendar:f=>agendados.push(f),
    fetch:async(url,req)=>{const p=JSON.parse(req.body);minutas.push(p);return Response.json({ok:true,jobId:'joaninha-'+p.solicitacaoId});},
    abrirCaso(){},abrirOrcamento(){},abrirFerramentas(){},entrar(){}
  };
  const ponte=criarPonteJoaninha(env);return {data,ponte,env,caminhos,agendados,minutas};
}

test('plano rejeita ações desconhecidas, card inexistente e caminhos arbitrários',()=>{
  for(const a of [acao('executar_javascript'),acao('anotar_caso',{texto:'x'},'C2'),acao('alterar_caso',{campos:{'financeiro/config':'x'}}),acao('anotar_caso',{texto:'x'},'C1/../../financeiro')])assert.throws(()=>P.plano({resposta:'ok',acoes:[a]},['C1']));
});
test('dinheiro é aceito somente em centavos inteiros e dados não aceitam protótipos',()=>{
  assert.throws(()=>P.acao(acao('preparar_orcamento',{atoId:'compra-venda',valores:{transacao:2.5}}),['C1']));
  const mal=JSON.parse('{"tipo":"anotar_caso","casoId":"C1","dados":{"texto":"x","__proto__":{"admin":true}}}');
  assert.throws(()=>P.acao(mal,['C1']));
  assert.equal(P.acao(acao('preparar_orcamento',{atoId:'compra-venda',valores:{transacao:50000000}}),['C1']).dados.valores.transacao,50000000);
});
test('anotação preserva o texto anterior e uma execução não se repete',async()=>{
  const m=mundo(),a=acao('anotar_caso',{texto:'Documento recebido.'}),id=crypto.randomUUID();
  const r=await m.ponte.executar(a,id);assert.equal(r.status,'salvo');
  assert.equal(m.data.casos.C1.obs,'Observação anterior.\n🐞 Documento recebido.');
  await m.ponte.executar(a,id);
  assert.equal(Object.keys(m.data.casos.C1.historico).length,1);
  assert.equal(Object.values(m.data.casos.C1.joaninhaOperacoes)[0].status,'concluida');
});
test('alteração de campos mantém outros dados e registra antes/depois',async()=>{
  const m=mundo();await m.ponte.executar(acao('alterar_caso',{campos:{status:'atencao',dep:'Falta documentos'}}),crypto.randomUUID());
  assert.equal(m.data.casos.C1.obs,'Observação anterior.');assert.equal(m.data.casos.C1.status,'atencao');
  assert.equal(m.data.casos.C1.depDesde,'2026-11-11');
  const h=Object.values(m.data.casos.C1.historico)[0];assert.equal(h.antes.status,null);assert.equal(h.depois.status,'atencao');
});
test('criação e conclusão de tarefa são vinculadas ao card e comprovadas pelo banco',async()=>{
  const m=mundo();const r=await m.ponte.executar(acao('criar_tarefa',{texto:'Conferir a matrícula.'}),crypto.randomUUID());
  assert.equal(m.data.casos.C1.tarefasJoaninha[r.tarefaId].feito,false);
  await m.ponte.executar(acao('alterar_tarefa',{tarefaId:r.tarefaId,feito:true}),crypto.randomUUID());
  assert.equal(m.data.casos.C1.tarefasJoaninha[r.tarefaId].feito,true);
  await assert.rejects(m.ponte.executar(acao('alterar_tarefa',{tarefaId:'INEXISTENTE',feito:true}),crypto.randomUUID()));
});
test('assinatura usa campo próprio e confirma o Calendar só após retorno real; execução não se repete',async()=>{
  const m=mundo(),id=crypto.randomUUID();let chamadas=0;
  m.data.casos.C1.prazo='Prazo da tarefa preservado';
  m.env.sincronizarAssinatura=async(cid,c)=>{chamadas++;assert.equal(cid,'C1');assert.equal(c.agendado,'2026-11-12T14:00');return {ok:true,eventId:'E1'};};
  const a=acao('agendar_assinatura',{dataHora:'2026-11-12T14:00',descricao:'Assinatura do caso fictício'});
  const r=await m.ponte.executar(a,id);assert.equal(r.status,'assinatura_agendada');assert.match(r.mensagem,/confirmado no Google Calendar/);
  assert.equal(m.data.casos.C1.agendado,'2026-11-12T14:00');assert.equal(m.data.casos.C1.prazo,'Prazo da tarefa preservado');
  await m.ponte.executar(a,id);assert.equal(chamadas,1);
});
test('assinatura rejeita datas inválidas, data passada e troca de horário não conferida',async()=>{
  for(const dataHora of ['amanhã às 14h','2026-02-30T14:00','2026-11-12T24:00'])assert.throws(()=>P.acao(acao('agendar_assinatura',{dataHora}),['C1']));
  const m=mundo();m.env.sincronizarAssinatura=async()=>{throw Error('Não deve ser chamado');};
  await assert.rejects(m.ponte.executar(acao('agendar_assinatura',{dataHora:'2026-11-10T14:00'}),crypto.randomUUID()),/já passou/);
  m.data.casos.C1.agendado='2026-11-12T10:00';
  await assert.rejects(m.ponte.executar(acao('agendar_assinatura',{dataHora:'2026-11-12T14:00'}),crypto.randomUUID()),/outra data/);
  assert.equal(m.data.casos.C1.agendado,'2026-11-12T10:00');
});
test('recusa do banco impede envio ao Calendar; falha do Calendar preserva data sem anunciar confirmação',async()=>{
  const negado=mundo({recusarEscrita:true});let chamadas=0;
  negado.env.sincronizarAssinatura=async()=>{chamadas++;return {ok:true};};
  await assert.rejects(negado.ponte.executar(acao('agendar_assinatura',{dataHora:'2026-11-12T14:00'}),crypto.randomUUID()));assert.equal(chamadas,0);
  const m=mundo();m.data.casos.C1.agendado='2026-11-12T10:00';m.env.sincronizarAssinatura=async()=>({ok:false});
  const r=await m.ponte.executar(acao('agendar_assinatura',{dataHora:'2026-11-12T14:00',anterior:'2026-11-12T10:00'}),crypto.randomUUID());
  assert.equal(r.status,'assinatura_salva');assert.match(r.mensagem,/Não consegui confirmar/);assert.equal(m.data.casos.C1.agendado,'2026-11-12T14:00');
});
test('orçamento usa o motor real, preserva versões e não expõe totais no recibo público',async()=>{
  const m=mundo(),id=crypto.randomUUID();
  const a=acao('preparar_orcamento',{atoId:'compra-venda',valores:{transacao:50000000},imovelMunicipio:'São Paulo',imovelUf:'SP'});
  const r=await m.ponte.executar(a,id);assert.equal(r.status,'orcamento_salvo');
  const o=m.data.orcamentos[r.orcamentoId];assert.equal(o.entrada.valores.transacao,50000000);assert.equal(o.versao,1);assert.ok(o.resultado.totais.total>0);
  const publico=m.data.casos.C1.joaninhaOperacoes[id].resultado;assert.equal(publico.totais,undefined);assert.equal(publico.imagem,undefined);
  await m.ponte.executar(a,id);assert.equal(Object.keys(m.data.orcamentos).length,1);
  const r2=await m.ponte.executar(a,crypto.randomUUID());assert.equal(r2.versao,2);assert.deepEqual(m.data.orcamentos[r.orcamentoId],o);
});
test('sem dados essenciais não anuncia orçamento pronto; sem acesso não lê valores',async()=>{
  const m=mundo();const r=await m.ponte.executar(acao('preparar_orcamento',{atoId:'compra-venda',valores:{}}),crypto.randomUUID());
  assert.equal(r.status,'precisa_dados');assert.ok(r.faltando.length>0);assert.equal(Object.keys(m.data.orcamentos).length,0);
  const fechado=mundo({autorizado:false});
  const c=await fechado.ponte.consultar('C1');assert.equal(typeof c.orcamentos,'string');
  await assert.rejects(fechado.ponte.executar(acao('preparar_orcamento',{atoId:'compra-venda',valores:{transacao:50000000}}),crypto.randomUUID()),/Financeiro/);
});
test('recusa do banco nunca produz confirmação nem alteração parcial',async()=>{
  const m=mundo({recusarEscrita:true});await assert.rejects(m.ponte.executar(acao('anotar_caso',{texto:'Não salvar.'}),crypto.randomUUID()),/recusou/);
  assert.equal(m.data.casos.C1.obs,'Observação anterior.');
});
test('leitura de documento informa o trecho e a falta de conteúdo, sem inventar leitura',async()=>{
  const m=mundo();m.data.casos.C1.documentos.D1.texto='a'.repeat(16000);
  let r=await m.ponte.executar(acao('ler_documento',{documentoId:'D1',inicio:0}));assert.equal(r.texto.length,12000);assert.equal(r.parcial,true);
  r=await m.ponte.executar(acao('ler_documento',{documentoId:'D1',inicio:r.fim}));assert.equal(r.texto.length,4000);assert.equal(r.parcial,false);
  r=await m.ponte.executar(acao('ler_documento',{documentoId:'D2'}));assert.equal(r.status,'sem_leitura');
});
test('minuta usa os documentos inteiros, confirma o job e só conclui a tarefa quando pronto',async()=>{
  const m=mundo(),eventos=[];m.ponte.ouvir(e=>eventos.push(e));const id=crypto.randomUUID();
  m.data.casos.C1.documentos.D1.texto='Documento fictício integral.\n'.repeat(1000);
  const r=await m.ponte.executar(acao('gerar_minuta',{instrucao:'Preservar todas as cláusulas.'}),id);
  assert.equal(r.status,'aguardando');assert.ok(m.minutas[0].documentos.includes(m.data.casos.C1.documentos.D1.texto));assert.equal(m.minutas[0].instrucao,'Preservar todas as cláusulas.');
  const op=m.data.casos.C1.joaninhaOperacoes[id];assert.equal(m.data.casos.C1.tarefasJoaninha[op.tarefaId].feito,false);
  await m.ponte.executar(acao('gerar_minuta',{instrucao:'Preservar todas as cláusulas.'}),id);assert.equal(m.minutas.length,1);
  m.data.jobs[r.jobId]={status:'done',ok:true,docUrl:'https://docs.google.com/document/d/teste',docNome:'Minuta fictícia',avisos:[],truncada:false};
  await m.agendados.shift()();
  assert.equal(m.data.casos.C1.tarefasJoaninha[op.tarefaId].feito,true);
  assert.equal(m.data.casos.C1.tarefasJoaninha[id+'-revisar'].feito,false);
  assert.equal(eventos[0].status,'minuta_pronta');assert.equal(m.data.casos.C1.joaninhaOperacoes[id].status,'concluida');
});
test('sem modalidade ou documento lido não dispara geração por suposição',async()=>{
  const m=mundo();delete m.data.casos.C1.modalidade;
  const r=await m.ponte.executar(acao('gerar_minuta',{instrucao:'Minuta de teste.'}),crypto.randomUUID());assert.equal(r.status,'precisa_dados');assert.equal(m.minutas.length,0);
});
test('minuta truncada mantém aviso e tarefa de revisão, sem anunciar sucesso completo',async()=>{
  const m=mundo(),eventos=[];m.ponte.ouvir(e=>eventos.push(e));const id=crypto.randomUUID();
  const r=await m.ponte.executar(acao('gerar_minuta',{instrucao:'Teste integral.'}),id);
  m.data.jobs[r.jobId]={status:'done',ok:true,truncada:true,docUrl:'https://docs.google.com/document/d/parcial',avisos:['Conferir final']};
  await m.agendados.shift()();assert.equal(eventos[0].status,'minuta_com_avisos');assert.match(eventos[0].mensagem,/incompleto/);
  assert.match(m.data.casos.C1.tarefasJoaninha[id+'-revisar'].texto,/possível corte/);
});
test('rejeição explícita ao iniciar a minuta não deixa acompanhamento falso',async()=>{
  const m=mundo(),id=crypto.randomUUID();m.env.fetch=async()=>Response.json({ok:false,erro:'Pedido inválido.'},{status:400});
  await assert.rejects(m.ponte.executar(acao('gerar_minuta',{}),id),/Pedido inválido/);
  assert.equal(m.agendados.length,0);assert.equal(m.data.casos.C1.joaninhaOperacoes[id].status,'falhou');
  assert.match(Object.values(m.data.casos.C1.tarefasJoaninha)[0].texto,/falha/);
});
test('aprovação do orçamento atualiza somente tarefas correspondentes e preserva tarefas da equipe',async()=>{
  const m=mundo();m.data.casos.C1.tarefasJoaninha={T1:{texto:'Enviar orçamento',feito:false,origem:'orcamento',orcamentoId:'O1',concluirQuando:'orcamento_aprovado'},T2:{texto:'Conferir documentos',feito:false,origem:'comando'}};
  m.ponte.observar(clone(m.data.casos));
  m.data.casos.C1.orcAprovacao={orcId:'O1',em:Date.now()};m.ponte.observar(clone(m.data.casos));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(m.data.casos.C1.tarefasJoaninha.T1.feito,true);
  assert.equal(m.data.casos.C1.tarefasJoaninha.T1.concluidaPorEvento,'orcamento_aprovado');
  assert.equal(m.data.casos.C1.tarefasJoaninha.T2.feito,false);
});
test('planejamento mantém o histórico, valida o card e não executa ações no servidor',async()=>{
  const anterior=globalThis.fetch,chave=process.env.OPENAI_API_KEY;let recebido;
  globalThis.fetch=async(url,req)=>{recebido=JSON.parse(req.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({resposta:'Posso anotar isso.',acoes:[acao('anotar_caso',{texto:'Conferir matrícula.'})]})}]}]});};process.env.OPENAI_API_KEY='teste';
  try{
    let status,body;const res={status(n){status=n;return this;},json(v){body=v;return this;}};
    await handler({body:{pergunta:'Sim, anote no caso.',casos:[{id:'C1',nome:'JRL fictícia'}],casoId:'C1',historico:[{role:'user',content:'A matrícula chegou.'},{role:'assistant',content:'Quer uma anotação?'}]}},res);
    assert.equal(status,200);assert.equal(body.acoes[0].casoId,'C1');assert.ok(recebido.input.some(m=>m.content==='A matrícula chegou.'));assert.equal(recebido.text.format.type,'json_object');assert.match(recebido.input[0].content,/JSON/);
    await handler({body:{pergunta:'x',casos:[{id:'C1/errado'}]}},res);assert.equal(status,400);
  }finally{globalThis.fetch=anterior;if(chave===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=chave;}
});
test('comando original da minuta é anexado integralmente sem depender da cópia do modelo',async()=>{
  const anterior=globalThis.fetch,chave=process.env.OPENAI_API_KEY;
  globalThis.fetch=async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({resposta:'Vou preparar a minuta.',acoes:[acao('gerar_minuta',{instrucao:'Instrução curta do modelo.'})]})}]}]});process.env.OPENAI_API_KEY='teste';
  const original='Manter a cláusula fictícia exatamente como segue.\n'.repeat(200);
  try{
    let body;const res={status(){return this;},json(v){body=v;return this;}};
    await handler({body:{pergunta:'Concluir o plano com os dados consultados.',ultimoComando:original,casos:[{id:'C1',nome:'JRL fictícia'}]}},res);
    assert.equal(body.ok,true);assert.ok(body.acoes[0].dados.instrucao.endsWith(original));
  }finally{globalThis.fetch=anterior;if(chave===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=chave;}
});
