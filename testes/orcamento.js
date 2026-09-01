// ── A conta do orçamento ──
//
// Roda sem navegador e sem internet, por cima do motor recortado do
// index.html publicado. Vários destes testes existem porque o número já foi
// conferido à mão uma vez: o orçamento do apartamento 1301, que veio nas
// instruções de cobrança, é o gabarito de que a leitura da tabela está certa.
let falhas = 0;
function ok(nome, cond, extra){
  if(cond) console.log('  ok  ' + nome);
  else{ falhas++; console.log('FALHA ' + nome + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
const R = c => (c / 100).toFixed(2);

console.log('\n— As tabelas foram lidas inteiras —');
ok('32 faixas na tabela de Notas', ORC_TABELA_NOTAS.faixas.length === 32, ORC_TABELA_NOTAS.faixas.length);
ok('48 faixas na tabela de custas do registro', ORC_TABELA_REGISTRO.faixas.length === 48);
ok('48 faixas na averbação com valor', ORC_TABELA_REGISTRO.faixasAverbacao.length === 48);
// A quarta coluna da tabela de custas é o registro mais a certidão da
// matrícula, e isso vale em TODAS as faixas. É a invariante que prova que a
// tabela foi transcrita certa: um dígito trocado quebra esta linha.
const certidao = ORC_TABELA_REGISTRO.itens['11'].valor;
ok('a certidão do rodapé é R$ 76,54', R(certidao) === '76.54');
ok('em todas as 48 faixas, registro com matrícula = registro + a certidão',
   ORC_TABELA_REGISTRO.faixas.every(f => f[3] === f[2] + certidao),
   ORC_TABELA_REGISTRO.faixas.filter(f => f[3] !== f[2] + certidao));
// A quarta conferência da transcrição, e a mais bonita: a tabela do registro é
// escrita em UFESP. Os tetos das faixas são múltiplos exatos de R$ 38,42 —
// 500, 1.000, 3.000, 5.000 UFESP e por aí. Só as três primeiras faixas fogem,
// por serem valores arredondados que vêm da lei. Um dígito trocado num teto
// quase certamente quebraria o múltiplo: é a UFESP conferindo a tabela.
const U = ORC_TRIBUTOS.ufesp;
ok('a UFESP de 2026 é R$ 38,42', R(U) === '38.42', R(U));
const naoMultiplos = ORC_TABELA_REGISTRO.faixas.filter(f => f[1] !== null && f[1] % U !== 0);
ok('45 das 48 faixas do registro têm teto múltiplo exato da UFESP',
   naoMultiplos.length === 3, naoMultiplos.map(f => R(f[1])));
ok('e as que fogem são as três primeiras, os valores arredondados da lei',
   naoMultiplos.every(f => ORC_TABELA_REGISTRO.faixas.indexOf(f) < 3));
ok('25 faixas na incorporação', ORC_TABELA_REGISTRO.faixasIncorporacao.length === 25);
// Escada sem degrau faltando: qualquer buraco entre faixas viraria um valor
// silenciosamente errado no dia em que uma base caísse dentro dele.
[['Notas', ORC_TABELA_NOTAS.faixas], ['Registro', ORC_TABELA_REGISTRO.faixas],
 ['Averbação', ORC_TABELA_REGISTRO.faixasAverbacao], ['Incorporação', ORC_TABELA_REGISTRO.faixasIncorporacao]]
  .forEach(([nome, f]) => {
    const buracos = f.slice(1).filter((x, i) => x[0] !== f[i][1] + 1);
    ok(`${nome}: nenhuma faixa com buraco`, buracos.length === 0, buracos);
    ok(`${nome}: a última faixa não tem teto`, f[f.length - 1][1] === null);
  });

console.log('\n— O degrau certo para cada base —');
const fl = orcFaixa(ORC_TABELA_NOTAS.faixas, 30186716);
ok('R$ 301.867,16 cai na faixa l', fl.letra === 'l', fl.letra);
ok('e a faixa l vale R$ 4.176,24', R(fl.valor) === '4176.24', R(fl.valor));
ok('o começo exato da faixa entra nela', orcFaixa(ORC_TABELA_NOTAS.faixas, 26894001).letra === 'l');
ok('o fim exato da faixa ainda é dela', orcFaixa(ORC_TABELA_NOTAS.faixas, 30736000).letra === 'l');
ok('um centavo além já é a faixa seguinte', orcFaixa(ORC_TABELA_NOTAS.faixas, 30736001).letra === 'm');
ok('base gigante cai na última faixa', R(orcFaixa(ORC_TABELA_NOTAS.faixas, 99999999999).valor) === '65637.95');
const fj = orcFaixa(ORC_TABELA_REGISTRO.faixas, 30186716);
ok('registro de R$ 301.867,16 é a faixa j', fj.letra === 'j');
ok('e a faixa j dá R$ 2.756,74 de registro', R(fj.valor) === '2756.74', R(fj.valor));
ok('ou R$ 2.833,28 com a matrícula', R(fj.comMatricula) === '2833.28', R(fj.comMatricula));

console.log('\n— O apartamento 1301, o orçamento que ela conferiu à mão —');
// Este é o gabarito da suíte inteira: o orçamento que veio nas instruções de
// cobrança, com a taxa de R$ 300,00 embutida no registro, como ela confirmou.
// Cada linha abaixo é uma linha daquele papel.
const ap = orcCalcular({
  atoId: 'compra-venda', data: '2026-08-27',
  praticadoEm: 'São Paulo', imovelMunicipio: 'São Paulo', imovelUf: 'SP',
  valores: {transacao: 30186716},
  flags: {}, despesas: {prenotacao: true, matricula: true, registroComMatricula: true,
                        taxaAdicional: true, taxaAdicionalValor: 30000}
});
ok('ESCRITURA R$ 4.176,24', R(ap.totais.escritura) === '4176.24', R(ap.totais.escritura));
ok('REGISTRO R$ 3.133,28 — a coluna com matrícula mais os R$ 300,00 embutidos',
   R(ap.totais.registroComDespesas) === '3133.28', R(ap.totais.registroComDespesas));
ok('PRENOTAÇÃO R$ 80,14', R(ap.despesas[0].valor) === '80.14' && ap.despesas[0].item === '12');
ok('MATRÍCULA R$ 76,54', R(ap.despesas[1].valor) === '76.54' && ap.despesas[1].item === '11');
ok('ITBI R$ 9.056,01', R(ap.tributos[0].valor) === '9056.01', R(ap.tributos[0].valor));
ok('TOTAL ESTIMADO R$ 16.522,21', R(ap.totais.total) === '16522.21', R(ap.totais.total));
ok('o total soma tudo', R(ap.totais.total) === R(ap.totais.escritura + ap.totais.registro + ap.totais.despesas + ap.totais.tributos));
// A conta é sempre em centavos inteiros: um total com fração de centavo é
// sinal de que alguém deixou float entrar na escada.
ok('nenhum centavo quebrado no total', Number.isInteger(ap.totais.total), ap.totais.total);
ok('a parte do tabelião não é o total', R(ap.totais.tabeliao) === '2486.77', R(ap.totais.tabeliao));

console.log('\n— As duas certidões de matrícula são de propósito —');
// Ela pede uma certidão para começar o trabalho e outra no fim. Decisão
// tomada não pode ficar pedindo decisão todo dia: saiu dos alertas, mas a
// explicação ficou colada na linha, que é onde alguém pergunta "por que duas?".
ok('não fica mais pedindo decisão sobre isso',
   !ap.alertas.some(a => /duas vezes/.test(a.texto)), ap.alertas.map(a => a.texto));
ok('o CHECK FINAL não trava nem manda conferir',
   ap.check.find(c => c.rot === 'Matrícula').estado === 'ok');
ok('e diz na própria linha que são duas, e por quê',
   /duas certidões, de propósito/i.test(ap.check.find(c => c.rot === 'Matrícula').nota),
   ap.check.find(c => c.rot === 'Matrícula').nota);
const avisoMat = (ap.despesas.find(x => x.item === '11').avisos || [])[0];
ok('a memória explica as duas na linha da matrícula',
   !!avisoMat && /começar o trabalho/.test(avisoMat.texto), avisoMat);
ok('e a explicação vale como confirmada, não como dúvida',
   avisoMat.confianca === 'confirmada');
const umaVez = orcCalcular({
  atoId: 'compra-venda', data: '2026-08-27',
  praticadoEm: 'São Paulo', imovelMunicipio: 'São Paulo', imovelUf: 'SP',
  valores: {transacao: 30186716},
  flags: {}, despesas: {prenotacao: true, matricula: true, registroComMatricula: false,
                        taxaAdicional: true, taxaAdicionalValor: 30000}
});
ok('trocando a coluna, a certidão entra uma vez só e o total cai R$ 76,54',
   R(umaVez.totais.total) === '16445.67', R(umaVez.totais.total));
ok('e aí a linha da matrícula não fala mais em duas',
   !(umaVez.despesas.find(x => x.item === '11').avisos || []).length);
ok('a coluna sem matrícula é a faixa seca', R(umaVez.totais.registro) === '2756.74', R(umaVez.totais.registro));

console.log('\n— A vigência vale até 01/01/2027, e vence depois disso —');
ok('as duas tabelas declaram a vigência',
   ORC_TABELA_NOTAS.vigencia === 'até 01/01/2027' && ORC_TABELA_REGISTRO.vigencia === 'até 01/01/2027');
ok('dentro da vigência, o orçamento fecha', ap.definitivo === true,
   ap.check.filter(c => c.estado === 'falta'));
const vencida = orcCalcular({
  atoId: 'compra-venda', data: '2027-03-10',
  praticadoEm: 'São Paulo', imovelMunicipio: 'São Paulo', imovelUf: 'SP',
  valores: {transacao: 30186716},
  flags: {}, despesas: {prenotacao: true, matricula: true, taxaAdicional: false}
});
ok('ato depois de 01/01/2027 trava', vencida.definitivo === false);
ok('e o painel manda procurar a tabela do exercício novo',
   vencida.alertas.some(a => /exercício novo/.test(a.texto)));

console.log('\n— A taxa adicional NUNCA entra sozinha —');
const semPergunta = orcCalcular({atoId: 'compra-venda', valores: {transacao: 30186716},
  flags: {}, despesas: {prenotacao: true, matricula: true}});
ok('sem resposta, a taxa não é somada', !semPergunta.despesas.some(d => d.interna));
ok('e o orçamento fica travado até ela responder',
   semPergunta.faltando.some(f => f.campo === 'taxaAdicional'));
ok('o CHECK FINAL diz que a pergunta não foi feita',
   semPergunta.check.find(c => c.rot === 'Taxa adicional perguntada').estado === 'falta');
const comTaxa = orcCalcular({atoId: 'compra-venda', valores: {transacao: 30186716},
  flags: {}, despesas: {prenotacao: true, matricula: true, taxaAdicional: true, taxaAdicionalValor: 30000}});
ok('respondido "sim", entra R$ 300,00',
   R(comTaxa.totais.despesas) === R(semPergunta.totais.despesas + 30000));
ok('e no modo cliente ela vai somada ao registro, sem linha própria',
   R(comTaxa.totais.registroComDespesas) === R(comTaxa.totais.registro + 30000));
ok('a linha da taxa fica marcada como interna',
   comTaxa.despesas.filter(d => d.interna).length === 1);
ok('sem registro, ninguém pergunta por taxa de registro',
   !orcCalcular({atoId: 'procuracao', valores: {}, flags: {}, despesas: {}})
     .faltando.some(f => f.campo === 'taxaAdicional'));

console.log('\n— Os 40% do ato secundário —');
const af = orcCalcular({atoId: 'compra-venda-fiduciaria',
  valores: {transacao: 30186716, garantia: 20000000},
  flags: {}, despesas: {taxaAdicional: false}});
ok('duas escrituras: a venda e a garantia', af.escrituras.length === 2);
ok('a venda sai cheia', R(af.escrituras[0].valor) === '4176.24');
const faixaAf = orcFaixa(ORC_TABELA_NOTAS.faixas, 20000000);
ok('a garantia sai com 40% de desconto',
   af.escrituras[1].valor === Math.round(faixaAf.valor * 0.6), [af.escrituras[1].valor, faixaAf.valor]);
ok('a redução fica escrita na linha, para a memória', af.escrituras[1].reducao === 40);
ok('e vem com o aviso de que é regra operacional, não da tabela',
   af.escrituras[1].avisos.some(a => a.confianca === 'operacional'));
ok('dois registros: a aquisição e a garantia', af.registros.length === 2);
ok('o ITBI é só sobre a transação, não sobre a garantia', af.tributos[0].base === 30186716);
ok('a parte do tabelião também leva os 40%',
   af.escrituras[1].tabeliao === Math.round(faixaAf.tabeliao * 0.6));

console.log('\n— Doação com reserva de usufruto: 2/3 e 1/3 —');
const du = orcCalcular({atoId: 'doacao-usufruto', valores: {doacao: 100000001},
  flags: {}, despesas: {taxaAdicional: false}});
ok('as duas partes somam exatamente o valor doado',
   du.escrituras[0].base + du.escrituras[1].base === 100000001,
   [du.escrituras[0].base, du.escrituras[1].base]);
ok('o 1/3 leva os 40%', du.escrituras[1].reducao === 40);
ok('o ITCMD é sobre o valor global, não sobre os 2/3', du.tributos[0].base === 100000001);
ok('ITCMD de 4%', du.tributos[0].aliquota === 4);

console.log('\n— Vagas individualizadas: cada uma na sua faixa —');
const vg = orcCalcular({atoId: 'compra-venda-vagas',
  valores: {unidades: [{rotulo: 'Apartamento 1301', valor: 30186716}, {rotulo: 'Vaga 42', valor: 5000000}]},
  flags: {}, despesas: {taxaAdicional: false}});
ok('uma escritura só, sobre o global', vg.escrituras.length === 1 && vg.escrituras[0].base === 35186716);
ok('dois registros, um por matrícula', vg.registros.length === 2);
ok('o registro do apartamento é o da faixa dele, com matrícula',
   vg.registros[0].valor === orcFaixa(ORC_TABELA_REGISTRO.faixas, 30186716).comMatricula);
ok('o registro da vaga é o da faixa dela, com matrícula',
   vg.registros[1].valor === orcFaixa(ORC_TABELA_REGISTRO.faixas, 5000000).comMatricula);
// Duas matrículas, duas certidões: a coluna com matrícula entra uma vez por
// registro, não uma vez por escritura. Fica visível na memória, linha a linha.
ok('cada matrícula leva a sua certidão',
   vg.totais.registro === orcFaixa(ORC_TABELA_REGISTRO.faixas, 30186716).valor
                        + orcFaixa(ORC_TABELA_REGISTRO.faixas, 5000000).valor
                        + 2 * ORC_TABELA_REGISTRO.itens['11'].valor);
// Registrar a soma daria outro número: é justamente a diferença que esta
// regra existe para não deixar passar.
ok('somar tudo e registrar de uma vez daria outro número',
   vg.totais.registro !== orcFaixa(ORC_TABELA_REGISTRO.faixas, 35186716).comMatricula);
ok('o ITBI é sobre o valor global', vg.tributos[0].base === 35186716);

console.log('\n— Mais de uma matrícula em qualquer ato, não só no ato das vagas —');
// O caso que apareceu no primeiro orçamento de verdade: uma compra e venda
// simples com duas vagas individualizadas. A escritura e o ITBI saem do valor
// do negócio; o registro passa a ser um por matrícula, cada um na sua faixa.
const comVagas = orcCalcular({
  atoId: 'compra-venda', data: '2026-08-27',
  praticadoEm: 'São Paulo', imovelMunicipio: 'São Paulo', imovelUf: 'SP',
  valores: {transacao: 30186716, unidadesRegistro: [
    {rotulo: 'Apartamento', valor: 26186716},
    {rotulo: 'Vaga 1', valor: 2000000},
    {rotulo: 'Vaga 2', valor: 2000000}]},
  flags: {}, despesas: {prenotacao: true, matricula: true, taxaAdicional: false}
});
ok('três registros, um por matrícula', comVagas.registros.length === 3, comVagas.registros.length);
ok('a escritura continua sobre o valor do negócio',
   comVagas.escrituras.length === 1 && comVagas.escrituras[0].base === 30186716);
ok('e o ITBI também', comVagas.tributos[0].base === 30186716);
ok('cada matrícula cai na sua faixa, com a certidão',
   comVagas.totais.registro === orcFaixa(ORC_TABELA_REGISTRO.faixas, 26186716).comMatricula
                              + orcFaixa(ORC_TABELA_REGISTRO.faixas, 2000000).comMatricula
                              + orcFaixa(ORC_TABELA_REGISTRO.faixas, 2000000).comMatricula,
   R(comVagas.totais.registro));
// Registrar tudo de uma vez daria outro número — é a diferença que essa regra
// existe para não deixar passar.
ok('registrar o valor cheio de uma vez daria outro número',
   comVagas.totais.registro !== orcFaixa(ORC_TABELA_REGISTRO.faixas, 30186716).comMatricula);
ok('as matrículas somando o valor do negócio não levantam aviso',
   !comVagas.alertas.some(a => /matrículas somam/.test(a.texto)));
// Três imóveis são três prenotações e três certidões. Cobrar uma só é o erro
// que aparece exatamente neste caso e some no caso de imóvel único — por isso
// a conta é pelo número de registros, não pelo número de escrituras.
const pren = comVagas.despesas.find(x => x.item === '12');
const cert = comVagas.despesas.find(x => x.item === '11');
ok('três prenotações: 80,14 × 3', R(pren.valor) === '240.42', R(pren.valor));
ok('três certidões: 76,54 × 3', R(cert.valor) === '229.62', R(cert.valor));
ok('e a quantidade fica escrita na linha', pren.quantidade === 3 && /3 imóveis/.test(pren.rot));
// Corrigida à mão, a etiqueta para de dizer "imóveis" — dizer isso de uma
// quantidade que não é a dos imóveis seria escrever o que não é verdade.
const duasPren = orcCalcular({
  atoId: 'compra-venda', valores: {transacao: 30186716, unidadesRegistro: [
    {rotulo: 'Apartamento', valor: 26186716}, {rotulo: 'Vaga 1', valor: 2000000},
    {rotulo: 'Vaga 2', valor: 2000000}]},
  imovelMunicipio: 'São Paulo', imovelUf: 'SP', flags: {},
  despesas: {prenotacao: true, matricula: true, qtdePrenotacao: 2, taxaAdicional: false}});
const p2 = duasPren.despesas.find(x => x.item === '12');
ok('duas prenotações para três imóveis: cobra duas', R(p2.valor) === '160.28', R(p2.valor));
ok('e a etiqueta não mente sobre imóveis', /\(2\)/.test(p2.rot) && !/imóveis/.test(p2.rot), p2.rot);
ok('zero prenotações some da conta',
   !orcCalcular({atoId: 'compra-venda', valores: {transacao: 30186716},
     imovelMunicipio: 'São Paulo', imovelUf: 'SP', flags: {},
     despesas: {prenotacao: true, qtdePrenotacao: 0, matricula: false, taxaAdicional: false}})
     .despesas.some(x => x.item === '12'));
ok('a escritura continua sendo uma só', comVagas.escrituras.length === 1);
// No imóvel único nada disso muda.
ok('imóvel único continua com uma prenotação e uma certidão',
   R(ap.despesas.find(x => x.item === '12').valor) === '80.14'
   && R(ap.despesas.find(x => x.item === '11').valor) === '76.54');
const somaErrada = orcCalcular({
  atoId: 'compra-venda', valores: {transacao: 30186716, unidadesRegistro: [
    {rotulo: 'Apartamento', valor: 26186716}]},
  imovelMunicipio: 'São Paulo', imovelUf: 'SP',
  flags: {}, despesas: {taxaAdicional: false}});
ok('mas somando diferente, o painel avisa',
   somaErrada.alertas.some(a => /matrículas somam/.test(a.texto)),
   somaErrada.alertas.map(a => a.texto));
// Vale em qualquer ato com registro, não só na compra e venda.
const doacaoDuasMat = orcCalcular({
  atoId: 'doacao', valores: {doacao: 30000000, unidadesRegistro: [
    {rotulo: 'Casa', valor: 25000000}, {rotulo: 'Terreno', valor: 5000000}]},
  imovelMunicipio: 'São Paulo', imovelUf: 'SP',
  flags: {}, despesas: {taxaAdicional: false}});
ok('a doação também aceita mais de uma matrícula', doacaoDuasMat.registros.length === 2);
ok('e o ITCMD continua sobre o valor global', doacaoDuasMat.tributos[0].base === 30000000);
// O ato que já pede as unidades como campo dele não muda de comportamento.
ok('o ato "com vagas" continua funcionando como antes',
   orcCalcular({atoId: 'compra-venda-vagas',
     valores: {unidades: [{rotulo: 'Apto', valor: 30186716}, {rotulo: 'Vaga', valor: 5000000}]},
     flags: {}, despesas: {taxaAdicional: false}}).registros.length === 2);

// O "valor do negócio" com que a tela compara a soma das matrículas. Depois do
// desdobramento, `registros[0].base` é o valor da PRIMEIRA matrícula — e a tela
// que lia dali dizia à Shirley que o negócio tinha encolhido para o valor da
// vaga. O motor guarda o número de antes.
console.log('\n— O valor do negócio sobrevive ao desdobramento em matrículas —');
ok('sem matrículas, baseRegistro é a base do registro único', ap.baseRegistro === 30186716, ap.baseRegistro);
ok('com três matrículas, ele continua sendo o valor do negócio',
   comVagas.baseRegistro === 30186716, comVagas.baseRegistro);
ok('e não o da primeira matrícula', comVagas.registros[0].base === 26186716);
ok('mesmo quando as matrículas somam diferente do negócio',
   somaErrada.baseRegistro === 30186716, somaErrada.baseRegistro);

// A via da cliente é a única tela que sai do cartório, e ela tem de fechar:
// somar as linhas impressas e dar o total impresso. A taxa adicional é a única
// coisa sem linha própria, e vai somada dentro do REGISTRO — o que só funciona
// enquanto houver um REGISTRO para absorvê-la.
console.log('\n— A via da cliente sempre fecha —');
const somaLinhas = r => orcLinhasCliente(r).reduce((t, l) => t + l[1], 0);
ok('no gabarito do 1301', somaLinhas(ap) === ap.totais.total, [somaLinhas(ap), ap.totais.total]);
ok('com três matrículas', somaLinhas(comVagas) === comVagas.totais.total);
const semRegistro = orcCalcular({atoId: 'procuracao', valores: {}, flags: {},
  despesas: {taxaAdicional: true}});
ok('e num ato sem registro, mesmo com a taxa adicional respondida antes',
   somaLinhas(semRegistro) === semRegistro.totais.total,
   [somaLinhas(semRegistro), semRegistro.totais.total]);
ok('— a taxa do registro não entra em ato que não tem registro',
   !semRegistro.despesas.some(d => d.interna), semRegistro.despesas);
// E os vinte atos de uma vez: nenhuma via da cliente pode sair com uma linha
// a menos do que o total cobra.
const naoFecham = ORC_ATOS.filter(a => {
  const r = orcCalcular({atoId: a.id, imovelMunicipio: 'São Paulo', imovelUf: 'SP',
    valores: {transacao: 30186716, doacao: 30186716, monte: 30186716, meacao: 30186716,
              totalPartilha: 30186716, excedente: 1000000, divida: 30186716,
              unidades: [{rotulo: 'Apto', valor: 30186716}],
              imoveis: [{rotulo: 'Casa', valor: 30186716}]},
    flags: {}, despesas: {taxaAdicional: true}});
  return somaLinhas(r) !== r.totais.total;
}).map(a => a.id);
ok('nos vinte atos, com a taxa adicional ligada', naoFecham.length === 0, naoFecham);

console.log('\n— Inventário desigual: dois impostos, e o certo em cada quinhão —');
const invO = orcCalcular({atoId: 'inventario-desigual-meacao',
  valores: {meacao: 50000000, excedente: 10000000, imoveis: [{rotulo: 'Casa', valor: 60000000}]},
  flags: {excedenteOneroso: true}, despesas: {taxaAdicional: false}});
ok('excedente oneroso vira ITBI', invO.tributos[1].imposto === 'itbi' && invO.tributos[1].aliquota === 3);
ok('e o ITCMD da meação continua', invO.tributos[0].imposto === 'itcmd' && invO.tributos[0].base === 50000000);
const invG = orcCalcular({atoId: 'inventario-desigual-meacao',
  valores: {meacao: 50000000, excedente: 10000000, imoveis: [{rotulo: 'Casa', valor: 60000000}]},
  flags: {excedenteOneroso: false}, despesas: {taxaAdicional: false}});
ok('excedente gratuito vira ITCMD', invG.tributos[1].imposto === 'itcmd' && invG.tributos[1].aliquota === 4);

console.log('\n— Os atos de valor fixo —');
const div = orcCalcular({atoId: 'divorcio', valores: {}, flags: {}, despesas: {}});
ok('divórcio sem partilha: R$ 615,30', R(div.totais.total) === '615.30', R(div.totais.total));
const proc = orcCalcular({atoId: 'procuracao', valores: {}, flags: {outorgantes: 2}, despesas: {}});
ok('procuração presencial: R$ 328,18', R(proc.totais.total) === '328.18', R(proc.totais.total));
const procD = orcCalcular({atoId: 'procuracao', valores: {}, flags: {diligencia: true, outorgantes: 2}, despesas: {}});
ok('em diligência dobra: R$ 656,36', R(procD.totais.total) === '656.36', R(procD.totais.total));
ok('e a parte do tabelião dobra junto', procD.totais.tabeliao === proc.totais.tabeliao * 2);
const proc6 = orcCalcular({atoId: 'procuracao', valores: {}, flags: {outorgantes: 6}, despesas: {}});
ok('seis outorgantes: 328,18 + 2 × 82,04', R(proc6.totais.total) === '492.26', R(proc6.totais.total));
const ata = orcCalcular({atoId: 'ata-notarial', valores: {}, flags: {folhas: 1}, despesas: {}});
ok('ata de uma folha: R$ 638,76', R(ata.totais.total) === '638.76', R(ata.totais.total));
const ata3 = orcCalcular({atoId: 'ata-notarial', valores: {}, flags: {folhas: 3}, despesas: {}});
ok('ata de três folhas: 638,76 + 2 × 322,57', R(ata3.totais.total) === '1283.90', R(ata3.totais.total));
const ataD = orcCalcular({atoId: 'ata-notarial', valores: {}, flags: {folhas: 2, diligencia: true}, despesas: {}});
ok('ata em diligência: 1.277,52 + 645,14', R(ataD.totais.total) === '1922.66', R(ataD.totais.total));
const decl = orcCalcular({atoId: 'escritura-declaratoria', valores: {}, flags: {}, despesas: {}});
ok('escritura declaratória: R$ 615,30', R(decl.totais.total) === '615.30');
const cd = orcCalcular({atoId: 'confissao-divida', valores: {confissao: 10000000}, flags: {}, despesas: {}});
ok('confissão de dívida sai com os 40%', cd.escrituras[0].reducao === 40);
ok('e o painel avisa que ela está sozinha na escritura',
   cd.escrituras[0].avisos.some(a => /sozinho/.test(a.texto)));

console.log('\n— Fora da Capital, o painel não chuta —');
const fora = orcCalcular({atoId: 'compra-venda', valores: {transacao: 30186716},
  praticadoEm: 'São Paulo', imovelMunicipio: 'Campinas', imovelUf: 'SP',
  flags: {}, despesas: {taxaAdicional: false}});
ok('o ITBI não é calculado', fora.tributos[0].valor === null);
ok('e a razão fica escrita', fora.alertas.some(a => /Campinas/.test(a.texto)));
ok('o CHECK FINAL trava nos tributos',
   fora.check.find(c => c.rot === 'Tributos conferidos').estado === 'falta');
ok('o orçamento não sai como definitivo', fora.definitivo === false);
const outroEstado = orcCalcular({atoId: 'doacao', valores: {doacao: 30000000},
  imovelMunicipio: 'Curitiba', imovelUf: 'PR', flags: {}, despesas: {taxaAdicional: false}});
ok('imóvel em outro estado avisa da tabela', outroEstado.alertas.some(a => /PR/.test(a.texto)));
ok('e o ITCMD não é calculado', outroEstado.tributos[0].valor === null);

console.log('\n— A vigência trava o "definitivo" (regra 13) —');
// Tirada a vigência à força, o motor volta a travar — é o guarda-corpo, não
// um efeito colateral do valor que está lá hoje.
const guardadas = [ORC_TABELA_NOTAS.vigencia, ORC_TABELA_REGISTRO.vigencia];
ORC_TABELA_NOTAS.vigencia = null;
ORC_TABELA_REGISTRO.vigencia = null;
const semVigencia = orcCalcular({atoId: 'compra-venda', valores: {transacao: 30186716},
  praticadoEm: 'São Paulo', imovelMunicipio: 'São Paulo', imovelUf: 'SP',
  flags: {}, despesas: {prenotacao: true, matricula: true, taxaAdicional: false}});
ok('sem vigência declarada, nada é definitivo', semVigencia.definitivo === false);
ok('e o CHECK FINAL diz exatamente isso',
   semVigencia.check.find(c => c.rot === 'Vigência conferida').estado === 'falta');
ORC_TABELA_NOTAS.vigencia = guardadas[0];
ORC_TABELA_REGISTRO.vigencia = guardadas[1];

console.log('\n— A UFESP faz o painel enxergar as isenções de ITCMD —');
const doacaoBaixa = orcCalcular({atoId: 'doacao', valores: {doacao: 5000000},
  imovelMunicipio: 'São Paulo', imovelUf: 'SP', flags: {}, despesas: {taxaAdicional: false}});
ok('doação de R$ 50.000 está dentro das 2.500 UFESPs (R$ 96.050,00)',
   doacaoBaixa.alertas.some(a => /2.500 UFESPs/.test(a.texto)), doacaoBaixa.alertas.map(a => a.texto));
ok('mas o ITCMD continua na conta — quem decide é ela', doacaoBaixa.tributos[0].valor > 0);
const doacaoAlta = orcCalcular({atoId: 'doacao', valores: {doacao: 20000000},
  imovelMunicipio: 'São Paulo', imovelUf: 'SP', flags: {}, despesas: {taxaAdicional: false}});
ok('doação acima do teto não levanta aviso de isenção',
   !doacaoAlta.alertas.some(a => /UFESP/.test(a.texto)));

console.log('\n— As isenções são apontadas, nunca aplicadas —');
const barato = orcCalcular({atoId: 'compra-venda', data: '2026-03-10',
  valores: {transacao: 20000000}, imovelMunicipio: 'São Paulo', imovelUf: 'SP',
  flags: {residencial: true}, despesas: {taxaAdicional: false}});
ok('o teto de 2026 é R$ 245.527,77', R(orcTetoIsencaoItbi('2026-03-10')) === '245527.77');
ok('base abaixo do teto levanta o aviso', barato.alertas.some(a => /isenção do ITBI/.test(a.texto)));
ok('mas o ITBI continua na conta — quem decide é ela', barato.tributos[0].valor > 0);
ok('o teto de 2019 é outro', R(orcTetoIsencaoItbi('2019-06-01')) === '169153.88');

console.log('\n— A regra especial de ZEIS engole os atos da escritura —');
const zeis = orcCalcular({atoId: 'compra-venda-fiduciaria',
  valores: {transacao: 20000000, garantia: 15000000},
  flags: {zeis: true}, despesas: {taxaAdicional: false}});
ok('uma escritura só, de valor fixo', zeis.escrituras.length === 1 && zeis.escrituras[0].item === '1.4');
ok('R$ 520,33, o item 1.4 da tabela', R(zeis.totais.escritura) === '520.33', R(zeis.totais.escritura));
ok('e o painel manda conferir o enquadramento', zeis.alertas.some(a => /ZEIS/.test(a.texto)));

console.log('\n— A pensão do divórcio: em parcelas, e somada à base —');
// O caso de verdade, trazido por ela em 28/08/2026: um salário mínimo por doze
// meses, e dois salários mínimos até dezembro de 2029. Ela já tinha feito a
// conta à mão — R$ 19.452,00, R$ 132.922,00 e R$ 152.374,00 —, e é contra esses
// três números que o motor é conferido. Um dígito diferente aqui é o motor
// discordando da escrevente.
const AGO = '2026-08-28';
ok('o salário mínimo do painel é R$ 1.621,00', R(ORC_TRIBUTOS.salarioMinimo) === '1621.00');
const pen1 = orcPensaoDetalhe({emSalarios: true, salarios: 1, modo: 'meses', meses: 12}, AGO);
ok('1 salário mínimo por 12 meses = R$ 19.452,00', R(pen1.total) === '19452.00', R(pen1.total));
const pen2 = orcPensaoDetalhe({emSalarios: true, salarios: 2, modo: 'ate', ate: '2029-12'}, AGO);
ok('de agosto/2026 a dezembro/2029 são 41 meses', pen2.meses === 41, pen2.meses);
ok('2 salários mínimos nesses 41 meses = R$ 132.922,00', R(pen2.total) === '132922.00', R(pen2.total));
// Os dois extremos contam: sem um deles daria 40 ou 42 meses, e o orçamento
// não bateria com a conta que ela já tinha na mão.
ok('o mês do ato conta, e o mês final também', orcMesesAte('2026-12-01', '2026-12') === 1);
ok('e um mês para o seguinte são dois', orcMesesAte('2026-12-01', '2027-01') === 2);

const AS_DUAS = [{emSalarios: true, salarios: 1, modo: 'meses', meses: 12},
                 {emSalarios: true, salarios: 2, modo: 'ate', ate: '2029-12'}];
ok('a soma das duas parcelas é R$ 152.374,00',
   R(orcPensaoTotal({pensaoParcelas: AS_DUAS}, AGO)) === '152374.00',
   R(orcPensaoTotal({pensaoParcelas: AS_DUAS}, AGO)));

// E a regra que ela confirmou: a pensão ACRESCE à base, e não vira uma segunda
// escritura na faixa dela. Duas faixas somadas dão mais que uma faixa sobre a
// soma — era o orçamento saindo maior do que ela cobra.
const pensao = orcCalcular({atoId: 'divorcio-partilha', data: AGO,
  valores: {totalPartilha: 50000000, imoveis: [{rotulo: 'Apto', valor: 50000000}]},
  flags: {temPensao: true, pensaoParcelas: AS_DUAS}, despesas: {taxaAdicional: false}});
ok('sai UMA escritura, não duas', pensao.escrituras.length === 1, pensao.escrituras.length);
ok('e a base é a partilha mais a pensão',
   pensao.escrituras[0].base === 50000000 + 15237400, pensao.escrituras[0].base);
ok('a memória mostra as duas parcelas, com a conta de cada uma',
   /19\.452,00/.test(pensao.escrituras[0].fundamento) && /132\.922,00/.test(pensao.escrituras[0].fundamento),
   pensao.escrituras[0].fundamento);
ok('e diz que a regra é dela, confirmada',
   pensao.escrituras[0].avisos.some(a => a.confianca === 'confirmada' && /acresce à base/.test(a.texto)));

// Pensão em reais, não em salários: continua valendo.
ok('parcela escrita em reais também soma',
   R(orcPensaoTotal({pensaoParcelas: [{emSalarios: false, valor: 500000, modo: 'meses', meses: 10}]}, AGO)) === '50000.00');

// Orçamento gravado ANTES desta mudança tem pensaoMensal e pensaoMeses soltos,
// e não pode virar zero por causa do formato novo.
const velho = orcCalcular({atoId: 'divorcio-partilha', data: AGO,
  valores: {totalPartilha: 50000000, imoveis: [{rotulo: 'Apto', valor: 50000000}]},
  flags: {temPensao: true, pensaoMensal: 500000, pensaoMeses: 24}, despesas: {taxaAdicional: false}});
ok('o formato antigo continua valendo, como uma parcela só',
   velho.escrituras[0].base === 50000000 + 500000 * 24, velho.escrituras[0].base);
const semPrazo = orcCalcular({atoId: 'divorcio-partilha', data: AGO,
  valores: {totalPartilha: 50000000, imoveis: [{rotulo: 'Apto', valor: 50000000}]},
  flags: {temPensao: true, pensaoMensal: 500000}, despesas: {taxaAdicional: false}});
ok('e sem prazo nenhum continua usando doze meses',
   semPrazo.escrituras[0].base === 50000000 + 500000 * 12, semPrazo.escrituras[0].base);

// O divórcio SEM partilha é de valor fixo: não há base a que acrescer. O motor
// põe a pensão como base e AVISA — trocar a cobrança de um ato de valor fixo
// em silêncio seria decidir por ela.
const semPartilha = orcCalcular({atoId: 'divorcio', data: AGO, valores: {},
  flags: {temPensao: true, pensaoParcelas: AS_DUAS}, despesas: {}});
ok('no divórcio sem partilha a pensão vira a base', semPartilha.escrituras[0].base === 15237400);
ok('e isso não passa calado', semPartilha.alertas.some(a => /valor fixo/.test(a.texto)),
   semPartilha.alertas.map(a => a.texto));
// "Pode ser" (28/08/2026) é aceite do jeito de trabalhar, não fonte. Fica 🔵
// operacional: deixa de pedir decisão todo dia, mas não vira regra oficial —
// promover um "pode ser" a 🟢 é exatamente o erro que a escada evita.
ok('mas fica como jeito de trabalhar (🔵), não como fonte confirmada',
   semPartilha.escrituras[0].avisos.some(a => a.confianca === 'operacional'),
   semPartilha.escrituras[0].avisos.map(a => a.confianca));
ok('e nenhum aviso dela finge ser confirmado',
   !semPartilha.escrituras[0].avisos.some(a => a.confianca === 'confirmada'),
   semPartilha.escrituras[0].avisos);
ok('a base de conhecimento guarda a ressalva de que isso não tem nota de tabela',
   /não foi lida/.test(ORC_CONHECIMENTO_INICIAL['pensao-na-base'].aberto),
   ORC_CONHECIMENTO_INICIAL['pensao-na-base'].aberto);

// Pensão marcada mas sem nenhum valor: é pergunta em aberto, não zero.
const semValor = orcCalcular({atoId: 'divorcio-partilha', data: AGO,
  valores: {totalPartilha: 50000000}, flags: {temPensao: true}, despesas: {taxaAdicional: false}});
ok('pensão sem valor vira pergunta, não some',
   semValor.faltando.some(f => f.campo === 'pensaoParcelas'), semValor.faltando.map(f => f.campo));

console.log('\n— Outro ato na mesma escritura —');
// Ela precisava orçar uma escritura com uma procuração junto e não tinha onde
// dizer isso: os vinte atos cobrem as combinações conhecidas, e o que ficasse
// fora delas não tinha lugar nenhum.
const comProc = (outros) => orcCalcular({atoId: 'compra-venda', data: '2026-08-28',
  praticadoEm: 'São Paulo', imovelMunicipio: 'São Paulo', imovelUf: 'SP',
  valores: {transacao: 30186716}, flags: {outrosAtos: outros || []},
  despesas: {prenotacao: true, matricula: true, registroComMatricula: true,
             taxaAdicional: true, taxaAdicionalValor: 30000}});

// O gabarito do 1301 não pode se mexer por causa disto.
ok('sem ato a mais, o gabarito continua em R$ 16.522,21',
   R(comProc().totais.total) === '16522.21', R(comProc().totais.total));

const umaProc = comProc([{item: '2.4.1', qtd: 1}]);
ok('a procuração entra pelo VALOR CHEIO do item 2.4.1',
   R(umaProc.totais.escritura) === '4504.42', R(umaProc.totais.escritura));
// R$ 328,18 cheios. Com os 40% do ato secundário daria R$ 196,91 — e não é
// isso que ela cobra: a redução vale para ato com valor declarado, não para
// item de valor fixo. Confirmado por ela em 28/08/2026.
ok('e não com os 40% do ato secundário',
   umaProc.escrituras[1].valor === ORC_TABELA_NOTAS.itens['2.4.1'].valor, umaProc.escrituras[1].valor);
ok('a parte do tabelião acompanha, senão a comissão sairia a menos',
   R(umaProc.totais.tabeliao) === '2682.20', R(umaProc.totais.tabeliao));
ok('o ato a mais não inventa registro nem tributo',
   umaProc.registros.length === 1 && umaProc.tributos.length === 1);

// Quantidade: seis outorgantes são a base mais dois adicionais.
const seis = comProc([{item: '2.4.1', qtd: 1}, {item: '2.4.2', qtd: 2}]);
ok('a quantidade multiplica o item',
   R(seis.totais.escritura) === R(417624 + 32818 + 8204 * 2), R(seis.totais.escritura));
ok('e a memória escreve a multiplicação',
   /× 2/.test(seis.escrituras[2].fundamento), seis.escrituras[2].fundamento);

// A via da cliente continua fechando com o ato a mais dentro.
ok('a via da cliente fecha com o ato a mais',
   orcLinhasCliente(seis).reduce((t, l) => t + l[1], 0) === seis.totais.total);

// A regra especial substitui a escritura inteira — mas não pode engolir um
// ato que não é dela. Engolir a procuração seria lavrá-la de graça.
const zeisProc = orcCalcular({atoId: 'compra-venda', valores: {transacao: 20000000},
  flags: {zeis: true, outrosAtos: [{item: '2.4.1', qtd: 1}]},
  imovelMunicipio: 'São Paulo', imovelUf: 'SP', despesas: {taxaAdicional: false}});
ok('a regra especial (ZEIS) não engole o ato lavrado junto',
   zeisProc.escrituras.some(e => e.avulso === '2.4.1'), zeisProc.escrituras.map(e => e.rot));

// Todos os itens oferecidos existem na tabela — lista e tabela não podem
// divergir em silêncio.
const semItem = ORC_ATOS_AVULSOS.filter(a => !ORC_TABELA_NOTAS.itens[a.item]).map(a => a.item);
ok('todo ato oferecido tem item na tabela de Notas', semItem.length === 0, semItem);
ok('e cada um deles é de valor fixo, com parte do tabelião declarada',
   ORC_ATOS_AVULSOS.every(a => ORC_TABELA_NOTAS.itens[a.item].valor > 0
                            && ORC_TABELA_NOTAS.itens[a.item].tabeliao > 0));
// Item que não existe não pode virar linha de R$ 0 escondida no total.
ok('item inventado não vira linha', orcLinhaOutroAto('99.9', 1) === null);

console.log('\n— A BASE CONSIDERADA é o valor do negócio, não a base da tabela —');
// O caso que ela trouxe em 28/08/2026: doação com reserva de usufruto de
// R$ 500.000,00. A tabela cobra a nua-propriedade sobre dois terços e o
// usufruto sobre um terço — e a via da cliente saía dizendo
// "BASE CONSIDERADA R$ 333.333,33". A cliente doou meio milhão.
const usu = orcCalcular({atoId: 'doacao-usufruto', data: '2026-08-28',
  praticadoEm: 'São Paulo', imovelMunicipio: 'São Paulo', imovelUf: 'SP',
  valores: {doacao: 50000000}, flags: {}, despesas: {taxaAdicional: false}});
ok('a folha mostra os R$ 500.000,00 que ela digitou',
   R(orcBasePrincipal(usu)) === '500000.00', R(orcBasePrincipal(usu)));
ok('e não os dois terços da primeira linha da tabela',
   usu.escrituras[0].base === 33333333, usu.escrituras[0].base);
// A conta em si não mudou: é só o que a folha mostra.
ok('a escritura continua saindo sobre 2/3 e 1/3', R(usu.totais.escritura) === '6713.94',
   R(usu.totais.escritura));
ok('e o ITCMD sobre o valor global', R(usu.tributos[0].valor) === '20000.00');

// Em nenhum dos vinte atos a base mostrada pode ser um número que ela não
// digitou. Era um só que escorregava, e procurar os irmãos custou um laço.
const V = {transacao: 50000000, garantia: 30000000, saldoDevedor: 20000000,
  novacao: 15000000, confissao: 12000000, doacao: 45000000, monte: 60000000,
  meacao: 35000000, excedente: 10000000, totalPartilha: 55000000,
  unidades: [{rotulo: 'Apto', valor: 40000000}, {rotulo: 'Vaga', valor: 10000000}],
  imoveis: [{rotulo: 'Casa', valor: 60000000}]};
const desencontrados = ORC_ATOS.map(a => {
  const r = orcCalcular({atoId: a.id, data: '2026-08-28', praticadoEm: 'São Paulo',
    imovelMunicipio: 'São Paulo', imovelUf: 'SP', valores: V, flags: {}, despesas: {taxaAdicional: false}});
  const base = orcBasePrincipal(r);
  if(!base) return null;                       // ato de valor fixo, sem base
  const digitados = (a.campos || []).map(c =>
    Array.isArray(V[c]) ? V[c].reduce((t, x) => t + x.valor, 0) : V[c]);
  return digitados.includes(base) ? null : a.id + ' mostra ' + R(base);
}).filter(Boolean);
ok('nos vinte atos, a base mostrada é sempre um valor digitado', desencontrados.length === 0, desencontrados);

// A ZEIS troca a escritura por um item de valor fixo, e a primeira linha fica
// sem base nenhuma: antes a folha simplesmente não mostrava valor de negócio.
const zeisBase = orcCalcular({atoId: 'compra-venda', valores: {transacao: 20000000},
  flags: {zeis: true}, imovelMunicipio: 'São Paulo', imovelUf: 'SP', despesas: {taxaAdicional: false}});
ok('mesmo na ZEIS, em que a escritura é de valor fixo, a cliente vê o valor do negócio',
   R(orcBasePrincipal(zeisBase)) === '200000.00', R(orcBasePrincipal(zeisBase)));

// No divórcio a base declarada inclui a pensão, porque ela também foi
// informada e é sobre a soma que a escritura sai.
const comPensao = orcCalcular({atoId: 'divorcio-partilha', data: '2026-08-28',
  valores: {totalPartilha: 55000000, imoveis: [{rotulo: 'Casa', valor: 55000000}]},
  flags: {temPensao: true, pensaoParcelas: AS_DUAS}, despesas: {taxaAdicional: false}});
ok('no divórcio com pensão, a base declarada é a partilha mais a pensão',
   orcBasePrincipal(comPensao) === 55000000 + 15237400, orcBasePrincipal(comPensao));

// Orçamento gravado antes disto não tem baseDeclarada, e continua mostrando o
// que mostrou no dia — cada versão guarda o número que deu.
ok('versão antiga, sem baseDeclarada, cai no caminho de antes',
   orcBasePrincipal({escrituras: [{base: 12345}]}) === 12345);

console.log('\n— O imposto de fora da Capital —');
// Ela lançou uma venda e compra de imóvel em Extrema-MG e o ITBI saiu em
// branco. O imposto é municipal, então o painel vai buscar a alíquota — mas o
// que vem da busca é hipótese, e a escada de conhecimento não abre exceção.
const emExtrema = () => orcCalcular({atoId: 'compra-venda', data: '2026-08-28',
  praticadoEm: 'São Paulo', imovelMunicipio: 'Extrema', imovelUf: 'MG',
  valores: {transacao: 30186716}, flags: {}, despesas: {taxaAdicional: false}});

ORC_TRIBUTOS.aliquotasDeFora = {};
const semAliq = emExtrema();
ok('sem alíquota, o ITBI fica sem valor', semAliq.tributos[0].valor === null);
ok('e o orçamento não fecha', semAliq.bloqueado === true);
ok('a chave do lugar é itbi-extrema-mg', semAliq.tributos[0].aliquotaDeFora.chave === 'itbi-extrema-mg',
   semAliq.tributos[0].aliquotaDeFora.chave);
ok('o acento e a caixa somem da chave',
   orcChaveAliquota('itbi', 'São José dos Campos', 'sp') === 'itbi-sao-jose-dos-campos-sp',
   orcChaveAliquota('itbi', 'São José dos Campos', 'sp'));
ok('e o ITCMD é por estado, não por município', orcChaveAliquota('itcmd', 'Qualquer', 'MG') === 'itcmd-mg');

// Encontrada pela busca: entra na conta, mas NÃO fecha o orçamento. É a regra
// que impede um número lido por máquina de virar valor cobrado da cliente.
ORC_TRIBUTOS.aliquotasDeFora = {'itbi-extrema-mg': {aliquota: 2, confianca: 'incerta',
  fundamento: 'Lei Municipal 1.234/2019, art. 5º', fontes: ['https://extrema.mg.gov.br/x'], ressalva: ''}};
const achada = emExtrema();
ok('achada, o ITBI entra na conta com a alíquota de lá',
   R(achada.tributos[0].valor) === '6037.34', R(achada.tributos[0].valor));
ok('mas o orçamento continua travado enquanto ela não confere', achada.bloqueado === true);
ok('e o CHECK FINAL diz exatamente isso',
   achada.check.some(c => c.rot === 'Alíquota de fora da Capital' && c.estado === 'falta'),
   achada.check.filter(c => c.estado === 'falta').map(c => c.rot));
ok('a linha do imposto avisa que o número não foi conferido',
   achada.tributos[0].avisos.some(a => a.confianca === 'incerta' && /não digitada por você/.test(a.texto)));
ok('e o fundamento diz de onde veio', /Lei Municipal 1\.234\/2019/.test(achada.tributos[0].fundamento),
   achada.tributos[0].fundamento);

// Conferida por ela: aí sim fecha.
ORC_TRIBUTOS.aliquotasDeFora['itbi-extrema-mg'].confianca = 'confirmada';
ORC_TRIBUTOS.aliquotasDeFora['itbi-extrema-mg'].confirmadaPor = 'Shirley';
ORC_TRIBUTOS.aliquotasDeFora['itbi-extrema-mg'].confirmadaEm = '2026-08-28';
const conferida = emExtrema();
ok('conferida por ela, o orçamento fecha', conferida.definitivo === true,
   conferida.check.filter(c => c.estado === 'falta').map(c => c.rot));
ok('e o CHECK FINAL registra quem conferiu',
   /Conferida por você/.test(conferida.check.find(c => c.rot === 'Alíquota de fora da Capital').nota));

// A regra dela, de 28/08/2026: a TABELA é sempre a de São Paulo. Só o imposto
// acompanha o imóvel. Se algum dia alguém fizer a tabela viajar junto, isto
// quebra — que é exatamente o ponto.
ok('a escritura sai pela tabela de São Paulo, mesmo com imóvel em MG',
   R(conferida.totais.escritura) === '4176.24', R(conferida.totais.escritura));
ok('o registro também', R(conferida.totais.registro) === '2833.28', R(conferida.totais.registro));
ok('e a jurisdição deixou de travar por causa disso',
   conferida.check.find(c => c.rot === 'Jurisdição').estado === 'ok');
ok('dizendo por quê, em vez de só passar',
   /a tabela é a daqui/.test(conferida.check.find(c => c.rot === 'Jurisdição').nota),
   conferida.check.find(c => c.rot === 'Jurisdição').nota);

// E a Capital não muda em nada.
ORC_TRIBUTOS.aliquotasDeFora = {};
ok('em São Paulo o ITBI continua sendo os 3% de sempre',
   R(orcCalcular({atoId: 'compra-venda', imovelMunicipio: 'São Paulo', imovelUf: 'SP',
     valores: {transacao: 30186716}, flags: {}, despesas: {taxaAdicional: false}}).tributos[0].valor) === '9056.01');
ok('e nem aparece bloco de alíquota de fora',
   !orcCalcular({atoId: 'compra-venda', imovelMunicipio: 'São Paulo', imovelUf: 'SP',
     valores: {transacao: 30186716}, flags: {}, despesas: {taxaAdicional: false}}).tributos[0].aliquotaDeFora);

console.log('\n— Só se pergunta o que falta (regra 11) —');
const vazio = orcCalcular({atoId: 'compra-venda-fiduciaria', valores: {}, flags: {}, despesas: {}});
ok('dois valores em falta viram duas perguntas',
   vazio.faltando.filter(f => f.campo !== 'taxaAdicional').length === 2,
   vazio.faltando.map(f => f.campo));
const meio = orcCalcular({atoId: 'compra-venda-fiduciaria', valores: {transacao: 30186716}, flags: {}, despesas: {}});
ok('preenchido um, sobra uma pergunta só',
   meio.faltando.filter(f => f.campo !== 'taxaAdicional').length === 1,
   meio.faltando.map(f => f.campo));
ok('e a pergunta é escrita em português, não em nome de campo',
   /alienação fiduciária/.test(meio.faltando[0].pergunta), meio.faltando[0].pergunta);

console.log('\n— A comparação entre versões diz POR QUE mudou (regra 17) —');
const v1 = {versao: 1, resultado: orcCalcular({atoId: 'compra-venda', valores: {transacao: 30186716},
  flags: {}, despesas: {prenotacao: true, matricula: true, taxaAdicional: false}})};
const v2 = {versao: 2, resultado: orcCalcular({atoId: 'compra-venda', valores: {transacao: 33000000},
  flags: {}, despesas: {prenotacao: true, matricula: true, taxaAdicional: true, taxaAdicionalValor: 30000}})};
const cmp = orcComparar(v1, v2);
ok('a diferença é a dos totais', cmp.diferenca === v2.resultado.totais.total - v1.resultado.totais.total);
ok('e o motivo cita a mudança de faixa', /faixa l para a m/.test(cmp.frase), cmp.frase);
ok('e cita a taxa adicional que entrou', /taxa adicional/.test(cmp.frase), cmp.frase);
const igual = orcComparar(v1, {versao: 2, resultado: v1.resultado});
ok('versões iguais dizem que nada mudou', /não mudaram/.test(igual.frase));

console.log('\n— A divergência com caso semelhante não fica escondida (regra 24) —');
// O caso real: um orçamento gravado meses atrás, com a tabela daquela época,
// guardou um valor de escritura que a tabela de hoje não devolve mais. Mesma
// faixa, número diferente — é exatamente essa diferença que não pode passar
// quieta na hora de mandar o orçamento novo.
const antigo = {id: 'a', versao: 1, data: '2026-05-10', casoNome: 'Cliente antiga',
  resultado: orcCalcular({atoId: 'compra-venda', valores: {transacao: 30000000},
    flags: {}, despesas: {taxaAdicional: false}})};
antigo.resultado.escrituras[0].valor -= 5000;
antigo.resultado.totais.escritura -= 5000;
const agora = {id: 'b', versao: 1, data: '2026-08-27', casoNome: 'Cliente de hoje',
  resultado: orcCalcular({atoId: 'compra-venda', valores: {transacao: 30186716},
    flags: {}, despesas: {taxaAdicional: false}})};
const d1 = orcDivergencias(agora, [antigo, agora]);
ok('mesma faixa e total diferente levanta a divergência', d1.length === 1, d1);
ok('e ela diz de que orçamento veio', d1.length && /Cliente antiga/.test(d1[0].texto));
const iguais = orcDivergencias(antigo, [antigo, {...antigo, id: 'c', casoNome: 'Outra'}]);
ok('mesmo ato, mesma faixa e mesmo total não vira alarme falso', iguais.length === 0);

console.log('\n— A base de conhecimento nasce com as dúvidas escritas —');
const conh = ORC_CONHECIMENTO_INICIAL;
ok('a vigência confirmada está lá', conh['vigencia-2026'].confianca === 'confirmada');
ok('a coluna do registro com matrícula está lá, confirmada e com o exemplo',
   conh['coluna-registro-com-matricula'].confianca === 'confirmada'
   && conh['coluna-registro-com-matricula'].exemplos.some(x => /3\.133,28/.test(x)));
ok('a matrícula confirmada como certidão está lá',
   conh['matricula-e-certidao'].confianca === 'confirmada');
ok('as duas certidões estão lá, confirmadas e com o motivo dela',
   conh['matricula-duas-vezes'].confianca === 'confirmada'
   && !conh['matricula-duas-vezes'].aberto
   && /início do trabalho|dar início|começar/i.test(conh['matricula-duas-vezes'].regra),
   conh['matricula-duas-vezes'].regra);
ok('a UFESP de 2026 está lá, confirmada', conh['ufesp-2026'].confianca === 'confirmada');
ok('os doze meses da pensão estão lá, como incertos', conh['pensao-doze-meses'].confianca === 'incerta');
ok('os 40% estão lá como operacional, não como fonte oficial',
   conh['desconto-40'].confianca === 'operacional');
ok('o ITBI e o ITCMD estão como confirmados',
   conh['itbi-capital'].confianca === 'confirmada' && conh['itcmd-sp'].confianca === 'confirmada');
ok('nenhuma regra 🔴 é tratada como definitiva',
   Object.values(conh).filter(r => r.confianca === 'incerta').every(r => r.aberto));

console.log('\n— Nenhum ato devolve fração de centavo —');
// Meio centavo por linha é o jeito mais silencioso de um total deixar de bater
// com a conferência dela. Vale para todos os atos, não só para os testados
// acima, e é por isso que esta varredura é geral.
const amostra = {transacao: 30186716, garantia: 20000000, saldoDevedor: 15000000,
  novacao: 8000000, confissao: 6000000, doacao: 100000001, monte: 77777777,
  meacao: 38888888, excedente: 9999999, totalPartilha: 55555555,
  unidades: [{rotulo: 'Apto', valor: 30186716}, {rotulo: 'Vaga', valor: 4999999}],
  imoveis: [{rotulo: 'Casa', valor: 33333333}, {rotulo: 'Sítio', valor: 11111111}]};
const quebrados = [];
ORC_ATOS.forEach(a => {
  const r = orcCalcular({atoId: a.id, valores: amostra,
    flags: {folhas: 3, outorgantes: 7, temPensao: true, pensaoMensal: 333333, excedenteOneroso: true},
    despesas: {prenotacao: true, matricula: true, taxaAdicional: true, taxaAdicionalValor: 30000}});
  const todos = [].concat(r.escrituras, r.registros, r.despesas, r.tributos)
    .map(x => x.valor).concat(Object.values(r.totais));
  if(todos.some(x => x != null && !Number.isInteger(x))) quebrados.push(a.id);
});
ok(`os ${ORC_ATOS.length} atos calculam em centavos inteiros`, quebrados.length === 0, quebrados);
ok('e todo ato devolve um total', ORC_ATOS.every(a =>
  orcCalcular({atoId: a.id, valores: amostra, flags: {}, despesas: {taxaAdicional: false}}).totais.total >= 0));

console.log('\n— Nada do que vai para o banco pode ser undefined —');
// O Firebase recusa `undefined` em qualquer profundidade, e recusa a gravação
// INTEIRA por causa de um só. Foi assim que o primeiro orçamento de verdade não
// salvou: as faixas eram apagadas com `faixas: undefined`, e a mensagem falava
// de uma propriedade que ninguém tinha escrito. Esta varredura passa nos vinte
// atos, em todos os cantos do resultado.
function achaUndefined(v, caminho){
  if(v === undefined) return [caminho];
  if(Array.isArray(v)) return v.flatMap((x, i) => achaUndefined(x, caminho + '[' + i + ']'));
  if(v && typeof v === 'object')
    return Object.keys(v).flatMap(k => achaUndefined(v[k], caminho + '.' + k));
  return [];
}
const sujos = [];
ORC_ATOS.forEach(a => {
  const r = orcCalcular({atoId: a.id, data: '2026-08-27', valores: amostra,
    praticadoEm: 'São Paulo', imovelMunicipio: 'São Paulo', imovelUf: 'SP',
    flags: {folhas: 3, outorgantes: 7, temPensao: true, pensaoMensal: 333333,
            excedenteOneroso: true, residencial: true},
    despesas: {prenotacao: true, matricula: true, registroComMatricula: true,
               taxaAdicional: true, taxaAdicionalValor: 30000}});
  const achados = achaUndefined(r, a.id);
  if(achados.length) sujos.push(achados);
});
ok('nenhum dos vinte atos devolve undefined no resultado', sujos.length === 0, sujos.flat().slice(0, 8));
ok('a identidade da tabela entra sem arrastar as faixas', (() => {
  const t = orcIdentidadeDaTabela(ORC_TABELA_REGISTRO);
  return !('faixas' in t) && !('faixasAverbacao' in t) && t.versao === 'custas-2026' && t.vigencia;
})());
// E o saneador, que é a rede embaixo: campo que um dia nasça sem valor some da
// gravação em vez de derrubar o orçamento inteiro.
const sujo = {a: 1, b: undefined, c: {d: undefined, e: 2}, f: [1, undefined, {g: undefined, h: 3}], i: null};
const limpo = orcSemUndefined(sujo);
ok('o saneador tira todo undefined', achaUndefined(limpo, 'x').length === 0, limpo);
ok('e não confunde null com undefined — null quer dizer outra coisa', limpo.i === null);
ok('em lista, o indefinido sai em vez de virar buraco',
   limpo.f.length === 2 && limpo.f[0] === 1 && limpo.f[1].h === 3, limpo.f);
ok('nem estraga o que estava certo', limpo.a === 1 && limpo.c.e === 2);

console.log('\n— O ato é reconhecido pelo que está escrito no card (regra 10) —');
ok('"Compra e venda" vira compra-venda', orcAdivinharAto('Compra e venda') === 'compra-venda');
ok('"venda e compra com alienação fiduciária" vira o ato certo',
   orcAdivinharAto('Escritura de venda e compra com alienação fiduciária') === 'compra-venda-fiduciaria');
ok('"doação com reserva de usufruto" vira o ato certo',
   orcAdivinharAto('Doação com reserva de usufruto') === 'doacao-usufruto');
ok('"inventário e partilha" vira inventário', orcAdivinharAto('Inventário e partilha') === 'inventario');
ok('campo vazio não vira palpite', orcAdivinharAto('') === '');
ok('texto que não bate com nada não vira palpite', orcAdivinharAto('abertura de firma') === '');

console.log(falhas ? `\n${falhas} falha(s).\n` : '\nTudo certo.\n');
if(falhas) process.exit(1);
