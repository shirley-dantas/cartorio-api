// ── Testes ──
let falhas=0;
function ok(nome,cond,extra){
  if(cond)console.log('  ok  '+nome);
  else{falhas++;console.log('FALHA '+nome+(extra!==undefined?'  → '+JSON.stringify(extra):''));}
}
const perto=(a,b)=>Math.abs(a-b)<0.005;

console.log('\n— Leitura do que a mão digita —');
ok('5.755,61',perto(finNum('5.755,61'),5755.61));
ok('R$ 2.000 é dois mil',perto(finNum('R$ 2.000'),2000),finNum('R$ 2.000'));
ok('1234.56 (ponto decimal)',perto(finNum('1234.56'),1234.56));
ok('vazio vira zero',finNum('')===0);

console.log('\n— A escritura da Tania, degrau por degrau —');
const tania={valorEscritura:5755.61,parteTabeliao:3427.23,arranjoId:'direto',status:'pago',dataPagamento:'2026-08-10'};
const c=finConta(tania);
ok('parte do tabelião 3.427,23',perto(c.tabeliao,3427.23));
ok('não é do tabelião 2.328,38',perto(c.naoTabeliao,2328.38),c.naoTabeliao);
ok('repasse de 25% = 856,80 (truncado, como ela recebe)',perto(c.bruto,856.80),c.bruto);
ok('fica com o tabelião 2.570,43',perto(c.ficaTabeliao,2570.43),c.ficaTabeliao);
ok('duas pessoas na divisão',c.linhas.length===2,c.linhas.map(x=>x.nome));
ok('Shirley: metade de 856,80 = 428,40',perto(c.linhas[0].bruto,428.40),c.linhas[0].bruto);
ok('Shirley: sem IR retido — a parte dela passa inteira',c.linhas[0].ir===0&&perto(c.linhas[0].liquido,428.40),c.linhas[0]);
ok('Grazi: metade de 856,80 = 428,40',perto(c.linhas[1].bruto,428.40));
ok('Grazi: IR de 117,81 retido no repasse',perto(c.linhas[1].ir,117.81),c.linhas[1].ir);
ok('Grazi: 310,59 na mão',perto(c.linhas[1].liquido,310.59),c.linhas[1].liquido);
ok('IR total do lançamento é só o da Grazi',perto(c.irTotal,117.81),c.irTotal);
ok('o repasse continua inteiro: 428,40 + 428,40 = 856,80',perto(c.linhas.reduce((s,x)=>s+x.bruto,0),856.80));

console.log('\n— Os arranjos dos parceiros —');
const comRenato=finConta({...tania,arranjoId:'renato'});
ok('Renato: três partes iguais',comRenato.linhas.length===3&&perto(comRenato.linhas[0].bruto,285.60),comRenato.linhas.map(x=>x.nome+':'+x.bruto));
ok('Renato: soma bruta continua 856,80',perto(comRenato.linhas.reduce((s,x)=>s+x.bruto,0),856.80));
const comVinicius=finConta({...tania,arranjoId:'vinicius'});
ok('Vinicius: Shirley, Grazi e Vinicius',comVinicius.linhas.map(x=>x.id).join(',')==='shirley,grazi,vinicius',comVinicius.linhas.map(x=>x.id));
ok('Renato: só a Shirley escapa do IR (285,60 × 207,06)',
   perto(comRenato.linhas[0].liquido,285.60)&&perto(comRenato.linhas[1].liquido,207.06)&&perto(comRenato.linhas[2].liquido,207.06),
   comRenato.linhas.map(x=>x.nome+':'+x.liquido));
const comBasiotti=finConta({...tania,arranjoId:'basiotti'});
ok('Basiotti: quatro nomes em três partes',comBasiotti.linhas.length===4);
ok('Basiotti: Shirley e Grazi dividem uma parte (1/6 cada = 142,80)',
   perto(comBasiotti.linhas[0].bruto,142.80)&&perto(comBasiotti.linhas[1].bruto,142.80),
   comBasiotti.linhas.map(x=>x.nome+':'+x.bruto));
