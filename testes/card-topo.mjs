// O alto do card: nome, e logo abaixo a data da assinatura e os dados do registro (passo 2 do card novo).
//   node testes/card-topo.mjs
// Lê o modelo do card no index.html e confere a ordem dos blocos e que nada do que existia sumiu.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import assert from 'node:assert/strict';
const AQUI = dirname(fileURLToPath(import.meta.url)), html = readFileSync(join(AQUI, '..', 'index.html'), 'utf8');
const erros = [];
const passo = async (n, f) => { try { await f(); console.log('  ok  ' + n); } catch (e) { erros.push(n); console.log('FALHA ' + n + ' → ' + (e && e.message)); } };
const ini = html.indexOf('<div class="cx-card ${c.concluido'), fim = html.indexOf('<div class="cx-acoes">', ini);
assert(ini > 0 && fim > ini, 'não achei o modelo do card');
const card = html.slice(ini, fim);
const pos = (t) => { const i = card.indexOf(t); assert(i >= 0, 'falta ' + t); return i; };

await passo('a ordem é: nome, assinatura + registro, status/etapa/responsável, e só depois as faixas', () => {
  const a = pos('class="cx-topo"'), b = pos('class="cx-linha-topo"'), c = pos('class="cx-campos"'), d = pos('class="cx-fin"');
  assert(a < b && b < c && c < d, [a, b, c, d].join(' < '));
});
await passo('a assinatura da escritura e os cinco dados do registro estão no alto, e a assinatura saiu da grade de baixo', () => {
  const topo = card.slice(pos('class="cx-linha-topo"'), pos('class="cx-campos"')), grade = card.slice(pos('class="cx-campos"'), pos('class="cx-fin"'));
  assert(/Assinatura da escritura/.test(topo) && /type="datetime-local"/.test(topo) && /mudarCampo\('\$\{c\.id\}','agendado'/.test(topo));
  assert(/Dados do registro/.test(topo) && /id="cx-reg-\$\{c\.id\}"/.test(topo) && /CX_REG\.map/.test(topo));
  assert(!/Assinatura da escritura/.test(grade) && !/Dados do registro/.test(grade));
  assert.equal((card.match(/Assinatura da escritura/g) || []).length, 1); assert.equal((card.match(/Dados do registro/g) || []).length, 1);
});
await passo('nada que existia sumiu: Status, Etapa e Responsável continuam, e os campos de registro são os cinco de sempre', () => {
  const grade = card.slice(pos('class="cx-campos"'), pos('class="cx-fin"'));
  for (const r of ['Status', 'Etapa', 'Responsável']) assert(grade.includes('>' + r + '<'), r);
  const reg = (html.match(/const CX_REG=\[([\s\S]*?)\];/) || [])[1] || ''; for (const c of ['registroPrenotado', 'prenotacao', 'livro', 'folha', 'controle']) assert(reg.includes("'" + c + "'"), c);
});
await passo('no celular o alto empilha em uma coluna', () => {
  assert(/@media\(max-width:760px\)\{\.cx-linha-topo\{grid-template-columns:1fr\}\}/.test(html));
});
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo'); process.exit(erros.length ? 1 : 0);
