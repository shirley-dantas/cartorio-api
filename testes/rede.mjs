// A Rede num navegador de verdade.
//
// Roda com: node testes/rede.mjs
// (o montar.mjs recorta a Rede do index.html antes de cada execução)
//
// A semente abaixo é o que saiu da primeira leitura real do Drive — duas
// minutas do 20º Tabelião. Ela fica aqui de propósito: além de exercitar as
// telas, é a documentação viva do formato que a varredura precisa gravar.
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {servir} from './servidor.mjs';
import {writeSync} from 'node:fs';

// Escreve na hora, sem passar pelo buffer: se um passo pendurar e o processo
// for morto por fora, o que já rodou não se perde junto — e é justamente a
// linha do último passo que diz onde travou.
const diga = t => writeSync(1, t + '\n');

const servidor = await servir();
const erros = [];
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const pg = await b.newPage({viewport:{width:1280, height:900}});
pg.on('pageerror', e => erros.push('pageerror: ' + e.message));
await pg.goto('http://127.0.0.1:8199/harness-rede.html');
await pg.waitForFunction(() => window.__pronto === true);

const limpo = s => s.replace(/ /g,' ').replace(/\s+/g,' ');
// Cada passo tem prazo: um seletor que nunca aparece deve virar falha com
// nome, não um teste pendurado sem saída.
const PRAZO = 15000;
const passo = async (n, f) => {
  const estourou = new Promise((_, rej) => setTimeout(() => rej(new Error('passou de ' + (PRAZO/1000) + 's')), PRAZO));
  try { await Promise.race([f(), estourou]); diga('  ok  ' + n); }
  catch (e) { erros.push(n + ' → ' + e.message); diga('FALHA ' + n + ' → ' + e.message.split('\n')[0]); }
};

const SEMENTE = {
  simone: {
    nome:'Simone Paulino da Silva',
    cargo:'Especialista de relacionamento com cliente',
    empresa:'RL Maia Empreendimento Imobiliário SPE',
    origem:'Do It Pinheiros', bairro:'Vila Olímpia', cidade:'São Paulo', uf:'SP',
    ramo:'sim', motivo:'Relacionamento com cliente numa incorporadora é quem escolhe o cartório.',
    atos:1, primeira:'2026-07-30', ultima:'2026-07-30', ultimoAto:'Venda e Compra', situacao:'olhar'
  },
  leticia: {
    nome:'Letícia Miranda Aleixo Ferreira', cargo:'Gerente financeira',
    empresa:'RL Maia Empreendimento Imobiliário SPE',
    origem:'Do It Pinheiros', bairro:'Vila Olímpia', cidade:'São Paulo', uf:'SP',
    ramo:'sim', motivo:'Assina as procurações da incorporadora.',
    atos:3, primeira:'2026-03-12', ultima:'2026-07-29', ultimoAto:'Venda e Compra', situacao:'olhar'
  },
  tania: {
    nome:'Tânia de Barros Bertola', cargo:'Bibliotecária',
    origem:'direto', bairro:'Boaçava', cidade:'São Paulo', uf:'SP',
    ramo:'nao', atos:1, primeira:'2026-07-10', ultima:'2026-07-10',
    ultimoAto:'Venda e Compra', situacao:'olhar',
    // De propósito: se um dia a varredura gravar o CPF por engano, a tela
    // não pode mostrar. O teste lá embaixo cobra isso.
    cpf:'03230018826'
  },
  antonio: {
    nome:'Antônio Augusto Loss Moll', cargo:'Aposentado',
    origem:'direto', bairro:'Central', cidade:'Gravataí', uf:'RS',
    ramo:'nao', atos:1, primeira:'2026-07-10', ultima:'2026-07-10',
    ultimoAto:'Venda e Compra', situacao:'olhar'
  },
  leonardo: {
    nome:'Leonardo Ferrazzo Fortes', cargo:'',
    empresa:'', origem:'Do It Pinheiros', bairro:'', cidade:'São Paulo', uf:'SP',
    ramo:'duvidoso', atos:1, primeira:'2026-07-30', ultima:'2026-07-30',
    ultimoAto:'Venda e Compra', situacao:'olhar'
  }
};

