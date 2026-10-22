// O Apps Script do pagamento (pagar.html), com o Google e o Firebase fingidos.
//   node testes/pagamento-envio.mjs
// O que se prova aqui: o comprovante vai para o CASO do código do link (nunca um id mandado pela página), fora de
// /documentos (a minuta lê tudo ali), só com o selo certo; o link só fecha quando TODAS as cobranças têm
// comprovante; e o painel só recebe o arquivo de volta (para imprimir) quando o selo confere.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import vm from 'node:vm';
import {createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
const AQUI = dirname(fileURLToPath(import.meta.url));
const fonte = readFileSync(join(AQUI, '..', 'apps-script', 'cartorio-drive-api.js'), 'utf8');
const erros = [];
const passo = async (n, f) => { try { await f(); console.log('  ok  ' + n); } catch (e) { erros.push(n); console.log('FALHA ' + n + ' → ' + e.message); } };
const ARQUIVOS = {};
function mundo({recusaBanco = false, iaFalha = false} = {}) {
  const db = {};
  const caminho = (u) => u.replace('https://painel-cartorio-default-rtdb.firebaseio.com', '').replace('.json', '').split('/').filter(Boolean);
  const pegar = (p) => p.reduce((o, k) => (o == null ? o : o[k]), db);
  const pôr = (p, v) => { let o = db; p.slice(0, -1).forEach((k) => { o = o[k] = o[k] || {}; }); o[p[p.length - 1]] = v; };
  const externos = []; const props = {ANTHROPIC_API_KEY: 'x'};
  const resposta = (cod, corpo) => ({getResponseCode: () => cod, getContentText: () => JSON.stringify(corpo === undefined ? null : corpo)});
  class Pasta {
    constructor(nome) { this.nome = nome; this.arquivos = []; this.sub = []; this.id = 'pasta' + (Pasta.n = (Pasta.n || 0) + 1); }
    getUrl() { return 'https://drive.google.com/drive/folders/' + this.id; }
    createFile(a, b) { const id = 'arq' + (Pasta.nf = (Pasta.nf || 0) + 1) + 'abcdefghij'; const f = {id, nome: a.name || a, bytes: a.bytes || b, lixeira: false, getId: () => id, getUrl: () => 'https://drive.google.com/file/d/' + id + '/view?usp=drivesdk', setTrashed(v) { f.lixeira = v; }, getBlob: () => ({getContentType: () => 'image/jpeg', getBytes: () => f.bytes})}; this.arquivos.push(f); ARQUIVOS[id] = f; return f; }
    getFoldersByName(n) { const l = this.sub.filter((p) => p.nome === n); let i = 0; return {hasNext: () => i < l.length, next: () => l[i++]}; }
    createFolder(n) { const p = new Pasta(n); this.sub.push(p); return p; }
  }
  const raiz = new Pasta('raiz'); const todas = {[raiz.id]: raiz}; const reg = (p) => (todas[p.id] = p, p);
  const origCreate = Pasta.prototype.createFolder; Pasta.prototype.createFolder = function (n) { return reg(origCreate.call(this, n)); };
  const caixa = {
    console, Logger: {log() {}}, Buffer, Date,
    UrlFetchApp: {fetch(url, o = {}) {
      if (!url.startsWith('https://painel-cartorio-default-rtdb.firebaseio.com')) { externos.push(url); return resposta(200, {}); }
      const p = caminho(url), m = (o.method || 'get').toLowerCase();
      if (m === 'get') return resposta(200, pegar(p));
      if (recusaBanco) return resposta(401, {error: 'Permission denied'});
      if (m === 'delete') { const pai = pegar(p.slice(0, -1)); if (pai) delete pai[p[p.length - 1]]; return resposta(200, null); }
      const v = JSON.parse(o.payload);
      if (m === 'put') pôr(p, v); else if (m === 'patch') pôr(p, Object.assign({}, pegar(p) || {}, v));
      return resposta(200, v);
    }},
    DriveApp: {getFolderById(id) { if (!todas[id]) throw new Error('sem pasta ' + id); return todas[id]; }, getFileById(id) { if (!ARQUIVOS[id]) throw new Error('sem arquivo ' + id); return ARQUIVOS[id]; }},
    Utilities: {
      computeHmacSha256Signature: (texto, chave) => Array.from(createHmac('sha256', chave).update(texto).digest()).map((b) => (b > 127 ? b - 256 : b)),
      base64Encode: (b) => Buffer.from(b).toString('base64'),
      base64Decode: (s) => Array.from(Buffer.from(s, 'base64')),
      newBlob: (bytes, mime, name) => ({bytes, mime, name}),
      formatDate: (d, tz, f) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(d).map((x) => [x.type, x.value])); return f === 'yyyy-MM-dd' ? `${p.year}-${p.month}-${p.day}` : `${p.day}/${p.month}/${p.year}`; },
      getUuid: () => Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2) + '-x'
    },
    LockService: {getScriptLock: () => ({waitLock() {}, releaseLock() {}})},
    ContentService: {createTextOutput: (s) => ({s, setMimeType() { return this; }}), MimeType: {JSON: 'json'}},
    MimeType: {PLAIN_TEXT: 'text/plain'},
    PropertiesService: {getScriptProperties: () => ({getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; }})},
    ScriptApp: {}, DocumentApp: {}, CalendarApp: {}
  };
  vm.createContext(caixa);
  vm.runInContext(fonte, caixa);
  caixa.lerDocumentoComIA = () => { if (iaFalha) throw new Error('IA fora'); return {texto: 'TIPO_DOCUMENTO: RG\nNome: Maria da Silva', truncou: false}; };
  // O Drive fingido: a raiz tem que ser achável pelo id real que o script usa.
  todas[vm.runInContext('PASTA_RAIZ_ID', caixa)] = raiz;
  const chamar = (corpo) => JSON.parse(caixa.doPost({postData: {contents: JSON.stringify(corpo)}}).s);
  return {db, caixa, chamar, externos, raiz, todas, reg};
}

