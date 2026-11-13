// Seletores operacionais do card. A apresentação não modifica valores nem etapas.
const rotulos={status:'Status',dep:'Etapa',resp:'Responsável'};
const status=[['prioridade','Prioridade'],['critico','Crítico'],['atencao','Atenção'],['emdia','Em dia']];
const responsaveis=[['shirley','Shirley'],['grazi','Grazi']];
const etapasApoio=new Set(['Aguardando cliente (outro)','Falta documentos','Nota de exigência','Jurídico Prime']);
const etapasPos=new Set(['Aguardando TQ','Aguardando traslado','Traslado pronto — providenciar envio','Pré-conferência','Registro de Imóveis','Prefeitura','Entregar para o cliente','Concluído']);
const escapar=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normal=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

export function opcoesCampo(campo,etapas=[]){
 if(campo==='status')return status.map(([valor,rotulo])=>({valor,rotulo,grupo:''}));
 if(campo==='resp')return responsaveis.map(([valor,rotulo])=>({valor,rotulo,grupo:''}));
 if(campo==='dep')return etapas.map(valor=>({valor,rotulo:valor||'Sem etapa definida',grupo:!valor?'':etapasApoio.has(valor)?'Pendências e apoio':etapasPos.has(valor)?'Pós-assinatura':'Preparação e minuta'}));
 return [];
}
function valorExibido(c, campo, etapas){
 const valor=String(c[campo]??''),opcao=opcoesCampo(campo,etapas).find(o=>o.valor===valor);
 if(opcao)return opcao.rotulo;
 if(campo==='resp')return valor?'Responsável anterior':'Definir responsável';
 return valor||'Não definido';
}
export function camposCasoHtml(c,etapas){
 return `<div class="cx-campos">${Object.keys(rotulos).map(campo=>{
  const id='signature-campo-'+c.id+'-'+campo;
  return `<div class="cx-campo signature-campo"><span class="cx-campo-rot">${rotulos[campo]}</span><button type="button" role="combobox" id="${escapar(id)}" aria-label="${rotulos[campo]}" aria-expanded="false" aria-haspopup="listbox" aria-controls="${escapar(id)}-lista" data-campo-abrir="${campo}" data-caso="${escapar(c.id)}">${campo==='status'?`<span class="signature-status-ponto" data-status="${escapar(c.status)}" aria-hidden="true"></span>`:''}<span class="signature-campo-valor">${escapar(valorExibido(c,campo,etapas))}</span><svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`;
 }).join('')}</div>`;
}

