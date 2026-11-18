import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {criarServico,validarFrase,segundosAteAmanha}=require('../lib/frase-do-dia');
const {iniciarFraseDoDia,diaEmSP}=await import('../lib/frase-do-dia-cliente.js');

test('frase do dia compartilha geração concorrente e muda na virada em São Paulo',async()=>{
 let data=new Date('2026-11-12T23:00:00Z'),chamadas=0;
 const servico=criarServico({agora:()=>data,gerar:async op=>{
  chamadas++;assert.equal(op.max_tokens,160);assert.equal(op.messages.length,1);
  return chamadas===1?'Cada pequeno avanço merece ser reconhecido.':'Seu cuidado faz diferença em cada detalhe.';
 }});
 const resultados=await Promise.all([servico(),servico(),servico()]);
 assert.equal(chamadas,1);assert.deepEqual(resultados[0],resultados[2]);assert.equal(resultados[0].origem,'ia');
 data=new Date('2026-11-13T02:59:59Z');assert.deepEqual(await servico(),resultados[0]);assert.equal(chamadas,1);
 data=new Date('2026-11-13T03:00:00Z');const novo=await servico();assert.equal(chamadas,2);assert.equal(novo.data,'2026-11-13');assert.notEqual(novo.frase,resultados[0].frase);
 assert.equal(segundosAteAmanha(new Date('2026-11-13T02:59:58Z'),'2026-11-12'),1);
});
test('reserva curta em falha, corte, texto excessivo ou HTML; falha não dispara repetição no dia',async()=>{
 for(const gerar of [async()=>{throw new Error('429');},async()=>'<b>Mensagem</b>',async()=>'x'.repeat(101),async()=>'Uma frase.\nOutra frase.']){
  let chamadas=0;const servico=criarServico({agora:()=>new Date('2026-11-12T12:00:00Z'),gerar:async()=>{chamadas++;return gerar();}});
  const r=await servico();assert.equal(r.origem,'reserva');assert.ok(validarFrase(r.frase));assert.deepEqual(await servico(),r);assert.equal(chamadas,1);
 }
});
test('cliente guarda a frase por dia, troca em painel aberto e tolera armazenamento indisponível',async()=>{
 const anterior={document:globalThis.document,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
 const documento=new EventTarget();documento.hidden=false;globalThis.document=documento;
 let verificar;globalThis.setInterval=f=>{verificar=f;return 1;};globalThis.clearInterval=()=>{};
 let data=new Date('2026-11-12T12:00:00Z'),chamadas=0;const valores=new Map();
 const armazenamento=()=>({getItem:k=>valores.get(k),setItem:(k,v)=>valores.set(k,v)});
 const buscar=async()=>{chamadas++;return Response.json({ok:true,data:diaEmSP(data),frase:chamadas===1?'Seu cuidado faz diferença em cada detalhe.':'Um passo de cada vez constrói conquistas.'});};
 const elemento={textContent:''};let parar;
 const concluir=()=>new Promise(r=>setImmediate(r));
 try{
  parar=iniciarFraseDoDia(elemento,{buscar,armazenamento,agora:()=>data});await concluir();assert.equal(chamadas,1);const primeira=elemento.textContent;
  parar();parar=iniciarFraseDoDia(elemento,{buscar,armazenamento,agora:()=>data});await concluir();assert.equal(chamadas,1);assert.equal(elemento.textContent,primeira);
  data=new Date('2026-11-13T03:00:01Z');verificar();await concluir();assert.equal(chamadas,2);assert.notEqual(elemento.textContent,primeira);
  parar();parar=iniciarFraseDoDia(elemento,{buscar:async()=>{throw new Error('Offline');},armazenamento:()=>{throw new Error('Sem armazenamento');},agora:()=>data});await concluir();assert.ok(validarFrase(elemento.textContent));
 }finally{parar?.();globalThis.document=anterior.document;globalThis.setInterval=anterior.setInterval;globalThis.clearInterval=anterior.clearInterval;}
});
test('rota compartilhada não gera frases em métodos inválidos ou com parâmetros arbitrários',async()=>{
 let status;const res={status:n=>{status=n;return res;},json:()=>res};
 const handler=require('../api/perguntar-joaninha');
 await handler({method:'POST',query:{acao:'frase-dia'},url:'/?acao=frase-dia'},res);assert.equal(status,405);
 await handler({method:'GET',query:{acao:'frase-dia'},url:'/?acao=frase-dia&texto=injetado'},res);assert.equal(status,400);
});
test('rota GET retorna somente frase pública e cache com validade até a virada do dia',async()=>{
 const ia=require('../lib/ia'),antes=ia.texto;let chamadas=0,saida,status;const cabecalhos={};
 ia.texto=async op=>{chamadas++;assert.doesNotMatch(JSON.stringify(op),/casosAtivos|CPF|financeiro/);return 'Seu cuidado faz diferença em cada detalhe.';};
 const res={status:n=>{status=n;return res;},json:d=>{saida=d;return res;},setHeader:(k,v)=>{cabecalhos[k]=v;}};
 try{
  const handler=require('../api/perguntar-joaninha');
  await handler({method:'GET',url:'/?acao=frase-dia',query:{acao:'frase-dia'}},res);
  assert.equal(status,200);assert.equal(saida.origem,'ia');assert.equal(saida.frase,'Seu cuidado faz diferença em cada detalhe.');
  assert.match(cabecalhos['Cache-Control'],/s-maxage=\d+/);
  await handler({method:'GET',url:'/?acao=frase-dia',query:{acao:'frase-dia'}},res);assert.equal(chamadas,1);
 }finally{ia.texto=antes;}
});
