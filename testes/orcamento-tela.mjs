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

await passo('o bloco dos imóveis está sempre à vista, sem precisar caçar', async () => {
  await pg.evaluate(() => orcVoltarDoCliente());
  const t = await pg.textContent('#orc-caso-conteudo');
  if(!/Imóveis a registrar/.test(t)) throw new Error('o bloco não aparece');
  if(!/cobrado sobre .*um imóvel/s.test(t)) throw new Error('não diz sobre quantos imóveis está cobrando');
  if(!/Acrescentar imóvel/.test(t)) throw new Error('não oferece acrescentar imóvel');
});

await passo('as vagas entram em qualquer compra e venda', async () => {
  // O caso real: compra e venda de um apartamento com duas vagas
  // individualizadas. São três imóveis — três registros, três prenotações e
  // três certidões —, mas uma escritura só, sobre o valor global.
  await pg.click('button:has-text("Acrescentar imóvel")');
  await pg.waitForSelector('.orc-linha-lista');
  // A primeira linha nasce com o valor do negócio: acrescentar uma vaga é somar
  // uma linha, não redigitar o que já estava na tela.
  const primeiro = await pg.evaluate(() => orcEmEdicao_leitura().valores.unidadesRegistro[0]);
  if(primeiro.valor !== 30186716) throw new Error('a primeira linha não veio com o valor do negócio: ' + JSON.stringify(primeiro));
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

// O defeito que chegou à mesa dela: digitar o valor da vaga fazia o total lá
// embaixo subir, mas a linha logo abaixo dos campos — a que ela estava olhando
// — continuava dizendo "1 imóvel · somam R$ 301.867,16". Parecia que a soma
// não estava acontecendo. A tela inteira não pode se refazer a cada tecla (o
// cursor salta), então estes pedaços são trocados no lugar.
await passo('a soma dos imóveis acompanha a digitação, sem esperar a tela se refazer', async () => {
  const soma = () => pg.textContent('#orc-soma-unidadesRegistro');
  const agora = await soma();
  if(!/3 imóveis/.test(agora)) throw new Error('não contou os três: ' + agora);
  if(!/301\.867,16/.test(agora)) throw new Error('não somou os três: ' + agora);
  // Somando o valor do negócio, não há divergência a declarar.
  if(/valor do negócio/.test(agora)) throw new Error('inventou divergência onde não há: ' + agora);

  // E agora digitando de verdade, num input, sem redesenhar a tela.
  const campo = '.orc-linha-lista:nth-of-type(3) input:nth-of-type(2)';
  await pg.click(campo);
  await pg.fill(campo, '30.000,00');
  await pg.waitForFunction(() => /311\.867,16/.test(document.getElementById('orc-soma-unidadesRegistro').textContent));
  const depois = await soma();
  // Passou do valor do negócio: a linha tem de dizer os dois números.
  if(!/valor do negócio/.test(depois) || !/301\.867,16/.test(depois))
    throw new Error('não mostrou o valor do negócio ao lado da soma: ' + depois);
  // E o valor do negócio é o do negócio — não o da primeira matrícula, que é
  // o que `registros[0].base` passa a ser depois do desdobramento.
  if(/261\.867,16/.test(depois)) throw new Error('leu o valor da primeira matrícula como o do negócio: ' + depois);
  await pg.fill(campo, '20.000,00');
  await pg.waitForFunction(() => /301\.867,16/.test(document.getElementById('orc-soma-unidadesRegistro').textContent));
});

// O que o primeiro conserto NÃO pegou, e chegou à mesa dela como "a soma não
// funcionou": o ato "com vagas" pede a lista dele (`unidades`), e o inventário
// a dele (`imoveis`). Nenhuma das duas tinha soma — o conserto cobria só a
// lista do botão "Acrescentar imóvel". Onde há lista de imóveis, há soma.
await passo('a lista do ato "com vagas" também soma, e acompanha a digitação', async () => {
  await pg.evaluate(() => orcTrocarAto('compra-venda-vagas'));
  await pg.evaluate(() => {
    orcMudarItem('unidades', 0, 'rotulo', 'Apartamento');
    orcMudarItem('unidades', 0, 'valor', '261.867,16');
  });
  const soma = () => pg.textContent('#orc-soma-unidades');
  if(!/1 imóvel/.test(await soma())) throw new Error('não somou o primeiro: ' + await soma());
  await pg.evaluate(() => orcMaisItem('unidades'));
  // Digitando de verdade no input, que é o caminho dela.
  const campo = '.orc-linha-lista:nth-of-type(2) input:nth-of-type(2)';
  await pg.fill(campo, '40.000,00');
  await pg.waitForFunction(() => /301\.867,16/.test(document.getElementById('orc-soma-unidades').textContent));
  const t = await soma();
  if(!/2 imóveis/.test(t)) throw new Error('não contou os dois: ' + t);
  // Aqui a lista É o valor do negócio: não há divergência a inventar.
  if(/valor do negócio/.test(t)) throw new Error('inventou divergência onde a lista é a própria base: ' + t);
});

await passo('e o ato com vagas não ganha um segundo bloco de imóveis', async () => {
  const blocos = await pg.evaluate(() =>
    [...document.querySelectorAll('.orc-secao b')].map(x => x.textContent));
  if(blocos.filter(b => /Imóveis a registrar/.test(b)).length)
    throw new Error('duas listas de imóveis no mesmo formulário: ' + blocos.join(' / '));
});

await passo('o inventário também soma os imóveis dele', async () => {
  await pg.evaluate(() => orcTrocarAto('inventario'));
  await pg.evaluate(() => {
    orcMudarValor('monte', '500.000,00');
    orcMudarItem('imoveis', 0, 'rotulo', 'Casa');
    orcMudarItem('imoveis', 0, 'valor', '300.000,00');
    orcMaisItem('imoveis');
    orcMudarItem('imoveis', 1, 'rotulo', 'Terreno');
    orcMudarItem('imoveis', 1, 'valor', '200.000,00');
  });
  const t = await pg.textContent('#orc-soma-imoveis');
  if(!/2 imóveis/.test(t) || !/500\.000,00/.test(t)) throw new Error('não somou o inventário: ' + t);
  // O monte pode legitimamente não ser a soma dos imóveis — nada de alarme.
  if(/valor do negócio/.test(t)) throw new Error('inventou divergência no inventário: ' + t);
  // E a volta, para os testes seguintes continuarem no ato de sempre.
  await pg.evaluate(() => orcTrocarAto('compra-venda'));
  await pg.evaluate(() => orcMudarValor('transacao', '301.867,16'));
});

// O divórcio que ela trouxe em 28/08/2026: dois imóveis na partilha e duas
// pensões, uma por prazo em meses e outra por mês final. Ela já tinha a conta
// à mão — R$ 152.374,00 — e o painel tem de chegar no mesmo número.
await passo('a soma dos imóveis vira o valor total da partilha com um toque', async () => {
  await pg.evaluate(() => orcTrocarAto('divorcio-partilha'));
  await pg.evaluate(() => { orcMudarCampoTexto('data', '2026-08-28');
    orcMudarItem('imoveis', 0, 'rotulo', 'Apartamento');
    orcMudarItem('imoveis', 0, 'valor', '350.000,00');
    orcMaisItem('imoveis');
    orcMudarItem('imoveis', 1, 'rotulo', 'Casa de praia');
    orcMudarItem('imoveis', 1, 'valor', '150.000,00'); });
  const antes = await pg.textContent('#orc-soma-imoveis');
  if(!/500\.000,00/.test(antes)) throw new Error('não somou os dois imóveis: ' + antes);
  await pg.click('button:has-text("Usar como Valor total da partilha")');
  await pg.waitForFunction(() => /é o valor total da partilha/.test(
    document.getElementById('orc-soma-imoveis').textContent));
  const v = await pg.evaluate(() => orcEmEdicao_leitura().valores.totalPartilha);
  if(v !== 50000000) throw new Error('não despejou a soma no campo: ' + v);
  // E o botão some quando já não há o que despejar.
  const depois = await pg.textContent('#orc-soma-imoveis');
  if(/Usar como/.test(depois)) throw new Error('o botão continuou oferecendo o que já foi feito: ' + depois);
});

await passo('as duas pensões dela dão os R$ 152.374,00', async () => {
  await pg.evaluate(() => orcMudarFlag('temPensao', true));
  await pg.waitForSelector('.orc-pensao-linha');
  await pg.evaluate(() => { orcMudarPensao(0, 'salarios', '1'); orcMudarPensao(0, 'meses', '12'); });
  await pg.evaluate(() => orcMaisPensao());
  await pg.evaluate(() => orcMudarPensao(1, 'modo', 'ate'));
  await pg.evaluate(() => { orcMudarPensao(1, 'salarios', '2'); orcMudarPensao(1, 'ate', '2029-12'); });
  await pg.waitForFunction(() => /152\.374,00/.test(document.getElementById('orc-soma-pensao').textContent));
  const t = await pg.textContent('#orc-soma-pensao');
  if(!/19\.452,00/.test(t)) throw new Error('faltou a primeira parcela: ' + t);
  if(!/132\.922,00/.test(t)) throw new Error('faltou a segunda parcela: ' + t);
  if(!/41 meses/.test(t)) throw new Error('não contou os 41 meses: ' + t);
});

await passo('e sai UMA escritura, na faixa da soma', async () => {
  await abrirMemoria(pg);
  const m = await pg.textContent('.orc-memoria');
  if(!/com a pensão/.test(m)) throw new Error('a escritura não diz que inclui a pensão: ' + m.slice(0, 300));
  if(!/652\.374,00/.test(m)) throw new Error('a base não somou partilha + pensão: ' + m.slice(0, 400));
  // Duas escrituras deixariam duas faixas somadas — o erro que a regra evita.
  if(/Pensão —/.test(m)) throw new Error('a pensão saiu como escritura à parte: ' + m.slice(0, 300));
});

await passo('a pensão em parcelas cabe na tela do celular', async () => {
  await pg.setViewportSize({width: 390, height: 844});
  const estoura = await pg.evaluate(() => {
    const l = document.querySelector('.orc-pensao-linha');
    return l ? l.getBoundingClientRect().right > window.innerWidth + 1 : false;
  });
  if(estoura) throw new Error('a linha da pensão passou da largura do telefone');
  await pg.setViewportSize({width: 1280, height: 900});
  // e a volta, para os testes seguintes continuarem no ato de sempre
  await pg.evaluate(() => { orcMudarFlag('temPensao', false); orcTrocarAto('compra-venda');
    orcMudarValor('transacao', '301.867,16'); });
});

await passo('e a quantidade das despesas acompanha junto', async () => {
  const lidos = await pg.evaluate(() => ['qtdePrenotacao', 'qtdeMatricula'].map(c => ({
    n: document.getElementById('orc-qtde-' + c).value,
    rot: document.getElementById('orc-porimovel-' + c).textContent.trim()})));
  lidos.forEach(l => {
    if(l.n !== '3') throw new Error('a quantidade ficou parada em ' + l.n);
    if(!/3/.test(l.rot)) throw new Error('a etiqueta ficou parada: ' + l.rot);
  });
});

await passo('três imóveis são três prenotações e três certidões', async () => {
  const m = await pg.textContent('.orc-memoria');
  if(!/Prenotações \(3 imóveis\)/.test(m)) throw new Error('cobrou uma prenotação só');
  if(!/Matrículas \(3 imóveis\)/.test(m)) throw new Error('cobrou uma certidão só');
  // 80,14 × 3 e 76,54 × 3
  if(!/240,42/.test(m)) throw new Error('a prenotação não multiplicou: ' + m.slice(0, 200));
  if(!/229,62/.test(m)) throw new Error('a certidão não multiplicou');
});

await passo('dá para corrigir a quantidade de prenotações à mão', async () => {
  await pg.evaluate(() => orcMudarDespesaNum('qtdePrenotacao', '2'));
  await pg.waitForFunction(() => /160,42|160,28/.test(document.querySelector('.orc-memoria').textContent));
  const m = await pg.textContent('.orc-memoria');
  if(!/Prenotações \(2\)/.test(m)) throw new Error('não cobrou duas: ' + m.slice(0, 200));
  if(/Prenotações \(2 imóveis\)/.test(m)) throw new Error('disse "imóveis" para uma quantidade que não é a deles');
  await pg.evaluate(() => orcMudarDespesaNum('qtdePrenotacao', ''));
  await pg.waitForFunction(() => /Prenotações \(3 imóveis\)/.test(document.querySelector('.orc-memoria').textContent));
});

await passo('mexer no valor da taxa não redesenha a tela nem tira o foco', async () => {
  // Era o "bug" de digitar a taxa: cada tecla refazia a tela inteira e o cursor
  // saltava para fora do campo.
  const campo = '.orc-taxa-linha input';
  await pg.click(campo);
  await pg.evaluate(sel => { const el = document.querySelector(sel); el.dataset.marca = 'eu'; }, campo);
  await pg.type(campo, '5', {delay: 30});
  const sobreviveu = await pg.evaluate(sel => {
    const el = document.querySelector(sel);
    return {marca: el && el.dataset.marca, focado: document.activeElement === el};
  }, campo);
  if(sobreviveu.marca !== 'eu') throw new Error('o campo foi refeito no meio da digitação');
  if(!sobreviveu.focado) throw new Error('o campo perdeu o foco ao digitar');
  // E a tecla entrou de verdade na conta, não só no campo.
  const taxa = await pg.evaluate(() => orcEmEdicao_leitura().despesas.taxaAdicionalValor);
  if(taxa === 30000) throw new Error('digitou e a conta não mudou');
  // Devolve os R$ 300,00 para os passos seguintes acharem o total do papel dela.
  await pg.evaluate(() => orcMudarDespesaNum('taxaAdicionalValor', '300,00'));
  await pg.waitForFunction(() =>
    orcEmEdicao_leitura().despesas.taxaAdicionalValor === 30000);
});

await passo('a identificação da via é editável e vale mais que o nome do card', async () => {
  // A rua do imóvel, ou o nome do de cujus no inventário — o nome do card nem
  // sempre é o que a cliente precisa ler.
  await pg.evaluate(() => orcMudarIdentificacao('Rua das Palmeiras, 210 — apto 1301 e 2 vagas'));
  await pg.evaluate(() => orcAlternarCliente());
  await pg.waitForSelector('.orc-cliente');
  const t = await pg.textContent('.orc-cli-caso');
  if(!/Rua das Palmeiras/.test(t)) throw new Error('a via não usou a identificação: ' + t);
  if(/TANIA/.test(t)) throw new Error('continuou com o nome do card');
  await pg.evaluate(() => orcVoltarDoCliente());
});

await passo('e em branco ela volta a ser o nome do card', async () => {
  await pg.evaluate(() => orcMudarIdentificacao('   '));
  await pg.evaluate(() => orcAlternarCliente());
  await pg.waitForSelector('.orc-cliente');
  const t = await pg.textContent('.orc-cli-caso');
  if(!/TANIA/.test(t)) throw new Error('não voltou para o nome do card: ' + t);
  await pg.evaluate(() => {
    orcMudarIdentificacao('Rua das Palmeiras, 210');
    orcVoltarDoCliente();
  });
});

await passo('a via do cliente sai como imagem, para colar no WhatsApp', async () => {
  const img = await pg.evaluate(() => {
    const c = orcFolhaDoRascunho();
    return c ? {l: c.width, a: c.height, url: c.toDataURL('image/png').slice(0, 30)} : null;
  });
  if(!img) throw new Error('não desenhou');
  if(img.l !== 2000) throw new Error('largura inesperada: ' + img.l);
  if(img.a < 800 || img.a > 2400) throw new Error('altura fora do razoável: ' + img.a);
  if(!/^data:image\/png/.test(img.url)) throw new Error('não saiu PNG');
});

await passo('e tirando as vagas tudo volta ao imóvel único', async () => {
  await pg.evaluate(() => orcTirarTodasMatriculas());
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
  // E a identificação da via foi junto, para a versão guardar a sua.
  const ident = await pg.evaluate(() =>
    (Object.values(orcEstado().orcamentos)[0].entrada || {}).identificacao);
  if(ident !== 'Rua das Palmeiras, 210') throw new Error('a identificação não foi gravada: ' + ident);
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

// O imóvel em Extrema-MG. O ITBI é municipal e o painel foi buscar a alíquota
// — mas o que a busca traz é hipótese, e a escada de conhecimento vale aqui
// como vale para tudo: entra na conta, sai marcada, e o orçamento não fecha
// até ela conferir. A função da Vercel é fingida: aqui não há chave nem rede.
await passo('imóvel fora da Capital: o painel oferece buscar a alíquota', async () => {
  await pg.route('**/api/aliquota-municipal', route => route.fulfill({status: 200,
    contentType: 'application/json',
    body: JSON.stringify({encontrado: true, aliquota: 2, confianca: 'incerta',
      chave: 'itbi-extrema-mg', fundamento: 'Lei Municipal 1.234/2019, art. 5º',
      ressalva: 'Alíquota reduzida para a parcela financiada pelo SFH.',
      fontes: ['https://www.extrema.mg.gov.br/legislacao/lei-1234']})}));
  // Um orçamento novo, só deste cenário: os testes anteriores deixam
  // matrículas e taxa ligadas, e mexer neles aqui quebraria os de lá.
  await pg.evaluate(() => orcNovoDoCaso('c1'));
  await pg.waitForSelector('#modal-orcamento-caso.open');
  await pg.evaluate(() => { orcTrocarAto('compra-venda');
    orcMudarValor('transacao', '301.867,16');
    orcMudarDespesa('taxaAdicional', false);
    orcMudarCampoTexto('imovelMunicipio', 'Extrema');
    orcMudarCampoTexto('imovelUf', 'MG'); });
  const t = await pg.textContent('#orc-aliquotas');
  if(!/Buscar a alíquota/.test(t)) throw new Error('não ofereceu a busca: ' + t);
  if(!/municipal/.test(t)) throw new Error('não disse que o imposto é municipal: ' + t);
});

await passo('achada, ela entra na conta mas o orçamento NÃO fecha', async () => {
  await pg.click('button:has-text("Buscar a alíquota")');
  await pg.waitForFunction(() => /2%/.test(document.getElementById('orc-aliquotas').textContent));
  const t = await pg.textContent('#orc-aliquotas');
  if(!/ainda não conferida/.test(t)) throw new Error('não avisou que não foi conferida: ' + t);
  if(!/Lei Municipal 1\.234/.test(t)) throw new Error('não mostrou o fundamento: ' + t);
  if(!/extrema\.mg\.gov\.br/.test(t)) throw new Error('não mostrou a fonte: ' + t);
  if(!/SFH/.test(t)) throw new Error('engoliu a ressalva da fonte: ' + t);
  // 2% de 301.867,16 = 6.037,34 — o imposto entrou na conta com a alíquota
  // de lá, e não com os 3% da Capital (que dariam 9.056,01).
  await abrirMemoria(pg);
  const mem = await pg.textContent('.orc-memoria');
  if(!/6\.037,34/.test(mem)) throw new Error('o ITBI não saiu a 2%: ' + mem.slice(0, 400));
  if(/9\.056,01/.test(mem)) throw new Error('aplicou os 3% da Capital num imóvel de MG');
  // E o CHECK FINAL continua travado: número lido por máquina não fecha conta.
  const tela = await pg.evaluate(() => document.getElementById('orc-caso-conteudo').innerText);
  if(/TUDO CONFERIDO/i.test(tela)) throw new Error('fechou com alíquota não conferida — é o que não pode');
  if(!/Alíquota de fora da Capital/.test(tela)) throw new Error('o CHECK FINAL não citou a alíquota');
});

await passo('e a tabela continua sendo a de São Paulo, imóvel em MG ou não', async () => {
  const m = await pg.textContent('.orc-memoria');
  // Faixa l de Notas e faixa j do registro — exatamente as da Capital. Se um
  // dia alguém fizer a tabela viajar com o imóvel, isto quebra: é o ponto.
  if(!/4\.176,24/.test(m)) throw new Error('a escritura mudou por causa do estado do imóvel: ' + m.slice(0, 400));
  if(!/2\.833,28/.test(m)) throw new Error('o registro mudou por causa do estado do imóvel: ' + m.slice(0, 400));
});

await passo('conferida por ela, aí sim o orçamento fecha', async () => {
  await pg.click('button:has-text("Confere — pode usar")');
  await pg.waitForFunction(() => /conferida por você/.test(
    document.getElementById('orc-aliquotas').textContent));
  const tela = await pg.evaluate(() => document.getElementById('orc-caso-conteudo').innerText);
  if(!/TUDO CONFERIDO/i.test(tela)) throw new Error('não fechou nem depois de conferida');
  // e a volta, para os testes seguintes continuarem na Capital
  await pg.evaluate(() => { orcMudarCampoTexto('imovelMunicipio', 'São Paulo');
    orcMudarCampoTexto('imovelUf', 'SP'); });
  await pg.unroute('**/api/aliquota-municipal');
});

await passo('e a alíquota de fora cabe na tela do celular', async () => {
  await pg.evaluate(() => { orcMudarCampoTexto('imovelMunicipio', 'Extrema');
    orcMudarCampoTexto('imovelUf', 'MG'); });
  await pg.setViewportSize({width: 390, height: 844});
  const estoura = await pg.evaluate(() => {
    const b = document.querySelector('.orc-aliquota');
    return b ? b.getBoundingClientRect().right > window.innerWidth + 1 : false;
  });
  if(estoura) throw new Error('o bloco da alíquota passou da largura do telefone');
  await pg.setViewportSize({width: 1280, height: 900});
  await pg.evaluate(() => { orcMudarCampoTexto('imovelMunicipio', 'São Paulo');
    orcMudarCampoTexto('imovelUf', 'SP'); });
});

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
