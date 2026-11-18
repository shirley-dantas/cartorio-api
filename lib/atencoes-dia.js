import {horarioNota} from './notas-horario.js';
const FORMATO_DIA=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});

function hash(texto){
  let a=2166136261,b=2654435769;
  for(const letra of String(texto)){const n=letra.codePointAt(0);a=Math.imul(a^n,16777619);b=Math.imul(b^n,2246822507);}
  return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
}
function instante(v){
  if(typeof v==='number')return Number.isFinite(v)&&v>0?v:NaN;
  if(typeof v!=='string'||!v)return NaN;
  if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(v))return NaN;
  const [ano,mes,d]=v.slice(0,10).split('-').map(Number);
  if(mes<1||mes>12||d<1||d>new Date(Date.UTC(ano,mes,0)).getUTCDate())return NaN;
  if(v.length===10)return Date.parse(v+'T00:00:00-03:00');
  return Date.parse(/Z$|[+-]\d{2}:\d{2}$/.test(v)?v:v+'-03:00');
}
function dia(t){
  const s=FORMATO_DIA.format(new Date(t));
  return Date.parse(s+'T12:00:00Z')/86400000;
}
function datasCaso(c){
  return [c.depDesde,c.atualizado,c.criadoEm,c.auditoria?.atualizado,
    ...Object.values(c.historico||{}).map(h=>h?.data),
    ...Object.values(c.documentos||{}).flatMap(d=>[d?.salvoEm,d?.recebidoEm,d?.criadoEm,d?.atualizadoEm]),
    ...Object.values(c.tarefasJoaninha||{}).flatMap(t=>[t?.criadoEm,t?.atualizadoEm,t?.concluidoEm])];
}
export function chaveAtencaoCaso(c){
  const documentos=Object.entries(c.documentos||{}).sort(([a],[b])=>a.localeCompare(b)).map(([id,d])=>[id,d?.salvoEm,d?.atualizadoEm,d?.truncado]);
  const datas=datasCaso(c).map(v=>v??null).sort((a,b)=>String(a).localeCompare(String(b)));
  return `atc1_c_${hash(c.id)}_${hash(JSON.stringify([c.dep,c.depDesde,c.atualizado,c.resp,c.status,c.obs,c.docUrl,c.auditoria?.atualizado,datas,documentos]))}`;
}
export function chaveAtencaoNota(n){return `atc1_n_${hash(n.id)}_${hash(JSON.stringify([n.text,n.quando,n.resp,n.urgente]))}`;}
function responsavel(r){return ({shirley:'Shirley',grazi:'Grazi',gabriel:'Gabriel',ambas:'Shirley e Grazi'})[r]||(r?String(r):'Responsável a definir');}

// Leitura pura. Não escreve, não conclui etapas e não chama IA ou Calendar.
export function calcularAtencoes({casos=[],notas=[],config={},resolucoes={},agora=new Date(),limite=3,nome=''}={}){
  const agoraMs=new Date(agora).getTime(),diaAtual=dia(agoraMs),itens=[];
  for(const nota of Array.isArray(notas)?notas:Object.values(notas||{})){
    const horario=nota&&!nota.done&&horarioNota(nota.quando,agora);
    if(!horario?.atrasada||!nota.id)continue;
    const caso=casos.find(c=>c&&!c.concluido&&c.nome===nota.casoNome);
    const distancia=diaAtual-dia(horario.instante);
    const [h,m]=(horario.campo.slice(11)||'').split(':');
    const hora=horario.soDia?'':`, às ${Number(h)}h${m==='00'?'':m}`;
    const quando=distancia===0?'hoje'+hora:distancia===1?'ontem'+hora:horario.texto;
    itens.push({chave:chaveAtencaoNota(nota),tipo:'nota',id:nota.id,casoId:caso?.id||null,titulo:nota.text||'Tarefa sem descrição',nomeCaso:nota.casoNome||'',
      motivo:`Essa tarefa era para ${quando}.`,acao:'Ainda precisa fazer?',resp:nota.resp||'',responsavel:responsavel(nota.resp),
      prioridade:nota.urgente?0:1,ordem:horario.instante,quando:nota.quando});
  }
  for(const c of casos){
    if(!c||c.concluido||!c.id)continue;
    const regra=config[c.dep||''];
    if(!regra||regra.normalAte==null||!Number.isFinite(Number(regra.normalAte)))continue;
    const datas=datasCaso(c).map(instante).filter(t=>Number.isFinite(t)&&t<=agoraMs);
    if(!datas.length)continue;
    const ultima=Math.max(...datas),dias=Math.max(0,diaAtual-dia(ultima)),prazo=Math.max(0,Number(regra.normalAte));
    if(dias<=prazo)continue;
    const prioridade=c.dep==='Nota de exigência'?0:c.status==='prioridade'?1:regra.quemSegura==='cartorio'?2:3;
    const proxima=(regra.proximaAcao||'Conferir o andamento do caso').replace(/[.!?]+$/,'');
    let acao=`Que tal ${proxima.charAt(0).toLowerCase()+proxima.slice(1)}?`;
    if(c.dep==='Minutando')acao=String(c.resp||'').toLowerCase()===String(nome).toLowerCase()?'Como está a minuta?':
      ['shirley','grazi','gabriel'].includes(c.resp)?`Vamos ver com ${c.resp==='gabriel'?'o':'a'} ${responsavel(c.resp)} como está a minuta?`:'Vamos ver como está a minuta?';
    if(c.dep==='Nota de exigência')acao='Vamos conferir o que falta para resolver essa exigência?';
    if(c.dep==='Registro de Imóveis')acao='Vamos ver se houve retorno do registro?';
    itens.push({chave:chaveAtencaoCaso(c),tipo:'caso',id:c.id,casoId:c.id,titulo:c.nome||'Caso sem nome',nomeCaso:c.dep||'',
      motivo:`Faz ${dias} ${dias===1?'dia':'dias'} que não aparece uma atualização por aqui.`,
      acao,resp:c.resp||'',responsavel:responsavel(c.resp),prioridade,ordem:-(dias-prazo)/Math.max(1,prazo),dias,prazo});
  }
  const todas=itens.map(item=>{
    const r=resolucoes[item.chave],ate=r?.estado==='atencao_adiada'?instante(r.ate):NaN;
    return {...item,adiada:Number.isFinite(ate)&&ate>agoraMs,adiadaAte:Number.isFinite(ate)?r.ate:null};
  }).sort((a,b)=>Number(a.adiada)-Number(b.adiada)||a.prioridade-b.prioridade||a.ordem-b.ordem||a.chave.localeCompare(b.chave));
  const ativas=todas.filter(i=>!i.adiada),adiadas=todas.filter(i=>i.adiada);
  const tarefas=ativas.filter(i=>i.tipo==='nota').length,parados=ativas.filter(i=>i.tipo==='caso').length;
  const prioridades=ativas.slice(0,Math.max(1,Math.min(5,limite)));
  const resumo=prioridades.length?`${nome?nome+', separei':'Separei'} ${prioridades.length} ${prioridades.length===1?'ponto':'pontos'} para a gente olhar hoje.`:
    adiadas.length?'Combinado! Os lembretes voltam por aqui nos horários que você escolheu.':'Por enquanto, nenhum lembrete por aqui.';
  return {todas,ativas,adiadas,prioridades,resumo,tarefas,casos:parados};
}
