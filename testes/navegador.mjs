// Os caminhos do financeiro num navegador de verdade.
//
// Roda com: node testes/navegador.mjs
// (o montar.mjs recorta o financeiro do index.html antes de cada execução)
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {servir} from './servidor.mjs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
// As imagens saem sempre em testes/saida, mesmo rodando de outra pasta.
const SAIDA=(n)=>join(dirname(fileURLToPath(import.meta.url)),'saida',n);
const servidor=await servir();
const erros=[];
const finNumEsperado=s=>parseFloat(String(s).replace('R$','').trim().replace(/\./g,'').replace(',','.'));
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const pg=await b.newPage({viewport:{width:1180,height:1100}});
pg.on('pageerror',e=>erros.push('pageerror: '+e.message));
pg.on('console',m=>{const t=m.text();if(m.type()==='error'&&!t.includes('favicon')&&!t.includes('404'))erros.push('console: '+t);});
await pg.goto('http://127.0.0.1:8199/harness.html');
await pg.waitForFunction(()=>window.__pronto===true);
const limpo=s=>s.replace(/ /g,' ').replace(/\s+/g,' ');
const passo=async(nome,fn)=>{try{await fn();console.log('  ok  '+nome);}catch(e){erros.push(nome+' → '+e.message);console.log('FALHA '+nome+' → '+e.message);}};

