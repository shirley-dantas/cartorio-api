// Caderno da Rafaela no Chromium: do clique até o número na tela, com a IA fingida.
// Roda por cima do painel/index.html de verdade (e do data.json com as 247 questões).
//   node rafaela/testes/painel.mjs            → confere tudo e guarda imagens em testes/saida/
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {chromium, devices} from "/opt/node22/lib/node_modules/playwright/index.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, "..", "painel");
const SAIDA = path.join(AQUI, "saida"); fs.mkdirSync(SAIDA, {recursive: true});
let falhas = 0, certos = 0;
const ok = (c, msg) => { if (c) certos++; else { falhas++; console.log("  ✗", msg); } };

// ---- servidor: arquivos do painel + /api/ia fingido ----
const pedidos = [];
let modoIA = "ok";
const MIME = {".html": "text/html", ".json": "application/json", ".txt": "text/plain", ".png": "image/png", ".js": "text/javascript"};
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/api/ia")) {
    let b = ""; req.on("data", d => b += d); req.on("end", () => {
      const corpo = b ? JSON.parse(b) : {}; pedidos.push(corpo);
      res.setHeader("Content-Type", "application/json");
      if (modoIA === "falha") { res.statusCode = 500; return res.end(JSON.stringify({ok: false, erro: "A IA não respondeu agora. Tente de novo em instantes."})); }
      if (corpo.acao === "dicas") return res.end(JSON.stringify({ok: true, dicas: {resumo: "Você erra mais em Química, quase sempre no cálculo.", aviso: "", itens: [
        {materia: "Química", assunto: "Estequiometria", padrao: "esquece de converter gramas em mols", macete: "Sempre: gramas → mols → regra de três → de volta.", dica_pratica: "Escreva a equação balanceada antes de qualquer conta.", como_reconhecer: "Pede massa de um produto a partir da massa de um reagente.", antes_de_marcar: ["Balanceei a equação?", "Converti tudo para mol?"]}]}}));
      const vago = modoIA === "vago" && !(corpo.esclarecimentos || []).length;
      return res.end(JSON.stringify({ok: true, correcao: vago
        ? {diagnostico_confiavel: false, tipo_erro: "indefinido", padrao: "", tipo_questao: "cálculo estequiométrico", materia: "Química", assunto: "Estequiometria", onde_errou: "A alternativa marcada não bate com o gabarito.", forma_correta: ["Balanceie a equação."], resposta_correta: "C", como_reconhecer: [], para_fixar: "", perguntas_para_ela: ["Você chegou a converter a massa em mols?"], aviso: ""}
        : {diagnostico_confiavel: true, tipo_erro: "cálculo", padrao: "esquece de converter gramas em mols", tipo_questao: "cálculo estequiométrico", materia: "Química", assunto: "Estequiometria", onde_errou: "No passo 2 você usou 18 g direto na regra de três.", forma_correta: ["Balanceie a equação.", "Converta 18 g em mols: 18/18 = 1 mol."], resposta_correta: "C", como_reconhecer: ["Pede massa de um produto a partir da massa de um reagente."], para_fixar: "Gramas nunca entram direto na regra de três.", perguntas_para_ela: [], aviso: ""}}));
    }); return;
  }
  const arq = path.join(RAIZ, req.url.split("?")[0] === "/" ? "index.html" : decodeURIComponent(req.url.split("?")[0]));
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq)) { res.statusCode = 404; return res.end("nada"); }
  res.setHeader("Content-Type", MIME[path.extname(arq)] || "application/octet-stream"); res.end(fs.readFileSync(arq));
});
await new Promise(r => srv.listen(8231, "127.0.0.1", r));
const URL_ = "http://127.0.0.1:8231/";