ok('Basiotti: Basiotti e Renato com 1/3 cada (285,60)',
   perto(comBasiotti.linhas[2].bruto,285.60)&&perto(comBasiotti.linhas[3].bruto,285.60),
   comBasiotti.linhas.map(x=>x.nome+':'+x.bruto));
ok('Basiotti: nada se perde no arredondamento',perto(comBasiotti.linhas.reduce((s,x)=>s+x.bruto,0),856.80));
ok('Basiotti: na mão ficam 142,80 · 103,53 · 207,06 · 207,06',
   [142.80,103.53,207.06,207.06].every((v,i)=>perto(comBasiotti.linhas[i].liquido,v)),
   comBasiotti.linhas.map(x=>x.nome+':'+x.liquido));

console.log('\n— O centavo ímpar, como na planilha —');
// A planilha da Shirley arredonda cada metade por si: metade de 621,69 é
// 310,85 para as duas, e a soma passa um centavo do repasse.
const elis=finConta({valorEscritura:0,parteTabeliao:2486.77,arranjoId:'direto'});
ok('repasse truncado de 2.486,77 = 621,69',perto(elis.bruto,621.69),elis.bruto);
ok('as duas ficam com 310,85 (nenhuma leva 310,84)',
   perto(elis.linhas[0].bruto,310.85)&&perto(elis.linhas[1].bruto,310.85),
   elis.linhas.map(x=>x.nome+':'+x.bruto));
ok('a diferença de 1 centavo é declarada, não escondida',perto(elis.arredondamento,0.01),elis.arredondamento);
ok('o tabelião fica com o que não repassou',perto(elis.ficaTabeliao,finCent(2486.77-621.69)),elis.ficaTabeliao);
// As 17 linhas do fechamento que ela conferiu à mão.
const PLANILHA=[[2486.77,310.85],[2025.08,253.14],[2735.91,341.99],[2486.77,310.85],
  [366.39,45.80],[4174.71,521.84],[2271.77,283.97],[2486.77,310.85],[366.39,45.80],
  [2486.77,310.85],[3231.80,403.98],[708.41,88.55],[2486.77,310.85],[366.39,45.80],
  [3427.23,428.40],[3427.23,428.40],[1348.42,168.55]];
let somaS=0,somaG=0,erradas=[];
PLANILHA.forEach(([tab,esperado])=>{
  const c=finConta({parteTabeliao:tab,arranjoId:'direto'});
  somaS=finCent(somaS+c.linhas[0].bruto);somaG=finCent(somaG+c.linhas[1].bruto);
  if(!perto(c.linhas[0].bruto,esperado)||!perto(c.linhas[1].bruto,esperado))
    erradas.push(tab+' → '+c.linhas[0].bruto+'/'+c.linhas[1].bruto+' (planilha '+esperado+')');
});
ok('as 17 linhas do fechamento batem com a planilha, uma a uma',!erradas.length,erradas);
ok('coluna da Shirley fecha em 4.610,47',perto(somaS,4610.47),somaS);
ok('coluna da Grazi fecha em 4.610,47 (bruto)',perto(somaG,4610.47),somaG);

console.log('\n— Correção à mão —');
const ajustada=finConta({...tania,ajustes:{grazi:500}});
ok('a linha corrigida vale o que foi digitado',perto(ajustada.linhas[1].bruto,500));
ok('a outra linha não se mexe',perto(ajustada.linhas[0].bruto,428.40));
ok('o repasse à mão substitui os 25%',perto(finConta({...tania,repasseManual:900}).bruto,900));

console.log('\n— Registro de imóveis: fora da comissão —');
const comReg=finConta({...tania,valorRegistro:1200});
ok('o registro não muda a divisão',perto(comReg.bruto,856.80)&&perto(comReg.linhas[0].liquido,428.40));
ok('o registro aparece à parte',perto(comReg.registro.valor,1200)&&comReg.registro.pago===false);

console.log('\n— O fechamento de 26 a 25 —');
ok('Páscoa de 2026 em 05/04',finISO(finPascoa(2026))==='2026-04-05',finISO(finPascoa(2026)));
ok('dia 25/12 é feriado, então dezembro antecipa',finDataFechamento(2026,12)<'2026-12-25',finDataFechamento(2026,12));
ok('todo fechamento cai em dia útil',[1,2,3,4,5,6,7,8,9,10,11,12].every(m=>finEhUtil(new Date(finDataFechamento(2026,m)+'T00:00:00Z'))));
ok('o ciclo de setembro começa depois do fechamento de agosto',
   finCicloPorChave('2026-09').inicio>finDataFechamento(2026,8),finCicloPorChave('2026-09'));
