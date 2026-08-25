// O financeiro numa tela de celular (iPhone 13).
//
// Roda com: node testes/celular.mjs
// (o montar.mjs recorta o financeiro do index.html antes de cada execução)
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {servir} from './servidor.mjs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
// As imagens saem sempre em testes/saida, mesmo rodando de outra pasta.
const SAIDA=(n)=>join(dirname(fileURLToPath(import.meta.url)),'saida',n);
const servidor=await servir();
const erros=[];
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
// iPhone 13 em pé
const pg=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
pg.on('pageerror',e=>erros.push('pageerror: '+e.message));
await pg.goto('http://127.0.0.1:8199/harness.html');
await pg.waitForFunction(()=>window.__pronto===true);
const limpo=s=>s.replace(/ /g,' ').replace(/\s+/g,' ');
const passo=async(n,f)=>{try{await f();console.log('  ok  '+n);}catch(e){erros.push(n+' → '+e.message);console.log('FALHA '+n+' → '+e.message);}};

await passo('a lateral está escondida, como no celular de verdade',async()=>{
  const vis=await pg.isVisible('.sidebar');
  if(vis)throw new Error('a lateral apareceu — o teste não está em tela de celular');
});
await passo('o botão do Financeiro aparece no celular',async()=>{
  await pg.waitForSelector('.fin-atalho-mobile .fin-atalho');
  if(!await pg.isVisible('.fin-atalho-mobile'))throw new Error('o atalho não apareceu');
  await pg.screenshot({path:SAIDA('cel-home.png')});
});
await passo('"Meu financeiro" só aparece para a Shirley',async()=>{
  if(await pg.isVisible('#fin-atalho-meu'))throw new Error('apareceu sem identidade definida');
  await pg.evaluate(()=>{localStorage.setItem('painel_usuario','Shirley');atualizarSidebarFinanceiro();});
  if(!await pg.isVisible('#fin-atalho-meu'))throw new Error('não apareceu para a Shirley');
  await pg.evaluate(()=>{localStorage.setItem('painel_usuario','Grazi');atualizarSidebarFinanceiro();});
  if(await pg.isVisible('#fin-atalho-meu'))throw new Error('apareceu para a Grazi');
  await pg.evaluate(()=>{localStorage.setItem('painel_usuario','Shirley');atualizarSidebarFinanceiro();});
});
await passo('o Financeiro abre e cabe na tela',async()=>{
  await pg.tap('.fin-atalho-mobile .fin-atalho');
  await pg.waitForSelector('#fin-login-email');
  await pg.fill('#fin-login-email','shirley@cartorio.com');
  await pg.fill('#fin-login-senha','certa');
  await pg.tap('#fin-btn-entrar');
  await pg.waitForSelector('#fin-liberar-nome');
  await pg.fill('#fin-liberar-nome','Shirley');
  await pg.tap('#fin-btn-liberar');
  await pg.waitForSelector('#modal-financeiro.open .fin-planilha, #modal-financeiro.open .fin-vazio');
  const larg=await pg.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
  if(!larg)throw new Error('a página passou a rolar de lado');
  await pg.screenshot({path:SAIDA('cel-financeiro.png')});
});
await passo('dá para lançar uma escritura pelo celular',async()=>{
  await pg.evaluate(()=>finNovo());
  await pg.waitForSelector('#fin-f-descricao');
  await pg.fill('#fin-f-descricao','Tania — compra e venda');
  await pg.fill('#fin-f-tabeliao','3.427,23');
  await pg.selectOption('#fin-f-status','pago');
  await pg.fill('#fin-f-data','2026-08-10');
  await pg.waitForTimeout(200);
  const p=limpo(await pg.textContent('#fin-preview'));
  if(!p.includes('R$ 856,80'))throw new Error('a prévia não fechou → '+p.slice(0,200));
  await pg.screenshot({path:SAIDA('cel-form.png')});
  await pg.evaluate(()=>finSalvarLancamento());
  await pg.waitForSelector('.fin-planilha tbody tr');
  const larg=await pg.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
  if(!larg)throw new Error('o cartão da escritura estourou a largura');
});
await passo('a aba Ajustes não vira uma sopa de campos',async()=>{
  await pg.evaluate(()=>finIrPara('ajustes'));
  await pg.waitForSelector('#fin-cfg-pessoas .fin-pessoa-linha');
  const larg=await pg.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
  if(!larg)throw new Error('Ajustes estourou a largura');
  const nome=await pg.evaluate(()=>document.querySelector('#fin-cfg-pessoas .cfg-nome').getBoundingClientRect().width);
  if(nome<180)throw new Error('o campo do nome ficou espremido: '+Math.round(nome)+'px');
  await pg.screenshot({path:SAIDA('cel-ajustes.png')});
});
await passo('Quem recebe e a Carteira também cabem',async()=>{
  for(const aba of ['pessoas','carteira']){
    await pg.evaluate(a=>finIrPara(a),aba);
    await pg.waitForTimeout(200);
    const larg=await pg.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
    if(!larg)throw new Error('a aba '+aba+' estourou a largura');
  }
  await pg.evaluate(()=>finIrPara('pessoas'));
  await pg.waitForTimeout(150);
  await pg.screenshot({path:SAIDA('cel-pessoas.png')});
});
await b.close();
servidor.close();
console.log(erros.length?('\n'+erros.length+' PROBLEMA(S):\n'+erros.join('\n')):'\nCabe no celular.');
process.exit(erros.length?1:0);
