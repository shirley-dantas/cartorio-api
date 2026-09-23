// ════════════════════════════════════════════════════════════════════
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
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function isoHoje(){return new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})}

const FIN_CFG_PADRAO={
  percentualRepasse:25,
  percentualIR:27.5,
  pessoas:[
    {id:'shirley', nome:'Shirley', tipo:'equipe',   descontaIR:false, souEu:true},
    {id:'grazi',   nome:'Grazi',   tipo:'equipe',   descontaIR:true},
    {id:'renato',  nome:'Renato',  tipo:'parceiro', descontaIR:true},
    {id:'basiotti',nome:'Basiotti',tipo:'parceiro', descontaIR:true},
    {id:'vinicius',nome:'Vinicius',tipo:'parceiro', descontaIR:true}
  ],
  // grupos: quem tem o mesmo número divide a MESMA quota entre si.
  arranjos:[
    {id:'direto',  nome:'Direto — sem parceiro', grupos:{shirley:1,grazi:2}},
    {id:'renato',  nome:'Renato',                grupos:{shirley:1,grazi:2,renato:3}},
    {id:'basiotti',nome:'Basiotti',              grupos:{shirley:1,grazi:1,basiotti:2,renato:3}},
    {id:'vinicius',nome:'Vinicius',              grupos:{shirley:1,grazi:2,vinicius:3}}
  ]
};

let finLanc={};
let finCfg=JSON.parse(JSON.stringify(FIN_CFG_PADRAO));
let finAba='lancamentos';
let finCiclo=null;            // chave 'AAAA-MM' do fechamento, ou '' pra todos
let finFiltroStatus='';
let finEditando=null;
let finAberto=false;
let finOuvindo=false;

