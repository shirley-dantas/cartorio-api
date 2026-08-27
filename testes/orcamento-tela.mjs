// O ambiente de Orçamentos num navegador de verdade.
//
// Roda com: node testes/orcamento-tela.mjs
// (o montar.mjs recorta o bloco do index.html antes de cada execução)
//
// A conta em si é conferida sem navegador, no testes/orcamento.mjs. Aqui o
// que se protege é o caminho da mão até o número:
//   - a faixa do card só aparece para quem entrou;
//   - a janela nasce com o ato reconhecido pelo tipo escrito no card;
//   - a taxa adicional é perguntada, e o orçamento não fecha sem resposta;
//   - a memória mostra faixa, item e fundamento de cada linha;
//   - o modo cliente não deixa escapar faixa, item nem hipótese;
//   - uma versão nova não come a anterior;
//   - "escritura assinada" nasce um lançamento com a PARTE DO TABELIÃO, não
//     com o total que a cliente paga;
//   - e tudo isso cabe num iPhone 13.
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {servir} from './servidor.mjs';
import {writeSync} from 'node:fs';

const diga = t => writeSync(1, t + '\n');
const servidor = await servir();
const erros = [];
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const pg = await b.newPage({viewport:{width:1280, height:900}});
pg.on('pageerror', e => erros.push('pageerror: ' + e.message));

await pg.goto('http://127.0.0.1:8199/harness-orcamento.html');
await pg.waitForFunction(() => window.__pronto === true);

const PRAZO = 15000;
const passo = async (n, f) => {
  const estourou = new Promise((_, rej) => setTimeout(() => rej(new Error('passou de ' + (PRAZO/1000) + 's')), PRAZO));
  try { await Promise.race([f(), estourou]); diga('  ok  ' + n); }
  catch (e) { erros.push(n + ' → ' + e.message); diga('FALHA ' + n + ' → ' + e.message.split('\n')[0]); }
};

// Entrar é o mesmo gesto nas duas telas, e precisa ser à prova de corrida: o
// botão só responde depois que o módulo terminou de subir, e clicar antes
// disso deixava o teste esperando por uma semente que nunca vinha.
const entrar = async (pagina) => {
  await pagina.evaluate(() => abrirFinanceiro());
  await pagina.waitForSelector('#fin-btn-entrar');
  await pagina.fill('#fin-login-email', 'cartorio@shirleydantas.com');
  await pagina.fill('#fin-login-senha', 'certa');
  for(let i = 0; i < 5; i++){
    await pagina.click('#fin-btn-entrar');
    try{
      await pagina.waitForFunction(
        () => Object.keys(orcEstado().conhecimento).length > 0, null, {timeout: 4000});
      await pagina.evaluate(() => fecharFinanceiro());
      return;
    }catch(e){ /* ainda não subiu — tenta de novo */ }
  }
  throw new Error('não consegui entrar no Financeiro');
};

// Um card de mentira, com o tipo escrito nele: é dele que a janela vai herdar.
await pg.evaluate(() => {
  window.casos = {c1: {id:'c1', nome:'TANIA — apartamento 1301',
    tipo:'Escritura de venda e compra', livro:'12', prenotacao:'88.777'}};
});

await passo('sem login, a faixa do card convida a entrar e não mostra valor', async () => {
  await pg.evaluate(() => {document.getElementById('cartao-orc').innerHTML = orcFaixaDoCaso('c1');});
  const txt = await pg.textContent('#cartao-orc');
  if(!/Entre no Financeiro/.test(txt)) throw new Error('não convidou a entrar: ' + txt);
  if(/R\$/.test(txt)) throw new Error('vazou valor sem login: ' + txt);
});

await passo('entrando, a faixa oferece o primeiro orçamento', async () => {
  await entrar(pg);
  await pg.evaluate(() => {document.getElementById('cartao-orc').innerHTML = orcFaixaDoCaso('c1');});
  const txt = await pg.textContent('#cartao-orc');
  if(!/Novo orçamento/.test(txt)) throw new Error('não ofereceu o novo: ' + txt);
});

