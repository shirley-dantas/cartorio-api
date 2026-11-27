// ══ ITCMD — A TABELA OFICIAL DE JUROS DA SEFAZ-SP (DICAR) ═══════════════
//
// Pesquisa de 18 a 26/11/2026, depois dela perguntar "tem certeza, sobre os
// juros e multa do itcmd?": o juros do ITCMD atrasado NÃO é a Selic do Banco
// Central — isso era só uma aproximação, usada à falta de coisa melhor.
// Existe uma tabela OFICIAL, publicada todo mês pela SEFAZ-SP num Comunicado
// DICAR ("Tabela Prática para Cálculo dos Juros de Mora — ITCMD e IPVA"),
// e o coeficiente dela já vem ACUMULADO do vencimento até o fim do mês
// coberto pela tabela — não é uma taxa mensal para compor dia a dia.
//
// A tabela é uma matriz: linha = mês do vencimento, coluna = ano do
// vencimento. Uma tabela nova sai todo mês, e o número do Comunicado NÃO
// segue um padrão previsível (pulou de 59 para 73 entre setembro e novembro
// de 2026, porque o mesmo número de sequência também serve ICMS, multas
// infracionais e taxas) — por isso a busca aqui é uma varredura pela ementa,
// nunca uma URL montada por fórmula.
//
// Regra oficial, na nota de rodapé da própria tabela: se o vencimento cai no
// último dia útil do mês, o coeficiente lido é o do mês do vencimento MENOS
// 0,0100. "Dia útil" aqui só pula fim de semana — sem calendário de feriado
// municipal/estadual: uma aproximação razoável, documentada como tal.
//
// O que volta daqui continua HIPÓTESE, na mesma escada de sempre: entra na
// conta para o orçamento existir, sai 🔴, e o CHECK FINAL não fecha até ela
// conferir.

const https = require("https");
const pdfParse = require("pdf-parse");

const FIREBASE_HOST = "painel-cartorio-default-rtdb.firebaseio.com";
const SITE_HOST = "legislacao.fazenda.sp.gov.br";

const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO",
  "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

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