await passo('o Financeiro pede login antes de mostrar qualquer número',async()=>{
  await pg.evaluate(()=>abrirFinanceiro());
  await pg.waitForSelector('#fin-login-email');
  const t=limpo(await pg.textContent('#modal-financeiro'));
  if(/R\$/.test(t))throw new Error('mostrou valor antes de entrar → '+t.slice(0,200));
  if((await pg.$$('.fin-aba:visible')).length)throw new Error('as abas apareceram sem login');
  await pg.screenshot({path:SAIDA('n-login.png')});
  await pg.fill('#fin-login-email','cartorio@shirleydantas.com');
  await pg.fill('#fin-login-senha','errada');
  await pg.click('#fin-btn-entrar');
  await pg.waitForTimeout(300);
  if(!(await pg.textContent('#fin-login-erro')).includes('incorretos'))throw new Error('aceitou senha errada');
  await pg.fill('#fin-login-senha','sem-auth');
  await pg.click('#fin-btn-entrar');
  await pg.waitForTimeout(300);
  const semAuth=await pg.textContent('#fin-login-erro');
  if(semAuth.includes('configuration-not-found'))throw new Error('mostrou o código cru do Firebase');
  if(!semAuth.includes('Authentication'))throw new Error('não explicou o que fazer → '+semAuth);
  await pg.fill('#fin-login-senha','certa');
  await pg.click('#fin-btn-entrar');
  await pg.waitForSelector('#fin-liberar-nome');
});
await passo('a conta se libera sozinha, sem console',async()=>{
  const t=limpo(await pg.textContent('#modal-financeiro'));
  if(!t.includes('Falta liberar esta conta'))throw new Error('não pediu liberação → '+t.slice(0,200));
  if(/R\$/.test(t))throw new Error('mostrou valor antes de liberar');
  await pg.fill('#fin-liberar-nome','Shirley');
  await pg.click('#fin-btn-liberar');
  await pg.waitForSelector('#modal-financeiro.open .fin-filtros');
  const gravado=await pg.evaluate(()=>window.__raiz.acesso['uid-shirley']);
  if(gravado.nome!=='Shirley')throw new Error('gravou o nome errado: '+JSON.stringify(gravado));
  if(gravado.dono!==true)throw new Error('a conta da dona devia sair com dono: '+JSON.stringify(gravado));
  if(!limpo(await pg.textContent('#modal-financeiro .modal-sub')).includes('Shirley'))throw new Error('não mostrou quem entrou');
});
await passo('abre o Financeiro já com os arranjos prontos',async()=>{
  await pg.evaluate(()=>finIrPara('ajustes'));
  await pg.waitForSelector('.fin-arranjo');
  const t=limpo(await pg.textContent('#fin-conteudo'));
  const nomes=await pg.$$eval('#fin-cfg-arranjos .arr-nome',e=>e.map(i=>i.value));
  for(const nome of ['Direto — sem parceiro','Renato','Basiotti','Vinicius'])
    if(!nomes.includes(nome))throw new Error('arranjo ausente: '+nome+' → '+nomes.join('|'));
  if(!t.includes('Shirley + Grazi'))throw new Error('Basiotti não mostra Shirley e Grazi na mesma parte');
  const rep=await pg.inputValue('#fin-cfg-repasse'), ir=await pg.inputValue('#fin-cfg-ir');
  if(rep!=='25'||ir!=='27,5')throw new Error('percentuais padrão errados: '+rep+' / '+ir);
  await pg.evaluate(()=>finSalvarAjustes());
  await pg.waitForTimeout(150);
  const salvo=await pg.evaluate(()=>window.__raiz.financeiro.config.arranjos.length);
  if(salvo!==4)throw new Error('gravou '+salvo+' arranjos');
});
await passo('digitar o controle no card abre a janela dos valores',async()=>{
  await pg.evaluate(()=>fecharFinanceiro());
  await pg.evaluate(()=>mudarCampo('c1','controle','2026-4471'));
  await pg.waitForSelector('#modal-caso-financeiro.open #cf-tabeliao');
  const sub=limpo(await pg.textContent('#caso-fin-sub'));
  if(!sub.includes('TANIA')||!sub.includes('2026-4471'))throw new Error('a janela não sabe de que caso é: '+sub);
  await pg.fill('#cf-tabeliao','3.427,23');
  await pg.selectOption('#cf-status','pago');
  await pg.fill('#cf-data','2026-08-10');
  await pg.fill('#cf-registro','1.200');
  await pg.waitForTimeout(200);
  const previa=limpo(await pg.textContent('#cf-previa'));
  for(const v of ['R$ 856,80','R$ 428,40','R$ 310,59','R$ 1.200,00'])
    if(!previa.includes(v))throw new Error('prévia sem "'+v+'" → '+previa.slice(0,240));
  await pg.click('#modal-caso-financeiro .btn-save');
  await pg.waitForTimeout(300);
  const l=await pg.evaluate(()=>Object.values(window.__raiz.financeiro.lancamentos)[0]);
  if(l.casoId!=='c1')throw new Error('não ficou preso ao caso: '+JSON.stringify(l));
  if(l.descricao!=='TANIA MARIA DA SILVA')throw new Error('não puxou o nome do caso: '+l.descricao);
  if(l.tipoAto!=='Compra e venda')throw new Error('não puxou o tipo de ato');
});
await passo('o card passa a mostrar os valores e o botão de editar',async()=>{
  await pg.waitForTimeout(400);
  const faixa=limpo(await pg.textContent('#cartao-teste'));
  for(const v of ['R$ 3.427,23','R$ 428,40','R$ 310,59','PAGO','Editar'])
    if(!faixa.includes(v))throw new Error('faixa do card sem "'+v+'" → '+faixa);
});
await passo('editar pelo card altera o mesmo lançamento',async()=>{
  await pg.evaluate(()=>abrirFinanceiroDoCaso('c1'));
  await pg.waitForSelector('#cf-tabeliao');
  const dentro=await pg.inputValue('#cf-tabeliao');
  if(finNumEsperado(dentro)!==3427.23)throw new Error('não abriu com o valor lançado: '+dentro);
  await pg.fill('#cf-tabeliao','4.000');
  await pg.click('#modal-caso-financeiro .btn-save');
  await pg.waitForTimeout(300);
  const n=await pg.evaluate(()=>Object.keys(window.__raiz.financeiro.lancamentos).length);
  if(n!==1)throw new Error('criou lançamento novo em vez de editar: '+n);
  await pg.evaluate(()=>abrirFinanceiroDoCaso('c1'));
  await pg.waitForSelector('#cf-tabeliao');
  await pg.fill('#cf-tabeliao','3.427,23');
  await pg.click('#modal-caso-financeiro .btn-save');
  await pg.waitForTimeout(300);
});
await passo('a aba Financeiro é alimentada sozinha',async()=>{
  await pg.evaluate(()=>abrirFinanceiro());
  await pg.evaluate(()=>finIrPara('lancamentos'));
  await pg.waitForSelector('.fin-planilha tbody tr');
  const linha=limpo(await pg.textContent('.fin-planilha tbody tr'));
  if(!linha.includes('TANIA MARIA DA SILVA'))throw new Error('a escritura do card não apareceu: '+linha);
  if(!linha.includes('R$ 3.427,23'))throw new Error('valor errado na planilha: '+linha);
});
await passo('o formulário antigo da aba continua servindo para o que não tem card',async()=>{
  await pg.evaluate(()=>finNovo());
  await pg.waitForSelector('#fin-f-descricao');
  await pg.fill('#fin-f-descricao','Tania — compra e venda');
  await pg.fill('#fin-f-tabeliao','3.427,23');
  await pg.selectOption('#fin-f-status','pago');
  await pg.fill('#fin-f-data','2026-08-09');
  await pg.waitForTimeout(150);
  const p=limpo(await pg.textContent('#fin-preview'));
  for(const v of ['R$ 3.427,23','R$ 856,80','R$ 2.570,43'])
    if(!p.includes(v))throw new Error('falta "'+v+'" na escada → '+p.slice(0,340));
  if(!p.includes('sem IR, passa inteiro'))throw new Error('a parte da Shirley devia passar bruta → '+p.slice(0,340));
  if(!p.includes('repassa R$ 310,59'))throw new Error('a Grazi devia receber 310,59 → '+p.slice(0,340));
  if(p.includes('R$ 621,18'))throw new Error('o IR ainda está saindo do bolo inteiro');
  const vals=await pg.$$eval('#fin-preview input',e=>e.map(i=>i.value));
  if(vals.join('|')!=='428,40|428,40')throw new Error('divisão: '+vals.join('|'));
  if(!p.includes('Fechamento de agosto'))throw new Error('ciclo errado: '+p.slice(-140));
  await pg.screenshot({path:SAIDA('n-form.png')});
  await pg.evaluate(()=>finSalvarLancamento());
  await pg.waitForSelector('.fin-planilha tbody tr');
});
await passo('a aba Lançamentos não tem mais o aviso amarelo',async()=>{
  if(await pg.$('#fin-conteudo .fin-aviso'))throw new Error('o aviso dos ajustes voltou');
});
await passo('a planilha tem as colunas certas, sem a da escritura',async()=>{
  const cols=await pg.$$eval('.fin-planilha thead th',e=>e.map(x=>x.textContent.trim()));
  const esperadas=['Outorgado','Ao tabelião','Shirley','Grazi','Parceiro','Registro',''];
  if(cols.join('|')!==esperadas.join('|'))throw new Error('colunas: '+cols.join(' | '));
});
await passo('a linha mostra a parte de cada uma, e a escada fica escondida',async()=>{
  const linha=limpo(await pg.textContent('.fin-planilha tbody tr'));
  for(const v of ['R$ 3.427,23','R$ 428,40','R$ 310,59'])
    if(!linha.includes(v))throw new Error('falta "'+v+'" na linha → '+linha);
  if(linha.includes('Repasse'))throw new Error('a escada está aberta sem ninguém pedir → '+linha);
  // clicar abre o detalhe
  await pg.click('.fin-planilha tbody tr');
  await pg.waitForSelector('.fin-linha-detalhe');
  const det=limpo(await pg.textContent('.fin-linha-detalhe'));
  if(!det.includes('Repasse 25%')||!det.includes('R$ 856,80'))throw new Error('detalhe sem a escada → '+det.slice(0,200));
  if(det.includes('Escritura paga pela cliente'))throw new Error('a escada ainda cita o valor cheio');
  await pg.click('.fin-planilha tbody tr');
});
await passo('o total fica no topo, acima dos nomes, e em vermelho',async()=>{
  const cor=await pg.evaluate(()=>{const td=document.querySelector('.fin-planilha .fin-total td:nth-child(2)');const s=getComputedStyle(td);return {fundo:s.backgroundColor,letra:s.color};});
  const corpos=await pg.evaluate(()=>{
    const tot=document.querySelector('.fin-planilha .fin-total td:nth-child(2)');
    const linha=document.querySelector('.fin-planilha tbody tr td.num');
    return {total:getComputedStyle(tot).fontSize,linha:getComputedStyle(linha).fontSize};
  });
  if(corpos.total!==corpos.linha)throw new Error('o total não combina com os valores de baixo: '+corpos.total+' vs '+corpos.linha);
  const rgb=t=>(t.match(/\d+/g)||[0,0,0]).map(Number);
  const [lr,lg,lb]=rgb(cor.letra);
  if(!(lr>lg+80&&lr>lb+80))throw new Error('o número do total não está em vermelho: '+cor.letra);
  // o fundo é um vermelho lavado — o que o distingue do bege é o vermelho
  // puxar mais que o azul, e não ser tão saturado quanto a letra
  const [fr,fg,fb]=rgb(cor.fundo);
  if(!(fr>fb+15&&fr>fg+10))throw new Error('o fundo do total não está avermelhado: '+cor.fundo);
  const ordem=await pg.$$eval('.fin-planilha tr',e=>e.map(x=>x.className||'linha'));
  if(ordem.indexOf('fin-total')===-1)throw new Error('a linha de total sumiu');
  if(ordem.indexOf('fin-total')>1)throw new Error('o total não está no topo: '+ordem.slice(0,4).join(' | '));
  if(await pg.$('.fin-planilha tfoot'))throw new Error('ainda existe rodapé');
  const pe=await pg.$$eval('.fin-planilha .fin-total td',e=>e.map(x=>x.textContent.replace(/\u00a0/g,' ').trim()));
  const linhas=await pg.$$eval('.fin-planilha tbody tr td:nth-child(2)',e=>e.map(x=>x.textContent.replace(/\u00a0/g,' ').trim()));
  const somaLinhas=linhas.reduce((s,v)=>s+(finNumEsperado(v.replace('R$ ',''))||0),0);
  const totalRodape=finNumEsperado(pe[1].replace('R$ ',''));
  if(Math.abs(somaLinhas-totalRodape)>0.005)throw new Error('rodapé não é a soma das linhas: '+totalRodape+' vs '+somaLinhas);
});
await passo('o botão bruto/líquido troca as colunas das pessoas',async()=>{
  await pg.click('.fin-seg button:not(.on)');
  await pg.waitForTimeout(200);
  const linha=limpo(await pg.textContent('.fin-planilha tbody tr'));
  if(!linha.includes('R$ 428,40'))throw new Error('bruto da Grazi não apareceu → '+linha);
  const grazi=await pg.$$eval('.fin-planilha tbody tr:first-child td.num',e=>e.map(x=>x.textContent.replace(/\u00a0/g,' ').trim()));
  if(grazi[2]!=='R$ 428,40')throw new Error('em bruto a Grazi devia ficar igual à Shirley: '+grazi.join(' | '));
  await pg.click('.fin-seg button:not(.on)');
  await pg.waitForTimeout(200);
});
await passo('lança um caso do Basiotti (Shirley e Grazi como uma sócia)',async()=>{
  await pg.evaluate(()=>finNovo());
  await pg.waitForSelector('#fin-f-descricao');
  await pg.fill('#fin-f-descricao','Basiotti — Un. 22');
  await pg.fill('#fin-f-tabeliao','3.427,23');
  await pg.selectOption('#fin-f-arranjo','basiotti');
  await pg.selectOption('#fin-f-status','pago');
  await pg.fill('#fin-f-data','2026-08-11');
  await pg.waitForTimeout(150);
  const vals=await pg.$$eval('#fin-preview input',e=>e.map(i=>i.value));
  if(vals.join('|')!=='142,80|142,80|285,60|285,60')throw new Error('quotas do Basiotti: '+vals.join('|'));
  await pg.evaluate(()=>finSalvarLancamento());
  await pg.waitForTimeout(200);
});
await passo('marca o repasse da Shirley na Tania',async()=>{
  const id=await pg.evaluate(()=>Object.values(window.__raiz.financeiro.lancamentos).find(l=>l.descricao.startsWith('Tania')).id);
  await pg.evaluate(i=>finToggleRepasse(i,'shirley'),id);
  await pg.waitForTimeout(200);
  const rep=await pg.evaluate(i=>window.__raiz.financeiro.lancamentos[i].repasses.shirley.repassado,id);
  if(rep!==true)throw new Error('não gravou o repasse');
});
await passo('Quem recebe: uma pílula por pessoa, sem repetir os casos',async()=>{
  await pg.evaluate(()=>finIrPara('pessoas'));
  await pg.waitForSelector('.fin-pilula');
  const t=limpo(await pg.textContent('#fin-conteudo'));
  if(!t.includes('R$ 207,06'))throw new Error('Renato não soma 207,06 → '+t.slice(0,400));
  const nomes=await pg.$$eval('.fin-pilula-nome',e=>e.map(x=>x.textContent.trim()));
  for(const n of ['Shirley','Grazi','Renato'])
    if(!nomes.includes(n))throw new Error('falta a pílula de '+n+': '+nomes.join(' | '));
  // a lista de escrituras não pode ter voltado
  if(await pg.$('.fin-pilulas .fin-div-linha'))throw new Error('as escrituras voltaram para dentro da pílula');
  const pilulas=await pg.$$eval('.fin-pilula',e=>e.map(x=>({
    nome:(x.querySelector('.fin-pilula-nome')||{}).textContent||'',
    nota:(x.querySelector('.fin-pilula-nota')||{}).textContent||''})));
  // o parceiro tem que dizer de que caso veio a participação dele
  const casos=await pg.$$eval('.fin-pilula',e=>e.map(x=>({
    nome:(x.querySelector('.fin-pilula-nome')||{}).textContent||'',
    casos:(x.querySelector('.fin-pilula-casos')||{}).textContent||''})));
  const renato=casos.find(p=>p.nome==='Renato');
  if(!renato.casos.includes('Basiotti'))throw new Error('a pílula do Renato não diz de que caso é: '+JSON.stringify(renato));
  for(const n of ['Shirley','Grazi'])
    if(casos.find(p=>p.nome===n).casos.trim())throw new Error('a pílula da '+n+' não devia listar casos');
  const gr=pilulas.find(p=>p.nome==='Grazi'), sh=pilulas.find(p=>p.nome==='Shirley');
  if(!/l[íi]quido/i.test(gr.nota)||!gr.nota.includes('27,5'))throw new Error('a pílula da Grazi não explica o IR: '+gr.nota);
  if(sh.nota.trim())throw new Error('a pílula da Shirley não devia ter nota de IR: '+sh.nota);
});
await passo('a carteira do registro fica fora da comissão',async()=>{
  await pg.evaluate(()=>finIrPara('carteira'));
  await pg.waitForSelector('#fin-conteudo .fin-resumo');
  const t=limpo(await pg.textContent('#fin-conteudo'));
  if(!t.includes('R$ 1.200,00'))throw new Error('saldo não aparece → '+t.slice(0,300));
  if(!t.includes('EM CARTEIRA'))throw new Error('status errado');
  const id=await pg.evaluate(()=>Object.values(window.__raiz.financeiro.lancamentos).find(l=>l.valorRegistro>0).id);
  await pg.evaluate(i=>finAlternarRegistro(i),id);
  await pg.waitForTimeout(200);
  const t2=limpo(await pg.textContent('#fin-conteudo'));
  if(!t2.includes('PAGO AO RI'))throw new Error('não marcou como pago ao RI');
  const saldo=limpo(await pg.textContent('#fin-conteudo .fin-card.ambar .fin-card-num'));
  if(saldo!=='R$ 0,00')throw new Error('saldo não zerou: '+saldo);
  await pg.screenshot({path:SAIDA('n-carteira.png')});
});
await passo('cofre pessoal: cria, tranca e reabre',async()=>{
  await pg.evaluate(()=>{fecharFinanceiro();abrirMeuFinanceiro();});
  await pg.waitForSelector('#fin-senha');
  await pg.fill('#fin-senha','minha-senha-forte');
  await pg.fill('#fin-senha2','minha-senha-forte');
  await pg.click('#fin-btn-criar');
  await pg.waitForSelector('.fin-codigo');
  await pg.evaluate(()=>{window.confirm=()=>true;finConfirmarCodigo();});
  await pg.waitForSelector('#meu-fin-conteudo .fin-resumo');
  await pg.evaluate(()=>finNovoPessoal());
  await pg.waitForSelector('#fin-p-valor');
  await pg.fill('#fin-p-valor','1.200');
  await pg.fill('#fin-p-descricao','Parecer para o Dr. Vitor');
  await pg.fill('#fin-p-data','2026-08-05');
  await pg.evaluate(()=>finSalvarPessoal());
  await pg.waitForTimeout(300);
  const cru=await pg.evaluate(()=>JSON.stringify(window.__raiz.financeiro.pessoal));
  if(cru.includes('1200')||cru.includes('Vitor'))throw new Error('vazou em claro no banco');
  await pg.evaluate(()=>finTrancarAgora());
  await pg.waitForSelector('#fin-btn-abrir');
  await pg.fill('#fin-senha','errada');
  await pg.click('#fin-btn-abrir');
  await pg.waitForTimeout(500);
  if(!(await pg.textContent('#fin-cofre-erro')).includes('incorreta'))throw new Error('aceitou senha errada');
  await pg.fill('#fin-senha','minha-senha-forte');
  await pg.click('#fin-btn-abrir');
  await pg.waitForSelector('#meu-fin-conteudo .fin-resumo');
  if(!limpo(await pg.textContent('#meu-fin-conteudo')).includes('R$ 1.200,00'))throw new Error('não devolveu o serviço extra');
});
await passo('o salário aparece sozinho, somando as comissões',async()=>{
  const t=limpo(await pg.textContent('#meu-fin-conteudo'));
  if(!t.includes('R$ 999,60'))throw new Error('salário não somou 999,60 → '+t.slice(0,400));
  if(!t.includes('De onde vem o salário'))throw new Error('sem a lista de origem');
  if(!t.includes('R$ 428,40')||!t.includes('R$ 142,80'))throw new Error('não detalhou as escrituras');
  if(!t.includes('R$ 2.199,60'))throw new Error('total do fechamento errado (999,60 + 1.200)');
  await pg.screenshot({path:SAIDA('n-pessoal.png')});
});
await passo('corrigir a escritura no painel corrige o salário',async()=>{
  const id=await pg.evaluate(()=>Object.values(window.__raiz.financeiro.lancamentos).find(l=>l.descricao.startsWith('Tania')).id);
  await pg.evaluate(()=>{fecharMeuFinanceiro();abrirFinanceiro();finIrPara('lancamentos');});
  await pg.evaluate(i=>finEditar(i),id);
  await pg.waitForSelector('#fin-f-tabeliao');
  await pg.fill('#fin-f-tabeliao','4.000');
  await pg.evaluate(()=>finSalvarLancamento());
  await pg.waitForTimeout(300);
  await pg.evaluate(()=>{fecharFinanceiro();abrirMeuFinanceiro();});
  await pg.waitForSelector('#meu-fin-conteudo .fin-resumo');
  const t=limpo(await pg.textContent('#meu-fin-conteudo'));
  // 25% de 4.000 = 1.000 → metade dela = 500, no lugar dos 428,40 de antes
  if(!t.includes('R$ 1.071,20'))throw new Error('salário não acompanhou a correção → '+t.slice(0,400));
});
await passo('outra conta não vira dona do financeiro particular',async()=>{
  await pg.evaluate(()=>{fecharMeuFinanceiro();fecharFinanceiro();});
  await pg.evaluate(()=>finSair());
  await pg.waitForTimeout(300);
  await pg.evaluate(()=>{delete window.__raiz.acesso;});
  await pg.evaluate(()=>abrirFinanceiro());
  await pg.waitForSelector('#fin-login-email');
  await pg.fill('#fin-login-email','gmarosticadossantos@gmail.com');
  await pg.fill('#fin-login-senha','certa');
  await pg.click('#fin-btn-entrar');
  await pg.waitForSelector('#fin-liberar-nome');
  const aviso=limpo(await pg.textContent('#modal-financeiro'));
  if(!aviso.includes('continua fora do alcance'))throw new Error('não avisou que não é a dona → '+aviso.slice(0,300));
  await pg.fill('#fin-liberar-nome','Grazi');
  await pg.click('#fin-btn-liberar');
  await pg.waitForSelector('#modal-financeiro.open .fin-filtros');
  const g=await pg.evaluate(()=>Object.values(window.__raiz.acesso)[0]);
  if(g.dono)throw new Error('virou dona mesmo sendo a primeira a liberar: '+JSON.stringify(g));
  // e o cofre pessoal continua fechado para ela
  await pg.evaluate(()=>{fecharFinanceiro();abrirMeuFinanceiro();});
  await pg.waitForTimeout(300);
  const mf=limpo(await pg.textContent('#modal-meu-financeiro'));
  if(mf.includes('Crie a senha'))throw new Error('deixou ela criar o cofre da Shirley');
});
await passo('sair fecha o financeiro e tranca o cofre',async()=>{
  await pg.evaluate(()=>finSair());
  await pg.waitForTimeout(400);
  const t=limpo(await pg.textContent('#modal-meu-financeiro'));
  if(!t.includes('Entre para ver o financeiro'))throw new Error('não voltou pro login → '+t.slice(0,200));
  if(t.includes('R$ 571,20'))throw new Error('deixou número na tela depois de sair');
  await pg.evaluate(()=>{fecharMeuFinanceiro();abrirFinanceiro();});
  await pg.waitForSelector('#fin-login-email');
  const t2=limpo(await pg.textContent('#modal-financeiro'));
  if(/R\$/.test(t2))throw new Error('financeiro seguiu aberto depois de sair');
});
await b.close();
servidor.close();
console.log(erros.length?('\n'+erros.length+' PROBLEMA(S):\n'+erros.join('\n')):'\nTudo passou no navegador.');
process.exit(erros.length?1:0);
