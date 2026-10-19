/* Pedir documentos — o que cada ato precisa, e a janela que monta o pedido.
 *
 * Duas partes no mesmo arquivo, de propósito:
 *   1. O CATÁLOGO e o compositor de texto: puros, sem DOM. Rodam no Node
 *      (testes/pedido-docs.mjs) e são as mesmas regras que a página de envio
 *      do cliente vai usar.
 *   2. A JANELA (PEDIDO.abrirJanela): desenha o montador no card.
 *
 * Regras dela (Shirley), que não devem ser mexidas sem perguntar:
 *  - Só se pede o que o caso de fato tem: no inventário e na partilha, só os
 *    documentos dos bens que ela marcar (a casa pede a matrícula, não o carro).
 *  - Casado: mesmos dados do cônjuge, assine ele a escritura ou não — e a
 *    certidão de casamento é UMA para o casal, nunca duas.
 *  - Não se escreve "atualizada": ela confere isso depois que recebe.
 *  - Pacto antenupcial: se o casal declara regime que exige pacto, pede-se o
 *    pacto e o registro dele no Registro de Imóveis do primeiro domicílio. Na
 *    escritura DE pacto não se fala em registro — só as certidões do casal.
 *  - União estável não é estado civil da lista: é documento que ela marca
 *    (escritura pública registrada no RCPN, Livro E).
 *  - Testamento ela não faz. Certidões que ela busca pela internet ficam
 *    desmarcadas por padrão.
 *  - O texto sai editável: passa pelo olho dela antes de ir.
 */
