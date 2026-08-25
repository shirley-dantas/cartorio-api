// Um fechamento de julho para o quadro ter com o que comparar.
//
// Os valores são escrituras reais do cartório — as mesmas parcelas da parte
// do tabelião que ela conferiu à mão —, mas as DATAS foram trazidas para o
// ciclo de julho. Isso serve só para desenhar a tela de evolução: sem um mês
// anterior no banco, o cartão diria "julho não teve com que comparar" e não
// haveria o que olhar. Nada disto vai para o painel publicado.
const JULHO=[['ELISABETH BOTSARIS',2486.77],['CARLOS ALBERTO',366.39],['ABG',3231.80],
 ['MARIANA VOLPI',2025.08],['ABG',708.41],['EMERSON DURAN',2271.77],
 ['NICOLAS FERREIRA',2486.77],['SHAMONNY',366.39],['THAIS DO COUTO DANTAS',1348.42],
 ['PEDRO WAGNER',2735.91]];
JULHO.forEach(([nome,tab],i)=>{
  const id='j'+i;
  _set('financeiro/lancamentos/'+id,{id,descricao:nome,tipoAto:'Escritura',
    parteTabeliao:tab,arranjoId:(i===2||i===4)?'basiotti':(i===5?'vinicius':'direto'),
    status:'pago',dataPagamento:'2026-07-'+String(1+i*2).padStart(2,'0'),
    valorRegistro:0,registroStatus:'carteira'});
});