await passo('a janela nasce com o ato lido do card e o cliente herdado', async () => {
  await pg.evaluate(() => orcNovoDoCaso('c1'));
  await pg.waitForSelector('#modal-orcamento-caso.open');
  const ato = await pg.$eval('#orc-caso-conteudo select', s => s.value);
  if(ato !== 'compra-venda') throw new Error('não reconheceu o ato: ' + ato);
  const herdado = await pg.textContent('.orc-herdado');
  if(!/TANIA/.test(herdado)) throw new Error('não herdou o cliente: ' + herdado);
  const regra = await pg.textContent('.orc-comoescreveu');
  if(!/1 ITBI/.test(regra)) throw new Error('não mostrou a regra de cobrança: ' + regra);
});

await passo('digitado o valor, o total aparece e bate com a tabela', async () => {
  await pg.evaluate(() => {
    orcMudarValor('transacao', '301.867,16');
    renderOrcamentoDoCaso();
  });
  await pg.waitForSelector('.orc-total-num');
  const total = await pg.textContent('.orc-total-num');
  // 4.176,24 + 2.723,02 + 79,16 + 75,60 + 9.056,01
  if(!/16\.110,03/.test(total)) throw new Error('total inesperado: ' + total);
});

await passo('a taxa adicional é perguntada, e trava o orçamento até responder', async () => {
  const perg = await pg.textContent('.orc-perguntas');
  if(!/taxa adicional/i.test(perg)) throw new Error('não perguntou pela taxa: ' + perg);
  const rot = await pg.textContent('.orc-total-rot');
  if(!/[Ee]stimativa/.test(rot)) throw new Error('deixou passar como definitivo: ' + rot);
});

await passo('respondido "sim", os R$ 300 entram no total', async () => {
  await pg.evaluate(() => orcMudarDespesa('taxaAdicional', true));
  await pg.waitForFunction(() => /16\.410,03/.test(document.querySelector('.orc-total-num').textContent));
});

await passo('a memória mostra faixa, item e fundamento de cada linha', async () => {
  await pg.evaluate(() => orcAlternarMemoria());
  await pg.waitForSelector('.orc-memoria');
  const m = await pg.textContent('.orc-memoria');
  if(!/Faixa l/.test(m)) throw new Error('não mostrou a faixa: ' + m.slice(0, 300));
  if(!/Item da tabela: 1\.1/.test(m)) throw new Error('não mostrou o item da escritura');
  if(!/Item da tabela: 12/.test(m)) throw new Error('não mostrou o item da prenotação');
  if(!/Alíquota: 3%/.test(m)) throw new Error('não mostrou a alíquota do ITBI');
  if(!/não declarada/.test(m)) throw new Error('escondeu que a vigência não veio no arquivo');
});

await passo('o CHECK FINAL trava na vigência e na taxa já respondida não trava', async () => {
  const c = await pg.textContent('.orc-check');
  if(!/Vigência conferida/.test(c)) throw new Error('sem a linha da vigência');
  const travando = await pg.$$eval('.orc-check-linha.falta .orc-check-nome', ns => ns.map(n => n.textContent));
  if(!travando.includes('Vigência conferida')) throw new Error('a vigência não travou: ' + travando);
  if(travando.includes('Taxa adicional perguntada')) throw new Error('a taxa continuou travando depois de respondida');
});

await passo('o modo cliente não deixa escapar faixa, item nem fundamento', async () => {
  await pg.evaluate(() => orcAlternarCliente());
  await pg.waitForSelector('.orc-cliente');
  const t = await pg.textContent('.orc-cliente');
  ['Faixa', 'Item da tabela', 'CHECK', 'hipótese', 'operacional', 'Fundamento']
    .forEach(p => {if(new RegExp(p, 'i').test(t)) throw new Error('vazou "' + p + '" para o cliente');});
  if(!/ESTIMATIVA DE CUSTOS/.test(t)) throw new Error('sem o título');
  if(!/sujeitos a atualização/.test(t)) throw new Error('sem a ressalva de valores estimados');
});

