// A conversa da Joaninha no Chromium — do clique até o que foi (ou não foi) gravado.
//
// Roda com: node testes/joaninha-chat-tela.mjs
//
// O painel é de mentira (testes/faz-de-conta-joaninha.js, com o mesmo contrato da ponte
// do index.html) e o servidor/OpenAI são respondidos pela rota do Playwright. O que se
// confere aqui é o que a pessoa vive: entrar, conversar, confirmar antes de gravar,
// cancelar, parar, falar em vez de digitar — e que o celular não estoura.
import {abrirChromium} from './navegador-de-teste.mjs';
import {servir} from './servidor.mjs';
import {writeSync} from 'node:fs';

const diga = t => writeSync(1, t + '\n');
const erros = [];
const ok = (n, cond, detalhe) => {
  if (cond) { diga('  ok  ' + n); return; }
  erros.push(n + (detalhe ? ' → ' + detalhe : ''));
  diga('FALHA ' + n + (detalhe ? ' → ' + detalhe : ''));
};

const servidor = await servir();
const navegador = await abrirChromium();

// ── o servidor/OpenAI de mentira ──
const sse = evs => evs.map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('');
const texto = (t, extra) => sse([{t: 'texto', d: t}, Object.assign({t: 'fim', usoMes: 12.3, teto: 150}, extra || {})]);
const ferramentas = (pedidos, anexar) => sse([{t: 'ferramentas', pedidos, anexar: anexar || [], usoMes: 12.3, teto: 150}]);
const chamadoAssistente = (id, nome, args) => ({role: 'assistant', content: null, tool_calls: [{id, type: 'function', function: {name: nome, arguments: JSON.stringify(args)}}]});

async function novaPagina(opcoes = {}) {
  const ctx = await navegador.newContext(opcoes.contexto || {viewport: {width: 1280, height: 860}});
  const pg = await ctx.newPage();
  const estado = {pedidos: [], fila: [], atraso: 0};
  pg.__e = estado;
  pg.on('pageerror', e => { (pg.__erros = pg.__erros || []).push(String(e)); });
  await pg.route('**/api/perguntar-joaninha?acao=chat', async rota => {
    const req = rota.request();
    estado.pedidos.push({cab: req.headers(), corpo: JSON.parse(req.postData() || '{}')});
    const resp = estado.fila.shift() || {corpo: texto('ok')};
    if (estado.atraso) await new Promise(r => setTimeout(r, estado.atraso));
    try {
      await rota.fulfill({status: resp.status || 200, contentType: resp.tipo || 'text/event-stream', body: resp.corpo});
    } catch { /* a página abortou o pedido */ }
  });
  await pg.addInitScript(() => {
    // voz de mentira
    window.__sr = null; window.__falou = [];
    window.SpeechRecognition = class {
      constructor() { window.__sr = this; this.startCount = 0; this.aborted = false; }
      start() { this.startCount++; this.started = true; window.__srTotal = (window.__srTotal || 0) + 1; }
      stop() { this.started = false; this.onend && this.onend(); }
      abort() { this.aborted = true; this.started = false; }
    };
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    // speechSynthesis é só-leitura na janela: atribuir é ignorado em silêncio, então se define a propriedade.
    Object.defineProperty(window, 'speechSynthesis', {configurable: true, value: {
      speak(u) { window.__falou.push(u.text); setTimeout(() => u.onend && u.onend(), 30); },
      cancel() {}, getVoices() { return [{lang: 'pt-BR', name: 'Voz de teste'}]; }
    }});
    window.__ouvir = (t) => { const r = window.__sr; r.onresult({resultIndex: 0, results: [Object.assign([{transcript: t}], {isFinal: true})]}); r.started = false; r.onend && r.onend(); };
  });
  await pg.goto(servidor.url + '/harness-joaninha.html');
  if (opcoes.antes) await pg.evaluate(opcoes.antes);
  return pg;
}
const abrir = (pg, op) => pg.evaluate(o => window.JOANINHA_CHAT.abrir(o), op || {});
const aberta = pg => pg.waitForSelector('#jc-raiz.aberto');
const escrever = async (pg, t) => { await pg.fill('#jc-texto', t); await pg.click('#jc-enviar'); };
const respostas = pg => pg.$$eval('.jc-msg.assistant', n => n.map(x => x.textContent));
const esperarResposta = (pg, rx) => pg.waitForFunction(r => [...document.querySelectorAll('.jc-msg.assistant')].some(n => new RegExp(r).test(n.textContent)), rx.source || rx, {timeout: 8000});
const chamadas = pg => pg.evaluate(() => window.__chamadas);

