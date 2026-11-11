/* A conversa ampla da Joaninha — o lado do navegador.
 *
 * Clicar na Joaninha abre uma conversa como a do ChatGPT, dentro do painel, com
 * as cores e a mascote do PRIME. A inteligência vem da OpenAI, mas a chave não
 * está aqui: tudo passa por /api/perguntar-joaninha?acao=chat (lib/joaninha-chat.js),
 * que confere a conta, o teto de consumo e as regras antes de gastar um centavo.
 *
 * Duas partes no mesmo arquivo, de propósito (como o pedido-docs.js):
 *   1. PURO: o markdown seguro, o texto para falar, o contexto do card, o
 *      catálogo de ferramentas do painel. Roda no Node (testes/joaninha-chat-puro.mjs).
 *   2. A TELA: o desenho, o histórico no Firebase, a voz. Só roda no navegador.
 *
 * Regras que não devem ser mexidas sem perguntar:
 *  - Quem escreve nunca roda sozinha. Nota, lembrete, foco e a reedição da minuta
 *    mostram o que vai acontecer, com o texto editável, e esperam o clique em
 *    Confirmar. Cancelou, não gravou nada — e a Joaninha é avisada.
 *  - As ferramentas usam as funções que o painel JÁ tem (window.JOANINHA_PONTE): a
 *    nota grava pelo mesmo caminho da nota de sempre, com a mesma pergunta sobre a
 *    data da assinatura. Nada aqui reescreve o que existe.
 *  - Orçamento só se LÊ. Financeiro, Meu financeiro e Rede não têm ferramenta.
 *  - Shirley e Grazi veem as mesmas ferramentas e as mesmas conversas: o histórico
 *    é compartilhado e cada mensagem diz quem a escreveu.
 *  - A resposta é texto, nunca HTML: o que vem da IA passa por mdSeguro().
 *  - A minuta continua sendo feita pelo Claude. A Joaninha só prepara a instrução
 *    e abre a tela de reedição; quem manda gerar é a pessoa.
 */