function getText(path) {
  return new Promise((resolve, reject) => {
    https.get({ hostname: SITE_HOST, path }, (res) => {
      let chunks = [];
      res.on("data", d => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8") }));
    }).on("error", reject);
  });
}

function getBuffer(path) {
  return new Promise((resolve, reject) => {
    https.get({ hostname: SITE_HOST, path }, (res) => {
      let chunks = [];
      res.on("data", d => chunks.push(d));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

function paraIso(dataBr) {
  const [d, m, a] = String(dataBr).split("/");
  return `${a}-${m}-${d}`;
}

// ── A leitura pura do texto que o pdf-parse já extraiu do PDF anexo ──────
// Nunca toca em rede — por isso é testável com um texto fixo (ver
// testes/fixtures/dicar-exemplo.txt).
function extrairTabela(texto) {
  const mApl = String(texto).match(/APLIC[ÁA]VEIS?\s+AT[ÉE]\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (!mApl) return null;
  const aplicavelAte = paraIso(mApl[1]);

  // Só a primeira tabela (o coeficiente já acumulado) — a segunda, "os
  // valores das taxas de juros utilizados para a elaboração", não interessa
  // aqui: ela é o insumo mensal, não o número pronto para multiplicar.
  const primeiraParte = String(texto).split(/Os valores das taxas de juros/i)[0];
  const linhas = primeiraParte.split("\n").map(l => l.trim()).filter(Boolean);

  const iAnos = linhas.findIndex(l => /^\d{4}(\s+\d{4}){5,}$/.test(l));
  if (iAnos === -1) return null;
  const anos = linhas[iAnos].split(/\s+/).map(Number);

  const coeficientes = {};
  for (let i = iAnos + 1; i < linhas.length - 1; i++) {
    const mes = MESES.find(m => linhas[i].toUpperCase() === m);
    if (!mes) continue;
    const valores = linhas[i + 1].split(/\s+/);
    const porAno = {};
    anos.forEach((ano, k) => {
      const v = valores[k];
      if (v && v !== "-") porAno[ano] = Number(v.replace(",", "."));
    });
    coeficientes[mes] = porAno;
  }
  if (!Object.keys(coeficientes).length) return null;
  return { aplicavelAte, coeficientes };
}

// O coeficiente certo, já com o ajuste do último dia útil do mês (a nota de
// rodapé da própria tabela: deduzir 0,0100 nesse caso).
function coeficienteDaTabela(tabela, mesVenc, anoVenc, ultimoDiaUtil) {
  const linha = (tabela && tabela.coeficientes || {})[mesVenc];
  if (!linha || linha[anoVenc] == null) return null;
  const v = linha[anoVenc];
  return ultimoDiaUtil ? Math.round((v - 0.01) * 10000) / 10000 : v;
}

function ultimoDiaDoMes(ano, mes) { return new Date(Date.UTC(ano, mes, 0)).getUTCDate(); }
function diaDaSemana(ano, mes, dia) { return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay(); }
// Só pula fim de semana — sem calendário de feriado. Aproximação razoável,
// documentada como tal (um feriado no fim do mês faria a conta pender 0,01
// a mais do que deveria, nunca a menos).
function ehUltimoDiaUtil(dataIso) {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  let d = ultimoDiaDoMes(ano, mes);
  while (d > 0 && [0, 6].includes(diaDaSemana(ano, mes, d))) d--;
  return dia === d;
}

// ── Achar o Comunicado certo: varredura pela ementa, nunca uma URL montada
// por fórmula — o número de sequência não é previsível por mês.
async function localizarComunicado(mesAlvoIso) {
  const [anoAlvo, mesAlvoNum] = mesAlvoIso.split("-").map(Number);
  const guardado = await firebase("itcmd-dicar/_ultimo.json", "GET");
  const inicio = Math.max(1, (guardado && guardado.numero) || 1);
  const anoBusca = (guardado && guardado.ano) || anoAlvo;
  for (let n = inicio; n < inicio + 80; n++) {
    let r;
    try { r = await getText(`/Paginas/Comunicado-DICAR-${n}-de-${anoBusca}.aspx`); }
    catch (e) { continue; }
    if (!r || r.status !== 200) continue;
    const ementa = (r.text.match(/Ementa\s*(.*?)\s*Observa/is) || [])[1] || "";
    // A ementa real da SEFAZ escreve "ITCMD e de IPVA" (com o "de"), não
    // "ITCMD e IPVA" — achado testando com o texto de verdade (26/11/2026).
    if (!/ITCMD\s+e\s+(de\s+)?IPVA/i.test(ementa) || /Multas?\s+Infracionais?/i.test(ementa)) continue;
    const mApl = ementa.match(/at[ée]\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (!mApl) continue;
    const aplicavelAte = paraIso(mApl[1]);
    const [ay, am] = aplicavelAte.split("-").map(Number);
    if (ay !== anoAlvo || am !== mesAlvoNum) continue;
    const mAnexo = r.text.match(/href="([^"]*ANEXO[^"]*\.pdf)"/i);
    if (!mAnexo) continue;
    await firebase("itcmd-dicar/_ultimo.json", "PUT", { numero: n, ano: anoBusca });
    return {
      numero: n, anexoPath: mAnexo[1].replace(/&amp;/g, "&"), aplicavelAte,
      comunicadoUrl: `https://${SITE_HOST}/Paginas/Comunicado-DICAR-${n}-de-${anoBusca}.aspx`
    };
  }
  return null;
}

// ── A tabela do mês, com cache em Firebase (um PDF lido uma vez só) ──────
async function buscarTabela(mesAlvoIso, forcar) {
  const chaveCache = "itcmd-dicar-tabela/" + mesAlvoIso.replace("-", "_");
  if (!forcar) {
    const guardada = await firebase(chaveCache + ".json", "GET");
    if (guardada && guardada.coeficientes) return guardada;
  }
  const achado = await localizarComunicado(mesAlvoIso);
  if (!achado) return null;
  const pdfBuf = await getBuffer(achado.anexoPath);
  const { text } = await pdfParse(pdfBuf);
  const tabela = extrairTabela(text);
  if (!tabela) return null;
  const registro = Object.assign({}, tabela, {
    comunicado: achado.numero, fonte: achado.comunicadoUrl
  });
  await firebase(chaveCache + ".json", "PUT", registro);
  return registro;
}

module.exports = {
  extrairTabela, coeficienteDaTabela, ehUltimoDiaUtil, localizarComunicado, buscarTabela
};
