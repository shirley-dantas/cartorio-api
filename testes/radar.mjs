// O Radar Jurídico e a Base de Regras num navegador de verdade.
//
// Roda com: node testes/radar.mjs
// (o montar.mjs recorta o bloco do index.html antes de cada execução)
//
// A semente abaixo é o formato que a varredura precisa gravar em
// /radar-juridico e /base-regras. Ela fica aqui de propósito: além de
// exercitar as telas, é a documentação viva do contrato entre a função da
// Vercel e o painel.
//
// O que este teste protege, e por que cada coisa está aqui:
//   - notícia não vira norma na tela;
//   - dispensa nunca aparece sem o que continua exigido;
//   - fonte que não respondeu aparece, e dia que falhou não vira dia calmo;
//   - a divergência de numeração da NSCGJ não some da base;
//   - a mensagem de cliente é texto, não HTML.
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {servir} from './servidor.mjs';
import {writeSync} from 'node:fs';

const diga = t => writeSync(1, t + '\n');

const servidor = await servir();
const erros = [];
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const pg = await b.newPage({viewport:{width:1280, height:900}});
pg.on('pageerror', e => erros.push('pageerror: ' + e.message));

// A Joaninha jurídica fala com /api/joaninha-juridico. Aqui a função da
// Vercel não existe: o navegador responde por ela, e o teste guarda o que
// foi pedido para conferir se o modo certo saiu daqui.
let ultimoPedido = null;
let respostaFalsa = 'Precisa, sim: o ITCMD continua exigido pelo Registro de Imóveis.';
await pg.route('**/api/joaninha-juridico', async rota => {
  ultimoPedido = JSON.parse(rota.request().postData() || '{}');
  await rota.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ok:true, modo:ultimoPedido.modo, resposta:respostaFalsa, temas:6})
  });
});

await pg.goto('http://127.0.0.1:8199/harness-radar.html');
await pg.waitForFunction(() => window.__pronto === true);

const limpo = s => s.replace(/ /g,' ').replace(/\s+/g,' ');
const PRAZO = 15000;
const passo = async (n, f) => {
  const estourou = new Promise((_, rej) => setTimeout(() => rej(new Error('passou de ' + (PRAZO/1000) + 's')), PRAZO));
  try { await Promise.race([f(), estourou]); diga('  ok  ' + n); }
  catch (e) { erros.push(n + ' → ' + e.message); diga('FALHA ' + n + ' → ' + e.message.split('\n')[0]); }
};

const hoje = new Date().toLocaleDateString('sv-SE', {timeZone:'America/Sao_Paulo'});
const ontem = new Date(Date.now() - 864e5).toLocaleDateString('sv-SE', {timeZone:'America/Sao_Paulo'});

// ── O dia cheio, do jeito que a função da Vercel grava ──
const DIA_DE_HOJE = {
  data: hoje, gerado: hoje + 'T09:04:00.000Z', status: 'ok',
  resumo: 'O CNJ dispensou o ITCMD para lavrar inventário — e só para lavrar.',
  alerta: 'Avise quem tem inventário na mesa: a escritura sai, o registro ainda não.',
  contagem: {muda:1, breve:1, saber:1, fora:1},
  fontesLidas: ['tjsp-cgj','cnj','sefaz-sp'],
  fontesNaoLidas: [{id:'anoregsp', nome:'ANOREG/SP', erro:'não respondeu a tempo'}],
  relatorio: 'Relatório do dia em texto corrido.',
  itens: [
    {
      selo:'🟢', especie:'norma', orgao:'SEFAZ/SP', referencia:'Portaria CAT 12/2026',
      data: hoje, titulo:'A SEFAZ confirmou o prazo de 60 dias da declaração do ITCMD',
      oQueMuda:'Nada na prática — confirma o que já se fazia.',
      confirmado:true, parcial:false, etapas:[]
    },
    {
      selo:'🔴', especie:'decisao', orgao:'CNJ',
      referencia:'PP nº 0008622-24.2025.2.00.0000', data: hoje,
      titulo:'ITCMD deixa de ser exigido para lavrar inventário e partilha',
      oQueMuda:'A escritura de inventário pode ser lavrada sem a guia paga.',
      oQueNaoMuda:'O Registro de Imóveis continua exigindo o ITCMD para transferir o imóvel (art. 289 da Lei 6.015/73).',
      etapas:[
        {etapa:'Escritura', situacao:'dispensado', base:'CNJ, 18/08/2026'},
        {etapa:'Registro', situacao:'continua exigido', base:'art. 289 da LRP'}
      ],
      confirmado:true, parcial:false
    },
    {
      selo:'🟠', especie:'noticia', orgao:'ANOREG/SP', referencia:'número não localizado no material de hoje',
      titulo:'Fala-se em Provimento CGJ alinhando SP à decisão do CNJ',
      oQueMuda:'Nada ainda — matéria de portal, sem o ato localizado.',
      confirmado:false, parcial:true,
      aConfirmar:'Localizar o Provimento no site do TJSP antes de citar.',
      etapas:[]
    },
    {
      selo:'⚪', especie:'norma', orgao:'CNJ', referencia:'Provimento 200/2026',
      titulo:'Regras de plantão de serventias no Acre',
      oQueMuda:'Não alcança a Capital de São Paulo.', confirmado:true, parcial:false, etapas:[]
    }
  ]
};

