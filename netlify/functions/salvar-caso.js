const https = require("https");

const NUMEROS_INTERNOS = [
  "5511983155955",
  "5511966143178",
  "5511954929643"
];

exports.handler = async (evento) => {
  if (evento.httpMethod !== "POST") {
    return { statusCode: 405, body: "Método não permitido" };
  }

  const body = JSON.parse(evento.body);

  // Extrair remetente em diferentes formatos que a Evolution API pode mandar
  const remetente = (
    body.data?.key?.remoteJid ||
    body.remetente ||
    ""
  ).replace(/[^0-9]/g, "");

  if (NUMEROS_INTERNOS.some(n => remetente.includes(n))) {
    return { statusCode: 200, body: "Mensagem interna ignorada" };
  }

  // Extrair nome e mensagem
  const nome = body.data?.pushName || body.nome || remetente || "Cliente WhatsApp";
  const mensagem = 
    body.data?.message?.conversation ||
    body.data?.message?.extendedTextMessage?.text ||
    body.resumo ||
    "Mensagem recebida via WhatsApp";

  const caso = {
    nome: nome,
    tipo: "WhatsApp",
    acao: mensagem,
    status: "atencao",
    resp: "grazi",
    prazo: "Hoje",
    obs: mensagem,
    atualizado: new Date().toISOString().split("T")[0],
    concluido: false,
    dep: ""
  };

  const dados = JSON.stringify(caso);

  return new Promise((resolver) => {
    const req = https.request(
      "https://painel-cartorio-default-rtdb.firebaseio.com/casos.json",
      { method: "POST", headers: { "Content-Type": "application/json" } },
      (res) => { resolver({ statusCode: 200, body: "OK" }); }
    );
    req.write(dados);
    req.end();
  });
};
