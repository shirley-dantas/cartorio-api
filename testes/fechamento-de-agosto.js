// O fechamento de agosto de 2026 — as dezessete escrituras que a Shirley
// conferiu à mão na planilha antiga, com a parte do tabelião de cada uma.
// Serve para olhar a tela com dados de verdade, e para o teste de cálculo
// comparar linha a linha com o que ela somava no Excel.
const REAIS=[['ELISABETH BOTSARIS',2486.77],['PEDRO WAGNER',2025.08],['VIVIANE PIRES',2735.91],
 ['MATHEUS BAGAROLLO',2486.77],['CARLOS ALBERTO',366.39],['EMERSON DURAN',4174.71],
 ['RAIANA ROSENDO',2271.77],['NICOLAS FERREIRA',2486.77],['JULIANA MOREIRA',366.39],
 ['LEONARDO FERRAZO',2486.77],['ABG',3231.80],['SHAMONNY',708.41],
 ['THAIS DO COUTO DANTAS',2486.77],['GUSTAVO BERTOLA',366.39],['GUSTAVO BERTOLA',3427.23],
 ['GUSTAVO BERTOLA',3427.23],['ABG',1348.42]];
_set('financeiro/config',{percentualRepasse:25,percentualIR:27.5,
  pessoas:[{id:'shirley',nome:'Shirley',tipo:'equipe',descontaIR:false,souEu:true},
           {id:'grazi',nome:'Grazi',tipo:'equipe',descontaIR:true},
           {id:'renato',nome:'Renato',tipo:'parceiro',descontaIR:true},
           {id:'basiotti',nome:'Basiotti',tipo:'parceiro',descontaIR:true},
           {id:'vinicius',nome:'Vinicius',tipo:'parceiro',descontaIR:true}],
  arranjos:[{id:'direto',nome:'Direto — sem parceiro',grupos:{shirley:1,grazi:2}},
            {id:'renato',nome:'Renato',grupos:{shirley:1,grazi:2,renato:3}},
            {id:'basiotti',nome:'Basiotti',grupos:{shirley:1,grazi:1,basiotti:2,renato:3}},
            {id:'vinicius',nome:'Vinicius',grupos:{shirley:1,grazi:2,vinicius:3}}]});
_set('acesso/uid-shirley',{nome:'Shirley',dono:true});
REAIS.forEach(([nome,tab],i)=>{
  const id='e'+i;
  _set('financeiro/lancamentos/'+id,{id,descricao:nome,tipoAto:'Escritura',
    valorEscritura:Math.round(tab*1.6*100)/100,parteTabeliao:tab,
    arranjoId:i===10?'basiotti':(i===4?'renato':'direto'),
    status:i>14?'pendente':'pago',
    dataPagamento:i>14?'':('2026-08-'+String(3+i).padStart(2,'0')),
    vencimento:i>14?'2026-08-24':'',
    valorRegistro:(i%5===0)?1348.42:0,registroStatus:'carteira'});
