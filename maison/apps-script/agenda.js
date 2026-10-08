/**
 * Convites da Google Agenda do painel Maison Beauty.
 * Roda na conta da Tháriga (thariga.pmu@gmail.com): o convite sai em nome dela,
 * e a cliente aceita ou recusa pelo próprio e-mail.
 *
 * Como publicar: ver maison/FIREBASE.md ("Convites pela Google Agenda").
 * Precisa do serviço avançado "Google Calendar API" ligado (Serviços +).
 *
 * O que vai no evento: serviço, unidade e horário. Nada de ficha, anamnese ou valor.
 */
// Tem de ser igual ao AGENDA_CHAVE do index.html. Não é senha forte: só barra mensagem aleatória.
const CHAVE = 'EXiC2WouRkPbh2W8AjhCWhpx4lUZJxRB';
const FUSO = 'America/Sao_Paulo';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.chave !== CHAVE) return resposta({ ok: false, erro: 'chave' });
    if (d.acao === 'criar') return resposta(criar(d));
    if (d.acao === 'atualizar') return resposta(atualizar(d));
    if (d.acao === 'cancelar') return resposta(cancelar(d));
    if (d.acao === 'status') return resposta(status(d));
    return resposta({ ok: false, erro: 'acao' });
  } catch (err) {
    return resposta({ ok: false, erro: String(err) });
  }
}

// "2026-10-12" + "14:30" + minutos -> {dateTime, timeZone} início e fim
function janela(data, hora, minutos) {
  // Conta feita em UTC só para somar minutos; o fuso do evento vai escrito ao lado.
  const p = (data + 'T' + hora).split(/[-T:]/).map(Number);
  const fim = new Date(Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4]) + (minutos || 60) * 60000);
  return {
    start: { dateTime: data + 'T' + hora + ':00', timeZone: FUSO },
    end: { dateTime: Utilities.formatDate(fim, 'UTC', "yyyy-MM-dd'T'HH:mm:ss"), timeZone: FUSO },
  };
}

function criar(d) {
  const j = janela(d.data, d.hora, d.minutos);
  const ev = Calendar.Events.insert({
    summary: d.titulo,
    location: d.local || '',
    description: d.descricao || '',
    start: j.start,
    end: j.end,
    attendees: [{ email: d.email }],
    reminders: { useDefault: true },
  }, 'primary', { sendUpdates: 'all' });
  return { ok: true, id: ev.id };
}

function atualizar(d) {
  const j = janela(d.data, d.hora, d.minutos);
  Calendar.Events.patch({ start: j.start, end: j.end }, 'primary', d.id, { sendUpdates: 'all' });
  return { ok: true };
}

function cancelar(d) {
  Calendar.Events.remove('primary', d.id, { sendUpdates: 'all' });
  return { ok: true };
}

// d.ids: lista de {id, email}. Volta {id: 'aceitou' | 'recusou' | 'talvez' | 'sem-resposta'}
function status(d) {
  const mapa = { accepted: 'aceitou', declined: 'recusou', tentative: 'talvez', needsAction: 'sem-resposta' };
  const saida = {};
  (d.ids || []).forEach(function (x) {
    try {
      const ev = Calendar.Events.get('primary', x.id);
      if (ev.status === 'cancelled') { saida[x.id] = 'cancelado'; return; }
      const g = (ev.attendees || []).filter(function (a) { return a.email && a.email.toLowerCase() === String(x.email).toLowerCase(); })[0];
      saida[x.id] = g ? (mapa[g.responseStatus] || 'sem-resposta') : 'sem-resposta';
    } catch (err) {
      saida[x.id] = 'erro';
    }
  });
  return { ok: true, status: saida };
}

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