const DIA_DE_ONTEM = {
  data: ontem, gerado: ontem + 'T09:02:00.000Z', status: 'falhou',
  resumo: 'A varredura falhou — o dia não foi lido.',
  alerta: null, contagem:{muda:0,breve:0,saber:0,fora:0}, itens: [],
  fontesNaoLidas: [], erro: 'a IA não devolveu JSON',
  relatorio: 'A varredura do dia não terminou. Isso não quer dizer que nada mudou: quer dizer que ninguém olhou.'
};

const BASE = {
  'itcmd-inventario': {
    tema:'itcmd-inventario', origem:'carga inicial', atualizadoEm: hoje,
    titulo:'ITCMD no inventário e partilha extrajudicial',
    resumo:'Desde 18/08/2026 não é mais obrigatório comprovar o ITCMD para lavrar a escritura de inventário e partilha.',
    naMesa:['A escritura pode ser lavrada sem a guia paga.','Havendo imóvel, avisar que o registro ainda exige.'],
    etapas:[{etapa:'Escritura', situacao:'dispensado', base:'CNJ 18/08/2026'},
            {etapa:'Registro', situacao:'continua exigido', base:'art. 289 da LRP'}],
    fundamentos:[{ref:'Lei 6.015/73, art. 289', texto:'Obriga o oficial a fiscalizar o pagamento dos impostos.'}],
    atencao:['Competência: o CNJ não altera lei tributária estadual.'],
    mensagemCliente:'Oi, [nome]! Boa pergunta 😊'
  },
  'certidoes-dispensa': {
    tema:'certidoes-dispensa', origem:'carga inicial', atualizadoEm: hoje,
    titulo:'Apresentação e dispensa de certidões na compra e venda',
    resumo:'O CNJ vedou exigir CNDs para lavrar compra e venda, ressalvados ITBI e laudêmio.',
    naMesa:['Não exigir CND federal, estadual, municipal ou trabalhista.'],
    fundamentos:[{ref:'CNJ · PCA nº 0001611-12.2023.2.00.0000', texto:'Decisão de 15/08/2025.'}],
    atencao:['Divergência de numeração: 117.1 ou 119.1 — conferir no site do TJSP antes de usar numa exigência formal.'],
    atualizacoes:{[hoje]:{data:hoje, texto:'O Radar viu menção a um provimento paulista, ainda não confirmado.', origem:'radar'}}
  }
};

const semear = (meta, dias, base) => pg.evaluate(s => {
  window.__raiz['radar-juridico'] = JSON.parse(JSON.stringify(s.dias));
  window.__raiz['radar-juridico-meta'] = JSON.parse(JSON.stringify(s.meta));
  window.__raiz['base-regras'] = JSON.parse(JSON.stringify(s.base));
  window.__avisar();
}, {meta, dias, base});

const textoRadar = async () => limpo(await pg.textContent('#radar-conteudo'));

// ══════════════════════════════════════════════════════════════════════════
diga('\n— A faixa do cabeçalho —');

await passo('sem varredura, a faixa nem aparece', async () => {
  const v = await pg.evaluate(() => getComputedStyle(document.getElementById('cc-jornal')).display);
  if(v !== 'none') throw new Error('a faixa apareceu com o banco vazio → ' + v);
});

