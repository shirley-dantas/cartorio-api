// A ponte entre o painel e o Ajudante. Só atende a própria página do painel (mesma origem, mesma janela):
// nenhum outro site consegue mandar pedido para cá. O painel pergunta "tem Ajudante?" e só desenha o botão se ouvir resposta.
(function () {
  'use strict';
  const VERSAO = '0.1.9';
  const avisar = (m) => window.postMessage(Object.assign({ fonte: 'ajudante' }, m), location.origin);

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const d = e.data;
    if (!d || d.fonte !== 'painel-cartorio') return;
    if (d.tipo === 'ajudante-ping') return avisar({ tipo: 'ajudante-pronto', versao: VERSAO });
    if (d.tipo === 'ajudante-pedido') {
      const id = d.pedido && d.pedido.id;
      Promise.resolve(chrome.runtime.sendMessage({ tipo: 'pedido', pedido: d.pedido }))
        .then((r) => { if (!r || !r.ok) avisar({ tipo: 'ajudante-progresso', id, estado: 'erro', fim: true, texto: (r && r.texto) || 'O Ajudante recusou o pedido.' }); })
        .catch(() => avisar({ tipo: 'ajudante-progresso', id, estado: 'erro', fim: true, texto: 'O Ajudante não respondeu. Recarregue a página do painel (F5) e tente de novo.' }));
    }
    if (d.tipo === 'ajudante-cancelar') { try { chrome.runtime.sendMessage({ tipo: 'cancelar', id: d.id }); } catch (_) { /* o painel já mostra o resto */ } }
  });

  chrome.runtime.onMessage.addListener((m) => {
    if (m && m.tipo === 'progresso') avisar({ tipo: 'ajudante-progresso', id: m.id, estado: m.estado, texto: m.texto, fim: !!m.fim });
  });
  avisar({ tipo: 'ajudante-pronto', versao: VERSAO });
})();
