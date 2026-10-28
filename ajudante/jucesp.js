// O Ajudante na JUCESP: entra pelas telas que ela mostrou (pesquisar → resultado → escolher o documento → PDF) e para quando não
// reconhece a página, em vez de adivinhar. Quem identifica a Shirley é o certificado do navegador dela: aqui não existe senha.
// A parte que decide (planejar) é pura — recebe o documento da página e devolve o que fazer — e por isso tem teste.
(function (raiz) {
  'use strict';
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const digitos = (s) => String(s || '').replace(/\D/g, '');
  const visivel = (el) => !!(el && (el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length)));
  const ehBotao = (el) => /^(submit|button|image)$/i.test(el.type || '');
  const textoDe = (el) => norm(ehBotao(el) && el.value ? el.value : (el.innerText || el.textContent));

  const DOCUMENTOS = {
    ficha: { radio: 'Ficha Cadastral Completa', nome: 'Ficha cadastral completa', arquivo: 'FICHA_CADASTRAL_COMPLETA', tipo: 'FICHA_CADASTRAL_JUCESP' },
    contrato: { radio: 'Copia Digitalizada', nome: 'Contrato social consolidado', arquivo: 'CONTRATO_SOCIAL_CONSOLIDADO', tipo: 'CONTRATO_SOCIAL' }
  };

  function clicaveis(doc) { return Array.from(doc.querySelectorAll('a,button,input[type=submit],input[type=button],input[type=image],[onclick]')).filter(visivel); }
  function achar(doc, rotulo, exato) {
    const r = norm(rotulo);
    return clicaveis(doc).find((el) => { const t = textoDe(el); return exato ? t === r : t.startsWith(r); }) || null;
  }
  const textoDaPagina = (doc) => norm((doc.body && (doc.body.innerText || doc.body.textContent)) || '');

  function logada(doc) { return !!achar(doc, 'sair', true) && /\bola,/.test(textoDaPagina(doc)); }

  function campoBusca(doc) {
    const botao = achar(doc, 'buscar', true);
    if (!botao) return null;
    for (let n = botao.parentElement; n && n !== doc.body; n = n.parentElement) {
      const campo = Array.from(n.querySelectorAll('input[type=text],input:not([type])')).filter(visivel)[0];
      if (campo) return { campo, botao };
    }
    return null;
  }

  // Os NIREs são os links de 11 dígitos da tabela de resultados; a empresa é a célula ao lado.
  function resultados(doc) {
    return Array.from(doc.querySelectorAll('a')).filter(visivel).filter((a) => /^\d{11}$/.test(digitos(a.textContent)) && digitos(a.textContent) === a.textContent.trim().replace(/\s/g, ''))
      .map((a) => {
        const linha = a.closest('tr'), celulas = linha ? Array.from(linha.children) : [], i = celulas.findIndex((c) => c.contains(a));
        return { nire: digitos(a.textContent), empresa: (celulas[i + 1] && celulas[i + 1].textContent.trim()) || '', el: a };
      });
  }

  function rotuloDoRadio(r) {
    const doc = r.ownerDocument, porFor = r.id && doc.querySelector('label[for="' + r.id + '"]');
    if (porFor) return norm(porFor.textContent);
    const dentroDeLabel = r.closest && r.closest('label');
    if (dentroDeLabel) return norm(dentroDeLabel.textContent);
    let depois = '';   // o texto que vem logo depois do botão, até o próximo campo ou quebra
    for (let n = r.nextSibling; n; n = n.nextSibling) {
      if (n.nodeType === 1 && /^(INPUT|BR|DIV|P|TR|LI|TD)$/.test(n.tagName)) break;
      depois += n.textContent;
    }
    if (norm(depois)) return norm(depois);
    const pai = r.parentElement;
    return norm((pai && pai.textContent) || '');
  }
  function acharRadio(doc, inicio) {
    const alvo = norm(inicio);
    return Array.from(doc.querySelectorAll('input[type=radio]')).find((r) => !r.disabled && rotuloDoRadio(r).startsWith(alvo)) || null;
  }

  // A lista das cópias digitalizadas: uma linha por ato arquivado. O que o ato é (consolidação ou não) pode estar só nos
  // DETALHES, escondido, por isso se lê o textContent da linha e das linhas de detalhe que vêm logo abaixo dela.
  // textContent cola as células (a data fica grudada no registro); aqui cada célula vira uma palavra separada.
  const textoDaLinha = (tr) => { const c = Array.from(tr.querySelectorAll('td,th')); return c.length ? c.map((x) => x.textContent.trim()).join(' ') : tr.textContent; };
  function linhasDaCopia(doc) {
    const linhas = Array.from(doc.querySelectorAll('tr')).filter((tr) => tr.querySelector('input[type=radio]'));
    return linhas.map((tr) => {
      let texto = textoDaLinha(tr);
      for (let p = tr.nextElementSibling; p && !p.querySelector('input[type=radio]'); p = p.nextElementSibling) {
        if (/mostrando \d+/.test(norm(p.textContent))) break;   // a paginação não é detalhe do ato
        texto += ' ' + textoDaLinha(p);
      }
      const t = texto.replace(/\s+/g, ' ');
      const d = /(\d{2})\/(\d{2})\/(\d{4})/.exec(t);
      return {
        radio: tr.querySelector('input[type=radio]'), tr, texto: t,
        data: d ? d[3] + '-' + d[2] + '-' + d[1] : '',
        registro: (/\d[\d.]*\/\d{2}-\d/.exec(t) || [''])[0],
        protocolo: (/\b[A-Z]{3}\d{10}\b/.exec(t) || [''])[0],
        disponivel: /\bdisponivel\b/.test(norm(t)) && !/indisponivel/.test(norm(t))
      };
    });
  }
  // A regra dela: o contrato social é o ato de CONSOLIDAÇÃO, e sempre o mais recente.
  function escolherConsolidacao(linhas) {
    const cand = linhas.filter((l) => /consolida/.test(norm(l.texto)))
      .sort((a, b) => (b.data.localeCompare(a.data)) || (b.registro.localeCompare(a.registro)));
    return { escolhida: cand[0] || null, candidatas: cand };
  }

  function tipoDePagina(doc, caminho) {
    if (/\/Pre_Visualiza\.aspx/i.test(caminho)) return 'escolha';
    if (/\/Fotocopia\/EscolheDocumentos/i.test(caminho)) return 'copia';
    if (/\/VisualizaTicket/i.test(caminho)) return 'pdf';
    const t = textoDaPagina(doc);
    if (resultados(doc).length || /resultados? \d+ - \d+ de \d+ para o termo|nenhum resultado|nao foram encontrad/.test(t)) return 'resultados';
    if (campoBusca(doc)) return 'busca';
    return 'outra';
  }

  const ROTULO_LISTA = (ls) => ls.map((l) => (l.data.split('-').reverse().join('/') || '?') + (l.registro ? ' · ' + l.registro : '')).join('; ');

  // O que fazer com ESTA página, dado o pedido. Nunca clica em nada que pague: aqui só existem leitura e escolha.
  function planejar(doc, caminho, job) {
    const tipo = tipoDePagina(doc, caminho), qual = job.fila && job.fila[0], d = DOCUMENTOS[qual];
    if (!d) return { acao: 'fim', texto: 'Nada mais a buscar.' };
    if (tipo === 'pdf') return { acao: 'esperar', texto: 'Recebendo o PDF…' };
    if (!logada(doc)) return { acao: 'esperar', espera: 'login', texto: 'Entre no site com o seu certificado — eu continuo sozinho em seguida.' };
    // O captcha é a proteção do site contra robô: o Ajudante não o resolve nem o contorna, só espera ela digitar as letras.
    if (/digite o codigo da imagem/.test(textoDaPagina(doc))) return { acao: 'esperar', espera: 'captcha', texto: 'A JUCESP pediu o código da imagem. Digite as letras e clique em CONTINUAR — eu sigo sozinho depois.' };

    if (tipo === 'escolha') {
      const radio = acharRadio(doc, d.radio), ok = achar(doc, 'ok', true);
      if (!radio) return { acao: 'erro', texto: 'Não achei a opção "' + d.nome + '" nesta tela.' };
      if (!ok) return { acao: 'erro', texto: 'Não achei o botão OK nesta tela.' };
      // A ficha volta como PDF: pede-se pelo formulário (sem clique que abre aba, que o Chrome bloqueia). A cópia digitalizada só leva à lista.
      return { acao: qual === 'ficha' ? 'baixar' : 'escolher', radio, botao: ok, texto: 'Pedindo: ' + d.nome + '…' };
    }
    if (tipo === 'copia') {
      const linhas = linhasDaCopia(doc);
      if (!linhas.length) return { acao: 'erro', texto: 'A lista de documentos arquivados veio vazia.' };
      const { escolhida, candidatas } = escolherConsolidacao(linhas);
      const continuar = achar(doc, 'continuar', true);
      if (!escolhida) return { acao: 'manual', texto: 'Não achei nenhum ato de consolidação na lista (' + ROTULO_LISTA(linhas) + '). Escolha a linha certa e clique em CONTINUAR — eu pego o PDF.' };
      if (!escolhida.disponivel) return { acao: 'manual', texto: 'A cópia da consolidação de ' + escolhida.data.split('-').reverse().join('/') + ' não está disponível de graça (digitalização com tarifa). Eu não pago nada: se quiser pedir, faça você.' };
      if (!continuar) return { acao: 'erro', texto: 'Não achei o botão CONTINUAR.' };
      return { acao: 'baixar', radio: escolhida.radio, botao: continuar, linha: escolhida, texto: 'Consolidação mais recente: ' + escolhida.data.split('-').reverse().join('/') + (escolhida.registro ? ' (registro ' + escolhida.registro + ')' : '') + (candidatas.length > 1 ? ' — havia ' + candidatas.length + ', peguei a última' : '') + '.' };
    }
    if (tipo === 'resultados') {
      const rs = resultados(doc);
      if (!rs.length) return { acao: 'erro', fatal: true, texto: 'Não achei empresa com esse CNPJ na JUCESP (ela pode ser de outro estado).' };
      if (rs.length > 1) return { acao: 'manual', texto: 'Há ' + rs.length + ' empresas nesse resultado. Clique na certa — eu continuo dali.' };
      return { acao: 'clicar', el: rs[0].el, nire: rs[0].nire, empresa: rs[0].empresa, texto: 'Empresa: ' + (rs[0].empresa || rs[0].nire) + '…' };
    }
    if (tipo === 'busca') {
      const b = campoBusca(doc);
      return { acao: 'preencher', campo: b.campo, botao: b.botao, valor: job.cnpj, texto: 'Procurando o CNPJ…' };
    }
    if (job.nire && job.nire !== true && (job.feitos || []).length) return { acao: 'ir', url: '/Pre_Visualiza.aspx?nire=' + job.nire + '&idproduto=', texto: 'Voltando à empresa para o próximo documento…' };
    const link = achar(doc, 'pesquisar empresas', true) || achar(doc, 'servicos online', true);
    if (!link) return { acao: 'erro', texto: 'Não achei o menu "Pesquisar empresas".' };
    return { acao: 'clicar', el: link, texto: 'Abrindo a pesquisa de empresas…' };
  }

  // Um resumo da tela para a Shirley copiar e me mandar quando algo não bate: só a forma (textos dos botões, campos), sem cookies
  // nem o endereço completo (o "sc" do PDF é um ticket da sessão dela).
  function relatorio(doc, caminho, job, extra) {
    const lista = (sel, f) => Array.from(doc.querySelectorAll(sel)).filter(visivel).slice(0, 40).map(f);
    return JSON.stringify({
      versao: (extra && extra.versao) || '', aviso: (extra && extra.aviso) || '',   // o que a faixa dizia e qual versão da extensão está rodando
      caminho, titulo: doc.title, pagina: tipoDePagina(doc, caminho), logada: logada(doc), passo: job && job.fila && job.fila[0],
      botoes: lista('a,button,input[type=submit],input[type=button]', (e) => (textoDe(e) || '').slice(0, 60)),
      campos: lista('input:not([type=hidden]),select,textarea', (e) => [e.type, e.name, e.id].join('|')),
      radios: lista('input[type=radio]', (e) => rotuloDoRadio(e).slice(0, 80)),
      linhas: linhasDaCopia(doc).map((l) => ({ data: l.data, registro: l.registro, protocolo: l.protocolo, disponivel: l.disponivel, texto: l.texto.slice(0, 160) }))
    }, null, 1);
  }

  const api = { norm, logada, achar, campoBusca, resultados, acharRadio, linhasDaCopia, escolherConsolidacao, tipoDePagina, planejar, relatorio, DOCUMENTOS };
  raiz.AJ_JUCESP = api;

  // ── Daqui para baixo é a parte que mexe na página (só no navegador, com a extensão) ─────────────────────────
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage || typeof document === 'undefined') return;

  const faixa = { el: null, txt: null, botoes: null };
  function montarFaixa() {
    if (faixa.el) { if (!faixa.el.isConnected && document.body) document.body.appendChild(faixa.el); return; }   // a página pode refazer o corpo
    const el = document.createElement('div');
    el.id = 'aj-faixa';
    el.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:340px;max-width:calc(100vw - 32px);background:#1F2A33;color:#fff;border-radius:14px;padding:12px 14px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);border-top:4px solid #A9895A';
    el.innerHTML = '<div style="font-weight:700;margin-bottom:4px">Ajudante do painel</div><div id="aj-txt"></div><div id="aj-bt" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"></div>';
    document.body.appendChild(el);
    faixa.el = el; faixa.txt = el.querySelector('#aj-txt'); faixa.botoes = el.querySelector('#aj-bt');
  }
  function botaoDaFaixa(rotulo, f) {
    const b = document.createElement('button');
    b.textContent = rotulo; b.style.cssText = 'background:#fff;color:#1F2A33;border:0;border-radius:8px;padding:6px 10px;font:600 13px system-ui;cursor:pointer';
    b.onclick = f; faixa.botoes.appendChild(b);
  }
  function mostrar(texto, cor, extras) {
    montarFaixa(); faixa.txt.textContent = texto; faixa.el.style.borderTopColor = cor || '#A9895A'; faixa.botoes.innerHTML = '';
    (extras || []).forEach(([r, f]) => botaoDaFaixa(r, f));
  }
  const dizer = (estado, texto, fatal) => { try { chrome.runtime.sendMessage({ tipo: 'status', estado, texto, fatal: !!fatal }); } catch (_) { /* o painel mostra o que já chegou */ } };

  // Contador de tentativas por pedido, tela e ação, na própria aba: se uma ação se repete, algo não está respondendo.
  // É por PEDIDO: a mesma aba atende várias empresas, e o que foi certo na primeira não pode contar contra a quarta.
  function tentativas(pedido, chave) {
    try { const k = 'aj_' + pedido + '_' + chave, n = Number(sessionStorage.getItem(k) || 0) + 1; sessionStorage.setItem(k, String(n)); return n; } catch (_) { return 1; }
  }

  function preencher(campo, valor) {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    campo.focus(); set.call(campo, valor);
    campo.dispatchEvent(new Event('input', { bubbles: true })); campo.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // `fatal`: não há o que fazer à mão (a empresa não existe na JUCESP): o pedido termina e a fila do painel segue.
  function parar(job, texto, estado, fatal) {
    const copiar = ['Copiar relatório', () => { navigator.clipboard.writeText(relatorio(document, location.pathname, job, { versao: (chrome.runtime.getManifest && chrome.runtime.getManifest().version) || '', aviso: texto })).then(() => mostrar(texto + ' (relatório copiado — cole na conversa)', '#B3261E'), () => {}); }];
    mostrar(texto, '#B3261E', fatal ? [copiar] : [copiar, ['Fazer à mão', () => { chrome.runtime.sendMessage({ tipo: 'manual' }); mostrar('Certo — faça você. Quando o PDF abrir, eu o pego e guardo no card.', '#A9895A'); }]]);
    dizer(estado || 'erro', texto, fatal);
  }

  const paraBase64 = (buf) => { const b = new Uint8Array(buf); let t = ''; for (let i = 0; i < b.length; i += 0x8000) t += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(t); };
  const ehPdf = (buf) => buf.byteLength > 4 && String.fromCharCode.apply(null, new Uint8Array(buf.slice(0, 4))) === '%PDF';
  // A resposta da JUCESP é o PDF em si, ou uma página que manda abrir o PDF (VisualizaTicket.aspx?sc=…): nos dois casos o PDF é pego aqui,
  // uma vez só, sem abrir aba (o Chrome bloqueia a aba que um clique de programa abre).
  async function pdfDaResposta(r, fundura) {
    const buf = await r.arrayBuffer();
    if (ehPdf(buf)) return buf;
    const naoPdf = (msg) => Object.assign(new Error(msg), { naoPdf: true });
    if ((fundura || 0) >= 2) throw naoPdf('A JUCESP não devolveu o PDF.');
    const texto = new TextDecoder().decode(buf).replace(/\\u0026|&amp;/g, '&').replace(/\\\//g, '/');
    const m = /[\w./-]*VisualizaTicket\.aspx\?[^'"\s)<>\\]+/i.exec(texto);
    if (!m) throw naoPdf('A JUCESP respondeu, mas sem o PDF (' + (r.status || '?') + ').');
    return pdfDaResposta(await fetch(new URL(m[0], r.url || location.href).href, { credentials: 'same-origin' }), (fundura || 0) + 1);
  }
  async function baixarPorFormulario(radio, botao) {
    const form = botao.form || botao.closest('form');
    if (!form) throw Object.assign(new Error('Não achei o formulário da página.'), { naoPdf: true });
    radio.click(); if (!radio.checked) radio.checked = true;
    const corpo = new URLSearchParams();
    for (const [k, v] of new FormData(form, /^(submit|image)$/i.test(botao.type) ? botao : undefined).entries()) if (typeof v === 'string') corpo.append(k, v);
    if (botao.name && !corpo.has(botao.name)) corpo.append(botao.name, botao.value || '');
    const alvo = form.getAttribute('action') ? new URL(form.getAttribute('action'), location.href).href : location.href;
    const r = await fetch(alvo, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: corpo.toString() });
    if (!r.ok) throw new Error('A JUCESP respondeu ' + r.status + '.');
    return pdfDaResposta(r, 0);
  }

  // Link "javascript:__doPostBack('alvo','')" (os links da tabela de resultados): o Chrome não deixa a extensão executar URL de script. O link
  // só preenche dois campos escondidos e envia o formulário; é o que se faz aqui, sem script nenhum.
  function clicarSemScript(el) {
    const href = (el.getAttribute && el.getAttribute('href')) || '';
    if (!/^\s*javascript:/i.test(href)) return el.click();
    const m = /__doPostBack\(\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/.exec(href), form = el.closest('form') || document.forms[0];
    if (!m || !form) throw new Error('Esse link da página roda um script que o Chrome não deixa a extensão executar.');
    const campo = (nome) => form.elements[nome] || Object.assign(form.appendChild(document.createElement('input')), { type: 'hidden', name: nome });
    campo('__EVENTTARGET').value = m[1]; campo('__EVENTARGUMENT').value = m[2];
    HTMLFormElement.prototype.submit.call(form);
  }

  async function iniciar() {
    let job;
    try { job = await chrome.runtime.sendMessage({ tipo: 'quem' }); } catch (_) { return; }
    if (!job || !job.id || job.fim) return;
    mostrar('Ajudante do painel ligado…');
    let vigiaAtual = null;
    // O fundo avisa quando o PDF chegou (mesmo que tenha aberto noutra aba) e quando o pedido terminou.
    if (chrome.runtime.onMessage && chrome.runtime.onMessage.addListener) chrome.runtime.onMessage.addListener((m) => {
      if (!m) return;
      if (m.tipo === 'pdf') { clearInterval(vigiaAtual); mostrar('Recebi o PDF — guardando no card…'); }
      if (m.tipo === 'fim') {   // o erro já está na faixa, com os botões dele; só o sucesso e o cancelamento a trocam
        clearInterval(vigiaAtual);
        if (m.estado === 'ok') mostrar(m.texto, '#2F7A4F'); else if (/^Cancelado/.test(m.texto)) mostrar(m.texto, '#B3261E');
      }
    });
    let ultimo = '';
    const baixar = async (plano) => {
      try {
        const buf = await baixarPorFormulario(plano.radio, plano.botao);
        mostrar('Recebi o PDF — guardando no card…'); dizer('andando', 'Recebi o PDF — guardando no card…');
        await chrome.runtime.sendMessage({ tipo: 'pdf-bytes', base64: paraBase64(buf) });
      } catch (e) {
        if (e && e.naoPdf) return executar(Object.assign({}, plano, { acao: 'escolher', planejado: 'baixar' }));   // a resposta não era PDF: o caminho do clique de sempre
        parar(job, 'Não consegui pedir o PDF: ' + ((e && e.message) || e));
      }
    };
    // Faz o que o plano manda e, se o clique não leva a lugar nenhum, vigia a página até ela mudar (ou acusa).
    const executar = (plano) => {
      if (plano.nire) chrome.runtime.sendMessage({ tipo: 'nire', nire: plano.nire, empresa: plano.empresa });
      if (plano.acao === 'baixar') { baixar(plano); return; }
      if (plano.acao === 'preencher') { preencher(plano.campo, plano.valor); setTimeout(() => plano.botao.click(), 150); }
      else if (plano.acao === 'escolher' || plano.acao === 'copia') { plano.radio.click(); if (!plano.radio.checked) plano.radio.checked = true; plano.radio.dispatchEvent(new Event('change', { bubbles: true })); setTimeout(() => plano.botao.click(), 400); }
      else if (plano.acao === 'clicar') { try { clicarSemScript(plano.el); } catch (e) { parar(job, (e && e.message) || String(e)); return; } }
      else if (plano.acao === 'ir') location.href = new URL(plano.url, location.origin).href;
      // A página pode mudar sem recarregar (o captcha aparece no mesmo lugar): vigia o que vem depois do clique.
      let desde = Date.now();
      const vigia = vigiaAtual = setInterval(() => {
        montarFaixa();
        const p = planejar(document, location.pathname, job);
        if (p.acao === 'esperar') { desde = Date.now(); if (p.texto !== ultimo) { ultimo = p.texto; mostrar(p.texto); dizer('espera', p.texto); } return; }
        if (p.texto !== plano.texto || p.acao !== (plano.planejado || plano.acao)) { clearInterval(vigia); ultimo = ''; if (!rodar()) { const r2 = setInterval(() => { if (rodar()) clearInterval(r2); }, 1500); setTimeout(() => clearInterval(r2), 10 * 60 * 1000); } return; }
        if (Date.now() - desde > 15000) { clearInterval(vigia); parar(job, 'A página não mudou depois do meu clique.'); }
      }, 1000);
      setTimeout(() => clearInterval(vigia), 10 * 60 * 1000);
    };
    const rodar = () => {
      const plano = planejar(document, location.pathname, job);
      if (plano.acao === 'esperar') { if (plano.texto !== ultimo) { ultimo = plano.texto; mostrar(plano.texto); dizer('espera', plano.texto); } return false; }
      ultimo = '';
      if (job.manual) { mostrar('Faça você — eu pego o PDF quando abrir.'); return true; }
      if (plano.acao === 'fim') { mostrar(plano.texto); return true; }
      if (plano.acao === 'erro') { parar(job, plano.texto, 'erro', plano.fatal); return true; }
      if (plano.acao === 'manual') { chrome.runtime.sendMessage({ tipo: 'manual' }); mostrar(plano.texto, '#A9895A'); dizer('manual', plano.texto); return true; }
      if (tentativas(job.id, location.pathname + '|' + plano.acao + '|' + (job.fila || [])[0]) > 3) { parar(job, 'A página não respondeu ao que eu fiz (tentei 3 vezes).'); return true; }
      mostrar(plano.texto); dizer('andando', plano.texto);
      executar(plano);
      return true;
    };
    if (/\/Pre_Visualiza\.aspx/i.test(location.pathname)) { const n = /[?&]nire=(\d+)/i.exec(location.search); if (n) chrome.runtime.sendMessage({ tipo: 'nire', nire: n[1] }); }
    if (rodar()) return;
    const relogio = setInterval(() => { if (rodar()) clearInterval(relogio); }, 1500);
    setTimeout(() => clearInterval(relogio), 10 * 60 * 1000);
  }
  iniciar();
})(typeof globalThis !== 'undefined' ? globalThis : this);