await passo('depois da varredura, a faixa traz o resumo e a contagem', async () => {
  await semear(
    {ultimaVarredura: DIA_DE_HOJE.gerado, ultimoDia: hoje, status:'ok', dias:{
      [ontem]: {data:ontem, status:'falhou', resumo:DIA_DE_ONTEM.resumo, alerta:null, contagem:DIA_DE_ONTEM.contagem, naoLidas:0},
      [hoje]:  {data:hoje,  status:'ok',     resumo:DIA_DE_HOJE.resumo,  alerta:DIA_DE_HOJE.alerta, contagem:DIA_DE_HOJE.contagem, naoLidas:1}
    }},
    {[ontem]: DIA_DE_ONTEM, [hoje]: DIA_DE_HOJE}, BASE);
  await pg.waitForFunction(() => getComputedStyle(document.getElementById('cc-jornal')).display !== 'none');
  const t = limpo(await pg.textContent('#cc-jornal'));
  if(!t.includes('dispensou o ITCMD')) throw new Error('a faixa não trouxe o resumo → ' + t);
  if(!/1 muda hoje/.test(t)) throw new Error('a contagem de 🔴 não apareceu → ' + t);
  if(!/hoje/.test(await pg.textContent('#cc-jornal-data'))) throw new Error('não disse que é de hoje');
});

await passo('o alerta operacional aparece na faixa, e não some no meio do resumo', async () => {
  const v = await pg.evaluate(() => getComputedStyle(document.getElementById('cc-jornal-alerta')).display);
  if(v === 'none') throw new Error('o alerta ficou escondido');
  const t = limpo(await pg.textContent('#cc-jornal-alerta'));
  if(!t.includes('a escritura sai, o registro ainda não')) throw new Error('alerta errado → ' + t);
});

await passo('dia que falhou não vira dia calmo', async () => {
  await semear(
    {ultimaVarredura: DIA_DE_ONTEM.gerado, ultimoDia: ontem, status:'falhou', dias:{
      [ontem]: {data:ontem, status:'falhou', resumo:DIA_DE_ONTEM.resumo, alerta:null, contagem:DIA_DE_ONTEM.contagem, naoLidas:0}
    }},
    {[ontem]: DIA_DE_ONTEM}, BASE);
  const t = limpo(await pg.textContent('#cc-jornal'));
  if(!/não foi lido/.test(t)) throw new Error('não disse que o dia não foi lido → ' + t);
  if(/sem novidade/.test(t)) throw new Error('dia não lido apareceu como dia calmo → ' + t);
  if(!/última leitura em/.test(t)) throw new Error('não disse de quando é a leitura → ' + t);
});

// ══════════════════════════════════════════════════════════════════════════
diga('\n— O dia —');

await passo('a faixa abre o Radar no dia mais recente', async () => {
  await semear(
    {ultimaVarredura: DIA_DE_HOJE.gerado, ultimoDia: hoje, status:'ok', dias:{
      [ontem]: {data:ontem, status:'falhou', resumo:DIA_DE_ONTEM.resumo, alerta:null, contagem:DIA_DE_ONTEM.contagem, naoLidas:0},
      [hoje]:  {data:hoje,  status:'ok',     resumo:DIA_DE_HOJE.resumo,  alerta:DIA_DE_HOJE.alerta, contagem:DIA_DE_HOJE.contagem, naoLidas:1}
    }},
    {[ontem]: DIA_DE_ONTEM, [hoje]: DIA_DE_HOJE}, BASE);
  await pg.click('#cc-jornal');
  await pg.waitForSelector('#modal-radar.open');
  await pg.waitForSelector('.radar-item', {timeout:6000});
});

await passo('o 🔴 vem antes do 🟢, mesmo tendo chegado depois', async () => {
  const titulos = await pg.$$eval('.radar-item h4', els => els.map(e => e.textContent.trim()));
  if(!/^🔴/.test(titulos[0])) throw new Error('o que muda hoje não abriu a lista → ' + JSON.stringify(titulos));
});

await passo('notícia aparece como notícia — nunca como norma', async () => {
  const item = await pg.$$eval('.radar-item', els =>
    els.map(e => e.textContent).find(t => /Provimento CGJ alinhando/.test(t)) || '');
  if(!/notícia/i.test(item)) throw new Error('a matéria de portal não foi marcada como notícia → ' + item.slice(0,200));
  if(!/ainda não confirmado em fonte primária/.test(item))
    throw new Error('não disse que falta confirmação em fonte primária');
});

