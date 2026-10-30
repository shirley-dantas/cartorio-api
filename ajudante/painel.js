// A ponte entre o painel e o Ajudante. Só atende a própria página do painel (mesma origem, mesma janela):
// nenhum outro site consegue mandar pedido para cá. O painel pergunta "tem Ajudante?" e só desenha o botão se ouvir resposta.
(function () {
  'use strict';
  const VERSAO = '0.3.0';
  // Depois que a extensão é recarregada ou atualizada, a página do painel que já estava aberta perde a ligação com ela: chrome.runtime.sendMessage
  // passa a dar erro (às vezes na hora, sem promessa), e o pedido ficava parado em "abrindo…" sem dizer nada. Agora diz o que fazer.
  const ORFA = 'A extensão foi atualizada ou reiniciada e esta página perdeu a ligação com ela. Recarregue o painel (F5) e tente de novo.';
  const enviar = (m) => { try { if (!chrome.runtime || !chrome.runtime.id) throw new Error('sem ligação'); return Promise.resolve(chrome.runtime.sendMessage(m)); } catch (e) { return Promise.reject(e); } };
  const avisar = (m) => window.postMessage(Object.assign({ fonte: 'ajudante' }, m), location.origin);

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const d = e.data;
    if (!d || d.fonte !== 'painel-cartorio') return;
    if (d.tipo === 'ajudante-ping') return avisar({ tipo: 'ajudante-pronto', versao: VERSAO, onr: true, pref: true });
    if (d.tipo === 'ajudante-pedido') {
      const id = d.pedido && d.pedido.id;
      enviar({ tipo: 'pedido', pedido: d.pedido })
        .then((r) => { if (!r || !r.ok) avisar({ tipo: 'ajudante-progresso', id, estado: 'erro', fim: true, texto: (r && r.texto) || 'O Ajudante recusou o pedido.' }); })
        .catch(() => avisar({ tipo: 'ajudante-progresso', id, estado: 'erro', fim: true, texto: ORFA }));
    }
    if (d.tipo === 'ajudante-cancelar') { enviar({ tipo: 'cancelar', id: d.id }).catch(() => { /* o painel já mostra o resto */ }); }
  });

  chrome.runtime.onMessage.addListener((m) => {
    if (m && m.tipo === 'progresso') avisar({ tipo: 'ajudante-progresso', id: m.id, estado: m.estado, texto: m.texto, fim: !!m.fim, relatorio: m.relatorio });
  });
  avisar({ tipo: 'ajudante-pronto', versao: VERSAO, onr: true, pref: true });
})();
