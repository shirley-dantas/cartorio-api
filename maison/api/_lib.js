// Peças comuns das funções de aviso (o arquivo começa com "_" para a Vercel não o tratar como função).
// Variáveis de ambiente na Vercel (nunca no código):
//   FIREBASE_DB_SECRET  o "Secret do Database" (Firebase → Configurações do projeto → Contas de serviço → Secrets do Database)
//   VAPID_PUBLICA / VAPID_PRIVADA  as chaves dos avisos (a pública também está no index.html)
//   VAPID_ASSUNTO  opcional, um "mailto:" de contato
// O banco é lido e escrito pela API REST com o secret (não precisa de chave de conta de serviço, que a organização do Google bloqueia).
// O firebase-admin só confere o token de quem está logada no painel; para isso basta o código do projeto.
const admin = require('firebase-admin');
const webpush = require('web-push');
const crypto = require('crypto');

const PROJETO = 'maison-beauty-2e7da';
const DB_URL = 'https://maison-beauty-2e7da-default-rtdb.firebaseio.com';
const UNIDADES = { mai: 'Maison Beauty', flo: 'Estúdio Florença' };

function iniciar() {
  if (!admin.apps.length) admin.initializeApp({ projectId: PROJETO });
  webpush.setVapidDetails(process.env.VAPID_ASSUNTO || 'mailto:dantasshy@gmail.com', process.env.VAPID_PUBLICA, process.env.VAPID_PRIVADA);
  return admin;
}

const url = (p) => DB_URL + '/' + p.replace(/^\/+/, '') + '.json?auth=' + encodeURIComponent(process.env.FIREBASE_DB_SECRET || '');
async function dbGet(p) {
  const r = await fetch(url(p));
  if (!r.ok) throw new Error('banco ' + r.status);
  return r.json();
}
async function dbSet(p, v) {
  const r = await fetch(url(p), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
  if (!r.ok) throw new Error('banco ' + r.status);
}
async function dbRemove(p) {
  const r = await fetch(url(p), { method: 'DELETE' });
  if (!r.ok) throw new Error('banco ' + r.status);
}
// Grava só se ainda não existe (a primeira a chegar ganha). Devolve true se gravou.
async function dbPrimeira(p, v) {
  const r = await fetch(url(p), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': 'null_etag' }, body: JSON.stringify(v) });
  if (r.status === 412) return false;
  if (!r.ok) throw new Error('banco ' + r.status);
  return true;
}

const hashSub = (endpoint) => crypto.createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 32);
const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || 'Cliente';

// Manda o aviso a todos os aparelhos ativados que podem ver aquela unidade. Aparelho que não existe mais é esquecido.
async function enviarParaUnidade(unit, payload) {
  const todos = (await dbGet('push')) || {};
  const alvo = [];
  for (const uid of Object.keys(todos)) {
    for (const h of Object.keys(todos[uid] || {})) {
      const x = todos[uid][h];
      if (x && x.sub && (x.unidades || []).includes(unit)) alvo.push({ uid, h, sub: x.sub });
    }
  }
  await Promise.allSettled(alvo.map(async (t) => {
    try { await webpush.sendNotification(t.sub, JSON.stringify(payload)); }
    catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) await dbRemove('push/' + t.uid + '/' + t.h); }
  }));
  return alvo.length;
}

module.exports = { iniciar, admin, dbGet, dbSet, dbRemove, dbPrimeira, hashSub, primeiroNome, enviarParaUnidade, UNIDADES };