await passo('e a taxa adicional some da vista, somada ao registro', async () => {
  const linhas = await pg.$$eval('.orc-cli-tabela tbody tr',
    ts => ts.map(t => [...t.cells].map(c => c.textContent.trim())));
  const registro = linhas.find(l => /REGISTRO/.test(l[0]));
  if(!registro) throw new Error('sem a linha do registro');
  // 2.723,02 + 300,00 — e nenhuma linha dizendo "taxa"
  if(!/3\.023,02/.test(registro[1])) throw new Error('a taxa não entrou no registro: ' + registro[1]);
  if(linhas.some(l => /adicional|taxa/i.test(l[0]))) throw new Error('a taxa ganhou linha própria');
});

await passo('salvo, o card mostra a versão 1 e o orçamento vira leitura', async () => {
  await pg.evaluate(() => {orcVoltarDoCliente(); orcSalvar(true);});
  await pg.waitForFunction(() => Object.keys(orcEstado().orcamentos).length === 1);
  await pg.evaluate(() => {document.getElementById('cartao-orc').innerHTML = orcFaixaDoCaso('c1');});
  const txt = await pg.textContent('#cartao-orc');
  if(!/versão 1/.test(txt)) throw new Error('o card não mostrou a versão: ' + txt);
  if(!/16\.410,03/.test(txt)) throw new Error('o card não mostrou o total: ' + txt);
});

await passo('uma versão nova não come a anterior, e diz por que mudou', async () => {
  await pg.evaluate(() => {
    orcNovoDoCaso('c1');
    orcMudarValor('transacao', '330.000,00');
    orcMudarDespesa('taxaAdicional', true);
  });
  await pg.waitForSelector('.orc-comparacao');
  const cmp = await pg.textContent('.orc-comparacao');
  if(!/faixa l para a m/.test(cmp)) throw new Error('não explicou a mudança de faixa: ' + cmp);
  await pg.evaluate(() => orcSalvar(true));
  await pg.waitForFunction(() => Object.keys(orcEstado().orcamentos).length === 2);
  const versoes = await pg.evaluate(() => Object.values(orcEstado().orcamentos).map(o => o.versao).sort());
  if(String(versoes) !== '1,2') throw new Error('as versões não foram guardadas: ' + versoes);
});

await passo('"escritura assinada" leva a PARTE DO TABELIÃO para o Financeiro', async () => {
  await pg.evaluate(() => {
    const o = Object.values(orcEstado().orcamentos).find(x => x.versao === 2);
    orcParaFinanceiro(o.id);
    fecharFinanceiroDoCaso();
  });
  // A faixa do Financeiro no card é onde ela vê o resultado — e é ali que a
  // diferença entre "parte do tabelião" e "total que a cliente paga" aparece.
  // Faixa m da tabela de Notas: total R$ 4.594,65, parte do tabelião R$ 2.735,91.
  await pg.waitForFunction(() => {
    document.getElementById('cartao-orc').innerHTML = finFaixaDoCaso('c1');
    return /Ao tabelião/.test(document.getElementById('cartao-orc').textContent);
  });
  const t = await pg.textContent('#cartao-orc');
  if(!/2\.735,91/.test(t)) throw new Error('a parte do tabelião veio errada: ' + t);
  if(/4\.594,65/.test(t)) throw new Error('lançou o total da cliente como se fosse do tabelião: ' + t);
  if(!/3\.170,61/.test(t)) throw new Error('o registro não foi inteiro para a carteira: ' + t);
  if(!/na carteira/.test(t)) throw new Error('o registro não ficou na carteira: ' + t);
  const guardado = await pg.evaluate(() =>
    Object.values(orcEstado().orcamentos).find(x => x.versao === 2).lancamentoId);
  if(!guardado) throw new Error('o orçamento não guardou o lançamento que nasceu dele');
});

await passo('o ambiente lista as versões e a base de conhecimento nasce cheia', async () => {
  await pg.evaluate(() => {fecharOrcamentoDoCaso(); abrirOrcamentos('lista');});
  await pg.waitForSelector('.orc-versao');
  const n = await pg.$$eval('.orc-versao', v => v.length);
  if(n !== 2) throw new Error('esperava 2 versões na lista, vieram ' + n);
  await pg.evaluate(() => orcIrPara('conhecimento'));
  await pg.waitForSelector('.orc-regra');
  const t = await pg.textContent('#orc-conteudo');
  if(!/3\.133,28/.test(t)) throw new Error('a dúvida do registro do exemplo não está na base');
  if(!/vigência/i.test(t)) throw new Error('a pendência da vigência não está na base');
});

