// Guarda (ou tira) o aparelho que ativou os avisos. Quem chama precisa estar logada no painel:
// o painel manda o token do Firebase, e aqui se confere quem é e o que ela pode ver.
const { iniciar, admin, hashSub } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, erro: 'metodo' });
  try {
    iniciar();
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!m) return res.status(401).json({ ok: false, erro: 'sem-login' });
    const dec = await admin.auth().verifyIdToken(m[1]);
    const acesso = (await admin.database().ref('acesso/' + dec.uid).once('value')).val();
    if (!acesso) return res.status(403).json({ ok: false, erro: 'sem-acesso' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const sub = body.sub;
    if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys) return res.status(400).json({ ok: false, erro: 'assinatura' });
    const h = hashSub(sub.endpoint);
    const ref = admin.database().ref('push/' + dec.uid + '/' + h);
    if (body.acao === 'remover') { await ref.remove(); return res.json({ ok: true }); }
    // A administradora recebe das duas unidades; a funcionária, só da Maison.
    const unidades = acesso.perfil === 'admin' ? ['mai', 'flo'] : ['mai'];
    await ref.set({ sub: { endpoint: sub.endpoint, keys: { p256dh: String(sub.keys.p256dh || ''), auth: String(sub.keys.auth || '') } }, nome: acesso.nome || '', perfil: acesso.perfil || '', unidades, em: Date.now() });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, erro: String(e && e.message || e) });
  }
};