(function (global) {
  'use strict';

  /* ════════════════════════ 1. PURO ════════════════════════ */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
    });
  }
  function semAcento(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  // Markdown mínimo e seguro: escapa TUDO primeiro, depois reconhece negrito, itálico, código,
  // listas e endereços http(s). Nunca devolve tag que não tenha sido criada aqui.
  function mdSeguro(texto) {
    var t = esc(texto).replace(/\r\n?/g, '\n');
    var linhas = t.split('\n'), saida = [], lista = null;
    function inline(l) {
      return l
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>')
        .replace(/(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    }
    function fechar() { if (lista) { saida.push('</' + lista + '>'); lista = null; } }
    linhas.forEach(function (l) {
      var m;
      if ((m = l.match(/^\s*[-*•]\s+(.*)$/))) { if (lista !== 'ul') { fechar(); saida.push('<ul>'); lista = 'ul'; } saida.push('<li>' + inline(m[1]) + '</li>'); return; }
      if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) { if (lista !== 'ol') { fechar(); saida.push('<ol>'); lista = 'ol'; } saida.push('<li>' + inline(m[1]) + '</li>'); return; }
      fechar();
      if ((m = l.match(/^#{1,4}\s+(.*)$/))) { saida.push('<p><strong>' + inline(m[1]) + '</strong></p>'); return; }
      if (!l.trim()) { saida.push(''); return; }
      saida.push('<p>' + inline(l) + '</p>');
    });
    fechar();
    return saida.filter(Boolean).join('');
  }

  // O que vai para a voz: sem símbolos de formatação, sem emoji, sem endereço comprido.
  function limparParaFala(texto) {
    return String(texto || '')
      .replace(/https?:\/\/\S+/g, 'o link')
      .replace(/[*_`#>]/g, '')
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/\[nome\]/gi, 'o nome do cliente')
      .replace(/^\s*[-•]\s+/gm, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cortar(t, n) { t = String(t == null ? '' : t); return t.length > n ? t.slice(0, n) + '…' : t; }
  function brl(centavos) { return 'R$ ' + (Number(centavos || 0) / 100).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}); }

  function resumoDoCaso(c, P) {
    if (!c) return '';
    var docs = Object.values(c.documentos || {}).filter(Boolean);
    var o = P && P.orcamentoDoCaso ? P.orcamentoDoCaso(c.id) : null;
    var l = ['Caso: ' + (c.nome || '—') + ' (id ' + c.id + ')',
      'Tipo: ' + (c.tipo || '—') + ' | Status: ' + (c.status || '—') + ' | Etapa: ' + (c.dep || '—') + ' | Responsável: ' + (c.resp || '—'),
      'Prazo: ' + (c.prazo || '—') + (c.agendado ? ' | Assinatura: ' + c.agendado : '') + ' | Modalidade: ' + (c.modalidade || '—'),
      'Documentos no card: ' + (docs.length ? docs.map(function (d) { return d.nome || d.tipoDocumento || 'sem nome'; }).slice(0, 25).join('; ') : 'nenhum'),
      'Orçamento: ' + (o ? 'versão ' + o.versao + ', total ' + brl(o.resultado && o.resultado.totais && o.resultado.totais.total) : 'nenhum'),
      'Minuta no Drive: ' + (c.docUrl ? 'sim' : 'não'),
      'Observações: ' + cortar(c.obs, 1500)];
    return l.join('\n');
  }

  // O histórico que vai à API: só o texto das mensagens de gente e da Joaninha (as ações ficam de fora).
  function mensagensParaApi(lista, maximo) {
    var m = (lista || []).filter(function (x) { return (x.papel === 'user' || x.papel === 'assistant') && x.texto; })
      .map(function (x) { return {role: x.papel, content: String(x.texto)}; });
    m = m.slice(-(maximo || 30));
    while (m.length && m[0].role !== 'user') m.shift();
    return m;
  }

  // Lê o fluxo de eventos (SSE) devolvido pelo servidor.
  async function lerFluxo(leitor, aoEvento) {
    var dec = new TextDecoder(), resto = '';
    for (;;) {
      var r = await leitor.read();
      if (r.done) break;
      resto += dec.decode(r.value, {stream: true});
      var i;
      while ((i = resto.indexOf('\n\n')) >= 0) {
        var bloco = resto.slice(0, i); resto = resto.slice(i + 2);
        if (bloco.indexOf('data: ') === 0) { try { aoEvento(JSON.parse(bloco.slice(6))); } catch (e) { /* bloco quebrado */ } }
      }
    }
  }

  // ── As ferramentas do painel ──
  // Cada uma devolve TEXTO (o que o modelo lê). As que escrevem recebem argumentos já
  // confirmados — a confirmação mora na tela, antes de chegar aqui.
  function breve(c, P) {
    return {id: c.id, nome: c.nome, tipo: c.tipo || '', status: c.status || '', etapa: c.dep || '', responsavel: c.resp || '',
      prazo: c.prazo || '', diasParado: P.diasParado(c.atualizado), concluido: !!c.concluido};
  }
  function acharCaso(P, id) { var c = P.casos()[id]; return c && c.id == null ? Object.assign({id: id}, c) : c; }
  function docsDoCaso(c) { return Object.entries(c.documentos || {}).filter(function (e) { return e[1]; }); }

  function criarFerramentas(P) {
    var J = function (x) { return JSON.stringify(x); };
    return {
      listar_casos: async function (a) {
        a = a || {};
        var l = Object.values(P.casos()).filter(Boolean);
        if (!a.incluir_concluidos) l = l.filter(function (c) { return !c.concluido; });
        if (a.status) l = l.filter(function (c) { return c.status === a.status; });
        if (a.responsavel) l = l.filter(function (c) { return c.resp === a.responsavel; });
        if (a.etapa) l = l.filter(function (c) { return semAcento(c.dep).indexOf(semAcento(a.etapa)) >= 0; });
        if (a.busca) { var q = semAcento(a.busca); l = l.filter(function (c) { return [c.nome, c.tipo, c.acao, c.obs].some(function (t) { return semAcento(t).indexOf(q) >= 0; }); }); }
        return J({total: l.length, mostrando: Math.min(l.length, 40), casos: l.slice(0, 40).map(function (c) { return breve(c, P); })});
      },
      obter_caso: async function (a) {
        var c = acharCaso(P, a && a.caso_id);
        if (!c) return 'Não achei esse caso. Use listar_casos para ver os ids.';
        var hist = Object.values(c.historico || {}).filter(Boolean).sort(function (x, y) { return String(y.data).localeCompare(String(x.data)); }).slice(0, 8)
          .map(function (h) { return {data: h.data, texto: cortar(h.texto, 400)}; });
        var o = P.orcamentoDoCaso(c.id);
        return J({
          caso: breve(c, P), agendado: c.agendado || '', modalidade: c.modalidade || '', livro: c.livro || '', folha: c.folha || '', controle: c.controle || '',
          prenotacao: c.prenotacao || '', registro: c.registro || '', observacoes: cortar(c.obs, 3000), ultimas_anotacoes: hist,
          documentos: docsDoCaso(c).map(function (e) { var d = e[1]; return {chave: e[0], nome: d.nome || '', tipo: d.tipoDocumento || d.tipo || '', pessoa: d.pessoa || '', origem: d.origem || '', caracteres_de_texto: (d.texto || '').length, a_confirmar: !!d.confirmar}; }),
          orcamento: o ? {versao: o.versao, status: o.status, total_centavos: o.resultado && o.resultado.totais && o.resultado.totais.total} : null,
          minuta_no_drive: !!c.docUrl, pasta_no_drive: !!c.driveUrl
        });
      },
      ler_documento_caso: async function (a) {
        var c = acharCaso(P, a && a.caso_id);
        if (!c) return 'Não achei esse caso.';
        var q = semAcento(a && a.documento), docs = docsDoCaso(c), achados = docs.filter(function (e) { return e[0] === (a && a.documento); });
        if (!achados.length) achados = docs.filter(function (e) { var d = e[1]; return [d.nome, d.tipoDocumento, d.pessoa].some(function (t) { return q && semAcento(t).indexOf(q) >= 0; }); });
        if (!achados.length) return 'Nenhum documento deste caso combina com "' + (a && a.documento) + '". Veja os nomes em obter_caso.';
        if (achados.length > 1) return 'Mais de um documento combina: ' + achados.map(function (e) { return (e[1].nome || e[0]); }).join('; ') + '. Peça um nome mais específico.';
        var d = achados[0][1], max = Math.min(Math.max(Number(a && a.max_caracteres) || 12000, 500), 30000);
        if (!d.texto) return 'O documento "' + (d.nome || achados[0][0]) + '" está no card, mas o texto ainda não foi lido (sem leitura).';
        return J({nome: d.nome || '', tipo: d.tipoDocumento || d.tipo || '', pessoa: d.pessoa || '', texto_completo_no_card: (d.texto || '').length, cortado: (d.texto || '').length > max, texto: String(d.texto).slice(0, max)});
      },
      buscar: async function (a) {
        var r = P.buscar(a && a.texto);
        return J({casos: r.casosEnc.map(function (c) { return breve(c, P); }), lembretes_manuais: r.focosEnc.map(function (f) { return f.text; })});
      },
      resumo_do_dia: async function () {
        return J({numeros: P.resumo(), sinais_de_atencao: P.insights(), foco_do_dia_pendente: P.focos().filter(function (f) { return !f.done; }).map(function (f) { return f.text; })});
      },
      listar_lembretes: async function () {
        var L = P.lembretes() || {};
        return J(Object.entries(L).filter(function (e) { return e[1] && !e[1].feito; }).sort(function (x, y) { return String(x[1].quando).localeCompare(String(y[1].quando)); })
          .map(function (e) { var c = e[1].casoId && P.casos()[e[1].casoId]; return {id: e[0], texto: e[1].texto, quando: e[1].quando, caso: c ? c.nome : ''}; }));
      },
      consultar_orcamento: async function (a) {
        var c = acharCaso(P, a && a.caso_id);
        if (!c) return 'Não achei esse caso.';
        var o = P.orcamentoDoCaso(c.id);
        if (!o) return 'Este caso não tem orçamento.';
        var r = o.resultado || {};
        return cortar(J({
          caso: c.nome, versao: o.versao, status: o.status, data: o.data, definitivo: !!o.definitivo, valores_em: 'centavos',
          entrada: o.entrada || {}, totais: r.totais || {}, despesas: r.despesas || [], tributos: r.tributos || [],
          alertas: r.alertas || r.avisos || [], check_final: r.checkFinal || r.check || null, tabelas: r.tabelas || null
        }), 14000);
      },
      adicionar_nota: async function (a) {
        var texto = String(a && a.texto || '').trim();
        if (!texto) return 'Texto vazio: nada foi anotado.';
        if (a.caso_id) {
          if (!acharCaso(P, a.caso_id)) return 'Não achei esse caso: nada foi anotado.';
          await P.gravarNota(texto, {tipo: 'caso', id: a.caso_id});
          return 'Anotado no histórico e nas observações do caso.';
        }
        await P.gravarNota(texto, {tipo: 'foco'});
        return 'Anotado no Foco do dia.';
      },
      criar_lembrete: async function (a) {
        var texto = String(a && a.texto || '').trim(), d = new Date(a && a.quando);
        if (!texto) return 'Texto vazio: nenhum lembrete foi criado.';
        if (isNaN(d.getTime())) return 'A data/hora não é válida: nenhum lembrete foi criado.';
        if (a.caso_id && !acharCaso(P, a.caso_id)) return 'Não achei esse caso: nenhum lembrete foi criado.';
        await P.criarLembrete({texto: texto, quando: d.toISOString(), casoId: a.caso_id || null});
        return 'Lembrete criado para ' + d.toLocaleString('pt-BR', {timeZone: 'America/Sao_Paulo'}) + '.';
      },
      concluir_lembrete: async function (a) {
        var l = (P.lembretes() || {})[a && a.lembrete_id];
        if (!l) return 'Não achei esse lembrete.';
        await P.concluirLembrete(a.lembrete_id);
        return 'Lembrete concluído.';
      },
      adicionar_foco: async function (a) {
        var texto = String(a && a.texto || '').trim();
        if (!texto) return 'Texto vazio.';
        await P.adicionarFoco(texto);
        return 'Acrescentado ao Foco do dia.';
      },
      preparar_reedicao_minuta: async function (a) {
        var c = acharCaso(P, a && a.caso_id), instrucao = String(a && a.instrucao || '').trim();
        if (!c) return 'Não achei esse caso.';
        if (!instrucao) return 'Instrução vazia.';
        var abriu = await P.abrirReedicao(c.id, instrucao);
        return abriu ? 'Abri a tela de reedição da minuta com a instrução escrita. NADA foi gerado nem alterado: a pessoa vai ler, ajustar e apertar o botão de gerar, se quiser.'
          : 'Não consegui abrir a tela de reedição neste momento.';
      }
    };
  }

  // O que a confirmação mostra. `editavel` é o argumento de texto que a pessoa pode corrigir antes de confirmar.
  function descreverAcao(nome, a, P) {
    a = a || {};
    var c = a.caso_id ? P.casos()[a.caso_id] : null, nomeCaso = c ? c.nome : '';
    if (nome === 'adicionar_nota') return {titulo: nomeCaso ? 'Anotar no caso ' + nomeCaso : (a.caso_id ? 'Anotar (caso não encontrado)' : 'Anotar no Foco do dia'), detalhe: a.texto, editavel: 'texto', botao: 'Anotar'};
    if (nome === 'criar_lembrete') {
      var d = new Date(a.quando), quando = isNaN(d.getTime()) ? '(data inválida)' : d.toLocaleString('pt-BR', {timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short'});
      return {titulo: 'Criar lembrete para ' + quando + (nomeCaso ? ' · ' + nomeCaso : ''), detalhe: a.texto, editavel: 'texto', botao: 'Criar lembrete'};
    }
    if (nome === 'concluir_lembrete') { var l = (P.lembretes() || {})[a.lembrete_id]; return {titulo: 'Concluir este lembrete', detalhe: l ? l.texto : '(lembrete não encontrado)', editavel: null, botao: 'Concluir'}; }
    if (nome === 'adicionar_foco') return {titulo: 'Acrescentar ao Foco do dia', detalhe: a.texto, editavel: 'texto', botao: 'Acrescentar'};
    if (nome === 'preparar_reedicao_minuta') return {titulo: 'Abrir a reedição da minuta' + (nomeCaso ? ' de ' + nomeCaso : ''), detalhe: a.instrucao, editavel: 'instrucao', botao: 'Abrir reedição', aviso: 'Nada é gerado agora: a tela de reedição abre com este texto e quem manda gerar é você.'};
    return {titulo: nome, detalhe: JSON.stringify(a), editavel: null, botao: 'Confirmar'};
  }

  var PURO = {mdSeguro: mdSeguro, limparParaFala: limparParaFala, resumoDoCaso: resumoDoCaso, mensagensParaApi: mensagensParaApi, lerFluxo: lerFluxo,
    criarFerramentas: criarFerramentas, descreverAcao: descreverAcao, esc: esc, semAcento: semAcento};
  if (typeof module !== 'undefined' && module.exports) module.exports = PURO;
  if (typeof document === 'undefined') return;
  global.JOANINHA_CHAT_PURO = PURO;

  /* ════════════════════════ 2. A TELA ════════════════════════ */

  var ENDERECO = '/api/perguntar-joaninha?acao=chat';
  var CHAVE_ULTIMA = 'joaninha_chat_ultima';
  var CHAVE_MODO = 'joaninha_chat';
  var PONTE = function () { return global.JOANINHA_PONTE; };

  var est = {
    aberto: false, raiz: null, conversas: {}, conversaId: null, rascunho: null, msgs: [], parar: null, desligaMsgs: null, desligaLista: null,
    gerando: false, aprofundada: false, voz: {ativa: false, ouvindo: false, falando: false, muda: false, reconhecimento: null, ditando: false},
    uso: null, erro: '', filtro: 'todas', barraAberta: false, emAndamento: null, aguardandoConfirmacao: null, ferramentas: null, desligaSessao: null
  };

  var CSS = '' +
  '.jc-raiz{position:fixed;inset:0;z-index:960;display:none;font-family:inherit;color:#1C1C1E}' +
  '.jc-raiz.aberto{display:block}' +
  '.jc-vela{position:absolute;inset:0;background:rgba(22,10,10,.38)}' +
  '.jc-janela{position:absolute;right:18px;top:18px;bottom:18px;width:min(960px,calc(100vw - 36px));background:#fff;border-radius:20px;box-shadow:0 24px 64px rgba(22,10,10,.32);display:flex;overflow:hidden;border:.5px solid #F5DEE3}' +
  '.jc-lado{width:250px;flex:0 0 250px;background:#FFF7F8;border-right:.5px solid #F5DEE3;display:flex;flex-direction:column;min-height:0}' +
  '.jc-lado-topo{padding:14px 12px 8px;display:flex;flex-direction:column;gap:8px}' +
  '.jc-nova{border:none;border-radius:12px;padding:10px 12px;background:linear-gradient(135deg,#C62828,#7A1F2B);color:#fff;font-weight:600;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:8px;justify-content:center}' +
  '.jc-filtros{display:flex;gap:4px}.jc-filtro{flex:1;border:none;background:transparent;border-radius:8px;padding:5px 2px;font-size:11px;font-weight:600;color:#B4718A;cursor:pointer}.jc-filtro.ativo{background:#FDECEF;color:#7A1F2B}' +
  '.jc-lista{flex:1;overflow:auto;padding:4px 8px 12px}' +
  '.jc-item{display:block;width:100%;text-align:left;border:none;background:transparent;border-radius:10px;padding:8px 10px;cursor:pointer;font-family:inherit;color:#1C1C1E}.jc-item:hover{background:#FDECEF}.jc-item.ativo{background:#FDECEF;box-shadow:inset 3px 0 0 #7A1F2B}' +
  '.jc-item-t{font-size:12.5px;font-weight:600;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.jc-item-s{font-size:10.5px;color:#B4718A;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
  '.jc-vazio-lista{font-size:12px;color:#B4718A;padding:10px;font-style:italic}' +
  '.jc-principal{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}' +
  '.jc-topo{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:.5px solid #F5DEE3;background:linear-gradient(180deg,#fff,#FFF7F8)}' +
  '.jc-avatar{width:40px;height:40px;border-radius:50%;background:#FDECEF;object-fit:cover;flex:0 0 40px}' +
  '.jc-titulo{font-size:15px;font-weight:700;color:#7A1F2B;line-height:1.1}.jc-sub{font-size:11px;color:#B4718A;margin-top:2px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}' +
  '.jc-chip{display:inline-flex;align-items:center;gap:4px;background:#FDECEF;color:#7A1F2B;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:600}.jc-chip button{border:none;background:none;color:#B4718A;cursor:pointer;padding:0;font-size:13px;line-height:1}' +
  '.jc-acoes{margin-left:auto;display:flex;gap:6px;align-items:center}' +
  '.jc-btn{width:34px;height:34px;border-radius:50%;border:.5px solid #F0D3D8;background:#FFF7F8;color:#B4718A;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:16px}.jc-btn:hover{background:#FDECEF}.jc-btn.ativo{background:#7A1F2B;color:#fff;border-color:#7A1F2B}' +
  '.jc-corpo{flex:1;overflow:auto;padding:18px 20px;display:flex;flex-direction:column;gap:12px;min-height:0;background:#fff}' +
  '.jc-msg{max-width:86%;font-size:14px;line-height:1.55;border-radius:16px;padding:10px 14px;word-wrap:break-word;overflow-wrap:anywhere}' +
  '.jc-msg p{margin:0 0 6px}.jc-msg p:last-child{margin:0}.jc-msg ul,.jc-msg ol{margin:4px 0 6px 18px;padding:0}.jc-msg code{background:rgba(122,31,43,.08);border-radius:4px;padding:0 4px;font-size:12.5px}' +
  '.jc-msg.user{align-self:flex-end;background:linear-gradient(135deg,#C62828,#7A1F2B);color:#fff;border-bottom-right-radius:5px;white-space:pre-wrap}' +
  '.jc-msg.assistant{align-self:flex-start;background:#FFF7F8;border:.5px solid #F5DEE3;border-bottom-left-radius:5px}' +
  '.jc-autor{font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;opacity:.75;margin-bottom:3px;display:block}' +
  '.jc-msg-ferr{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}.jc-msg-ferr button{border:.5px solid #F0D3D8;background:#fff;color:#7A1F2B;border-radius:8px;padding:3px 9px;font-size:11.5px;cursor:pointer}' +
  '.jc-nota{align-self:center;font-size:11.5px;color:#B4718A;background:#FFF7F8;border-radius:20px;padding:4px 12px}' +
  '.jc-pensando{align-self:flex-start;font-size:12px;color:#B4718A;font-style:italic;padding:2px 6px}' +
  '.jc-confirma{align-self:flex-start;max-width:90%;background:#fff;border:1.5px solid #D68A9B;border-radius:14px;padding:12px 14px;box-shadow:0 6px 18px rgba(122,31,43,.12)}' +
  '.jc-confirma h4{margin:0 0 6px;font-size:13px;color:#7A1F2B}.jc-confirma textarea{width:100%;box-sizing:border-box;border:.5px solid #F0D3D8;border-radius:10px;background:#FFF7F8;padding:8px 10px;font:inherit;font-size:13px;min-height:64px;resize:vertical}' +
  '.jc-confirma .jc-aviso{font-size:11.5px;color:#B4718A;margin:6px 0 0}.jc-confirma-bt{display:flex;gap:8px;margin-top:10px}' +
  '.jc-ok,.jc-no{border-radius:10px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;border:none}.jc-ok{background:linear-gradient(135deg,#C62828,#7A1F2B);color:#fff}.jc-no{background:#FDECEF;color:#7A1F2B}' +
  '.jc-resolvida{opacity:.7;border-style:dashed;box-shadow:none}' +
  '.jc-sugestoes{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}.jc-sug{border:.5px solid #F0D3D8;background:#FFF7F8;color:#7A1F2B;border-radius:20px;padding:7px 13px;font-size:12.5px;cursor:pointer}.jc-sug:hover{background:#FDECEF}' +
  '.jc-boas-vindas{margin:auto;text-align:center;max-width:420px;color:#7A1F2B}.jc-boas-vindas img{width:84px;height:84px;border-radius:50%;background:#FDECEF}.jc-boas-vindas h3{margin:10px 0 4px;font-size:18px}.jc-boas-vindas p{margin:0 0 12px;font-size:13px;color:#B4718A}.jc-boas-vindas .jc-sugestoes{justify-content:center}' +
  '.jc-erro{margin:0 20px 8px;background:#FDECEF;color:#7A1F2B;border-radius:10px;padding:8px 12px;font-size:12.5px;display:flex;gap:8px;align-items:flex-start}.jc-erro button{margin-left:auto;border:none;background:none;color:#7A1F2B;cursor:pointer;font-size:15px}' +
  '.jc-rodape{border-top:.5px solid #F5DEE3;padding:10px 14px 12px;background:#fff}' +
  '.jc-compor{display:flex;gap:8px;align-items:flex-end}' +
  '.jc-compor textarea{flex:1;resize:none;border:.5px solid #F0D3D8;border-radius:16px;background:#FFF7F8;padding:10px 14px;font:inherit;font-size:14px;max-height:160px;min-height:42px;outline:none;line-height:1.4}.jc-compor textarea:focus{border-color:#D68A9B;background:#fff}' +
  '.jc-enviar{width:42px;height:42px;border-radius:50%;border:none;background:linear-gradient(135deg,#C62828,#7A1F2B);color:#fff;cursor:pointer;font-size:18px;flex:0 0 42px;display:inline-flex;align-items:center;justify-content:center}.jc-enviar:disabled{opacity:.5;cursor:not-allowed}' +
  '.jc-mic{width:42px;height:42px;border-radius:50%;border:.5px solid #F0D3D8;background:#FFF7F8;color:#7A1F2B;cursor:pointer;font-size:18px;flex:0 0 42px;display:inline-flex;align-items:center;justify-content:center}.jc-mic.ativo{background:#C62828;color:#fff;animation:jc-pulso 1.2s infinite}' +
  '@keyframes jc-pulso{0%{box-shadow:0 0 0 0 rgba(198,40,40,.45)}100%{box-shadow:0 0 0 12px rgba(198,40,40,0)}}' +
  '.jc-pe{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-top:6px;font-size:10.5px;color:#B4718A}.jc-pe .alerta{color:#C62828;font-weight:700}' +
  '.jc-voz-estado{display:none;align-items:center;gap:8px;justify-content:center;font-size:13px;font-weight:600;color:#7A1F2B;background:#FDECEF;border-radius:12px;padding:8px;margin-bottom:8px}.jc-voz-estado.on{display:flex}.jc-voz-estado button{border:none;background:#7A1F2B;color:#fff;border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer}' +
  '.jc-login{margin:auto;max-width:340px;text-align:center;display:flex;flex-direction:column;gap:10px;align-items:stretch}.jc-login img{width:72px;height:72px;border-radius:50%;background:#FDECEF;align-self:center}.jc-login h3{margin:0;color:#7A1F2B}.jc-login p{margin:0;font-size:13px;color:#B4718A}.jc-login input{border:.5px solid #F0D3D8;border-radius:12px;padding:11px 14px;font:inherit;font-size:14px;background:#FFF7F8}' +
  '.jc-barra{display:none}' +
  '@media (max-width:760px){.jc-janela{inset:0;width:auto;border-radius:0}.jc-lado{position:absolute;z-index:3;left:0;top:0;bottom:0;transform:translateX(-102%);transition:transform .2s}.jc-janela.barra .jc-lado{transform:none;box-shadow:8px 0 24px rgba(22,10,10,.2)}.jc-barra{display:inline-flex}.jc-msg{max-width:94%}.jc-corpo{padding:14px 12px}.jc-topo{padding:10px 12px}.jc-confirma{max-width:100%}}';

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function $(sel) { return est.raiz.querySelector(sel); }
  function agoraIso() { return new Date().toISOString(); }
  function nomeDeQuem() { var P = PONTE(); return (P && P.usuarioNome && P.usuarioNome()) || 'Equipe'; }
  function primeiroNome(n) { return String(n || '').split(/[\s@]/)[0]; }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } }
  function ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function construir() {
    if (est.raiz) return;
    if (!document.getElementById('jc-estilo')) { var s = el('style'); s.id = 'jc-estilo'; s.textContent = CSS; document.head.appendChild(s); }
    est.raiz = el('div', 'jc-raiz');
    est.raiz.id = 'jc-raiz';
    est.raiz.setAttribute('role', 'dialog');
    est.raiz.setAttribute('aria-label', 'Conversa com a Joaninha');
    est.raiz.innerHTML =
      '<div class="jc-vela" data-jc="fechar"></div>' +
      '<div class="jc-janela" id="jc-janela">' +
        '<aside class="jc-lado"><div class="jc-lado-topo">' +
          '<button type="button" class="jc-nova" data-jc="nova"><i class="ti ti-plus"></i> Nova conversa</button>' +
          '<div class="jc-filtros"><button type="button" class="jc-filtro ativo" data-jc="filtro" data-f="todas">Todas</button><button type="button" class="jc-filtro" data-jc="filtro" data-f="caso">Deste caso</button></div>' +
        '</div><div class="jc-lista" id="jc-lista"></div></aside>' +
        '<section class="jc-principal">' +
          '<header class="jc-topo">' +
            '<button type="button" class="jc-btn jc-barra" data-jc="barra" title="Conversas"><i class="ti ti-menu-2"></i></button>' +
            '<img class="jc-avatar" id="jc-avatar" src="design-system/mascots/joaninha/assets/idle.png" alt="Joaninha">' +
            '<div><div class="jc-titulo">Joaninha</div><div class="jc-sub" id="jc-sub"></div></div>' +
            '<div class="jc-acoes">' +
              '<button type="button" class="jc-btn" data-jc="funda" id="jc-funda" title="Análise aprofundada (usa o modelo mais forte — consome mais)"><i class="ti ti-sparkles"></i></button>' +
              '<button type="button" class="jc-btn" data-jc="muda" id="jc-muda" title="Ler as respostas em voz alta"><i class="ti ti-volume"></i></button>' +
              '<button type="button" class="jc-btn" data-jc="rapido" title="Painel rápido (Nota, Lembrete, Resumo, Buscar…)"><i class="ti ti-bolt"></i></button>' +
              '<button type="button" class="jc-btn" data-jc="fechar" title="Fechar"><i class="ti ti-x"></i></button>' +
            '</div>' +
          '</header>' +
          '<div class="jc-corpo" id="jc-corpo"></div>' +
          '<div class="jc-erro" id="jc-erro" style="display:none"></div>' +
          '<footer class="jc-rodape">' +
            '<div class="jc-voz-estado" id="jc-voz-estado"><span id="jc-voz-texto">Ouvindo…</span><button type="button" data-jc="voz-parar">Parar conversa por voz</button></div>' +
            '<div class="jc-compor">' +
              '<button type="button" class="jc-mic" id="jc-ditar" data-jc="ditar" title="Ditar (preenche a caixa)"><i class="ti ti-microphone"></i></button>' +
              '<textarea id="jc-texto" rows="1" placeholder="Escreva ou fale com a Joaninha…" aria-label="Mensagem"></textarea>' +
              '<button type="button" class="jc-mic" id="jc-voz" data-jc="voz" title="Conversar por voz (ela fala de volta)"><i class="ti ti-headset"></i></button>' +
              '<button type="button" class="jc-enviar" id="jc-enviar" data-jc="enviar" title="Enviar"><i class="ti ti-send"></i></button>' +
            '</div>' +
            '<div class="jc-pe"><span id="jc-uso"></span><span>Quem escreve nunca é feito sem a sua confirmação</span></div>' +
          '</footer>' +
        '</section>' +
      '</div>';
    document.body.appendChild(est.raiz);
    est.raiz.addEventListener('click', aoClicar);
    var ta = $('#jc-texto');
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarDaCaixa(); } });
    ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && est.aberto) fechar(); });
  }

  function aoClicar(e) {
    var b = e.target.closest('[data-jc]');
    if (!b) return;
    var a = b.getAttribute('data-jc');
    if (a === 'fechar') fechar();
    else if (a === 'nova') novaConversa();
    else if (a === 'enviar') { if (est.gerando) interromper(); else enviarDaCaixa(); }
    else if (a === 'filtro') { est.filtro = b.getAttribute('data-f'); desenharLista(); }
    else if (a === 'conversa') { abrirConversa(b.getAttribute('data-id')); est.barraAberta = false; $('#jc-janela').classList.remove('barra'); }
    else if (a === 'barra') { est.barraAberta = !est.barraAberta; $('#jc-janela').classList.toggle('barra', est.barraAberta); }
    else if (a === 'funda') { est.aprofundada = !est.aprofundada; $('#jc-funda').classList.toggle('ativo', est.aprofundada); desenharSub(); }
    else if (a === 'muda') { est.voz.muda = !est.voz.muda; $('#jc-muda').classList.toggle('ativo', est.voz.muda); $('#jc-muda').innerHTML = '<i class="ti ti-volume' + (est.voz.muda ? '-off' : '') + '"></i>'; if (est.voz.muda) calar(); }
    else if (a === 'rapido') { fechar(); if (global.toggleJoaninhaPainel) global.toggleJoaninhaPainel(true); }
    else if (a === 'sugestao') { enviar(b.getAttribute('data-t'), {funda: b.getAttribute('data-funda') === '1'}); }
    else if (a === 'tirar-caso') { tirarCaso(); }
    else if (a === 'ditar') alternarDitado();
    else if (a === 'voz') alternarConversaPorVoz();
    else if (a === 'voz-parar') pararVoz();
    else if (a === 'copiar') { var t = b.getAttribute('data-t'); try { navigator.clipboard.writeText(t); b.textContent = 'Copiado'; } catch (x) { b.textContent = 'Não consegui copiar'; } }
    else if (a === 'entrar') entrar();
    else if (a === 'fechar-erro') { est.erro = ''; mostrarErro(''); }
    else if (a === 'ir-caso') { var P = PONTE(); fechar(); if (P && P.irParaCaso) P.irParaCaso(est.conversas[est.conversaId] && est.conversas[est.conversaId].casoId); }
  }

  /* ── abrir e fechar ── */
  function ativo() { return !!(PONTE() && ler(CHAVE_MODO) !== 'antigo'); }
  function abrir(op) {
    op = op || {};
    construir();
    est.aberto = true;
    est.raiz.classList.add('aberto');
    var P = PONTE();
    if (P && P.mascote) { P.mascote.pausarVagar(); P.mascote.reagir('sorrir'); P.mascote.registrarAtividade(); }
    ligarSessao();
    var casoId = op.casoId || (P && P.contexto && P.contexto() && P.contexto().tipo === 'caso' ? P.contexto().id : null);
    escutarLista();
    if (op.conversaId) abrirConversa(op.conversaId);
    else if (casoId && op.casoId) abrirDoCaso(casoId);
    else if (!est.conversaId && !est.rascunho) novaConversa();
    else desenharTudo();
    setTimeout(function () { var t = $('#jc-texto'); if (t) t.focus(); }, 80);
  }
  function fechar() {
    if (!est.raiz) return;
    est.aberto = false;
    est.raiz.classList.remove('aberto');
    pararVoz(); calar();
    if (est.gerando) interromper();
    var P = PONTE();
    if (P && P.mascote) P.mascote.retomarVagar();
  }
  function alternar() { if (est.aberto) fechar(); else abrir(); }

  /* ── sessão: um login só, o mesmo do Financeiro ── */
  function ligarSessao() {
    var P = PONTE();
    if (est.desligaSessao || !P || !P.aoMudarSessao) return;
    est.desligaSessao = P.aoMudarSessao(function () { if (est.aberto) { escutarLista(true); desenharTudo(); } });
  }
  async function entrar() {
    var P = PONTE(), e = $('#jc-login-email'), s = $('#jc-login-senha'), msg = $('#jc-login-erro');
    if (!e || !e.value.trim() || !s.value) { msg.textContent = 'Preencha o e-mail e a senha.'; return; }
    msg.textContent = 'Entrando…';
    var r = await P.entrar(e.value.trim(), s.value);
    msg.textContent = r.ok ? '' : r.erro;
  }
  function podeConversar() { var P = PONTE(); return !!(P && P.logado() && P.liberada()); }
  function desenharLogin() {
    var P = PONTE(), c = $('#jc-corpo');
    if (P && P.logado()) {
      c.innerHTML = '<div class="jc-login"><img src="design-system/mascots/joaninha/assets/thinking.png" alt=""><h3>Falta liberar esta conta</h3><p>Você entrou, mas esta conta ainda não está liberada no painel. Abra o <b>Financeiro</b> uma vez e clique em “Liberar esta conta” (ou peça para liberarem em /acesso). Depois volte aqui.</p></div>';
      return;
    }
    c.innerHTML = '<div class="jc-login"><img src="design-system/mascots/joaninha/assets/idle.png" alt=""><h3>Entre para conversar</h3>' +
      '<p>A conversa com a Joaninha lê casos e documentos, então pede a mesma conta do Financeiro.</p>' +
      '<input id="jc-login-email" type="email" placeholder="Seu e-mail" autocomplete="username">' +
      '<input id="jc-login-senha" type="password" placeholder="Sua senha" autocomplete="current-password">' +
      '<div id="jc-login-erro" style="font-size:12.5px;color:#C62828;min-height:16px"></div>' +
      '<button type="button" class="jc-nova" data-jc="entrar">Entrar</button></div>';
    var s = $('#jc-login-senha'); if (s) s.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') entrar(); });
  }

  /* ── conversas e histórico (compartilhados) ── */
  function escutarLista(forcar) {
    var P = PONTE();
    if (!P || !podeConversar()) return;
    if (est.desligaLista && !forcar) return;
    if (est.desligaLista) { try { est.desligaLista(); } catch (e) { /* já solto */ } est.desligaLista = null; }
    est.desligaLista = P.fb.ouvir('joaninha_conversas', function (v) {
      est.conversas = v || {};
      if (est.pendenteCaso) {
        var cid = est.pendenteCaso; est.pendenteCaso = null;
        var ex = conversasOrdenadas().filter(function (e) { return e[1].casoId === cid; })[0];
        if (ex && !est.conversaId && !est.gerando) { abrirConversa(ex[0]); return; }
      }
      desenharLista(); desenharSub();
    },
      function (err) { mostrarErro('Não consegui ler o histórico (' + (err && err.message || err) + '). Se as regras do banco ainda não foram publicadas, é o passo 14 do FIREBASE.md.'); });
  }
  function conversasOrdenadas() {
    return Object.entries(est.conversas).filter(function (e) { return e[1]; }).sort(function (a, b) { return String(b[1].atualizadaEm).localeCompare(String(a[1].atualizadaEm)); });
  }
  function desenharLista() {
    var L = $('#jc-lista'); if (!L) return;
    if (!podeConversar()) { L.innerHTML = '<div class="jc-vazio-lista">Entre para ver as conversas.</div>'; return; }
    var P = PONTE(), ctx = P.contexto && P.contexto(), casoAtual = est.conversaId && est.conversas[est.conversaId] ? est.conversas[est.conversaId].casoId : (est.rascunho && est.rascunho.casoId) || (ctx && ctx.tipo === 'caso' ? ctx.id : null);
    var itens = conversasOrdenadas();
    if (est.filtro === 'caso') itens = itens.filter(function (e) { return casoAtual && e[1].casoId === casoAtual; });
    Array.prototype.forEach.call(est.raiz.querySelectorAll('.jc-filtro'), function (b) { b.classList.toggle('ativo', b.getAttribute('data-f') === est.filtro); });
    if (!itens.length) { L.innerHTML = '<div class="jc-vazio-lista">' + (est.filtro === 'caso' ? 'Nenhuma conversa sobre este caso ainda.' : 'Nenhuma conversa ainda.') + '</div>'; return; }
    L.innerHTML = itens.slice(0, 80).map(function (e) {
      var c = e[1], quando = c.atualizadaEm ? new Date(c.atualizadaEm).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'}) : '';
      return '<button type="button" class="jc-item' + (e[0] === est.conversaId ? ' ativo' : '') + '" data-jc="conversa" data-id="' + esc(e[0]) + '"><div class="jc-item-t">' + esc(c.titulo || 'Conversa') + '</div><div class="jc-item-s">' +
        esc((c.casoNome ? c.casoNome + ' · ' : '') + quando + (c.criadaPor && c.criadaPor.nome ? ' · ' + primeiroNome(c.criadaPor.nome) : '')) + '</div></button>';
    }).join('');
  }
  function desenharSub() {
    var s = $('#jc-sub'); if (!s) return;
    var c = est.conversaId && est.conversas[est.conversaId], casoId = c ? c.casoId : (est.rascunho && est.rascunho.casoId), nome = c ? c.casoNome : (est.rascunho && est.rascunho.casoNome);
    s.innerHTML = (casoId ? '<span class="jc-chip"><i class="ti ti-briefcase"></i> ' + esc(nome || 'caso') + (est.conversaId ? '' : ' <button type="button" data-jc="tirar-caso" title="Conversar sem prender a um caso">&times;</button>') + '</span>' : '<span class="jc-chip"><i class="ti ti-world"></i> Geral</span>') +
      (est.aprofundada ? '<span class="jc-chip"><i class="ti ti-sparkles"></i> análise aprofundada</span>' : '');
  }
  function tirarCaso() { if (est.rascunho) { est.rascunho.casoId = null; est.rascunho.casoNome = ''; desenharSub(); desenharCorpo(); } }

  function novaConversa(op) {
    pararMsgs();
    est.conversaId = null; est.msgs = []; est.emAndamento = null;
    var P = PONTE(), ctx = P && P.contexto && P.contexto(), casoId = (op && op.casoId) || (ctx && ctx.tipo === 'caso' ? ctx.id : null), c = casoId && P.casos()[casoId];
    est.rascunho = {casoId: c ? casoId : null, casoNome: c ? c.nome : ''};
    desenharTudo();
  }
  // Do botão do card: retoma a última conversa daquele caso. A lista pode ainda não ter chegado do banco; nesse
  // caso começa um rascunho preso ao caso e, quando a lista chega, troca para a conversa existente (se a pessoa
  // ainda não escreveu nada).
  function abrirDoCaso(casoId) {
    var existente = conversasOrdenadas().filter(function (e) { return e[1].casoId === casoId; })[0];
    if (existente) { est.pendenteCaso = null; abrirConversa(existente[0]); }
    else { est.pendenteCaso = casoId; novaConversa({casoId: casoId}); }
  }
  function pararMsgs() { if (est.desligaMsgs) { try { est.desligaMsgs(); } catch (e) { /* já solto */ } est.desligaMsgs = null; } }
  function abrirConversa(id) {
    var P = PONTE(); if (!P || !est.conversas[id]) return;
    pararMsgs();
    est.conversaId = id; est.rascunho = null; est.msgs = []; est.emAndamento = null;
    guardar(CHAVE_ULTIMA, id);
    est.desligaMsgs = P.fb.ouvir('joaninha_mensagens/' + id, function (v) {
      est.msgs = Object.entries(v || {}).map(function (e) { return Object.assign({id: e[0]}, e[1]); }).sort(function (a, b) { return String(a.em).localeCompare(String(b.em)); });
      desenharCorpo();
    }, function (err) { mostrarErro('Não consegui ler as mensagens (' + (err && err.message || err) + ').'); });
    desenharTudo();
  }

  /* ── desenho ── */
  function desenharTudo() { desenharSub(); desenharLista(); desenharCorpo(); mostrarUso(); }
  function sugestoes() {
    var caso = (est.conversaId && est.conversas[est.conversaId] && est.conversas[est.conversaId].casoId) || (est.rascunho && est.rascunho.casoId);
    var l = caso
      ? [['Quais são as pendências deste caso?', 0], ['Confira o orçamento deste caso', 1], ['Revise os documentos do card', 1], ['Escreva uma resposta para o cliente sobre este caso', 0]]
      : [['O que devo fazer agora?', 0], ['Resumo do dia', 0], ['Quais casos estão parados há mais tempo?', 0], ['Quais casos aguardam documentos?', 0]];
    return l.map(function (x) { return '<button type="button" class="jc-sug" data-jc="sugestao" data-t="' + esc(x[0]) + '" data-funda="' + x[1] + '">' + esc(x[0]) + '</button>'; }).join('');
  }
  function bolha(m) {
    if (m.papel === 'user') return '<div class="jc-msg user"><span class="jc-autor">' + esc(primeiroNome(m.autor) || 'Você') + '</span>' + esc(m.texto) + '</div>';
    if (m.papel === 'assistant') return '<div class="jc-msg assistant">' + mdSeguro(m.texto) + '<div class="jc-msg-ferr"><button type="button" data-jc="copiar" data-t="' + esc(m.texto) + '"><i class="ti ti-copy"></i> Copiar</button></div></div>';
    if (m.papel === 'acao') return '<div class="jc-nota">' + esc(m.texto) + '</div>';
    return '';
  }
  function desenharCorpo() {
    var c = $('#jc-corpo'); if (!c) return;
    if (!podeConversar()) { desenharLogin(); return; }
    var perto = c.scrollHeight - c.scrollTop - c.clientHeight < 120;
    var html = '';
    if (!est.msgs.length && !est.emAndamento && !est.aguardandoConfirmacao) {
      var P = PONTE(), nome = primeiroNome(P && P.usuarioNome && P.usuarioNome());
      html = '<div class="jc-boas-vindas"><img src="design-system/mascots/joaninha/assets/happy.png" alt=""><h3>' + (nome ? 'Oi, ' + esc(nome) + '!' : 'Oi!') + '</h3><p>Pergunte, peça uma análise, um resumo ou uma mensagem para o cliente. Pode digitar ou falar.</p><div class="jc-sugestoes">' + sugestoes() + '</div></div>';
    } else html = est.msgs.map(bolha).join('');
    // A bolha só existe quando já há texto: antes disso, só o aviso do que ela está fazendo (uma bolha vazia parece defeito).
    if (est.emAndamento) html += (est.emAndamento.texto ? '<div class="jc-msg assistant" id="jc-andamento">' + mdSeguro(est.emAndamento.texto) + '</div>' : '') + (est.emAndamento.status ? '<div class="jc-pensando">' + esc(est.emAndamento.status) + '</div>' : '');
    c.innerHTML = html;
    if (est.aguardandoConfirmacao) c.appendChild(est.aguardandoConfirmacao.no);
    if (perto || est.gerando) c.scrollTop = c.scrollHeight;
    var b = $('#jc-enviar'); b.innerHTML = '<i class="ti ti-' + (est.gerando ? 'player-stop' : 'send') + '"></i>'; b.title = est.gerando ? 'Parar' : 'Enviar';
    var av = $('#jc-avatar'); if (av) av.src = 'design-system/mascots/joaninha/assets/' + (est.gerando ? 'thinking' : 'idle') + '.png';
  }
  function mostrarErro(t) { var e = $('#jc-erro'); if (!e) return; if (!t) { e.style.display = 'none'; e.innerHTML = ''; return; } e.style.display = 'flex'; e.innerHTML = '<i class="ti ti-alert-circle"></i><span>' + esc(t) + '</span><button type="button" data-jc="fechar-erro" aria-label="Fechar aviso">&times;</button>'; }
  function mostrarUso() {
    var u = $('#jc-uso'); if (!u) return;
    if (!est.uso) { u.textContent = ''; return; }
    var pct = est.uso.teto ? est.uso.usoMes / est.uso.teto : 0;
    u.innerHTML = '<span class="' + (pct >= 0.8 ? 'alerta' : '') + '">Consumo do mês: R$ ' + est.uso.usoMes.toFixed(2).replace('.', ',') + ' de R$ ' + est.uso.teto.toFixed(0) + '</span>';
  }

  /* ── enviar e receber ── */
  function enviarDaCaixa() { var t = $('#jc-texto'); var v = t.value.trim(); if (!v) { t.focus(); return; } t.value = ''; t.style.height = 'auto'; enviar(v); }

  async function garantirConversa(primeiraMsg) {
    var P = PONTE();
    if (est.conversaId) return est.conversaId;
    var r = est.rascunho || {casoId: null, casoNome: ''};
    var meta = {titulo: cortar(primeiraMsg.replace(/\s+/g, ' '), 52), casoId: r.casoId || null, casoNome: r.casoNome || '', criadaEm: agoraIso(), atualizadaEm: agoraIso(), criadaPor: {uid: P.uid(), nome: nomeDeQuem()}};
    var ref = await P.fb.empurrar('joaninha_conversas', meta);
    est.conversas[ref.key] = meta;
    abrirConversa(ref.key);
    return ref.key;
  }
  async function guardarMsg(conversaId, m) {
    var P = PONTE();
    var ref = await P.fb.empurrar('joaninha_mensagens/' + conversaId, m);
    P.fb.atualizar('joaninha_conversas/' + conversaId, {atualizadaEm: m.em, ultima: cortar(m.texto, 80)}).catch(function () {});
    return ref;
  }
  function contextoParaServidor() {
    var P = PONTE(), c = est.conversaId && est.conversas[est.conversaId], casoId = c ? c.casoId : (est.rascunho && est.rascunho.casoId);
    if (casoId && P.casos()[casoId]) { var cc = Object.assign({id: casoId}, P.casos()[casoId]); return {resumo: resumoDoCaso(cc, P)}; }
    var r = P.resumo();
    return {resumo: 'Visão geral do painel: ' + r.emAndamento + ' casos em andamento, ' + r.criticos + ' críticos, ' + r.aguardCliente + ' aguardando cliente, ' + r.aguardDocs + ' aguardando documentos.'};
  }

  async function enviar(texto, op) {
    op = op || {};
    var P = PONTE();
    if (est.gerando || !P) return;
    if (!podeConversar()) { desenharCorpo(); return; }
    mostrarErro('');
    if (op.funda) { est.aprofundada = true; $('#jc-funda').classList.add('ativo'); desenharSub(); }
    est.gerando = true; calar();
    if (P.mascote) P.mascote.reagir('pensando-on');
    var voz = !!(est.voz.ativa || op.voz);
    var parcial = '';
    try {
      var convId = await garantirConversa(texto);
      // O histórico é tirado ANTES de gravar a mensagem nova: o banco devolve a gravação pela escuta e ela
      // entraria duas vezes.
      var msgs = mensagensParaApi(est.msgs, 29);
      msgs.push({role: 'user', content: texto});
      est.emAndamento = {texto: '', status: 'Pensando…'}; desenharCorpo();
      await guardarMsg(convId, {papel: 'user', texto: texto, autor: nomeDeQuem(), uid: P.uid(), em: agoraIso()});
      var contexto = contextoParaServidor();
      var acoes = [];
      var final = await rodar(msgs, 0, contexto, voz, acoes, function (t) { parcial += t; est.emAndamento.texto = parcial; est.emAndamento.status = ''; desenharCorpo(); });
      var textoFinal = (final && final.texto) || parcial;
      est.emAndamento = null;
      if (textoFinal.trim()) await guardarMsg(convId, {papel: 'assistant', texto: textoFinal, autor: 'Joaninha', em: agoraIso(), acoes: acoes.length ? acoes : null});
      desenharCorpo();
      if (voz && textoFinal.trim()) await falar(textoFinal);
    } catch (e) {
      est.emAndamento = null;
      if (parcial.trim() && est.conversaId) { try { await guardarMsg(est.conversaId, {papel: 'assistant', texto: parcial, autor: 'Joaninha', em: agoraIso()}); } catch (x) { /* sem histórico */ } }
      if (!(e && e.cancelado)) mostrarErro(e && e.message ? e.message : 'Não consegui conversar agora.');
      desenharCorpo();
    }
    est.gerando = false;
    if (P.mascote) P.mascote.reagir('pensando-off');
    desenharCorpo();
    if (est.voz.ativa && !est.voz.falando) ouvir();
  }

  function interromper() { if (est.parar) est.parar(); }

  // Uma ida ao servidor. Se o modelo pedir ferramentas do painel, executa aqui e vai de novo.
  async function rodar(mensagens, rodadaN, contexto, voz, acoes, aoTexto) {
    var P = PONTE();
    var token = await P.token();
    if (!token) throw new Error('Sua sessão venceu. Entre de novo.');
    var ctl = new AbortController();
    est.parar = function () { var e = new Error('cancelado'); e.cancelado = true; ctl.abort(); };
    var resp;
    try {
      resp = await fetch(ENDERECO, {method: 'POST', signal: ctl.signal, headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
        body: JSON.stringify({mensagens: mensagens, contexto: contexto, rodada: rodadaN, voz: voz, nivel: est.aprofundada ? 'forte' : 'padrao'})});
    } catch (e) { if (ctl.signal.aborted) { var c = new Error('cancelado'); c.cancelado = true; throw c; } throw new Error('Sem conexão com o servidor agora. Tente de novo.'); }
    if (!/event-stream/.test(resp.headers.get('content-type') || '')) {
      var j = null; try { j = await resp.json(); } catch (e) { /* sem corpo */ }
      throw new Error((j && j.erro) || 'O servidor recusou a conversa (' + resp.status + ').');
    }
    var pedido = null, erro = null, texto = '';
    try {
      await lerFluxo(resp.body.getReader(), function (ev) {
        if (ev.t === 'texto') { texto += ev.d; aoTexto(ev.d); }
        else if (ev.t === 'usando') { est.emAndamento && (est.emAndamento.status = 'Consultando a base jurídica…'); desenharCorpo(); }
        else if (ev.t === 'ferramentas') pedido = ev;
        else if (ev.t === 'fim') { if (ev.teto) est.uso = {usoMes: Number(ev.usoMes) || 0, teto: Number(ev.teto)}; }
        else if (ev.t === 'erro') erro = ev;
      });
    } catch (e) { if (ctl.signal.aborted) { var c2 = new Error('cancelado'); c2.cancelado = true; throw c2; } throw new Error('A resposta foi interrompida. Tente de novo.'); }
    mostrarUso();
    if (erro) throw new Error(erro.erro || 'Algo deu errado.');
    if (!pedido) return {texto: texto};
    if (pedido.teto) est.uso = {usoMes: Number(pedido.usoMes) || 0, teto: Number(pedido.teto)};
    var resultados = [];
    for (var i = 0; i < pedido.pedidos.length; i++) {
      var p = pedido.pedidos[i];
      resultados.push({role: 'tool', tool_call_id: p.id, content: String(await executarFerramenta(p, acoes))});
    }
    return rodar(mensagens.concat(pedido.anexar, resultados), rodadaN + 1, contexto, voz, acoes, aoTexto);
  }

  async function executarFerramenta(p, acoes) {
    var P = PONTE();
    if (!est.ferramentas) est.ferramentas = criarFerramentas(P);
    var f = est.ferramentas[p.nome];
    if (!f) return 'Ferramenta indisponível: ' + p.nome;
    var args = p.args || {};
    est.emAndamento && (est.emAndamento.status = p.escreve ? 'Aguardando a sua confirmação…' : 'Consultando o painel…'); desenharCorpo();
    if (p.escreve) {
      // A regra de ouro: quem escreve só roda depois do clique.
      var d = descreverAcao(p.nome, args, P);
      var decisao = await pedirConfirmacao(d, args);
      if (!decisao.confirmou) { registrarAcao(p.nome, args, 'cancelada', ''); acoes.push({nome: p.nome, status: 'cancelada'}); return 'A pessoa CANCELOU esta ação. Nada foi gravado. Aceite e siga.'; }
      args = decisao.args;
      try {
        var r = await f(args);
        registrarAcao(p.nome, args, 'feita', String(r).slice(0, 300));
        acoes.push({nome: p.nome, status: 'feita'});
        if (P.mascote) P.mascote.reagir('comemorar');
        return r;
      } catch (e) {
        registrarAcao(p.nome, args, 'falhou', String(e && e.message || e).slice(0, 300));
        acoes.push({nome: p.nome, status: 'falhou'});
        return 'Deu erro ao executar: ' + (e && e.message || e) + '. Nada foi concluído.';
      }
    }
    try { return await f(args); } catch (e) { return 'Não consegui consultar: ' + (e && e.message || e); }
  }
  function registrarAcao(nome, args, status, resultado) {
    var P = PONTE();
    try { P.fb.empurrar('joaninha_acoes', {em: agoraIso(), quem: nomeDeQuem(), uid: P.uid(), conversa: est.conversaId || null, ferramenta: nome, args: JSON.parse(JSON.stringify(args || {})), status: status, resultado: resultado}).catch(function () {}); } catch (e) { /* o registro não pode derrubar a ação */ }
  }

  function pedirConfirmacao(d, args) {
    return new Promise(function (resolve) {
      var no = el('div', 'jc-confirma');
      no.setAttribute('role', 'group'); no.setAttribute('aria-label', 'Confirmar ação');
      no.innerHTML = '<h4>' + esc(d.titulo) + '</h4>' +
        (d.editavel ? '<textarea aria-label="Texto da ação (pode corrigir)">' + esc(d.detalhe || '') + '</textarea>' : '<div style="font-size:13px">' + esc(d.detalhe || '') + '</div>') +
        (d.aviso ? '<p class="jc-aviso">' + esc(d.aviso) + '</p>' : '') +
        '<div class="jc-confirma-bt"><button type="button" class="jc-ok">' + esc(d.botao || 'Confirmar') + '</button><button type="button" class="jc-no">Cancelar</button></div>';
      function fim(confirmou) {
        var novo = Object.assign({}, args);
        var ta = no.querySelector('textarea');
        if (confirmou && d.editavel && ta) novo[d.editavel] = ta.value.trim() || args[d.editavel];
        no.classList.add('jc-resolvida');
        no.querySelector('.jc-confirma-bt').innerHTML = '<span style="font-size:12px;color:#B4718A">' + (confirmou ? 'Confirmado' : 'Cancelado') + '</span>';
        if (ta) ta.disabled = true;
        est.aguardandoConfirmacao = null;
        resolve({confirmou: confirmou, args: novo});
      }
      no.querySelector('.jc-ok').addEventListener('click', function () { fim(true); });
      no.querySelector('.jc-no').addEventListener('click', function () { fim(false); });
      est.aguardandoConfirmacao = {no: no};
      desenharCorpo();
      var t = no.querySelector('textarea'); if (t) t.focus(); else no.querySelector('.jc-ok').focus();
      var c = $('#jc-corpo'); if (c) c.scrollTop = c.scrollHeight;
    });
  }

  /* ── voz ──
   * Entrada: o reconhecimento do próprio navegador (pt-BR, sem custo). Saída: a voz do navegador.
   * "Conversar por voz" fecha o ciclo: ela ouve, responde (curto, sem formatação, falado) e volta a ouvir. */
  function SR() { return global.SpeechRecognition || global.webkitSpeechRecognition; }
  function criarReconhecimento(aoFinal, aoFim, aoParcial) {
    var S = SR(); if (!S) return null;
    var r = new S(); r.lang = 'pt-BR'; r.continuous = false; r.interimResults = true;
    r.onresult = function (e) {
      var final = '', parcial = '';
      for (var i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) final += e.results[i][0].transcript; else parcial += e.results[i][0].transcript; }
      if (parcial && aoParcial) aoParcial(parcial);
      if (final.trim()) aoFinal(final.trim());
    };
    r.onend = aoFim;
    r.onerror = function (e) {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { mostrarErro('O navegador bloqueou o microfone. Clique no cadeado ao lado do endereço do site, permita o microfone e tente de novo.'); pararVoz(); }
      else if (e.error === 'audio-capture') { mostrarErro('Não captei som do microfone. Confira se ele está ligado e liberado para o navegador.'); pararVoz(); }
      /* "no-speech" e "aborted" são normais: o ciclo só recomeça */
    };
    return r;
  }
  function alternarDitado() {
    if (est.voz.ditando) { try { est.voz.reconhecimento.stop(); } catch (e) { /* já parou */ } return; }
    if (!SR()) { mostrarErro('Este navegador não tem reconhecimento de voz (use o Chrome ou o Safari). Pode digitar normalmente.'); return; }
    var ta = $('#jc-texto'), base = ta.value;
    est.voz.reconhecimento = criarReconhecimento(function (t) { ta.value = (base + ' ' + t).trim(); base = ta.value; }, function () { est.voz.ditando = false; $('#jc-ditar').classList.remove('ativo'); }, function (p) { ta.value = (base + ' ' + p).trim(); });
    est.voz.ditando = true; $('#jc-ditar').classList.add('ativo');
    try { est.voz.reconhecimento.start(); } catch (e) { est.voz.ditando = false; $('#jc-ditar').classList.remove('ativo'); }
  }
  function alternarConversaPorVoz() {
    if (est.voz.ativa) { pararVoz(); return; }
    if (!SR()) { mostrarErro('Este navegador não tem reconhecimento de voz (use o Chrome ou o Safari). Pode digitar normalmente.'); return; }
    if (est.voz.ditando) { try { est.voz.reconhecimento.stop(); } catch (e) { /* já parou */ } }
    est.voz.ativa = true; $('#jc-voz').classList.add('ativo'); $('#jc-voz-estado').classList.add('on');
    if (est.voz.muda) { est.voz.muda = false; $('#jc-muda').classList.remove('ativo'); $('#jc-muda').innerHTML = '<i class="ti ti-volume"></i>'; }
    ouvir();
  }
  function ouvir() {
    if (!est.voz.ativa || est.gerando || est.voz.falando || est.voz.ouvindo) return;
    var tx = $('#jc-voz-texto'); if (tx) tx.textContent = 'Ouvindo… pode falar';
    est.voz.reconhecimento = criarReconhecimento(
      function (texto) { est.voz.ouvindo = false; if (tx) tx.textContent = 'Pensando…'; enviar(texto, {voz: true}); },
      function () { est.voz.ouvindo = false; if (est.voz.ativa && !est.gerando && !est.voz.falando) setTimeout(ouvir, 350); },
      function (p) { if (tx) tx.textContent = '“' + cortar(p, 60) + '”'; });
    if (!est.voz.reconhecimento) return;
    est.voz.ouvindo = true;
    try { est.voz.reconhecimento.start(); } catch (e) { est.voz.ouvindo = false; }
  }
  function pararVoz() {
    est.voz.ativa = false;
    if (est.voz.reconhecimento) { try { est.voz.reconhecimento.abort(); } catch (e) { /* já parou */ } }
    est.voz.ouvindo = false; est.voz.ditando = false; calar();
    if (est.raiz) { var v = $('#jc-voz'), vs = $('#jc-voz-estado'), d = $('#jc-ditar'); if (v) v.classList.remove('ativo'); if (vs) vs.classList.remove('on'); if (d) d.classList.remove('ativo'); }
  }
  function calar() { est.voz.falando = false; try { if (global.speechSynthesis) global.speechSynthesis.cancel(); } catch (e) { /* sem voz */ } }
  function escolherVoz() {
    var vozes = (global.speechSynthesis && global.speechSynthesis.getVoices()) || [];
    return vozes.filter(function (v) { return /pt[-_]BR/i.test(v.lang); }).sort(function (a, b) { return (/google|natural|neural/i.test(b.name) ? 1 : 0) - (/google|natural|neural/i.test(a.name) ? 1 : 0); })[0] || vozes.filter(function (v) { return /^pt/i.test(v.lang); })[0] || null;
  }
  function falar(texto) {
    return new Promise(function (resolve) {
      if (est.voz.muda || !global.speechSynthesis || !global.SpeechSynthesisUtterance) { resolve(); return; }
      var limpo = limparParaFala(texto); if (!limpo) { resolve(); return; }
      var u = new global.SpeechSynthesisUtterance(limpo.slice(0, 1200)); u.lang = 'pt-BR'; u.rate = 1.03;
      var v = escolherVoz(); if (v) u.voice = v;
      var tx = $('#jc-voz-texto'); if (tx && est.voz.ativa) tx.textContent = 'Falando…';
      est.voz.falando = true;
      var fim = function () { est.voz.falando = false; resolve(); if (est.voz.ativa) setTimeout(ouvir, 300); };
      u.onend = fim; u.onerror = fim;
      try { global.speechSynthesis.cancel(); global.speechSynthesis.speak(u); } catch (e) { fim(); }
    });
  }

  global.JOANINHA_CHAT = {ativo: ativo, abrir: abrir, fechar: fechar, alternar: alternar, estado: est, enviar: enviar};
})(typeof window !== 'undefined' ? window : globalThis);
