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
  // 4.176,24 + 2.833,28 (registro com matrícula) + 80,14 + 76,54 + 9.056,01
  if(!/16\.222,21/.test(total)) throw new Error('total inesperado: ' + total);
});

await passo('a taxa adicional é perguntada, e trava o orçamento até responder', async () => {
  const perg = await pg.textContent('.orc-perguntas');
  if(!/taxa adicional/i.test(perg)) throw new Error('não perguntou pela taxa: ' + perg);
  const rot = await pg.textContent('.orc-total-rot');
  if(!/[Ee]stimativa/.test(rot)) throw new Error('deixou passar como definitivo: ' + rot);
});

await passo('respondido "sim", os R$ 300 entram no total', async () => {
  await pg.evaluate(() => orcMudarDespesa('taxaAdicional', true));
  // Com os R$ 300,00 é o orçamento que ela conferiu à mão, linha por linha.
  await pg.waitForFunction(() => /16\.522,21/.test(document.querySelector('.orc-total-num').textContent));
});

await passo('a memória mostra faixa, item e fundamento de cada linha', async () => {
  await pg.evaluate(() => orcAlternarMemoria());
  await pg.waitForSelector('.orc-memoria');
  const m = await pg.textContent('.orc-memoria');
  if(!/Faixa l/.test(m)) throw new Error('não mostrou a faixa: ' + m.slice(0, 300));
  if(!/Item da tabela: 1\.1/.test(m)) throw new Error('não mostrou o item da escritura');
  if(!/Item da tabela: 12/.test(m)) throw new Error('não mostrou o item da prenotação');
  if(!/Alíquota: 3%/.test(m)) throw new Error('não mostrou a alíquota do ITBI');
  if(!/até 01\/01\/2027/.test(m)) throw new Error('não mostrou a vigência da tabela');
  if(!/registro com matrícula/i.test(m)) throw new Error('não disse de que coluna do registro veio o número');
});

await passo('o CHECK FINAL fecha sem travar em nada', async () => {
  const c = await pg.textContent('.orc-check');
  if(!/Vigência conferida/.test(c)) throw new Error('sem a linha da vigência');
  const travando = await pg.$$eval('.orc-check-linha.falta .orc-check-nome', ns => ns.map(n => n.textContent));
  if(travando.length) throw new Error('ficou travado em: ' + travando);
  const t = await pg.textContent('.orc-total-rot');
  if(!/[Cc]onferido/.test(t)) throw new Error('não fechou como conferido: ' + t);
});

await passo('as duas certidões de matrícula têm o porquê colado na linha', async () => {
  const c = await pg.textContent('.orc-check');
  if(!/duas certidões, de propósito/i.test(c))
    throw new Error('o CHECK não explica as duas certidões: ' + c.slice(0, 400));
  // E a explicação inteira mora na memória, junto da linha que ela explica.
  await pg.evaluate(() => { if(!document.querySelector('.orc-memoria')) orcAlternarMemoria(); });
  await pg.waitForSelector('.orc-memoria');
  const m = await pg.textContent('.orc-memoria');
  if(!/começar o trabalho/.test(m)) throw new Error('a memória não explica as duas certidões');
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
  // 2.833,28 + 300,00 = 3.133,28 — o mesmo número do papel dela
  if(!/3\.133,28/.test(registro[1])) throw new Error('a taxa não entrou no registro: ' + registro[1]);
  if(linhas.some(l => /adicional|taxa/i.test(l[0]))) throw new Error('a taxa ganhou linha própria');
});

// Abrir a memória sem fechá-la sem querer: ela pode já estar aberta de um
// passo anterior, e `orcAlternarMemoria` alterna — foi assim que este teste se
// pendurou esperando um elemento que ele mesmo tinha acabado de esconder.
const abrirMemoria = async (pagina) => {
  await pagina.evaluate(() => { if(!document.querySelector('.orc-memoria')) orcAlternarMemoria(); });
  await pagina.waitForSelector('.orc-memoria');
};

await passo('as vagas entram por um botão, em qualquer compra e venda', async () => {
  // O caso real: compra e venda de um apartamento com duas vagas
  // individualizadas. São três imóveis — três registros, três prenotações e
  // três certidões —, mas uma escritura só, sobre o valor global.
  await pg.evaluate(() => orcVoltarDoCliente());
  await pg.waitForSelector('.orc-matriculas button');
  await pg.click('.orc-matriculas button');
  await pg.waitForSelector('.orc-matriculas .orc-linha-lista');
  const linhas = await pg.$$eval('.orc-matriculas .orc-linha-lista', l => l.length);
  if(linhas < 2) throw new Error('abriu com menos de duas linhas: ' + linhas);
  await pg.evaluate(() => {
    orcMudarItem('unidadesRegistro', 0, 'rotulo', 'Apartamento');
    orcMudarItem('unidadesRegistro', 0, 'valor', '261.867,16');
    orcMudarItem('unidadesRegistro', 1, 'rotulo', 'Vaga 1');
    orcMudarItem('unidadesRegistro', 1, 'valor', '20.000,00');
    orcMaisItem('unidadesRegistro');
    orcMudarItem('unidadesRegistro', 2, 'rotulo', 'Vaga 2');
    orcMudarItem('unidadesRegistro', 2, 'valor', '20.000,00');
  });
  await abrirMemoria(pg);
  const m = await pg.textContent('.orc-memoria');
  ['Apartamento', 'Vaga 1', 'Vaga 2'].forEach(n => {
    if(!new RegExp('Registro — ' + n).test(m)) throw new Error('faltou o registro de ' + n);
  });
  // A escritura e o ITBI não se mexem: continuam sobre o valor do negócio.
  if(!/4\.176,24/.test(m)) throw new Error('a escritura mudou quando não devia');
  if(!/9\.056,01/.test(m)) throw new Error('o ITBI mudou quando não devia');
});

