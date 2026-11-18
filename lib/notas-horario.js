// Datas locais das notas representam o horário de São Paulo.
// Esta apresentação não cria eventos no Google Calendar.
export function horarioNota(quando,agora=new Date()){
  if(typeof quando!=='string'||!quando.trim())return null;
  const valor=quando.trim(),soDia=/^\d{4}-\d{2}-\d{2}$/.test(valor);
  if(!soDia&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(valor))return null;
  const [ano,mes,diaDoMes]=valor.slice(0,10).split('-').map(Number);
  if(mes<1||mes>12||diaDoMes<1||diaDoMes>new Date(Date.UTC(ano,mes,0)).getUTCDate())return null;
  const completo=soDia?valor+'T23:59:59.999-03:00':/[zZ]$|[+-]\d{2}:\d{2}$/.test(valor)?valor:valor+'-03:00';
  const data=new Date(completo),instante=data.getTime();
  if(!Number.isFinite(instante))return null;
  const opcoes={timeZone:'America/Sao_Paulo'};
  const dia=data.toLocaleDateString('pt-BR',{...opcoes,day:'2-digit',month:'2-digit',year:'numeric'});
  const hora=data.toLocaleTimeString('pt-BR',{...opcoes,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const campoDia=new Intl.DateTimeFormat('sv-SE',{...opcoes,year:'numeric',month:'2-digit',day:'2-digit'}).format(data);
  return {instante,soDia,atrasada:instante<new Date(agora).getTime(),texto:soDia?dia:`${dia} às ${hora}`,campo:soDia?'':campoDia+'T'+hora};
}
export function ordenarNotasPorHorario(notas){
  return notas.map(nota=>({nota,instante:horarioNota(nota.quando)?.instante??Infinity}))
    .sort((a,b)=>a.instante===b.instante?0:a.instante-b.instante).map(item=>item.nota);
}