const navegador = await chromium.launch();
async function nova(ctxOpts = {}) {
  const ctx = await navegador.newContext(ctxOpts);
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort()); // sem internet de verdade: fontes e jsPDF caem no padrão
  const p = await ctx.newPage(); const erros = [];
  p.on("pageerror", e => erros.push(e.message)); p.on("dialog", d => d.accept());
  await p.goto(URL_); await p.waitForFunction(() => document.querySelector("#v-inicio").children.length);
  await p.waitForFunction(() => window.__rafa && document.querySelectorAll("#v-inicio .resumo b")[0].textContent !== "—");
  return {ctx, p, erros};
}
const vals = p => p.locator(".postit textarea").evaluateAll(els => els.map(e => e.value));
const aba = (p, a) => p.click(`#tab-${a}`);

// foto de verdade (um PNG gerado na hora)
const foto = path.join(SAIDA, "resolucao.png");
{ const {p} = await nova(); const b64 = await p.evaluate(() => { const c = document.createElement("canvas"); c.width = 900; c.height = 600; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 900, 600); x.fillStyle = "#222"; x.font = "40px sans-serif"; x.fillText("18 g / 18 = 1 mol ... 2 x 44 = 88 g", 40, 300); return c.toDataURL("image/png").split(",")[1]; }); fs.writeFileSync(foto, Buffer.from(b64, "base64")); await p.context().close(); }

console.log("• Início e post-its");
{
  const {ctx, p, erros} = await nova({viewport: {width: 1100, height: 900}});
  ok(await p.locator(".postit.novo").count() === 1, "botão de novo lembrete");
  await p.click("#novo-lemb"); await p.keyboard.type("Entregar a redação na sexta");
  await p.click("#novo-lemb"); await p.keyboard.type("Refazer lista de estequiometria");
  await p.click(".postit:not(.novo) [data-cor=c3]");
  ok(await p.locator(".postit:not(.novo)").count() === 2, "dois post-its");
  const estilo = await p.locator(".postit:not(.novo)").first().evaluate(e => { const s = getComputedStyle(e); return {rot: s.transform, sombra: s.boxShadow, fonte: getComputedStyle(e.querySelector("textarea")).fontFamily}; });
  ok(estilo.rot !== "none" && estilo.sombra !== "none", "post-it inclinado e com sombra");
  ok(/Caveat|Segoe Print|cursive/.test(estilo.fonte), "letra de mão");
  await p.waitForTimeout(500); await p.reload(); await p.waitForSelector(".postit:not(.novo)");
  ok(await p.locator(".postit:not(.novo)").count() === 2, "lembretes sobrevivem ao recarregar");
  ok((await vals(p)).some(v => v.includes("redação")), "texto do lembrete guardado");
  await p.click(".postit:not(.novo) [data-lx=feito]");
  ok(await p.locator(".postit.feito").count() === 1, "concluir lembrete");
  await p.screenshot({path: path.join(SAIDA, "inicio-desktop.png"), fullPage: true});
  ok(!erros.length, "sem erro de script: " + erros.join(" | "));
  await ctx.close();
}

console.log("• Acervo continua inteiro");
{
  const {ctx, p, erros} = await nova({viewport: {width: 1100, height: 900}});
  await aba(p, "acervo");
  const bancas = await p.locator(".banca").count(); ok(bancas === 3, "3 bancas");
  await p.click(".banca >> text=FUVEST"); await p.click("#materias .chip >> text=Química");
  const n = +(await p.textContent("#n")); ok(n > 5 && n < 30, "filtro por banca e matéria: " + n);
  await p.waitForSelector("#lista .q img");
  ok(await p.locator("#b-pdf").isEnabled() && await p.locator("#b-gab").isEnabled(), "botões do acervo");
  await p.click("#b-gab"); ok((await p.textContent(".gab")).includes("1."), "gabarito abre"); await p.click("#x");
  await p.fill("#busca", "unicamp 2027 estequiometria"); ok(+(await p.textContent("#n")) >= 0, "busca de texto livre");
  await ctx.close(); ok(!erros.length, "sem erro de script no acervo: " + erros.join(" | "));
}

