import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function mundo({falharAuditoria=false,semAnthropic=false}={}){
  const chamadas=[],eventos=[];
  const ctx={PropertiesService:{getScriptProperties:()=>({getProperty:k=>({ANTHROPIC_API_KEY:semAnthropic?null:'anthropic-ficticia',OPENAI_API_KEY:'openai-ficticia'})[k]||null})},Logger:{log(){}},UrlFetchApp:{fetch:(url,r)=>{
    const p=JSON.parse(r.payload);chamadas.push({url,p,headers:r.headers});
    if(url.includes('api.anthropic.com'))return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({content:[{type:'text',text:'Texto completo fictício.'}],stop_reason:'end_turn'})};
    if(url.includes('api.openai.com'))return {getResponseCode:()=>falharAuditoria?429:200,getContentText:()=>JSON.stringify(falharAuditoria?{error:{code:'rate_limit_exceeded',message:'requests per day (RPD): Limit 50, Used 50, Requested 1'}}:{status:'completed',output:[{content:[{type:'output_text',text:'{"achados":["Conferir a qualificação fictícia."]}'}]}]})};
    eventos.push({tipo:'patch',p});return {getResponseCode:()=>200};
  }}};
  vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../apps-script/openai.js',import.meta.url),'utf8'),ctx);vm.runInContext(readFileSync(new URL('../apps-script/cartorio-drive-api.js',import.meta.url),'utf8'),ctx);
  ctx.parsearResposta=texto=>({minuta:texto,comentarios:[],certidoes:[]});ctx.conferirMinuta=()=>({avisos:[],brancos:0});ctx._criarMinutaDocInterno=()=>({url:'https://docs.google.com/document/d/ficticio',nome:'Fictício',folderUrl:'https://drive.google.com/drive/folders/ficticia'});
  ctx.firebaseGravar=(metodo,path,p)=>{eventos.push({tipo:'patch',p});return {getResponseCode:()=>200};};
  ctx.salvarJobFirebase=(id,p)=>eventos.push({tipo:'job',p});ctx.resp=x=>x;
  return {ctx,chamadas,eventos};
}
test('Anthropic redige e lê; OpenAI confere depois que o documento já foi disponibilizado',()=>{
  const m=mundo();
  m.ctx.chamarClaudeArquivoRaw([{type:'text',text:'Documento fictício integral.'}]);
  m.ctx.processarRodadaMinuta('J1',{mensagemBase:'Instruções fictícias.',ano:2026,rodadas:0,textoAcumulado:'',temModelo:false,casoId:'C1',documentosTexto:'Documento original fictício.',mod:'presencial',nome:'Fictício',tipo:'Compra e venda'});
  assert.equal(m.chamadas.filter(c=>c.url.includes('api.anthropic.com')).length,2);
  assert.equal(m.chamadas.filter(c=>c.url.includes('api.openai.com')).length,1);
  const leitura=m.chamadas[0],geracao=m.chamadas[1],auditoria=m.chamadas[2];
  assert.equal(leitura.p.max_tokens,8000);assert.equal(geracao.p.max_tokens,16000);
  assert.equal(geracao.headers['x-api-key'],'anthropic-ficticia');assert.equal(auditoria.headers.Authorization,'Bearer openai-ficticia');
  assert.equal(m.eventos[0].p.auditoria.status,'pendente');assert.equal(m.eventos[1].tipo,'job');assert.equal(m.eventos[1].p.ok,true);
  assert.equal(m.eventos.at(-1).p.auditoria.status,'concluida');
});
test('bloqueio da conferência OpenAI preserva o documento e mantém estado pendente',()=>{
  const m=mundo({falharAuditoria:true});m.ctx.finalizarGeracaoMinuta('J1',{textoAcumulado:'Minuta fictícia.',casoId:'C1',documentosTexto:'Documento fictício.',mod:'presencial',rodadas:1},false);
  assert.equal(m.eventos.find(e=>e.tipo==='job').p.ok,true);
  assert.equal(m.eventos.at(-1).p.auditoria.status,'pendente');assert.equal(m.eventos.at(-1).p.auditoria.achados.length,0);
});
test('sem chave Anthropic, não há troca silenciosa de provedor',()=>{
  const m=mundo({semAnthropic:true});assert.throws(()=>m.ctx.chamarClaudeRaw('Teste',2026),/ANTHROPIC_API_KEY/);assert.equal(m.chamadas.length,0);
});
test('documentos extensos chegam inteiros à geração, sem corte de 100 mil caracteres',()=>{
  const m=mundo();let recebido;
  m.ctx.processarRodadaMinuta=(id,e)=>{recebido=e;};
  const documentos='=== MODELO DE MINUTA (REFERÊNCIA FORNECIDA PELA EQUIPE) ===\n'+'Documento integral fictício.\n'.repeat(6000);
  m.ctx.gerarECriarMinuta({jobId:'J1',nome:'Fictício',tipo:'Compra e venda',modalidade:'presencial',documentos});
  assert.equal(recebido.documentosTexto,documentos);assert.ok(recebido.mensagemBase.includes(documentos));
});
test('teste de conexão aceita resposta breve com pontuação e identifica recusa, corte ou resposta vazia',()=>{
  const m=mundo();let limite;
  m.ctx.chamarAnthropicCartorio=p=>{limite=p.max_tokens;return {texto:'OK.',truncou:false,recusa:false};};
  assert.doesNotThrow(()=>m.ctx.verificarConexaoAnthropic());assert.equal(limite,256);
  for(const [r,esperado] of [[{texto:'',truncou:true},/limite de saída/],[{texto:'',recusa:true},/recusado/],[{texto:''},/sem texto visível/]]){
    m.ctx.chamarAnthropicCartorio=()=>r;assert.throws(()=>m.ctx.verificarConexaoAnthropic(),esperado);
  }
});
