// O Ajudante na RI Digital (a ONR): visualização de matrícula e matrícula atualizada (certidão digital, inteiro teor).
// Quem entra no site é o certificado dela, já instalado: aqui não existe senha. A parte que decide (planejar) é pura — recebe a página e
// devolve o que fazer — e por isso tem teste.
//
// A regra que segura tudo: **o Ajudante nunca clica em nada que gaste crédito.** Ele só clica numa lista curta de botões inofensivos
// (os cartões do serviço, o estado no mapa, "Prosseguir", "Novo Pedido") e caixas de aceite; as formas de pagamento (Saldo em Créditos,
// Pix, boleto, cartão) e o botão que confirma a visualização ficam para o clique dela. O captcha ("Não sou um robô") também é dela.
(function (raiz) {
  'use strict';
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const digitos = (s) => String(s || '').replace(/\D/g, '');
  const visivel = (el) => !!(el && (el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length)));
  const ehBotao = (el) => /^(submit|button|image)$/i.test(el.type || '');
  const textoDe = (el) => norm(ehBotao(el) && el.value ? el.value : (el.innerText || el.textContent));
  const textoDaPagina = (doc) => norm((doc.body && (doc.body.innerText || doc.body.textContent)) || '');

  const SERVICOS = {
    visualizacao: { cartao: 'visualizacao de matricula', nome: 'Visualização de matrícula' },
    certidao: { cartao: 'certidao digital', nome: 'Matrícula atualizada (certidão digital)' }
  };
  // A declaração de finalidade é escolha dela — sempre esta —, e o Ajudante só marca esta. Se a opção não existir, ele para: nunca escolhe outra.
  const FINALIDADE = 'titular de algum direito real';
  // O que gasta crédito ou compromete o pedido: nunca é clicado. O teste varre as telas e cobra isso.
  const NUNCA_CLICAR = /saldo em creditos|\bpix\b|boleto|cartao de credito|pagar|pagamento|finalizar|comprar|efetuar|adicionar nova|excluir|voltar|confirmar/;

  const CLICAVEIS = 'a,button,input[type=submit],input[type=button],input[type=image],[onclick],[role=button]';
  const clicaveis = (doc) => Array.from(doc.querySelectorAll(CLICAVEIS)).filter(visivel);
  const clicavelDe = (el) => (el.closest && el.closest(CLICAVEIS)) || el;
  function achar(doc, rotulo, exato) {
    const r = norm(rotulo);
    return clicaveis(doc).find((el) => { const t = textoDe(el); return exato ? t === r : t.startsWith(r); }) || null;
  }
  // O elemento mais interno cujo texto é o procurado (um cartão de serviço é uma caixa com texto dentro; o que se clica é a caixa ou o link dela).
  function acharTexto(doc, texto) {
    const r = norm(texto);
    const cand = Array.from(doc.querySelectorAll('a,button,[onclick],[role=button],div,li,span,td,h2,h3,h4,p,label')).filter(visivel).filter((el) => textoDe(el) === r || (textoDe(el).includes(r) && textoDe(el).length < r.length + 12));
    cand.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
    return cand[0] ? clicavelDe(cand[0]) : null;
  }
  // O estado no mapa: pelo atributo (id, data-uf, title…) ou pela sigla escrita dentro do desenho.
  function acharUF(doc, uf) {
    const u = uf.toLowerCase(), attrs = ['id', 'data-uf', 'data-sigla', 'data-estado', 'data-id', 'title', 'alt', 'name', 'aria-label'];
    const todos = Array.from(doc.querySelectorAll('svg *,area,a,[onclick],div,span,li,button')).filter(visivel);
    const porAttr = todos.find((el) => attrs.some((a) => { const v = norm(el.getAttribute && el.getAttribute(a)); return v && (v === u || new RegExp('(^|[-_ ])' + u + '$').test(v)); }));
    if (porAttr) return porAttr;
    const porTexto = todos.find((el) => norm(el.textContent) === u && !el.querySelector('*'));
    if (!porTexto) return null;
    return (porTexto.closest && porTexto.closest('a,g[onclick],[onclick]')) || porTexto;
  }

  // ── Selects: o contexto (o rótulo escrito perto) diz qual é qual ──
  const selects = (doc) => Array.from(doc.querySelectorAll('select')).filter(visivel);
  function contextoDe(sel, doc) {
    let c = '';
    if (sel.id) { const l = doc.querySelector('label[for="' + sel.id + '"]'); if (l) c += ' ' + l.textContent; }
    c += ' ' + (sel.getAttribute('aria-label') || '');
    for (let p = sel.parentElement; p && p !== doc.body && p.querySelectorAll('select').length === 1 && p.querySelectorAll('input:not([type=hidden]),textarea').length <= 1; p = p.parentElement) c += ' ' + p.textContent;
    return norm(c);
  }
  function acharSelect(doc, ...palavras) {
    const ss = selects(doc);
    const chave = (s) => norm((s.id || '') + ' ' + (s.name || ''));
    for (const p of palavras) { const s = ss.find((x) => chave(x).includes(p)); if (s) return s; }
    for (const p of palavras) { const s = ss.find((x) => contextoDe(x, doc).includes(p)); if (s) return s; }
    return null;
  }
  const opcoes = (sel) => Array.from(sel.options || []).map((o, i) => ({ i, texto: norm(o.textContent), valor: o.value, desab: o.disabled }));
  const ehPlaceholder = (o) => !o.valor || /^\(?selecione|^escolha/.test(o.texto) || o.texto === '--' || o.texto === '';
  const escolhida = (sel) => { const o = opcoes(sel)[sel.selectedIndex]; return o && !ehPlaceholder(o) ? o : null; };

  function campoMatricula(doc) {
    const campos = Array.from(doc.querySelectorAll('input[type=text],input:not([type]),textarea')).filter(visivel);
    return campos.find((c) => /matric|cnm/.test(norm((c.id || '') + ' ' + (c.name || '') + ' ' + (c.placeholder || '') + ' ' + (c.getAttribute('aria-label') || '')))) ||
      campos.find((c) => /^0+$/.test(c.placeholder || '')) || null;
  }
  const BOTOES_PROSSEGUIR = ['prosseguir', 'continuar', 'avancar'];
  const prosseguir = (doc) => { for (const r of BOTOES_PROSSEGUIR) { const b = achar(doc, r, true); if (b && !b.disabled) return b; } return null; };
  const valorDaTela = (doc) => { const m = /(?:valor total|total)[^0-9]{0,18}r\$\s*([\d.]+,\d{2})/.exec(textoDaPagina(doc)); return m ? 'R$ ' + m[1] : ''; };

  // Que passo do site é ESTA página? Só por sinais do conteúdo (a barra de passos aparece em todas as telas e não serve).
  function tela(doc, caminho, job) {
    if (achar(doc, 'saldo em creditos', false)) return 'pagamento';
    if (acharSelect(doc, 'finalidade')) return 'finalidade';
    if (acharSelect(doc, 'tipo certidao', 'tipocertidao', 'tipo de certidao') && acharSelect(doc, 'pedido por', 'pedidopor')) return 'tipo';
    if (acharSelect(doc, 'cidade')) return campoMatricula(doc) ? 'solicitacao' : 'cartorio';
    if (campoMatricula(doc)) return 'matriculas';
    const t = textoDaPagina(doc);
    if (Array.from(doc.querySelectorAll('input[type=checkbox]')).some(visivel) && /li, e estou ciente|li e concordo|concordo/.test(t)) return 'termos';
    if (/listagem de pedidos/.test(t) && acharTexto(doc, 'novo pedido')) return 'lista';
    if (job && job.uf && acharUF(doc, job.uf) && !/\/ServicosOnline/i.test(caminho)) return 'mapa';
    if (/\/ServicosOnline/i.test(caminho)) return 'home';
    return 'outra';
  }

  const escolher = (sel, achado, _quem, texto) => ({ acao: 'selecionar', el: sel, valor: achado.valor, texto });
  function selecionarOpcao(sel, ok) { return opcoes(sel).find((o) => !ehPlaceholder(o) && !o.desab && ok(o)) || null; }

  // O que fazer com ESTA página, dado o pedido. Nunca clica em nada que pague.
  function planejar(doc, caminho, job) {
    const sv = SERVICOS[job.servico];
    if (!sv) return { acao: 'erro', texto: 'Não sei qual serviço pedir.' };
    const tipo = tela(doc, caminho, job), mats = job.matriculas || [];
    const falta = (que) => ({ acao: 'erro', texto: que });

    if (tipo === 'pagamento') {
      const v = valorDaTela(doc);
      return { acao: 'esperar', espera: 'pagamento', texto: 'Tudo pronto' + (v ? ' — ' + v : '') + '. Para pagar, clique em “Saldo em Créditos”: o clique é seu, eu não pago nada. Quando o PDF baixar, eu o levo para o card.' };
    }
    if (tipo === 'finalidade') {
      const sel = acharSelect(doc, 'finalidade'), op = selecionarOpcao(sel, (o) => o.texto.includes(FINALIDADE));
      if (!op) return falta('Não achei a finalidade “titular de algum direito real” na lista do site. Escolha a finalidade você — eu não escolho outra.');
      const atual = escolhida(sel);
      if (!atual || !atual.texto.includes(FINALIDADE)) return escolher(sel, op, 'finalidade', 'Marcando a finalidade: titular de direito real…');
      if (job.servico === 'visualizacao') {
        const v = valorDaTela(doc);
        return { acao: 'esperar', espera: 'captcha', texto: 'Pronto' + (v ? ' — ' + v + ' em créditos' : '') + '. Marque “Não sou um robô” e clique no botão para confirmar a visualização: é aqui que o crédito é gasto, e esse clique é seu. Eu pego a imagem quando abrir.' };
      }
      const b = prosseguir(doc);
      if (!b) return falta('Não achei o botão para seguir ao pagamento nesta tela.');
      return { acao: 'clicar', el: b, texto: 'Indo para a escolha do pagamento…' };
    }
    if (tipo === 'tipo') {
      const t = acharSelect(doc, 'tipo certidao', 'tipocertidao', 'tipo de certidao'), p = acharSelect(doc, 'pedido por', 'pedidopor');
      const ot = selecionarOpcao(t, (o) => /matricula/.test(o.texto) && /inteiro teor/.test(o.texto));
      const op = selecionarOpcao(p, (o) => /matricula/.test(o.texto) && /cnm|n[º°o]? de/.test(o.texto));
      if (!ot) return falta('Não achei “Matrícula – Inteiro Teor” na lista de tipos de certidão.');
      if (!op) return falta('Não achei “Nº de Matrícula/CNM” em “Pedido por”.');
      const et = escolhida(t), ep = escolhida(p);
      if (!et || et.i !== ot.i) return escolher(t, ot, 'tipo', 'Escolhendo: Matrícula – Inteiro Teor…');
      if (!ep || ep.i !== op.i) return escolher(p, op, 'pedido', 'Escolhendo: pedido por número de matrícula…');
      const b = prosseguir(doc); if (!b) return falta('Não achei o botão Prosseguir.');
      return { acao: 'clicar', el: b, texto: 'Seguindo…' };
    }
    if (tipo === 'cartorio' || tipo === 'solicitacao') {
      const c = acharSelect(doc, 'cidade'), k = acharSelect(doc, 'cartorio'), cid = norm(job.cidade);
      const oc = selecionarOpcao(c, (o) => o.texto === cid) || selecionarOpcao(c, (o) => o.texto.startsWith(cid));
      if (!oc) return falta('Não achei a cidade “' + job.cidade + '” na lista da RI Digital para ' + job.uf + '. Confira o nome da cidade.');
      const ec = escolhida(c);
      if (!ec || ec.i !== oc.i) return escolher(c, oc, 'cidade', 'Escolhendo a cidade: ' + job.cidade + '…');
      if (!k) return falta('Não achei a lista de cartórios.');
      const reais = opcoes(k).filter((o) => !ehPlaceholder(o) && !o.desab);
      if (!reais.length) return { acao: 'esperar', espera: 'carregando', texto: 'Esperando a lista de cartórios de ' + job.cidade + '…' };
      const num = digitos(job.cartorio);
      let ok = num ? reais.find((o) => new RegExp('^0*' + num + '\\s*[º°o]?(\\s|$|[^0-9])').test(o.texto) || o.texto.includes(num + 'º') || o.texto.includes(num + '°')) : (reais.length === 1 ? reais[0] : null);
      if (!ok) return falta(num ? 'Não achei o ' + job.cartorio + ' cartório de registro de imóveis em ' + job.cidade + '.' : 'Há mais de um cartório em ' + job.cidade + ': diga o número do cartório no painel.');
      const ek = escolhida(k);
      if (!ek || ek.i !== ok.i) return escolher(k, ok, 'cartorio', 'Escolhendo o cartório: ' + (job.cartorio || ok.texto) + '…');
      if (tipo === 'solicitacao') {
        const m = campoMatricula(doc), v = mats[0] || '';
        if (!m) return falta('Não achei o campo da matrícula.');
        if (digitos(m.value) !== v) return { acao: 'preencher', campo: m, valor: v, texto: 'Digitando a matrícula ' + v + '…' };
      }
      const b = prosseguir(doc) || (tipo === 'solicitacao' ? achar(doc, 'solicitar', true) || achar(doc, 'pesquisar', true) : null);
      if (!b) return falta('Não achei o botão para seguir nesta tela.');
      return { acao: 'clicar', el: b, texto: 'Seguindo…' };
    }
    if (tipo === 'matriculas') {
      const m = campoMatricula(doc), v = mats.join(', ');
      if (!m) return falta('Não achei o campo das matrículas.');
      const lidas = String(m.value || '').split(/[\s,;]+/).filter(Boolean).map(digitos).join(',');
      if (lidas !== mats.join(',')) return { acao: 'preencher', campo: m, valor: v, texto: 'Digitando ' + (mats.length === 1 ? 'a matrícula ' : 'as matrículas ') + v + '…' };
      const b = prosseguir(doc) || achar(doc, 'adicionar', true) || achar(doc, 'incluir', true) || achar(doc, 'pesquisar', true); if (!b) return falta('Não achei o botão para seguir depois das matrículas.');
      return { acao: 'clicar', el: b, texto: 'Seguindo…' };
    }
    if (tipo === 'termos') {
      const caixa = Array.from(doc.querySelectorAll('input[type=checkbox]')).filter(visivel).find((c) => !c.checked);
      if (caixa) return { acao: 'marcar', el: caixa, texto: 'Marcando o aceite das condições…' };
      const b = prosseguir(doc); if (!b) return falta('Não achei o botão Prosseguir.');
      return { acao: 'clicar', el: b, texto: 'Prosseguindo…' };
    }
    if (tipo === 'lista') return { acao: 'clicar', el: acharTexto(doc, 'novo pedido'), texto: 'Abrindo um novo pedido…' };
    if (tipo === 'mapa') return { acao: 'clicar', el: acharUF(doc, job.uf), texto: 'Escolhendo o estado: ' + job.uf + '…' };
    if (tipo === 'home') {
      const cartao = acharTexto(doc, sv.cartao);
      if (!cartao) return falta('Não achei o serviço “' + sv.nome + '” na tela inicial.');
      return { acao: 'clicar', el: cartao, texto: 'Abrindo: ' + sv.nome + '…' };
    }
    if (job.pagouEm) return { acao: 'esperar', espera: 'pdf', texto: 'Pagamento feito. Esperando o PDF baixar para levá-lo ao card…' };
    return { acao: 'manual', texto: 'Não reconheço esta tela da RI Digital. Faça o próximo passo você — se o PDF abrir ou baixar, eu o levo para o card.' };
  }

  // O resumo da tela para ela copiar e me mandar: só a forma (botões, listas, campos), sem números longos.
  const mascarar = (t) => String(t).replace(/[A-Za-z0-9+\/=_%-]{40,}/g, '…').replace(/\d{9,}/g, '#').replace(/\s+/g, ' ');
  function relatorio(doc, caminho, job, extra) {
    const lista = (sel, f) => Array.from(doc.querySelectorAll(sel)).filter(visivel).slice(0, 40).map(f);
    return JSON.stringify({
      versao: (extra && extra.versao) || '', aviso: (extra && extra.aviso) || '', fundo: (extra && extra.fundo) || null,
      caminho, titulo: doc.title, tela: tela(doc, caminho, job || {}), servico: job && job.servico,
      botoes: lista(CLICAVEIS, (e) => (textoDe(e) || '').slice(0, 60)),
      selects: lista('select', (s) => ({ id: s.id, ctx: contextoDe(s, doc).slice(0, 60), escolhida: (escolhida(s) || {}).texto || '', opcoes: opcoes(s).slice(0, 14).map((o) => o.texto.slice(0, 60)) })),
      campos: lista('input:not([type=hidden]),textarea', (e) => [e.type, e.name, e.id, e.placeholder || ''].join('|')),
      texto: mascarar(textoDaPagina(doc)).slice(0, 500)
    }, null, 1);
  }

  const api = { norm, textoDe, achar, acharTexto, acharUF, acharSelect, campoMatricula, tela, planejar, relatorio, valorDaTela, NUNCA_CLICAR, FINALIDADE, SERVICOS };
  raiz.AJ_ONR = api;

  // ── Daqui para baixo é a parte que mexe na página (só no navegador, com a extensão) ─────────────────────────
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage || typeof document === 'undefined') return;

  const faixa = {};
  function montarFaixa() {
    if (faixa.el) { if (!faixa.el.isConnected && document.body) document.body.appendChild(faixa.el); return; }
    const el = document.createElement('div');
    el.id = 'aj-faixa';
    el.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:340px;max-width:calc(100vw - 32px);background:#1F2A33;color:#fff;border-radius:14px;padding:12px 14px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);border-top:4px solid #A9895A';
    el.innerHTML = '<div style="font-weight:700;margin-bottom:4px">Ajudante do painel — RI Digital</div><div id="aj-txt"></div><div id="aj-bt" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"></div>';
    document.body.appendChild(el);
    faixa.el = el; faixa.txt = el.querySelector('#aj-txt'); faixa.botoes = el.querySelector('#aj-bt');
  }
  function mostrar(texto, cor, extras) {
    montarFaixa(); faixa.txt.textContent = texto; faixa.el.style.borderTopColor = cor || '#A9895A'; faixa.botoes.innerHTML = '';
    (extras || []).forEach(([r, f]) => { const b = document.createElement('button'); b.textContent = r; b.style.cssText = 'background:#fff;color:#1F2A33;border:0;border-radius:8px;padding:6px 10px;font:600 13px system-ui;cursor:pointer'; b.onclick = f; faixa.botoes.appendChild(b); });
  }
  const dizer = (estado, texto, fatal) => { try { chrome.runtime.sendMessage({ tipo: 'status', estado, texto, fatal: !!fatal }); } catch (_) { /* o painel mostra o que já chegou */ } };
  const mandar = (m) => { try { return chrome.runtime.sendMessage(m); } catch (_) { return null; } };
  function tentativas(pedido, chave) {
    try { const k = 'ajonr_' + pedido + '_' + chave, n = Number(sessionStorage.getItem(k) || 0) + 1; sessionStorage.setItem(k, String(n)); return n; } catch (_) { return 1; }
  }
  const paraBase64 = (buf) => { const b = new Uint8Array(buf); let t = ''; for (let i = 0; i < b.length; i += 0x8000) t += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(t); };

  function preencher(campo, valor) {
    const proto = campo.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    campo.focus(); Object.getOwnPropertyDescriptor(proto, 'value').set.call(campo, valor);
    campo.dispatchEvent(new Event('input', { bubbles: true })); campo.dispatchEvent(new Event('change', { bubbles: true }));
  }
  // Link "javascript:__doPostBack(...)": o Chrome não deixa a extensão executar URL de script; o link só preenche dois campos e envia o formulário.
  function clicar(el) {
    const href = (el.getAttribute && el.getAttribute('href')) || '';
    if (/^\s*javascript:/i.test(href)) {
      const m = /__doPostBack\(\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/.exec(href), form = el.closest('form') || document.forms[0];
      if (!m || !form) throw new Error('Esse link da página roda um script que o Chrome não deixa a extensão executar.');
      const campo = (nome) => form.elements[nome] || Object.assign(form.appendChild(document.createElement('input')), { type: 'hidden', name: nome });
      campo('__EVENTTARGET').value = m[1]; campo('__EVENTARGUMENT').value = m[2];
      return HTMLFormElement.prototype.submit.call(form);
    }
    if (typeof el.click === 'function') return el.click();
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));   // desenho (SVG) não tem click()
  }

  async function copiarRelatorio(job, texto, cor) {
    let fundo = null; try { fundo = await chrome.runtime.sendMessage({ tipo: 'diagnostico-fundo' }); } catch (_) { /* o fundo pode não responder */ }
    const extra = { versao: (chrome.runtime.getManifest && chrome.runtime.getManifest().version) || '', aviso: texto, fundo };
    try { await navigator.clipboard.writeText(relatorio(document, location.pathname, job, extra)); mostrar(texto + ' (relatório copiado — cole na conversa)', cor || '#B3261E'); } catch (_) { /* sem permissão de área de transferência */ }
  }
  function parar(job, texto, estado) {
    mostrar(texto, '#B3261E', [['Copiar relatório', async () => { await copiarRelatorio(job, texto, null); }]]);
    dizer(estado || 'erro', texto, false);
  }

  async function iniciar() {
    let job;
    try { job = await chrome.runtime.sendMessage({ tipo: 'quem' }); } catch (_) { return; }
    if (!job || !job.id || job.fim || job.site !== 'onr') return;
    mostrar('Ajudante ligado…');

    // Só observa: se o clique no pagamento for DELA (isTrusted), o fundo passa a esperar o PDF. O Ajudante nunca clica nessas formas de pagar.
    document.addEventListener('click', (e) => {
      if (!e.isTrusted) return;
      const el = e.target && e.target.closest && e.target.closest(CLICAVEIS + ',div'), t = el ? textoDe(el) : '';
      if (/^(saldo em creditos|pix|boleto bancario|cartao de credito)/.test(t)) mandar({ tipo: 'onr-pagou', botao: t.slice(0, 40) });
    }, true);

    if (chrome.runtime.onMessage && chrome.runtime.onMessage.addListener) chrome.runtime.onMessage.addListener((m, remetente, responder) => {
      if (!m) return;
      if (m.tipo === 'buscar-url') {   // blob: e endereços do próprio site só se leem de dentro da página
        (async () => {
          try {
            const alvo = new URL(m.url, location.href);
            if (alvo.protocol !== 'blob:' && alvo.origin !== location.origin) return responder({ ok: false, erro: 'Endereço de outro site.' });
            const r = await fetch(alvo.href, { credentials: 'same-origin' }), buf = await r.arrayBuffer();
            responder({ ok: r.ok, status: r.status, tipo: r.headers.get('content-type') || '', base64: paraBase64(buf), bytes: buf.byteLength });
          } catch (e) { responder({ ok: false, erro: String((e && e.message) || e) }); }
        })();
        return true;
      }
      if (m.tipo === 'fim') mostrar(m.texto, m.estado === 'ok' ? '#2F7A4F' : '#B3261E');
      if (m.tipo === 'progresso-onr') mostrar(m.texto, '#2F7A4F');
    });

    // Cada tela vista fica no registro do fundo: é o que me diz, depois, o que o site fez quando o PDF saiu.
    const t0 = tela(document, location.pathname, job);
    mandar({ tipo: 'onr-pagina', tela: t0, caminho: location.pathname });
    montarFaixa();

    let ultimo = { sig: '', em: 0 }, esperaDesde = 0;
    const tick = () => {
      const plano = planejar(document, location.pathname, job);
      if (plano.acao === 'esperar') {
        if (plano.espera === 'carregando') { esperaDesde = esperaDesde || Date.now(); if (Date.now() - esperaDesde > 25000) { parar(job, 'A lista de cartórios não carregou. Escolha você e eu continuo.'); return true; } }
        mostrar(plano.texto, plano.espera === 'pagamento' || plano.espera === 'captcha' ? '#A9895A' : undefined, [['Copiar relatório', async () => { await copiarRelatorio(job, plano.texto, '#A9895A'); }]]);
        dizer('espera', plano.texto);
        if (plano.espera === 'pdf' || job.pagouEm) vigiarPdf();
        return false;
      }
      esperaDesde = 0;
      if (plano.acao === 'erro') { parar(job, plano.texto); return true; }
      if (plano.acao === 'manual') { mostrar(plano.texto, '#A9895A', [['Copiar relatório', async () => { await copiarRelatorio(job, plano.texto, '#A9895A'); }]]); dizer('manual', plano.texto); return false; }
      const sig = plano.acao + '|' + plano.texto, agora = Date.now();
      if (sig === ultimo.sig && agora - ultimo.em < 8000) return false;   // dá tempo ao site de responder
      if (tentativas(job.id, location.pathname + '|' + sig) > 4) { parar(job, 'A página não respondeu ao que eu fiz (tentei 4 vezes).'); return true; }
      ultimo = { sig, em: agora };
      mostrar(plano.texto); dizer('andando', plano.texto);
      try {
        if (plano.acao === 'preencher') preencher(plano.campo, plano.valor);
        else if (plano.acao === 'selecionar') { plano.el.value = plano.valor; plano.el.dispatchEvent(new Event('input', { bubbles: true })); plano.el.dispatchEvent(new Event('change', { bubbles: true })); }
        else if (plano.acao === 'marcar') clicar(plano.el);
        else if (plano.acao === 'clicar') { if (!plano.el) throw new Error('Não achei o botão desta tela.'); clicar(plano.el); }
      } catch (e) { parar(job, (e && e.message) || String(e)); return true; }
      return false;
    };
    // Depois do pagamento: se o PDF não chega, ou se já chegou e nada mais vem, o fundo fecha o pedido dizendo o que houve.
    let vigiaPdf = null;
    function vigiarPdf() {
      if (vigiaPdf) return;
      vigiaPdf = setInterval(async () => { const j = await mandar({ tipo: 'quem' }); if (!j || j.fim) { clearInterval(vigiaPdf); return; } mandar({ tipo: 'onr-vigia' }); }, 5000);
    }
    tick();
    const relogio = setInterval(() => { if (tick()) clearInterval(relogio); }, 1500);
    setTimeout(() => clearInterval(relogio), 20 * 60 * 1000);
  }
  iniciar();
})(typeof globalThis !== 'undefined' ? globalThis : this);
