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

  // Os dados que toda pessoa de um ato informa. opcoes.conjuge: pede os dados do
  // cônjuge se for casada. opcoes.cert: pede a certidão de estado civil.
  function pessoa(p, opcoes) {
    var o = opcoes || {};
    var v = [
      item(p + '.rg', 'RG e CPF'),
      item(p + '.prof', 'Profissão'),
      item(p + '.end', 'Endereço completo, com CEP'),
      item(p + '.ec', 'Estado civil')
    ];
    if (o.cert !== false) v.push(item(p + '.cert', 'Certidão de nascimento (se solteiro(a)) ou de casamento (se casado(a), separado(a), divorciado(a) ou viúvo(a))'));
    if (o.conjuge !== false) v.push(item(p + '.conj', 'Se for casado(a): os mesmos dados do cônjuge (RG, CPF, profissão e endereço), assine ele(a) ou não. A certidão de casamento é uma só, do casal'));
    return v;
  }
  function pessoaSimples(p) { // sem certidão nem cônjuge: o que ela pede do procurador, do requerente
    return [item(p + '.rg', 'RG e CPF'), item(p + '.prof', 'Profissão'), item(p + '.end', 'Endereço completo, com CEP')];
  }
  function bens(estado, prefixo) {
    var v = [];
    var marc = estado.bens || {};
    Object.keys(BENS).forEach(function (k) {
      if (!marc[k]) return;
      BENS[k].itens.forEach(function (t, i) { v.push(item(prefixo + k + '.' + i, t)); });
    });
    if (marc.outros) v.push(item(prefixo + 'outros', 'Documentos dos demais bens a partilhar'));
    return v;
  }
  function secao(id, titulo, itens, extra) {
    var s = { id: id, titulo: titulo, itens: itens };
    if (extra) for (var k in extra) s[k] = extra[k];
    return s;
  }

  // ── O que cada modelo pede ─────────────────────────────────────────────
  // Devolve as seções, já considerando o público e as opções marcadas.
  function montar(estado) {
    var modelo = modeloDoTipo(estado.tipo);
    var pub = estado.publico || 'cliente';
    var S = [];

    // Quem entra pela construtora só informa os próprios dados.
    if (pub === 'construtora') {
      S.push(secao('voce', 'Dados de quem comprou', pessoa('voce')));
    } else if (modelo === 'compra-venda') {
      if (pub === 'corretor') {
        S.push(secao('partes', 'Dados do vendedor e do comprador', pessoa('partes')));
        S.push(secao('imovel', 'Imóvel', [item('imovel.mat', 'Matrícula do imóvel'), item('imovel.contrato', 'Contrato, se houver', false)]));
      } else {
        S.push(secao('vendedor', 'Vendedor(es)', pessoa('vendedor').concat([item('vendedor.banco', 'Dados bancários (banco, agência, conta e titular)')])));
        S.push(secao('comprador', 'Comprador(es)', pessoa('comprador').concat([
          item('comprador.valor', 'Valor da transação'),
          item('comprador.banco', 'Dados bancários (banco, agência, conta e titular)')
        ])));
        S.push(secao('imovel', 'Imóvel', [item('imovel.mat', 'Matrícula do imóvel')]));
      }
    } else if (modelo === 'doacao') {
      S.push(secao('doador', 'Doador(es)', pessoa('doador')));
      S.push(secao('donatario', 'Donatário(s)', pessoa('donatario')));
      S.push(secao('imovel', 'Imóvel', [item('imovel.mat', 'Matrícula do imóvel')]));
      S.push(secao('clausulas', 'Cláusulas', Object.keys(CLAUSULAS).map(function (k) { return item('clausula.' + k, CLAUSULAS[k], false); }), { tipo: 'clausulas' }));
    } else if (modelo === 'inventario') {
      S.push(secao('falecido', 'Falecido(a)', [
        item('falecido.rg', 'RG e CPF (do cônjuge também, quando for o caso)'),
        item('falecido.obito', 'Certidão de óbito'),
        item('falecido.casamento', 'Certidão de casamento'),
        item('falecido.pacto', 'Escritura de pacto antenupcial, se houver'),
        item('falecido.testamento', 'Certidão de inexistência de testamento (você costuma buscar)', false)
      ]));
      S.push(secao('herdeiros', 'Herdeiros', [
        item('herdeiros.rg', 'RG e CPF (dos cônjuges também, quando for o caso)'),
        item('herdeiros.cert', 'Certidão de nascimento ou de casamento'),
        item('herdeiros.ec', 'Estado civil'),
        item('herdeiros.prof', 'Profissão'),
        item('herdeiros.end', 'Endereço completo, com CEP')
      ]));
      S.push(secao('advogado', 'Advogado(a)', [
        item('advogado.oab', 'Carteira da OAB'),
        item('advogado.ec', 'Estado civil'),
        item('advogado.end', 'Endereço completo, com CEP')
      ].map(function (i) { i.padrao = pub === 'advogado'; return i; })));
      S.push(secao('bens', 'Bens a inventariar', bens(estado, 'bem.'), { vazio: 'Marque ao lado quais bens fazem parte.' }));
    } else if (modelo === 'divorcio') {
      S.push(secao('divorciandos', 'Divorciandos', pessoa('divorciando', { conjuge: false, cert: false }).concat([
        item('divorciando.casamento', 'Certidão de casamento (uma só, do casal)'),
        item('divorciando.pacto', 'Escritura de pacto antenupcial, se houver')
      ])));
      S.push(secao('advogado', 'Advogado(a)', [
        item('advogado.oab', 'Carteira da OAB'),
        item('advogado.ec', 'Estado civil'),
        item('advogado.end', 'Endereço completo, com CEP')
      ].map(function (i) { i.padrao = pub === 'advogado'; return i; })));
      S.push(secao('familia', 'Filhos e nome', [
        item('familia.filhos', 'Se têm filhos: de cada um, RG, CPF, estado civil, endereço e profissão'),
        item('familia.nome', 'Algum dos dois vai voltar a usar o nome de solteiro(a)? Qual?'),
        item('familia.pensao', 'Se há pensão estipulada para os filhos: o valor')
      ]));
      if (estado.partilha) S.push(secao('bens', 'Bens a partilhar', bens(estado, 'bem.'), { vazio: 'Marque ao lado quais bens serão partilhados.' }));
    } else if (modelo === 'uniao') {
      S.push(secao('conviventes', 'Conviventes', pessoa('convivente', { conjuge: false }).concat([
        item('convivente.inicio', 'Data de início da união'),
        item('convivente.endereco', 'Primeiro endereço do casal'),
        item('convivente.regime', 'Regime de bens a ser adotado')
      ])));
    } else if (modelo === 'pacto') {
      S.push(secao('noivos', 'Futuros cônjuges', pessoa('noivo', { conjuge: false }).concat([
        item('noivo.endereco', 'Primeiro endereço do casal'),
        item('noivo.regime', 'Regime de bens a ser adotado'),
        item('noivo.nome', 'Vão mudar o nome com o casamento? Qual será o nome de cada um?')
      ])));
    } else if (modelo === 'procuracao') {
      S.push(secao('outorgante', 'Outorgante (quem dá os poderes)', pessoa('outorgante')));
      S.push(secao('procurador', 'Procurador (quem recebe os poderes)', pessoaSimples('procurador').concat([item('procurador.ec', 'Estado civil')])));
      var poderes = [];
      if (estado.poderes && estado.poderes.imovel) poderes.push(item('poder.imovel', 'Matrícula do imóvel'));
      if (estado.poderes && estado.poderes.veiculo) poderes.push(item('poder.veiculo', 'Documento do veículo'));
      S.push(secao('poderes', 'Documentos dos poderes', poderes, { vazio: 'Marque ao lado se os poderes envolvem imóvel ou veículo.' }));
    } else if (modelo === 'ata') {
      S.push(secao('requerente', 'Requerente', pessoaSimples('requerente')));
      S.push(secao('material', 'Material', [item('material.arquivos', 'Material a registrar (fotos, prints, links)')]));
    } else if (modelo === 'dacao') {
      S.push(secao('partes', 'Partes', pessoa('partes')));
      S.push(secao('bem', 'Imóvel e dívida', [
        item('bem.mat', 'Matrícula do imóvel'),
        item('bem.divida', 'Contrato ou histórico da dívida'),
        item('bem.valor', 'Valor da dívida')
      ]));
    } else {
      S.push(secao('partes', 'Dados das partes', pessoa('partes')));
    }

    // Opcionais que ela marca para o caso (valem para qualquer ato com pessoas).
    var opc = [];
    if (estado.uniaoEstavel) opc.push(item('opc.uniao', 'Escritura pública de união estável, registrada no Registro Civil das Pessoas Naturais (RCPN) da última residência do casal, no Livro E'));
    if (estado.pacto && modelo !== 'pacto') {
      opc.push(item('opc.pacto', 'Escritura de pacto antenupcial e a certidão do registro do pacto no Registro de Imóveis do primeiro domicílio do casal'));
    }
    if (opc.length) S.push(secao('opcionais', 'Do casal', opc));

    // Itens que ela acrescenta à mão.
    var extras = (estado.extras || []).map(function (t, i) { return item('extra.' + i, t); });
    if (extras.length) S.push(secao('extras', 'Outros', extras));
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
      cliente: 'Olá! Para a elaboração ' + doDa(ato) + ', preciso que me envie o que segue.',
      advogado: 'Prezado(a) Dr(a)., para a elaboração ' + doDa(ato) + ', seguem os dados e documentos de que precisamos.',
      corretor: 'Olá! Para a elaboração ' + doDa(ato) + ', preciso do que segue.',
      construtora: 'Olá! Para regularizar a sua compra, preciso que me envie os dados abaixo.'
    }[pub];
    L.push(abertura, '');

    montar(estado).forEach(function (s) {
      if (s.tipo === 'clausulas') {
        var marc = s.itens.filter(function (i) { return ehMarcado(estado, i); });
        if (estado.clausulasModo === 'cliente') {
          L.push('*' + s.titulo.toUpperCase() + '*');
          L.push('• Informe se deseja alguma destas cláusulas: ' + s.itens.map(function (i) { return i.texto.toLowerCase(); }).join(', '));
          L.push('');
        } else if (marc.length) {
          L.push('*' + s.titulo.toUpperCase() + '*');
          L.push('• Cláusulas previstas: ' + marc.map(function (i) { return i.texto.toLowerCase(); }).join(', '));
          L.push('');
        }
        return;
      }
      var marcados = s.itens.filter(function (i) { return ehMarcado(estado, i); });
      if (!marcados.length) return;
      L.push('*' + s.titulo.toUpperCase() + '*');
      marcados.forEach(function (i) { L.push('• ' + i.texto); });
      L.push('');
    });

    if (estado.link) L.push('Pode enviar tudo por este link: ' + estado.link, '');
    else L.push('Pode me enviar as fotos ou os PDFs por aqui mesmo.', '');
    L.push('Se houver algo que queira que conste na minuta, é só me avisar.');
    L.push('Qualquer dúvida, estou à disposição.');
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
    '.ped textarea{min-height:200px;line-height:1.5;resize:vertical;overflow:hidden}' +
    '.ped-lin{display:flex;gap:9px;align-items:flex-start;padding:7px 2px;font-size:13px;line-height:1.4;cursor:pointer}' +
    '.ped-lin input{margin-top:2px;width:18px;height:18px;flex:none;accent-color:var(--cc-tinta,#1F2A33)}' +
    '.ped-lin.off{color:var(--cc-tinta-3,#6B7680)}' +
    '.ped-vazio{font-size:12px;color:var(--cc-tinta-3,#6B7680);padding:4px 2px}' +
    '.ped-grade{display:flex;flex-wrap:wrap;gap:4px 16px}' +
    '.ped-acoes{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}' +
    '.ped-btn{font:inherit;font-size:13px;font-weight:600;padding:10px 14px;border-radius:10px;border:1px solid var(--cc-linha-forte,#D8D0C1);background:#fff;color:var(--cc-tinta,#1F2A33);cursor:pointer;min-height:42px}' +
    '.ped-btn.forte{background:var(--cc-tinta,#1F2A33);color:#fff;border-color:var(--cc-tinta,#1F2A33)}' +
    '.ped-nota{font-size:12px;color:var(--cc-tinta-3,#6B7680);margin-top:8px;line-height:1.45}' +
    '.ped-ok{color:var(--cc-ok,#2F7A4F)}' +
    '.ped-linha-add{display:flex;gap:8px}';

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
      var opcoes = '';
      if (est.publico !== 'construtora') {
        if (ehInv || (ehDiv && est.partilha)) {
          opcoes += '<div class="ped-bloco"><div class="ped-tit">O que será ' + (ehDiv ? 'partilhado' : 'inventariado') + '<small>só pedimos os documentos do que marcar</small></div><div class="ped-grade">' +
            Object.keys(BENS).map(function (k) { return check(BENS[k].rotulo, !!est.bens[k], 'bem:' + k); }).join('') +
            check('Outros bens', !!est.bens.outros, 'bem:outros') + '</div></div>';
        }
        if (ehDiv) opcoes += '<div class="ped-bloco"><div class="ped-tit">Partilha</div>' + check('Com partilha de bens', est.partilha, 'partilha') + '</div>';
        if (modelo === 'procuracao') opcoes += '<div class="ped-bloco"><div class="ped-tit">Os poderes envolvem<small>define os documentos</small></div><div class="ped-grade">' +
          check('Imóvel', !!est.poderes.imovel, 'poder:imovel') + check('Veículo', !!est.poderes.veiculo, 'poder:veiculo') + '</div></div>';
        if (modelo === 'doacao') opcoes += '<div class="ped-bloco"><div class="ped-tit">Cláusulas<small>quem escolhe?</small></div><div class="ped-chips">' +
          '<button class="ped-chip' + (est.clausulasModo === 'marcar' ? ' on' : '') + '" data-acao="modo:marcar">Eu marco</button>' +
          '<button class="ped-chip' + (est.clausulasModo === 'cliente' ? ' on' : '') + '" data-acao="modo:cliente">A pessoa escolhe</button></div></div>';
        opcoes += '<div class="ped-bloco"><div class="ped-tit">Do casal<small>marque se for o caso</small></div>' +
          (modelo !== 'pacto' ? check('Casal com pacto antenupcial (regime: ' + REGIMES_COM_PACTO + ')', est.pacto, 'pacto') : '') +
          check('Escritura pública de união estável (RCPN, Livro E)', est.uniaoEstavel, 'uniao') + '</div>';
      }

      var listas = montar(est).map(function (s) {
        var linhas = s.itens.map(function (i) { return check(i.texto, ehMarcado(est, i), 'item:' + i.id); }).join('');
        return '<div class="ped-bloco"><div class="ped-tit">' + esc(s.titulo) + '</div>' + (linhas || '<div class="ped-vazio">' + esc(s.vazio || '') + '</div>') + '</div>';
      }).join('');

      alvo.innerHTML = '<div class="ped"><div class="ped-layout"><div class="ped-esq">' +
        '<div class="ped-bloco"><div class="ped-tit">Para quem é o pedido</div><div class="ped-chips">' +
        Object.keys(PUBLICOS).map(function (k) { return '<button class="ped-chip' + (est.publico === k ? ' on' : '') + '" data-acao="pub:' + k + '">' + esc(PUBLICOS[k].rotulo) + '</button>'; }).join('') +
        '</div><div class="ped-nota">' + esc(PUBLICOS[est.publico].dica) + '</div></div>' +
        '<div class="ped-bloco"><div class="ped-tit">Qual é o ato</div><select data-acao="tipo">' +
        tipos.map(function (t) { return '<option' + (t === est.tipo ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></div>' +
        opcoes + listas +
        '<div class="ped-bloco"><div class="ped-tit">Acrescentar um item<small>só para este pedido</small></div><div class="ped-linha-add"><input type="text" id="ped-extra" placeholder="Ex.: Declaração de quitação do condomínio"><button class="ped-btn" data-acao="extra">Acrescentar</button></div></div>' +
        '</div><div class="ped-dir"><div class="ped-bloco"><div class="ped-tit">A mensagem<small>pode editar antes de enviar</small></div>' +
        '<textarea id="ped-msg">' + esc(est.msg) + '</textarea>' +
        (est.msgEditada ? '<div class="ped-nota">Você editou o texto, então ele não muda mais sozinho. <button class="ped-btn" data-acao="refazer" style="min-height:32px;padding:4px 10px">Refazer pela lista</button></div>' : '') +
        '<div class="ped-bloco" style="margin:10px 0 0;background:#fff"><div class="ped-tit">E-mail da pessoa<small>opcional</small></div><input type="email" id="ped-para" value="' + esc(est.para) + '" placeholder="nome@exemplo.com.br"></div>' +
        '<div class="ped-acoes"><button class="ped-btn forte" data-acao="copiar">Copiar texto</button><button class="ped-btn" data-acao="email">Abrir no e-mail</button><button class="ped-btn" data-acao="zap">WhatsApp</button></div>' +
        '<div class="ped-nota' + (est.aviso ? ' ped-ok' : '') + '" id="ped-aviso">' + esc(est.aviso || 'Nada sai daqui sem você enviar.') + '</div></div></div></div></div>';
      ajustaAltura();
    }

    // A mensagem aparece inteira: ela confere antes de enviar.
    function ajustaAltura() {
      var t = alvo.querySelector('#ped-msg'); if (!t) return;
      t.style.height = 'auto'; t.style.height = (t.scrollHeight + 4) + 'px';
    }
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
