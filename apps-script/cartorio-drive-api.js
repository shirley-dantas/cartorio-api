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

function resp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return resp({ ok: true, status: "Cartório Drive API ativa" });
}
