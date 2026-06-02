const https = require("https");

// ══ CONFIGURAÇÕES ══════════════════════════════════════════════
const EVOLUTION_INSTANCE = "escritorio";
const EVOLUTION_API_KEY  = "escritorio@2025#EvAPI";
const EVOLUTION_HOST     = "evolution-api-production-59b1.up.railway.app";
const FIREBASE_HOST      = "painel-cartorio-default-rtdb.firebaseio.com";
const DRIVE_URL          = "https://script.google.com/macros/s/AKfycbz6NoiizP5ThvPWZ1ZZ_HAvJworawPrmfzCAXyCfY2n9oB8Qx4oFfYw0trGgm5liXHY/exec";
const NUMERO_OPERACIONAL = "5511947851816";
// ═══════════════════════════════════════════════════════════════

function classificarServico(texto) {
  const t = (texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/inventario|espolio|faleceu|falecimento|heranca|herdeiro|partilha|sobrepartilha/.test(t)) return "Inventário";
  if (/compra|venda|escritura|imovel|apartamento|terreno|casa/.test(t)) return "Escritura de Compra e Venda";
  if (/procuracao|procurador/.test(t)) return "Procuração";
  if (/uniao estavel|convivencia|companheiro|companheira/.test(t)) return "União Estável";
  if (/divorcio|separacao|dissolucao/.test(t)) return "Divórcio";
  if (/ata notarial|ata de/.test(t)) return "Ata Notarial";
  if (/doacao|doou|doar/.test(t)) return "Doação";
  if (/cessao|direitos hereditarios|ceder direitos/.test(t)) return "Cessão de Direitos";
  if (/pacto|antenupcial/.test(t)) return "Pacto Antenupcial";
  if (/testamento/.test(t)) return "Testamento";
  if (/reconhecimento de firma|reconhecer firma|firma/.test(t)) return "Reconhecimento de Firma";
  if (/autenticacao|autenticar|copia autenticada/.test(t)) return "Autenticação";
  if (/renuncia|renunciar|renunciante/.test(t)) return "Renúncia";
  if (/dacao|dacao em pagamento/.test(t)) return "Dação em Pagamento";
  if (/alienacao fiduciaria/.test(t)) return "Alienação Fiduciária";
  if (/usucapiao/.test(t)) return "Usucapião";
  if (/regularizacao/.test(t)) return "Regularização Imobiliária";
  return "A classificar";
}

function classificarUrgencia(texto) {
  const t = (texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const alta  = ["urgente","urgencia","hoje","agora","imediato","imediata","amanha","prazo","vencendo","vencido","vence","emergencia","rapido","rapida","preciso ja","preciso hoje"];
  const baixa = ["quando puder","sem pressa","consulta","informacao","quanto custa","valor","preco","tabela","gostaria de saber","quero saber"];
  const a = alta.find(p => t.includes(p));
  if (a) return { status: "critico", motivo: `Urgência alta: "${a}"` };
  const b = baixa.find(p => t.includes(p));
  if (b) return { status: "emdia", motivo: `Consulta/informação: "${b}"` };
  return { status: "atencao", motivo: "Urgência padrão" };
}

function httpReq(url, method, body, headers = {}) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = { method, headers: { "Content-Type": "application/json", ...headers } };
    if (payload) options.headers["Content-Length"] = Buffer.byteLength(payload);
    const r = https.request(url, options, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    r.on("error", () => resolve(null));
    if (payload) r.write(payload);
    r.end();
  });
}