export function instalarCamposCaso({obterCaso,obterEtapas,alterar}){
 let atual=null;
 function fechar(foco=false){
  if(!atual)return;
  const {gatilho,painel,observador}=atual;atual=null;observador.disconnect();
  gatilho.setAttribute('aria-expanded','false');painel.remove();
  if(foco)document.getElementById(gatilho.id)?.focus();
 }
 function posicionar(){
  if(!atual)return;
  const {gatilho,painel,lista}=atual,r=gatilho.getBoundingClientRect();
  const largura=Math.min(Math.max(r.width,280),440,innerWidth-24);
  const altura=window.visualViewport?.height||innerHeight;
  const abaixo=altura-r.bottom-16,acima=Math.min(r.top-16,altura-24),espaco=Math.max(120,Math.min(380,abaixo>=220?abaixo:acima));
  painel.style.width=largura+'px';painel.style.left=Math.max(12,Math.min(r.left,innerWidth-largura-12))+'px';
  lista.style.maxHeight=Math.max(90,espaco-(atual.campo==='dep'?99:49))+'px';
  painel.style.top=Math.max(12,Math.min(abaixo>=220?r.bottom+7:r.top-painel.offsetHeight-7,altura-painel.offsetHeight-12))+'px';
 }
 function visiveis(){return atual?[...atual.lista.querySelectorAll('[role="option"]')].filter(b=>!b.hidden):[];}
 function selecionar(botao){
  if(!atual)return;
  const {id,campo,opcoes,gatilho}=atual,valor=botao.dataset.campoOpcao;
  if(!opcoes.some(o=>o.valor===valor)||!obterCaso(id))return fechar();
  const anterior=String(obterCaso(id)[campo]??'');fechar();
  if(anterior!==valor)alterar(id,campo,valor);
  requestAnimationFrame(()=>document.getElementById(gatilho.id)?.focus());
 }
 function abrir(gatilho){
  if(atual?.gatilho===gatilho)return fechar(true);
  fechar();
  const campo=gatilho.dataset.campoAbrir,id=gatilho.dataset.caso,c=obterCaso(id);
  if(!c||!rotulos[campo])return;
  const opcoes=opcoesCampo(campo,obterEtapas()),valor=String(c[campo]??'');
  const painel=document.createElement('div');painel.className='signature-campo-menu';
  const grupos=['','Preparação e minuta','Pós-assinatura','Pendências e apoio'].filter(g=>opcoes.some(o=>o.grupo===g));
  painel.innerHTML=`<div class="signature-campo-menu-topo"><span>${rotulos[campo]}</span><button type="button" aria-label="Fechar opções">×</button></div>${campo==='dep'?'<input type="search" class="signature-campo-busca" aria-label="Buscar etapa" placeholder="Buscar etapa…" autocomplete="off">':''}<div class="signature-campo-lista" role="listbox" id="${escapar(gatilho.id)}-lista" aria-label="${rotulos[campo]}">${grupos.map(grupo=>`<div class="signature-campo-grupo" role="group" aria-label="${escapar(grupo||'Opções')}">${grupo?`<span class="signature-campo-grupo-titulo">${escapar(grupo)}</span>`:''}${opcoes.filter(o=>o.grupo===grupo).map(o=>`<button type="button" role="option" tabindex="-1" aria-selected="${o.valor===valor}" data-campo-opcao="${escapar(o.valor)}" data-busca="${escapar(normal(o.rotulo))}">${campo==='status'?`<span class="signature-status-ponto" data-status="${escapar(o.valor)}" aria-hidden="true"></span>`:''}<span>${escapar(o.rotulo)}</span>${o.valor===valor?'<span class="signature-campo-check" aria-hidden="true">✓</span>':''}</button>`).join('')}</div>`).join('')}<p class="signature-campo-vazio" hidden>Nenhuma etapa encontrada.</p></div>`;
  const lista=painel.querySelector('[role="listbox"]');
  const observador=new MutationObserver(()=>{if(!gatilho.isConnected)fechar();});
  atual={gatilho,painel,lista,id,campo,opcoes,observador};
  document.body.append(painel);gatilho.setAttribute('aria-expanded','true');
  observador.observe(document.getElementById('casos-list')||document.body,{childList:true,subtree:true});
  painel.querySelector('[aria-label="Fechar opções"]').onclick=()=>fechar(true);
  painel.addEventListener('click',ev=>{const b=ev.target.closest('[role="option"]');if(b)selecionar(b);});
  const busca=painel.querySelector('input');
  if(busca)busca.addEventListener('input',()=>{
   const texto=normal(busca.value);
   lista.querySelectorAll('[role="option"]').forEach(b=>{b.hidden=!b.dataset.busca.includes(texto);});
   lista.querySelectorAll('[role="group"]').forEach(g=>{g.hidden=![...g.querySelectorAll('[role="option"]')].some(b=>!b.hidden);});
   painel.querySelector('.signature-campo-vazio').hidden=visiveis().length>0;
  });
  painel.addEventListener('keydown',ev=>{
   if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();return fechar(true);}
   if(ev.key==='Tab')return fechar(true);
   if(ev.key==='Enter'&&ev.target===busca){ev.preventDefault();const op=visiveis();if(op.length===1)selecionar(op[0]);else op[0]?.focus();return;}
   if(!['ArrowDown','ArrowUp','Home','End'].includes(ev.key))return;
   if(ev.target===busca&&['Home','End'].includes(ev.key))return;
   ev.preventDefault();const op=visiveis();if(!op.length)return;
   const i=op.indexOf(document.activeElement),n=ev.key==='Home'?0:ev.key==='End'?op.length-1:ev.key==='ArrowDown'?(i+1)%op.length:i<0?op.length-1:(i-1+op.length)%op.length;
   op[n].focus();op[n].scrollIntoView({block:'nearest'});
  });
  posicionar();
  if(busca)busca.focus({preventScroll:true});else(lista.querySelector('[aria-selected="true"]')||visiveis()[0])?.focus({preventScroll:true});
 }
 document.addEventListener('click',ev=>{const b=ev.target.closest('[data-campo-abrir]');if(b)abrir(b);});
 document.addEventListener('pointerdown',ev=>{if(atual&&!atual.painel.contains(ev.target)&&!atual.gatilho.contains(ev.target))fechar();});
 document.addEventListener('keydown',ev=>{
  if(ev.key==='Escape'&&atual){ev.preventDefault();fechar(true);return;}
  const b=ev.target.closest('[data-campo-abrir]');
  if(b&&['Enter',' ','ArrowDown','ArrowUp'].includes(ev.key)){ev.preventDefault();abrir(b);}
 });
 window.addEventListener('resize',posicionar,{passive:true});
 window.visualViewport?.addEventListener('resize',posicionar,{passive:true});
 window.addEventListener('scroll',ev=>{if(atual&&!atual.painel.contains(ev.target))posicionar();},{passive:true,capture:true});
 return {fechar};
}