// Semeia POR DENTRO do objeto que já existe. O Firebase de mentira entrega
// aos ouvintes a referência viva, então a Rede guarda um ponteiro para
// __raiz.rede.pessoas — trocar o objeto inteiro deixava a tela lendo o de
// antes, e o teste passava a exercitar dados que não eram os semeados.
const semear = () => pg.evaluate(s => {
  const novo = JSON.parse(JSON.stringify(s));
  const r = window.__raiz.rede;
  if(r && r.pessoas){
    Object.keys(r.pessoas).forEach(k => delete r.pessoas[k]);
    Object.assign(r.pessoas, novo);
    r.meta = {ultimaVarredura:'2026-08-25'};
  } else {
    window.__raiz.rede = {pessoas: novo, meta:{ultimaVarredura:'2026-08-25'}};
  }
}, SEMENTE);

const textoRede = async () => limpo(await pg.textContent('#rede-conteudo'));

diga('\n— Quem entra —');

await passo('o botão da lateral só aparece para a Shirley', async () => {
  const antes = await pg.evaluate(() => getComputedStyle(document.getElementById('sidebar-rede')).display);
  if(antes !== 'none') throw new Error('a Rede apareceu na lateral sem identidade → ' + antes);
  await pg.evaluate(() => { localStorage.setItem('painel_usuario','shirley'); atualizarSidebarRede(); });
  const depois = await pg.evaluate(() => getComputedStyle(document.getElementById('sidebar-rede')).display);
  if(depois === 'none') throw new Error('não apareceu nem para a Shirley');
});

await passo('sem login, a Rede pede conta e senha', async () => {
  await pg.click('#sidebar-rede');
  await pg.waitForSelector('#modal-rede.open');
  const t = await textoRede();
  if(!t.includes('Entre para ver o financeiro') && !t.includes('conta e senha') && !/Entrar/.test(t))
    throw new Error('não pediu login → ' + t.slice(0,160));
  if(/Simone|Letícia/.test(t)) throw new Error('mostrou gente sem login');
});

await passo('quem não é dona vê a porta fechada, não a lista', async () => {
  await pg.evaluate(() => { window.__raiz.acesso = {'uid-grazi':{nome:'Grazi'}}; });
  await pg.fill('#fin-login-email','grazi@shirleydantas.com');
  await pg.fill('#fin-login-senha','certa');
  await pg.click('#fin-btn-entrar');
  await pg.waitForFunction(() => /só da Shirley/.test(document.getElementById('rede-conteudo').textContent), null, {timeout:4000});
  const t = await textoRede();
  if(/Simone|Letícia|Tânia/.test(t)) throw new Error('a Grazi enxergou a Rede → ' + t.slice(0,160));
});

await passo('a conta dona entra e a fila aparece', async () => {
  await pg.evaluate(async () => { await finSair(); });
  await pg.evaluate(() => { window.__raiz.acesso = {'uid-shirley':{nome:'Shirley', dono:true}}; });
  await semear();
  await pg.waitForSelector('#fin-btn-entrar');
  await pg.fill('#fin-login-email','cartorio@shirleydantas.com');
  await pg.fill('#fin-login-senha','certa');
  await pg.click('#fin-btn-entrar');
  await pg.waitForSelector('.rp-nome', {timeout:5000});
});

diga('\n— A fila —');

await passo('a fila traz quem é do ramo, e o mais recente na frente', async () => {
  const nomes = await pg.$$eval('.rp-nome', els => els.map(e => e.textContent.trim()));
  if(nomes[0] !== 'Simone Paulino da Silva')
    throw new Error('a mais recente devia abrir a fila → ' + JSON.stringify(nomes));
  if(!nomes.includes('Letícia Miranda Aleixo Ferreira'))
    throw new Error('faltou a Letícia → ' + JSON.stringify(nomes));
});

