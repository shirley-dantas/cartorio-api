// A peneira do Radar, sem internet e sem navegador.
//
// Roda com: node testes/radar-triagem.mjs
//
// Aqui mora a parte que não pode depender de o modelo ter lembrado da regra
// naquela manhã: o guarda-corpo que rebaixa item de dispensa sem contrapartida
// e impede notícia de virar 🔴. E também a conferência da carga inicial da
// base — as ressalvas que a pesquisa deixou em aberto (a numeração 117.1 ×
// 119.1, a LC 227/2026 contra o Tema 1.113) não podem sumir dela em silêncio.
import {createRequire} from 'node:module';
import {writeSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const require = createRequire(import.meta.url);
const AQUI = dirname(fileURLToPath(import.meta.url));
const {hojeEmSP, soOTexto, lerJson, conferirItem, contar, chaveDoTema} =
  require(join(AQUI, '..', 'lib', 'radar-triagem.js'));
const {BASE_REGRAS_INICIAL} = require(join(AQUI, '..', 'lib', 'base-regras-inicial.js'));
const {FONTES_RADAR, TERMOS_RADAR} = require(join(AQUI, '..', 'lib', 'radar-fontes.js'));
const {RADAR_SYSTEM_PROMPT} = require(join(AQUI, '..', 'lib', 'radar-prompt.js'));

const diga = t => writeSync(1, t + '\n');
const erros = [];
const ok = (n, cond, detalhe) => {
  if (cond) { diga('  ok  ' + n); return; }
  erros.push(n + (detalhe ? ' → ' + detalhe : ''));
  diga('FALHA ' + n + (detalhe ? ' → ' + detalhe : ''));
};

diga('\n— O relógio —');
{
  // 03h UTC do dia 27 ainda é dia 26 em São Paulo. Sem isto, a varredura
  // gravaria no dia seguinte e o Jornal abriria vazio.
  const madrugada = new Date('2026-08-27T02:30:00Z');
  ok('03h UTC ainda é o dia anterior em São Paulo',
     hojeEmSP(madrugada) === '2026-08-26', hojeEmSP(madrugada));
  ok('meio-dia UTC já é o mesmo dia',
     hojeEmSP(new Date('2026-08-27T12:00:00Z')) === '2026-08-27');
}

diga('\n— A peneira do HTML —');
{
  const html = `<html><head><style>.a{color:red}</style><script>var x=1;<\/script></head>
    <body><!-- comentário --><div>Provimento&nbsp;CGJ</div><p>n&#186; 17</p>
    <br>ITCMD &amp; ITBI</body></html>`;
  const t = soOTexto(html);
  ok('o script e o style não entram no texto', !/var x|color:red/.test(t), t);
  ok('o comentário não entra', !/coment/.test(t), t);
  ok('o conteúdo continua lá', /Provimento CGJ/.test(t) && /ITCMD & ITBI/.test(t), t);
  ok('a entidade numérica vira caractere', /nº 17/.test(t), t);
  ok('página vazia devolve texto vazio', soOTexto('') === '' && soOTexto(null) === '');
}

diga('\n— O JSON da IA —');
{
  ok('JSON limpo passa', lerJson('{"resumo":"oi"}').resumo === 'oi');
  ok('JSON em cerca de código passa igual',
     lerJson('```json\n{"resumo":"oi"}\n```').resumo === 'oi');
  ok('conversa antes e depois não atrapalha',
     lerJson('Claro! {"resumo":"oi"} Espero ter ajudado.').resumo === 'oi');
  let caiu = false;
  try { lerJson('não tenho JSON nenhum'); } catch (e) { caiu = /não devolveu JSON/.test(e.message); }
  ok('texto sem JSON vira erro com nome', caiu);
}

diga('\n— O guarda-corpo da triagem —');
{
  // A regra que o ITCMD escreveu: dispensa sem contrapartida não pode passar
  // por resolvida, por mais confiante que a IA tenha vindo.
  const solto = conferirItem({
    selo:'🔴', especie:'decisao', confirmado:true,
    titulo:'ITCMD deixa de ser exigido para lavrar inventário',
    oQueMuda:'A escritura pode ser lavrada sem a guia paga.'
  });
  ok('dispensa sem contrapartida vira aplicação parcial', solto.parcial === true);
  ok('e diz o que falta conferir', /continua exigido/.test(solto.aConfirmar || ''), solto.aConfirmar);

  const inteiro = conferirItem({
    selo:'🔴', especie:'decisao', confirmado:true,
    titulo:'ITCMD deixa de ser exigido para lavrar inventário',
    oQueMuda:'A escritura pode ser lavrada sem a guia paga.',
    oQueNaoMuda:'O Registro de Imóveis continua exigindo o ITCMD.'
  });
  ok('dispensa com contrapartida passa inteira', inteiro.parcial === false && !inteiro.aConfirmar);
  ok('e continua 🔴', inteiro.selo === '🔴');

  const noticia = conferirItem({
    selo:'🔴', especie:'noticia', titulo:'Portal diz que vem provimento novo',
    oQueMuda:'Nada ainda.'
  });
  ok('notícia nunca sobe a 🔴', noticia.selo === '🟠', noticia.selo);
  ok('e fica marcada como por confirmar', noticia.parcial === true);

  const torto = conferirItem({selo:'🟣', especie:'palpite', titulo:'x'});
  ok('selo que não existe cai no 🟢', torto.selo === '🟢', torto.selo);
  ok('espécie que não existe cai em notícia', torto.especie === 'noticia', torto.especie);
  ok('confirmado só é verdade se vier verdade', torto.confirmado === false);
  ok('etapas viram lista mesmo sem vir nenhuma', Array.isArray(torto.etapas));

  // "não é mais necessário" é outra maneira de dizer dispensa, e a mais
  // comum em manchete.
  const outraForma = conferirItem({
    selo:'🟠', especie:'norma', titulo:'CND não é mais exigida na compra e venda',
    oQueMuda:'Deixa de ser pedida no balcão.'
  });
  ok('"não é mais exigida" também é dispensa', outraForma.parcial === true);

  const c = contar([{selo:'🔴'},{selo:'🔴'},{selo:'🟠'},{selo:'🟢'},{selo:'⚪'}]);
  ok('a contagem separa as quatro faixas',
     c.muda === 2 && c.breve === 1 && c.saber === 1 && c.fora === 1, JSON.stringify(c));
}

diga('\n— A chave do tema —');
{
  ok('acento não cria tema novo', chaveDoTema('Certidões') === chaveDoTema('certidoes'));
  ok('barra e ponto não passam (o Firebase recusaria)',
     !/[\/.$#\[\]]/.test(chaveDoTema('a/b.c$d#e[f]')), chaveDoTema('a/b.c$d#e[f]'));
  ok('não sobra hífen nas pontas', chaveDoTema('  ITCMD!  ') === 'itcmd', chaveDoTema('  ITCMD!  '));
}

diga('\n— A carga inicial da base —');
{
  const temas = Object.keys(BASE_REGRAS_INICIAL);
  ok('os seis temas pesquisados estão lá', temas.length === 6, temas.join(', '));
  ok('a chave de cada tema é chave válida de Firebase',
     temas.every(t => chaveDoTema(t) === t), temas.filter(t => chaveDoTema(t) !== t).join(', '));

  for (const t of temas) {
    const d = BASE_REGRAS_INICIAL[t];
    ok(t + ': tem título e resumo', !!(d.titulo && d.resumo));
    ok(t + ': diz o que fazer na mesa', Array.isArray(d.naMesa) && d.naMesa.length > 0);
    ok(t + ': cita fundamento', Array.isArray(d.fundamentos) && d.fundamentos.length > 0);
  }

  // As três ressalvas que a pesquisa deixou em aberto. Some uma delas e a
  // Joaninha passa a responder como se o ponto estivesse pacificado.
  const certidoes = JSON.stringify(BASE_REGRAS_INICIAL['certidoes-dispensa']);
  ok('a divergência 117.1 × 119.1 está declarada',
     /117\.1/.test(certidoes) && /119\.1/.test(certidoes));
  ok('o Provimento CGJ 17/2026 aparece como não confirmado',
     /não confirmado|Não confirmado/.test(certidoes) && /17\/2026/.test(certidoes));

  const iptu = JSON.stringify(BASE_REGRAS_INICIAL['iptu-atos']);
  ok('a LC 227/2026 aparece como não pacificada contra o Tema 1.113',
     /227\/2026/.test(iptu) && /1\.113/.test(iptu) && /não está pacificada|em aberto/i.test(iptu));

  // O ITCMD é o caso que deu origem ao critério: as duas etapas precisam
  // estar na base, com situações diferentes.
  const itcmd = BASE_REGRAS_INICIAL['itcmd-inventario'];
  const etapas = itcmd.etapas.map(e => e.situacao);
  ok('o ITCMD guarda as duas etapas com situações diferentes',
     itcmd.etapas.length === 2 && etapas[0] !== etapas[1], JSON.stringify(etapas));
  ok('e diz que o registro continua exigindo',
     /continua exigido/.test(etapas.join(' ')), etapas.join(' '));
  ok('a mensagem de cliente aprovada está guardada',
     /Registro de Imóveis continua exigindo/.test(itcmd.mensagemCliente || ''));
}

diga('\n— As fontes —');
{
  ok('as dez fontes do plano estão na lista', FONTES_RADAR.length === 10, String(FONTES_RADAR.length));
  ok('nenhuma fonte repete id',
     new Set(FONTES_RADAR.map(f => f.id)).size === FONTES_RADAR.length);
  ok('toda fonte é https', FONTES_RADAR.every(f => f.url.startsWith('https://')));
  const alerta = FONTES_RADAR.filter(f => !f.primaria).map(f => f.id);
  ok('ANOREG e CNB são fontes de alerta, não primárias',
     alerta.includes('anoregsp') && alerta.includes('cnbsp'), alerta.join(', '));
  ok('o filtro do Diário Oficial tem os nove termos', TERMOS_RADAR.length === 9);
}

diga('\n— O prompt —');
{
  const p = RADAR_SYSTEM_PROMPT;
  ok('manda diferenciar notícia de norma', /Notícia não é norma/.test(p));
  ok('proíbe dizer que está liberado sem dizer o que continua exigido',
     /continua exigido/.test(p) && /está liberado/.test(p));
  ok('traz o critério de competência e etapas',
     /Competência/.test(p) && /Etapas/.test(p));
  ok('traz as quatro faixas', /🔴/.test(p) && /🟠/.test(p) && /🟢/.test(p) && /⚪/.test(p));
  ok('traz a memória das alterações', /Memória/.test(p) && /já reportado/i.test(p));
  ok('traz o alerta operacional', /Alerta operacional/i.test(p));
  ok('proíbe inventar número de ato', /Nunca invente número/.test(p));
  ok('manda marcar aplicação parcial quando não der para confirmar',
     /aplicação parcial — confirmar/.test(p));
  ok('diz que dia sem novidade é resultado legítimo',
     /não invente item para preencher/.test(p));
}

if (erros.length) {
  diga('\n' + erros.length + ' problema(s):');
  erros.forEach(e => diga('  - ' + e));
  process.exit(1);
}
diga('\nA peneira do Radar passou.');
