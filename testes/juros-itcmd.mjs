// Multa e juros do ITCMD (lib/juros-itcmd.js) — sem rede de verdade: tudo que
// o módulo pede ao `https` é respondido por um fingidor, e o PDF da tabela
// oficial é o anexo REAL do Comunicado DICAR-73/26 (testes/fixtures/).
//
// Nasceu de um bug real, achado em 18/11/2026 ao ela perguntar "tem certeza,
// sobre os juros e multa do itcmd?": a multa contava 0,33%/dia desde o ÓBITO,
// não desde o VENCIMENTO (óbito + 180 dias) — então qualquer caso que
// passasse dos 180 dias já nascia travado no teto de 20%. Esse bug já foi
// corrigido; o que mudou agora (26/11/2026, mesma pesquisa) é a FONTE do
// juros: era a Selic do Banco Central (aproximação), virou a tabela oficial
// da SEFAZ-SP (Comunicado DICAR) — ver testes/dicar-itcmd.mjs para a leitura
// pura da tabela.
import { readFileSync } from 'node:fs';
import https from 'node:https';
import jurosItcmd from '../lib/juros-itcmd.js';
import { extrairTabela, coeficienteDaTabela, ehUltimoDiaUtil } from '../lib/dicar-itcmd.js';

let ok_ = 0, falhas = 0;
function ok(nome, cond, extra){
  if(cond){ ok_++; console.log('  ok  ' + nome); }
  else { falhas++; console.log('  FALHOU  ' + nome + (extra !== undefined ? '  ->  ' + JSON.stringify(extra) : '')); }
}

const PDF_FIXTURE = readFileSync(new URL('./fixtures/dicar-exemplo.pdf', import.meta.url));
const TABELA_FIXTURE = extrairTabela(readFileSync(new URL('./fixtures/dicar-exemplo.txt', import.meta.url), 'utf8'));

// Fingidor: Firebase sempre "não achei nada guardado" e aceita qualquer
// escrita; a página do Comunicado DICAR devolve uma ementa "ITCMD e IPVA"
// válida com um link de anexo; o anexo é o PDF real da tabela de novembro/2026.
function fingirHttps(){
  const original = { get: https.get, request: https.request };
  https.request = function(opts, cb){
    const res = { statusCode: 200, on(ev, fn){ if(ev === 'data') fn('null'); if(ev === 'end') fn(); } };
    const req = { on(){}, write(){}, end(){ cb(res); } };
    return req;
  };
  https.get = function(opts, cb){
    const path = (opts && opts.path) || '';
    if(/ANEXO.*\.pdf/i.test(path)){
      const res = { statusCode: 200, on(ev, fn){ if(ev === 'data') fn(PDF_FIXTURE); if(ev === 'end') fn(); } };
      cb(res);
      return { on(){} };
    }
    // A ementa de verdade escreve a data por extenso, não "30/11/2026" — achado
    // em 27/11/2026 ao testar contra a página real (a busca nunca achava nada).
    const html = 'Ementa Divulga a Tabela Prática para Cálculo dos Juros de Mora aplicáveis até '
      + '30 de novembro de 2026 para os débitos de ITCMD e de IPVA. Observação '
      + '<a href="/SiteAssets/Paginas/Comunicado-DICAR-73-de-2026/ANEXO.pdf">anexo</a>';
    const res = { statusCode: 200, on(ev, fn){ if(ev === 'data') fn(Buffer.from(html)); if(ev === 'end') fn(); } };
    cb(res);
    return { on(){} };
  };
  return () => { https.get = original.get; https.request = original.request; };
}

async function chamar(dataObito, dataAto){
  const desfazer = fingirHttps();
  let resultado, statusCode = 200;
  const res = { status(c){ statusCode = c; return this; }, json(v){ resultado = v; return this; } };
  await jurosItcmd({ body: { dataObito, dataAto, forcar: true } }, res);
  desfazer();
  return resultado;
}

(async () => {
  console.log('— Multa e juros do ITCMD (art. 19 e 20, Lei 10.705/2000) —');

  {
    // 20 dias de ATRASO (= 200 dias desde o óbito): a multa certa é 0,33% × 20 = 6,6%,
    // bem abaixo do teto. Com o bug antigo, 0,33% × 200 já passava de 20% e travava no teto.
    // (a tabela desse mês não existe na fixture — só a multa é conferida aqui)
    const r = await chamar('2026-01-01', '2026-07-20');
    ok('20 dias de atraso: multa é 0,33%/dia DESDE O VENCIMENTO, não desde o óbito (6,6%, não o teto)', r.multaPct === 6.6, r.multaPct);
  }

  {
    // Exatamente no vencimento (180 dias desde o óbito, 0 dias de atraso): sem multa.
    const r = await chamar('2026-01-01', '2026-06-30');
    ok('pago no dia do vencimento (180 dias desde o óbito): sem multa', r.multaPct === 0, r.multaPct);
  }

  {
    // Atraso bem maior que 60 dias (o suficiente para o teto de verdade: 0,33%×61≈20,13%): agora sim trava em 20%.
    const r = await chamar('2026-01-01', '2026-09-15');
    ok('atraso de mais de 60 dias (de verdade): multa no teto de 20%', r.multaPct === 20, r.multaPct);
  }

  {
    // O juros vem da tabela OFICIAL (DICAR), lida de verdade do PDF fingido —
    // vencimento 30/06/2026 (óbito 01/01/2026 + 180 dias), pagamento em
    // novembro/2026 (a tabela que a Fazenda publicou cobre até lá).
    const venc = '2026-06-30';
    const ultimo = ehUltimoDiaUtil(venc);
    const coefEsperado = coeficienteDaTabela(TABELA_FIXTURE, 'JUNHO', 2026, ultimo);
    const coefPctEsperado = Math.round(coefEsperado * 100 * 10000) / 10000;
    const r = await chamar('2026-01-01', '2026-11-20');
    ok('achou a tabela e leu a linha/coluna certas (mês/ano do VENCIMENTO)',
      r.encontrado === true && r.coefPct === coefPctEsperado, { r, coefPctEsperado });
    ok('o fundamento cita o Comunicado DICAR, não a Selic', /DICAR/.test(r.fundamento || ''), r.fundamento);
    ok('entra 🔴 incerta — hipótese até ela conferir', r.confianca === 'incerta');
  }

  {
    // Mês sem tabela publicada (a fixture só cobre até novembro/2026): não
    // inventa número, diz que não achou.
    const r = await chamar('2026-01-01', '2027-03-10');
    ok('mês sem tabela publicada ainda: resposta honesta, não inventa coeficiente',
      r.encontrado === false && /n[ãa]o publicou/.test(r.porqueNao), r);
  }

  console.log(`\n${ok_} ok, ${falhas} falha(s).`);
  if(falhas){ process.exit(1); }
  console.log('Tudo certo.');
})();
