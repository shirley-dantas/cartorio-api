const CHAVE='prime-frase-do-dia-v1';
const RESERVAS=[
  'Um passo de cada vez também constrói grandes conquistas.',
  'Seu cuidado faz diferença em cada detalhe.',
  'O que fazemos juntos torna o caminho mais leve.',
  'Cada pequeno avanço merece ser reconhecido.',
  'Confie no caminho que você constrói com dedicação.',
  'Hoje é uma nova chance de fazer bem feito.',
  'Com calma e constância, a gente chega mais longe.'
];
export function diaEmSP(agora=new Date()){
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(agora);
}
export function iniciarFraseDoDia(elemento,{buscar=fetch,armazenamento=()=>localStorage,agora=()=>new Date()}={}){
  if(!elemento)return;
  let diaNaTela='',emAndamento=false;
  async function atualizar(){
    const data=diaEmSP(agora());
    if(emAndamento||data===diaNaTela)return;
    emAndamento=true;
    try{
      let salvo;
      try{salvo=JSON.parse(armazenamento().getItem(CHAVE)||'null');}catch(_){}
      if(salvo?.data!==data||typeof salvo.frase!=='string'||!salvo.frase||salvo.frase.length>100){
        const fallback=RESERVAS[Math.floor(Date.parse(data+'T12:00:00Z')/86400000)%RESERVAS.length];
        elemento.textContent=fallback;
        salvo={data,frase:fallback,origem:'reserva'};
        try{
          const r=await buscar('/api/perguntar-joaninha?acao=frase-dia',{signal:AbortSignal.timeout(12000)});
          if(!r.ok)throw new Error('Frase indisponível.');
          const recebida=await r.json();
          if(recebida.ok&&recebida.data===data&&typeof recebida.frase==='string'&&recebida.frase.trim()&&recebida.frase.length<=100)salvo=recebida;
        }catch(_){}
        try{armazenamento().setItem(CHAVE,JSON.stringify(salvo));}catch(_){}
      }
      if(diaEmSP(agora())===data){elemento.textContent=salvo.frase;diaNaTela=data;}
    }finally{emAndamento=false;}
  }
  atualizar();
  const timer=setInterval(()=>{if(!document.hidden)atualizar();},60000);
  const aoVoltar=()=>{if(!document.hidden)atualizar();};
  document.addEventListener('visibilitychange',aoVoltar);
  return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',aoVoltar);};
}
