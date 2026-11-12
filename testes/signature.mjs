// Fluxos completos no index.html real, com Firebase e IA inteiramente simulados.
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {abrirChromium} from './navegador-de-teste.mjs';
import {servir} from './servidor.mjs';
const AQUI=dirname(fileURLToPath(import.meta.url));mkdirSync(join(AQUI,'saida'),{recursive:true});
const servidor=await servir(),browser=await abrirChromium();
const fontesPrevia=process.env.FONTES_PREVIA_DIR?{css:readFileSync(join(process.env.FONTES_PREVIA_DIR,'tabler.css')),woff2:readFileSync(join(process.env.FONTES_PREVIA_DIR,'tabler.woff2'))}:null;
const DB={casos:{C1:{id:'C1',nome:'JRL — caso fictício',tipo:'Compra e venda',status:'emdia',resp:'shirley',prazo:'—',dep:'',depDesde:'2026-11-11',obs:'Observação que precisa ser preservada.',atualizado:'2026-11-11',modalidade:'presencial',concluido:false,documentos:{D1:{nome:'Matrícula fictícia',tipo:'documento',texto:'Conteúdo fictício integral da matrícula.'}}}},acesso:{U1:{nome:'Shirley',dono:true}},orcamentos:{},'orcamento-config':{},'orcamento-conhecimento':{},'orcamento-aliquotas':{},jobs:{},focos:[]};
const firebase=`
const copy=v=>v==null?null:structuredClone(v);const listeners=[];let seq=0;
window.__data=${JSON.stringify(DB)};
function read(path){return path.split('/').filter(Boolean).reduce((o,k)=>o?.[k],window.__data)??null;}
function write(path,value){const p=path.split('/').filter(Boolean);if(!p.length){window.__data=copy(value);return;}let o=window.__data;for(const k of p.slice(0,-1))o=o[k]??={};if(value===null)delete o[p.at(-1)];else o[p.at(-1)]=copy(value);}
function snap(path){return {val:()=>copy(read(path)),exists:()=>read(path)!==null};}
function notify(){for(const l of [...listeners])setTimeout(()=>{if(listeners.includes(l))l.f(snap(l.path));},0);}
window.__fbWrite=(p,v)=>{write(p,v);notify();};
export const getDatabase=()=>({});export const ref=(db,path='')=>({path,key:path.split('/').at(-1)});
export const get=async r=>snap(r.path);
window.__negarFinanceiro=()=>listeners.filter(l=>l.path==='financeiro/lancamentos').forEach(l=>l.erro?.({message:'Permissão negada simulada'}));export const onValue=(r,f,erro)=>{const l={path:r.path,f,erro};listeners.push(l);setTimeout(()=>{if(listeners.includes(l))f(snap(l.path));},0);return()=>{const i=listeners.indexOf(l);if(i>=0)listeners.splice(i,1);};};
export const set=async(r,v)=>{write(r.path,v);notify();};
export const update=async(r,patch)=>{for(const [k,v]of Object.entries(patch))write([r.path,k].filter(Boolean).join('/'),v);notify();};
export const push=(r,v)=>{const n=ref(null,[r.path,'-Teste'+(++seq)].join('/'));if(v!==undefined){write(n.path,v);notify();return Promise.resolve(n);}return n;};
export const remove=async r=>{write(r.path,null);notify();};
export const runTransaction=async(r,f)=>{const value=f(copy(read(r.path)));if(value!==undefined){write(r.path,value);notify();}return {committed:value!==undefined,snapshot:snap(r.path)};};
`;
const auth=`const user={uid:'U1',email:'teste@example.invalid',getIdToken:async()=> 'token-ficticio'};export const getAuth=()=>({currentUser:user});const subs=[];window.__trocarConta=u=>subs.forEach(f=>f(u));export const onAuthStateChanged=(a,f)=>{subs.push(f);setTimeout(()=>f(user),0);return()=>{};};export const signInWithEmailAndPassword=async()=>({user});export const sendPasswordResetEmail=async()=>{};export const signOut=async()=>{};`;
let contadorFrases=0,contadorMinutas=0,contadorCalendar=0,contadorJuridico=0,contadorPlanos=0;const erros=[];
const assinaturaTeste=new Date(Date.now()+86400000).toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'})+'T14:00';
async function configurar(context){
 await context.addInitScript(()=>localStorage.setItem('painel_usuario','Shirley'));
 await context.route('**/*',async rota=>{
  const url=new URL(rota.request().url());
  if(fontesPrevia&&url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('/@tabler/icons-webfont'))return rota.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:url.pathname.endsWith('.woff2')?'font/woff2':'text/css',body:url.pathname.endsWith('.woff2')?fontesPrevia.woff2:fontesPrevia.css});
  if(url.hostname==='painel-cartorio-default-rtdb.firebaseio.com'){
   const caminho=url.pathname.replace(/^\//,'').replace(/\.json$/,'');
   const valor=await rota.request().frame().evaluate(p=>p.split('/').filter(Boolean).reduce((v,k)=>v?.[k],window.__data)??null,caminho);
   return rota.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(valor)});
  }
  if(url.hostname==='script.google.com'){
   contadorCalendar++;const p=JSON.parse(rota.request().postData());
   assert.equal(p.acao,'sincronizar-evento-calendar');assert.equal(p.dataHora,assinaturaTeste);
   return rota.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({ok:true,eventId:'evento-ficticio'})});
  }
  if(url.hostname==='www.gstatic.com'){
   let body='';
   if(url.pathname.endsWith('firebase-app.js'))body='export const initializeApp=()=>({});';
   if(url.pathname.endsWith('firebase-database.js'))body=firebase;
   if(url.pathname.endsWith('firebase-auth.js'))body=auth;
   if(url.pathname.endsWith('firebase-storage.js'))body='export const getStorage=()=>({});export const ref=()=>({});export const uploadBytes=async()=>({});export const getDownloadURL=async()=>"https://exemplo.invalid/arquivo";';
   return rota.fulfill({status:200,contentType:'application/javascript',body});
  }
  if(url.origin===servidor.url){
   if(url.pathname==='/api/perguntar-joaninha'&&url.searchParams.get('acao')==='frase-dia'){
    contadorFrases++;
    return rota.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'}),frase:'Seu cuidado transforma pequenos passos em grandes conquistas.',origem:'ia'})});
   }
   if(url.pathname==='/api/joaninha-juridico'){
    contadorJuridico++;
    if(/sem fonte/.test(rota.request().postDataJSON().pergunta))return rota.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,resposta:'Orientação fictícia baseada apenas no material interno.',fontes:[],consultadoEm:'2026-11-12',aviso:'Não consegui confirmar uma fonte oficial nesta consulta.'})});
    return rota.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,resposta:'Orientação jurídica fictícia: confirme a aplicação ao caso antes de prosseguir.',fontes:['https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm','https://blog.example/'],consultadoEm:'2026-11-12',atencao:['A numeração do item exige confirmação.'],temasConsultados:['Tema fictício']})});
   }
   if(url.pathname==='/api/perguntar-joaninha'){
    contadorPlanos++;
    const p=rota.request().postDataJSON();
    const a=(tipo,dados)=>({tipo,casoId:'C1',descricao:({anotar_caso:'Acrescentar a observação solicitada',preparar_orcamento:'Calcular e salvar uma nova versão do orçamento',gerar_minuta:'Gerar a minuta usando os documentos do caso',consultar_caso:'Consultar os dados atuais do caso'})[tipo],dados});
    let r={resposta:'O resultado foi confirmado pelo sistema.',acoes:[]};
    if(p.pergunta.startsWith('Use os resultados'))r={resposta:'O caso tem uma matrícula fictícia lida. <img src=x onerror="window.__injetou=true">',acoes:[]};
    else if(p.pergunta.startsWith('Explique os resultados'))r={resposta:'Registrei o resultado confirmado. Quando a minuta terminar, aviso nesta conversa.',acoes:[]};
    else if(/jurídica/i.test(p.pergunta))r={resposta:'Vou consultar a base e as fontes oficiais.',acoes:[{tipo:'consultar_juridico',casoId:null,dados:{pergunta:p.pergunta}}]};
    else if(/agende/i.test(p.pergunta))r={resposta:'Vou agendar a assinatura no card de teste amanhã às 14h. Confira a data completa antes de confirmar.',acoes:[{tipo:'agendar_assinatura',casoId:'C1',descricao:'Agendar assinatura da escritura',dados:{dataHora:assinaturaTeste,descricao:'Assinatura fictícia'}}]};
    else if(/anote/i.test(p.pergunta))r={resposta:'Vou acrescentar a anotação no card, preservando o texto anterior.',acoes:[a('anotar_caso',{texto:'Conferir o documento recebido.'})]};
    else if(/orçamento/i.test(p.pergunta))r={resposta:'Vou usar o motor do cartório para calcular a venda e compra por R$ 500.000,00.',acoes:[a('preparar_orcamento',{atoId:'compra-venda',valores:{transacao:50000000},imovelMunicipio:'São Paulo',imovelUf:'SP',despesas:{taxaAdicional:false}})]};
    else if(/minuta/i.test(p.pergunta))r={resposta:'Vou gerar a minuta com os documentos e as instruções do caso.',acoes:[a('gerar_minuta',{instrucao:'Preservar todas as cláusulas, sem resumir.',modalidade:'presencial'})]};
    else r={resposta:'Vou conferir o card.',acoes:[a('consultar_caso',{})]};
    return rota.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,...r})});
   }
   if(url.pathname==='/api/iniciar-minuta'){
    contadorMinutas++;const p=rota.request().postDataJSON(),jobId='joaninha-'+p.solicitacaoId;
    await rota.request().frame().evaluate(({jobId,p})=>{window.__pedidoMinuta=p;window.__fbWrite('jobs/'+jobId,{status:'done',ok:true,docUrl:'https://docs.google.com/document/d/minuta-ficticia',docNome:'Minuta fictícia completa',avisos:[],truncada:false});},{jobId,p});
    return rota.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,jobId})});
   }
   return rota.continue();
  }
  return rota.abort();
 });
}