// ═════════════════════════════════════════════════════════════════════════
diga('\n— Quem entra —');
{
  let pg = await novaPagina({antes: () => window.__mudarSessao({logado: false})});
  await abrir(pg); await aberta(pg);
  ok('sem login, a Joaninha pede a conta e não mostra caso nenhum', await pg.isVisible('#jc-login-email') && !(await pg.textContent('#jc-corpo')).includes('ANA'));
  await pg.fill('#jc-login-email', 'x@y.com'); await pg.fill('#jc-login-senha', 'errada'); await pg.click('[data-jc="entrar"]');
  await pg.waitForFunction(() => /incorretos/.test(document.getElementById('jc-login-erro').textContent));
  ok('senha errada: mensagem em português, e segue pedindo', await pg.isVisible('#jc-login-email'));
  await pg.fill('#jc-login-senha', 'segredo'); await pg.click('[data-jc="entrar"]');
  await pg.waitForSelector('.jc-boas-vindas');
  ok('entrou: aparecem as boas-vindas com o nome e as sugestões', /Oi, Shirley/.test(await pg.textContent('.jc-boas-vindas')) && (await pg.$$('.jc-sug')).length === 4);
  await pg.context().close();

  pg = await novaPagina({antes: () => window.__mudarSessao({logado: true, liberada: false, nome: 'Intrusa'})});
  await abrir(pg); await aberta(pg);
  ok('conta que entrou mas não está liberada vê "Falta liberar"', /Falta liberar esta conta/.test(await pg.textContent('#jc-corpo')) && !(await pg.$('#jc-login-email')));
  await pg.context().close();
}

diga('\n— Uma conversa —');
{
  const pg = await novaPagina();
  pg.__e.fila.push({corpo: texto('Oi, Shirley! Tem **2 casos** em andamento.\n\n- Ana Paula\n- Bruno')});
  await abrir(pg); await aberta(pg);
  await pg.click('.jc-sug >> text=Resumo do dia');
  await esperarResposta(pg, /2 casos/);
  const ped = pg.__e.pedidos[0];
  ok('manda a pergunta com o token da pessoa, no cabeçalho', /^Bearer token-u-shirley/.test(ped.cab.authorization) && ped.corpo.mensagens.length === 1 && ped.corpo.mensagens[0].content === 'Resumo do dia');
  ok('nível padrão, sem voz, rodada zero', ped.corpo.nivel === 'padrao' && ped.corpo.voz === false && ped.corpo.rodada === 0);
  ok('a resposta aparece formatada (negrito e lista)', (await pg.$$eval('.jc-msg.assistant strong', n => n.map(x => x.textContent))).includes('2 casos') && (await pg.$$('.jc-msg.assistant li')).length === 2);
  ok('o indicador do consumo do mês aparece', /R\$ 12,30 de R\$ 150/.test(await pg.textContent('#jc-uso')));
  const banco = await pg.evaluate(() => window.__banco);
  const msgs = Object.values(Object.values(banco.joaninha_mensagens)[0]);
  ok('o histórico fica no banco, com quem escreveu', msgs.length === 2 && msgs[0].papel === 'user' && msgs[0].autor === 'Shirley' && msgs[1].autor === 'Joaninha');
  const conv = Object.values(banco.joaninha_conversas)[0];
  ok('a conversa nasce com título e dono', conv.titulo === 'Resumo do dia' && conv.criadaPor.nome === 'Shirley' && conv.casoId === null);
  ok('a lateral lista a conversa', /Resumo do dia/.test(await pg.textContent('#jc-lista')));
  // segunda pergunta: o histórico vai junto
  pg.__e.fila.push({corpo: texto('Segunda resposta.')});
  await escrever(pg, 'e o que mais?');
  await esperarResposta(pg, /Segunda resposta/);
  const seg = pg.__e.pedidos[1].corpo.mensagens;
  ok('a segunda pergunta leva o histórico, sem repetir mensagem', seg.length === 3 && seg[0].content === 'Resumo do dia' && seg[1].role === 'assistant' && seg[2].content === 'e o que mais?', JSON.stringify(seg.map(m => m.role)));
  await pg.context().close();
}

