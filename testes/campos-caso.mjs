import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {opcoesCampo,camposCasoHtml} from '../lib/campos-caso.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const etapas=Array.from(vm.runInNewContext(html.match(/const DEPS=(\[[^\n]+\]);/)[1]));

test('preserva todas as etapas e seus valores, sem acrescentar novas fases',()=>{
 const opcoes=opcoesCampo('dep',etapas);
 assert.deepEqual(opcoes.map(o=>o.valor),Array.from(etapas));
 assert.deepEqual(new Set(opcoes.map(o=>o.grupo)),new Set(['','Preparação e minuta','Pós-assinatura','Pendências e apoio']));
 assert.equal(opcoes.find(o=>o.valor==='').rotulo,'Sem etapa definida');
});
test('mantém os status e oferece somente a equipe atual para novas atribuições',()=>{
 assert.deepEqual(opcoesCampo('status').map(o=>o.valor),['prioridade','critico','atencao','emdia']);
 assert.deepEqual(opcoesCampo('resp').map(o=>o.valor),['shirley','grazi']);
 const caso=Object.freeze({id:'C1',status:'atencao',dep:'Minutando',resp:'gabriel'});
 const campos=camposCasoHtml(caso,etapas);
 assert.match(campos,/Responsável anterior/);
 assert.doesNotMatch(campos,/Gabriel|data-campo-opcao="gabriel"/);
 assert.equal(caso.resp,'gabriel');
});
test('preserva e escapa valores antigos sem convertê-los ou inserir HTML',()=>{
 const caso=Object.freeze({id:'C1',status:'emdia',dep:'<img src=x onerror=alert(1)>',resp:''});
 const campos=camposCasoHtml(caso,etapas);
 assert.match(campos,/&lt;img/);
 assert.doesNotMatch(campos,/<img/);
 assert.match(campos,/Definir responsável/);
 assert.equal(caso.dep,'<img src=x onerror=alert(1)>');
});
