// A tabela oficial de juros do ITCMD (DICAR/SEFAZ-SP) — sem rede: a leitura
// do PDF já veio pronta (pdf-parse rodou uma vez de verdade contra o anexo
// real do Comunicado DICAR-73/26, e o texto está congelado em
// testes/fixtures/dicar-exemplo.txt). O que se testa aqui é só a conta —
// achar a linha/coluna certa e aplicar o ajuste do último dia útil.
import { readFileSync } from 'node:fs';
import { extrairTabela, coeficienteDaTabela, ehUltimoDiaUtil, paraIsoExtenso } from '../lib/dicar-itcmd.js';

let ok_ = 0, falhas = 0;
function ok(nome, cond, extra) {
  if (cond) { ok_++; console.log('  ok  ' + nome); }
  else { falhas++; console.log('  FALHOU  ' + nome + (extra !== undefined ? '  ->  ' + JSON.stringify(extra) : '')); }
}

console.log('— A tabela oficial de juros do ITCMD (DICAR/SEFAZ-SP) —');

const texto = readFileSync(new URL('./fixtures/dicar-exemplo.txt', import.meta.url), 'utf8');
const tabela = extrairTabela(texto);

ok('leu a data de vigência da tabela ("aplicável até")', tabela.aplicavelAte === '2026-11-30', tabela.aplicavelAte);
ok('leu o coeficiente de JUNHO/2020 (o do gabarito da pesquisa)', tabela.coeficientes.JUNHO[2020] === 0.818, tabela.coeficientes.JUNHO);
ok('leu o coeficiente de JANEIRO/2006 (primeira coluna, maior valor)', tabela.coeficientes.JANEIRO[2006] === 2.5948);
ok('mês coberto pela própria tabela (DEZEMBRO/2026) vem "-" no PDF — não entra na matriz',
  tabela.coeficientes.DEZEMBRO[2026] === undefined);
ok('as 12 linhas (meses) foram lidas', Object.keys(tabela.coeficientes).length === 12,
  Object.keys(tabela.coeficientes));

ok('coeficienteDaTabela acha a célula certa (linha × coluna)',
  coeficienteDaTabela(tabela, 'JUNHO', 2020, false) === 0.818);
ok('vencimento no último dia útil do mês deduz 0,0100 (nota de rodapé da própria tabela)',
  coeficienteDaTabela(tabela, 'JUNHO', 2020, true) === 0.808);
ok('mês/ano fora da tabela devolve null, nunca inventa número',
  coeficienteDaTabela(tabela, 'DEZEMBRO', 2026, false) === null);

ok('30/06/2026 é o último dia útil de junho (terça)', ehUltimoDiaUtil('2026-06-30'));
ok('15/06/2026 não é o último dia útil', !ehUltimoDiaUtil('2026-06-15'));
// Outubro/2026 termina num sábado (31) — o último dia útil recua pro dia 30.
ok('mês que termina em fim de semana recua pro último dia útil', ehUltimoDiaUtil('2026-10-30') && !ehUltimoDiaUtil('2026-10-31'));

ok('texto sem "APLICÁVEIS ATÉ" não é tabela — devolve null, não quebra', extrairTabela('lixo qualquer') === null);

// A ementa da PÁGINA (não do PDF) escreve a data por extenso — achado em
// 27/11/2026, ao testar contra a página real da SEFAZ: a busca nunca achava
// nada porque procurava "30/11/2026" onde só havia "30 de novembro de 2026".
ok('data por extenso, como a ementa de verdade escreve',
  paraIsoExtenso('aplicáveis até 30 de novembro de 2026 para os débitos') === '2026-11-30');
ok('mês com cedilha (março)', paraIsoExtenso('até 5 de março de 2027') === '2027-03-05');
ok('texto sem data por extenso devolve null', paraIsoExtenso('30/11/2026') === null);

console.log(`\n${ok_} ok, ${falhas} falha(s).`);
if (falhas) process.exit(1);
console.log('Tudo certo.');