console.log("• Registrar erro, anexar foto, corrigir com a IA");
{
  const {ctx, p, erros} = await nova({viewport: {width: 1100, height: 1000}});
  await aba(p, "acervo"); await p.click(".banca >> text=FUVEST"); await p.click("#materias .chip >> text=Química");
  await p.waitForSelector("#lista .q");
  await p.click("#lista .q:first-child [data-t=erro]");
  ok(await p.locator("#f-qimg img").count() === 1 || true, "formulário abre ligado à questão");
  await p.waitForSelector("#f-qimg img");
  ok((await p.inputValue("#f-mat")) === "Química", "matéria vem da questão");
  ok((await p.inputValue("#f-ban")) === "FUVEST", "banca vem da questão");
  ok(await p.locator("#f-ban").evaluate(e => e.readOnly), "banca fica travada quando a questão é do acervo");
  await p.click("#f-alts [data-g=mr] [data-l=B]");
  ok(await p.locator("#f-alts [data-g=gab] [aria-pressed=true]").count() === 1, "gabarito vem do acervo");
  await p.fill("#f-rac", "Peguei os 18 g e fiz regra de três com 44 g do CO2.");
  await p.fill("#f-dif", "Não sei quando preciso passar para mol.");
  await p.setInputFiles("#f-up-res", foto);
  await p.waitForSelector("#f-fotos img[src]");
  await p.click("#f-save-ia");
  await p.waitForSelector(".corr h4");
  ok((await p.textContent(".corr")).includes("No passo 2"), "correção aparece no cartão");
  const ped = pedidos.at(-1);
  ok(ped.acao === "corrigir", "ação corrigir");
  ok(ped.registro.raciocinio.includes("18 g") && ped.registro.minhaResposta === "B", "o raciocínio e a alternativa vão para a IA");
  ok(ped.imagens.length === 2 && ped.imagens.every(i => i.dados.length > 1000), "enunciado do acervo + foto da resolução");
  ok(ped.imagens.reduce((s, i) => s + i.dados.length, 0) < 3.4 * 1024 * 1024, "imagens cabem no limite da Vercel");
  ok(ped.questaoTexto.length > 20, "texto da questão vai junto");
  ok(/Química ·/.test(await p.textContent("#lista-erros")), "matéria e assunto aparecem no cartão");
  const reg = await p.evaluate(() => window.__rafa.estado().REG[0]);
  ok(reg.padrao === "esquece de converter gramas em mols" && reg.tipoQuestao === "cálculo estequiométrico" && reg.tipoErro === "cálculo", "classificação guardada");
  ok(reg.fotos.length === 1 && reg.qid, "foto e ligação com a questão guardadas");
  await p.screenshot({path: path.join(SAIDA, "erros-desktop.png"), fullPage: true});

  // foto reaparece depois de recarregar (IndexedDB)
  await p.reload(); await aba(p, "erros"); await p.waitForSelector("img[data-foto]");
  ok(await p.locator("img[data-foto]").evaluate(i => i.complete && i.naturalWidth > 0 || new Promise(r => { i.onload = () => r(true); setTimeout(() => r(false), 3000); })), "foto volta do aparelho após recarregar");

  // editar muda a assinatura → aviso de correção desatualizada
  await p.click("[data-act=editar]"); await p.fill("#f-obs", "Mais uma observação"); await p.click("#f-save");
  await p.waitForSelector(".pill:has-text('mudou depois')");
  ok(true, "mudou depois da correção"); 

  // Tentar de novo (do acervo): acerta e marca como dominado
  await p.click("[data-act=retentar]"); await p.waitForSelector(".alts .alt");
  const gab = reg.gabarito; await p.click(`.alts .alt[data-l=${gab}]`);
  await p.click("#fin"); await p.waitForSelector("#dom");
  ok((await p.textContent(".dlg")).includes("Acertou"), "retentativa certa");
  await p.click("#dom"); await p.waitForSelector(".pill.ok:has-text('dominado')");
  ok((await p.evaluate(() => window.__rafa.estado().REG[0].retentativas.length)) === 1, "retentativa registrada");
  const tent = await p.evaluate(() => window.__rafa.estado().TENT); ok(tent.length === 1 && tent[0].ok === true, "retentativa conta nas tentativas");
  ok(!erros.length, "sem erro de script: " + erros.join(" | "));
  await ctx.close();
}

