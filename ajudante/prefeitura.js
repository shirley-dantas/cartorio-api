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

  // ── A certidão tributária de IPTU (a negativa): duc.prefeitura.sp.gov.br — Emissão de Certidão Conjunta de Tributos Municipais ──
  // A tela tem CAPTCHA ("Código da imagem"), e esse é dela: o Ajudante escolhe o tipo, preenche o SQL e deixa o cursor no campo do código. Ela digita as letras e
  // clica em Emitir; a prefeitura gera o PDF na hora e avisa "Emissão da certidão concluída!". Nunca se clica em "Ouvir Som" nem em "Gerar Novo Código".
  const CERTIDAO_IPTU = 'tributaria de iptu';
  // O campo que vem depois de um rótulo ("Informe o número do SQL:", "Código da imagem:"): pelo `for` do rótulo ou pelo primeiro campo de texto adiante dele.
  function campoApos(doc, rotulo) {
    const r = norm(rotulo);
    const limpo = (el) => norm(el.textContent).replace(/^[*\s]+/, '');   // o asterisco dos campos obrigatórios ("* Cadastro do Imóvel:") não conta
    const cand = Array.from(doc.querySelectorAll('label,span,td,div,b,strong,p')).filter((el) => visivel(el) && limpo(el).startsWith(r) && limpo(el).length < r.length + 12)
      .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
    const el = cand[0]; if (!el) return null;
    if (el.control) return el.control;
    const todos = Array.from(doc.querySelectorAll('input')).filter((i) => visivel(i) && (!i.type || /^(text|tel|number)$/i.test(i.type)));
    return todos.find((i) => el.compareDocumentPosition(i) & 4) || null;
  }
  function planejarDuc(doc, job, estado) {
    const preenchido = !!(estado && estado.preenchido);
    const texto = norm((doc.body && (doc.body.innerText || doc.body.textContent)) || '');
    if (/emissao da certidao concluida/.test(texto)) return { acao: 'emitida' };
    const sel = Array.from(doc.querySelectorAll('select')).filter(visivel).find((x) => Array.from(x.options).some((o) => norm(o.textContent).includes(CERTIDAO_IPTU)));
    const sql = campoApos(doc, 'informe o numero do sql'), captcha = campoApos(doc, 'codigo da imagem');
    const emitir = Array.from(doc.querySelectorAll('input[type=submit],input[type=button],button,a')).filter(visivel).find((b) => norm(b.value || b.innerText || b.textContent) === 'emitir');
    if (!sql || !captcha || !emitir) return { acao: 'nao-reconheco', texto: 'Não reconheço esta tela da prefeitura (faltam o campo do SQL, o do código da imagem ou o botão Emitir).' };
    if (!sel) return { acao: 'erro', texto: 'Não achei a opção “Certidão Tributária de IPTU” na lista de tipos desta tela da prefeitura. Não escolhi outra.' };
    if (preenchido) return { acao: 'esperar-captcha', captcha };
    const opcao = Array.from(sel.options).find((o) => norm(o.textContent).includes(CERTIDAO_IPTU));
    return { acao: 'preencher', select: sel, opcao, jaEstaNela: sel.value === opcao.value, sql, captcha, sqlFormatado: formatarSql(job && job.sql) };
  }

  // ── A certidão de dados cadastrais do imóvel — IPTU: notcertiptu.prefeitura.sp.gov.br/PaginasRestritas/frm003_Gerar_Cert_Dados_Cad.aspx ──
  // Só se entra pelo e-gov (o login é dela, o Ajudante nunca toca nele). Na tela: Cadastro do Imóvel + Exercício (AAAA) → Consultar → um aviso pede o CPF/CNPJ do
  // proprietário (ou do compromissário) → OK → o PDF sai na hora. Sem captcha e sem pagamento. O documento do proprietário vem do pedido (ela confere no painel).
  const formatarDoc = (d) => { const x = digitos(d); return x.length === 11 ? x.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : x.length === 14 ? x.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : x; };
  function planejarCad(doc, job, estado) {
    const e = estado || {}, texto = norm((doc.body && (doc.body.innerText || doc.body.textContent)) || '');
    const botao = (rot) => Array.from(doc.querySelectorAll('input[type=submit],input[type=button],button,a')).filter(visivel).find((b) => norm(b.value || b.innerText || b.textContent) === rot) || null;
    // O aviso que pede o CPF/CNPJ: campo "Proprietário" (e "Compromissário", que fica vazio) e o botão Ok.
    if (/favor informar o cpf\/cnpj do proprietario/.test(texto)) {
      const prop = campoApos(doc, 'proprietario'), ok = botao('ok');
      if (!prop || !ok) return { acao: 'nao-reconheco', texto: 'Não reconheço o aviso do CPF/CNPJ do proprietário (faltam o campo ou o botão Ok).' };
      return e.modal ? { acao: 'esperar' } : { acao: 'modal', proprietario: prop, ok, documento: formatarDoc(job && job.documento) };
    }
    const cadastro = campoApos(doc, 'cadastro do imovel'), exercicio = campoApos(doc, 'exercicio'), consultar = botao('consultar');
    if (cadastro && exercicio && consultar) {
      if (e.preenchido) return { acao: 'esperar' };
      return { acao: 'preencher', cadastro, exercicio, consultar, sqlFormatado: formatarSql(job && job.sql), ano: String((job && job.exercicio) || '') };
    }
    return { acao: 'aguardar-login' };   // qualquer outra tela é a do e-gov (ou o caminho até ela): ela entra, o Ajudante espera
  }

  const api = { planejarCad, formatarDoc, planejarDuc, campoApos, planejar, campos, botaoPesquisar, mensagem, resposta, partesDoSql, formatarSql, ehData, norm };
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

  async function iniciarDuc(job) {
    const chaveDuc = 'ajduc_' + job.id;
    const lido = (k) => { try { return sessionStorage.getItem(k); } catch (_) { return null; } };
    const grava = (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) { /* sem sessionStorage */ } };
    // O clique em Emitir é dela (isTrusted): só se registra para o relatório.
    document.addEventListener('click', (e) => { if (e.isTrusted && e.target && /emitir/i.test(String(e.target.value || e.target.textContent || ''))) mandar({ tipo: 'pref-pagina', texto: 'Emitindo a certidão…', registro: 'clique dela em Emitir' }); }, true);
    let avisouEmitida = false, avisouCaptcha = false, preenchendo = false;
    const tick = () => {
      const p = planejarDuc(document, job, { preenchido: lido(chaveDuc) === '1' });
      if (p.acao === 'emitida') {
        if (!avisouEmitida) { avisouEmitida = true; mostrar('Emissão concluída — guardando o PDF no card…'); mandar({ tipo: 'pref-emitida' }); }
        mandar({ tipo: 'pref-vigia' }); return false;
      }
      if (p.acao === 'erro' || p.acao === 'nao-reconheco') { mostrar(p.texto, '#B3261E'); mandar({ tipo: 'pref-erro', texto: p.texto + (p.acao === 'nao-reconheco' ? ' Faça à mão e arraste o PDF para a caixa do card.' : '') }); return true; }
      if (p.acao === 'preencher' && !preenchendo) {
        preenchendo = true;
        if (!p.jaEstaNela) { p.select.value = p.opcao.value; p.select.dispatchEvent(new Event('change', { bubbles: true })); }
        preencher(p.sql, p.sqlFormatado); grava(chaveDuc, '1');
        p.captcha.focus();
        mostrar('Preenchi o tipo e o contribuinte ' + p.sqlFormatado + '. Digite as letras da imagem e clique em Emitir — o resto é comigo.');
        mandar({ tipo: 'pref-pagina', estado: 'espera', texto: 'Na aba da prefeitura: digite as letras da imagem e clique em Emitir.' });
      }
      if (p.acao === 'esperar-captcha' && !avisouCaptcha) { avisouCaptcha = true; mostrar('Digite as letras da imagem e clique em Emitir — o resto é comigo.'); p.captcha.focus(); }
      mandar({ tipo: 'pref-vigia' });
      return false;
    };
    mostrar('Ajudante ligado…');
    const relogio = setInterval(() => { if (tick()) clearInterval(relogio); }, 1500);
    setTimeout(() => clearInterval(relogio), 15 * 60 * 1000);
  }

  async function iniciarCad(job) {
    const chaveCad = 'ajcad_' + job.id;
    const lido = () => { try { return sessionStorage.getItem(chaveCad) || ''; } catch (_) { return ''; } };
    const grava = (v) => { try { sessionStorage.setItem(chaveCad, v); } catch (_) { /* sem sessionStorage */ } };
    let avisouLogin = false, preencheu = 0, modalEm = 0, avisouMao = false;
    const tick = () => {
      const est = lido(), p = planejarCad(document, job, { preenchido: est.includes('p'), modal: est.includes('m') });
      if (p.acao === 'aguardar-login') {
        if (!avisouLogin) { avisouLogin = true; mostrar('Entre pelo e-gov. Quando abrir a tela da certidão de dados cadastrais, eu continuo sozinho.'); mandar({ tipo: 'pref-pagina', estado: 'espera', texto: 'Entre pelo e-gov na aba da prefeitura — o Ajudante continua quando abrir a certidão.' }); }
        return false;
      }
      if (p.acao === 'nao-reconheco') { mostrar(p.texto, '#B3261E'); mandar({ tipo: 'pref-erro', texto: p.texto + ' Faça à mão e arraste o PDF para a caixa do card.' }); return true; }
      if (p.acao === 'preencher' && !preencheu) {
        preencheu = Date.now(); avisouLogin = true;
        mostrar('Preenchendo o cadastro ' + p.sqlFormatado + ' e o exercício ' + p.ano + '…');
        preencher(p.cadastro, p.sqlFormatado); preencher(p.exercicio, p.ano); grava(est + 'p');
        mandar({ tipo: 'pref-pagina', texto: 'Consultando o imóvel ' + p.sqlFormatado + ' na prefeitura…' });
        p.consultar.click(); return false;
      }
      if (p.acao === 'modal' && !modalEm) {
        modalEm = Date.now();
        mostrar('Informando o CPF/CNPJ do proprietário…');
        preencher(p.proprietario, p.documento); grava(est.replace('m', '') + 'm');
        mandar({ tipo: 'pref-emitida' });   // a partir do OK o PDF é gerado: o fundo passa a esperar o arquivo
        p.ok.click(); return false;
      }
      if (p.acao === 'esperar') {
        // Clicou e a página não respondeu: pede o clique dela, sem insistir.
        const desde = modalEm || preencheu;
        if (desde && Date.now() - desde > 12000 && !avisouMao) { avisouMao = true; mostrar('A página não respondeu ao meu clique. Clique você em ' + (modalEm ? 'Ok' : 'Consultar') + ' — eu pego o PDF.', '#B3261E'); mandar({ tipo: 'pref-pagina', estado: 'espera', texto: 'Clique em ' + (modalEm ? 'Ok' : 'Consultar') + ' na aba da prefeitura — o Ajudante pega o PDF.' }); }
        if (modalEm) mandar({ tipo: 'pref-vigia' });
      }
      return false;
    };
    mostrar('Ajudante ligado…');
    const relogio = setInterval(() => { if (tick()) clearInterval(relogio); }, 1500);
    setTimeout(() => clearInterval(relogio), 15 * 60 * 1000);
  }

  async function iniciar() {
    let job;
    try { job = await chrome.runtime.sendMessage({ tipo: 'quem' }); } catch (_) { return; }
    if (!job || !job.id || job.fim || job.site !== 'pref') return;
    if (job.servico === 'dados-cadastrais') return iniciarCad(job);
    if (job.servico === 'negativa-iptu') return iniciarDuc(job);   // quem decide é o pedido: este script só roda nos dois sites da prefeitura
    if (job.servico !== 'valor-venal') return;
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