// ── Dinheiro ──
function finMoeda(v){return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function finCent(v){return Math.round((Number(v)||0)*100)/100;}
function finTrunc(v){return Math.floor((Number(v)||0)*100+1e-6)/100;}
// Aceita o que a mão digita: "5.755,61", "5755,61", "5755.61" ou "5755".
// O caso perigoso é "2.000" sem centavos: em português isso é dois mil, e ler
// como dois reais estragaria a conta inteira em silêncio. Por isso o ponto só
// vira separador de milhar quando o número tem a cara disso (grupos de três).
function finNum(s){
  if(typeof s==='number')return isFinite(s)?s:0;
  let t=String(s==null?'':s).replace(/[^\d,.-]/g,'');
  if(!t)return 0;
  if(t.indexOf(',')>-1)t=t.replace(/\./g,'').replace(',','.');
  else if(/^-?\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,'');
  const n=parseFloat(t);
  return isNaN(n)?0:n;
}
function finBr(v){return String(finCent(v).toFixed(2)).replace('.',',');}
// Percentual não é dinheiro: 27,5% não vira 27,50%, e 25% não vira 25,00%.
function finPct(v){return String(Number(v)||0).replace('.',',');}
function finDataBr(d){
  if(!d)return'—';
  const p=String(d).slice(0,10).split('-');
  return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:d;
}
function finToast(msg){
  const el=document.getElementById('nav-toast');
  if(!el)return;
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(navToastTimer);
  navToastTimer=setTimeout(()=>el.classList.remove('show'),2600);
}

// ── Calendário do fechamento (26 → 25, antecipando fim de semana e feriado) ──
// A Páscoa manda no Carnaval, na Sexta-feira Santa e em Corpus Christi, então
// ela é calculada; o resto é data fixa, nacional e de São Paulo.
function finPascoa(ano){
  const a=ano%19,b=Math.floor(ano/100),c=ano%100,d=Math.floor(b/4),e=b%4;
  const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const mes=Math.floor((h+l-7*m+114)/31),dia=((h+l-7*m+114)%31)+1;
  return new Date(Date.UTC(ano,mes-1,dia));
}
function finDiasDe(base,n){const d=new Date(base.getTime());d.setUTCDate(d.getUTCDate()+n);return d;}
function finISO(d){return d.toISOString().slice(0,10);}
const _finFeriadosCache={};
function finFeriados(ano){
  if(_finFeriadosCache[ano])return _finFeriadosCache[ano];
  const p=finPascoa(ano);
  const set={};
  [`${ano}-01-01`,`${ano}-01-25`,`${ano}-04-21`,`${ano}-05-01`,`${ano}-07-09`,
   `${ano}-09-07`,`${ano}-10-12`,`${ano}-11-02`,`${ano}-11-15`,`${ano}-11-20`,
   `${ano}-12-25`].forEach(d=>set[d]=1);
  [finDiasDe(p,-48),finDiasDe(p,-47),finDiasDe(p,-2),finDiasDe(p,60)].forEach(d=>set[finISO(d)]=1);
  _finFeriadosCache[ano]=set;
  return set;
}
function finEhUtil(d){
  const s=d.getUTCDay();
  if(s===0||s===6)return false;
  return !finFeriados(d.getUTCFullYear())[finISO(d)];
}
// O fechamento do mês: dia 25, recuando até o último dia útil antes dele.
function finDataFechamento(ano,mes){
  let d=new Date(Date.UTC(ano,mes-1,25));
  let voltas=0;
  while(!finEhUtil(d)&&voltas++<10)d=finDiasDe(d,-1);
  return finISO(d);
}
// O ciclo é batizado pelo mês em que fecha: o "fechamento de setembro" começa
// no dia seguinte ao fechamento de agosto e termina no de setembro.
function finCicloPorChave(chave){
  const a=+chave.slice(0,4), m=+chave.slice(5,7);
  const fim=finDataFechamento(a,m);
  const ant=m===1?finDataFechamento(a-1,12):finDataFechamento(a,m-1);
  const inicio=finISO(finDiasDe(new Date(ant+'T00:00:00Z'),1));
  return {chave,inicio,fim,rotulo:`Fechamento de ${MESES[m-1]}`,periodo:`${finDataBr(inicio)} a ${finDataBr(fim)}`};
}
function finCicloDaData(iso){
  if(!iso)return '';
  const d=String(iso).slice(0,10);
  const a=+d.slice(0,4), m=+d.slice(5,7);
  // Depois do fechamento deste mês, o lançamento já pertence ao ciclo seguinte.
  if(d>finDataFechamento(a,m))return m===12?`${a+1}-01`:`${a}-${String(m+1).padStart(2,'0')}`;
  return `${a}-${String(m).padStart(2,'0')}`;
}
function finCicloCorrente(){return finCicloDaData(isoHoje());}

// ── A conta ──
function finPessoas(){return (finCfg&&Array.isArray(finCfg.pessoas)?finCfg.pessoas:[]).filter(p=>p&&p.id);}
function finPessoa(id){return finPessoas().find(p=>p.id===id)||{id,nome:id,tipo:'equipe',descontaIR:true};}
function finSouEu(){return finPessoas().find(p=>p.souEu)||null;}
function finArranjos(){return (finCfg&&Array.isArray(finCfg.arranjos)?finCfg.arranjos:[]).filter(a=>a&&a.id);}
function finArranjo(id){return finArranjos().find(a=>a.id===id)||finArranjos()[0]||{id:'',nome:'—',grupos:{}};}
// Quem tem o mesmo número divide a mesma quota; número 0 ou ausente fica fora.
function finQuotas(arranjo){
  const por={};
  const g=(arranjo&&arranjo.grupos)||{};
  Object.keys(g).forEach(pid=>{
    const n=Number(g[pid])||0;
    if(n>0)(por[n]=por[n]||[]).push(pid);
  });
  return Object.keys(por).sort((a,b)=>a-b).map(k=>por[k]);
}
// Cada parte é arredondada por si, como na planilha que a Shirley conferia à
// mão: metade de R$ 621,69 vira R$ 310,85 para as duas, e não 310,85 e
// 310,84. Isso faz as partes somarem até um centavo a mais (ou a menos) que
// o repasse — a diferença aparece na escada do lançamento, porque é dinheiro
// que sai (ou fica) do bolso de quem repassa, e sumir com ela em silêncio
// seria pior do que ela existir.
function finDividirCentavos(total,n){
  if(n<=0)return [];
  const parte=Math.round(Math.abs(total)/n)*(total<0?-1:1);
  return Array.from({length:n},()=>parte);
}
function finConta(l){
  l=l||{};
  const escritura=finCent(finNum(l.valorEscritura));
  const tabeliao=finCent(finNum(l.parteTabeliao));
  const pctRepasse=Number(finCfg.percentualRepasse)||0;
  const pctIR=Number(finCfg.percentualIR)||0;
  // Truncado, não arredondado: 25% de R$ 3.427,23 dá R$ 856,8075 e o que a
  // Shirley recebe de fato é R$ 856,80. Arredondar para cima inventaria um
  // centavo que o tabelião não repassou, e o erro apareceria no fechamento.
  const brutoAuto=finTrunc(tabeliao*pctRepasse/100);
  const manual=l.repasseManual!==undefined&&l.repasseManual!==''&&l.repasseManual!==null;
  const bruto=manual?finCent(finNum(l.repasseManual)):brutoAuto;
  const arranjo=finArranjo(l.arranjoId);
  const quotas=finQuotas(arranjo);
  const ajustes=l.ajustes||{};

  const brutoCent=Math.round(bruto*100);
  const porQuota=finDividirCentavos(brutoCent,quotas.length);
  const linhas=[];
  quotas.forEach((grupo,qi)=>{
    const partes=finDividirCentavos(porQuota[qi]||0,grupo.length);
    grupo.forEach((pid,gi)=>{
      const p=finPessoa(pid);
      const ajustado=ajustes[pid]!==undefined&&ajustes[pid]!==''&&ajustes[pid]!==null;
      const bCent=ajustado?Math.round(finNum(ajustes[pid])*100):(partes[gi]||0);
      const irCent=p.descontaIR===false?0:Math.round(bCent*pctIR/100);
      const rep=(l.repasses||{})[pid]||{};
      linhas.push({
        id:pid,nome:p.nome||pid,tipo:p.tipo||'equipe',
        quotaRot:quotas.length?`1/${quotas.length}${grupo.length>1?` ÷ ${grupo.length}`:''}`:'—',
        bruto:bCent/100, ir:irCent/100, liquido:(bCent-irCent)/100,
        descontaIR:p.descontaIR!==false, ajustado,
        repassado:rep.repassado===true, repassadoEm:rep.repassadoEm||''
      });
    });
  });
  const somaBruto=finCent(linhas.reduce((s,x)=>s+x.bruto,0));
  const irTotal=finCent(linhas.reduce((s,x)=>s+x.ir,0));
  return {
    escritura,tabeliao,
    // o que nunca chegou ao tabelião: emolumentos, tributos, o que o cartório retém
    naoTabeliao:finCent(escritura-tabeliao),
    pctRepasse,pctIR,manual,
    bruto,                                  // o que o tabelião repassou
    distribuido:somaBruto,                  // o que as partes somam depois de arredondadas
    ficaTabeliao:finCent(tabeliao-bruto),
    arredondamento:finCent(somaBruto-bruto),
    irTotal,liquido:finCent(somaBruto-irTotal),
    arranjo,linhas,
    registro:{
      valor:finCent(finNum(l.valorRegistro)),
      pago:l.registroStatus==='pago',
      pagoEm:l.registroPagoEm||''
    }
  };
}
function finDataOrd(l){return (l.status==='pago'?(l.dataPagamento||l.vencimento):(l.vencimento||l.dataPagamento))||l.criadoEm||'';}
function finCicloDoLanc(l){return finCicloDaData(finDataOrd(l));}

function finMeuSalario(ciclo){
  const eu=finSouEu();
  if(!eu)return {total:0,itens:[],semDono:true};
  const itens=[];
  Object.keys(finLanc).forEach(k=>{
    const l=finLanc[k];
    if(!l||l.status!=='pago')return;
    if(ciclo&&finCicloDoLanc(l)!==ciclo)return;
    const minha=finConta(l).linhas.find(d=>d.id===eu.id);
    if(!minha||!minha.liquido)return;
    itens.push({
      descricao:l.descricao||l.casoNome||'Escritura',
      data:l.dataPagamento||'',valor:minha.liquido,
      bruto:minha.bruto,ir:minha.ir,repassado:minha.repassado
    });
  });
  itens.sort((a,b)=>String(b.data).localeCompare(String(a.data)));
  return {total:finCent(itens.reduce((s,x)=>s+x.valor,0)),itens,semDono:false};
}

const FIN_PBKDF2_VOLTAS=250000;
const FIN_MINUTOS_ATE_TRANCAR=15;
const finTE=new TextEncoder(), finTD=new TextDecoder();
function finB64(buf){
  const b=new Uint8Array(buf);
  let s='';
  for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);
  return btoa(s);
}
function finDeB64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
async function finDerivar(segredo,saltB64){
  const base=await crypto.subtle.importKey('raw',finTE.encode(segredo),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2',salt:finDeB64(saltB64),iterations:FIN_PBKDF2_VOLTAS,hash:'SHA-256'},
    base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function finCifrar(chave,obj){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},chave,finTE.encode(JSON.stringify(obj)));
  return {iv:finB64(iv),ct:finB64(ct)};
}
async function finDecifrar(chave,pacote){
  const txt=await crypto.subtle.decrypt({name:'AES-GCM',iv:finDeB64(pacote.iv)},chave,finDeB64(pacote.ct));
  return JSON.parse(finTD.decode(txt));
}
async function finImportarMestra(rawB64){
  return crypto.subtle.importKey('raw',finDeB64(rawB64),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function finDestrancar(segredo,viaRecuperacao){
  const c=finCofreBruto;
  if(!c)throw new Error('sem cofre');
  const k=await finDerivar(segredo,viaRecuperacao?c.saltRec:c.salt);
  const pacote=viaRecuperacao?c.porRecuperacao:c.porSenha;
  const aberto=await finDecifrar(k,pacote);   // senha errada estoura aqui
  finChaveMestra=await finImportarMestra(aberto.k);
  finMestraB64=aberto.k;
  finDadosPessoais=await finDecifrar(finChaveMestra,c.dados);
  if(!Array.isArray(finDadosPessoais.lancamentos))finDadosPessoais.lancamentos=[];
}

let finCofreBruto=null, finChaveMestra=null, finMestraB64=null, finDadosPessoais={lancamentos:[]}, finCicloPessoal=null;
function finPessoalDoCiclo(){
  return (finDadosPessoais.lancamentos||[])
    .filter(x=>x&&(!finCicloPessoal||finCicloDaData(x.data)===finCicloPessoal))
    .sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')));
}
function finSomaPessoal(arr,tipo){return finCent(arr.filter(x=>x.tipo===tipo).reduce((s,x)=>s+finNum(x.valor),0));}

// Abre o cofre com a senha do Meu financeiro. A chave fica só na memória.
function abrirCofre(cofre, senha){ finCofreBruto = cofre; return finDestrancar(senha, false); }
// Abre direto com a chave mestra já em mãos, sem pedir a senha de novo — é o
// "lembrar no tablet" (pedido dela, 23/09/2026): o Bússola guarda essa chave
// no localStorage depois do primeiro "Abrir", e usa aqui a partir de então.
// Quem pegar o tablet destravado vê os extras sem digitar nada — é a troca
// que ela topou, sabendo disso.
async function abrirCofreComChave(cofre, chaveB64){
  finCofreBruto = cofre;
  finChaveMestra = await finImportarMestra(chaveB64);
  finMestraB64 = chaveB64;
  finDadosPessoais = await finDecifrar(finChaveMestra, cofre.dados);
  if (!Array.isArray(finDadosPessoais.lancamentos)) finDadosPessoais.lancamentos = [];
}
function chaveMestra(){ return finMestraB64; }
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
  abrirCofreComChave: abrirCofreComChave,
  chaveMestra: chaveMestra,
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