(function (raiz) {
  'use strict';

  // ── Públicos ────────────────────────────────────────────────────────────
  var PUBLICOS = {
    cliente: { rotulo: 'Cliente', dica: 'a pessoa do ato' },
    advogado: { rotulo: 'Advogado(a)', dica: 'conduz inventário ou divórcio' },
    corretor: { rotulo: 'Corretor(a)', dica: 'conduz a venda' },
    construtora: { rotulo: 'Comprador de construtora', dica: 'regulariza a unidade comprada' }
  };

  // Tipo do card → modelo de lista. Quem ela "não faz tanto" usa o do inventário.
  var MODELO_DO_TIPO = {
    'Escritura de Compra e Venda': 'compra-venda',
    'Doação': 'doacao',
    'Inventário': 'inventario',
    'Divórcio': 'divorcio',
    'União Estável': 'uniao',
    'Procuração': 'procuracao',
    'Renúncia': 'inventario',
    'Cessão de Direitos': 'inventario',
    'Pacto Antenupcial': 'pacto',
    'Ata Notarial': 'ata',
    'Dação em Pagamento': 'dacao',
    'Escritura Declaratória': 'inventario',
    'Usucapião': 'inventario'
  };
  var NOMES_DOS_MODELOS = {
    'compra-venda': 'Compra e venda', 'doacao': 'Doação', 'inventario': 'Inventário',
    'divorcio': 'Divórcio', 'uniao': 'União estável', 'procuracao': 'Procuração',
    'pacto': 'Pacto antenupcial', 'ata': 'Ata notarial', 'dacao': 'Dação em pagamento',
    'generico': 'Outro ato'
  };

  // "elaboração da Doação", "do Inventário": o artigo certo de cada ato.
  var ARTIGO = { 'Inventário': 'do', 'Divórcio': 'do', 'Pacto Antenupcial': 'do', 'Testamento': 'do' };
  function doDa(tipo) { return (ARTIGO[tipo] || 'da') + ' ' + tipo; }
  function aDo(tipo) { return (ARTIGO[tipo] === 'do' ? 'o ' : 'a ') + tipo; }

  var REGIMES_COM_PACTO = 'comunhão universal, separação convencional ou participação final nos aquestos';

  var BENS = {
    urbano: { rotulo: 'Imóvel urbano', itens: ['Matrícula do imóvel urbano'] },
    rural: { rotulo: 'Imóvel rural', itens: ['Matrícula do imóvel rural', 'Declaração do ITR dos últimos cinco anos', 'CCIR expedido pelo INCRA'] },
    veiculo: { rotulo: 'Veículo', itens: ['Documento do veículo'] },
    conta: { rotulo: 'Conta bancária', itens: ['Extrato bancário na data do óbito'] },
    empresa: { rotulo: 'Empresa / cotas', itens: ['Contrato social'] },
    joias: { rotulo: 'Joias e outros bens', itens: ['Notas fiscais dos bens e joias'] }
  };
  var CLAUSULAS = {
    usufruto: 'Reserva de usufruto',
    incomunicabilidade: 'Incomunicabilidade',
    impenhorabilidade: 'Impenhorabilidade',
    reversao: 'Cláusula de reversão'
  };

  function modeloDoTipo(tipo) { return MODELO_DO_TIPO[tipo] || 'generico'; }

  // ── Itens ───────────────────────────────────────────────────────────────
  function item(id, texto, padrao) { return { id: id, texto: texto, padrao: padrao !== false }; }

  // Os dados que toda pessoa informa, numa linha só: é o que se repetia em
  // todo ato. A certidão de estado civil já cobre solteiro (nascimento) e
  // casado/divorciado (casamento) — quem decide qual é a página de envio.
  var BASICO = 'RG, CPF, certidão de estado civil, endereço e profissão';
  var CONJUGE = ' (se casado(a), também do cônjuge)';
  // quem: "Vendedor e comprador", "Herdeiros"… opcoes.conjuge: acrescenta a regra do cônjuge.
  function pessoa(id, quem, opcoes) {
    var o = opcoes || {};
    return item(id, (quem ? quem + ': ' : '') + BASICO + (o.conjuge === false ? '' : CONJUGE));
  }
  function pessoaSimples(id, quem) { // o que ela pede do procurador e do requerente
    return item(id, quem + ': RG, CPF, endereço e profissão');
  }
  function bens(estado, prefixo) {
    var v = [];
    var marc = estado.bens || {};
    Object.keys(BENS).forEach(function (k) {
      if (!marc[k]) return;
      BENS[k].itens.forEach(function (t, i) { v.push(item(prefixo + k + '.' + i, t)); });
    });
    if (marc.outros) v.push(item(prefixo + 'outros', 'Documentos dos demais bens'));
    return v;
  }
  function secao(id, titulo, itens, extra) {
    var s = { id: id, titulo: titulo, itens: itens };
    if (extra) for (var k in extra) s[k] = extra[k];
    return s;
  }

  // ── O que cada modelo pede ─────────────────────────────────────────────
  // Devolve as seções (só para agrupar na tela), já considerando o público e
  // as opções marcadas. No texto, cada item é uma linha e diz de quem fala.
  function montar(estado) {
    var modelo = modeloDoTipo(estado.tipo);
    var pub = estado.publico || 'cliente';
    var S = [];
    var adv = function (i) { i.padrao = pub === 'advogado'; return i; };

    // Quem entra pela construtora só informa os próprios dados: a construtora
    // e o vendedor ela já identifica pela matrícula.
    if (pub === 'construtora') {
      S.push(secao('voce', '', [pessoa('voce', 'Seus dados')]));
    } else if (modelo === 'compra-venda') {
      if (pub === 'corretor') {
        S.push(secao('lista', '', [
          pessoa('partes', 'Vendedor e comprador'),
          item('imovel.mat', 'Matrícula do imóvel'),
          item('imovel.contrato', 'Contrato, se houver', false)
        ]));
      } else {
        S.push(secao('lista', '', [
          pessoa('partes', 'Vendedor e comprador'),
          item('partes.banco', 'Dados bancários de ambos'),
          item('comprador.valor', 'Valor da transação (comprador)'),
          item('imovel.mat', 'Matrícula do imóvel')
        ]));
      }
    } else if (modelo === 'doacao') {
      S.push(secao('lista', '', [pessoa('partes', 'Doador e donatário'), item('imovel.mat', 'Matrícula do imóvel')]));
      S.push(secao('clausulas', 'Cláusulas', Object.keys(CLAUSULAS).map(function (k) { return item('clausula.' + k, CLAUSULAS[k], false); }), { tipo: 'clausulas' }));
    } else if (modelo === 'inventario') {
      S.push(secao('lista', '', [
        item('falecido', 'Falecido(a) e cônjuge: RG, CPF, certidão de óbito e de casamento; pacto antenupcial, se houver'),
        item('falecido.testamento', 'Certidão de inexistência de testamento (você costuma buscar)', false),
        pessoa('herdeiros', 'Herdeiros'),
        adv(item('advogado', 'Advogado(a): OAB, estado civil e endereço'))
      ]));
      S.push(secao('bens', 'Bens', bens(estado, 'bem.'), { vazio: 'Marque acima o que será inventariado.' }));
    } else if (modelo === 'divorcio') {
      S.push(secao('lista', '', [
        pessoa('divorciandos', 'Divorciandos', { conjuge: false }) ,
        adv(item('advogado', 'Advogado(a): OAB, estado civil e endereço')),
        item('familia.filhos', 'Se tiverem filhos: RG, CPF, estado civil, endereço e profissão de cada um, e a pensão estipulada (valor)'),
        item('familia.nome', 'Algum dos dois voltará a usar o nome de solteiro(a)? Qual?')
      ]));
      if (estado.partilha) S.push(secao('bens', 'Bens a partilhar', bens(estado, 'bem.'), { vazio: 'Marque acima o que será partilhado.' }));
    } else if (modelo === 'uniao') {
      S.push(secao('lista', '', [
        pessoa('conviventes', 'Conviventes', { conjuge: false }),
        item('convivente.dados', 'Data de início da união, primeiro endereço do casal e regime de bens')
      ]));
    } else if (modelo === 'pacto') {
      S.push(secao('lista', '', [
        pessoa('noivos', 'Futuros cônjuges', { conjuge: false }),
        item('noivo.dados', 'Primeiro endereço do casal, regime de bens e se mudarão de nome (qual)')
      ]));
    } else if (modelo === 'procuracao') {
      var l = [pessoa('outorgante', 'Outorgante'), pessoaSimples('procurador', 'Procurador')];
      if (estado.poderes && estado.poderes.imovel) l.push(item('poder.imovel', 'Matrícula do imóvel'));
      if (estado.poderes && estado.poderes.veiculo) l.push(item('poder.veiculo', 'Documento do veículo'));
      S.push(secao('lista', '', l));
    } else if (modelo === 'ata') {
      S.push(secao('lista', '', [pessoaSimples('requerente', 'Requerente'), item('material.arquivos', 'Material a registrar (fotos, prints, links)')]));
    } else if (modelo === 'dacao') {
      S.push(secao('lista', '', [
        pessoa('partes', 'Devedor e credor'),
        item('bem.mat', 'Matrícula do imóvel'),
        item('bem.divida', 'Contrato ou histórico da dívida e valor')
      ]));
    } else {
      S.push(secao('lista', '', [pessoa('partes', 'Partes')]));
    }

    // Opcionais que ela marca para o caso.
    var opc = [];
    if (estado.uniaoEstavel) opc.push(item('opc.uniao', 'Escritura pública de união estável, registrada no RCPN (Livro E) da última residência do casal'));
    if (estado.pacto && modelo !== 'pacto') {
      opc.push(item('opc.pacto', 'Escritura do pacto antenupcial e certidão do seu registro no Registro de Imóveis do primeiro domicílio do casal'));
    }
    var extras = (estado.extras || []).map(function (t, i) { return item('extra.' + i, t); });
    if (opc.length || extras.length) S.push(secao('mais', 'Além disso', opc.concat(extras)));
    return S;
  }

  // O texto
  function ehMarcado(estado, it) {
    var m = estado.marc || {};
    return m.hasOwnProperty(it.id) ? !!m[it.id] : it.padrao;
  }

  function comporTexto(estado) {
    var pub = estado.publico || 'cliente';
    var ato = estado.tipo || NOMES_DOS_MODELOS[modeloDoTipo(estado.tipo)];
    var modelo = modeloDoTipo(estado.tipo);
    var L = [];
    var abertura = {
      cliente: 'Olá! Para ' + aDo(ato) + ', preciso de:',
      advogado: 'Prezado(a) Dr(a)., para ' + aDo(ato) + ', precisamos de:',
      corretor: 'Olá! Para ' + aDo(ato) + ', preciso de:',
      construtora: 'Olá! Para regularizar a sua compra, preciso de:'
    }[pub];
    L.push(abertura);

    var linhas = [];
    montar(estado).forEach(function (s) {
      if (s.tipo === 'clausulas') {
        var marc = s.itens.filter(function (i) { return ehMarcado(estado, i); });
        if (estado.clausulasModo === 'cliente') linhas.push('• Informe se deseja: ' + s.itens.map(function (i) { return i.texto.toLowerCase(); }).join(', '));
        else if (marc.length) linhas.push('• Cláusulas previstas: ' + marc.map(function (i) { return i.texto.toLowerCase(); }).join(', '));
        return;
      }
      s.itens.filter(function (i) { return ehMarcado(estado, i); }).forEach(function (i) { linhas.push('• ' + i.texto); });
    });
    L = L.concat(linhas, ['']);

    if (estado.link) L.push('Se preferir, envie tudo por este link: ' + estado.link, '');
    else L.push('Pode enviar as fotos ou os PDFs por aqui. Agradecemos!', '');
    L.push('20º Tabelião de Notas');
    return L.join('\n');
  }

  function assunto(estado) {
    return 'Documentos para ' + (estado.tipo || NOMES_DOS_MODELOS[modeloDoTipo(estado.tipo)]);
  }

  var PEDIDO = {
    PUBLICOS: PUBLICOS, BENS: BENS, CLAUSULAS: CLAUSULAS, REGIMES_COM_PACTO: REGIMES_COM_PACTO,
    modeloDoTipo: modeloDoTipo, montar: montar, comporTexto: comporTexto, assunto: assunto, ehMarcado: ehMarcado,
    NOMES_DOS_MODELOS: NOMES_DOS_MODELOS, MODELO_DO_TIPO: MODELO_DO_TIPO
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = PEDIDO; }
  raiz.PEDIDO = PEDIDO;
  if (typeof document === 'undefined') return;

  // ── A janela ────────────────────────────────────────────────────────────
  var CSS = '' +
    '.ped{font-family:inherit;color:var(--cc-tinta,#1F2A33)}' +
    '.ped-layout{display:grid;gap:16px;grid-template-columns:1fr}' +
    '@media(min-width:900px){.ped-layout{grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start}.ped-dir{position:sticky;top:8px}}' +
    '.ped-bloco{background:var(--cc-sup-2,#FAF8F4);border:.5px solid var(--cc-linha,#E6E0D5);border-radius:14px;padding:12px 14px;margin-bottom:12px}' +
    '.ped-tit{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;margin-bottom:8px}' +
    '.ped-tit small{font-weight:400;color:var(--cc-tinta-3,#6B7680);font-size:11.5px}' +
    '.ped-chips{display:flex;flex-wrap:wrap;gap:6px}' +
    '.ped-chip{font:inherit;font-size:12.5px;padding:8px 12px;border-radius:999px;border:1px solid var(--cc-linha-forte,#D8D0C1);background:var(--cc-sup,#fff);color:var(--cc-tinta-2,#5B6B78);cursor:pointer;min-height:36px}' +
    '.ped-chip.on{background:var(--cc-tinta,#1F2A33);color:#fff;border-color:var(--cc-tinta,#1F2A33)}' +
    '.ped select,.ped input[type=text],.ped input[type=email],.ped textarea{font:inherit;font-size:13px;width:100%;padding:9px 11px;border-radius:10px;border:1px solid var(--cc-linha-forte,#D8D0C1);background:#fff;color:var(--cc-tinta,#1F2A33)}' +
    '.ped textarea{box-sizing:border-box;min-height:200px;line-height:1.5;resize:vertical;overflow:hidden}' +
    '.ped-lin{display:flex;gap:9px;align-items:flex-start;padding:7px 2px;font-size:13px;line-height:1.4;cursor:pointer}' +
    '.ped-lin input{margin-top:2px;width:18px;height:18px;flex:none;accent-color:var(--cc-tinta,#1F2A33)}' +
    '.ped-lin.off{color:var(--cc-tinta-3,#6B7680)}' +
    '.ped-vazio{font-size:12px;color:var(--cc-tinta-3,#6B7680);padding:4px 2px}' +
    '.ped-grade{display:flex;flex-wrap:wrap;gap:0 16px}' +
    '.ped-acoes{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}' +
    '.ped-btn{font:inherit;font-size:13px;font-weight:600;padding:10px 14px;border-radius:10px;border:1px solid var(--cc-linha-forte,#D8D0C1);background:#fff;color:var(--cc-tinta,#1F2A33);cursor:pointer;min-height:42px}' +
    '.ped-btn.forte{background:var(--cc-tinta,#1F2A33);color:#fff;border-color:var(--cc-tinta,#1F2A33)}' +
    '.ped-nota{font-size:12px;color:var(--cc-tinta-3,#6B7680);margin-top:8px;line-height:1.45}' +
    '.ped-ok{color:var(--cc-ok,#2F7A4F)}' +
    '.ped-linha-add{display:flex;gap:8px}' +
    '.ped-sub{font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--cc-tinta-3,#6B7680);margin:10px 0 2px}' +
    '.ped-sub small{text-transform:none;letter-spacing:0;font-weight:400}' +
    '.ped-mais{background:var(--cc-sup-2,#FAF8F4);border:.5px solid var(--cc-linha,#E6E0D5);border-radius:14px;padding:10px 14px;margin-bottom:12px}' +
    '.ped-mais summary{font-size:13px;font-weight:600;cursor:pointer;color:var(--cc-tinta-2,#5B6B78)}';

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function injetarCss() {
    if (document.getElementById('ped-css')) return;
    var s = document.createElement('style'); s.id = 'ped-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  // alvo: elemento onde desenhar. ctx: { casoNome, tipo, tipos (lista do painel), email }
  PEDIDO.abrirJanela = function (alvo, ctx) {
    injetarCss();
    var est = {
      tipo: ctx.tipo || '', publico: 'cliente', bens: {}, poderes: {}, partilha: false,
      pacto: false, uniaoEstavel: false, clausulasModo: 'marcar', extras: [], marc: {},
      msg: '', msgEditada: false, para: ctx.email || '', aviso: ''
    };
    var tipos = ctx.tipos || Object.keys(MODELO_DO_TIPO);

    function refazTexto() { if (!est.msgEditada) est.msg = comporTexto(est); }

    function check(rotulo, ligado, acao) {
      return '<label class="ped-lin' + (ligado ? '' : ' off') + '"><input type="checkbox"' + (ligado ? ' checked' : '') + ' data-acao="' + acao + '"><span>' + esc(rotulo) + '</span></label>';
    }

    function desenhar() {
      refazTexto();
      var modelo = modeloDoTipo(est.tipo);
      var ehInv = modelo === 'inventario', ehDiv = modelo === 'divorcio';
      var envolve = '';
      if (est.publico !== 'construtora') {
        if (ehDiv) envolve += check('Com partilha de bens', est.partilha, 'partilha');
        if (ehInv || (ehDiv && est.partilha)) {
          envolve += '<div class="ped-sub">' + (ehDiv ? 'O que será partilhado' : 'O que será inventariado') + ' <small>só pedimos o que marcar</small></div><div class="ped-grade">' +
            Object.keys(BENS).map(function (k) { return check(BENS[k].rotulo, !!est.bens[k], 'bem:' + k); }).join('') +
            check('Outros bens', !!est.bens.outros, 'bem:outros') + '</div>';
        }
        if (modelo === 'procuracao') envolve += '<div class="ped-sub">Os poderes envolvem</div><div class="ped-grade">' +
          check('Imóvel', !!est.poderes.imovel, 'poder:imovel') + check('Veículo', !!est.poderes.veiculo, 'poder:veiculo') + '</div>';
        if (modelo === 'doacao') envolve += '<div class="ped-sub">Cláusulas: quem escolhe?</div><div class="ped-chips">' +
          '<button class="ped-chip' + (est.clausulasModo === 'marcar' ? ' on' : '') + '" data-acao="modo:marcar">Eu marco</button>' +
          '<button class="ped-chip' + (est.clausulasModo === 'cliente' ? ' on' : '') + '" data-acao="modo:cliente">A pessoa escolhe</button></div>';
      }

      var lista = montar(est).map(function (s) {
        if (!s.itens.length && !s.vazio) return '';
        var linhas = s.itens.map(function (i) { return check(i.texto, ehMarcado(est, i), 'item:' + i.id); }).join('');
        return (s.titulo ? '<div class="ped-sub">' + esc(s.titulo) + '</div>' : '') + (linhas || '<div class="ped-vazio">' + esc(s.vazio || '') + '</div>');
      }).join('');

      var mais = est.publico === 'construtora' ? '' :
        '<details class="ped-mais"' + ((est.pacto || est.uniaoEstavel || est.extras.length) ? ' open' : '') + '><summary>Mais opções</summary>' +
        (modelo !== 'pacto' ? check('Casal com pacto antenupcial (regime: ' + REGIMES_COM_PACTO + ')', est.pacto, 'pacto') : '') +
        check('Escritura pública de união estável (RCPN, Livro E)', est.uniaoEstavel, 'uniao') +
        '<div class="ped-linha-add" style="margin-top:8px"><input type="text" id="ped-extra" placeholder="Acrescentar um item só para este pedido"><button class="ped-btn" data-acao="extra">Acrescentar</button></div></details>';

      alvo.innerHTML = '<div class="ped"><div class="ped-layout"><div class="ped-esq">' +
        '<div class="ped-bloco"><div class="ped-chips">' +
        Object.keys(PUBLICOS).map(function (k) { return '<button class="ped-chip' + (est.publico === k ? ' on' : '') + '" data-acao="pub:' + k + '">' + esc(PUBLICOS[k].rotulo) + '</button>'; }).join('') +
        '</div><select data-acao="tipo" style="margin-top:10px">' +
        tipos.map(function (t) { return '<option' + (t === est.tipo ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>' +
        (envolve ? '<div style="margin-top:6px">' + envolve + '</div>' : '') + '</div>' +
        '<div class="ped-bloco"><div class="ped-tit">O que pedir</div>' + lista + '</div>' + mais +
        '</div><div class="ped-dir"><div class="ped-bloco"><div class="ped-tit">A mensagem<small>pode editar antes de enviar</small></div>' +
        '<textarea id="ped-msg">' + esc(est.msg) + '</textarea>' +
        (est.msgEditada ? '<div class="ped-nota">Você editou o texto, então ele não muda mais sozinho. <button class="ped-btn" data-acao="refazer" style="min-height:32px;padding:4px 10px">Refazer pela lista</button></div>' : '') +
        '<input type="email" id="ped-para" value="' + esc(est.para) + '" placeholder="E-mail da pessoa (opcional)" style="margin-top:10px">' +
        '<div class="ped-acoes"><button class="ped-btn forte" data-acao="copiar">Copiar texto</button><button class="ped-btn" data-acao="email">Abrir no e-mail</button><button class="ped-btn" data-acao="zap">WhatsApp</button></div>' +
        '<div class="ped-nota' + (est.aviso ? ' ped-ok' : '') + '" id="ped-aviso">' + esc(est.aviso || 'Nada sai daqui sem você enviar.') + '</div></div></div></div></div>';
      ajustaAltura();
    }

    // A mensagem aparece inteira: ela confere antes de enviar.
    function ajustaAltura() {
      var t = alvo.querySelector('#ped-msg'); if (!t) return;
      t.style.height = 'auto'; t.style.height = (t.scrollHeight + 8) + 'px';
    }
    // A fonte do painel carrega depois do primeiro desenho e muda a quebra de linha.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ajustaAltura(); });
    function copiar(texto) {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(texto);
      return new Promise(function (ok, erro) {
        var t = document.createElement('textarea'); t.value = texto; document.body.appendChild(t); t.select();
        try { document.execCommand('copy') ? ok() : erro(); } catch (e) { erro(e); } t.remove();
      });
    }
    function aviso(t) { est.aviso = t; var a = alvo.querySelector('#ped-aviso'); if (a) { a.textContent = t; a.className = 'ped-nota ped-ok'; } }

    // Reabrir a janela no mesmo lugar não pode empilhar ouvintes.
    if (alvo._pedParar) alvo._pedParar();
    function aoDigitar(e) {
      if (e.target.id === 'ped-msg') { est.msg = e.target.value; est.msgEditada = true; ajustaAltura(); }
      if (e.target.id === 'ped-para') est.para = e.target.value;
    }
    function aoMudar(e) {
      var a = e.target.getAttribute('data-acao'); if (!a) return;
      if (a === 'tipo') { est.tipo = e.target.value; est.msgEditada = false; est.marc = {}; desenhar(); return; }
      var ligado = e.target.checked, p = a.split(':');
      if (p[0] === 'item') est.marc[p[1]] = ligado;
      else if (p[0] === 'bem') est.bens[p[1]] = ligado;
      else if (p[0] === 'poder') est.poderes[p[1]] = ligado;
      else if (a === 'partilha') est.partilha = ligado;
      else if (a === 'pacto') est.pacto = ligado;
      else if (a === 'uniao') est.uniaoEstavel = ligado;
      desenhar();
    }
    function aoClicar(e) {
      var b = e.target.closest('[data-acao]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
      var a = b.getAttribute('data-acao'), p = a.split(':');
      if (p[0] === 'pub') { est.publico = p[1]; est.msgEditada = false; desenhar(); }
      else if (p[0] === 'modo') { est.clausulasModo = p[1]; desenhar(); }
      else if (a === 'extra') {
        var c = alvo.querySelector('#ped-extra'); var t = (c.value || '').trim();
        if (t) { est.extras.push(t); desenhar(); }
      } else if (a === 'refazer') { est.msgEditada = false; desenhar(); }
      else if (a === 'copiar') copiar(est.msg).then(function () { aviso('Texto copiado. É só colar.'); }, function () { aviso('Não consegui copiar — selecione o texto e copie.'); });
      else if (a === 'zap') window.open('https://wa.me/?text=' + encodeURIComponent(est.msg), '_blank', 'noopener');
      else if (a === 'email') {
        var corpo = encodeURIComponent(est.msg);
        var base = 'mailto:' + encodeURIComponent(est.para || '') + '?subject=' + encodeURIComponent(assunto(est));
        if (corpo.length > 1800) {
          // Alguns programas de e-mail cortam o texto longo: copia e deixa colar.
          copiar(est.msg).then(function () { aviso('Texto longo: copiei para você colar no e-mail que vai abrir.'); });
          window.location.href = base;
        } else window.location.href = base + '&body=' + corpo;
      }
    }
    alvo.addEventListener('input', aoDigitar);
    alvo.addEventListener('change', aoMudar);
    alvo.addEventListener('click', aoClicar);
    alvo._pedParar = function () {
      alvo.removeEventListener('input', aoDigitar); alvo.removeEventListener('change', aoMudar); alvo.removeEventListener('click', aoClicar);
    };
    desenhar();
    return { estado: est, desenhar: desenhar };
  };
})(typeof window !== 'undefined' ? window : globalThis);
