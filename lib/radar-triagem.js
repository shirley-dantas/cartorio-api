// ══ A PENEIRA DO RADAR ═══════════════════════════════════════════════════
//
// As peças do Radar Jurídico que não dependem de rede nenhuma: virar página
// em texto, desembrulhar o JSON da IA e — a parte que mais importa — conferir
// cada item antes de ele chegar à tela.
//
// Estão num arquivo à parte porque são exatamente as que precisam de teste
// (testes/radar-triagem.mjs). O resto do api/radar-juridico.js é conversa com
// o mundo: sem internet não roda, e sem rodar não se testa.

// O relógio do cartório. A Vercel roda em UTC; sem isto, a varredura das seis
// da manhã de São Paulo seria gravada no dia seguinte e o Jornal da equipe
// abriria vazio.
function hojeEmSP(agora) {
  return (agora || new Date()).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

// Não é parser de HTML — é peneira: tira o que nunca é conteúdo (script,
// style, comentário), derruba as tags e junta os espaços.
function soOTexto(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

// A IA às vezes embrulha o JSON em cerca de código, mesmo mandada não fazer.
// Desembrulhar aqui é mais barato que perder a varredura do dia por causa de
// três crases.
function lerJson(texto) {
  let t = String(texto || "").trim();
  const cerca = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cerca) t = cerca[1].trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a === -1 || b === -1) throw new Error("a IA não devolveu JSON");
  return JSON.parse(t.slice(a, b + 1));
}

// ── O guarda-corpo ───────────────────────────────────────────────────────
// A hierarquia normativa está escrita no prompt, mas regra que só existe no
// prompt depende de o modelo ter lembrado dela naquela manhã. Estas duas
// custaram caro demais para ficarem só lá:
//
//   1. Item que fala em dispensa e não diz o que continua exigido é rebaixado
//      a "aplicação parcial — confirmar". Foi assim que o ITCMD quase
//      escorregou: o CNJ dispensou o imposto na escritura e o Registro de
//      Imóveis continuou pedindo.
//   2. Notícia nunca sobe a 🔴. Manchete não muda a mesa; se mudasse, matéria
//      de portal viraria exigência no balcão.
const FALA_EM_DISPENSA = /dispens|liber|desobrig|n[ãa]o (?:é|e) mais (?:necess|exig|obrigat)|deixa de (?:ser )?(?:exig|necess)/i;

function conferirItem(item) {
  const i = Object.assign({}, item);
  i.selo = ["🔴", "🟠", "🟢", "⚪"].includes(i.selo) ? i.selo : "🟢";
  i.especie = ["norma", "decisao", "noticia"].includes(i.especie) ? i.especie : "noticia";
  i.confirmado = i.confirmado === true;
  i.parcial = i.parcial === true;
  i.etapas = Array.isArray(i.etapas) ? i.etapas : [];
  const texto = [i.titulo, i.oQueMuda].filter(Boolean).join(" ");
  if (FALA_EM_DISPENSA.test(texto) && !String(i.oQueNaoMuda || "").trim()) {
    i.parcial = true;
    i.aConfirmar = (i.aConfirmar ? i.aConfirmar + " " : "") +
      "O material lido não disse o que continua exigido nas etapas seguintes — conferir antes de aplicar.";
  }
  if (i.especie === "noticia" && i.selo === "🔴") { i.selo = "🟠"; i.parcial = true; }
  return i;
}

function contar(itens) {
  return {
    muda:  itens.filter(i => i.selo === "🔴").length,
    breve: itens.filter(i => i.selo === "🟠").length,
    saber: itens.filter(i => i.selo === "🟢").length,
    fora:  itens.filter(i => i.selo === "⚪").length
  };
}

// O identificador de tema, do jeito que ele pode virar chave do Firebase:
// sem barra, sem ponto, sem cifrão, sem colchete — e sem acento, para que
// "certidões" e "certidoes" não virem dois temas.
function chaveDoTema(bruto) {
  return String(bruto || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

module.exports = { hojeEmSP, soOTexto, lerJson, conferirItem, contar, chaveDoTema, FALA_EM_DISPENSA };