diga('\n— O texto da IA nunca vira página —');
{
  const pg = await novaPagina();
  pg.__e.fila.push({corpo: texto('<img src=x onerror="window.__xss=1"> <script>window.__xss=2</script> **ok**')});
  await abrir(pg); await aberta(pg);
  await escrever(pg, 'teste');
  await esperarResposta(pg, /ok/);
  await pg.waitForTimeout(300);
  ok('tag perigosa vira texto, não elemento', !(await pg.$('.jc-msg.assistant img')) && !(await pg.$('.jc-msg.assistant script')) && !(await pg.evaluate(() => window.__xss)));
  await pg.context().close();
}

diga('\n— Ferramenta de leitura: o painel executa e devolve —');
{
  const pg = await novaPagina();
  pg.__e.fila.push({corpo: ferramentas([{id: 'call_1', nome: 'listar_casos', args: {busca: 'ana'}, escreve: false}], [chamadoAssistente('call_1', 'listar_casos', {busca: 'ana'})])});
  pg.__e.fila.push({corpo: texto('Achei o caso da Ana Paula.')});
  await abrir(pg); await aberta(pg);
  await escrever(pg, 'Qual o caso da Ana?');
  await esperarResposta(pg, /Achei o caso/);
  const seg = pg.__e.pedidos[1].corpo;
  const tool = seg.mensagens.find(m => m.role === 'tool');
  ok('sem pedir confirmação, a leitura roda e volta ao servidor com rodada 1', tool && tool.tool_call_id === 'call_1' && seg.rodada === 1 && !(await pg.$('.jc-confirma')));
  ok('o resultado é o do painel (o caso certo)', JSON.parse(tool.content).casos[0].id === 'c1');
  ok('a mensagem do assistente com o pedido volta junto, como o servidor mandou', seg.mensagens.some(m => m.role === 'assistant' && m.tool_calls));
  ok('nada foi gravado por uma leitura', (await chamadas(pg)).gravarNota.length === 0);
  await pg.context().close();
}

diga('\n— Quem escreve só roda depois do clique —');
{
  const pg = await novaPagina();
  const pedido = {id: 'call_n', nome: 'adicionar_nota', args: {texto: 'ligar amanhã para a Ana', caso_id: 'c1'}, escreve: true};
  pg.__e.fila.push({corpo: ferramentas([pedido], [chamadoAssistente('call_n', 'adicionar_nota', pedido.args)])});
  pg.__e.fila.push({corpo: texto('Anotei no caso da Ana.')});
  await abrir(pg); await aberta(pg);
  await escrever(pg, 'anota no caso da Ana que é para ligar amanhã');
  await pg.waitForSelector('.jc-confirma');
  await pg.waitForTimeout(400);
  ok('a confirmação aparece com o caso e o texto', /ANA PAULA/.test(await pg.textContent('.jc-confirma h4')) && (await pg.inputValue('.jc-confirma textarea')) === 'ligar amanhã para a Ana');
  ok('não sobra bolha vazia da Joaninha enquanto ela espera a confirmação', await pg.$$eval('.jc-msg.assistant', n => n.every(x => x.textContent.trim().length > 0)));
  ok('ANTES do clique nada foi gravado — e o servidor ainda não foi chamado de novo', (await chamadas(pg)).gravarNota.length === 0 && pg.__e.pedidos.length === 1);
  await pg.fill('.jc-confirma textarea', 'ligar amanhã cedo para a Ana');
  await pg.click('.jc-ok');
  await esperarResposta(pg, /Anotei no caso/);
  const c = await chamadas(pg);
  ok('depois do clique grava pelo caminho do painel, com o texto que ela corrigiu', c.gravarNota.length === 1 && c.gravarNota[0].texto === 'ligar amanhã cedo para a Ana' && c.gravarNota[0].alvo.id === 'c1');
  const tool = pg.__e.pedidos[1].corpo.mensagens.find(m => m.role === 'tool');
  ok('a Joaninha recebe o resultado verdadeiro', /Anotado no histórico/.test(tool.content));
  const acoes = Object.values((await pg.evaluate(() => window.__banco)).joaninha_acoes);
  ok('fica registrado quem confirmou e o quê', acoes.length === 1 && acoes[0].status === 'feita' && acoes[0].quem === 'Shirley' && acoes[0].ferramenta === 'adicionar_nota');
  await pg.context().close();
}