await passo('três imóveis são três prenotações e três certidões', async () => {
  const m = await pg.textContent('.orc-memoria');
  if(!/Prenotações \(3 imóveis\)/.test(m)) throw new Error('cobrou uma prenotação só');
  if(!/Matrículas \(3 imóveis\)/.test(m)) throw new Error('cobrou uma certidão só');
  // 80,14 × 3 e 76,54 × 3
  if(!/240,42/.test(m)) throw new Error('a prenotação não multiplicou: ' + m.slice(0, 200));
  if(!/229,62/.test(m)) throw new Error('a certidão não multiplicou');
});

await passo('e tirando as vagas tudo volta ao imóvel único', async () => {
  await pg.evaluate(() => {
    orcTirarItem('unidadesRegistro', 2);
    orcTirarItem('unidadesRegistro', 1);
    orcTirarItem('unidadesRegistro', 0);
  });
  await pg.waitForFunction(() =>
    /16\.522,21/.test(document.querySelector('.orc-total-num').textContent));
  const m = await pg.textContent('.orc-memoria');
  if(/3 imóveis/.test(m)) throw new Error('continuou cobrando como três imóveis');
});

await passo('quando o banco recusa, o painel diz que NÃO salvou', async () => {
  // A regra do banco recusando a escrita é exatamente o que acontece antes de
  // as regras do Firebase serem publicadas. Antes, o painel dizia "salvo".
  await pg.evaluate(() => { window.__recusarEscrita = true; });
  await pg.evaluate(() => orcSalvar(true));
  await pg.waitForSelector('.orc-erro-salvar');
  const t = await pg.textContent('.orc-erro-salvar');
  if(!/Não salvou/.test(t)) throw new Error('não avisou que falhou: ' + t);
  if(!/regras do Firebase/.test(t)) throw new Error('não disse a causa provável: ' + t);
  const guardou = await pg.evaluate(() => Object.keys(orcEstado().orcamentos).length);
  if(guardou !== 0) throw new Error('gravou mesmo com o banco recusando');
  await pg.evaluate(() => { window.__recusarEscrita = false; });
});

await passo('quando o banco recusa a LEITURA, o painel não finge que está vazio', async () => {
  // É o que acontece com a página aberta antes de as regras serem publicadas:
  // o Firebase derruba a escuta e não tenta de novo. Antes, a tela ficava
  // vazia, como se não houvesse orçamento nenhum.
  // orcTentarDeNovo é o próprio caminho de religar a escuta — com a recusa
  // ligada, ele reproduz exatamente a página aberta antes das regras.
  await pg.evaluate(async () => { window.__recusarLeitura = true; await orcTentarDeNovo(); });
  await pg.evaluate(() => abrirOrcamentos('lista'));
  await pg.waitForSelector('#orc-conteudo .orc-erro-salvar');
  const t = await pg.textContent('#orc-conteudo');
  if(!/recusou a leitura/.test(t)) throw new Error('não disse que a leitura foi recusada: ' + t);
  if(!/Tentar de novo/.test(t)) throw new Error('não ofereceu o botão de tentar de novo');
});

await passo('e o "Tentar de novo" volta a ler assim que as regras entram', async () => {
  await pg.evaluate(async () => { window.__recusarLeitura = false; await orcTentarDeNovo(); });
  await pg.waitForFunction(() => Object.keys(orcEstado().conhecimento).length > 0);
  const t = await pg.textContent('#orc-conteudo');
  if(/recusou a leitura/.test(t)) throw new Error('continuou dizendo que não conseguia ler');
  await pg.evaluate(() => fecharOrcamentos());
});

await passo('salvo, o card mostra a versão 1 e o orçamento vira leitura', async () => {
  await pg.evaluate(() => {orcVoltarDoCliente(); orcSalvar(true);});
  await pg.waitForFunction(() => Object.keys(orcEstado().orcamentos).length === 1);
  await pg.evaluate(() => {document.getElementById('cartao-orc').innerHTML = orcFaixaDoCaso('c1');});
  const txt = await pg.textContent('#cartao-orc');
  if(!/versão 1/.test(txt)) throw new Error('o card não mostrou a versão: ' + txt);
  if(!/16\.522,21/.test(txt)) throw new Error('o card não mostrou o total: ' + txt);
});