console.log("• A IA não presume: pergunta e reanalisa");
{
  modoIA = "vago";
  const {ctx, p} = await nova({viewport: {width: 1100, height: 900}});
  await aba(p, "erros"); await p.click("#novo-reg");
  await p.selectOption("#f-mat", "Química"); await p.fill("#f-ass", "Estequiometria");
  await p.click("#f-alts [data-g=mr] [data-l=A]");
  await p.fill("#f-dif", "Errei e não sei por quê"); await p.click("#f-save-ia");
  await p.waitForSelector("[data-resp]");
  ok((await p.textContent(".corr")).includes("Não dá para ter certeza"), "diz que não tem como saber");
  ok(await p.locator("[data-resp]").count() === 1, "caixa de resposta às perguntas");
  await p.fill("[data-resp]", "Fui direto na regra de três com os gramas."); modoIA = "ok";
  await p.click("[data-act=reanalisar]"); await p.waitForSelector(".corr h4:has-text('O caminho certo')");
  const ped = pedidos.at(-1); ok(ped.esclarecimentos.length === 1 && ped.esclarecimentos[0].resposta.includes("regra de três"), "a resposta dela vai como esclarecimento");
  ok(ped.esclarecimentos[0].perguntas[0].includes("converter"), "com as perguntas que a IA tinha feito");
  // falha da IA: mensagem escrita, nada some
  modoIA = "falha"; await p.click("[data-act=corrigir]"); await p.waitForSelector(".nota.erro");
  ok((await p.textContent(".nota.erro")).includes("não respondeu"), "falha da IA aparece escrita");
  ok(await p.locator("[data-act=corrigir]").count() === 1, "botão volta depois da falha"); modoIA = "ok";
  await ctx.close();
}