const fimAgo=finDataFechamento(2026,8);
ok('pagamento no dia do fechamento entra no ciclo dele',finCicloDaData(fimAgo)==='2026-08',finCicloDaData(fimAgo));
ok('pagamento no dia seguinte já é do ciclo de setembro',
   finCicloDaData(finISO(finDiasDe(new Date(fimAgo+'T00:00:00Z'),1)))==='2026-09');
ok('virada de ano: depois do fechamento de dezembro vem janeiro',
   finCicloDaData(finISO(finDiasDe(new Date(finDataFechamento(2026,12)+'T00:00:00Z'),1)))==='2027-01');

console.log('\n— Apuração do fechamento —');
finLanc={
  a:{id:'a',descricao:'Tania',...tania,repasses:{shirley:{repassado:true,repassadoEm:'2026-08-26'}}},
  b:{id:'b',descricao:'Basiotti — Un. 22',valorEscritura:5755.61,parteTabeliao:3427.23,arranjoId:'basiotti',status:'pago',dataPagamento:'2026-08-11'},
  d:{id:'d',descricao:'Pendente',valorEscritura:2000,parteTabeliao:1000,arranjoId:'direto',status:'pendente',vencimento:'2026-08-20'}
};
finCiclo='2026-08';finFiltroStatus='';
const ap=finApuracao();
const eu=ap.pessoas.find(m=>m.pessoa.id==='shirley');
ok('Shirley: 428,40 da Tania + 142,80 do Basiotti = 571,20',perto(eu.liquido,571.20),eu.liquido);
ok('Shirley: nenhum IR retido na parte dela',eu.ir===0,eu.ir);
ok('Shirley: já repassado 428,40',perto(eu.repassado,428.40),eu.repassado);
ok('Shirley: a repassar 142,80',perto(eu.liquido-eu.repassado,142.80));
ok('Shirley: previsto 125,00 da escritura pendente',perto(eu.previsto,125),eu.previsto);
const gr=ap.pessoas.find(m=>m.pessoa.id==='grazi');
ok('Grazi: 310,59 + 103,53 = 414,12 na mão',perto(gr.liquido,414.12),gr.liquido);
ok('Grazi: 157,08 de IR retido no ciclo',perto(gr.ir,157.08),gr.ir);
ok('Renato entra só pelo caso do Basiotti',perto(ap.pessoas.find(m=>m.pessoa.id==='renato').liquido,207.06),
   ap.pessoas.find(m=>m.pessoa.id==='renato').liquido);
ok('Vinicius não aparece — não participou de nada',!ap.pessoas.find(m=>m.pessoa.id==='vinicius'));
ok('tabelião fica com 2.570,43 × 2',perto(ap.tabeliao,5140.86),ap.tabeliao);

console.log('\n— Salário: a soma das comissões do fechamento —');
const sal=finMeuSalario('2026-08');
ok('soma as duas escrituras pagas do ciclo',perto(sal.total,571.20),sal.total);
ok('a pendente fica de fora',sal.itens.length===2,sal.itens.map(x=>x.descricao));
ok('cada linha traz de onde veio',sal.itens.every(x=>x.descricao&&x.valor>0));
ok('outro fechamento vem zerado',finMeuSalario('2026-09').total===0);
const semDono=JSON.parse(JSON.stringify(finCfg));
finCfg.pessoas=finCfg.pessoas.map(p=>({...p,souEu:false}));
ok('sem "sou eu" marcado, avisa em vez de chutar',finMeuSalario('2026-08').semDono===true);
finCfg=semDono;

console.log('\n— O mês em dinheiro (a parte financeira do quadro) —');
ok('o nome do cliente sai antes do travessão',finClienteDe({descricao:'Tania — escritura de compra e venda'}).nome==='Tania',
   finClienteDe({descricao:'Tania — escritura de compra e venda'}));