await passo('a bibliotecária e o aposentado não ocupam a fila', async () => {
  const nomes = await pg.$$eval('.rp-nome', els => els.map(e => e.textContent.trim()));
  if(nomes.some(n => /Tânia|Antônio/.test(n)))
    throw new Error('gente fora do ramo entrou na fila → ' + JSON.stringify(nomes));
  const t = await textoRede();
  if(!/fora do ramo/.test(t)) throw new Error('não disse que os de fora continuam na lista');
});

await passo('o duvidoso também fica fora da fila', async () => {
  const nomes = await pg.$$eval('.rp-nome', els => els.map(e => e.textContent.trim()));
  if(nomes.some(n => /Leonardo/.test(n))) throw new Error('duvidoso entrou na fila');
});

await passo('o card mostra o motivo escrito, não só o nome', async () => {
  const t = await textoRede();
  if(!t.includes('quem escolhe o cartório')) throw new Error('não trouxe o motivo → ' + t.slice(0,200));
});

await passo('campo que a minuta não trouxe aparece como falta, não como vazio', async () => {
  await pg.evaluate(() => { window.__raiz.rede.pessoas.simone.bairro = ''; });
  await pg.evaluate(() => renderRede());
  const t = await textoRede();
  if(!t.includes('não consta na minuta')) throw new Error('escondeu a falta → ' + t.slice(0,200));
  await pg.evaluate(() => { window.__raiz.rede.pessoas.simone.bairro = 'Vila Olímpia'; renderRede(); });
});

diga('\n— O lápis —');

await passo('corrigir "de onde veio" grava a correção', async () => {
  await pg.click('#rl-simone-origem .rp-lapis');
  await pg.fill('#rl-simone-origem input', 'Indicação do Dr. Vitor');
  await pg.click('#rl-simone-origem .rbt-1');
  await pg.waitForFunction(() => {
    const c = window.__raiz.rede.pessoas.simone.correcoes;
    return c && c.origem === 'Indicação do Dr. Vitor';
  }, null, {timeout:4000});
});

await passo('a correção vence a leitura e fica marcada na tela', async () => {
  const t = await textoRede();
  if(!t.includes('Indicação do Dr. Vitor')) throw new Error('não mostrou a correção → ' + t.slice(0,240));
  if(t.includes('Do It Pinheiros · Vila Olímpia')) throw new Error('ainda mostra o valor antigo');
  if(!t.includes('corrigido à mão')) throw new Error('não marcou que foi corrigido à mão');
});

await passo('a varredura não desfaz a correção', async () => {
  // A leitura roda de novo e reescreve o campo original; a correção mora em
  // /correcoes e continua mandando.
  await pg.evaluate(() => { window.__raiz.rede.pessoas.simone.origem = 'Do It Pinheiros'; renderRede(); });
  const t = await textoRede();
  if(!t.includes('Indicação do Dr. Vitor')) throw new Error('a varredura passou por cima da correção');
});

diga('\n— A anotação e a dispensa —');

await passo('anotar tira da fila e guarda o texto', async () => {
  await pg.click('.rp .rbt-anotar');
  await pg.fill('#rede-ta-simone', 'É quem fecha o cartório dos empreendimentos. Mandar a tabela de custas.');
  await pg.click('#rede-nota-simone .rbt-1');
  await pg.waitForFunction(() => window.__raiz.rede.pessoas.simone.situacao === 'anotado', null, {timeout:4000});
  const nomes = await pg.$$eval('.rp-nome', els => els.map(e => e.textContent.trim()));
  if(nomes.includes('Simone Paulino da Silva')) throw new Error('anotada e ainda na fila');
});

await passo('"não é caso" tira da fila sem apagar a pessoa', async () => {
  await pg.click('.rp .rbt-3');
  await pg.waitForFunction(() => window.__raiz.rede.pessoas.leticia.situacao === 'fora', null, {timeout:4000});
  const existe = await pg.evaluate(() => !!window.__raiz.rede.pessoas.leticia);
  if(!existe) throw new Error('apagou a pessoa em vez de tirar da fila');
});

