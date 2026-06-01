const https = require("https");

exports.handler = async (evento) => {
  if (evento.httpMethod !== "POST") {
    return { statusCode: 405, body: "Método não permitido" };
  }

  const corpo = JSON.parse(evento.body);

  // Só processa mensagens destinadas ao número da Shirley
  const destinatario = corpo.dados?.chave?.remotoJid || "";
  const numeroDestino = destinatario.replace(/[^0-9]/g, "");

  if (numeroDestino !== "5511947851816") {
    return { statusCode: 200, body: "Mensagem ignorada" };
  }

  // Extrair nome e mensagem
  const nome = corpo.dados?.pushName || corpo.nome || "Cliente WhatsApp";
  const mensagem =
    corpo.dados?.mensagem?.conversa ||
    corpo.dados?.mensagem?.mensagemTextoEstendida?.texto ||
    corpo.Resumo ||
    "Mensagem recebida via WhatsApp";

  const caso = {
    nome: nome,
    tipo: "WhatsApp",
    cacau: mensagem,
    status: "atenção",
    resp: "grazi",
    prazo: "Hoje",
    obs: mensagem,
    por: new Date().toISOString().split("T")[0],
    concluiram: false,
    dep: ""
  };

  const dados = JSON.stringify(caso);

  return new Promise((resolver) => {
    const requis = https.request(
      "https://painel-cartorio-default-rtdb.firebaseio.com/casos.json",
      { method: "POST", headers: { "Content-Type": "application/json" } },
      (res) => { resolver({ statusCode: 200, body: "OK" }); }
    );
    requis.write(dados);
    requis.end();
  });
};