ok('acento e caixa não criam dois clientes',
   finClienteDe({descricao:'José da Silva'}).chave===finClienteDe({descricao:'JOSE DA SILVA'}).chave);
ok('sem descrição, o nome do caso serve',finClienteDe({casoNome:'ABG'}).chave==='ABG');
ok('o mês anterior a janeiro é dezembro do ano passado',finCicloAntes('2026-01')==='2025-12',finCicloAntes('2026-01'));

finLanc={
  // Julho: duas escrituras pagas, R$ 2.000 de parte do tabelião cada.
  j1:{id:'j1',descricao:'ABG — Un. 41',parteTabeliao:2000,arranjoId:'direto',status:'pago',dataPagamento:'2026-07-02'},
  j2:{id:'j2',descricao:'PEDRO WAGNER',parteTabeliao:2000,arranjoId:'direto',status:'pago',dataPagamento:'2026-07-20'},
  // Agosto: três pagas — duas do mesmo cliente, escrito de dois jeitos — e
  // uma ainda a receber.
  a1:{id:'a1',descricao:'GUSTAVO BERTOLA — compra e venda',parteTabeliao:3427.23,arranjoId:'direto',status:'pago',dataPagamento:'2026-08-03'},
  a2:{id:'a2',descricao:'Gustavo Bertola',parteTabeliao:3427.23,arranjoId:'renato',status:'pago',dataPagamento:'2026-08-10'},
  a3:{id:'a3',descricao:'THAIS DO COUTO DANTAS',parteTabeliao:2486.77,arranjoId:'direto',status:'pago',dataPagamento:'2026-08-18',valorRegistro:1348.42,registroStatus:'carteira'},
  a4:{id:'a4',descricao:'JULIANA MOREIRA',parteTabeliao:366.39,arranjoId:'direto',status:'pendente',vencimento:'2026-08-21'}
};
finCiclo='2026-08';finFiltroStatus='pago';   // o filtro da aba não vale aqui
const rAgo=finResumoCiclo('2026-08',''), rJul=finResumoCiclo('2026-07','');
ok('conta as quatro escrituras do fechamento, pagas e a receber',rAgo.n===4&&rAgo.pagas===3&&rAgo.pendentes===1,
   [rAgo.n,rAgo.pagas,rAgo.pendentes]);
ok('o filtro de situação da aba não muda o quadro',finFiltroStatus==='pago'&&rAgo.n===4);
ok('parte do tabelião paga: 9.341,23',perto(rAgo.tabeliao,9341.23),rAgo.tabeliao);
ok('veio para a mesa: 856,80 + 856,80 + 621,69 = 2.335,29',perto(rAgo.repasse,2335.29),rAgo.repasse);
ok('a pendente fica no "ainda a receber", não no recebido',perto(rAgo.repasseAReceber,91.59),rAgo.repasseAReceber);
ok('o registro de imóveis fica na carteira, sem virar receita',perto(rAgo.registro,1348.42)&&rAgo.repasse<rAgo.tabeliao,rAgo.registro);
ok('escritura média sobre todas as quatro: 2.426,91',perto(rAgo.ticket,2426.91),rAgo.ticket);

ok('o cliente mais recorrente é o Gustavo, escrito de dois jeitos',
   rAgo.clientes[0].chave==='GUSTAVO BERTOLA'&&rAgo.clientes[0].n===2,rAgo.clientes.map(c=>c.nome+':'+c.n));
ok('três clientes diferentes no fechamento',rAgo.clientes.length===3,rAgo.clientes.map(c=>c.nome));
ok('o arranjo direto vem na frente, com o repasse dele',
   rAgo.arranjos[0].id==='direto'&&perto(rAgo.arranjos[0].repasse,1478.49),rAgo.arranjos.map(a=>a.id+':'+a.repasse));
ok('o caso do Renato aparece à parte',
   rAgo.arranjos[1].id==='renato'&&perto(rAgo.arranjos[1].repasse,856.80),rAgo.arranjos[1]);