try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});await configurar(ctx);
 const pg=await ctx.newPage();pg.on('pageerror',e=>erros.push(e.message));
 await pg.goto(servidor.url+'/index.html');await pg.waitForFunction(()=>!!window.signatureAbrirProcesso&&!!document.querySelector('.signature-resumo'));
 assert.equal(await pg.locator('html').evaluate(e=>e.classList.contains('prime-signature')),true);
 for(const nome of ['Central','Casos','Agenda','Orçamentos','Radar Jurídico','Modelos aprendidos','Total ativos']){
  assert.equal(await pg.locator('.sidebar').getByRole('button',{name:nome,exact:true}).count(),0,'atalho removido: '+nome);
 }
 const ordem=await pg.locator('.sidebar').evaluate(e=>[...e.querySelectorAll('button')].map(b=>b.getAttribute('onclick')));
 assert.ok(ordem.indexOf('abrirRede()')>ordem.indexOf('abrirArquivo()'),'Rede fica depois das etapas e do Arquivo');

 await pg.evaluate(()=>document.fonts.ready);
 assert.equal(await pg.locator('.signature-sidebar-flor img').count(),1);
 assert.doesNotMatch(await pg.locator('.sidebar').innerText(),/Disciplina hoje|resultados amanhã/);
 // Quantidades com larguras distintas verificam as colunas, sem gravar casos.
 await pg.locator('#sidebar-etapas .sidebar-count').evaluateAll(itens=>itens.forEach((e,i)=>e.textContent=[23,3,104,3,22,8,0,73][i]));
 const colunas=await pg.locator('#sidebar-etapas .sidebar-item').evaluateAll(itens=>itens.map(e=>{
  const n=e.querySelector('.sidebar-count').getBoundingClientRect(),rotulo=e.querySelector('span:not(.sidebar-count)').getBoundingClientRect(),icone=e.querySelector('i').getBoundingClientRect();
  return {numero:n.right,texto:rotulo.left,icone:icone.left,semColisao:rotulo.right<=n.left,semCorte:e.scrollWidth<=e.clientWidth};
 }));
 for(const campo of ['numero','texto','icone'])assert.ok(Math.max(...colunas.map(c=>c[campo]))-Math.min(...colunas.map(c=>c[campo]))<1,'coluna alinhada: '+campo);
 assert.ok(colunas.every(c=>c.semColisao&&c.semCorte),'rótulos inteiros e sem colisão com contadores');
 await pg.locator('.sidebar').screenshot({path:join(AQUI,'saida','lateral-alinhada-flor.png')});
 await pg.locator('.sidebar').screenshot({path:join(AQUI,'saida','lateral-simplificada.png')});

 async function conferirCabecalho(){
  await pg.evaluate(()=>window.scrollTo(0,0));
  await pg.waitForTimeout(2300);
  const geometria=await pg.evaluate(()=>{
    const r=seletor=>{const e=document.querySelector(seletor),b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width};};
    return {mascote:r('#joaninha-host'),calendario:r('.cdc2-calendario'),busca:r('.cdc2-topo-busca'),campo:r('.cdc2-topo-busca input')};
  });
  const cruza=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
  assert.equal(cruza(geometria.mascote,geometria.calendario),false,'Joaninha não cobre o calendário');
  assert.equal(cruza(geometria.mascote,geometria.busca),false,'Joaninha não cobre a busca');
  assert.ok(geometria.campo.width>200,'campo de busca aproveita o espaço');
  assert.equal(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'cabeçalho cabe na tela');
 }
 await conferirCabecalho();
 await pg.locator('#saudacao-card').screenshot({path:join(AQUI,'saida','cabecalho-ajustado-computador.png')});
 await pg.setViewportSize({width:1100,height:900});await conferirCabecalho();
 await pg.setViewportSize({width:390,height:844});await conferirCabecalho();
 await pg.locator('#saudacao-card').screenshot({path:join(AQUI,'saida','cabecalho-ajustado-celular.png')});
 const alvoJoaninha=await pg.locator('#joaninha-host button').boundingBox();
 await pg.mouse.click(alvoJoaninha.x+alvoJoaninha.width/2,alvoJoaninha.y+alvoJoaninha.height/2);
 assert.equal(await pg.locator('#jnc-overlay').isVisible(),true,'clique da mascote continua abrindo a conversa');
 await pg.evaluate(()=>window.joaninhaChat.fechar());
 await pg.setViewportSize({width:1440,height:1000});await conferirCabecalho();
 assert.equal(await pg.locator('#cdc-tab-ag-hoje').isVisible(),true);
 assert.equal(await pg.locator('#cdc-tab-ag-amanha').isVisible(),true);
 assert.equal(await pg.locator('#cdc-tab-ag-semana').isVisible(),true);

 // Lembretes com horário pertencem somente ao Bloco de Notas.
 const diaNota=delta=>new Date(Date.now()+delta*86400000).toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
 const horaNota=diaNota(1)+'T10:00';
 const casosAntesNotas=await pg.evaluate(()=>JSON.stringify(window.__data.casos));
 const agendaAntesNotas=await pg.locator('#cdc-agenda').innerText();
 await pg.evaluate(({vencida,futura})=>window.__fbWrite('focos',[
  {id:'N1',text:'Conferir documentos recebidos',resp:'grazi',done:false,quando:futura},
  {id:'N2',text:'Retornar a ligação do cliente',resp:'grazi',done:false,quando:vencida},
  {id:'N3',text:'Revisar a lista de documentos',resp:'grazi',done:false,quando:null}
 ]),{vencida:diaNota(-1)+'T10:00',futura:horaNota});
 await pg.locator('#cdc-aba-grazi').click();
 await pg.waitForSelector('.cdc2-nota-atrasada');
 assert.match(await pg.locator('#cdc-notas-lista .cdc2-check-row').first().innerText(),/Retornar a ligação/);
 await pg.locator('#foco-add-btn').click();
 assert.equal(await pg.locator('#foco-resp').inputValue(),'grazi');
 await pg.locator('#foco-input').fill('Enviar a relação de pendências');
 await pg.locator('#foco-quando').fill(diaNota(1)+'T14:00');
 await pg.locator('#foco-input-row').getByRole('button',{name:'Adicionar',exact:true}).click();
 await pg.waitForFunction(()=>window.__data.focos.some(n=>n.text==='Enviar a relação de pendências'));
 const novaNota=await pg.evaluate(()=>window.__data.focos.find(n=>n.text==='Enviar a relação de pendências'));
 assert.equal(novaNota.resp,'grazi');assert.equal(novaNota.quando,diaNota(1)+'T14:00');
 const bloco=pg.locator('#cdc-notas-lista').locator('..');
 await bloco.screenshot({path:join(AQUI,'saida','notas-horario-computador.png')});
 await pg.setViewportSize({width:390,height:844});
 await bloco.screenshot({path:join(AQUI,'saida','notas-horario-celular.png')});
 await pg.locator('#foco-add-btn').click();
 assert.equal(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'formulário da nota cabe no celular');
 await pg.locator('#foco-add-btn').click();
 await pg.getByRole('button',{name:'Definir data e hora da nota: Revisar a lista de documentos',exact:true}).click();
 assert.equal(await pg.locator('#agenda-edit-titulo').innerText(),'Data e hora da nota');
 assert.match(await pg.locator('#agenda-edit-campos').innerText(),/somente no Bloco de Notas/);
 await pg.locator('#agenda-edit-quando').fill(diaNota(1)+'T11:00');
 assert.equal(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'edição do horário cabe no celular');
 await pg.locator('#agenda-edit-salvar').click();
 await pg.waitForFunction(d=>window.__data.focos.find(n=>n.id==='N3').quando===d,diaNota(1)+'T11:00');
 assert.match(await pg.locator('#cdc-notas-lista .cdc2-check-row').nth(1).innerText(),/Conferir documentos/);
 await pg.getByRole('button',{name:'Alterar data e hora da nota: Conferir documentos recebidos',exact:true}).click();
 await pg.getByRole('button',{name:'Remover data e hora',exact:true}).click();
 await pg.locator('#agenda-edit-salvar').click();
 await pg.waitForFunction(()=>window.__data.focos.find(n=>n.id==='N1').quando===null);
 await pg.locator('#cdc-notas-lista .cdc2-check-row').filter({hasText:'Retornar a ligação'}).locator('.cdc2-checkbox').click();
 await pg.waitForFunction(()=>window.__data.focos.find(n=>n.id==='N2').done);
 await pg.waitForFunction(()=>!document.querySelector('.cdc2-nota-atrasada'));
 assert.equal(await pg.locator('.cdc2-nota-atrasada').count(),0);
 await pg.evaluate(data=>window.__fbWrite('focos',[...window.__data.focos,{id:'N4',text:'Nota antiga com somente data',resp:'grazi',done:false,quando:data}]),diaNota(2));
 await pg.locator('#cdc-notas-lista .cdc2-check-row').filter({hasText:'Nota antiga com somente data'}).locator('.cdc2-check-menu').click();
 await pg.locator('#agenda-edit-texto').fill('Nota antiga revisada');
 await pg.locator('#agenda-edit-salvar').click();
 await pg.waitForFunction(()=>window.__data.focos.find(n=>n.id==='N4')?.text==='Nota antiga revisada');
 assert.equal(await pg.evaluate(()=>window.__data.focos.find(n=>n.id==='N4').quando),diaNota(2),'editar o texto preserva datas antigas sem horário');
 assert.equal(await pg.locator('#cdc-agenda').innerText(),agendaAntesNotas,'nota com data não entra na Agenda de assinaturas');
 assert.equal(await pg.evaluate(()=>JSON.stringify(window.__data.casos)),casosAntesNotas,'notas não alteram assinaturas ou dados dos casos');
 assert.equal(contadorCalendar,0,'horário da tarefa não chama o Google Calendar');
 await pg.setViewportSize({width:1440,height:1000});
 console.log('ok: notas com criação, alteração e remoção de horário, atraso e conclusão; Agenda e Calendar preservados.');
 assert.equal(await pg.locator('#signature-financeiro').innerText().then(s=>s.includes('R$')),false);
 await pg.evaluate(()=>window.__fbWrite('financeiro/lancamentos/F1',{descricao:'Fictício',dataPagamento:new Date().toLocaleDateString('sv-SE'),status:'pago',parteTabeliao:12345.67}));
 await pg.getByRole('button',{name:'Mostrar financeiro',exact:true}).click();
 await pg.waitForFunction(()=>document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')==='15.4');
 assert.match(await pg.locator('#signature-financeiro').innerText(),/84,6% para atingir a meta/);
 assert.doesNotMatch(await pg.locator('#signature-financeiro').innerHTML(),/80\.000|80000|12\.345|R\$/,'a faixa não exibe valores em reais');
 await pg.screenshot({path:join(AQUI,'saida','signature-progresso.png'),fullPage:false});
 await pg.setViewportSize({width:390,height:844});
 assert.equal(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'barra de progresso cabe no celular');
 await pg.locator('#signature-financeiro').scrollIntoViewIfNeeded();
 await pg.screenshot({path:join(AQUI,'saida','signature-progresso-celular.png'),fullPage:false});
 await pg.setViewportSize({width:1440,height:1000});
 await pg.evaluate(()=>window.__fbWrite('financeiro/lancamentos/F1',{dataPagamento:new Date().toLocaleDateString('sv-SE'),status:'pago',parteTabeliao:80000}));
 await pg.waitForFunction(()=>document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')==='100');
 assert.match(await pg.locator('#signature-financeiro').innerText(),/Meta atingida/);
 await pg.evaluate(()=>window.__fbWrite('financeiro/lancamentos/F1',{dataPagamento:new Date().toLocaleDateString('sv-SE'),status:'pago',parteTabeliao:100000}));
 await pg.waitForTimeout(250);
 assert.equal(await pg.locator('[role="progressbar"]').getAttribute('aria-valuenow'),'100');
 await pg.getByRole('button',{name:'Ocultar financeiro',exact:true}).click();
 assert.equal(await pg.locator('[role="progressbar"]').count(),0,'ocultar remove barra e percentual do DOM');
 assert.doesNotMatch(await pg.locator('#signature-financeiro').innerText(),/%|Meta atingida/);
 await pg.getByRole('button',{name:'Mostrar financeiro',exact:true}).click();
 await pg.evaluate(()=>window.__negarFinanceiro());
 assert.equal(await pg.locator('[role="progressbar"]').count(),0,'erro de permissão também oculta o progresso');
 await pg.evaluate(()=>window.__trocarConta(null));
 assert.equal(await pg.locator('[role="progressbar"]').count(),0);
 assert.equal(await pg.getByRole('button',{name:'Entrar para consultar',exact:true}).isVisible(),true);
 console.log('ok: conteúdo financeiro oculto por padrão, olhinho remove valores do DOM, logout oculta imediatamente.');
 await pg.screenshot({path:join(AQUI,'saida','signature-central-computador.png'),fullPage:true});
 await pg.locator('.signature-resumo-abrir').click();
 assert.equal(await pg.locator('.central-nova').isVisible(),false);
 assert.equal(await pg.locator('.signature-processo').count(),1);
 assert.equal(await pg.locator('.signature-processo .est').count(),1);
 assert.equal(await pg.getByRole('button',{name:/Voltar aos casos/}).count(),1);
 assert.equal(await pg.locator('.signature-processo .cx-reg-campos input').count(),5);
 assert.equal(await pg.locator('.signature-processo .est-aba').filter({hasText:'Livro, folha'}).count(),0);
 await pg.locator('.signature-funcoes').getByRole('button',{name:'Drive',exact:true}).click();
 assert.equal(await pg.locator('.signature-trabalho .cx-drive').count(),1);
 await pg.locator('.signature-funcoes').getByRole('button',{name:'Documentos',exact:true}).click();
 assert.equal(await pg.locator('.signature-trabalho .cx-ped').count(),1);
 const antes=await pg.evaluate(()=>JSON.stringify(window.__data.casos));
 await pg.locator('.signature-funcoes').getByRole('button',{name:'Minuta',exact:true}).click();
 assert.equal(await pg.getByRole('button',{name:/Voltar aos casos/}).count(),1);
 assert.equal(await pg.locator('.signature-trabalho [onclick*=abrirMinuta]').count(),1);
 assert.equal(await pg.evaluate(()=>JSON.stringify(window.__data.casos)),antes,'trocar abas não grava ou gera minuta');
 await pg.screenshot({path:join(AQUI,'saida','signature-processo-computador.png'),fullPage:true});
 await pg.locator('.signature-dados select[onchange*=resp]').selectOption('grazi');
 await pg.waitForFunction(()=>window.__data.casos.C1.resp==='grazi');
 await pg.evaluate(()=>window.irParaCasoPorId('C1'));
 assert.equal(await pg.locator('.signature-processo').count(),1);
 await pg.getByRole('button',{name:/Voltar aos casos/}).click();
 assert.equal(await pg.locator('.central-nova').isVisible(),true);
 console.log('ok: página exclusiva, ferramentas contextuais, cinco dados de registro, jornada única e edição preservada.');
 await pg.setViewportSize({width:390,height:844});
 await pg.screenshot({path:join(AQUI,'saida','signature-central-celular.png'),fullPage:true});
 assert.equal(await pg.locator('#signature-menu').isVisible(),true);
 await pg.locator('#signature-menu summary').click();
 assert.equal(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'menu aberto cabe no celular');
 await pg.locator('#signature-menu summary').click();
 assert.equal(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Central cabe no celular');
 await pg.locator('.signature-resumo-abrir').click();
 await pg.screenshot({path:join(AQUI,'saida','signature-processo-celular.png'),fullPage:true});
 assert.equal(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'processo cabe no celular');
 await pg.locator('.signature-funcoes').getByRole('button',{name:'Orçamento',exact:true}).click();
 await pg.evaluate(()=>window.abrirJoaninhaNoCaso('C1'));
 assert.equal(await pg.locator('#jnc-overlay').isVisible(),true);
 assert.equal(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 console.log('ok: Central, processo e Joaninha no celular sem rolagem lateral.');
 assert.equal(contadorMinutas+contadorCalendar+contadorJuridico+contadorPlanos,0,'navegar no layout não chama IA nem altera a agenda');
 await pg.reload();
 await pg.waitForFunction(()=>document.getElementById('saudacao-frase')?.textContent==='Seu cuidado transforma pequenos passos em grandes conquistas.');
 assert.equal(contadorFrases,1,'recarregar o painel reaproveita a frase do dia sem nova chamada');
 assert.deepEqual(erros,[]);
}finally{await browser.close();servidor.close();}