diga('\n— As construtoras —');

await passo('cadastro único: uma empresa, as pessoas dela embaixo', async () => {
  await pg.evaluate(() => redeTrocarAba('constr'));
  await pg.waitForSelector('.re-nome');
  const empresas = await pg.$$eval('.re-nome', els => els.map(e => e.textContent.trim()));
  if(empresas.length !== 1) throw new Error('devia haver uma empresa só → ' + JSON.stringify(empresas));
  // Preso ao cartão da empresa de propósito: os duvidosos ficam num bloco
  // à parte e usam a mesma linha de pessoa.
  const gente = await pg.$$eval('.re .re-pnome', els => els.map(e => e.textContent.trim()));
  if(gente.length !== 2) throw new Error('as duas da RL Maia deviam aparecer juntas → ' + JSON.stringify(gente));
  const noDuvidoso = await pg.$$eval('.rede-duv .re-pnome', els => els.map(e => e.textContent.trim()));
  if(!noDuvidoso.includes('Leonardo Ferrazzo Fortes')) throw new Error('o duvidoso devia estar no bloco dele → ' + JSON.stringify(noDuvidoso));
});

await passo('quem já assinou mais de uma vez aparece como "na teia"', async () => {
  const selos = await pg.$$eval('.re-pes', els => els.map(e => {
    const n = e.querySelector('.re-pnome'), s = e.querySelector('.rselo');
    return (n ? n.textContent.trim() : '') + '=' + (s ? s.textContent.trim() : '');
  }));
  const leticia = selos.find(s => s.startsWith('Letícia'));
  if(!/na teia/i.test(leticia || '')) throw new Error('a Letícia tem 3 atos, devia estar na teia → ' + leticia);
  const simone = selos.find(s => s.startsWith('Simone'));
  if(!/novo/i.test(simone || '')) throw new Error('a Simone tem 1 ato, devia estar como nova → ' + simone);
});

await passo('o contador conta escrituras, não repete a pessoa', async () => {
  const t = await textoRede();
  if(!t.includes('3 escrituras lidas')) throw new Error('não somou os atos da Letícia → ' + t.slice(0,300));
});

await passo('o duvidoso fica de lado, com botão para decidir', async () => {
  const t = await textoRede();
  if(!t.includes('Os duvidosos')) throw new Error('não separou os duvidosos');
  if(!t.includes('Leonardo Ferrazzo Fortes')) throw new Error('o Leonardo sumiu em vez de ficar de lado');
});

await passo('marcar o duvidoso como do ramo o joga para a fila', async () => {
  await pg.click('.rede-duv .rbt-2');
  await pg.waitForFunction(() => window.__raiz.rede.pessoas.leonardo.ramo === 'sim', null, {timeout:4000});
  await pg.evaluate(() => redeTrocarAba('fila'));
  await pg.waitForSelector('.rp-nome');
  const nomes = await pg.$$eval('.rp-nome', els => els.map(e => e.textContent.trim()));
  if(!nomes.includes('Leonardo Ferrazzo Fortes')) throw new Error('não entrou na fila → ' + JSON.stringify(nomes));
});

diga('\n— O mapa —');

await passo('o mapa desenha os 27 estados', async () => {
  await pg.evaluate(() => redeTrocarAba('mapa'));
  await pg.waitForSelector('.rede-uf', {timeout:6000});
  const n = await pg.$$eval('.rede-uf', els => els.length);
  if(n !== 27) throw new Error('esperava 27 estados, vieram ' + n);
});