await passo('dispensa não aparece sozinha: o que continua exigido vem junto', async () => {
  const item = await pg.$$eval('.radar-item', els =>
    els.map(e => e.textContent).find(t => /deixa de ser exigido/i.test(t)) || '');
  if(!/O que continua exigido/.test(item))
    throw new Error('o item da dispensa não mostrou o que continua exigido → ' + item.slice(0,200));
  if(!/Registro/.test(item) || !/art\. 289/.test(item))
    throw new Error('a etapa do registro não apareceu → ' + item.slice(0,240));
});

await passo('item por confirmar mostra o aviso, não passa por resolvido', async () => {
  const t = await textoRadar();
  if(!/Aplicação parcial — confirmar/.test(t)) throw new Error('faltou o aviso de aplicação parcial');
  if(!/Localizar o Provimento no site do TJSP/.test(t)) throw new Error('não disse o que falta confirmar');
});

await passo('fonte que não respondeu aparece na tela', async () => {
  const t = await textoRadar();
  if(!/ANOREG/.test(t) || !/não respondeu/i.test(t))
    throw new Error('a fonte muda não apareceu → ' + t.slice(-400));
});

await passo('o que foi descartado fica escrito, em vez de sumir', async () => {
  const t = await textoRadar();
  if(!/Visto e descartado/.test(t)) throw new Error('o ⚪ sumiu da tela');
  if(!/plantão de serventias no Acre/.test(t)) throw new Error('não disse o que foi descartado');
});

// ══════════════════════════════════════════════════════════════════════════
diga('\n— Os últimos dias —');

await passo('a lista dos dias traz os dois, e marca o que falhou', async () => {
  await pg.evaluate(() => radarTrocarAba('dias'));
  await pg.waitForSelector('.radar-dia');
  const t = await textoRadar();
  if(!/não lido/.test(t)) throw new Error('o dia que falhou não foi marcado → ' + t.slice(0,300));
  const n = await pg.$$eval('.radar-dia', els => els.length);
  if(n !== 2) throw new Error('esperava 2 dias na lista, vieram ' + n);
});

await passo('clicar num dia antigo abre aquele dia, não o de hoje', async () => {
  await pg.evaluate(d => radarVerDia(d), ontem);
  await pg.waitForFunction(() => /não foi lido/.test(document.getElementById('radar-conteudo').textContent), null, {timeout:5000});
  const t = await textoRadar();
  if(/dispensou o ITCMD/.test(t)) throw new Error('continuou mostrando o dia de hoje → ' + t.slice(0,200));
  // O dia gravado carrega o motivo da falha. Ele não pode ser confundido com
  // "não consegui abrir este dia" — são coisas diferentes, e a tela precisa
  // dizer qual das duas aconteceu.
  if(!/a IA não devolveu JSON/.test(t)) throw new Error('não disse por que a varredura falhou → ' + t.slice(0,200));
  if(/Tente de novo em instantes/.test(t)) throw new Error('a falha da varredura virou falha de leitura da tela');
});

// ══════════════════════════════════════════════════════════════════════════
diga('\n— A base de regras —');

await passo('os temas aparecem, fechados', async () => {
  await pg.evaluate(() => radarTrocarAba('base'));
  await pg.waitForSelector('.radar-tema');
  const n = await pg.$$eval('.radar-tema', els => els.length);
  if(n !== 2) throw new Error('esperava 2 temas, vieram ' + n);
  if(await pg.$('.radar-tema-corpo')) throw new Error('abriu um tema sozinho');
});

await passo('abrir o ITCMD mostra a etapa do registro e o Atenção', async () => {
  await pg.evaluate(() => radarVerTema('itcmd-inventario'));
  await pg.waitForSelector('.radar-tema-corpo');
  const t = await textoRadar();
  if(!/continua exigido/.test(t)) throw new Error('a etapa do registro não apareceu');
  if(!/o CNJ não altera lei tributária estadual/.test(t)) throw new Error('o Atenção não apareceu');
});

