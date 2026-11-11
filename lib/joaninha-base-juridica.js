// ══ A BASE JURÍDICA, ESCRITA PARA SER LIDA PELA IA ═══════════════════════
//
// Moradia única do que a Joaninha jurídica lê — a Base de Regras, o Radar e o
// critério da hierarquia normativa. Antes isto morava dentro de
// api/joaninha-juridico.js; foi movido para cá, sem mudar uma linha de
// comportamento, para que a conversa ampla da Joaninha (lib/joaninha-chat.js)
// leia exatamente a mesma base, com o mesmo critério, e não uma cópia que
// envelheceria em silêncio.

const https = require("https");

const FIREBASE_HOST = "painel-cartorio-default-rtdb.firebaseio.com";
const DIAS_DE_RADAR = 14;

const CRITERIO_HIERARQUIA = `CRITÉRIO OBRIGATÓRIO — hierarquia normativa e etapas

Antes de dizer que alguma coisa mudou, ou que já pode ser aplicada, passe por estas quatro perguntas:

1. Competência — o órgão que publicou tem poder sobre essa matéria? O CNJ regula procedimento notarial e registral, mas não altera lei tributária estadual nem a Lei de Registros Públicos. A Corregedoria de SP regula a serventia, mas não muda lei federal.
2. Etapas — o ato tem mais de uma etapa (escritura, registro, averbação)? A mudança vale para todas, ou só para uma? Escritura e registro têm bases legais diferentes.
3. Alcance — vale para todo ato ou só para uma espécie? Vale em todo o país ou só onde a corregedoria local já se alinhou?
4. Vigência — já está valendo, ou depende de vacância ou regulamentação?

Daí decorrem três proibições, e elas não têm exceção:

- Nunca diga "está liberado", "não precisa mais" ou "foi dispensado" sem dizer, na mesma resposta, o que continua exigido — etapa por etapa.
- Se não der para verificar se a etapa seguinte já se adequou, diga "⚠️ aplicação parcial — confirmar" em vez de tratar como resolvido.
- Nunca invente número de Provimento, artigo, item de Normas de Serviço ou processo. Se o número não está na base, diga que a base não traz o número. Um número errado numa exigência é pior que nenhum número.

Quando a base trouxer um ponto marcado em "Atenção" (divergência de numeração, matéria não pacificada, ato não confirmado), repita esse ponto. Ele não é rodapé: é a parte que evita a exigência errada.`;

function firebase(caminho) {
  return new Promise((resolve) => {
    // FIREBASE_DB_URL só existe nos testes (aponta para um banco falso); em produção vale o host de sempre.
    const raiz = (process.env.FIREBASE_DB_URL || `https://${FIREBASE_HOST}`).replace(/\/$/, "");
    const r = (raiz.startsWith("http:") ? require("http") : https).get(`${raiz}/${caminho}`, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    r.on("error", () => resolve(null));
    r.setTimeout(8000, () => { r.destroy(); resolve(null); });
  });
}

// ── A base, escrita para ser lida pela IA ────────────────────────────────
function temaEmTexto(chave, t) {
  if (!t) return "";
  const linhas = [`### ${t.titulo || chave}  (tema: ${chave})`];
  if (t.resumo) linhas.push(t.resumo);
  if (Array.isArray(t.naMesa) && t.naMesa.length)
    linhas.push("Na mesa:\n" + t.naMesa.map(x => "- " + x).join("\n"));
  if (Array.isArray(t.etapas) && t.etapas.length)
    linhas.push("Etapas:\n" + t.etapas.map(e => `- ${e.etapa}: ${e.situacao}${e.base ? " (" + e.base + ")" : ""}`).join("\n"));
  if (Array.isArray(t.fundamentos) && t.fundamentos.length)
    linhas.push("Fundamentos:\n" + t.fundamentos.map(f => `- ${f.ref}: ${f.texto}`).join("\n"));
  if (Array.isArray(t.atencao) && t.atencao.length)
    linhas.push("ATENÇÃO (repetir na resposta):\n" + t.atencao.map(x => "- " + x).join("\n"));
  if (t.atualizacoes && typeof t.atualizacoes === "object") {
    const u = Object.keys(t.atualizacoes).sort()
      .map(d => `- ${d}: ${t.atualizacoes[d] && t.atualizacoes[d].texto}`).join("\n");
    if (u) linhas.push("Acrescentado pelo Radar depois da carga inicial:\n" + u);
  }
  if (t.mensagemCliente)
    linhas.push("Mensagem de cliente já aprovada para este tema (use como base, adaptando):\n" + t.mensagemCliente);
  return linhas.join("\n");
}

function radarEmTexto(radar) {
  if (!radar || typeof radar !== "object") return "Nada no Radar ainda.";
  const dias = Object.keys(radar).sort().reverse();
  const linhas = [];
  for (const d of dias) {
    const itens = (radar[d] && Array.isArray(radar[d].itens) ? radar[d].itens : []).filter(i => i && i.selo !== "⚪");
    for (const i of itens) {
      linhas.push(`- ${d} ${i.selo} [${i.especie}] ${i.titulo} — ${i.orgao || "órgão não informado"}, ${i.referencia || "sem referência"}`
        + (i.oQueMuda ? `\n    muda: ${i.oQueMuda}` : "")
        + (i.oQueNaoMuda ? `\n    continua exigido: ${i.oQueNaoMuda}` : "")
        + (i.parcial ? `\n    ⚠️ aplicação parcial — confirmar${i.aConfirmar ? ": " + i.aConfirmar : ""}` : ""));
    }
  }
  return linhas.length ? linhas.join("\n") : "Nada relevante no Radar dos últimos dias.";
}

module.exports = { FIREBASE_HOST, DIAS_DE_RADAR, CRITERIO_HIERARQUIA, firebase, temaEmTexto, radarEmTexto };
