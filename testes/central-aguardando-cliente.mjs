// Regressão da contagem "Aguardando cliente" — dados fictícios; sem Firebase.
// Execute: node testes/central-aguardando-cliente.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const inicio = html.indexOf('const DEP_CONFIG=');
const fim = html.indexOf('const NOMES_RESP=', inicio);
assert(inicio >= 0 && fim > inicio, 'DEP_CONFIG não encontrado');
const trecho = html.slice(inicio, fim) + '\nDEP_CONFIG;';
const config = vm.runInNewContext(trecho);
const contagem = casos => casos.filter(c => !c.concluido && config[c.dep]?.quemSegura === 'cliente').length;
const casos = [
  { dep:'Aguardando aprovação do orçamento', concluido:false },
  { dep:'Aguardando aprovação da minuta', concluido:false },
  { dep:'Aguardando cliente (outro)', concluido:false },
  { dep:'ITBI aguardando pagamento', concluido:false },
  { dep:'Falta documentos', concluido:false },
  { dep:'Aguardando traslado', concluido:false },
  { dep:'Aguardando TQ', concluido:false },
  { dep:'Registro de Imóveis', concluido:false },
  { dep:'Falta assinatura', concluido:false },
  { dep:'Nota de exigência', concluido:false },
  { dep:'Falta documentos', concluido:true }
];
assert.equal(contagem(casos), 5, 'Apenas os cinco casos ativos dependentes do cliente devem contar');
assert.equal(contagem([]), 0, 'Sem casos deve mostrar zero');
assert.equal(contagem([{dep:'Etapa desconhecida',concluido:false}]), 0, 'Etapa desconhecida não pode ser presumida como cliente');
assert.match(html, /document\.getElementById\('cdc2-ind-cliente'\)\.textContent=ativos\.filter\(c=>DEP_CONFIG\[c\.dep\]\?\.quemSegura==='cliente'\)\.length;/, 'Indicador deve usar a classificação de DEP_CONFIG');
console.log('OK: Aguardando cliente usa DEP_CONFIG e ignora concluídos, cartório e terceiros');