await passo('a divergência 117.1 / 119.1 não fica escondida', async () => {
  await pg.evaluate(() => radarVerTema('certidoes-dispensa'));
  await pg.waitForSelector('.radar-bloco.atencao');
  const t = await textoRadar();
  if(!/117\.1|119\.1/.test(t)) throw new Error('a divergência de numeração sumiu da tela');
  if(!/conferir no site do TJSP/.test(t)) throw new Error('não disse onde conferir');
});

await passo('o que o Radar acrescentou aparece datado, separado do conferido à mão', async () => {
  const t = await textoRadar();
  if(!/Acrescentado pelo Radar/.test(t)) throw new Error('a atualização do Radar não apareceu');
});

// ══════════════════════════════════════════════════════════════════════════
diga('\n— A Joaninha jurídica —');

await passo('o botão do tema leva pra Joaninha no modo cliente, com o assunto escrito', async () => {
  await pg.evaluate(() => radarVerTema('itcmd-inventario'));
  await pg.waitForSelector('.radar-tema-corpo');
  await pg.click('.radar-tema-corpo .radar-btn');
  await pg.waitForSelector('#joaninha-tab-juridico', {state:'visible'});
  const modo = await pg.$eval('.jj-modo.on', e => e.dataset.modo);
  if(modo !== 'cliente') throw new Error('não abriu no modo cliente → ' + modo);
  const v = await pg.inputValue('#joaninha-juridico-texto');
  if(!/ITCMD/.test(v)) throw new Error('não levou o assunto → ' + v);
  const aberto = await pg.evaluate(() => document.getElementById('modal-radar').classList.contains('open'));
  if(aberto) throw new Error('o Radar ficou aberto por baixo do painel');
});

await passo('trocar de modo troca a nota e os exemplos', async () => {
  const notaCliente = await pg.textContent('#jj-nota');
  await pg.click('.jj-modo[data-modo="interna"]');
  const notaInterna = await pg.textContent('#jj-nota');
  if(notaCliente === notaInterna) throw new Error('a nota não mudou com o modo');
  if(!/colega ao lado/.test(notaInterna)) throw new Error('a nota interna está errada → ' + notaInterna);
  const ex = await pg.$$eval('#jj-exemplos button', els => els.map(e => e.textContent));
  if(!ex.some(e => /lavrar o inventário/.test(e))) throw new Error('os exemplos não trocaram → ' + JSON.stringify(ex));
});

await passo('perguntar manda o modo certo e mostra a resposta', async () => {
  await pg.fill('#joaninha-juridico-texto', 'Preciso do ITCMD pago pra lavrar?');
  await pg.click('#joaninha-juridico-btn');
  await pg.waitForSelector('#jj-texto', {timeout:6000});
  if(!ultimoPedido || ultimoPedido.modo !== 'interna')
    throw new Error('mandou o modo errado → ' + JSON.stringify(ultimoPedido));
  const t = limpo(await pg.textContent('#joaninha-juridico-resposta'));
  if(!/continua exigido pelo Registro de Imóveis/.test(t)) throw new Error('não mostrou a resposta → ' + t);
  if(!/Base do cartório/.test(t)) throw new Error('não disse de onde saiu a resposta');
});

await passo('a resposta é texto, não HTML — nada do que vier de fora executa', async () => {
  respostaFalsa = 'Cuidado: <img src=x onerror="window.__invadiu=1"> e <b>negrito</b>.';
  await pg.fill('#joaninha-juridico-texto', 'teste de injeção');
  await pg.click('#joaninha-juridico-btn');
  await pg.waitForFunction(() => /negrito/.test(document.getElementById('joaninha-juridico-resposta').textContent), null, {timeout:6000});
  const invadiu = await pg.evaluate(() => window.__invadiu);
  if(invadiu) throw new Error('a resposta da IA executou script na página');
  const temImg = await pg.$('#jj-texto img');
  if(temImg) throw new Error('a resposta virou HTML de verdade');
  const t = await pg.textContent('#jj-texto');
  if(!/<b>negrito<\/b>/.test(t)) throw new Error('o texto não saiu literal → ' + t);
  respostaFalsa = 'Precisa, sim: o ITCMD continua exigido pelo Registro de Imóveis.';
});

await passo('trocar de modo limpa a resposta da pergunta anterior', async () => {
  await pg.click('.jj-modo[data-modo="cliente"]');
  const t = (await pg.textContent('#joaninha-juridico-resposta')).trim();
  if(t) throw new Error('a resposta antiga ficou na tela do modo novo → ' + t.slice(0,120));
});

