// Fluxos completos no index.html real, com Firebase e IA inteiramente simulados.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {abrirChromium} from './navegador-de-teste.mjs';
import {servir} from './servidor.mjs';
const AQUI=dirname(fileURLToPath(import.meta.url));mkdirSync(join(AQUI,'saida'),{recursive:true});
const servidor=await servir(),browser=await abrirChromium();
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
export const onValue=(r,f)=>{const l={path:r.path,f};listeners.push(l);setTimeout(()=>{if(listeners.includes(l))f(snap(l.path));},0);return()=>{const i=listeners.indexOf(l);if(i>=0)listeners.splice(i,1);};};
export const set=async(r,v)=>{write(r.path,v);notify();};
export const update=async(r,patch)=>{for(const [k,v]of Object.entries(patch))write([r.path,k].filter(Boolean).join('/'),v);notify();};
export const push=(r,v)=>{const n=ref(null,[r.path,'-Teste'+(++seq)].join('/'));if(v!==undefined){write(n.path,v);notify();return Promise.resolve(n);}return n;};
export const remove=async r=>{write(r.path,null);notify();};
export const runTransaction=async(r,f)=>{const value=f(copy(read(r.path)));if(value!==undefined){write(r.path,value);notify();}return {committed:value!==undefined,snapshot:snap(r.path)};};
`;
const auth=`const user={uid:'U1',email:'teste@example.invalid',getIdToken:async()=> 'token-ficticio'};export const getAuth=()=>({currentUser:user});export const onAuthStateChanged=(a,f)=>{setTimeout(()=>f(user),0);return()=>{};};export const signInWithEmailAndPassword=async()=>({user});export const sendPasswordResetEmail=async()=>{};export const signOut=async()=>{};`;
let contadorMinutas=0;const erros=[];
async function configurar(context){
 await context.addInitScript(()=>localStorage.setItem('painel_usuario','Shirley'));
 await context.route('**/*',async rota=>{
  const url=new URL(rota.request().url());
  if(url.hostname==='www.gstatic.com'){
   let body='';
   if(url.pathname.endsWith('firebase-app.js'))body='export const initializeApp=()=>({});';
   if(url.pathname.endsWith('firebase-database.js'))body=firebase;
   if(url.pathname.endsWith('firebase-auth.js'))body=auth;
   if(url.pathname.endsWith('firebase-storage.js'))body='export const getStorage=()=>({});export const ref=()=>({});export const uploadBytes=async()=>({});export const getDownloadURL=async()=>"https://exemplo.invalid/arquivo";';
   return rota.fulfill({status:200,contentType:'application/javascript',body});
  }
  if(url.origin===servidor.url){
   if(url.pathname==='/api/perguntar-joaninha'){
    const p=rota.request().postDataJSON();
    const a=(tipo,dados)=>({tipo,casoId:'C1',descricao:({anotar_caso:'Acrescentar a observação solicitada',preparar_orcamento:'Calcular e salvar uma nova versão do orçamento',gerar_minuta:'Gerar a minuta usando os documentos do caso',consultar_caso:'Consultar os dados atuais do caso'})[tipo],dados});
    let r={resposta:'O resultado foi confirmado pelo sistema.',acoes:[]};
    if(p.pergunta.startsWith('Use os resultados'))r={resposta:'O caso tem uma matrícula fictícia lida. <img src=x onerror="window.__injetou=true">',acoes:[]};
    else if(p.pergunta.startsWith('Explique os resultados'))r={resposta:'Registrei o resultado confirmado. Quando a minuta terminar, aviso nesta conversa.',acoes:[]};
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
async function abrir(context,viewport){
 const pg=await context.newPage();if(viewport)await pg.setViewportSize(viewport);pg.on('pageerror',e=>erros.push(e.message));
 await pg.goto(servidor.url+'/index.html');await pg.waitForFunction(()=>!!window.joaninhaChat&&window.__data.casos.C1,{},{timeout:15000});
 await pg.evaluate(()=>window.abrirJoaninhaNoCaso('C1'));
 assert.equal(await pg.locator('#jnc-overlay').evaluate(e=>getComputedStyle(e).position),'fixed','o estilo da conversa precisa carregar de verdade');
 return pg;
}
async function mensagem(pg,texto){
 const input=pg.getByRole('textbox',{name:'Mensagem para a Joaninha'});await input.fill(texto);await pg.getByRole('button',{name:'Enviar mensagem',exact:true}).click();
 await pg.waitForFunction(()=>!document.querySelector('.jnc-send').disabled);
}
try{
 const contexto=await browser.newContext({viewport:{width:1440,height:960},serviceWorkers:'block'});await configurar(contexto);
 const pg=await abrir(contexto);
 await mensagem(pg,'Anote que precisamos conferir a matrícula.');
 await pg.screenshot({path:join(AQUI,'saida','joaninha-plano-computador.png'),fullPage:false});
 assert.equal(await pg.evaluate(()=>window.__data.casos.C1.obs),'Observação que precisa ser preservada.','não escreve antes da confirmação');
 await pg.getByRole('button',{name:'Confirmar e executar',exact:true}).click();
 await pg.waitForFunction(()=>window.__data.casos.C1.obs.includes('Conferir o documento recebido.'));
 await pg.waitForFunction(()=>!document.querySelector('.jnc-send').disabled);
 const antes=await pg.evaluate(()=>Object.keys(window.__data.casos.C1.historico).length);assert.equal(antes,1);
 console.log('ok: anotação confirmada, observação anterior preservada, sem duplicação.');
 await mensagem(pg,'Quais documentos estão disponíveis?');
 await pg.waitForFunction(()=>!document.querySelector('.jnc-send').disabled);
 assert.equal(await pg.evaluate(()=>window.__injetou),undefined);
 assert.equal(await pg.locator('.jnc-thread img[src="x"]').count(),0);
 console.log('ok: consulta automática e texto da IA sem interpretação de HTML.');
 await mensagem(pg,'Prepare o orçamento de venda e compra de R$ 500.000,00.');
 await mensagem(pg,'pode fazer');
 await pg.waitForFunction(()=>Object.keys(window.__data.orcamentos).length===1,{},{timeout:15000});
 await pg.waitForFunction(()=>!document.querySelector('.jnc-send').disabled);
 const o=await pg.evaluate(()=>Object.values(window.__data.orcamentos)[0]);assert.equal(o.entrada.valores.transacao,50000000);assert.ok(o.resultado.totais.total>0);
 assert.equal(await pg.getByRole('link',{name:'Baixar imagem',exact:true}).count(),1);
 console.log('ok: orçamento com motor real, versão salva e imagem disponível.');
 await mensagem(pg,'Gere a minuta preservando todas as cláusulas.');
 await pg.getByRole('button',{name:'Confirmar e executar',exact:true}).click();
 await pg.getByRole('link',{name:'Abrir Minuta fictícia completa'}).waitFor({timeout:15000});
 assert.equal(contadorMinutas,1);
 const tarefas=await pg.evaluate(()=>Object.values(window.__data.casos.C1.tarefasJoaninha));assert.ok(tarefas.some(t=>t.origem==='minuta'&&t.feito));assert.ok(tarefas.some(t=>t.origem==='minuta'&&!t.feito));
 const pedido=await pg.evaluate(()=>window.__pedidoMinuta);assert.ok(pedido.documentos.includes('Conteúdo fictício integral da matrícula.'));assert.equal(pedido.casoId,'C1');
 console.log('ok: geração usa documentos do card, acompanha o job e atualiza tarefas.');
 await pg.waitForFunction(()=>!document.querySelector('.jnc-send').disabled);
 await pg.screenshot({path:join(AQUI,'saida','joaninha-computador.png'),fullPage:false});
 const historia=await pg.locator('.jnc-history-item').count();assert.ok(historia>=1);
 await pg.reload();await pg.waitForFunction(()=>!!window.joaninhaChat);await pg.evaluate(()=>window.abrirJoaninhaNoCaso('C1'));assert.ok(await pg.locator('.jnc-history-item').count()>=1);
 console.log('ok: histórico preservado após recarregar.');
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});await configurar(mobile);const celular=await abrir(mobile);
 await mensagem(celular,'Anote uma pendência no card.');
 await celular.getByRole('button',{name:'Confirmar e executar',exact:true}).waitFor();
 await celular.screenshot({path:join(AQUI,'saida','joaninha-celular.png'),fullPage:false});
 assert.equal(await celular.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const caixa=await celular.locator('.jnc').boundingBox();assert.equal(caixa.width,390);
 await celular.getByRole('button',{name:'Abrir conversas',exact:true}).click();assert.equal(await celular.getByRole('button',{name:'Nova conversa',exact:true}).isVisible(),true);
 console.log('ok: conversa e plano cabem no celular, histórico acessível.');
 assert.deepEqual(erros,[],'erros de script: '+erros.join('; '));
 console.log('Joaninha validada no index.html real sem serviços de produção.');
}finally{await browser.close();servidor.close();}