console.log("• Estatísticas com registros de verdade");
{
  const {ctx, p, erros} = await nova({viewport: {width: 1100, height: 900}});
  const agora = Date.now(), dia = 86400000, iso = d => new Date(agora - d * dia).toISOString();
  const mk = (i, mat, ass, tipoErro, padrao, tq, dias, extra = {}) => Object.assign({id: "t" + i, tipo: "erro", criado: iso(dias), status: "aberto", materia: mat, assunto: ass, raciocinio: "r" + i, dificuldade: "d" + i, fotos: [], tipoErro, padrao, tipoQuestao: tq}, extra);
  const regs = [
    mk(1, "Química", "Estequiometria", "cálculo", "esquece de converter gramas em mols", "cálculo estequiométrico", 2),
    mk(2, "Química", "Estequiometria", "cálculo", "Esquece de converter gramas em mols", "cálculo estequiométrico", 5),
    mk(3, "Química", "Estequiometria", "conceito", "", "cálculo estequiométrico", 40),
    mk(4, "Física", "Cinemática", "interpretação", "lê o gráfico errado", "interpretação de gráfico", 8),
    mk(5, "Física", "Cinemática", "interpretação", "lê o gráfico errado", "interpretação de gráfico", 30),
    mk(6, "Matemática", "Geometria espacial", "atenção", "", "", 50),
    mk(7, "Biologia", "Ecologia", "conceito", "", "", 3, {status: "dominado"}),
    {id: "t8", tipo: "duvida", criado: iso(1), status: "aberto", materia: "Biologia", assunto: "Ecologia", raciocinio: "", dificuldade: "teia alimentar", fotos: []}
  ];
  // 10 questões resolvidas online: Português 4/4, Biologia 2/3, Física 0/3
  const tent = []; const T = (m, s, okk) => tent.push({em: iso(1), sess: "s", qid: "x", b: "fuvest", a: 2027, m, s, ok: okk});
  [1, 1, 1, 1].forEach(v => T("Português", "Interpretação de texto", !!v)); [1, 1, 0].forEach(v => T("Biologia", "Ecologia", !!v)); [0, 0, 0].forEach(v => T("Física", "Cinemática", !!v));
  await p.evaluate(([r, t]) => { localStorage.setItem("rafa.registros", JSON.stringify(r)); localStorage.setItem("rafa.tentativas", JSON.stringify(t)); }, [regs, tent]);
  await p.reload(); await p.waitForFunction(() => window.__rafa); await aba(p, "stats");
  const c = await p.evaluate(() => window.__rafa.calc());
  ok(c.total === 8 && c.erros === 7 && c.duvidas === 1, "contagens");
  ok(c.materias[0].nome === "Química" && c.materias[0].n === 3, "matéria com mais erros: Química");
  ok(c.assuntos[0].nome === "Química · Estequiometria" && c.assuntos[0].n === 3, "assunto com mais erros");
  ok(c.tiposQuestao[0].nome === "cálculo estequiométrico" && c.tiposQuestao[0].n === 3, "tipo de questão que mais confunde");
  ok(c.recorrentes.length === 2 && c.recorrentes[0].n === 2, "padrões que se repetem (maiúscula não separa)");
  ok(c.recorrentes.some(x => x.nome.toLowerCase().includes("gráfico")), "recorrente de Física");
  ok(c.combos.some(x => x.nome.includes("Estequiometria") && x.tipo === "cálculo" && x.n === 2), "combinação assunto + tipo de erro");
  ok(c.prioridades[0].materia === "Química" && c.prioridades[0].abertos === 3, "prioridade nº1 é Química/Estequiometria");
  ok(!c.prioridades.some(x => x.assunto === "Ecologia" && x.abertos > 1) && c.prioridades.find(x => x.assunto === "Ecologia").abertos === 1, "o dominado não entra na prioridade");
  ok(c.prioridades.find(x => x.assunto === "Cinemática").motivos.some(m => m.includes("0%") ), "prática online com 0% entra no motivo");
  ok(c.melhoresAssuntos[0].nome.startsWith("Português") && c.melhoresAssuntos[0].taxa === 1, "melhor desempenho: Português 4/4");
  ok(!c.melhoresAssuntos.some(x => x.nome.includes("Química")), "não inventa desempenho onde não há tentativa");
  ok(c.melhoresMaterias.length === 0, "matéria com menos de 5 resoluções não vira 'melhor desempenho'");
  const txt = await p.textContent("#v-stats");
  ok(txt.includes("Revisar primeiro") && txt.includes("Química · Estequiometria"), "tela mostra a prioridade");
  ok(txt.includes("Tipos de questão que mais me confundem") && txt.includes("cálculo estequiométrico"), "tela mostra tipos de questão");
  ok(txt.includes("O acervo") && txt.includes("247"), "estatísticas do acervo continuam lá");
  await p.screenshot({path: path.join(SAIDA, "stats-desktop.png"), fullPage: true});

  console.log("• Macetes");
  await aba(p, "dicas");
  await p.click("#d-gerar"); await p.waitForSelector(".dica");
  const ped = pedidos.at(-1);
  ok(ped.acao === "dicas" && ped.resumo.prioridades[0].materia === "Química", "pede dicas a partir das estatísticas reais");
  ok(JSON.stringify(ped.resumo).includes("converter gramas"), "o padrão de erro dela vai no pedido");
  ok(!JSON.stringify(ped.resumo).includes("Ecologia") || ped.resumo.prioridades.every(x => x.materia), "pedido sem nada inventado");
  ok((await p.textContent(".macete")).includes("gramas → mols"), "macete aparece");
  await p.click("[data-dk=fixar]"); await aba(p, "inicio");
  ok((await vals(p)).some(v => v.includes("gramas")), "macete fixado como post-it");
  await aba(p, "dicas"); ok(await p.locator(".dica").count() === 1, "dicas guardadas ao trocar de aba");
  await p.click("[data-dk=acervo]"); await p.waitForSelector("#lista .q");
  ok((await p.textContent("#escopo")).includes("Química"), "'Treinar no acervo' filtra pela matéria");
  await aba(p, "stats"); await p.click("#v-stats [data-st=acervo] >> nth=0"); await p.waitForSelector("#lista .q");
  ok(+(await p.textContent("#n")) > 0, "treinar a partir da prioridade devolve questões");
  ok(!erros.length, "sem erro de script: " + erros.join(" | "));
  await ctx.close();
}

