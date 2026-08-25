// Os mesmos faz-de-conta, na versão sem navegador: aqui só interessa a conta.
// Stubs mínimos pra rodar o bloco financeiro fora do navegador.
const db={};
const ref=(_,p)=>({p});
const onValue=()=>{};
let _setCapturado=null;
const set=(r,v)=>{_setCapturado=v;return Promise.resolve();};
const update=(r,v)=>{_setCapturado=Object.assign(_setCapturado||{},v);return Promise.resolve();};
const push=()=>({key:'k'+Math.random().toString(36).slice(2)});
const remove=()=>Promise.resolve();
const escTxt=s=>String(s==null?'':s);
const esc=s=>String(s||'');
const isoHoje=()=>'2026-08-24';
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
let navToastTimer=null;
const getCasosList=()=>[];
const localStorage={getItem:()=>'Shirley',setItem:()=>{}};
const document={getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>null};
const window={definirIdentidade:function(){}};
const confirm=()=>true;
const auth={};
const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(null),0);};
const signInWithEmailAndPassword=async()=>({});
const sendPasswordResetEmail=async()=>true;
const signOut=async()=>{};
const get=async(r)=>({val:()=>null,exists:()=>false});
