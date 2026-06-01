const https = require("https");

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
  return "A classificar";
}

function classificarUrgencia(texto) {
  const t = (texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const palavrasAlta = ["urgente", "urgencia", "hoje", "agora", "imediato", "imediata", "amanha", "prazo", "vencendo", "vencido", "vence", "emergencia", "rapido", "rapida", "preciso ja", "preciso hoje"];
  const palavrasBaixa = ["quando puder", "sem pressa", "consulta", "informacao", "quanto custa", "valor", "preco", "tabela", "gostaria de saber", "quero saber"];
  const achouAlta = palavrasAlta.find(p => t.includes(p));
  if (achouAlta) return { status: "critico", motivo: `Urgência alta detectada: "${achouAlta}"` };
  const achouBaixa = palavrasBaixa.find(p => t.includes(p));
  if (achouBaixa) return { status: "emdia", motivo: `Mensagem de consulta ou informação: "${achouBaixa}"` };
  return { status: "atencao", motivo: "Urgência padrão — sem indicadores específicos" };
}

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

  const urgencia = classificarUrgencia(mensagem);

  const caso = {
    nome: nome,
    tipo: classificarServico(mensagem),
    cacau: mensagem,
    status: urgencia.status,
    resp: "grazi",
    prazo: "Hoje",
    obs: `${mensagem}\n\n[Urgência: ${urgencia.motivo}]`,
    por: new Date().toISOString().split("T")[0],
    concluiram: false,
    dep: ""
  };

  const dados = JSON.stringify(caso);

  // Salvar no Firebase
  await new Promise((resolver) => {
    const requis = https.request(
      "https://painel-cartorio-default-rtdb.firebaseio.com/casos.json",
      { method: "POST", headers: { "Content-Type": "application/json" } },
      (res) => { resolver(); }
    );
    requis.write(dados);
    requis.end();
  });

  // Criar pasta no Google Drive (sem bloquear a resposta)
  try {
    const driveUrl = "https://script.google.com/macros/s/AKfycbz6NoiizP5ThvPWZ1ZZ_HAvJworawPrmfzCAXyCfY2n9oB8Qx4oFfYw0trGgm5liXHY/exec";
    const drivePayload = JSON.stringify({ nome: caso.nome, tipo: caso.tipo });
    await new Promise((res) => {
      const r = https.request(driveUrl, { method: "POST", headers: { "Content-Type": "application/json" } }, () => res());
      r.on("error", () => res());
      r.write(drivePayload);
      r.end();
    });
  } catch(_) {}

  return { statusCode: 200, body: "OK" };
};
