import test from 'node:test';
import assert from 'node:assert/strict';
import {horarioNota,ordenarNotasPorHorario} from '../lib/notas-horario.js';

test('nota vence pela hora de São Paulo, inclusive ainda no mesmo dia',()=>{
 const agora=new Date('2026-11-12T15:00:00Z');
 const vencida=horarioNota('2026-11-12T11:30',agora);
 assert.equal(vencida.atrasada,true);assert.equal(vencida.campo,'2026-11-12T11:30');
 assert.equal(vencida.texto,'12/11/2026 às 11:30');
 assert.equal(horarioNota('2026-11-12T12:30',agora).atrasada,false);
 assert.equal(horarioNota('2026-11-12T14:30:00Z',agora).campo,'2026-11-12T11:30');
});
test('notas antigas com só data não ganham horário inventado nem vencem antes do fim do dia',()=>{
 const nota=horarioNota('2026-11-12',new Date('2026-11-12T22:00:00Z'));
 assert.equal(nota.texto,'12/11/2026');assert.equal(nota.campo,'');assert.equal(nota.atrasada,false);assert.equal(nota.soDia,true);
 assert.equal(horarioNota('2026-11-12',new Date('2026-11-13T03:00:00Z')).atrasada,true);
 for(const invalida of [null,'','não é data','2026-02-30T12:00','2026-15-01T12:00','2026-11-12T99:00'])assert.equal(horarioNota(invalida),null);
});
test('datas próximas primeiro; notas sem data mantêm sua ordem e o original fica intacto',()=>{
 const notas=[{id:'A'},{id:'B',quando:'2026-11-13T10:00'},{id:'C'},{id:'D',quando:'2026-11-12T10:00'}];
 assert.deepEqual(ordenarNotasPorHorario(notas).map(n=>n.id),['D','B','A','C']);
 assert.deepEqual(notas.map(n=>n.id),['A','B','C','D']);
});
