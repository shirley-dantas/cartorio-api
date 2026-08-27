// Um dia de Radar com dados de verdade, para olhar o desenho da tela.
//
// O conteúdo é o caso do ITCMD, que foi o que deu origem ao critério — e é o
// melhor exemplo do que a tela precisa dar conta: uma dispensa que vale só
// para metade do caminho, uma notícia que ainda não é norma, e uma fonte que
// não respondeu.
(function(){
  const hoje = new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
  const ontem = new Date(Date.now()-864e5).toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
  const anteontem = new Date(Date.now()-1728e5).toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});

  const dia = {
    data: hoje, gerado: hoje+'T09:04:00.000Z', status:'ok',
    resumo:'O CNJ dispensou o ITCMD para lavrar inventário — e só para lavrar.',
    alerta:'Avise quem tem inventário na mesa: a escritura sai, o registro ainda não.',
    contagem:{muda:1, breve:1, saber:1, fora:1},
    fontesLidas:['tjsp-cgj','cnj','sefaz-sp','pmsp','doe-sp','stj','stf','cnbsp','legis-sp'],
    fontesNaoLidas:[{id:'anoregsp', nome:'ANOREG/SP', erro:'não respondeu a tempo'}],
    relatorio:'',
    itens:[
      {selo:'🔴', especie:'decisao', orgao:'CNJ', referencia:'PP nº 0008622-24.2025.2.00.0000',
       data:'2026-08-18', titulo:'ITCMD deixa de ser exigido para lavrar inventário e partilha',
       oQueMuda:'A escritura de inventário e partilha pode ser lavrada sem a guia do ITCMD paga. O Plenário revogou, por unanimidade, o trecho do art. 15 da Resolução CNJ 35/2007 que fazia a exigência.',
       oQueNaoMuda:'O imposto continua devido, com os mesmos prazos e a mesma alíquota da SEFAZ/SP. E o Registro de Imóveis continua exigindo a comprovação do recolhimento para efetivar a transferência — isso é lei tributária estadual mais o art. 289 da Lei de Registros Públicos, matéria que o CNJ não alcança.',
       etapas:[{etapa:'Escritura', situacao:'dispensado', base:'CNJ, 18/08/2026'},
               {etapa:'Registro', situacao:'continua exigido', base:'art. 289 da Lei 6.015/73'}],
       confirmado:true, parcial:false},
      {selo:'🟠', especie:'noticia', orgao:'ANOREG/SP', referencia:'número não localizado no material de hoje',
       titulo:'Fala-se em Provimento da CGJ alinhando São Paulo à decisão do CNJ sobre certidões',
       oQueMuda:'Nada ainda: é matéria de portal, e o ato não foi localizado em fonte primária.',
       confirmado:false, parcial:true,
       aConfirmar:'Localizar o Provimento no site do TJSP antes de citar em qualquer nota devolutiva.',
       etapas:[]},
      {selo:'🟢', especie:'norma', orgao:'SEFAZ/SP', referencia:'Portaria CAT 12/2026', data: ontem,
       titulo:'A SEFAZ reafirmou o prazo de 60 dias para a declaração do ITCMD',
       oQueMuda:'Nada na prática — confirma o que já se fazia. Serve para explicar ao cliente com segurança.',
       confirmado:true, parcial:false, etapas:[]},
      {selo:'⚪', especie:'norma', orgao:'CNJ', referencia:'Provimento 200/2026',
       titulo:'Regras de plantão de serventias extrajudiciais no Acre',
       oQueMuda:'Não alcança a Capital de São Paulo.', confirmado:true, parcial:false, etapas:[]}
    ]
  };

  const linha = d => ({data:d.data, status:d.status, resumo:d.resumo, alerta:d.alerta||null,
                       contagem:d.contagem, naoLidas:(d.fontesNaoLidas||[]).length});
  const diaCalmo = {data:ontem, gerado:ontem+'T09:02:00.000Z', status:'ok',
    resumo:'Dia calmo: nada muda na mesa hoje.', alerta:null,
    contagem:{muda:0,breve:0,saber:1,fora:2}, fontesNaoLidas:[], itens:[], relatorio:''};
  const diaFalho = {data:anteontem, gerado:anteontem+'T09:01:00.000Z', status:'falhou',
    resumo:'A varredura falhou — o dia não foi lido.', alerta:null,
    contagem:{muda:0,breve:0,saber:0,fora:0}, fontesNaoLidas:[], itens:[],
    erro:'a IA não devolveu JSON',
    relatorio:'A varredura do dia não terminou. Isso não quer dizer que nada mudou: quer dizer que ninguém olhou.'};

  window.__raiz['radar-juridico'] = {[anteontem]:diaFalho, [ontem]:diaCalmo, [hoje]:dia};
  window.__raiz['radar-juridico-meta'] = {
    ultimaVarredura: dia.gerado, ultimoDia: hoje, status:'ok',
    dias:{[anteontem]:linha(diaFalho), [ontem]:linha(diaCalmo), [hoje]:linha(dia)}
  };
})();
