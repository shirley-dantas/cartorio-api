// A cliente grava a reserva (ou a ficha) direto no banco, como sempre; depois a página dela chama esta função só para AVISAR.
// Nada é confiado ao que a página diz: a função vai ao banco conferir que a reserva (ou a ficha) existe e é recente,
// e cada uma só gera um aviso (o repique é descartado).
const { iniciar, admin, primeiroNome, enviarParaUnidade, UNIDADES } = require('./_lib');

const RE_RESERVA = /^\d{4}-\d{2}-\d{2}_\d{4}_[1-9]$/;
const RE_FICHA = /^[A-Za-z0-9_-]{20,64}$/;
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const base = (u) => (u === 'flo' ? 'florenca' : 'maison');

async function primeiraVez(chave) {
  const t = await admin.database().ref('push_avisados/' + chave).transaction((v) => (v ? undefined : { em: Date.now() }));
  return t.committed;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, erro: 'metodo' });
  try {
    iniciar();
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const db = admin.database();
    if (body.tipo === 'reserva') {
      const unit = body.unit === 'flo' ? 'flo' : body.unit === 'mai' ? 'mai' : '';
      if (!unit || !RE_RESERVA.test(String(body.chave || ''))) return res.status(400).json({ ok: false, erro: 'dados' });
      const r = (await db.ref(base(unit) + '/reservas/' + body.chave).once('value')).val();
      if (!r || Date.now() - (r.em || 0) > 15 * 60 * 1000) return res.json({ ok: true, ignorado: true });
      if (!(await primeiraVez('r_' + body.chave))) return res.json({ ok: true, repetido: true });
      const d = new Date(r.data + 'T12:00:00');
      const dia = DIAS[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
      const n = await enviarParaUnidade(unit, { titulo: 'Nova marcação pelo link · ' + UNIDADES[unit], corpo: primeiroNome(r.nome) + ' · ' + r.serv + ' · ' + dia + ' às ' + r.hora, tag: 'r_' + body.chave, url: '/' });
      return res.json({ ok: true, enviados: n });
    }
    if (body.tipo === 'ficha') {
      if (!RE_FICHA.test(String(body.token || ''))) return res.status(400).json({ ok: false, erro: 'dados' });
      let unit = 'mai', x = (await db.ref('maison/pendentes/' + body.token).once('value')).val();
      if (!x) { x = (await db.ref('florenca/pendentes/' + body.token).once('value')).val(); unit = 'flo'; }
      if (!x || Date.now() - (x.enviadoEm || 0) > 15 * 60 * 1000) return res.json({ ok: true, ignorado: true });
      if (!(await primeiraVez('f_' + body.token))) return res.json({ ok: true, repetido: true });
      const n = await enviarParaUnidade(unit, { titulo: 'Ficha recebida · ' + UNIDADES[unit], corpo: primeiroNome(x.nome) + ' preencheu a ficha de anamnese. Toque para revisar.', tag: 'f_' + body.token.slice(0, 12), url: '/' });
      return res.json({ ok: true, enviados: n });
    }
    return res.status(400).json({ ok: false, erro: 'tipo' });
  } catch (e) {
    return res.status(500).json({ ok: false, erro: String(e && e.message || e) });
  }
};
