import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {calcularAtencoes,chaveAtencaoCaso,chaveAtencaoNota} from '../lib/atencoes-dia.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const trecho=html.slice(html.indexOf('const DEP_CONFIG='),html.indexOf('const NOMES_RESP='));
const config=JSON.parse(JSON.stringify(vm.runInNewContext(trecho+'\nDEP_CONFIG')));
const agora=new Date('2026-11-12T15:00:00Z');
const caso=(id,extra={})=>({id,nome:'Caso fictício '+id,dep:'Minutando',depDesde:'2026-11-08',atualizado:'2026-11-08',resp:'grazi',obs:'Observação anterior',...extra});
const calcular=extra=>calcularAtencoes({config,agora,...extra});

test('cada etapa usa seu prazo; caso com avanço recente e concluído não aparece',()=>{
 const c=[caso('M'),caso('R',{dep:'Registro de Imóveis',depDesde:'2026-11-01',atualizado:'2026-11-01'}),caso('R2',{dep:'Registro de Imóveis',depDesde:'2026-10-01',atualizado:'2026-10-01'}),caso('F',{atualizado:'2026-11-12'}),caso('C',{concluido:true})];
 const r=calcular({casos:c});assert.deepEqual(r.ativas.map(i=>i.id),['M','R2']);
 assert.equal(r.ativas.find(i=>i.id==='M').prazo,2);assert.equal(r.ativas.find(i=>i.id==='R2').prazo,30);
 assert.match(r.ativas[0].motivo,/4 dias/);
});
test('documento recebido, histórico, conferência ou tarefa recente reavaliam o aviso; data futura de assinatura não finge avanço',()=>{
 for(const extra of [{documentos:{D:{salvoEm:'2026-11-12T14:00:00Z'}}},{historico:{H:{data:'2026-11-12T14:00:00Z'}}},{auditoria:{atualizado:'2026-11-12T14:00:00Z'}},{tarefasJoaninha:{T:{atualizadoEm:'2026-11-12T14:00:00Z'}}}])assert.equal(calcular({casos:[caso('M',extra)]}).ativas.length,0);
 assert.equal(calcular({casos:[caso('M',{agendado:'2026-12-01T14:00'})]}).ativas.length,1);
 assert.equal(calcular({casos:[caso('M',{historico:{H:{data:'2026-12-01T14:00:00Z'}}})]}).ativas.length,1);
 assert.equal(calcular({casos:[caso('M',{dep:'Etapa desconhecida'})]}).ativas.length,0);
});
test('nota vence pela hora; conclusão ou reagendamento retiram o aviso, com responsável preservado',()=>{
 const notas=[{id:'N',text:'Retornar ligação',resp:'shirley',quando:'2026-11-12T11:30'},{id:'F',quando:'2026-11-12T12:30'},{id:'C',quando:'2026-11-11T10:00',done:true}];
 const r=calcular({notas,nome:'Shirley'});assert.equal(r.ativas.length,1);assert.equal(r.ativas[0].responsavel,'Shirley');assert.equal(r.tarefas,1);assert.match(r.resumo,/Shirley/);
 assert.match(r.ativas[0].motivo,/hoje, às 11h30/);
 assert.match(calcular({notas:[{...notas[0],quando:'2026-11-11T10:00'}]}).ativas[0].motivo,/ontem, às 10h/);
 assert.equal(calcular({notas:[{...notas[0],quando:'2026-11-13T11:30'}]}).ativas.length,0);
 assert.equal(calcular({notas:[{...notas[0],done:true}]}).ativas.length,0);
});
test('adiamento volta no horário e perde validade quando a etapa ou o conteúdo mudam',()=>{
 const c=caso('M'),chave=chaveAtencaoCaso(c),resolucoes={[chave]:{estado:'atencao_adiada',ate:'2026-11-12T13:00'}};
 const r=calcular({casos:[c],resolucoes});assert.equal(r.ativas.length,0);assert.equal(r.adiadas.length,1);assert.equal(r.todas.length,1);
 assert.equal(calcular({casos:[c],resolucoes,agora:new Date('2026-11-12T16:00:00Z')}).ativas.length,1);
 assert.equal(calcular({casos:[{...c,dep:'Nota de exigência'}],resolucoes}).ativas.length,1);
 assert.notEqual(chaveAtencaoCaso({...c,obs:'Novo andamento'}),chave);
 const n={id:'N',text:'Retornar ligação',quando:'2026-11-12T11:00'};
 assert.notEqual(chaveAtencaoNota(n),chaveAtencaoNota({...n,quando:'2026-11-12T10:00'}));
});
test('prioridades são limitadas, Ver todas preserva o restante e a leitura não altera os dados',()=>{
 const casos=Array.from({length:8},(_,i)=>caso('C'+i)),antes=structuredClone(casos);
 const r=calcular({casos,limite:3});assert.equal(r.prioridades.length,3);assert.equal(r.todas.length,8);assert.deepEqual(casos,antes);
 const c=caso('M',{historico:{A:{data:'2026-11-05'},B:{data:'2026-11-04'}}});
 assert.equal(chaveAtencaoCaso(c),chaveAtencaoCaso({...c,historico:{B:c.historico.B,A:c.historico.A}}),'ordem das propriedades não muda o aviso');
});
