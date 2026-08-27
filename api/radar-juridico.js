// ══ RADAR JURÍDICO DIÁRIO ════════════════════════════════════════════════
//
// A varredura da manhã: lê as fontes oficiais, manda para a IA fazer a
// triagem com o prompt do `lib/radar-prompt.js` e grava o dia em
// /radar-juridico/{AAAA-MM-DD}. O painel lê esse nó e desenha o Jornal da
// equipe no cabeçalho.
//
// Quem chama é o cron da Vercel (ver `crons` no vercel.json). Também dá para
// rodar na mão pelo navegador, com a chave:
//   /api/radar-juridico?chave=...            → roda o dia de hoje
//   /api/radar-juridico?chave=...&forcar=1   → roda de novo por cima
//   /api/radar-juridico?chave=...&semear=1   → só planta a base de regras
//
// Três coisas que este arquivo NÃO faz, e que estão aqui escritas porque a
// tentação de fazer existe:
//
//   1. **Não apaga o dia anterior.** Cada dia é uma chave própria, e a
//      memória dos últimos dias volta para a IA no pedido seguinte. Sem isso
//      a mesma mudança seria "novidade" todo dia até alguém desconfiar.
//   2. **Não escreve por cima da base de regras.** O que o Radar aprende
//      entra em /base-regras/{tema}/atualizacoes/{data}. O `resumo` e o
//      `naMesa` conferidos à mão ficam intactos — mesma regra do lápis da
//      Rede.
//   3. **Não esconde fonte que não respondeu.** Silêncio de site não é
//      ausência de novidade; o dia é gravado dizendo o que não foi lido.

const https = require("https");
const { FONTES_RADAR, TERMOS_RADAR } = require("../lib/radar-fontes");
const { RADAR_SYSTEM_PROMPT } = require("../lib/radar-prompt");
const { BASE_REGRAS_INICIAL } = require("../lib/base-regras-inicial");
const { hojeEmSP, soOTexto, lerJson, conferirItem, contar, chaveDoTema } = require("../lib/radar-triagem");

const FIREBASE_HOST = "painel-cartorio-default-rtdb.firebaseio.com";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODELO = "claude-sonnet-4-6";

// Quanto de cada página vai para a IA. Homepage de tribunal é quase toda
// menu e rodapé; o que interessa (as manchetes) está no começo do texto.
const LIMITE_POR_FONTE = 6000;
// Quantos dias de memória voltam no pedido. Uma semana cobre o vaivém de
// "publicado sexta, repercutido segunda" sem estourar o contexto.
const DIAS_DE_MEMORIA = 7;
const ESPERA_FONTE_MS = 9000;

// ── Firebase por REST ────────────────────────────────────────────────────
// Mesmo caminho do bot do WhatsApp: sem conta, sem SDK. Ver FIREBASE.md.
function firebase(caminho, metodo, corpo) {
  return new Promise((resolve) => {
    const payload = corpo ? JSON.stringify(corpo) : null;
    const options = { method: metodo, headers: { "Content-Type": "application/json" } };
    if (payload) options.headers["Content-Length"] = Buffer.byteLength(payload);
    const r = https.request(`https://${FIREBASE_HOST}/${caminho}`, options, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    r.on("error", () => resolve(null));
    if (payload) r.write(payload);
    r.end();
  });
}

// ── Ler uma fonte ────────────────────────────────────────────────────────
// Site de tribunal cai, muda de endereço e demora. Nada disso pode derrubar
// a varredura inteira: fonte que falha volta como `erro` e vira uma linha no
// relatório do dia.
function baixar(url, saltos = 0) {
  return new Promise((resolve) => {
    let respondeu = false;
    const acabou = (r) => { if (!respondeu) { respondeu = true; resolve(r); } };
    let req;
    try {
      req = https.get(url, {
        headers: {
          // Sem isto vários portais devolvem 403 para o que parece robô.
          "User-Agent": "Mozilla/5.0 (compatible; RadarJuridico/1.0; painel do 20o Tabeliao de Notas de Sao Paulo)",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "pt-BR,pt;q=0.9"
        }
      }, (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location && saltos < 3) {
          res.resume();
          const destino = new URL(res.headers.location, url).toString();
          return baixar(destino, saltos + 1).then(acabou);
        }
        if (status !== 200) { res.resume(); return acabou({ erro: "respondeu " + status }); }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", d => {
          data += d;
          // Não adianta guardar 3 MB de portal para mandar 6 KB.
          if (data.length > LIMITE_POR_FONTE * 12) { req.destroy(); acabou({ html: data }); }
        });
        res.on("end", () => acabou({ html: data }));
      });
    } catch (e) { return acabou({ erro: e.message }); }
    req.on("error", (e) => acabou({ erro: e.message }));
    req.setTimeout(ESPERA_FONTE_MS, () => { req.destroy(); acabou({ erro: "não respondeu a tempo" }); });
  });
}

