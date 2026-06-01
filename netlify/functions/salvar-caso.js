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

  const remetente = (body.remetente || "").replace(/[^0-9]/g, "");
  
  if (NUMEROS_INTERNOS.some(n => remetente.includes(n))) {
    return { statusCode: 200, body: "Mensagem interna ignorada" };
  }

  const caso = {
    nome: body.nome || remetente || "Cliente WhatsApp",
    tipo: body.tipo || "WhatsApp",
    acao: body.resumo || body.mensagem || "Mensagem recebida via WhatsApp",
    status: "atencao",
    resp: "grazi",
    prazo: "Hoje",
    obs: body.resumo || body.mensagem || "",
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