await passo('a mensagem de cliente sai com o aviso de ler antes de mandar', async () => {
  await pg.fill('#joaninha-juridico-texto', 'desobrigação do ITCMD');
  await pg.click('#joaninha-juridico-btn');
  await pg.waitForSelector('#jj-texto', {timeout:6000});
  if(ultimoPedido.modo !== 'cliente') throw new Error('mandou o modo errado → ' + ultimoPedido.modo);
  const t = limpo(await pg.textContent('#joaninha-juridico-resposta'));
  if(!/Leia antes de mandar/.test(t)) throw new Error('faltou o aviso → ' + t);
  if(!/Copiar/.test(t)) throw new Error('faltou o botão de copiar');
});

// ══════════════════════════════════════════════════════════════════════════
diga('\n— No celular —');

const cel = await b.newPage({viewport:{width:390, height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true});
cel.on('pageerror', e => erros.push('pageerror (celular): ' + e.message));
await cel.route('**/api/joaninha-juridico', rota => rota.fulfill({
  status:200, contentType:'application/json', body: JSON.stringify({ok:true, modo:'interna', resposta:'Resposta curta.'})
}));
await cel.goto('http://127.0.0.1:8199/harness-radar.html');
await cel.waitForFunction(() => window.__pronto === true);
await cel.evaluate(s => {
  window.__raiz['radar-juridico'] = JSON.parse(JSON.stringify(s.dias));
  window.__raiz['radar-juridico-meta'] = JSON.parse(JSON.stringify(s.meta));
  window.__raiz['base-regras'] = JSON.parse(JSON.stringify(s.base));
  window.__avisar();
}, {
  meta:{ultimaVarredura: DIA_DE_HOJE.gerado, ultimoDia: hoje, status:'ok', dias:{
    [hoje]: {data:hoje, status:'ok', resumo:DIA_DE_HOJE.resumo, alerta:DIA_DE_HOJE.alerta, contagem:DIA_DE_HOJE.contagem, naoLidas:1}
  }},
  dias:{[hoje]: DIA_DE_HOJE}, base: BASE
});

const naoEstoura = async (onde) => {
  const m = await cel.evaluate(() => ({doc: document.documentElement.scrollWidth, jan: window.innerWidth}));
  if(m.doc > m.jan + 1) throw new Error(onde + ' fez a página rolar de lado (' + m.doc + ' > ' + m.jan + ')');
};

await passo('a faixa do Jornal cabe na tela do celular', async () => {
  await cel.waitForFunction(() => getComputedStyle(document.getElementById('cc-jornal')).display !== 'none');
  await naoEstoura('a faixa do Jornal');
});

await passo('o Radar aberto cabe na tela do celular', async () => {
  await cel.click('#cc-jornal');
  await cel.waitForSelector('.radar-item');
  await naoEstoura('o Radar');
  const largas = await cel.evaluate(() => {
    const jan = window.innerWidth;
    return [...document.querySelectorAll('#radar-conteudo *')]
      .filter(e => e.getBoundingClientRect().right > jan + 1).length;
  });
  if(largas) throw new Error(largas + ' elemento(s) passando da borda');
});

await passo('a base de regras cabe na tela do celular', async () => {
  await cel.evaluate(() => { radarTrocarAba('base'); radarVerTema('itcmd-inventario'); });
  await cel.waitForSelector('.radar-tema-corpo');
  await naoEstoura('a base de regras');
});

await passo('as abas da Joaninha cabem, agora que são seis', async () => {
  await cel.evaluate(() => { fecharRadar(); toggleJoaninhaPainel(true); joaninhaTab('juridico'); });
  await cel.waitForSelector('#joaninha-tab-juridico', {state:'visible'});
  const fora = await cel.evaluate(() => {
    const jan = window.innerWidth;
    return [...document.querySelectorAll('.joaninha-tab, .jj-modo')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.right > jan + 1 || r.left < -1; })
      .map(e => e.textContent.trim());
  });
  if(fora.length) throw new Error('passando da borda: ' + JSON.stringify(fora));
  await naoEstoura('o painel da Joaninha');
});

await b.close();
servidor.close();

if(erros.length){
  diga('\n' + erros.length + ' problema(s):');
  erros.forEach(e => diga('  - ' + e));
  process.exit(1);
}
diga('\nO Radar passou no navegador.');
