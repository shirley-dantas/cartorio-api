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
ok('47 faixas no registro com valor declarado', ORC_TABELA_REGISTRO.faixas.length === 47);
ok('47 faixas na averbação com valor', ORC_TABELA_REGISTRO.faixasAverbacao.length === 47);
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
ok('registro de R$ 301.867,16 é a faixa j', orcFaixa(ORC_TABELA_REGISTRO.faixas, 30186716).letra === 'j');

console.log('\n— O apartamento 1301, o orçamento que ela conferiu à mão —');
const ap = orcCalcular({
  atoId: 'compra-venda', data: '2026-08-27',
  praticadoEm: 'São Paulo', imovelMunicipio: 'São Paulo', imovelUf: 'SP',
  valores: {transacao: 30186716},
  flags: {}, despesas: {prenotacao: true, matricula: true, taxaAdicional: false}
});
ok('escritura R$ 4.176,24', R(ap.totais.escritura) === '4176.24', R(ap.totais.escritura));
ok('ITBI de 3% = R$ 9.056,01', R(ap.tributos[0].valor) === '9056.01', R(ap.tributos[0].valor));
ok('prenotação sai do item 12', ap.despesas[0].item === '12' && R(ap.despesas[0].valor) === '79.16');
ok('matrícula sai do item 11', ap.despesas[1].item === '11' && R(ap.despesas[1].valor) === '75.60');
ok('registro na faixa j do item 1', R(ap.totais.registro) === '2723.02', R(ap.totais.registro));
ok('o total soma tudo', R(ap.totais.total) === R(ap.totais.escritura + ap.totais.registro + ap.totais.despesas + ap.totais.tributos));
// A conta é sempre em centavos inteiros: um total com fração de centavo é
// sinal de que alguém deixou float entrar na escada.
ok('nenhum centavo quebrado no total', Number.isInteger(ap.totais.total), ap.totais.total);
ok('a parte do tabelião não é o total', R(ap.totais.tabeliao) === '2486.77', R(ap.totais.tabeliao));

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
ok('respondido "sim", entra R$ 300,00', R(comTaxa.totais.despesas) === R(ap.totais.despesas + 30000));
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
ok('o registro do apartamento é o da faixa dele',
   vg.registros[0].valor === orcFaixa(ORC_TABELA_REGISTRO.faixas, 30186716).valor);
ok('o registro da vaga é o da faixa dela',
   vg.registros[1].valor === orcFaixa(ORC_TABELA_REGISTRO.faixas, 5000000).valor);
// Registrar a soma daria outro número: é justamente a diferença que esta
// regra existe para não deixar passar.
ok('somar tudo e registrar de uma vez daria outro número',
   vg.totais.registro !== orcFaixa(ORC_TABELA_REGISTRO.faixas, 35186716).valor);
ok('o ITBI é sobre o valor global', vg.tributos[0].base === 35186716);

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
ok('sem vigência declarada, nada é definitivo', ap.definitivo === false);
ok('e o CHECK FINAL diz exatamente isso',
   ap.check.find(c => c.rot === 'Vigência conferida').estado === 'falta');
ORC_TABELA_NOTAS.vigencia = 'a partir de 01/01/2026';
ORC_TABELA_REGISTRO.vigencia = 'a partir de 01/01/2026';
const comVigencia = orcCalcular({atoId: 'compra-venda', valores: {transacao: 30186716},
  praticadoEm: 'São Paulo', imovelMunicipio: 'São Paulo', imovelUf: 'SP',
  flags: {}, despesas: {prenotacao: true, matricula: true, taxaAdicional: false}});
ok('declarada a vigência, o orçamento fecha', comVigencia.definitivo === true,
   comVigencia.check.filter(c => c.estado === 'falta'));
ORC_TABELA_NOTAS.vigencia = null;
ORC_TABELA_REGISTRO.vigencia = null;

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

console.log('\n— A pensão do divórcio, e a dúvida que veio junto —');
const pensao = orcCalcular({atoId: 'divorcio-partilha',
  valores: {totalPartilha: 50000000, imoveis: [{rotulo: 'Apto', valor: 50000000}]},
  flags: {temPensao: true, pensaoMensal: 500000}, despesas: {taxaAdicional: false}});
const lp = pensao.escrituras.find(x => x.pensao);
ok('sem prazo, o motor usa doze meses', lp && lp.base === 6000000, lp && lp.base);
ok('e diz na tela que a frase admite duas leituras',
   lp.avisos.some(a => a.confianca === 'incerta'));
const pensao24 = orcCalcular({atoId: 'divorcio-partilha',
  valores: {totalPartilha: 50000000, imoveis: [{rotulo: 'Apto', valor: 50000000}]},
  flags: {temPensao: true, pensaoMensal: 500000, pensaoMeses: 24}, despesas: {taxaAdicional: false}});
ok('com prazo estipulado, usa o prazo',
   pensao24.escrituras.find(x => x.pensao).base === 12000000);

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
ok('a vigência não declarada está lá, como incerta', conh['vigencia-nao-declarada'].confianca === 'incerta');
ok('o R$ 3.133,28 que não fecha está lá, com a conta explicada',
   conh['registro-do-exemplo'].confianca === 'incerta' && /2.723,02/.test(conh['registro-do-exemplo'].aberto));
ok('a dúvida da matrícula (item 11 x item 4) está lá, como aprendida',
   conh['matricula-item-11'].confianca === 'aprendida');
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