async function lerFonte(fonte) {
  const r = await baixar(fonte.url);
  if (!r || r.erro) return { ...fonte, erro: (r && r.erro) || "não respondeu" };
  const texto = soOTexto(r.html).slice(0, LIMITE_POR_FONTE);
  if (!texto) return { ...fonte, erro: "respondeu vazio" };
  return { ...fonte, texto };
}

// ── A memória ────────────────────────────────────────────────────────────
// O que já foi reportado. Vai resumido: título, selo e referência bastam
// para a IA reconhecer o que é repetição e o que é andamento.
async function lerMemoria() {
  const bruto = await firebase(
    `radar-juridico.json?orderBy=%22%24key%22&limitToLast=${DIAS_DE_MEMORIA}`, "GET");
  if (!bruto || typeof bruto !== "object") return [];
  return Object.keys(bruto).sort().map(data => ({
    data,
    itens: (bruto[data] && Array.isArray(bruto[data].itens) ? bruto[data].itens : [])
      .filter(i => i && i.selo !== "⚪")
      .map(i => ({ selo: i.selo, titulo: i.titulo, referencia: i.referencia, especie: i.especie }))
  })).filter(d => d.itens.length);
}

// ── A IA ─────────────────────────────────────────────────────────────────
function chamarClaude(mensagem, maxTokens) {
  return new Promise((resolve, reject) => {
    if (!ANTHROPIC_API_KEY) return reject(new Error("ANTHROPIC_API_KEY não configurada"));
    const body = JSON.stringify({
      model: MODELO,
      max_tokens: maxTokens || 6000,
      system: RADAR_SYSTEM_PROMPT,
      messages: [{ role: "user", content: mensagem }]
    });
    const req = https.request({
      hostname: "api.anthropic.com", path: "/v1/messages", method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body)
      }
    }, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try {
          const p = JSON.parse(data);
          if (p.error) return reject(new Error(p.error.message || "erro na API Claude"));
          resolve((p.content && p.content[0] && p.content[0].text) || "");
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// O guarda-corpo da triagem (item que fala em dispensa sem dizer o que
// continua exigido, notícia querendo virar 🔴) mora no lib/radar-triagem.js,
// que é onde ele pode ser testado sem internet. Ver testes/radar-triagem.mjs.

// ── A base de regras ─────────────────────────────────────────────────────
async function semearBase() {
  const atual = await firebase("base-regras.json?shallow=true", "GET");
  const jaTem = atual && typeof atual === "object" ? Object.keys(atual) : [];
  const plantados = [];
  for (const tema of Object.keys(BASE_REGRAS_INICIAL)) {
    if (jaTem.includes(tema)) continue;
    await firebase(`base-regras/${tema}.json`, "PUT", Object.assign(
      {}, BASE_REGRAS_INICIAL[tema],
      { tema, origem: "carga inicial", atualizadoEm: hojeEmSP() }));
    plantados.push(tema);
  }
  return plantados;
}

// O que o Radar aprendeu vira uma linha datada dentro do tema — nunca o
// corpo do tema. Tema que ainda não existe nasce só com o que foi aprendido,
// marcado como vindo do Radar, para ninguém confundir com o conferido à mão.
async function alimentarBase(propostas, data) {
  if (!Array.isArray(propostas) || !propostas.length) return [];
  const gravados = [];
  for (const p of propostas) {
    const tema = chaveDoTema(p && p.tema);
    if (!tema || !p.novidade) continue;
    const existe = await firebase(`base-regras/${tema}/titulo.json`, "GET");
    if (existe == null) {
      await firebase(`base-regras/${tema}.json`, "PUT", {
        tema,
        titulo: p.titulo || tema,
        resumo: "",
        origem: "radar",
        atualizadoEm: data
      });
    }
    await firebase(`base-regras/${tema}/atualizacoes/${data}.json`, "PUT", {
      data, texto: p.novidade, origem: "radar"
    });
    await firebase(`base-regras/${tema}/atualizadoEm.json`, "PUT", data);
    gravados.push(tema);
  }
  return gravados;
}

// ── A varredura ──────────────────────────────────────────────────────────
async function varrer(data) {
  const lidas = await Promise.all(FONTES_RADAR.map(lerFonte));
  const comTexto = lidas.filter(f => f.texto);
  const falharam = lidas.filter(f => !f.texto);

  if (!comTexto.length) {
    // Nenhuma fonte respondeu. Gravar "dia calmo" seria mentira: o dia não
    // foi lido. Fica registrado como falha, e a tela diz isso.
    return {
      data, gerado: new Date().toISOString(), status: "falhou",
      resumo: "Nenhuma fonte respondeu hoje — o dia não foi lido.",
      alerta: null, itens: [],
      fontesNaoLidas: falharam.map(f => ({ id: f.id, nome: f.nome, erro: f.erro })),
      relatorio: "A varredura não conseguiu ler nenhuma das fontes hoje. Isso não quer dizer que nada mudou: quer dizer que ninguém olhou. Vale abrir a Corregedoria e o CNJ na mão."
    };
  }

  const memoria = await lerMemoria();
  const mensagem =
`DATA DE HOJE: ${data}

TERMOS DE FILTRO DO DIÁRIO OFICIAL:
${TERMOS_RADAR.join(" · ")}

JÁ REPORTADO NOS ÚLTIMOS DIAS (memória — não repita como novidade):
${memoria.length
  ? memoria.map(d => `${d.data}\n` + d.itens.map(i => `  ${i.selo} [${i.especie}] ${i.titulo} — ${i.referencia || "sem referência"}`).join("\n")).join("\n")
  : "Nada reportado ainda: esta é a primeira varredura."}

FONTES QUE NÃO RESPONDERAM HOJE:
${falharam.length ? falharam.map(f => `- ${f.nome} (${f.id}): ${f.erro}`).join("\n") : "Nenhuma — todas responderam."}

CONTEÚDO LIDO HOJE:
${comTexto.map(f =>
`──────────────────────────────────────────
FONTE: ${f.nome}
id: ${f.id} · ${f.primaria ? "PRIMÁRIA" : "DE ALERTA (não basta sozinha)"} · prioridade ${f.prioridade}
o que procurar aqui: ${f.procurar}
──────────────────────────────────────────
${f.texto}`).join("\n\n")}

Faça a triagem do dia e responda no formato JSON combinado.`;

  const bruto = await chamarClaude(mensagem);
  const j = lerJson(bruto);

  const itens = (Array.isArray(j.itens) ? j.itens : []).map(conferirItem);
  return {
    data,
    gerado: new Date().toISOString(),
    status: "ok",
    resumo: String(j.resumo || "").trim() || "Sem novidade que mude a mesa hoje.",
    alerta: j.alerta ? String(j.alerta).trim() : null,
    itens,
    contagem: contar(itens),
    fontesLidas: comTexto.map(f => f.id),
    fontesNaoLidas: falharam.map(f => ({ id: f.id, nome: f.nome, erro: f.erro })),
    relatorio: String(j.relatorio || "").trim(),
    baseRegras: Array.isArray(j.baseRegras) ? j.baseRegras : []
  };
}

// ── O índice ────────────────────────────────────────────────────────────
// O painel não tem login e lê o Radar direto do banco. Se ele tivesse de
// baixar o nó inteiro para desenhar a faixa do cabeçalho, cada abertura do
// painel puxaria um ano de relatórios para mostrar uma frase. Por isso o dia
// cheio mora em /radar-juridico/{data} e só é lido quando alguém abre; o que
// o painel escuta o tempo todo é este índice, que é uma linha por dia.
async function gravarIndice(dia) {
  await firebase(`radar-juridico-meta/dias/${dia.data}.json`, "PUT", {
    data: dia.data,
    status: dia.status,
    resumo: dia.resumo,
    alerta: dia.alerta || null,
    contagem: dia.contagem || { muda: 0, breve: 0, saber: 0, fora: 0 },
    naoLidas: (dia.fontesNaoLidas || []).length
  });
  await firebase("radar-juridico-meta/ultimaVarredura.json", "PUT", dia.gerado);
  await firebase("radar-juridico-meta/ultimoDia.json", "PUT", dia.data);
  await firebase("radar-juridico-meta/status.json", "PUT", dia.status);
}

// ── A porta ──────────────────────────────────────────────────────────────
// O cron da Vercel manda `Authorization: Bearer $CRON_SECRET`. Na mão, vale
// `?chave=`. Sem CRON_SECRET configurado a porta fica aberta — e o log diz
// isso, para não virar segredo que ninguém sabe que não existe.
function autorizado(req) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return true;
  const cab = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (cab && cab === `Bearer ${segredo}`) return true;
  const url = new URL(req.url, "http://x");
  return url.searchParams.get("chave") === segredo;
}

module.exports = async (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ ok: false, erro: "não autorizado" });
  if (!process.env.CRON_SECRET) console.log("[radar] CRON_SECRET não configurada — a rota está aberta.");

  const url = new URL(req.url, "http://x");
  const data = url.searchParams.get("data") || hojeEmSP();
  const forcar = url.searchParams.get("forcar") === "1";

  try {
    const plantados = await semearBase();
    if (plantados.length) console.log("[radar] base de regras plantada:", plantados.join(", "));

    if (url.searchParams.get("semear") === "1") {
      return res.status(200).json({ ok: true, semeados: plantados, temas: Object.keys(BASE_REGRAS_INICIAL) });
    }

    if (!forcar) {
      const jaTem = await firebase(`radar-juridico/${data}/status.json`, "GET");
      if (jaTem === "ok") {
        return res.status(200).json({ ok: true, pulado: true, data, motivo: "o dia já foi lido (use forcar=1 para reler)" });
      }
    }

    const dia = await varrer(data);
    const propostas = dia.baseRegras;
    delete dia.baseRegras;
    await firebase(`radar-juridico/${data}.json`, "PUT", dia);
    const temas = await alimentarBase(propostas, data);
    await gravarIndice(dia);

    res.status(200).json({
      ok: true, data, status: dia.status,
      itens: dia.itens.length, contagem: dia.contagem || null,
      naoLidas: dia.fontesNaoLidas.map(f => f.id), baseAlimentada: temas
    });
  } catch (err) {
    console.error("[radar] falhou:", err.message);
    // A falha também vira registro: dia sem nada gravado é indistinguível de
    // dia calmo, e essa confusão é justamente a que o Radar existe para não
    // deixar acontecer.
    const falho = {
      data, gerado: new Date().toISOString(), status: "falhou",
      resumo: "A varredura falhou hoje — o dia não foi lido.",
      alerta: null, itens: [], fontesNaoLidas: [],
      erro: err.message,
      relatorio: "A varredura do dia não terminou (" + err.message + "). Isso não quer dizer que nada mudou: quer dizer que ninguém olhou."
    };
    await firebase(`radar-juridico/${data}.json`, "PUT", falho).catch(() => {});
    await gravarIndice(falho).catch(() => {});
    res.status(500).json({ ok: false, erro: err.message });
  }
};
