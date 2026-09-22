// Gera bussola/fin-motor.js a partir do index.html do painel.
//
// O Bússola mostra o salário do cartório, e o salário não se digita: é a
// soma das comissões das escrituras pagas no fechamento (ver "Meu
// financeiro" no CLAUDE.md). Uma segunda cópia da conta — escrita à mão no
// Bússola — envelheceria em silêncio no dia em que a regra mudasse no
// painel, e os dois passariam a dizer números diferentes. Por isso a conta
// é RECORTADA do index.html, do mesmo jeito que o testes/montar.mjs faz.
//
// Rode depois de mexer no financeiro do painel:
//   node scripts/gerar-bussola-fin.mjs
// O testes/bussola.mjs falha se o arquivo gerado ficou para trás.
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DESTINO = join(RAIZ, 'bussola', 'fin-motor.js');

function linhaDe(html, inicio) {
  const a = html.indexOf(inicio);
  if (a === -1) throw new Error('não achei no index.html: ' + inicio.slice(0, 60));
  return html.slice(a, html.indexOf('\n', a) + 1);
}
function entre(html, inicio, fim) {
  const a = html.indexOf(inicio);
  if (a === -1) throw new Error('não achei no index.html: ' + inicio.slice(0, 60));
  const b = html.indexOf(fim, a);
  if (b === -1) throw new Error('não achei o fim de: ' + inicio.slice(0, 60));
  return html.slice(a, b);
}

export function gerar() {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8');
  const meses = linhaDe(html, 'const MESES=');
  const hoje = linhaDe(html, 'function isoHoje(){');
  // Da configuração padrão até o ciclo do lançamento: o dinheiro, o
  // calendário do fechamento e a conta inteira (finConta).
  const conta = entre(html, 'const FIN_CFG_PADRAO={', 'let finLinhaAberta=null;');
  const salario = entre(html, 'function finMeuSalario(ciclo){', 'let finCicloPessoal=null;');
  // O cofre do "Meu financeiro" (os serviços extras): a mesma derivação de
  // chave e o mesmo destrancar do painel — cifra reescrita à mão seria o
  // pior lugar para uma cópia que envelhece.
  const cofreConst = entre(html, 'const FIN_PBKDF2_VOLTAS=', 'let finCofreBruto=null;');
  const cofreCifra = entre(html, 'function finB64(buf){', '// Sem vogais nem 0/1/O/I');
  const cofreMestra = entre(html, 'async function finImportarMestra(', 'async function finCriarCofre(');
  const cofreAbrir = entre(html, 'async function finDestrancar(', 'async function finGravarCofre(');
  const pessoal = entre(html, 'function finPessoalDoCiclo(){', 'function finHtmlPessoal(){');
  return `// ════════════════════════════════════════════════════════════════════
// GERADO por scripts/gerar-bussola-fin.mjs a partir do index.html do painel.
// NÃO EDITAR À MÃO — mexa no painel e rode o script de novo.
//
// É a conta do salário do cartório e o cofre dos serviços extras, os mesmos
// do "Meu financeiro". A conta: comissão
// que nasce da parte do tabelião, repasse truncado, quotas por arranjo,
// fechamento de 26 a 25 antecipando feriado. O Bússola só entrega os
// lançamentos e a configuração lidos do banco e pede o total.
// ════════════════════════════════════════════════════════════════════
(function(){
${meses}${hoje}
${conta}
${salario}
${cofreConst}${cofreCifra}${cofreMestra}${cofreAbrir}
let finCofreBruto=null, finChaveMestra=null, finMestraB64=null, finDadosPessoais={lancamentos:[]}, finCicloPessoal=null;
${pessoal}
// Abre o cofre com a senha do Meu financeiro. A chave fica só na memória.
function abrirCofre(cofre, senha){ finCofreBruto = cofre; return finDestrancar(senha, false); }
function trancarCofre(){ finChaveMestra = null; finMestraB64 = null; finDadosPessoais = { lancamentos: [] }; }
function cofreAberto(){ return !!finChaveMestra; }
// O que o Meu financeiro soma no fechamento, como o finHtmlPessoal() faz:
// salário lançado à mão, serviços extras e despesas.
function pessoal(ciclo){
  if (!finChaveMestra) return null;
  finCicloPessoal = ciclo;
  var lista = finPessoalDoCiclo();
  return { salarioManual: finSomaPessoal(lista, 'salario'), extras: finSomaPessoal(lista, 'extra'),
           despesas: finSomaPessoal(lista, 'despesa'), itens: lista };
}
// A mesma regra de finLigarEscuta() no painel: configuração sem pessoas
// cai na padrão, e arranjos ausentes também.
function usar(lancamentos, cfg){
  finLanc = lancamentos || {};
  var v = cfg;
  if (v && Array.isArray(v.pessoas) && v.pessoas.length) {
    finCfg = {
      percentualRepasse: v.percentualRepasse !== undefined ? v.percentualRepasse : FIN_CFG_PADRAO.percentualRepasse,
      percentualIR: v.percentualIR !== undefined ? v.percentualIR : FIN_CFG_PADRAO.percentualIR,
      pessoas: v.pessoas,
      arranjos: Array.isArray(v.arranjos) && v.arranjos.length ? v.arranjos : FIN_CFG_PADRAO.arranjos
    };
  } else {
    finCfg = JSON.parse(JSON.stringify(FIN_CFG_PADRAO));
  }
}
window.BussolaFin = {
  usar: usar,
  salario: finMeuSalario,
  abrirCofre: abrirCofre,
  trancarCofre: trancarCofre,
  cofreAberto: cofreAberto,
  pessoal: pessoal,
  cicloPorChave: finCicloPorChave,
  cicloDaData: finCicloDaData,
  num: finNum,
  cent: finCent,
  moeda: finMoeda
};
})();
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(DESTINO, gerar());
  console.log('bussola/fin-motor.js gerado.');
}
