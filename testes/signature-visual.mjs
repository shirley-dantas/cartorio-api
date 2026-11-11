// Teste estático da experiência opt-in PRIME Signature.
// Executar a partir da raiz: node testes/signature-visual.mjs
// Sem Firebase, sem rede, sem leitura de dados reais.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../prime-signature-experimental.css', import.meta.url), 'utf8');
const must = (str,why)=>assert(html.includes(str),why);

must("get('signature')==='1'",'O opt-in precisa exigir ?signature=1');
must("primeSignatureCSS.href='/prime-signature-experimental.css'",'CSS opt-in não referenciado');
assert.equal((html.match(/prime-signature-experimental\.css/g)||[]).length,1,'O CSS deve ser importado somente por opt-in');
assert(css.includes('html.prime-signature .sidebar'), 'CSS da lateral deve ser isolado');
assert(css.includes('html.prime-signature .cdc2-calendario'), 'Calendário deve manter estilo isolado');
assert(css.includes('html.prime-signature .cdc2-card'), 'Central deve ter cartões isolados');
must('id="sidebar-etapas"','Não pode remover filtros laterais');
for(const id of ['cdc2-cal-grid','cdc-tab-ag-hoje','cdc-tab-ag-amanha','cdc-tab-ag-semana',
  'cc-envios','cc-pagamentos','cc-entrada','cc-jornal','cdc-aba-shirley','cdc-aba-grazi']) {
  must('id="'+id+'"','Elemento indispensável ausente: '+id);
}
assert(css.includes('Joaninha (#joaninha-host) permanece intacta'), 'Joaninha não pode ser substituída por mock');
assert(!css.includes('display:none!important'), 'O tema não deve esconder funções existentes');
console.log('PRIME Signature: verificações estáticas OK; navegador e permissões ainda exigem testes.');