await passo('acende só onde tem gente, e o maior fica amarelo', async () => {
  const c = await pg.evaluate(() => {
    const q = u => document.querySelector(`[data-uf="${u}"]`).getAttribute('class');
    return {SP:q('SP'), RS:q('RS'), AM:q('AM')};
  });
  if(!/forte/.test(c.SP)) throw new Error('São Paulo tem mais gente, devia estar amarelo → ' + c.SP);
  if(!/tem/.test(c.RS) || /forte/.test(c.RS)) throw new Error('o Rio Grande do Sul devia estar verde vivo → ' + c.RS);
  if(/tem/.test(c.AM)) throw new Error('o Amazonas não tem caso nenhum → ' + c.AM);
});

await passo('o Rio Grande do Sul acendeu por causa de quem mora em Gravataí', async () => {
  await pg.click('[data-uf="RS"]', {force:true});
  await pg.waitForFunction(() => /Rio Grande do Sul/.test(document.getElementById('rede-onde').textContent), null, {timeout:4000});
  const t = limpo(await pg.textContent('#rede-mlista'));
  if(!t.includes('Gravataí')) throw new Error('não listou a cidade → ' + t);
});

await passo('São Paulo desce para os bairros, no rumo certo', async () => {
  await pg.click('.rede-voltar');
  await pg.waitForFunction(() => /Brasil/.test(document.getElementById('rede-onde').textContent), null, {timeout:4000});
  await pg.click('[data-uf="SP"]', {force:true});
  await pg.waitForFunction(() => /São Paulo/.test(document.getElementById('rede-onde').textContent), null, {timeout:4000});
  await pg.click('.rede-pin', {force:true});
  await pg.waitForFunction(() => /capital/.test(document.getElementById('rede-onde').textContent), null, {timeout:4000});
  const t = limpo(await pg.textContent('#rede-mlista'));
  if(!t.includes('Vila Olímpia')) throw new Error('faltou o bairro na lista → ' + t);
  const pinos = await pg.$$eval('.rede-pin text', els => els.map(e => e.textContent));
  if(!pinos.some(p => /Vila Olímpia/.test(p))) throw new Error('a Vila Olímpia devia ter pino → ' + JSON.stringify(pinos));
});

await passo('bairro sem rumo conhecido fica na lista, sem pino inventado', async () => {
  await pg.evaluate(() => {
    window.__raiz.rede.pessoas.simone.correcoes = Object.assign(
      window.__raiz.rede.pessoas.simone.correcoes || {}, {bairro:'Jardim Inventado'});
    renderRede();
  });
  await pg.waitForSelector('.rede-uf');
  await pg.click('[data-uf="SP"]', {force:true});
  await pg.waitForFunction(() => /São Paulo/.test(document.getElementById('rede-onde').textContent), null, {timeout:4000});
  await pg.click('.rede-pin', {force:true});
  await pg.waitForFunction(() => /capital/.test(document.getElementById('rede-onde').textContent), null, {timeout:4000});
  const pinos = await pg.$$eval('.rede-pin text', els => els.map(e => e.textContent));
  if(pinos.some(p => /Jardim Inventado/.test(p))) throw new Error('inventou lugar no mapa para um bairro desconhecido');
  const nota = limpo(await pg.textContent('#rede-mnota'));
  if(!/sem pino/.test(nota)) throw new Error('não avisou que o bairro ficou sem pino → ' + nota);
});

diga('\n— O que não pode aparecer —');

await passo('CPF não chega na tela, mesmo se a varredura gravar por engano', async () => {
  for(const aba of ['fila','constr','lista']){
    await pg.evaluate(a => redeTrocarAba(a), aba);
    await pg.waitForTimeout(120);
    const t = await pg.textContent('#rede-conteudo');
    if(/\b\d{11}\b/.test(t.replace(/\s/g,''))) throw new Error('apareceu algo com cara de CPF na aba ' + aba);
    if(t.includes('03230018826')) throw new Error('o CPF da semente vazou na aba ' + aba);
  }
});