diga('\n— Cancelar não grava nada —');
{
  const pg = await novaPagina();
  const pedido = {id: 'call_l', nome: 'criar_lembrete', args: {texto: 'Ligar para o Bruno', quando: '2026-11-12T14:30:00-03:00', caso_id: 'c2'}, escreve: true};
  pg.__e.fila.push({corpo: ferramentas([pedido], [chamadoAssistente('call_l', 'criar_lembrete', pedido.args)])});
  pg.__e.fila.push({corpo: texto('Tudo bem, não criei.')});
  await abrir(pg); await aberta(pg);
  await escrever(pg, 'me lembra de ligar para o Bruno quinta às 14h30');
  await pg.waitForSelector('.jc-confirma');
  ok('o lembrete mostra a data em horário de Brasília', /12\/11\/2026/.test(await pg.textContent('.jc-confirma h4')) && /BRUNO/.test(await pg.textContent('.jc-confirma h4')));
  await pg.click('.jc-no');
  await esperarResposta(pg, /não criei/);
  const c = await chamadas(pg);
  ok('cancelou: nenhum lembrete foi criado', c.criarLembrete.length === 0);
  const tool = pg.__e.pedidos[1].corpo.mensagens.find(m => m.role === 'tool');
  ok('a Joaninha é avisada de que foi cancelado', /CANCELOU/.test(tool.content));
  const acoes = Object.values((await pg.evaluate(() => window.__banco)).joaninha_acoes);
  ok('o cancelamento também fica registrado', acoes[0].status === 'cancelada');
  await pg.context().close();
}

diga('\n— A minuta: a Joaninha orienta, quem manda gerar é a pessoa —');
{
  const pg = await novaPagina();
  const pedido = {id: 'call_m', nome: 'preparar_reedicao_minuta', args: {caso_id: 'c1', instrucao: 'Corrigir o estado civil da compradora para casada.'}, escreve: true};
  pg.__e.fila.push({corpo: ferramentas([pedido], [chamadoAssistente('call_m', 'preparar_reedicao_minuta', pedido.args)])});
  pg.__e.fila.push({corpo: texto('Abri a tela de reedição.')});
  await abrir(pg); await aberta(pg);
  await escrever(pg, 'peça ao Claude para corrigir o estado civil da compradora');
  await pg.waitForSelector('.jc-confirma');
  ok('antes do clique a tela de reedição não foi aberta', (await chamadas(pg)).abrirReedicao.length === 0);
  ok('a confirmação avisa que nada é gerado agora', /Nada é gerado agora/.test(await pg.textContent('.jc-confirma')));
  await pg.click('.jc-ok');
  await esperarResposta(pg, /Abri a tela/);
  const c = await chamadas(pg);
  ok('abre a reedição com a instrução — e só isso', c.abrirReedicao.length === 1 && c.abrirReedicao[0].id === 'c1' && /casada/.test(c.abrirReedicao[0].instrucao) && c.gravarNota.length === 0);
  await pg.context().close();
}

diga('\n— Dentro do card —');
{
  const pg = await novaPagina();
  pg.__e.fila.push({corpo: texto('Faltam a certidão de casamento e a do cônjuge.')});
  await abrir(pg, {casoId: 'c1'}); await aberta(pg);
  ok('a conversa nasce presa ao caso, com o nome à vista', /ANA PAULA/.test(await pg.textContent('#jc-sub')));
  ok('as sugestões são do caso (pendências, orçamento, documentos)', /pendências deste caso/.test(await pg.textContent('.jc-boas-vindas')) && /orçamento/i.test(await pg.textContent('.jc-boas-vindas')));
  await pg.click('.jc-sug >> text=Quais são as pendências');
  await esperarResposta(pg, /certidão de casamento/);
  const ctx = pg.__e.pedidos[0].corpo.contexto.resumo;
  ok('o servidor recebe o contexto do card: dados, documentos e orçamento', /ANA PAULA/.test(ctx) && /matricula_12345\.pdf/.test(ctx) && /Orçamento: versão 2/.test(ctx) && /Falta documentos/.test(ctx));
  ok('o texto dos documentos NÃO vai no contexto (só por ferramenta, sob demanda)', !/apartamento 1301/.test(ctx));
  const conv = Object.values((await pg.evaluate(() => window.__banco)).joaninha_conversas)[0];
  ok('a conversa guarda o caso', conv.casoId === 'c1' && /ANA/.test(conv.casoNome));
  // fecha e reabre pelo botão do card: retoma a mesma conversa
  await pg.evaluate(() => window.JOANINHA_CHAT.fechar());
  await abrir(pg, {casoId: 'c1'});
  await pg.waitForFunction(() => /pendências deste caso/.test(document.getElementById('jc-corpo').textContent) || document.querySelectorAll('.jc-msg').length >= 2);
  ok('reabrir pelo card retoma a conversa daquele caso', (await respostas(pg)).some(t => /certidão de casamento/.test(t)));
  await pg.context().close();
}

