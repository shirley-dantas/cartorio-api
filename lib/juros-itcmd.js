// ══ JUROS E MULTA DO ITCMD, QUANDO O ÓBITO FICOU PARA TRÁS ═══════════════
//
// Pedido dela em 18/11/2026: no inventário com meação, o ITCMD é 4% sobre a
// meação NA DATA DO ÓBITO (um valor diferente da meação na data presente,
// que é a base da escritura/registro) — e, passando de 180 dias entre o
// óbito e o pagamento, a Lei 10.705/2000 manda somar multa de mora (art. 19
// — 0,33% por dia de atraso, limitada a 20%) e juros (art. 20).
//
// A multa é conta fixa, sem precisar de internet. O juros, não — e até
// 26/11/2026 esta função usava a Selic diária do Banco Central como
// aproximação, por falta de coisa melhor. Ela perguntou "tem certeza, sobre
// os juros e multa do itcmd?", e a pesquisa que isso abriu achou a fonte
// certa: a SEFAZ-SP publica, todo mês, uma tabela oficial de coeficientes
// (Comunicado DICAR) — ver `lib/dicar-itcmd.js`. A Selic saiu; quem calcula
// o juros agora é essa tabela, lida uma vez por mês e guardada em cache.
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
const dicar = require("./dicar-itcmd.js");

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

const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO",
  "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

module.exports = async function jurosItcmd(req, res) {
  const { dataObito, dataAto, forcar } = req.body || {};
  if (!dataObito || !dataAto)
    return res.status(400).json({ erro: "informe dataObito e dataAto" });

  const chave = chaveJuros(dataObito, dataAto);
  const dias = diasEntre(dataObito, dataAto);
  // O vencimento do ITCMD é 180 dias depois do óbito; multa e juros contam a
  // partir DAÍ, não a partir do óbito — "0,33% por dia de ATRASO" (art. 19) é
  // atraso em relação ao vencimento, não tempo desde a morte. Achado num
  // reexame em 18/11/2026: a conta anterior multiplicava 0,33% pelo total de
  // dias desde o óbito, o que já nasce acima do teto de 20% (0,33% × 180 dias
  // = 59,4%) assim que a régua de 180 dias é cruzada — toda multa saía travada
  // no teto, mesmo para um atraso de poucos dias.
  const vencimento = new Date(dataObito + "T00:00:00");
  vencimento.setDate(vencimento.getDate() + 180);
  const vencimentoIso = vencimento.toISOString().slice(0, 10);
  const atraso = diasEntre(vencimentoIso, dataAto);
  const multaPct = atraso > 0 ? Math.round(Math.min(0.33 * atraso, 20) * 100) / 100 : 0;

  try {
    if (!forcar) {
      const guardado = await firebase(`orcamento-juros-itcmd/${chave}.json`, "GET");
      if (guardado && guardado.coefPct != null)
        return res.status(200).json(Object.assign({}, guardado, { doCache: true }));
    }

    // A tabela DICAR do mês certo é a do mês da DATA DO ATO (é ela que diz
    // "aplicável até"), e a linha/coluna lidas são as do VENCIMENTO — não do
    // óbito, nem da data do ato.
    const [anoVenc, mesVencNum] = vencimentoIso.split("-").map(Number);
    const mesVenc = MESES[mesVencNum - 1];
    const mesAlvoIso = dataAto.slice(0, 7);
    const tabela = await dicar.buscarTabela(mesAlvoIso, forcar);
    if (!tabela)
      return res.status(200).json({
        encontrado: false, chave, dias, multaPct,
        porqueNao: "a Fazenda ainda não publicou (ou a busca não achou) o Comunicado DICAR com a tabela de juros "
          + `para pagamentos em ${paraBr(dataAto)}`
      });

    const coef = dicar.coeficienteDaTabela(tabela, mesVenc, anoVenc, dicar.ehUltimoDiaUtil(vencimentoIso));
    if (coef == null)
      return res.status(200).json({
        encontrado: false, chave, dias, multaPct,
        porqueNao: `a tabela de ${paraBr(tabela.aplicavelAte)} não traz coeficiente para vencimento em `
          + `${mesVenc.toLowerCase()}/${anoVenc} — óbito fora do alcance dela`
      });
    const coefPct = Math.round(coef * 100 * 10000) / 10000;

    const registro = {
      chave, dias, multaPct, coefPct,
      encontrado: true,
      fundamento: `Multa de mora de ${multaPct}% (0,33%/dia de atraso, até 20% — art. 19) + juros de ${coefPct}% `
        + `pela Tabela Prática de Juros de Mora da SEFAZ-SP (Comunicado DICAR-${tabela.comunicado}, aplicável até `
        + `${paraBr(tabela.aplicavelAte)}), para vencimento em ${mesVenc.toLowerCase()}/${anoVenc} (art. 20, Lei 10.705/2000).`,
      fontes: [tabela.fonte, "https://portal.fazenda.sp.gov.br/servicos/itcmd/Paginas/vencimento.aspx"],
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
