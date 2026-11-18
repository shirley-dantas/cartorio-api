import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const codigo=html.slice(html.indexOf('const minutasPendentesMemoria='),html.indexOf('window.gerarReeditar='));
function mundo(armazenamento=new Map()){
  let tempo=0;const requisicoes=[];
  const ctx={crypto:webcrypto,AbortSignal,Date:class extends Date{static now(){return tempo;}},localStorage:{getItem:k=>armazenamento.get(k)||null,setItem:(k,v)=>armazenamento.set(k,v),removeItem:k=>armazenamento.delete(k)},setTimeout:(f,t)=>{tempo+=t;f();},fetch:async(url,opcoes={})=>{requisicoes.push({url,opcoes});return ctx.responder(url,opcoes);}};
  ctx.responder=async(url,opcoes)=>opcoes.method==='POST'?Response.json({ok:true,jobId:'joaninha-'+JSON.parse(opcoes.body).solicitacaoId}):Response.json(null);
  vm.createContext(ctx);vm.runInContext(codigo+'\nthis.api={registroMinutaPendente,iniciarMinutaPendente,aguardarJobFirebase};',ctx);
  return {ctx,api:ctx.api,requisicoes,armazenamento,tempo:()=>tempo};
}
test('pedido fica registrado antes do envio e retomar após recarregar não inicia outra minuta',async()=>{
  const m=mundo();const primeiro=await m.api.iniciarMinutaPendente('C1','gerar',{documentos:'Documento integral.'});
  assert.match(primeiro.jobId,/^joaninha-/);assert.equal(m.requisicoes.length,1);
  const recarregado=mundo(m.armazenamento);
  assert.equal((await recarregado.api.iniciarMinutaPendente('C1','gerar',{})).jobId,primeiro.jobId);
  assert.equal(recarregado.requisicoes.length,0);
});
test('resultado que chega depois de sete minutos é recebido sem excluir o job',async()=>{
  const m=mundo(),progresso=[];
  m.ctx.responder=async url=>url.includes('/rodadas.json')?Response.json(1):Response.json(m.tempo()>=9*60*1000?{status:'done',ok:true,docUrl:'https://docs.google.com/document/d/ficticio'}:null);
  const d=await m.api.aguardarJobFirebase('J1',(i,p)=>progresso.push(p),{minuta:true});
  assert.equal(d.ok,true);assert.ok(m.tempo()>=9*60*1000);assert.ok(progresso.some(p=>p.rodadas===1));
  assert.ok(m.requisicoes.every(r=>!r.opcoes.method||r.opcoes.method==='GET'));
});
test('fim da janela de acompanhamento mantém a execução pendente e não a trata como geração falhada',async()=>{
  const m=mundo();await m.api.iniciarMinutaPendente('C1','gerar',{});
  const id=m.api.registroMinutaPendente('C1','gerar').jobId;
  await assert.rejects(m.api.aguardarJobFirebase(id,null,{minuta:true}),e=>e.pendente&&/não confirma falha/.test(e.message));
  assert.equal(m.api.registroMinutaPendente('C1','gerar').jobId,id);
  assert.equal(m.requisicoes.filter(r=>r.opcoes.method==='POST').length,1);
});
test('rede incerta preserva identificador; rejeição explícita antes de enviar libera o pedido',async()=>{
  const m=mundo();m.ctx.responder=async()=>{throw Error('Conexão interrompida');};
  await assert.rejects(m.api.iniciarMinutaPendente('C1','gerar',{}));assert.ok(m.api.registroMinutaPendente('C1','gerar'));
  const n=mundo();n.ctx.responder=async()=>Response.json({ok:false,erro:'Pedido inválido.'},{status:400});
  await assert.rejects(n.api.iniciarMinutaPendente('C1','gerar',{}),/Pedido inválido/);assert.equal(n.api.registroMinutaPendente('C1','gerar'),null);
});