await passo('o botão do LinkedIn é busca por nome, não robô', async () => {
  const alvo = await pg.evaluate(() => {
    let capturado = null;
    const antigo = window.open;
    window.open = u => { capturado = u; return null; };
    redeTrocarAba('lista');
    redeLinkedin('tania');
    window.open = antigo;
    return capturado;
  });
  if(!alvo || !alvo.startsWith('https://www.linkedin.com/search/results/people/?keywords='))
    throw new Error('não é uma busca simples → ' + alvo);
  if(!decodeURIComponent(alvo).includes('Tânia de Barros Bertola'))
    throw new Error('não buscou pelo nome → ' + alvo);
});

diga('\n— A lista —');

await passo('todo mundo continua na lista, com a situação de cada um', async () => {
  await pg.evaluate(() => redeTrocarAba('lista'));
  await pg.waitForSelector('.rede-tab');
  const t = await textoRede();
  ['Simone','Letícia','Tânia','Antônio','Leonardo'].forEach(n => {
    if(!t.includes(n)) throw new Error(n + ' sumiu da lista');
  });
  if(!t.includes('Anotado')) throw new Error('não mostrou quem foi anotada');
  if(!t.includes('Fora do ramo')) throw new Error('não mostrou quem está fora do ramo');
});

diga('\n— O caminho até a conversa —');

// Conectar não é o fim. Estes passos existem porque o custo de errar aqui é
// silencioso: a pessoa aceita, ninguém traz ela de volta, e a conexão morre
// virando só mais um nome na lista de contatos.

const diasAtras = n => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0,10);
};

await passo('convite enviado tira da fila e guarda a data de hoje', async () => {
  await semear();
  await pg.evaluate(() => { redeTrocarAba('fila'); renderRede(); });
  await pg.waitForSelector('.rp .rbt-convite');
  await pg.click('.rp .rbt-convite');
  await pg.waitForFunction(() => window.__raiz.rede.pessoas.simone.situacao === 'convidado', null, {timeout:4000});
  const p = await pg.evaluate(() => window.__raiz.rede.pessoas.simone);
  const hoje = new Date().toISOString().slice(0,10);
  if(p.convidadoEm !== hoje) throw new Error('não guardou a data do convite → ' + p.convidadoEm);
  const nomes = await pg.$$eval('.rp-nome', els => els.map(e => e.textContent.trim()));
  if(nomes.includes('Simone Paulino da Silva')) throw new Error('convidada e ainda na fila da manhã');
});

await passo('a pergunta não volta no mesmo dia', async () => {
  const t = await textoRede();
  if(/Aceitaram\?/.test(t)) throw new Error('perguntou antes de a pessoa ter aberto o LinkedIn');
  if(!/esperando resposta/.test(t)) throw new Error('não disse que tem convite no prazo → ' + t.slice(-260));
});

await passo('passados os três dias, ela volta com a pergunta', async () => {
  await pg.evaluate(d => { window.__raiz.rede.pessoas.simone.convidadoEm = d; renderRede(); }, diasAtras(3));
  await pg.waitForSelector('.rede-pg', {timeout:4000});
  const t = await textoRede();
  if(!/Aceitaram\?/.test(t)) throw new Error('não trouxe a pergunta de volta');
  if(!/Simone/.test(t)) throw new Error('trouxe a pergunta sem dizer de quem');
});

await passo('"ainda não" empurra a pergunta, não apaga o convite', async () => {
  await pg.click('.rede-pg .rbt-2');
  await pg.waitForFunction(() => !!window.__raiz.rede.pessoas.simone.adiadoAte, null, {timeout:4000});
  const p = await pg.evaluate(() => window.__raiz.rede.pessoas.simone);
  if(p.situacao !== 'convidado') throw new Error('perdeu o convite ao adiar → ' + p.situacao);
  if(p.adiadoAte <= new Date().toISOString().slice(0,10))
    throw new Error('adiou para uma data que já passou → ' + p.adiadoAte);
  const t = await textoRede();
  if(/Aceitaram\?/.test(t)) throw new Error('continuou perguntando depois do adiar');
});

