// ═══════════════════════════════════════════════════════════════════════════
// AGENDA DO BÚSSOLA — roda na conta PESSOAL da Shirley (dantasshy@gmail.com)
//
// Separado do Apps Script do cartório de propósito: o convite de um
// compromisso pessoal sai do e-mail pessoal dela, e o evento fica na agenda
// pessoal — a conta do cartório não participa de nada.
//
// Um compromisso marcado no Bússola com e-mails de convidados vira evento na
// agenda principal desta conta, com os convidados: o Google manda o convite,
// e ao aceitar o compromisso entra na agenda de cada um (Google, iPhone ou
// Outlook). Sem hora marcada, vira evento de dia inteiro. Gravar direto na
// agenda de outra pessoa sem o aceite dela não existe — o convite é o caminho.
//
// Como instalar (uma vez, logada na dantasshy@gmail.com):
//   1. script.google.com → Novo projeto → apagar o que vier e colar este arquivo
//   2. Implantar → Nova implantação → tipo "App da Web"
//      Executar como: Eu · Quem pode acessar: Qualquer pessoa
//   3. Autorizar o acesso à agenda quando o Google pedir
//   4. Copiar o endereço que termina em /exec e colar no Bússola
//      (Agenda → + Compromisso → "Ligar minha agenda")
// O endereço funciona como uma chave: fica só no tablet dela, nunca no código.
// ═══════════════════════════════════════════════════════════════════════════

function resp(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Aberto no navegador (ou pelo Bússola ao ligar), diz que está no ar e de
// qual conta é a agenda — é assim que ela confere que ligou a conta certa.
function doGet() {
  return resp({ ok: true, funcao: "agenda-bussola", conta: Session.getEffectiveUser().getEmail() });
}

function doPost(e) {
  try {
    var dados = JSON.parse(e.postData.contents);
    if (dados.acao === "convidar-evento-calendar") return convidarEventoCalendar(dados);
    if (dados.acao === "excluir-evento-calendar") return excluirEventoCalendar(dados);
    return resp({ ok: false, erro: "Ação desconhecida" });
  } catch (err) {
    return resp({ ok: false, erro: err.message });
  }
}

function convidarEventoCalendar(dados) {
  try {
    var emails = (dados.convidados || []).map(function (x) { return String(x || "").trim(); })
      .filter(function (x) { return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(x); });
    if (!emails.length) return resp({ ok: false, erro: "Nenhum e-mail válido para convidar" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dados.data || ""))) return resp({ ok: false, erro: "Data inválida" });
    var cal = CalendarApp.getDefaultCalendar();
    var titulo = String(dados.titulo || "Compromisso").slice(0, 200);
    var opcoes = { description: String(dados.descricao || ""), guests: emails.join(","), sendInvites: true };
    var evento;
    // O horário é o de São Paulo (UTC−3, sem horário de verão desde 2019),
    // escrito na própria data: projeto novo do Apps Script pode nascer noutro
    // fuso, e o almoço das 12h30 apareceria às 13h30.
    if (/^\d{2}:\d{2}$/.test(String(dados.hora || ""))) {
      var inicio = new Date(dados.data + "T" + dados.hora + ":00-03:00");
      var fim = new Date(inicio.getTime() + 60 * 60 * 1000); // duração padrão: 1h
      evento = cal.createEvent(titulo, inicio, fim, opcoes);
    } else {
      // Meio-dia de São Paulo cai no mesmo dia em qualquer fuso do projeto.
      evento = cal.createAllDayEvent(titulo, new Date(dados.data + "T12:00:00-03:00"), opcoes);
    }
    return resp({ ok: true, eventId: evento.getId(), convidados: emails });
  } catch (err) {
    return resp({ ok: false, erro: err.message });
  }
}

function excluirEventoCalendar(dados) {
  try {
    if (dados.eventId) {
      var evento = CalendarApp.getDefaultCalendar().getEventById(dados.eventId);
      if (evento) evento.deleteEvent();
    }
    return resp({ ok: true });
  } catch (err) {
    return resp({ ok: false, erro: err.message });
  }
}
