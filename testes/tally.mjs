// Parte pura do upload por link (Tally): assinatura, leitura do payload, nomes.
import { createRequire } from 'module';
import crypto from 'crypto';
import assert from 'assert';
const require = createRequire(import.meta.url);
const t = require('../lib/tally-upload.js');

const segredo = 'segredo-de-teste';
const payload = {
  eventType: 'FORM_RESPONSE',
  data: {
    responseId: 'resp123',
    fields: [
      { key: 'q1', label: 'Nome completo', type: 'INPUT_TEXT', value: 'Maria da Silva' },
      { key: 'q2', label: 'RG ou CNH', type: 'FILE_UPLOAD', value: [{ id: 'f1', name: 'frente.jpg', url: 'https://tally.so/x/frente.jpg', mimeType: 'image/jpeg', size: 1000 }] },
      { key: 'q3', label: 'Certidão (nascimento, casamento ou óbito)', type: 'FILE_UPLOAD', value: [{ id: 'f2', name: 'cert.pdf', url: 'https://tally.so/x/cert.pdf', mimeType: 'application/pdf', size: 2000 }] },
      { key: 'q4', label: 'Comprovante de residência', type: 'FILE_UPLOAD', value: [] },
      { key: 'q5', label: 'cardId', type: 'HIDDEN_FIELDS', value: '-Nabc123XYZ' }
    ]
  }
};
const corpo = Buffer.from(JSON.stringify(payload));
const ass = crypto.createHmac('sha256', segredo).update(corpo).digest('base64');

assert(t.assinaturaValida(corpo, ass, segredo), 'assinatura certa deve passar');
assert(!t.assinaturaValida(corpo, ass, 'outro'), 'segredo errado deve falhar');
assert(!t.assinaturaValida(Buffer.from(corpo + ' '), ass, segredo), 'corpo alterado deve falhar');
assert(!t.assinaturaValida(corpo, '', segredo) && !t.assinaturaValida(corpo, ass, ''), 'sem assinatura/segredo deve falhar');

const p = t.lerPayload(payload);
assert.equal(p.cardId, '-Nabc123XYZ');
assert.equal(p.nomeCliente, 'Maria da Silva');
assert.deepEqual(p.arquivos.map(a => a.tipo), ['RG_CNH', 'CERTIDAO']);
assert(t.cardIdValido(p.cardId) && !t.cardIdValido('../x') && !t.cardIdValido(''));

assert.equal(t.nomePadronizado({ nomeCard: 'João D\'Ávila / Silva', tipo: 'RG_CNH', data: '2026-10-16', n: 1, nomeOriginal: 'Foto.JPG', mime: 'image/jpeg' }), 'Joao_D_Avila_Silva_RG_CNH_2026-10-16_1.jpg');
assert.equal(t.tipoPeloCampo('Outros documentos'), 'OUTROS');
console.log('tally: ok');