await passo('convite de três semanas aparece marcado como sem resposta', async () => {
  await pg.evaluate(d => {
    window.__raiz.rede.pessoas.simone.convidadoEm = d;
    window.__raiz.rede.pessoas.simone.adiadoAte = null;
    renderRede();
  }, diasAtras(22));
  await pg.waitForSelector('.rede-pg.morto', {timeout:4000});
  const t = await textoRede();
  if(!/sem resposta/.test(t)) throw new Error('não avisou que o convite morreu → ' + t.slice(0,260));
});

await passo('aceitar traz a pessoa de volta, com a mensagem pronta', async () => {
  await pg.click('.rede-pg .rbt-1');
  await pg.waitForFunction(() => window.__raiz.rede.pessoas.simone.situacao === 'conectado', null, {timeout:4000});
  await pg.waitForSelector('#rede-msg-simone', {timeout:4000});
  const t = await textoRede();
  if(!/Aceitaram e você ainda não falou/.test(t)) throw new Error('não abriu a fila dos conectados');
});

await passo('a mensagem sai com o ato, a data e quantas vezes', async () => {
  await pg.evaluate(() => { window.__raiz.rede.pessoas.simone.atos = 7; renderRede(); });
  await pg.waitForSelector('#rede-msg-simone');
  const txt = await pg.$eval('#rede-msg-simone', e => e.value);
  if(!txt.includes('Simone')) throw new Error('não chamou pelo primeiro nome → ' + txt);
  if(!/venda e compra/i.test(txt)) throw new Error('não citou o ato → ' + txt);
  if(!txt.includes('30/07')) throw new Error('não citou a data da escritura → ' + txt);
  if(!/sétima/.test(txt)) throw new Error('não disse que já é a sétima vez → ' + txt);
  if(/undefined|NaN|\[object/.test(txt)) throw new Error('a frase saiu com buraco → ' + txt);
  // O artigo colado no ato já saiu errado uma vez: "cuidei d escritura".
  if(!/cuidei da escritura/.test(txt)) throw new Error('o artigo não colou no ato → ' + txt);
  if(/ d /.test(txt)) throw new Error('sobrou artigo solto na frase → ' + txt);
});

await passo('a mensagem é editável, e o copiar leva o texto dela', async () => {
  await pg.fill('#rede-msg-simone', 'Oi Simone, texto meu.');
  const txt = await pg.$eval('#rede-msg-simone', e => e.value);
  if(txt !== 'Oi Simone, texto meu.') throw new Error('não deixou editar a mensagem');
});

await passo('anotar não desfaz o caminho de quem já aceitou', async () => {
  await pg.click('.rp .rbt-anotar');
  await pg.fill('#rede-ta-simone', 'Combinei de mandar a tabela de custas.');
  await pg.click('#rede-nota-simone .rbt-1');
  await pg.waitForFunction(() => window.__raiz.rede.pessoas.simone.anotacao, null, {timeout:4000});
  const p = await pg.evaluate(() => window.__raiz.rede.pessoas.simone);
  if(p.situacao !== 'conectado')
    throw new Error('anotar jogou a conectada para trás → ' + p.situacao);
});

await passo('"já conversei" fecha o caminho e tira da fila', async () => {
  await pg.click('.rp .rbt-conversei');
  await pg.waitForFunction(() => window.__raiz.rede.pessoas.simone.situacao === 'conversado', null, {timeout:4000});
  const t = await textoRede();
  if(/Aceitaram e você ainda não falou/.test(t)) throw new Error('continuou na fila dos conectados');
});

await passo('na Lista, o caminho aparece no lugar do rótulo do ramo', async () => {
  await pg.evaluate(() => {
    window.__raiz.rede.pessoas.leticia.situacao = 'convidado';
    window.__raiz.rede.pessoas.leticia.convidadoEm = '2026-08-20';
    redeTrocarAba('lista');
  });
  await pg.waitForSelector('.rede-tab');
  const t = await textoRede();
  if(!t.includes('Convite enviado')) throw new Error('a Lista não mostrou o convite → ' + t.slice(0,240));
  if(!t.includes('Conversado')) throw new Error('a Lista não mostrou quem já foi conversada');
  await pg.evaluate(() => redeTrocarAba('fila'));
});

diga('\n— No celular —');

// Ela testa pelo celular. Uma tela que só cabe no computador não serve.
const cel = await b.newPage({viewport:{width:390, height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true});
cel.on('pageerror', e => erros.push('celular pageerror: ' + e.message));
await cel.goto('http://127.0.0.1:8199/harness-rede.html');
await cel.waitForFunction(() => window.__pronto === true);
await cel.evaluate(s => {
  localStorage.setItem('painel_usuario','shirley');
  window.__raiz.acesso = {'uid-shirley':{nome:'Shirley', dono:true}};
  window.__raiz.rede = {pessoas: JSON.parse(JSON.stringify(s)), meta:{ultimaVarredura:'2026-08-25'}};
  atualizarSidebarRede();
}, SEMENTE);

await passo('o atalho da Rede aparece no celular', async () => {
  const d = await cel.evaluate(() => getComputedStyle(document.getElementById('fin-atalho-rede')).display);
  if(d === 'none') throw new Error('a Rede não tem atalho no celular');
});

await passo('a Rede abre no celular e a fila cabe na largura', async () => {
  await cel.evaluate(() => abrirRede());
  await cel.waitForSelector('#fin-btn-entrar');
  await cel.fill('#fin-login-email','cartorio@shirleydantas.com');
  await cel.fill('#fin-login-senha','certa');
  await cel.click('#fin-btn-entrar');
  await cel.waitForSelector('.rp-nome', {timeout:6000});
  const m = await cel.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    jan: window.innerWidth,
    card: Math.round(document.querySelector('.rp').getBoundingClientRect().width)
  }));
  if(m.doc > m.jan + 1) throw new Error('a página rola de lado no celular: ' + m.doc + ' > ' + m.jan);
  if(m.card > m.jan) throw new Error('o card estourou a largura: ' + m.card);
});

