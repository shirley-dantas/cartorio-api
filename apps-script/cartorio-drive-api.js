// ══ CARTÓRIO DRIVE API — Apps Script ══
// Cole este código no projeto cartorio-drive-api em script.google.com
// Depois clique em Implantar > Gerenciar implantações > atualizar versão

const PASTA_RAIZ_ID = "1KDMZ-FJMoXEzpMXKSojeZgNeJ_p4lhSb";
const NOME_PASTA_MINUTAS = "MINUTAS IA";

function getPastaMinutasIA() {
  // Cria/localiza MINUTAS IA direto no Meu Drive (sempre acessível)
  const busca = DriveApp.getFoldersByName(NOME_PASTA_MINUTAS);
  return busca.hasNext() ? busca.next() : DriveApp.createFolder(NOME_PASTA_MINUTAS);
}

function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);
    const acao = dados.acao || "criar-pasta";
    if (acao === "criar-pasta") return criarPasta(dados);
    if (acao === "salvar-arquivo") return salvarArquivo(dados);
    if (acao === "criar-minuta-doc") return criarMinutaDoc(dados);
    return resp({ ok: false, erro: "Ação desconhecida" });
  } catch(err) {
    return resp({ ok: false, erro: err.message });
  }
}

function criarPasta(dados) {
  const nomeCliente = (dados.nome || "Sem nome").toUpperCase();
  const tipoCaso = dados.tipo || "A classificar";
  const pastaMinutas = getPastaMinutasIA();

  const buscaCliente = pastaMinutas.getFoldersByName(nomeCliente);
  const pastaCliente = buscaCliente.hasNext() ? buscaCliente.next() : pastaMinutas.createFolder(nomeCliente);

  const buscaCaso = pastaCliente.getFoldersByName(tipoCaso);
  const pastaCaso = buscaCaso.hasNext() ? buscaCaso.next() : pastaCliente.createFolder(tipoCaso);

  return resp({ ok: true, url: pastaCaso.getUrl() });
}

function salvarArquivo(dados) {
  const nomeCliente = (dados.nome || "Sem nome").toUpperCase();
  const nomeArquivo = dados.nomeArquivo || "documento";
  const base64 = dados.base64 || "";
  const mimetype = dados.mimetype || "application/octet-stream";

  const pastaRaiz = DriveApp.getFolderById(PASTA_RAIZ_ID);
  let pastaCliente;
  const busca = pastaRaiz.getFoldersByName(nomeCliente);
  pastaCliente = busca.hasNext() ? busca.next() : pastaRaiz.createFolder(nomeCliente);

  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimetype, nomeArquivo);
  const arquivo = pastaCliente.createFile(blob);

  return resp({ ok: true, url: arquivo.getUrl(), nome: nomeArquivo });
}

function criarMinutaDoc(dados) {
  const nomeCliente = (dados.nome || "Caso").toUpperCase();
  const pastaMinutas = getPastaMinutasIA();

  // Encontra ou cria subpasta do cliente dentro de MINUTAS IA
  const buscaCliente = pastaMinutas.getFoldersByName(nomeCliente);
  const pastaCliente = buscaCliente.hasNext() ? buscaCliente.next() : pastaMinutas.createFolder(nomeCliente);

  // Nome do documento com data e hora
  const dataHoje = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
  const nomeDoc = "MINUTA — " + dados.nome + " — " + dataHoje;

  // Cria o Google Doc
  const doc = DocumentApp.create(nomeDoc);
  const docId = doc.getId();
  DriveApp.getFileById(docId).moveTo(pastaCliente);

  const body = doc.getBody();
  body.clear();

  if (dados.minuta) {
    const linhas = dados.minuta.split("\n");
    linhas.forEach(function(linha) {
      if (!linha.trim()) return;
      var textoMd = linha;
      var tipoHeading = 0;
      if (linha.startsWith("# ")) { tipoHeading = 1; textoMd = linha.substring(2).trim(); }
      else if (linha.startsWith("## ")) { tipoHeading = 2; textoMd = linha.substring(3).trim(); }
      else if (linha.startsWith("### ")) { tipoHeading = 3; textoMd = linha.substring(4).trim(); }
      inserirParagrafoFormatado(body, textoMd, tipoHeading);
    });
  }

  doc.saveAndClose();

  // Adiciona apontamentos como comentários/balões de revisão via Drive API
  const token = ScriptApp.getOAuthToken();
  const comentarios = dados.comentarios || [];
  comentarios.forEach(function(comentario) {
    try {
      UrlFetchApp.fetch(
        "https://www.googleapis.com/drive/v3/files/" + docId + "/comments?fields=id",
        {
          method: "post",
          headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
          },
          payload: JSON.stringify({ content: comentario }),
          muteHttpExceptions: true
        }
      );
    } catch(e) {}
  });

  return resp({
    ok: true,
    url: "https://docs.google.com/document/d/" + docId + "/edit",
    folderUrl: pastaCliente.getUrl(),
    nome: nomeDoc
  });
}

function inserirParagrafoFormatado(body, textoMd, tipoHeading) {
  // Parseiar **negrito**
  var segmentos = [];
  var regex = /\*\*([^*]+)\*\*/g;
  var lastIndex = 0;
  var match;
  while ((match = regex.exec(textoMd)) !== null) {
    if (match.index > lastIndex) segmentos.push({ t: textoMd.slice(lastIndex, match.index), b: false });
    segmentos.push({ t: match[1], b: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < textoMd.length) segmentos.push({ t: textoMd.slice(lastIndex), b: false });
  if (segmentos.length === 0) segmentos.push({ t: textoMd, b: false });

  var textoLimpo = segmentos.map(function(s) { return s.t; }).join("");
  var para = body.appendParagraph(textoLimpo);
  para.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  para.setLineSpacing(1.15);
  para.setSpacingBefore(0);
  para.setSpacingAfter(0);
  if (tipoHeading === 1) {
    para.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  } else {
    para.setAlignment(DocumentApp.HorizontalAlignment.JUSTIFY);
  }

  var textEl = para.editAsText();
  if (textoLimpo.length > 0) {
    textEl.setFontFamily(0, textoLimpo.length - 1, "Tahoma");
    textEl.setFontSize(0, textoLimpo.length - 1, 12);
    textEl.setBold(0, textoLimpo.length - 1, false);
  }

  // Negrito para headings
  if (tipoHeading > 0 && textoLimpo.length > 0) {
    textEl.setBold(0, textoLimpo.length - 1, true);
  }

  // Negrito inline dos marcadores **
  var pos = 0;
  segmentos.forEach(function(seg) {
    if (seg.t.length > 0 && seg.b) {
      textEl.setBold(pos, pos + seg.t.length - 1, true);
    }
    pos += seg.t.length;
  });

  return para;
}

function resp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return resp({ ok: true, status: "Cartório Drive API ativa" });
}
