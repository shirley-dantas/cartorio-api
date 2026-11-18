// ══ JUROS E MULTA DO ITCMD, QUANDO O ÓBITO FICOU PARA TRÁS ═══════════════
//
// Pedido dela em 18/11/2026: no inventário com meação, o ITCMD é 4% sobre a
// meação NA DATA DO ÓBITO (um valor diferente da meação na data presente,
// que é a base da escritura/registro) — e, passando de 180 dias entre o
// óbito e o pagamento, a Lei 10.705/2000 manda somar multa de mora (art. 19
// — 0,33% por dia de atraso, limitada a 20%) e juros pela Selic (art. 20).
//
// A multa é conta fixa, sem precisar de internet. O juros, não: a Selic muda
// mês a mês, e o painel não tem hoje uma tabela própria dela. Esta função
// busca a Selic diária acumulada no período na série oficial do Banco
// Central (SGS 11), e compõe os dias — o mesmo jeito que a Receita usa para
// tributo federal, na falta de um texto mais específico da lei paulista
// sobre a forma de composição.
//
// O que volta daqui é HIPÓTESE, na mesma escada da alíquota de fora da
// Capital (api/aliquota-municipal.js): entra na conta para o orçamento
// existir, sai marcada 🔴, e o CHECK FINAL não fecha até ela conferir. Ela
// confirmou (18/11/2026) que calcula sempre, mesmo sendo extrajudicial e
// mesmo havendo controvérsia no TJSP sobre multa/juros nesse caso — prefere
// orçar pelo pior cenário a deixar o cliente surpreso depois.
//
// Esta função não ganhou um arquivo próprio em api/: a Vercel aceita no
// máximo 12 funções lá e o painel já está no limite (ver CLAUDE.md). Quem a
// atende é a mesma porta da alíquota municipal (api/aliquota-municipal.js),
// por um campo `tipo` no corpo do pedido.

const https = require("https");

const FIREBASE_HOST = "painel-cartorio-default-rtdb.firebaseio.com";

function firebase(caminho, metodo, corpo) {
  return new Promise((resolve, reject) => {
    const body = corpo === undefined ? null : JSON.stringify(corpo);
    const req = https.request({
      hostname: FIREBASE_HOST, path: "/" + caminho, method: metodo,
      headers: Object.assign({ "Content-Type": "application/json" },
        body ? { "Content-Length": Buffer.byteLength(body) } : {})
    }, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        if (res.statusCode >= 400) return reject(new Error("firebase " + res.statusCode + ": " + data));
        try { resolve(data ? JSON.parse(data) : null); } catch (e) { resolve(null); }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function paraBr(iso) { const p = String(iso).slice(0, 10).split("-"); return `${p[2]}/${p[1]}/${p[0]}`; }

function diasEntre(d1, d2) {
  const a = new Date(d1 + "T00:00:00"), b = new Date(d2 + "T00:00:00");
  return Math.max(0, Math.round((b - a) / 86400000));
}

function chaveJuros(dataObito, dataAto) { return `${dataObito}_${dataAto}`; }

// A série 11 do SGS é a Selic diária, em % ao dia. Composta dia a dia, do dia
// seguinte ao óbito até a data do ato.
function buscarSelicDiaria(desde, ate) {
  return new Promise((resolve, reject) => {
    const path = `/dados/serie/bcdata.sgs.11/dados?formato=json&dataInicial=${paraBr(desde)}&dataFinal=${paraBr(ate)}`;
    https.get({ hostname: "api.bcb.gov.br", path }, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

module.exports = async function jurosItcmd(req, res) {
  const { dataObito, dataAto, forcar } = req.body || {};
  if (!dataObito || !dataAto)
    return res.status(400).json({ erro: "informe dataObito e dataAto" });

  const chave = chaveJuros(dataObito, dataAto);
  const dias = diasEntre(dataObito, dataAto);
  // 0,33% por dia de atraso, limitada a 20% — art. 19, Lei 10.705/2000.
  const multaPct = dias > 180 ? Math.round(Math.min(0.33 * dias, 20) * 100) / 100 : 0;

  try {
    if (!forcar) {
      const guardado = await firebase(`orcamento-juros-itcmd/${chave}.json`, "GET");
      if (guardado && guardado.selicPct != null)
        return res.status(200).json(Object.assign({}, guardado, { doCache: true }));
    }

    const inicio = new Date(dataObito + "T00:00:00");
    inicio.setDate(inicio.getDate() + 1);
    const desde = inicio.toISOString().slice(0, 10);

    const serie = await buscarSelicDiaria(desde, dataAto);
    if (!Array.isArray(serie) || !serie.length)
      return res.status(200).json({
        encontrado: false, chave, dias, multaPct,
        porqueNao: "o Banco Central não devolveu a série da Selic para esse período"
      });

    const fator = serie.reduce((f, d) => f * (1 + Number(String(d.valor).replace(",", ".")) / 100), 1);
    const selicPct = Math.round((fator - 1) * 100 * 10000) / 10000;

    const registro = {
      chave, dias, multaPct, selicPct,
      encontrado: true,
      fundamento: `Multa de mora de ${multaPct}% (0,33%/dia de atraso, até 20% — art. 19) + juros pela Selic `
        + `acumulada de ${selicPct}% entre ${paraBr(desde)} e ${paraBr(dataAto)} (art. 20), Lei 10.705/2000.`,
      fontes: [
        "https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados",
        "https://portal.fazenda.sp.gov.br/servicos/itcmd/Paginas/vencimento.aspx"
      ],
      // 🔴 sempre — igual à alíquota de fora da Capital. Ela promove com um
      // toque; nada sobe de degrau sozinho.
      confianca: "incerta",
      confirmadaPor: null, confirmadaEm: null,
      buscadaEm: new Date().toISOString().slice(0, 10)
    };
    await firebase(`orcamento-juros-itcmd/${chave}.json`, "PUT", registro);
    return res.status(200).json(registro);

  } catch (e) {
    return res.status(200).json({
      encontrado: false, chave, dias, multaPct,
      porqueNao: "a busca falhou: " + (e && e.message ? e.message : "erro desconhecido")
    });
  }
};