async function getSessao() {
  return httpReq(`https://${FIREBASE_HOST}/sessao_ativa.json`, "GET");
}
async function setSessao(sessao) {
  return httpReq(`https://${FIREBASE_HOST}/sessao_ativa.json`, "PUT", sessao);
}
async function clearSessao() {
  return httpReq(`https://${FIREBASE_HOST}/sessao_ativa.json`, "DELETE");
}
async function buscarCasoPorNome(texto) {
  const data = await httpReq(`https://${FIREBASE_HOST}/casos.json`, "GET");
  if (!data || typeof data !== "object") return null;
  const norm = texto.toLowerCase().trim();
  return Object.values(data).find(c =>
    c && !c.concluido && c.nome && c.nome.toLowerCase().includes(norm)
  ) || null;
}
async function baixarMidia(mensagemObj) {
  return httpReq(
    `https://${EVOLUTION_HOST}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`,
    "POST",
    { message: mensagemObj, convertToMp4: false },
    { apikey: EVOLUTION_API_KEY }
  );
}
async function salvarNoDrive(nome, nomeArquivo, base64, mimetype) {
  return httpReq(DRIVE_URL, "POST", { acao: "salvar-arquivo", nome, nomeArquivo, base64, mimetype });
}
async function criarPastaDrive(nome, tipo) {
  return httpReq(DRIVE_URL, "POST", { acao: "criar-pasta", nome, tipo });
}

// ══ HANDLER VERCEL ══════════════════════════════════════════════
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Método não permitido");
  }

  let corpo;
  try {
    corpo = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).send("JSON inválido");
  }

  const destinatario = corpo?.dados?.chave?.remotoJid || "";
  const numeroDestino = destinatario.replace(/[^0-9]/g, "");
  if (numeroDestino !== NUMERO_OPERACIONAL) {
    return res.status(200).send("Mensagem ignorada");
  }

  const mensagemObj  = corpo.dados?.mensagem || corpo.dados?.message || {};
  const tipoMensagem = corpo.dados?.tipoMensagem || corpo.dados?.messageType || "";
  const texto = (
    mensagemObj?.conversa ||
    mensagemObj?.conversation ||
    mensagemObj?.extendedTextMessage?.text ||
    mensagemObj?.mensagemTextoEstendida?.texto ||
    mensagemObj?.imageMessage?.caption ||
    mensagemObj?.documentMessage?.caption ||
    corpo.Resumo || ""
  ).trim();

  const isMedia = ["imageMessage","documentMessage","videoMessage","audioMessage","documentWithCaptionMessage"].includes(tipoMensagem);
  const isFim   = texto.toLowerCase() === "fim";
  const isTexto = !isMedia && texto.length > 0;

  if (isFim) {
    await clearSessao();
    return res.status(200).send("Sessão encerrada");
  }

  if (isMedia) {
    const sessao = await getSessao();
    if (!sessao?.nome) return res.status(200).send("Sem sessão ativa");
    const resultado = await baixarMidia(mensagemObj);
    if (resultado?.base64) {
      const ext  = tipoMensagem.includes("image") ? "jpg" : tipoMensagem.includes("audio") ? "mp3" : tipoMensagem.includes("video") ? "mp4" : "pdf";
      const mime = tipoMensagem.includes("image") ? "image/jpeg" : tipoMensagem.includes("audio") ? "audio/mpeg" : tipoMensagem.includes("video") ? "video/mp4" : "application/pdf";
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
      const nomeArquivo = `${sessao.nome.replace(/\s+/g, "_").toUpperCase()}_${ts}.${ext}`;
      await salvarNoDrive(sessao.nome, nomeArquivo, resultado.base64, mime);
    }
    return res.status(200).send("Arquivo salvo no Drive");
  }

  if (isTexto) {
    const existente = await buscarCasoPorNome(texto);
    if (existente) {
      await setSessao({ nome: existente.nome, casoId: existente.id, timestamp: new Date().toISOString() });
      return res.status(200).send("Caso reaberto");
    }

    const urgencia = classificarUrgencia(texto);
    const caso = {
      nome: texto,
      tipo: classificarServico(texto),
      cacau: texto,
      status: urgencia.status,
      resp: "grazi",
      prazo: "Hoje",
      obs: `${texto}\n\n[Urgência: ${urgencia.motivo}]`,
      atualizado: new Date().toISOString().split("T")[0],
      concluido: false,
      dep: ""
    };

    await Promise.all([
      httpReq(`https://${FIREBASE_HOST}/casos.json`, "POST", caso),
      criarPastaDrive(caso.nome, caso.tipo),
      setSessao({ nome: caso.nome, casoId: null, timestamp: new Date().toISOString() })
    ]);
  }

  return res.status(200).send("OK");
};