const cmp=finComparativoCiclo('2026-08');
ok('julho fechou com 1.000,00 na mesa',perto(rJul.repasse,1000),rJul.repasse);
ok('agosto está aberto — o quadro sabe disso',cmp.aberto===true&&cmp.dias===30,[cmp.aberto,cmp.dias]);
ok('a comparação é com julho',cmp.antesChave==='2026-07'&&cmp.mesAntes==='julho',[cmp.antesChave,cmp.mesAntes]);
const vRep=finVariacao(cmp.atual.repasse,cmp.anterior.repasse);
ok('subiu: 2.335,29 contra 1.000,00',vRep.dir==='alta'&&Math.round(vRep.pct)===134,[vRep.dir,vRep.pct]);
ok('a diferença em reais também volta',perto(vRep.dif,1335.29),vRep.dif);
ok('caiu é caiu',finVariacao(500,1000).dir==='queda'&&Math.round(finVariacao(500,1000).pct)===-50);
ok('mês anterior zerado não vira "subiu 100%"',finVariacao(800,0).dir==='sembase'&&finVariacao(800,0).pct===null);
ok('dois meses zerados são iguais, não sem base',finVariacao(0,0).dir==='igual');
// O corte no meio do ciclo é o que impede meio agosto de ser comparado com
// julho inteiro — sem ele a seta seria vermelha todo dia 26.
const meio=finResumoCiclo('2026-08','2026-08-10');
ok('com data de corte, o resumo para onde mandaram',meio.n===2&&perto(meio.repasse,1713.60),[meio.n,meio.repasse]);
const serie=finSerieCiclos('2026-08',6);
ok('a série não abre com meses vazios que nunca existiram',serie.length===2&&serie[0].chave==='2026-07',serie.map(s=>s.chave));
ok('o último da série é o fechamento escolhido',serie[serie.length-1].chave==='2026-08');
finFiltroStatus='';

console.log('\n— Cofre pessoal (criptografia) —');
await finCriarCofre('senha-de-teste-123');
const guardado=JSON.parse(JSON.stringify(_setCapturado));
ok('só embrulho vai pro banco',JSON.stringify(guardado).indexOf('lancamentos')===-1);
const codigo=finCodigoNovo;
ok('chave de recuperação em 6 grupos',/^([A-Z2-9]{4}-){5}[A-Z2-9]{4}$/.test(codigo),codigo);
finDadosPessoais={lancamentos:[{id:'m1',tipo:'salario',valor:8500,data:'2026-08-05',descricao:'Salário de agosto'}]};
await finGravarCofre();
const g2=JSON.parse(JSON.stringify(_setCapturado));
ok('salário não aparece em claro',JSON.stringify(g2).indexOf('8500')===-1&&JSON.stringify(g2).indexOf('Sal')===-1);
finCofreBruto=g2;finChaveMestra=null;finMestraB64=null;finDadosPessoais={lancamentos:[]};
let barrou=false;
try{await finDestrancar('senha-errada',false);}catch(e){barrou=true;}
ok('senha errada não abre',barrou);
await finDestrancar('senha-de-teste-123',false);
ok('senha certa devolve o lançamento',finDadosPessoais.lancamentos[0].valor===8500);
finChaveMestra=null;finMestraB64=null;finDadosPessoais={lancamentos:[]};
await finDestrancar(codigo,true);
ok('chave de recuperação também abre',finDadosPessoais.lancamentos[0].descricao==='Salário de agosto');
const saltNovo=finB64(crypto.getRandomValues(new Uint8Array(16)));
await update(finPessoalRef,{salt:saltNovo,porSenha:await finCifrar(await finDerivar('outra-senha-999',saltNovo),{k:finMestraB64})});
finCofreBruto=JSON.parse(JSON.stringify(_setCapturado));
finChaveMestra=null;finMestraB64=null;finDadosPessoais={lancamentos:[]};
await finDestrancar('outra-senha-999',false);
ok('senha nova abre depois da troca',finDadosPessoais.lancamentos[0].valor===8500);
finChaveMestra=null;finMestraB64=null;finDadosPessoais={lancamentos:[]};
await finDestrancar(codigo,true);
ok('a chave de recuperação continua valendo após a troca',finDadosPessoais.lancamentos[0].valor===8500);

console.log(falhas?`\n${falhas} FALHA(S)`:'\nTudo passou.');
process.exit(falhas?1:0);