diga('\n— Shirley e Grazi: o mesmo histórico —');
{
  const pg = await novaPagina({antes: () => {
    window.__banco.joaninha_conversas = {g1: {titulo: 'Dúvida do ITCMD', casoId: null, casoNome: '', criadaPor: {nome: 'Grazi'}, atualizadaEm: '2026-11-10T10:00:00Z'}};
    window.__banco.joaninha_mensagens = {g1: {m1: {papel: 'user', texto: 'Posso lavrar sem o ITCMD?', autor: 'Grazi', em: '2026-11-10T10:00:00Z'}, m2: {papel: 'assistant', texto: 'Só a escritura; o RI continua exigindo.', autor: 'Joaninha', em: '2026-11-10T10:00:05Z'}}};
  }});
  await abrir(pg); await aberta(pg);
  await pg.waitForSelector('.jc-item');
  ok('a conversa da Grazi aparece na lista da Shirley, com o nome de quem a abriu', /Dúvida do ITCMD/.test(await pg.textContent('#jc-lista')) && /Grazi/.test(await pg.textContent('#jc-lista')));
  await pg.click('.jc-item');
  await esperarResposta(pg, /RI continua exigindo/);
  ok('a Shirley lê a conversa inteira, com o autor de cada mensagem', /Grazi/.test(await pg.textContent('.jc-msg.user .jc-autor')));
  pg.__e.fila.push({corpo: texto('Continuando.')});
  await escrever(pg, 'E o registro?');
  await esperarResposta(pg, /Continuando/);
  const histEnviado = pg.__e.pedidos[0].corpo.mensagens;
  ok('ela continua a conversa da colega, que vai como histórico', histEnviado.length === 3 && histEnviado[0].content === 'Posso lavrar sem o ITCMD?');
  const msgs = Object.values((await pg.evaluate(() => window.__banco)).joaninha_mensagens.g1);
  ok('...e a mensagem nova fica assinada pela Shirley, na mesma conversa', msgs.length === 4 && msgs.some(m => m.autor === 'Shirley' && m.papel === 'user'));
  await pg.context().close();
}

diga('\n— Quando o servidor diz não —');
{
  const pg = await novaPagina();
  pg.__e.fila.push({status: 429, tipo: 'application/json', corpo: JSON.stringify({ok: false, codigo: 'teto', erro: 'O teto de consumo do mês (R$ 150,00) foi atingido.'})});
  await abrir(pg); await aberta(pg);
  await escrever(pg, 'oi');
  await pg.waitForSelector('#jc-erro', {state: 'visible'});
  ok('o aviso do teto aparece escrito, sem travar a tela', /teto de consumo/.test(await pg.textContent('#jc-erro')) && await pg.isEnabled('#jc-enviar'));
  pg.__e.fila.push({corpo: texto('Voltei.')});
  await escrever(pg, 'oi de novo');
  await esperarResposta(pg, /Voltei/);
  ok('dá para tentar de novo, e o aviso some', !(await pg.isVisible('#jc-erro')));
  pg.__e.fila.push({corpo: sse([{t: 'texto', d: 'Começo da resp'}, {t: 'erro', erro: 'A OpenAI não conseguiu responder agora.'}])});
  await escrever(pg, 'mais uma');
  await pg.waitForSelector('#jc-erro', {state: 'visible'});
  await pg.waitForTimeout(300);
  const msgsBanco = Object.values((await pg.evaluate(() => window.__banco)).joaninha_mensagens)[0];
  ok('erro no meio da resposta: o aviso aparece e o que já veio fica guardado', /OpenAI/.test(await pg.textContent('#jc-erro')) && Object.values(msgsBanco).some(m => /Começo da resp/.test(m.texto)));
  await pg.context().close();

  const pg2 = await novaPagina({antes: () => { window.__recusarLeitura = true; }});
  await abrir(pg2); await aberta(pg2);
  await pg2.waitForSelector('#jc-erro', {state: 'visible'});
  ok('banco que recusa a leitura do histórico: diz o motivo e onde está o passo (FIREBASE.md)', /FIREBASE\.md/.test(await pg2.textContent('#jc-erro')));
  await pg2.context().close();
}

