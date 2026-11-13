// Capa física: identificação do card, campos manuais e três propostas em A4.
import {readFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {abrirChromium} from './navegador-de-teste.mjs';
const AQUI=dirname(fileURLToPath(import.meta.url)),html=readFileSync(join(AQUI,'..','index.html'),'utf8');
const inicio=html.indexOf('// ── A capa do dossiê ──'),fim=html.indexOf('// ── fim: a capa do dossiê ──');
assert(inicio>0&&fim>inicio);
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mundo(casos={}){
 const impressos=[],ctx={casos,esc:escape,escTxt:escape,window:{},setTimeout,document:{body:{appendChild:q=>{q.onload?.();}},createElement:()=>({style:{},setAttribute(){},remove(){},contentWindow:{focus(){},print(){impressos.push(true);}}})},finAuth:{uid:'u'},orcUltimoDoCaso(){throw Error('A capa não deve consultar orçamento');}};
 vm.createContext(ctx);vm.runInContext(readFileSync(join(AQUI,'..','lib','capa-fontes.js'),'utf8').replace('export const fontesCapa','const fontesCapa')+'\n'+html.slice(inicio,fim)+'\nthis.f={capaDados,capaHtml,capaFaixaHtml};',ctx);return {...ctx.f,window:ctx.window,impressos};
}
const c={id:'C1',nome:'CLIENTE EXEMPLO | DR. CASTANHO',tipo:'Venda e compra',controle:'000123',agendado:'2026-11-13T15:45',livro:'LIVRO_QUE_NAO_DEVE_SAIR',registroPrenotado:'REGISTRO_QUE_NAO_DEVE_SAIR'};
const m=mundo({C1:c}),d=m.capaDados(c);
assert.equal(d.parte,'CLIENTE EXEMPLO');assert.equal(d.solicitante,'DR. CASTANHO');assert.equal(d.escrevente,'Shirley');assert.equal(d.controle,'000123');
assert.equal(m.capaDados({...c,nome:'Nome sem separador'}).solicitante,'');
assert.equal(m.capaDados({...c,nome:'CLIENTE | SOLICITANTE | COMPLEMENTO'}).solicitante,'SOLICITANTE | COMPLEMENTO');
for(const modelo of ['classico']){
 const h=m.capaHtml(d,modelo);
 for(const s of ['VENDA E COMPRA','20º Cartório','000123','Shirley','DR. CASTANHO','CLIENTE EXEMPLO','Outorgante / Outorgado','PRESENCIAL','DILIGÊNCIA','HÍBRIDA','VÍDEO'])assert(h.includes(s),modelo+': '+s);
 assert.doesNotMatch(h,/Providências|PRIME|Prime|Escrivão de Títulos|R\$|Orçamento|2026-11-13|15:45|LIVRO_QUE_NAO_DEVE_SAIR|REGISTRO_QUE_NAO_DEVE_SAIR/);
 assert.match(h,/Data <span class="espaço"><\/span>/);assert.match(h,/Horário <span class="espaço hora"><\/span>/);
 for(const campo of ['Conferência','Tabeliã substituta','Conferido','Rubrica'])assert(h.includes(campo),campo);
 assert.match(h,/<div class="conf-confirmar"><i><\/i> Conferido/,'a conferência nasce sem marcação');
 assert(h.indexOf('class="bloco conferencia"')<h.indexOf('Acompanhamento do caso'),'conferência fica acima do acompanhamento');
 assert(h.indexOf('class="bloco conferencia"')<h.indexOf('class="bloco observacoes"'));
 assert.match(h,/<label>Data<span>____\/____\/______<\/span>/);
 const malicioso=m.capaHtml(m.capaDados({...c,nome:'<img src=x onerror=alert(1)> | <script>1</script>'}),modelo);assert(!malicioso.includes('<img src=x'));assert(malicioso.includes('&lt;script&gt;'));
}
console.log('ok: título, cartório, controle, Shirley, solicitante do subtítulo e nome principal; data/horário manuais; orçamento ausente; escape.');
m.window.capaImprimir('C1');await new Promise(r=>setTimeout(r,0));assert.equal(m.impressos.length,1);assert.match(m.capaFaixaHtml(c),/capaImprimir/);
const navegador=await abrirChromium();
try{
 const pg=await navegador.newPage({viewport:{width:794,height:1123}});mkdirSync(join(AQUI,'saida'),{recursive:true});
 const modelos=[['classico','Capa aprovada · 20º Cartório','Campo de conferência da tabeliã substituta.']];
 for(const [modelo] of modelos){
  for(const dados of [d,m.capaDados({...c,nome:'CLIENTE COM NOME COMPLETO MUITO LONGO PARA CONFERÊNCIA DE IMPRESSÃO | SOLICITANTE COM NOME E COMPLEMENTO EXTENSOS PARA CONFERÊNCIA',tipo:'VENDA E COMPRA COM ALIENAÇÃO FIDUCIÁRIA'})]){
   await pg.setContent(m.capaHtml(dados,modelo));await pg.evaluate(async()=>{document.body.offsetHeight;await document.fonts.ready;});
   const medidas=await pg.evaluate(()=>{const f=document.querySelector('.fl');return [f.scrollHeight-f.clientHeight,f.scrollWidth-f.clientWidth];});assert(medidas.every(x=>x<=1),modelo+' ultrapassa a página: '+medidas);
   const pdf=await pg.pdf({format:'A4',printBackground:true});assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length,1);
  }
  await pg.setContent(m.capaHtml(d,modelo));await pg.evaluate(async()=>{document.body.offsetHeight;await document.fonts.ready;});
  await pg.screenshot({path:join(AQUI,'saida','capa-modelo-'+modelo+'.png'),fullPage:true});
  if(modelo==='classico')await pg.locator('.conferencia').screenshot({path:join(AQUI,'saida','capa-conferencia-detalhe.png')});
  await pg.pdf({path:join(AQUI,'saida','capa-modelo-'+modelo+'.pdf'),format:'A4',printBackground:true});
 }
 await pg.setViewportSize({width:1400,height:740});
 await pg.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#f4ebe5;padding:28px;font-family:Arial;color:#75263f}h1{font:26px Georgia;margin:0 0 22px}.modelos{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}h2{font:21px Georgia;margin:0 0 12px}.folha{height:551px;width:390px;overflow:hidden;box-shadow:0 5px 20px #64323e15;border-radius:3px}iframe{width:794px;height:1123px;transform:scale(.49);transform-origin:top left;border:0;background:white}p{font-size:12px;color:#8a6f79;line-height:1.5;margin-top:14px}</style><h1>Três propostas para a capa do dossiê · A4</h1><div class="modelos">${modelos.map(([id,titulo,desc])=>`<section><h2>${titulo}</h2><div class="folha"><iframe id="${id}" title="${titulo}"></iframe></div><p>${desc}</p></section>`).join('')}</div>`);
 for(const [modelo] of modelos)await pg.locator('#'+modelo).evaluate((el,conteudo)=>el.srcdoc=conteudo,m.capaHtml(d,modelo));
 await pg.waitForTimeout(200);
 await pg.screenshot({path:join(AQUI,'saida','capa-tres-modelos.png'),fullPage:true});
 console.log('ok: modelo aprovado em uma página A4, inclusive nomes longos; prévia e PDF gerados.');
}finally{await navegador.close();}
process.exit(0);