await passo('confirmar uma hipótese a promove, e a promoção fica registrada', async () => {
  await pg.evaluate(() => orcValidarRegra('matricula-item-11'));
  await pg.waitForFunction(() =>
    (orcEstado().conhecimento['matricula-item-11'] || {}).confianca === 'confirmada');
  const quem = await pg.evaluate(() => orcEstado().conhecimento['matricula-item-11'].validadoPor);
  if(!quem) throw new Error('não guardou quem validou');
});

await passo('declarada a vigência, o orçamento passa a fechar', async () => {
  await pg.evaluate(() => {
    orcIrPara('tabelas');
    orcSalvarCfg('vigenciaNotas', 'a partir de 01/01/2026');
    orcSalvarCfg('vigenciaRegistro', 'a partir de 01/01/2026');
  });
  await pg.waitForFunction(() => ORC_TABELA_NOTAS.vigencia !== null);
  const def = await pg.evaluate(() => orcCalcular({
    atoId:'compra-venda', valores:{transacao:30186716},
    imovelMunicipio:'São Paulo', imovelUf:'SP', flags:{},
    despesas:{prenotacao:true, matricula:true, taxaAdicional:false}}).definitivo);
  if(def !== true) throw new Error('continuou preso mesmo com a vigência declarada');
});

// ── E no celular, que é onde ela confere ──
const cel = await b.newPage({viewport:{width:390, height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true});
cel.on('pageerror', e => erros.push('pageerror (celular): ' + e.message));
await cel.goto('http://127.0.0.1:8199/harness-orcamento.html');
await cel.waitForFunction(() => window.__pronto === true);
await cel.evaluate(() => {
  window.casos = {c1: {id:'c1', nome:'TANIA — apartamento 1301', tipo:'Escritura de venda e compra'}};
});
await entrar(cel);

const naoEstoura = async (onde) => {
  const m = await cel.evaluate(() => ({doc: document.documentElement.scrollWidth, jan: window.innerWidth}));
  if(m.doc > m.jan + 1) throw new Error(onde + ' fez a página rolar de lado (' + m.doc + ' > ' + m.jan + ')');
};

await passo('a janela do orçamento cabe na tela do celular', async () => {
  await cel.evaluate(() => {
    orcNovoDoCaso('c1');
    orcMudarValor('transacao', '301.867,16');
    orcMudarDespesa('taxaAdicional', true);
    orcAlternarMemoria();
  });
  await cel.waitForSelector('.orc-memoria');
  await naoEstoura('a janela do orçamento');
  const largas = await cel.evaluate(() => {
    const jan = window.innerWidth;
    return [...document.querySelectorAll('#orc-caso-conteudo *')]
      .filter(e => e.getBoundingClientRect().right > jan + 1).length;
  });
  if(largas) throw new Error(largas + ' elemento(s) passando da borda');
});

await passo('o modo cliente cabe na tela do celular', async () => {
  await cel.evaluate(() => orcAlternarCliente());
  await cel.waitForSelector('.orc-cliente');
  await naoEstoura('o modo cliente');
});

await passo('o ambiente inteiro cabe na tela do celular', async () => {
  await cel.evaluate(() => {fecharOrcamentoDoCaso(); abrirOrcamentos('conhecimento');});
  await cel.waitForSelector('.orc-regra');
  await cel.evaluate(() => orcVerRegra('registro-do-exemplo'));
  await cel.waitForSelector('.orc-regra-corpo');
  await naoEstoura('o Conhecimento aprendido');
  await cel.evaluate(() => orcIrPara('tabelas'));
  await cel.waitForSelector('.orc-tab-bloco');
  await naoEstoura('as Tabelas');
});

await b.close();
servidor.close();

if(erros.length){
  diga('\n' + erros.length + ' problema(s):');
  erros.forEach(e => diga('  - ' + e));
  process.exit(1);
}
diga('\nOs Orçamentos passaram no navegador.');