diga('\n— Parar no meio —');
{
  const pg = await novaPagina();
  pg.__e.atraso = 2500; pg.__e.fila.push({corpo: texto('Resposta demorada.')});
  await abrir(pg); await aberta(pg);
  await escrever(pg, 'conte uma história longa');
  await pg.waitForFunction(() => document.querySelector('#jc-enviar').title === 'Parar');
  await pg.click('#jc-enviar');
  await pg.waitForFunction(() => document.querySelector('#jc-enviar').title === 'Enviar', null, {timeout: 3000});
  ok('o botão vira "Parar" enquanto gera e para sem mostrar erro', !(await pg.isVisible('#jc-erro')));
  ok('o que ela escreveu fica guardado; resposta nenhuma é inventada', (await respostas(pg)).length === 0);
  await pg.context().close();
}

diga('\n— Falar em vez de digitar —');
{
  const pg = await novaPagina();
  pg.__e.fila.push({corpo: texto('**Resumo:** dois casos em andamento 😊. Veja https://exemplo.com/x')});
  pg.__e.fila.push({corpo: texto('Segunda resposta falada.')});
  await abrir(pg); await aberta(pg);
  await pg.click('#jc-voz');
  ok('"Conversar por voz" liga o microfone e mostra o estado', await pg.evaluate(() => window.__sr && window.__sr.started === true) && await pg.isVisible('#jc-voz-estado'));
  await pg.evaluate(() => window.__ouvir('qual é o resumo do dia'));
  await esperarResposta(pg, /dois casos/);
  ok('o que ela falou vira pergunta — e o servidor sabe que é voz', pg.__e.pedidos[0].corpo.mensagens.at(-1).content === 'qual é o resumo do dia' && pg.__e.pedidos[0].corpo.voz === true);
  await pg.waitForFunction(() => window.__falou.length === 1);
  const falou = await pg.evaluate(() => window.__falou[0]);
  ok('a Joaninha responde em voz alta, sem símbolos, emoji nem endereço', /Resumo: dois casos em andamento/.test(falou) && !/[*]|😊|https?:/.test(falou), falou);
  await pg.waitForFunction(() => window.__srTotal >= 2, null, {timeout: 4000});
  ok('depois de falar, volta a ouvir (conversa contínua)', true);
  await pg.evaluate(() => window.__ouvir('e agora'));
  await esperarResposta(pg, /Segunda resposta falada/);
  await pg.waitForFunction(() => window.__falou.length === 2);
  ok('a segunda volta do ciclo funciona', true);
  await pg.click('#jc-voz-estado button');
  ok('"Parar conversa por voz" desliga o microfone e some com o aviso', await pg.evaluate(() => window.__sr.aborted === true) && !(await pg.isVisible('#jc-voz-estado')));
  await pg.context().close();

  const pg2 = await novaPagina();
  await abrir(pg2); await aberta(pg2);
  await pg2.click('#jc-ditar');
  await pg2.evaluate(() => window.__ouvir('preciso de uma resposta para o cliente'));
  ok('o microfone da caixa só dita: preenche o texto e não envia', (await pg2.inputValue('#jc-texto')) === 'preciso de uma resposta para o cliente' && pg2.__e.pedidos.length === 0);
  await pg2.click('#jc-voz');
  await pg2.evaluate(() => window.__sr.onerror({error: 'not-allowed'}));
  await pg2.waitForSelector('#jc-erro', {state: 'visible'});
  ok('microfone bloqueado: explica como liberar e desliga o modo voz', /bloqueou o microfone/.test(await pg2.textContent('#jc-erro')) && !(await pg2.isVisible('#jc-voz-estado')));
  await pg2.context().close();

  const pg3 = await novaPagina();
  await pg3.evaluate(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
  await abrir(pg3); await aberta(pg3);
  await pg3.click('#jc-voz');
  ok('navegador sem reconhecimento de voz: avisa, e o teclado continua valendo', /não tem reconhecimento de voz/.test(await pg3.textContent('#jc-erro')) && await pg3.isEnabled('#jc-texto'));
  await pg3.context().close();
}

diga('\n— Fechar e voltar ao painel pequeno —');
{
  const pg = await novaPagina();
  await abrir(pg); await aberta(pg);
  await pg.keyboard.press('Escape');
  ok('Esc fecha a conversa', !(await pg.isVisible('#jc-raiz.aberto')));
  await abrir(pg); await aberta(pg);
  await pg.click('[data-jc="rapido"]');
  ok('o botão ⚡ leva ao painel pequeno (Nota, Lembrete, Resumo…), que segue inteiro', !(await pg.isVisible('#jc-raiz.aberto')) && await pg.evaluate(() => window.__legadoForce === true && window.__legado === 1));
  await pg.evaluate(() => localStorage.setItem('joaninha_chat', 'antigo'));
  ok('a chave "antigo" devolve o clique ao desenho de antes', await pg.evaluate(() => window.JOANINHA_CHAT.ativo()) === false);
  await pg.evaluate(() => localStorage.removeItem('joaninha_chat'));
  ok('...e tirá-la reativa a conversa', await pg.evaluate(() => window.JOANINHA_CHAT.ativo()) === true);
  await pg.context().close();
}

diga('\n— O celular (iPhone 13) —');
{
  const pg = await novaPagina({contexto: {viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true}});
  pg.__e.fila.push({corpo: texto('Resposta no celular com um texto razoavelmente longo para quebrar linha na bolha e conferir que nada estoura a largura da tela do aparelho.')});
  await abrir(pg); await aberta(pg);
  await pg.waitForSelector('.jc-sug');
  const medidas = await pg.evaluate(() => {
    const j = document.getElementById('jc-janela').getBoundingClientRect(), t = document.getElementById('jc-texto').getBoundingClientRect(), l = document.querySelector('.jc-lado').getBoundingClientRect();
    return {largura: window.innerWidth, scroll: document.documentElement.scrollWidth, j: [j.left, j.right], composerFim: t.bottom, altura: window.innerHeight, ladoDireita: l.right};
  });
  ok('a conversa ocupa a tela, sem rolagem lateral', medidas.scroll <= medidas.largura && medidas.j[0] >= 0 && medidas.j[1] <= medidas.largura, JSON.stringify(medidas));
  ok('a caixa de texto cabe na tela', medidas.composerFim <= medidas.altura, JSON.stringify(medidas));
  ok('a lista de conversas fica escondida até pedir', medidas.ladoDireita <= 1);
  await pg.click('.jc-sug >> nth=0');
  await esperarResposta(pg, /celular/);
  const depois = await pg.evaluate(() => ({scroll: document.documentElement.scrollWidth, w: window.innerWidth, msg: Math.max(...[...document.querySelectorAll('.jc-msg')].map(m => m.getBoundingClientRect().right))}));
  ok('com mensagens na tela, nada passa da largura', depois.scroll <= depois.w && depois.msg <= depois.w, JSON.stringify(depois));
  await pg.click('[data-jc="barra"]');
  await pg.waitForTimeout(300);
  ok('o botão de menu abre a lista de conversas', (await pg.evaluate(() => document.querySelector('.jc-lado').getBoundingClientRect().left)) >= -1);
  const alvos = await pg.evaluate(() => [...document.querySelectorAll('.jc-btn,.jc-mic,.jc-enviar')].filter(b => b.offsetParent).map(b => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height)));
  ok('os botões são grandes o bastante para o dedo (≥ 34 px)', alvos.every(a => a >= 34), alvos.join(','));
  await pg.context().close();
}

await navegador.close();
servidor.close();
if (erros.length) {
  diga('\n' + erros.length + ' problema(s):');
  erros.forEach(e => diga('  - ' + e));
  process.exit(1);
}
diga('\nA conversa da Joaninha, na tela, passou.');
process.exit(0);
