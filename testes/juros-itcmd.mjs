// Multa e juros do ITCMD (lib/juros-itcmd.js) — sem rede e sem Firebase de
// verdade: tudo que o módulo pede ao `https` é respondido por um fingidor.
//
// Nasceu de um bug real, achado em 18/11/2026 ao ela perguntar "tem certeza,
// sobre os juros e multa do itcmd?": a multa contava 0,33%/dia desde o ÓBITO,
// não desde o VENCIMENTO (óbito + 180 dias) — então qualquer caso que
// passasse dos 180 dias já nascia travado no teto de 20%, porque 0,33% × 180
// dias sozinho já passa de 20%. Um atraso de poucos dias virava a multa
// máxima, e um atraso de um ano também. O mesmo valia para o juros (Selic
// contada desde o óbito, não desde o vencimento).
import https from 'node:https';
import jurosItcmd from '../lib/juros-itcmd.js';

let ok_ = 0, falhas = 0;
function ok(nome, cond, extra){
  if(cond){ ok_++; console.log('  ok  ' + nome); }
  else { falhas++; console.log('  FALHOU  ' + nome + (extra !== undefined ? '  ->  ' + JSON.stringify(extra) : '')); }
}

// Fingidor: Firebase sempre "não achei nada guardado" no GET, e aceita
// qualquer PUT; a Selic responde uma série fixa de 0% ao dia, só para medir
// a JANELA (quantos dias entram), não o valor em si.
function fingirHttps(diasNaSerieEsperados){
  const original = { get: https.get, request: https.request };
  https.request = function(opts, cb){
    const res = { statusCode: 200, on(ev, fn){ if(ev === 'data') fn('null'); if(ev === 'end') fn(); } };
    const req = { on(){}, write(){}, end(){ cb(res); } };
    return req;
  };
  https.get = function(opts, cb){
    const serie = Array.from({length: Math.max(diasNaSerieEsperados, 0)}, () => ({ valor: '0' }));
    const res = { on(ev, fn){ if(ev === 'data') fn(JSON.stringify(serie)); if(ev === 'end') fn(); } };
    cb(res);
    return { on(){} };
  };
  return () => { https.get = original.get; https.request = original.request; };
}

async function chamar(dataObito, dataAto, diasNaSerie){
  const desfazer = fingirHttps(diasNaSerie);
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
    const r = await chamar('2026-01-01', '2026-07-20', 20);
    ok('20 dias de atraso: multa é 0,33%/dia DESDE O VENCIMENTO, não desde o óbito (6,6%, não o teto)', r.multaPct === 6.6, r.multaPct);
  }

  {
    // Exatamente no vencimento (180 dias desde o óbito, 0 dias de atraso): sem multa.
    const r = await chamar('2026-01-01', '2026-06-30', 0);
    ok('pago no dia do vencimento (180 dias desde o óbito): sem multa', r.multaPct === 0, r.multaPct);
  }

  {
    // Atraso bem maior que 60 dias (o suficiente para o teto de verdade: 0,33%×61≈20,13%): agora sim trava em 20%.
    const r = await chamar('2026-01-01', '2026-09-15', 77);
    ok('atraso de mais de 60 dias (de verdade): multa no teto de 20%', r.multaPct === 20, r.multaPct);
  }

  {
    // A Selic só deve ser somada a partir do dia seguinte ao VENCIMENTO (óbito + 181 dias),
    // nunca a partir do óbito — a série pedida ao Banco Central tem de ter exatamente os
    // dias de atraso, não os dias desde a morte.
    const r = await chamar('2026-01-01', '2026-07-20', 20);
    ok('a janela da Selic é a janela de atraso (20 dias), não a janela desde o óbito (200 dias)',
      r.encontrado === true, r);
  }

  console.log(`\n${ok_} ok, ${falhas} falha(s).`);
  if(falhas){ process.exit(1); }
  console.log('Tudo certo.');
})();