const TOKEN = 'pG3dE6gH9jK2mN5pQ8sT1vX4';
const B64 = Buffer.from('comprovante-pix').toString('base64');
function semear(m, {itens = {escritura: true, registro: true}, expira = Date.now() + 864e5, driveUrl = ''} = {}) {
  m.db.casos = {'-Caso1': {nome: 'Maria da Silva', driveUrl, documentos: {}, pagamento: {token: TOKEN, status: 'aguardando'}}, '-Caso2': {nome: 'Outro Cliente', documentos: {}}};
  m.db.cobrancas = {[TOKEN]: {meta: {casoId: '-Caso1', criadoEm: Date.now(), expiraEm: expira, itens}, dados: {nome: 'Maria'}, imagens: {recibo: 'data:image/jpeg;base64,AAA'}}};
}
const arq = (qual = 'escritura', extra = {}) => ({acao: 'pagamento-arquivo', t: TOKEN, qual, nomeArquivo: 'pix.jpg', mimetype: 'image/jpeg', base64: B64, ...extra});

await passo('o comprovante vai para a pasta do caso do código, com nome limpo, e NÃO entra nos documentos que a minuta lê', () => {
  const m = mundo(); semear(m);
  const r = m.chamar(arq('escritura', {t: TOKEN, casoId: '-Caso2'}));
  assert.equal(r.ok, true);
  assert(/^Comprovante_Escritura_Maria_da_Silva_\d{4}-\d{2}-\d{2}_\w{4}\.jpg$/.test(r.nome), r.nome);
  const c = m.db.cobrancas[TOKEN].meta.comprovantes.escritura;
  assert(c.docKey.startsWith('pag_pG3dE6_') && c.selo && /drive\.google\.com\/file\/d\//.test(c.link) && c.nome === 'pix.jpg');
  assert.deepEqual(m.db.casos['-Caso1'].documentos, {}, 'não vira documento do card (a minuta travaria num arquivo sem leitura)');
  assert.deepEqual(m.db.casos['-Caso2'].documentos, {}, 'nunca o caso que a página mandar');
  assert.equal(Object.keys(m.todas).filter((k) => m.todas[k].arquivos.length).length, 1, 'o arquivo foi para uma pasta só');
});
await passo('entrada ruim é recusada em voz alta: link vencido, tipo estranho, arquivo vazio, cobrança que o link não tem, código errado', () => {
  const v = mundo(); semear(v, {expira: Date.now() - 1000}); assert(/inválido|vencido/.test(v.chamar(arq()).erro));
  const m = mundo(); semear(m, {itens: {escritura: true}});
  assert(/não aceito/.test(m.chamar(arq('escritura', {mimetype: 'application/zip'})).erro));
  assert(/vazio/.test(m.chamar(arq('escritura', {base64: ''})).erro));
  assert(/Cobrança inválida/.test(m.chamar(arq('registro')).erro), 'o link só da escritura não aceita comprovante do registro');
  assert(/Cobrança inválida/.test(m.chamar(arq('qualquer')).erro));
  assert.equal(m.chamar(arq('escritura', {t: 'curto'})).ok, false);
  assert.equal(Object.keys(m.db.cobrancas[TOKEN].meta).includes('comprovantes'), false, 'nada foi gravado');
});
await passo('o banco recusa a gravação: o erro é escrito, nunca "ok"', () => {
  const m = mundo({recusaBanco: true}); semear(m);
  const r = m.chamar(arq()); assert.equal(r.ok, false); assert(/banco recusou/.test(r.erro));
});
await passo('trocar o comprovante: o novo entra e o antigo vai para a lixeira (só com o selo certo)', () => {
  const m = mundo(); semear(m);
  const a = m.chamar(arq()); const idAnt = m.db.cobrancas[TOKEN].meta.comprovantes.escritura.link.match(/\/d\/(\w+)/)[1];
  const b = m.chamar(arq('escritura', {nomeArquivo: 'novo.jpg'})); assert.equal(b.ok, true); assert.notEqual(a.docKey, b.docKey);
  assert.equal(m.db.cobrancas[TOKEN].meta.comprovantes.escritura.nome, 'novo.jpg');
  assert.equal(m.caixa.DriveApp.getFileById(idAnt).lixeira, true, 'o antigo foi para a lixeira');
  const falso = mundo(); semear(falso); falso.chamar(arq()); const f = falso.db.cobrancas[TOKEN].meta.comprovantes.escritura; f.selo = 'forjado';
  const idF = f.link.match(/\/d\/(\w+)/)[1]; falso.chamar(arq());
  assert.equal(falso.caixa.DriveApp.getFileById(idF).lixeira, false, 'selo errado: o Drive não é tocado');
});
await passo('concluir só com todos os comprovantes; fecha o link, avisa o card (não visto) e a equipe', () => {
  const m = mundo(); semear(m);
  m.chamar(arq('escritura'));
  const antes = m.chamar({acao: 'pagamento-concluir', t: TOKEN}); assert.equal(antes.ok, false); assert(/registro de imóveis/.test(antes.erro), antes.erro);
  assert(!m.db.cobrancas[TOKEN].meta.concluidoEm);
  m.chamar(arq('registro'));
  const r = m.chamar({acao: 'pagamento-concluir', t: TOKEN}); assert.equal(r.ok, true);
  assert(m.db.cobrancas[TOKEN].meta.concluidoEm > 0);
  const p = m.db.casos['-Caso1'].pagamento; assert.equal(p.status, 'recebido'); assert.equal(p.visto, false); assert(p.recebidoEm > 0); assert.equal(p.token, TOKEN, 'o resto do nó não é apagado');
  assert(m.externos.length >= 1, 'a equipe é avisada pelo WhatsApp');
  for (const acao of [arq(), {acao: 'pagamento-concluir', t: TOKEN}]) { const x = m.chamar(acao); assert.equal(x.ok, false); assert(/já usado|inválido/.test(x.erro)); }
});
await passo('link só da escritura: concluir com o comprovante dela basta', () => {
  const m = mundo(); semear(m, {itens: {escritura: true}});
  m.chamar(arq('escritura')); assert.equal(m.chamar({acao: 'pagamento-concluir', t: TOKEN}).ok, true);
});
await passo('o painel pede o comprovante de volta (para imprimir): só com o selo certo, e erro escrito quando não há', () => {
  const m = mundo(); semear(m);
  const vazio = m.chamar({acao: 'pagamento-ver', casoId: '-Caso1', qual: 'escritura'}); assert.equal(vazio.ok, false); assert(/Ainda não há/.test(vazio.erro));
  m.chamar(arq('escritura'));
  const r = m.chamar({acao: 'pagamento-ver', casoId: '-Caso1', qual: 'escritura'});
  assert.equal(r.ok, true); assert.equal(Buffer.from(r.base64, 'base64').toString(), 'comprovante-pix'); assert.equal(r.mime, 'image/jpeg'); assert.equal(r.nome, 'pix.jpg');
  assert(/não tem cobrança/.test(m.chamar({acao: 'pagamento-ver', casoId: '-Caso2', qual: 'escritura'}).erro), 'caso sem cobrança');
  assert.equal(m.chamar({acao: 'pagamento-ver', casoId: '-Caso1', qual: 'outra'}).ok, false);
  m.db.cobrancas[TOKEN].meta.comprovantes.escritura.selo = 'forjado';
  const f = m.chamar({acao: 'pagamento-ver', casoId: '-Caso1', qual: 'escritura'}); assert.equal(f.ok, false); assert(/não confere/.test(f.erro), 'selo errado: o Drive não é lido');
});

await passo('ler o recibo/boleto pela IA: devolve o JSON, recusa tipo/arquivo estranho e mostra o erro da IA escrito', () => {
  const m = mundo(); let pedido = null, saida = '{"total_das_custas":"3.039,89","total_recebido":"3.039,89","parcelas":["1.810,12","1.229,77"]}';
  m.caixa.chamarClaudeArquivoRaw = (c) => { pedido = c; if (saida instanceof Error) throw saida; return {texto: 'Aqui está:\n' + saida, truncou: false}; };
  const ok = m.chamar({acao: 'pagamento-ler', tipo: 'recibo', mimetype: 'image/jpeg', base64: B64});
  assert.equal(ok.ok, true); assert.equal(ok.dados.total_recebido, '3.039,89'); assert.deepEqual(ok.dados.parcelas, ['1.810,12', '1.229,77']);
  assert.equal(pedido[0].type, 'image'); assert(/TOTAL DAS CUSTAS/.test(pedido[1].text));
  m.chamar({acao: 'pagamento-ler', tipo: 'boleto', mimetype: 'application/pdf', base64: B64});
  assert.equal(pedido[0].type, 'document'); assert(/linha_digitavel/.test(pedido[1].text));
  assert.equal(m.chamar({acao: 'pagamento-ler', tipo: 'outro', mimetype: 'image/jpeg', base64: B64}).ok, false);
  assert.equal(m.chamar({acao: 'pagamento-ler', tipo: 'recibo', mimetype: 'application/msword', base64: B64}).ok, false);
  assert.equal(m.chamar({acao: 'pagamento-ler', tipo: 'recibo', mimetype: 'image/jpeg', base64: ''}).ok, false);
  saida = 'não consegui ler'; assert(/formato legível/.test(m.chamar({acao: 'pagamento-ler', tipo: 'recibo', mimetype: 'image/png', base64: B64}).erro));
  saida = new Error('IA fora'); assert(/IA fora/.test(m.chamar({acao: 'pagamento-ler', tipo: 'recibo', mimetype: 'image/png', base64: B64}).erro));
});

await passo('aprovar o orçamento: registra no card (versão, data, não visto), fecha para repetir, e só vale para link de orçamento', () => {
  const m = mundo(); semear(m);
  m.db.cobrancas.ORCtoken1234567890abcdef = {meta: {tipo: 'orcamento', casoId: '-Caso1', orcId: 'o2', versao: '2', criadoEm: Date.now(), expiraEm: Date.now() + 864e5}, dados: {nome: 'Maria'}, imagens: {}};
  const T = 'ORCtoken1234567890abcdef';
  assert.equal(m.chamar({acao: 'orcamento-aprovar', t: TOKEN}).ok, false, 'link de pagamento não aprova orçamento');
  assert.equal(m.chamar({acao: 'orcamento-aprovar', t: 'curto'}).ok, false);
  const r = m.chamar({acao: 'orcamento-aprovar', t: T}); assert.equal(r.ok, true);
  const a = m.db.casos['-Caso1'].orcAprovacao; assert.equal(a.orcId, 'o2'); assert.equal(a.versao, '2'); assert.equal(a.visto, false); assert.equal(a.em, r.em);
  assert.equal(m.db.cobrancas[T].meta.aprovadoEm, r.em);
  const de = m.chamar({acao: 'orcamento-aprovar', t: T}); assert.equal(de.ok, true); assert.equal(de.em, r.em, 'aprovar de novo não muda a data');
  assert.equal(m.db.casos['-Caso1'].pagamento.status, 'aguardando', 'não mexe no pagamento');
  m.db.cobrancas.ORCvencido1234567890abcd = {meta: {tipo: 'orcamento', casoId: '-Caso1', orcId: 'o1', versao: '1', expiraEm: Date.now() - 1000}};
  assert(/venceu/.test(m.chamar({acao: 'orcamento-aprovar', t: 'ORCvencido1234567890abcd'}).erro));
  assert.equal(m.chamar(arq('escritura', {t: T})).ok, false, 'o link do orçamento não recebe comprovante de pagamento');
});
console.log(erros.length ? '\n' + erros.length + ' falha(s)' : '\ntudo certo');
process.exit(erros.length ? 1 : 0);
