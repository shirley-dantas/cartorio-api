// Peças comuns das funções de aviso (o arquivo começa com "_" para a Vercel não o tratar como função).
// Variáveis de ambiente na Vercel (nunca no código):
//   FIREBASE_SERVICE_ACCOUNT  o arquivo JSON da conta de serviço do Firebase, inteiro
//   VAPID_PUBLICA / VAPID_PRIVADA  as chaves dos avisos (a pública também está no index.html)
//   VAPID_ASSUNTO  opcional, um "mailto:" de contato
const admin = require('firebase-admin');
const webpush = require('web-push');
const crypto = require('crypto');

const DB_URL = 'https://maison-beauty-2e7da-default-rtdb.firebaseio.com';
const UNIDADES = { mai: 'Maison Beauty', flo: 'Estúdio Florença' };

function iniciar() {
  if (!admin.apps.length) {
    const cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    admin.initializeApp({ credential: admin.credential.cert(cred), databaseURL: DB_URL });
  }
  webpush.setVapidDetails(process.env.VAPID_ASSUNTO || 'mailto:dantasshy@gmail.com', process.env.VAPID_PUBLICA, process.env.VAPID_PRIVADA);
  return admin;
}

const hashSub = (endpoint) => crypto.createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 32);
const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || 'Cliente';

// Manda o aviso a todos os aparelhos ativados que podem ver aquela unidade. Aparelho que não existe mais é esquecido.
async function enviarParaUnidade(unit, payload) {
  const db = admin.database();
  const todos = (await db.ref('push').once('value')).val() || {};
  const alvo = [];
  for (const uid of Object.keys(todos)) {
    for (const h of Object.keys(todos[uid] || {})) {
      const x = todos[uid][h];
      if (x && x.sub && (x.unidades || []).includes(unit)) alvo.push({ uid, h, sub: x.sub });
    }
  }
  await Promise.allSettled(alvo.map(async (t) => {
    try { await webpush.sendNotification(t.sub, JSON.stringify(payload)); }
    catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) await db.ref('push/' + t.uid + '/' + t.h).remove(); }
  }));
  return alvo.length;
}

module.exports = { iniciar, admin, hashSub, primeiroNome, enviarParaUnidade, UNIDADES };