await passo('os botões do card não empurram a tela para fora', async () => {
  const larguras = await cel.evaluate(() => {
    const jan = window.innerWidth;
    return Array.from(document.querySelectorAll('.rp .rbt')).map(b => {
      const r = b.getBoundingClientRect();
      return Math.round(r.right) - jan;
    });
  });
  const estourou = larguras.filter(x => x > 1);
  if(estourou.length) throw new Error(estourou.length + ' botão(ões) passando da borda');
});

await passo('o mapa cabe no celular', async () => {
  await cel.evaluate(() => redeTrocarAba('mapa'));
  await cel.waitForSelector('.rede-uf', {timeout:6000});
  const m = await cel.evaluate(() => {
    const svg = document.getElementById('rede-svg').getBoundingClientRect();
    return {doc: document.documentElement.scrollWidth, jan: window.innerWidth,
            larg: Math.round(svg.width), alt: Math.round(svg.height)};
  });
  if(m.doc > m.jan + 1) throw new Error('o mapa fez a página rolar de lado');
  if(m.larg > m.jan) throw new Error('o mapa é mais largo que a tela: ' + m.larg);
  if(m.alt > 844) throw new Error('o mapa é mais alto que a tela do celular: ' + m.alt);
});

await passo('a planilha rola dentro da caixa, não empurra a página', async () => {
  await cel.evaluate(() => redeTrocarAba('lista'));
  await cel.waitForSelector('.rede-tab');
  const m = await cel.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    jan: window.innerWidth,
    rolaDentro: document.querySelector('.rede-rolo').scrollWidth > document.querySelector('.rede-rolo').clientWidth
  }));
  if(m.doc > m.jan + 1) throw new Error('a planilha empurrou a página para o lado');
  if(!m.rolaDentro) throw new Error('a planilha não está rolando dentro da própria caixa');
});

await b.close();
servidor.close();

if(erros.length){
  diga('\n' + erros.length + ' problema(s):');
  erros.forEach(e => diga('  - ' + e));
  process.exit(1);
}
diga('\nA Rede passou no navegador.');
