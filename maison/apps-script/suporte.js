/**
 * Suporte do painel Maison Beauty.
 * Recebe o pedido de ajuda do painel e manda por e-mail para quem cuida dele.
 *
 * Como publicar: ver maison/FIREBASE.md ("Pedido de ajuda por e-mail").
 * Limite: o Gmail comum deixa o Apps Script mandar cerca de 100 e-mails por dia.
 */
const DESTINO = 'dantasshy@gmail.com';
// Tem de ser igual ao SUPORTE_CHAVE do index.html. Não é senha forte: só barra mensagem aleatória.
const CHAVE = 'YeW0wL5MBpOcA1bkiv3KCz9xhpb_iSEV';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.chave !== CHAVE) return resposta({ ok: false, erro: 'chave' });
    const tipo = d.tipo === 'erro' ? 'ERRO' : 'PEDIDO';
    const assunto = '[Maison] ' + tipo + ' · ' + (d.por || '?') + ' · tela ' + (d.tela || '?');
    const corpo = [
      d.msg || '(sem texto)',
      '',
      '— Quem: ' + (d.por || '?') + ' (' + (d.perfil || '?') + ')',
      '— Tela: ' + (d.tela || '?'),
      '— Quando: ' + (d.em || '?'),
      '— Aparelho: ' + (d.navegador || '?'),
      d.erros ? '— Últimos erros: ' + d.erros : '— Sem erro registrado',
    ].join('\n');
    MailApp.sendEmail({ to: DESTINO, subject: assunto, body: corpo });
    return resposta({ ok: true });
  } catch (err) {
    return resposta({ ok: false, erro: String(err) });
  }
}

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
