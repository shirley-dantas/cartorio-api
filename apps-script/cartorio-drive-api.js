// ══ CARTÓRIO DRIVE API — Apps Script ══
// Cole este código no projeto cartorio-drive-api em script.google.com
// Depois clique em Implantar > Gerenciar implantações > atualizar versão

const PASTA_RAIZ_ID = "1KDMZ-FJMoXEzpMXKSojeZgNeJ_p4lhSb";

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
  const pastaRaiz = DriveApp.getFolderById(PASTA_RAIZ_ID);

  let pastaCliente;
  const buscaCliente = pastaRaiz.getFoldersByName(nomeCliente);
  pastaCliente = buscaCliente.hasNext() ? buscaCliente.next() : pastaRaiz.createFolder(nomeCliente);

  let pastaCaso;
  const buscaCaso = pastaCliente.getFoldersByName(tipoCaso);
  pastaCaso = buscaCaso.hasNext() ? buscaCaso.next() : pastaCliente.createFolder(tipoCaso);

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
  const pastaRaiz = DriveApp.getFolderById(PASTA_RAIZ_ID);

  // Encontra ou cria pasta do cliente
  const buscaCliente = pastaRaiz.getFoldersByName(nomeCliente);
  const pastaCliente = buscaCliente.hasNext() ? buscaCliente.next() : pastaRaiz.createFolder(nomeCliente);

  // Nome do documento com data
  const dataHoje = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy");
  const nomeDoc = "MINUTA — " + dados.nome + " — " + dataHoje;

  // Cria o Google Doc
  const doc = DocumentApp.create(nomeDoc);
  const docId = doc.getId();
  DriveApp.getFileById(docId).moveTo(pastaCliente);

  const body = doc.getBody();
  body.clear();

  // Insere o relatório prévio
  if (dados.relatorio) {
    const linhasRel = dados.relatorio.split("\n");
    linhasRel.forEach(function(linha) {
      if (!linha.trim()) return;
      if (linha.startsWith("# ")) {
        body.appendParagraph(linha.substring(2).trim()).setHeading(DocumentApp.ParagraphHeading.HEADING1);
      } else if (linha.startsWith("## ")) {
        body.appendParagraph(linha.substring(3).trim()).setHeading(DocumentApp.ParagraphHeading.HEADING2);
      } else if (linha.startsWith("### ")) {
        body.appendParagraph(linha.substring(4).trim()).setHeading(DocumentApp.ParagraphHeading.HEADING3);
      } else {
        body.appendParagraph(linha.trim());
      }
    });
    body.appendPageBreak();
  }

  // Insere a minuta
  if (dados.minuta) {
    const linhasMin = dados.minuta.split("\n");
    linhasMin.forEach(function(linha) {
      if (!linha.trim()) return;
      if (linha.startsWith("# ")) {
        body.appendParagraph(linha.substring(2).trim()).setHeading(DocumentApp.ParagraphHeading.HEADING1);
      } else if (linha.startsWith("## ")) {
        body.appendParagraph(linha.substring(3).trim()).setHeading(DocumentApp.ParagraphHeading.HEADING2);
      } else if (linha.startsWith("### ")) {
        body.appendParagraph(linha.substring(4).trim()).setHeading(DocumentApp.ParagraphHeading.HEADING3);
      } else {
        body.appendParagraph(linha.trim());
      }
    });
  }

  doc.saveAndClose();

  // Adiciona comentários via Drive API
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
    nome: nomeDoc
  });
}

function resp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return resp({ ok: true, status: "Cartório Drive API ativa" });
}