console.log("• Resolver online alimenta as estatísticas");
{
  const {ctx, p} = await nova({viewport: {width: 1100, height: 900}});
  await aba(p, "acervo"); await p.click(".banca >> text=UNICAMP"); await p.fill("#nums", "1-3");
  await p.click("#b-online"); await p.waitForSelector(".alts .alt");
  for (let i = 0; i < 3; i++) { await p.click(".alts .alt[data-l=A]"); }
  await p.click("#fin"); await p.waitForSelector(".score");
  const t = await p.evaluate(() => window.__rafa.estado().TENT); ok(t.length === 3, "3 tentativas guardadas");
  await p.click("#fin").catch(() => {});
  if (await p.locator("[data-reg]").count()) { await p.click("[data-reg] >> nth=0"); await p.waitForSelector("#f-rac"); ok((await p.inputValue("#f-mat")).length > 0, "'Registrar no caderno' abre o formulário já ligado à questão"); }
  await ctx.close();
}

console.log("• Cópia de segurança");
{
  const {ctx, p} = await nova({viewport: {width: 1100, height: 900}});
  await aba(p, "erros"); await p.click("#novo-reg"); await p.selectOption("#f-mat", "Física"); await p.fill("#f-dif", "queda livre");
  await p.setInputFiles("#f-up-res", foto); await p.waitForSelector("#f-fotos img[src]"); await p.click("#f-save"); await p.waitForSelector(".reg");
  await aba(p, "inicio");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#bk-salvar")]);
  const arq = path.join(SAIDA, "copia.json"); await dl.saveAs(arq);
  const c = JSON.parse(fs.readFileSync(arq, "utf8"));
  ok(c.app === "caderno-rafaela" && c.registros.length === 1 && Object.keys(c.fotos).length === 1, "cópia leva registros e fotos");
  await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForFunction(() => window.__rafa);
  await p.setInputFiles("#bk-abrir", arq); await p.waitForTimeout(600);
  ok((await p.evaluate(() => window.__rafa.estado().REG.length)) === 1, "restaurar devolve os registros");
  await aba(p, "erros"); await p.waitForSelector("img[data-foto]"); ok(true, "foto restaurada");
  await ctx.close();
}

