// A conversa da Joaninha, sem navegador: o que não pode depender de a tela estar bonita.
//
// Roda com: node testes/joaninha-chat-puro.mjs
//
// Markdown que nunca vira HTML perigoso, o texto que vai para a voz, as ferramentas do
// painel (que usam as funções que já existem) e a conferência de que o index.html está
// ligado do jeito certo — a ponte, o clique, o botão do card e nenhuma chave à vista.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {writeSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const require = createRequire(import.meta.url);
const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const J = require(join(RAIZ, 'joaninha-chat.js'));
const diga = t => writeSync(1, t + '\n');
const erros = [];
const ok = (n, cond, detalhe) => {
  if (cond) { diga('  ok  ' + n); return; }
  erros.push(n + (detalhe ? ' → ' + detalhe : ''));
  diga('FALHA ' + n + (detalhe ? ' → ' + detalhe : ''));
};

diga('\n— O texto da IA nunca vira HTML —');
{
  const ataques = [
    '<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '**oi** <b onmouseover=x>', '[clique](javascript:alert(1))',
    '"><svg/onload=alert(1)>', '`<iframe src=//evil>`', 'https://exemplo.com/a?x=<script>'
  ];
  ataques.forEach(a => {
    const h = J.mdSeguro(a);
    const semTagsNossas = h.replace(/<\/?(p|strong|em|code|ul|ol|li)>/g, '').replace(/<a href="https?:\/\/[^"<>]*" target="_blank" rel="noopener noreferrer">[^<]*<\/a>/g, '');
    ok('neutraliza: ' + a.slice(0, 30), !/<[a-z!\/]/i.test(semTagsNossas), h);
  });
  ok('negrito, itálico e código funcionam', J.mdSeguro('**forte** e *leve* e `x`') === '<p><strong>forte</strong> e <em>leve</em> e <code>x</code></p>', J.mdSeguro('**forte** e *leve* e `x`'));
  ok('listas viram listas', J.mdSeguro('- a\n- b') === '<ul><li>a</li><li>b</li></ul>' && J.mdSeguro('1. a\n2. b') === '<ol><li>a</li><li>b</li></ol>');
  ok('endereço http vira link seguro (nova aba, sem referrer)', /rel="noopener noreferrer"/.test(J.mdSeguro('veja https://exemplo.com/x')));
  ok('"javascript:" nunca vira link', !/href="javascript/i.test(J.mdSeguro('[clique](javascript:alert(1)) javascript:alert(1)')));
  ok('o [nome] da mensagem de cliente aparece como está', /\[nome\]/.test(J.mdSeguro('Oi, [nome]! Boa pergunta')));
  ok('texto vazio não quebra', J.mdSeguro('') === '' && J.mdSeguro(null) === '');
}

diga('\n— O que vai para a voz —');
{
  const f = J.limparParaFala('**Atenção:** veja https://exemplo.com/muito/longo?x=1 😊\n\n- primeiro item\n- segundo\n\nOi, [nome]!');
  ok('sem símbolos de formatação, emoji nem endereço', !/[*#`]|😊|https?:/.test(f), f);
  ok('o endereço vira "o link" e o [nome] vira algo que se fala', /o link/.test(f) && /o nome do cliente/.test(f) && !/\[nome\]/.test(f), f);
  ok('quebras de linha viram pausa', !/\n/.test(f));
}

diga('\n— O que vai à API —');
{
  const lista = [
    {papel: 'assistant', texto: 'sobra do começo'}, {papel: 'user', texto: 'oi'}, {papel: 'assistant', texto: 'olá'},
    {papel: 'acao', texto: 'Anotado'}, {papel: 'user', texto: 'e agora?'}
  ];
  const m = J.mensagensParaApi(lista, 30);
  ok('só gente e Joaninha; as ações ficam de fora; começa por "user"', m.length === 3 && m[0].role === 'user' && m.every(x => x.role === 'user' || x.role === 'assistant'), JSON.stringify(m));
  ok('respeita o limite, e o corte nunca começa por resposta', J.mensagensParaApi(lista, 2).length === 1 && J.mensagensParaApi(lista, 2)[0].role === 'user');
}

// ── As ferramentas, com um painel de mentira ──
const casos = {
  c1: {id: 'c1', nome: 'ANA PAULA — compra e venda', tipo: 'Compra e venda', status: 'prioridade', dep: 'Falta documentos', resp: 'shirley', obs: 'x'.repeat(5000),
    documentos: {d1: {nome: 'matricula.pdf', tipoDocumento: 'MATRICULA_IMOVEL', texto: 'M'.repeat(40000)}, d2: {nome: 'rg_ana.jpg', tipoDocumento: 'RG_CNH', pessoa: 'Ana', texto: 'RG ANA'}, d3: {nome: 'rg_jose.jpg', tipoDocumento: 'RG_CNH', pessoa: 'José', texto: 'RG JOSÉ'}, d4: {nome: 'sem_leitura.pdf'}}},
  c2: {id: 'c2', nome: 'BRUNO — inventário', status: 'critico', dep: 'Minutando', resp: 'grazi'},
  c3: {id: 'c3', nome: 'CARLA — concluída', status: 'emdia', concluido: true}
};
const feito = {nota: [], lembrete: [], concluir: [], foco: [], reedicao: []};
const P = {
  casos: () => casos, focos: () => [{id: 'f', text: 'Prioridade A', done: false}, {id: 'g', text: 'Feita', done: true}],
  lembretes: () => ({l1: {texto: 'Ligar', quando: '2026-11-12T14:00:00Z', casoId: 'c1'}, l2: {texto: 'Feito', feito: true, quando: '2026-11-01T10:00:00Z'}}),
  resumo: () => ({emAndamento: 2}), insights: () => ['sinal'], diasParado: () => 3,
  buscar: q => ({casosEnc: Object.values(casos).filter(c => c.nome.toLowerCase().includes(String(q).toLowerCase())), focosEnc: []}),
  orcamentoDoCaso: id => id === 'c1' ? {versao: 1, status: 'enviado', data: '2026-11-04', resultado: {totais: {total: 100}, despesas: [], tributos: []}, entrada: {}} : null,
  gravarNota: async (t, a) => feito.nota.push([t, a]), criarLembrete: async l => feito.lembrete.push(l),
  concluirLembrete: async k => feito.concluir.push(k), adicionarFoco: async t => feito.foco.push(t),
  abrirReedicao: async (id, i) => { feito.reedicao.push([id, i]); return true; }
};
const F = J.criarFerramentas(P);

diga('\n— As ferramentas de leitura —');
{
  let r = JSON.parse(await F.listar_casos({}));
  ok('listar_casos traz só os ativos por padrão', r.total === 2 && r.casos.every(c => !c.concluido));
  r = JSON.parse(await F.listar_casos({incluir_concluidos: true}));
  ok('...e os concluídos quando pedido', r.total === 3);
  r = JSON.parse(await F.listar_casos({responsavel: 'grazi'}));
  ok('filtra por responsável', r.total === 1 && r.casos[0].id === 'c2');
  r = JSON.parse(await F.listar_casos({busca: 'inventario'}));
  ok('a busca ignora acento e caixa', r.total === 1 && r.casos[0].id === 'c2');
  r = JSON.parse(await F.listar_casos({etapa: 'falta documentos'}));
  ok('filtra por etapa sem depender de caixa', r.total === 1 && r.casos[0].id === 'c1');

  r = JSON.parse(await F.obter_caso({caso_id: 'c1'}));
  ok('obter_caso traz documentos como índice — sem despejar o texto', r.documentos.length === 4 && r.documentos[0].caracteres_de_texto === 40000 && !JSON.stringify(r).includes('MMMMMMMM'));
  ok('...corta as observações compridas', r.observacoes.length <= 3001);
  ok('...diz que há orçamento (e o total em centavos)', r.orcamento && r.orcamento.total_centavos === 100);
  ok('caso que não existe vira instrução, não erro', /Não achei esse caso/.test(await F.obter_caso({caso_id: 'zzz'})));

  r = JSON.parse(await F.ler_documento_caso({caso_id: 'c1', documento: 'matricula'}));
  ok('ler_documento acha pelo nome e corta em 12 mil por padrão', r.texto.length === 12000 && r.cortado === true && r.texto_completo_no_card === 40000);
  r = JSON.parse(await F.ler_documento_caso({caso_id: 'c1', documento: 'MATRICULA_IMOVEL', max_caracteres: 999999}));
  ok('o máximo nunca passa de 30 mil, mesmo se pedirem mais', r.texto.length === 30000);
  ok('nome ambíguo pede um nome mais específico, em vez de escolher', /Mais de um documento combina/.test(await F.ler_documento_caso({caso_id: 'c1', documento: 'rg'})));
  ok('acha pela pessoa também', JSON.parse(await F.ler_documento_caso({caso_id: 'c1', documento: 'josé'})).texto === 'RG JOSÉ');
  ok('documento sem leitura diz que não foi lido', /ainda não foi lido/.test(await F.ler_documento_caso({caso_id: 'c1', documento: 'sem_leitura'})));
  ok('documento que não existe é dito, não inventado', /Nenhum documento/.test(await F.ler_documento_caso({caso_id: 'c1', documento: 'testamento'})));

  r = JSON.parse(await F.resumo_do_dia());
  ok('resumo_do_dia traz números, sinais e só o foco pendente', r.numeros.emAndamento === 2 && r.foco_do_dia_pendente.length === 1 && r.foco_do_dia_pendente[0] === 'Prioridade A');
  r = JSON.parse(await F.listar_lembretes());
  ok('listar_lembretes traz só os pendentes, com o id e o caso', r.length === 1 && r[0].id === 'l1' && /ANA/.test(r[0].caso));
  r = JSON.parse(await F.consultar_orcamento({caso_id: 'c1'}));
  ok('consultar_orcamento devolve a conta e avisa que é em centavos', r.totais.total === 100 && r.valores_em === 'centavos');
  ok('caso sem orçamento: diz que não tem', /não tem orçamento/.test(await F.consultar_orcamento({caso_id: 'c2'})));
  ok('nada de ferramenta lendo financeiro ou rede', !Object.keys(F).some(k => /financ|rede|salario/i.test(k)));
  ok('nada de ferramenta que altere orçamento', !Object.keys(F).some(k => /orcamento/.test(k) && !/^consultar_/.test(k)));
}

diga('\n— As ferramentas que escrevem (já confirmadas pela tela) —');
{
  ok('adicionar_nota usa a mesma função de gravar nota do painel, no caso certo', (await F.adicionar_nota({texto: 'ligar amanhã', caso_id: 'c1'})) && feito.nota[0][0] === 'ligar amanhã' && feito.nota[0][1].tipo === 'caso' && feito.nota[0][1].id === 'c1');
  await F.adicionar_nota({texto: 'solta'});
  ok('sem caso, anota no Foco do dia', feito.nota[1][1].tipo === 'foco');
  ok('nota para caso que não existe não grava nada', /nada foi anotado/.test(await F.adicionar_nota({texto: 'x', caso_id: 'zzz'})) && feito.nota.length === 2);
  ok('nota vazia não grava', /vazio/.test(await F.adicionar_nota({texto: '  '})) && feito.nota.length === 2);
  await F.criar_lembrete({texto: 'Ligar para o Bruno', quando: '2026-11-12T14:30:00-03:00', caso_id: 'c2'});
  ok('criar_lembrete grava em ISO, com o caso', feito.lembrete[0].quando === '2026-11-12T17:30:00.000Z' && feito.lembrete[0].casoId === 'c2');
  ok('data inválida não cria lembrete', /não é válida/.test(await F.criar_lembrete({texto: 'x', quando: 'amanhã cedo'})) && feito.lembrete.length === 1);
  await F.concluir_lembrete({lembrete_id: 'l1'});
  ok('concluir_lembrete usa o id', feito.concluir[0] === 'l1');
  ok('lembrete inexistente não conclui nada', /Não achei/.test(await F.concluir_lembrete({lembrete_id: 'nao'})) && feito.concluir.length === 1);
  await F.adicionar_foco({texto: 'Prioridade B'});
  ok('adicionar_foco', feito.foco[0] === 'Prioridade B');
  const r = await F.preparar_reedicao_minuta({caso_id: 'c1', instrucao: 'Corrigir o estado civil da compradora'});
  ok('preparar_reedicao abre a tela com a instrução — e diz que NADA foi gerado', feito.reedicao[0][1] === 'Corrigir o estado civil da compradora' && /NADA foi gerado/.test(r));
}

diga('\n— O que a confirmação mostra —');
{
  const d = J.descreverAcao('adicionar_nota', {texto: 'oi', caso_id: 'c1'}, P);
  ok('a nota diz em que caso vai e deixa o texto editável', /ANA PAULA/.test(d.titulo) && d.editavel === 'texto');
  ok('a reedição da minuta avisa que nada é gerado agora', /Nada é gerado agora/.test(J.descreverAcao('preparar_reedicao_minuta', {caso_id: 'c1', instrucao: 'x'}, P).aviso));
  ok('o lembrete mostra a data em horário de Brasília', /12\/11\/2026/.test(J.descreverAcao('criar_lembrete', {texto: 'x', quando: '2026-11-12T14:30:00-03:00'}, P).titulo));
  ok('concluir mostra qual lembrete', /Ligar/.test(J.descreverAcao('concluir_lembrete', {lembrete_id: 'l1'}, P).detalhe));
}

diga('\n— O index.html está ligado do jeito certo —');
{
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8');
  const chat = readFileSync(join(RAIZ, 'joaninha-chat.js'), 'utf8');
  ok('carrega o módulo da conversa', /<script src="joaninha-chat\.js"><\/script>/.test(html));
  ok('a ponte existe e entrega as funções que gravam', /window\.JOANINHA_PONTE=\{/.test(html) && /gravarNota,criarLembrete/.test(html));
  ok('o miolo de "salvar nota" foi só movido: o botão antigo continua chamando', /await gravarNota\(corpo,alvo\);/.test(html) && /await criarLembrete\(\{texto,quando,casoId\}\);/.test(html));
  const ponte = html.slice(html.indexOf('window.JOANINHA_PONTE={'), html.indexOf('// ── Clicar na Joaninha abre a conversa ampla'));
  const proibidas = /fin(Conta|Salvar|Lanc\w*|MeuSalario|Destrancar|CriarCofre|Cofre\w*|Dsr\w*|Partes\w*)|rede[A-Z]\w*|orc(Salvar|Gravar|Novo|Duplicar|Excluir|Mudar)\w*|ref\(db,\s*['"`](financeiro|rede|orcamentos)/;
  ok('a ponte NÃO entrega nada de dinheiro, de Rede nem de escrita em orçamento', !proibidas.test(ponte), (ponte.match(proibidas) || [''])[0]);
  ok('só orçamento de leitura passa pela ponte', /orcamentoDoCaso:/.test(ponte) && !/orcNovo|orcSalvar|orcDuplicar/.test(ponte));
  ok('o clique sem argumento abre a conversa; `true` continua sendo o painel pequeno', /if\(force===undefined&&chat&&chat\.ativo\(\)\)\{chat\.alternar\(\);return;\}/.test(html));
  ok('o botão da Joaninha está no card', /onclick="joaninhaConversarDoCaso\('\$\{c\.id\}'\)"/.test(html));
  ok('os caminhos antigos que abrem o painel pequeno seguem chamando com `true`', /window\.toggleJoaninhaPainel\(true\)/.test(html) && /toggleJoaninhaPainel\(true\)/.test(html));
  ok('nenhuma chave nem endereço da OpenAI no navegador', !/sk-[A-Za-z0-9]{10}|api\.openai\.com|OPENAI_API_KEY/.test(html + chat));
  ok('o navegador só fala com o servidor do painel', /\/api\/perguntar-joaninha\?acao=chat/.test(chat) && !/https:\/\/api\./.test(chat));
  ok('a resposta da IA nunca entra por innerHTML sem passar por mdSeguro/esc', !/innerHTML\s*=\s*[^;]*\b(m\.texto|textoFinal|parcial)\b(?![^;]*(mdSeguro|esc))/.test(chat));
}

if (erros.length) {
  diga('\n' + erros.length + ' problema(s):');
  erros.forEach(e => diga('  - ' + e));
  process.exit(1);
}
diga('\nA conversa da Joaninha, sem navegador, passou.');
