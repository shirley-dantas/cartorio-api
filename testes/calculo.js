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