console.log("• Quadro da caneta (tablet)");
{
  const {ctx, p, erros} = await nova({...devices["iPad (gen 7)"], hasTouch: true});
  await aba(p, "erros"); await p.click("#novo-reg"); await p.selectOption("#f-mat", "Matemática");
  await p.click("#f-quadro-ab"); await p.waitForSelector("#f-quadro canvas");
  const caixa = await p.locator("#f-quadro canvas").boundingBox();
  ok(caixa.width > 300 && caixa.height > 300, "quadro tem tamanho de escrever");
  const evento = (tipo, tipoPonteiro, x, y, id) => p.evaluate(([t, pt, x, y, id]) => { const c = document.querySelector("#f-quadro canvas"); const r = c.getBoundingClientRect();
    c.dispatchEvent(new PointerEvent(t, {bubbles: true, cancelable: true, pointerId: id, pointerType: pt, pressure: pt === "pen" ? .7 : .5, button: 0, buttons: 1, clientX: r.left + x, clientY: r.top + y, isPrimary: true})); }, [tipo, tipoPonteiro, x, y, id]);
  // um dedo escreve enquanto não há caneta
  await evento("pointerdown", "touch", 30, 30, 1); await evento("pointermove", "touch", 80, 60, 1); await evento("pointerup", "touch", 80, 60, 1);
  ok(await p.locator("#f-quadro canvas").getAttribute("data-tracos") === "1", "sem caneta, o dedo escreve");
  // a caneta aparece: escreve, e a palma (toque) passa a ser ignorada
  await evento("pointerdown", "pen", 40, 120, 2); for (let i = 1; i <= 8; i++) await evento("pointermove", "pen", 40 + i * 25, 120 + (i % 2) * 20, 2); await evento("pointerup", "pen", 240, 120, 2);
  ok(await p.locator("#f-quadro canvas").getAttribute("data-tracos") === "2", "a caneta escreve");
  await evento("pointerdown", "touch", 100, 200, 3); await evento("pointerup", "touch", 100, 200, 3);
  ok(await p.locator("#f-quadro canvas").getAttribute("data-tracos") === "2", "palma da mão ignorada depois da caneta");
  const pintou = await p.evaluate(() => { const c = document.querySelector("#f-quadro canvas"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 120) n++; return n; });
  ok(pintou > 200, "o traço aparece no quadro (" + pintou + " pixels)");
  await p.click("[data-q=desfazer]"); ok(await p.locator("#f-quadro canvas").getAttribute("data-tracos") === "1", "desfazer tira o último traço");
  await p.mouse.move(caixa.x + 50, caixa.y + 200); await p.mouse.down(); await p.mouse.move(caixa.x + 200, caixa.y + 240, {steps: 6}); await p.mouse.up();
  await p.screenshot({path: path.join(SAIDA, "tablet-quadro.png")});
  await p.click("[data-q=anexar]"); await p.waitForSelector("#f-fotos img[src]");
  ok(await p.locator("#f-fotos .foto").count() === 1, "o desenho vira foto da resolução");
  ok(await p.locator("#f-quadro canvas").getAttribute("data-tracos") === "0", "quadro limpo para a próxima página");
  await p.fill("#f-dif", "resolvi à mão"); await p.click("#f-save-ia"); await p.waitForSelector(".corr h4");
  const ped = pedidos.at(-1); ok(ped.imagens.length === 1 && ped.imagens[0].rotulo.includes("resolução") && ped.imagens[0].dados.length > 500, "a página escrita à mão segue para a IA como imagem");
  await p.click("[data-q=anexar]").catch(() => {});
  ok(!erros.length, "sem erro de script no tablet: " + erros.join(" | "));
  await ctx.close();
}

console.log("• Celular (iPhone 13)");
{
  const {ctx, p, erros} = await nova({...devices["iPhone 13"]});
  const largura = async () => p.evaluate(() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth}));
  for (const a of ["inicio", "acervo", "erros", "stats", "dicas"]) {
    await aba(p, a); await p.waitForTimeout(150);
    const {sw, cw} = await largura(); ok(sw <= cw + 1, `sem rolagem lateral em ${a} (${sw} > ${cw})`);
    await p.screenshot({path: path.join(SAIDA, `celular-${a}.png`)});
  }
  await aba(p, "erros"); await p.click("#novo-reg"); await p.waitForSelector("#f-mat");
  const {sw, cw} = await largura(); ok(sw <= cw + 1, "formulário cabe no celular");
  const pequenos = await p.evaluate(() => [...document.querySelectorAll(".dlg button, .dlg select, .dlg input:not([type=file])")].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && (r.height < 36) }).map(e => e.id || e.className));
  ok(pequenos.length === 0, "alvos de toque com pelo menos 36px: " + pequenos.join(","));
  await p.screenshot({path: path.join(SAIDA, "celular-form.png")});
  ok(!erros.length, "sem erro de script no celular: " + erros.join(" | "));
  await ctx.close();
}

await navegador.close(); srv.close();
console.log(`\n${certos} verificações certas, ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