await passo('o que foi para o banco não tem nenhum undefined', async () => {
  // O Firebase recusa a gravação inteira por causa de um só `undefined` em
  // qualquer profundidade — foi o que derrubou o primeiro orçamento de verdade.
  const achados = await pg.evaluate(() => {
    const anda = (v, c) => v === undefined ? [c]
      : Array.isArray(v) ? v.flatMap((x, i) => anda(x, c + '[' + i + ']'))
      : (v && typeof v === 'object') ? Object.keys(v).flatMap(k => anda(v[k], c + '.' + k))
      : [];
    return Object.values(orcEstado().orcamentos).flatMap(o => anda(o, o.id));
  });
  if(achados.length) throw new Error('undefined gravado em: ' + achados.slice(0, 5).join(', '));
  // E a tabela foi guardada pela identidade, sem arrastar as 48 faixas junto.
  const t = await pg.evaluate(() => Object.values(orcEstado().orcamentos)[0].resultado.tabelas.registro);
  if(t.faixas) throw new Error('gravou as faixas inteiras dentro do orçamento');
  if(!t.versao || !t.vigencia) throw new Error('gravou a tabela sem versão ou vigência: ' + JSON.stringify(t));
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
  if(!/3\.282,70/.test(t)) throw new Error('o registro não foi inteiro para a carteira: ' + t);
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
  if(!/REGISTRO COM MATRÍCULA/i.test(t)) throw new Error('a regra da coluna do registro não está na base');
  if(!/duas vezes/.test(t)) throw new Error('a duplicidade da certidão não está na base');
  if(!/01\/01\/2027/.test(t)) throw new Error('a vigência confirmada não está na base');
});

await passo('confirmar uma regra incerta a promove, e a promoção fica registrada', async () => {
  // A 🔴 que continua em aberto: os doze meses da pensão do divórcio.
  const antes = await pg.evaluate(() => orcEstado().conhecimento['pensao-doze-meses'].confianca);
  if(antes !== 'incerta') throw new Error('a regra não nasceu como incerta: ' + antes);
  await pg.evaluate(() => orcValidarRegra('pensao-doze-meses'));
  await pg.waitForFunction(() =>
    orcEstado().conhecimento['pensao-doze-meses'].confianca === 'confirmada');
  const quem = await pg.evaluate(() => orcEstado().conhecimento['pensao-doze-meses'].validadoPor);
  if(!quem) throw new Error('não guardou quem validou');
});

await passo('e o caminho de volta também funciona', async () => {
  await pg.evaluate(() => orcDuvidarRegra('pensao-doze-meses'));
  await pg.waitForFunction(() =>
    orcEstado().conhecimento['pensao-doze-meses'].confianca === 'incerta');
});

await passo('e uma regra que não está na base não vira registro pela metade', async () => {
  await pg.evaluate(() => orcValidarRegra('regra-que-nunca-existiu'));
  const criou = await pg.evaluate(() => 'regra-que-nunca-existiu' in orcEstado().conhecimento);
  if(criou) throw new Error('criou uma regra sem enunciado, já marcada como confirmada');
});

await passo('a aba Tabelas mostra a vigência e o teto de isenção do dia', async () => {
  await pg.evaluate(() => orcIrPara('tabelas'));
  await pg.waitForSelector('.orc-tab-bloco');
  const t = await pg.textContent('#orc-conteudo');
  // A vigência vive num campo: quem lê a tela vê o valor, e quem quiser
  // corrigir escreve por cima. Por isso a conferência é no value, não no texto.
  const vigencias = await pg.$$eval('.orc-tab-linha input', ins => ins.map(i => i.value));
  if(!vigencias.filter(v => /até 01\/01\/2027/.test(v)).length)
    throw new Error('não mostrou a vigência das tabelas: ' + JSON.stringify(vigencias));
  if(!/custas-2026/.test(t)) throw new Error('não mostrou a versão da tabela do registro');
  if(!/Faixas carregadas\s*48/.test(t)) throw new Error('não mostrou quantas faixas foram carregadas');
  if(!/Trava a partir de/.test(t)) throw new Error('não disse a partir de quando a tabela trava');
});

await passo('tabela vencida trava o orçamento em vez de sair com o número velho', async () => {
  const r = await pg.evaluate(() => orcCalcular({
    atoId:'compra-venda', data:'2027-06-01', valores:{transacao:30186716},
    imovelMunicipio:'São Paulo', imovelUf:'SP', flags:{},
    despesas:{prenotacao:true, matricula:true, taxaAdicional:false}}));
  if(r.definitivo !== false) throw new Error('deixou passar um ato fora da vigência');
  if(!r.alertas.some(a => /exercício novo/.test(a.texto)))
    throw new Error('não mandou procurar a tabela nova');
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
  await cel.evaluate(() => orcVerRegra('coluna-registro-com-matricula'));
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
