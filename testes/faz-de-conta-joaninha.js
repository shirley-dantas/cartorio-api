// A ponte do painel, de mentira — para testar a conversa da Joaninha sem o Firebase.
//
// Entrega o mesmo contrato que o index.html entrega em window.JOANINHA_PONTE
// (ver "A PONTE PARA A CONVERSA AMPLA"), com o banco em memória e a sessão
// controlada pelo teste: window.__sessao = {logado, liberada, nome, uid}.
// Tudo o que a conversa grava fica em window.__chamadas, e o teste conferir.
(function () {
  var banco = {};
  var escutas = [];
  var chamadas = { gravarNota: [], criarLembrete: [], concluirLembrete: [], adicionarFoco: [], abrirReedicao: [], escritasBanco: [] };
  window.__chamadas = chamadas;
  window.__banco = banco;
  window.__sessao = { logado: true, liberada: true, nome: 'Shirley', uid: 'u-shirley', senhaCerta: 'segredo' };
  var ouvintesSessao = [];
  window.__mudarSessao = function (n) { Object.assign(window.__sessao, n); ouvintesSessao.forEach(function (f) { f(); }); };
  window.__recusarLeitura = false;

  function pegar(caminho) {
    var o = banco, p = caminho.split('/').filter(Boolean);
    for (var i = 0; i < p.length; i++) { if (o == null) return null; o = o[p[i]]; }
    return o === undefined ? null : o;
  }
  function pôr(caminho, valor) {
    var p = caminho.split('/').filter(Boolean), o = banco;
    for (var i = 0; i < p.length - 1; i++) { o = o[p[i]] || (o[p[i]] = {}); }
    if (valor === null) delete o[p[p.length - 1]]; else o[p[p.length - 1]] = valor;
    escutas.forEach(function (e) { if (e.caminho === p[0] || caminho.indexOf(e.caminho) === 0 || e.caminho.indexOf(p[0]) === 0) e.cb(pegar(e.caminho)); });
  }
  var seq = 0;

  var casos = {
    c1: { id: 'c1', nome: 'ANA PAULA — compra e venda', tipo: 'Escritura de Compra e Venda', status: 'prioridade', dep: 'Falta documentos', resp: 'shirley', prazo: 'amanhã', atualizado: '2026-11-01', obs: 'Aguardando a certidão de casamento.', modalidade: 'digital',
      documentos: {
        d1: { nome: 'matricula_12345.pdf', tipoDocumento: 'MATRICULA_IMOVEL', texto: 'MATRÍCULA Nº 12.345 — apartamento 1301. Proprietário: JOSÉ DA SILVA.', salvoEm: '2026-11-02' },
        d2: { nome: 'rg_ana.jpg', tipoDocumento: 'RG_CNH', pessoa: 'Ana Paula', texto: 'RG 12.345.678-9 ANA PAULA SOUZA', salvoEm: '2026-11-02' },
        d3: { nome: 'rg_jose.jpg', tipoDocumento: 'RG_CNH', pessoa: 'José da Silva', texto: 'RG 98.765.432-1 JOSÉ DA SILVA', salvoEm: '2026-11-02' }
      },
      historico: { h1: { data: '2026-11-03T10:00:00Z', texto: 'Cliente enviou a matrícula.' } } },
    c2: { id: 'c2', nome: 'BRUNO — inventário', tipo: 'Inventário', status: 'critico', dep: 'Minutando', resp: 'grazi', prazo: '—', atualizado: '2026-10-20', obs: '' }
  };
  var lembretes = { l1: { texto: 'Ligar para a Ana', quando: '2026-11-12T14:00:00Z', casoId: 'c1', feito: false } };
  var focos = [{ id: 'f1', text: 'Conferir minuta do Bruno', done: false }];
  var orcamento = { id: 'o1', casoId: 'c1', versao: 2, status: 'enviado', data: '2026-11-04', definitivo: true,
    entrada: { atoId: 'compra-venda', valorNegocio: 30186716 }, resultado: { totais: { total: 1652221, escritura: 417624 }, despesas: [{ rot: 'Prenotação', valor: 8014 }], tributos: [{ rot: 'ITBI', valor: 905601 }] } };

  window.JOANINHA_PONTE = {
    casos: function () { return casos; }, focos: function () { return focos; }, lembretes: function () { return lembretes; },
    contexto: function () { return window.__contexto || null; }, definirContexto: function (c) { window.__contexto = c; },
    casosAtivos: function () { return Object.values(casos).filter(function (c) { return !c.concluido; }); },
    resumo: function () { return { emAndamento: 2, concluidosHoje: 0, concluidosSemana: 1, criticos: 1, aguardCliente: 0, aguardDocs: 1, mediaParado: 8 }; },
    insights: function () { return ['📄 1 processo aguardando documento do cliente.']; },
    buscar: function (q) { q = String(q || '').toLowerCase(); return { casosEnc: Object.values(casos).filter(function (c) { return c.nome.toLowerCase().indexOf(q) >= 0; }), focosEnc: focos.filter(function (f) { return f.text.toLowerCase().indexOf(q) >= 0; }) }; },
    diasParado: function () { return 8; }, hoje: function () { return '2026-11-11'; },
    gravarNota: async function (texto, alvo) { chamadas.gravarNota.push({ texto: texto, alvo: alvo }); },
    criarLembrete: async function (l) { chamadas.criarLembrete.push(l); },
    concluirLembrete: async function (k) { chamadas.concluirLembrete.push(k); },
    adicionarFoco: async function (t) { chamadas.adicionarFoco.push(t); },
    orcamentoDoCaso: function (id) { return id === 'c1' ? orcamento : null; },
    abrirReedicao: async function (id, instrucao) { chamadas.abrirReedicao.push({ id: id, instrucao: instrucao }); return true; },
    irParaCaso: function () {},
    mascote: { reagir: function (p) { (window.__mascote = window.__mascote || []).push(p); }, falar: function () {}, pausarVagar: function () {}, retomarVagar: function () {}, registrarAtividade: function () {} },
    logado: function () { return !!window.__sessao.logado; },
    usuarioNome: function () { return window.__sessao.nome; },
    liberada: function () { return !!window.__sessao.liberada; },
    uid: function () { return window.__sessao.uid; },
    token: async function () { return window.__sessao.logado ? 'token-' + window.__sessao.uid + '-xxxxxxxxxxxxxxxxxxxx' : null; },
    entrar: async function (email, senha) {
      if (senha !== window.__sessao.senhaCerta) return { ok: false, erro: 'E-mail ou senha incorretos.' };
      window.__mudarSessao({ logado: true, nome: 'Shirley', uid: 'u-shirley' });
      return { ok: true };
    },
    aoMudarSessao: function (cb) { ouvintesSessao.push(cb); return function () { ouvintesSessao = ouvintesSessao.filter(function (f) { return f !== cb; }); }; },
    fb: {
      ouvir: function (caminho, cb, erro) {
        if (window.__recusarLeitura) { setTimeout(function () { erro && erro(new Error('Permission denied')); }, 0); return function () {}; }
        var e = { caminho: caminho, cb: cb }; escutas.push(e);
        setTimeout(function () { cb(pegar(caminho)); }, 0);
        return function () { escutas = escutas.filter(function (x) { return x !== e; }); };
      },
      ler: async function (c) { return pegar(c); },
      empurrar: async function (caminho, valor) { var key = 'k' + (++seq); chamadas.escritasBanco.push({ caminho: caminho, valor: valor }); pôr(caminho + '/' + key, JSON.parse(JSON.stringify(valor))); return { key: key }; },
      gravar: async function (c, v) { pôr(c, v); },
      atualizar: async function (caminho, valor) { var atual = pegar(caminho) || {}; pôr(caminho, Object.assign({}, atual, valor)); },
      remover: async function (c) { pôr(c, null); }
    }
  };
  window.toggleJoaninhaPainel = function (f) { window.__legado = (window.__legado || 0) + 1; window.__legadoForce = f; };
})();
