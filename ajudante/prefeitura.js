// O Ajudante na Prefeitura de São Paulo: Consulta Valor Venal de Referência (itbi.prefeitura.sp.gov.br/valorreferencia).
// Sem login, sem captcha e sem pagamento: a página pede o número do cadastro do imóvel (o contribuinte, em quatro quadradinhos: 3 + 3 + 4 + dígito)
// e a data, e responde na MESMA página com uma tabela SQL / Valor / Endereço — não sai PDF. O Ajudante preenche, clica em Pesquisar, lê a resposta
// e entrega ao fundo, que tira uma foto da tela (é o que ela fazia: imprimir a tela para ela ter cara de certidão) e guarda no card.
// A parte que decide (planejar) é pura — recebe a página e devolve o que fazer — e por isso tem teste.
//
// Regra que segura tudo: **o que a prefeitura devolveu só vale se for do contribuinte que foi pedido.** Resposta de outro número, mensagem de erro
// (inclusive a que vaza texto do servidor) e página que não se reconhece nunca viram "certidão": viram aviso escrito.
(function (raiz) {
  'use strict';
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const digitos = (s) => String(s || '').replace(/\D/g, '');
  const visivel = (el) => !!(el && (el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length)));
  const ehData = (d) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(d || '')); if (!m) return false;
    const dt = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return dt.getFullYear() === Number(m[3]) && dt.getMonth() === Number(m[2]) - 1 && dt.getDate() === Number(m[1]);
  };
  // 159.087.0016-8 → ['159','087','0016','8'] (só dígitos, 11 deles)
  const partesDoSql = (sql) => { const d = digitos(sql); return d.length === 11 ? [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10), d.slice(10)] : null; };
  const formatarSql = (sql) => { const p = partesDoSql(sql); return p ? p[0] + '.' + p[1] + '.' + p[2] + '-' + p[3] : ''; };

  // Os cinco campos de texto da linha "Cadastro do imóvel": quatro do número e a data. Pela largura de cada um quando a página a declara,
  // e pela ordem quando não declara — mas só se houver exatamente o que se espera, nunca no chute.
  function campos(doc) {
    const ins = Array.from(doc.querySelectorAll('input')).filter((i) => visivel(i) && (!i.type || /^(text|tel|number)$/i.test(i.type)));
    if (ins.length < 5) return null;
    const esperado = [3, 3, 4, 1];
    for (let i = 0; i < 4; i++) { const ml = Number(ins[i].maxLength); if (ml > 0 && ml !== esperado[i]) return null; }
    return { sql: ins.slice(0, 4), data: ins[4] };
  }
  function botaoPesquisar(doc) {
    return Array.from(doc.querySelectorAll('input[type=submit],input[type=button],button')).filter(visivel)
      .find((b) => norm(b.value || b.innerText || b.textContent) === 'pesquisar') || null;
  }
  // A mensagem que a página escreve dentro do quadro ("Mensagem: NUMERO DO CADASTRO DO IMOVEL NAO ENCONTRADO", ou o erro cru do servidor).
  function mensagem(doc) {
    const t = String((doc.body && (doc.body.innerText || doc.body.textContent)) || '').replace(/\s+/g, ' ');
    const m = /mensagem:\s*(.+?)(?:\s+(?:pesquisar|limpar|voltar)\b|$)/i.exec(t);
    return m ? m[1].trim() : '';
  }
  // A tabela da resposta: cabeçalho SQL | Valor | Endereço e uma linha de dados.
  function resposta(doc) {
    for (const tab of Array.from(doc.querySelectorAll('table'))) {
      const linhas = Array.from(tab.querySelectorAll('tr'));
      const cab = linhas.findIndex((tr) => { const c = Array.from(tr.children).map((x) => norm(x.textContent)); return c.length >= 3 && c[0] === 'sql' && c[1] === 'valor' && /^endere/.test(c[2]); });
      if (cab < 0 || !linhas[cab + 1]) continue;
      const cel = Array.from(linhas[cab + 1].children).map((x) => String(x.textContent || '').replace(/\s+/g, ' ').trim());
      if (cel.length >= 3) return { sql: cel[0], valor: cel[1], endereco: cel.slice(2).join(' ') };
    }
    return null;
  }

  // O que fazer agora. `estado`: { clicou } — se o botão já foi clicado nesta tentativa.
  function planejar(doc, job, estado) {
    const clicou = !!(estado && estado.clicou);
    const alvo = digitos(job && job.sql);
    const r = resposta(doc);
    if (r) {
      if (digitos(r.sql) === alvo) return { acao: 'resultado', sql: formatarSql(alvo), valor: r.valor, endereco: r.endereco };
      if (clicou) return { acao: 'erro', texto: 'A prefeitura respondeu para outro cadastro (' + r.sql + ') e não para ' + formatarSql(alvo) + '. Não guardei nada.' };
    }
    const msg = mensagem(doc);
    if (msg && clicou) {
      if (/nao encontrado/.test(norm(msg))) return { acao: 'erro', texto: 'A prefeitura não achou o cadastro ' + formatarSql(alvo) + ' (“' + msg + '”). Confira o número contra a matrícula.' };
      return { acao: 'erro', texto: 'A prefeitura devolveu uma mensagem: “' + msg.slice(0, 160) + '”. Não guardei nada.' };
    }
    const c = campos(doc), b = botaoPesquisar(doc);
    if (!c || !b) return { acao: 'nao-reconheco', texto: 'Não reconheço esta tela da prefeitura (faltam os campos do cadastro ou o botão Pesquisar).' };
    if (clicou) return { acao: 'esperar' };
    return { acao: 'preencher', campos: c, botao: b, partes: partesDoSql(alvo), data: job.data };
  }

  const api = { planejar, campos, botaoPesquisar, mensagem, resposta, partesDoSql, formatarSql, ehData, norm };
  raiz.AJ_PREF = api;

  // ── Daqui para baixo é a parte que mexe na página (só no navegador, com a extensão) ─────────────────────────
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage || typeof document === 'undefined') return;

  const faixa = {};
  function montarFaixa() {
    if (faixa.el) { if (!faixa.el.isConnected && document.body) document.body.appendChild(faixa.el); return; }
    const el = document.createElement('div');
    el.id = 'aj-faixa';
    el.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:340px;max-width:calc(100vw - 32px);background:#1F2A33;color:#fff;border-radius:14px;padding:12px 14px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);border-top:5px solid #A9895A';
    el.innerHTML = '<div style="font-weight:700;margin-bottom:4px">Ajudante do painel — Prefeitura</div><div id="aj-txt"></div>';
    document.body.appendChild(el);
    faixa.el = el; faixa.txt = el.querySelector('#aj-txt');
  }
  function mostrar(texto, cor) { montarFaixa(); faixa.txt.textContent = texto; faixa.el.style.borderTopColor = cor || '#A9895A'; }
  const mandar = (m) => { try { return chrome.runtime.sendMessage(m); } catch (_) { return null; } };
  function preencher(campo, valor) {
    const proto = HTMLInputElement.prototype;
    campo.focus(); Object.getOwnPropertyDescriptor(proto, 'value').set.call(campo, valor);
    campo.dispatchEvent(new Event('input', { bubbles: true })); campo.dispatchEvent(new Event('change', { bubbles: true })); campo.blur();
  }
  const chave = (job) => 'ajpref_' + job.id;
  const clicouEm = (job) => { try { return Number(sessionStorage.getItem(chave(job)) || 0); } catch (_) { return 0; } };

  async function iniciar() {
    let job;
    try { job = await chrome.runtime.sendMessage({ tipo: 'quem' }); } catch (_) { return; }
    if (!job || !job.id || job.fim || job.site !== 'pref') return;
    mostrar('Ajudante ligado…');
    let avisouMao = false, entregue = false;
    const tick = () => {
      if (entregue) return true;
      const t = clicouEm(job), p = planejar(document, job, { clicou: t > 0 });
      if (p.acao === 'resultado') {
        entregue = true; mostrar('Achei: ' + p.valor + ' — guardando no card…');
        mandar({ tipo: 'pref-resultado', sql: p.sql, valor: p.valor, endereco: p.endereco }); return true;
      }
      if (p.acao === 'erro') { entregue = true; mostrar(p.texto, '#B3261E'); mandar({ tipo: 'pref-erro', texto: p.texto }); return true; }
      if (p.acao === 'nao-reconheco') { entregue = true; mostrar(p.texto, '#B3261E'); mandar({ tipo: 'pref-erro', texto: p.texto + ' Faça à mão e arraste a imagem para a caixa do card.' }); return true; }
      if (p.acao === 'preencher') {
        mostrar('Preenchendo o cadastro ' + job.sqlFormatado + ' e a data ' + job.data + '…');
        p.campos.sql.forEach((c, i) => preencher(c, p.partes[i])); preencher(p.campos.data, p.data);
        try { sessionStorage.setItem(chave(job), String(Date.now())); } catch (_) { /* sem sessionStorage: clica uma vez só */ }
        mandar({ tipo: 'pref-pagina', texto: 'Consultando o valor venal de referência de ' + job.sqlFormatado + '…' });
        p.botao.click(); return false;
      }
      // Clicou e a página ainda não respondeu: espera; passado um tempo, pede o clique dela (nunca insiste sozinho).
      if (t && Date.now() - t > 12000 && !avisouMao) { avisouMao = true; mostrar('A página não respondeu ao meu clique. Clique você em Pesquisar — eu leio a resposta.', '#B3261E'); mandar({ tipo: 'pref-pagina', texto: 'Clique em Pesquisar na aba da prefeitura — o Ajudante lê a resposta.' }); }
      return false;
    };
    const relogio = setInterval(() => { if (tick()) clearInterval(relogio); }, 1200);
    setTimeout(() => clearInterval(relogio), 5 * 60 * 1000);
  }
  iniciar();
})(typeof globalThis !== 'undefined' ? globalThis : this);
