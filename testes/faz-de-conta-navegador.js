// Firebase, Auth e um card de mentira: o bloco financeiro roda inteiro em
// cima destes, sem tocar no banco de verdade. Trocar isto por outra coisa é
// trocar o chão do teste — mexa com cuidado.
// ── Firebase de mentira, só pra exercitar as telas ──
const _raiz={};
function _get(p){return p.split('/').reduce((o,k)=>(o&&o[k]!==undefined)?o[k]:undefined,_raiz);}
function _set(p,v){
  const ks=p.split('/');const ult=ks.pop();
  let o=_raiz;ks.forEach(k=>{if(typeof o[k]!=='object'||o[k]===null)o[k]={};o=o[k];});
  if(v===undefined)delete o[ult];else o[ult]=v;
}
const _ouvintes=[];
function _avisar(){_ouvintes.forEach(([p,cb])=>cb({val:()=>_get(p)===undefined?null:_get(p)}));}
const db={};
const ref=(_,p)=>({p});
const onValue=(r,cb)=>{_ouvintes.push([r.p,cb]);cb({val:()=>_get(r.p)===undefined?null:_get(r.p)});};
// O banco de verdade recusa escrita em caminho fechado, e o painel precisa
// saber lidar com isso — foi assim que o primeiro orçamento de verdade não
// salvou, com o painel dizendo que tinha salvo. Ligando window.__recusarEscrita
// o teste reproduz a recusa, com a mesma cara que o Firebase dá.
function _recusa(){
  const e=new Error('PERMISSION_DENIED: Permission denied');
  e.code='PERMISSION_DENIED';
  return Promise.reject(e);
}
const set=(r,v)=>{
  if(window.__recusarEscrita)return _recusa();
  _set(r.p,JSON.parse(JSON.stringify(v)));_avisar();return Promise.resolve();};
const update=(r,v)=>{
  if(window.__recusarEscrita)return _recusa();
  const a=_get(r.p)||{};_set(r.p,JSON.parse(JSON.stringify({...a,...v})));_avisar();return Promise.resolve();};
let _n=0;
const push=(r)=>{const key='id'+(++_n);return {key,p:r.p+'/'+key};};
const remove=(r)=>{_set(r.p,undefined);_avisar();return Promise.resolve();};
const escTxt=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const esc=s=>(s||'').replace(/"/g,'&quot;');
// O dia em que o teste vive.
//
// Congelado de propósito, e dentro do fechamento de agosto de 2026 — o mesmo
// em que moram a semente (`fechamento-de-agosto.js`) e as datas que os testes
// digitam nos formulários. Sem isso a suíte envelhecia sozinha: em 26 de
// agosto o ciclo virou, a planilha do fechamento corrente amanheceu vazia e
// dez verificações passaram a falhar sem nada ter sido quebrado.
//
// Todo o calendário do financeiro sai daqui — finCicloCorrente(), a data que
// o formulário sugere, o corte de meio ciclo do quadro —, então congelar esta
// linha congela o mês inteiro. A versão sem navegador (faz-de-conta-node.js)
// já fazia assim desde sempre; isto só põe as duas no mesmo dia.
const HOJE_DE_MENTIRA='2026-08-20';
const isoHoje=()=>HOJE_DE_MENTIRA;
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
let navToastTimer=null;
const getCasosList=()=>[{id:'c1',nome:'Gustavo Bertola',tipo:'Inventário + Compra e Venda',concluido:false},{id:'c2',nome:'Miguel | Un. 2216 Do It',tipo:'Escritura',concluido:false}];
window.__raiz=_raiz;
// Semear o banco de mentira por fora e avisar os ouvintes, como faria um
// set() de verdade. A Rede mexe no __raiz e redesenha na mão; o Radar guarda
// o que leu em variáveis próprias, e sem este aviso ele redesenharia com o
// que tinha antes.
window.__avisar=_avisar;




// ── Auth de mentira ──
const auth={};
let _usuario=null, _cbAuth=[];
const onAuthStateChanged=(a,cb)=>{_cbAuth.push(cb);setTimeout(()=>cb(_usuario),0);};
const signInWithEmailAndPassword=async(a,email,senha)=>{
  if(senha==='sem-auth'){const e=new Error('x');e.code='auth/configuration-not-found';throw e;}
  if(senha!=='certa'){const e=new Error('x');e.code='auth/invalid-credential';throw e;}
  _usuario={uid:email==='cartorio@shirleydantas.com'?'uid-shirley':'uid-'+email.split('@')[0],email};
  _cbAuth.forEach(cb=>cb(_usuario));
  return {user:_usuario};
};
const sendPasswordResetEmail=async(a,email)=>{if(!/@/.test(email)){const e=new Error('x');e.code='auth/invalid-email';throw e;}return true;};
const signOut=async()=>{_usuario=null;_cbAuth.forEach(cb=>cb(null));};
const get=async(r)=>({val:()=>{const v=_get(r.p);return v===undefined?null:v;},exists:()=>_get(r.p)!==undefined});










// ── Um card de mentira, para exercitar o caminho que começa nele ──
const casos={c1:{id:'c1',nome:'TANIA MARIA DA SILVA',tipo:'Compra e venda',controle:''}};
function renderCasos(){
  const el=document.getElementById('cartao-teste');
  if(el)el.innerHTML='<span class="cx-fin-rot">Financeiro</span>'+(typeof finFaixaDoCaso==='function'?finFaixaDoCaso('c1'):'');
}
window.mudarCampo=function(id,campo,valor){casos[id][campo]=valor;renderCasos();};
setTimeout(renderCasos,50);
