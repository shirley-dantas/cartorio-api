// Contrato compartilhado: o modelo propõe ações; o painel valida novamente
// contra os cards atuais antes de apresentar o plano e executá-lo.
(function(root) {
  const TIPOS = ['consultar_caso','ler_documento','anotar_caso','alterar_caso','criar_tarefa','alterar_tarefa','preparar_orcamento','gerar_minuta','agendar_assinatura'];
  const LEITURAS = ['consultar_caso','ler_documento'];
  const CAMPOS = ['nome','tipo','status','resp','prazo','dep','acao','modalidade'];
  const PROIBIDAS = ['__proto__','constructor','prototype'];
  function texto(v, max, nome) {
    if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Error((nome || 'Texto')+' ausente ou grande demais.');
    return v.trim();
  }
  function objeto(v) {return !!v && typeof v === 'object' && !Array.isArray(v);}
  function seguro(v, profundidade=0) {
    if(profundidade>8) throw new Error('Dados muito aninhados.');
    if(v===null || typeof v==='boolean') return v;
    if(typeof v==='string') {if(v.length>60000) throw new Error('Texto grande demais.');return v;}
    if(typeof v==='number') {if(!Number.isFinite(v)) throw new Error('Número inválido.');return v;}
    if(Array.isArray(v)) {if(v.length>100)throw new Error('Lista grande demais.');return v.map(x=>seguro(x,profundidade+1));}
    if(!objeto(v)) throw new Error('Dados inválidos.');
    const r={};
    for(const k of Object.keys(v)) {
      if(PROIBIDAS.includes(k) || /[\/.#$\[\]]/.test(k)) throw new Error('Nome de campo inválido.');
      r[k]=seguro(v[k],profundidade+1);
    }
    return r;
  }
  function id(v) {if(typeof v!=='string'||!/^[-_a-zA-Z0-9]{1,180}$/.test(v))throw new Error('Identificador inválido.');return v;}
  function horario(v) {
    const dataHora=texto(v,16,'Data e hora da assinatura');
    const m=/^(20\d{2}|21\d{2})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(dataHora);
    if(!m)throw new Error('Informe data e horário completos para a assinatura.');
    const dt=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
    if(dt.getUTCFullYear()!==+m[1]||dt.getUTCMonth()!==+m[2]-1||dt.getUTCDate()!==+m[3])throw new Error('Data de assinatura inválida.');
    return dataHora;
  }
  function dinheiro(v) {
    if(typeof v==='number') {if(!Number.isSafeInteger(v)||v<0)throw new Error('Informe valores em centavos inteiros.');return v;}
    if(Array.isArray(v)) return v.map(x=>({rot:typeof x.rot==='string'?x.rot.slice(0,200):'',valor:dinheiro(x.valor)}));
    throw new Error('Valor monetário inválido.');
  }
  function acao(a, casosIds) {
    if(!objeto(a)||!TIPOS.includes(a.tipo))throw new Error('Ação não disponível nesta versão.');
    const casoId=id(a.casoId);
    if(!casosIds.includes(casoId))throw new Error('O card indicado não está disponível.');
    const d=seguro(a.dados || {});let dados={};
    if(!objeto(d))throw new Error('Os dados da ação precisam ser um objeto.');
    if(a.tipo==='ler_documento') {
      dados={documentoId:id(d.documentoId),inicio:d.inicio||0};
      if(!Number.isSafeInteger(dados.inicio)||dados.inicio<0)throw new Error('Trecho do documento inválido.');
    }
    if(a.tipo==='anotar_caso'||a.tipo==='criar_tarefa')dados={texto:texto(d.texto,20000)};
    if(a.tipo==='alterar_tarefa') {
      dados={tarefaId:id(d.tarefaId)};
      if(d.texto!==undefined)dados.texto=texto(d.texto,20000);
      if(d.feito!==undefined){if(typeof d.feito!=='boolean')throw new Error('Situação da tarefa inválida.');dados.feito=d.feito;}
      if(Object.keys(dados).length===1)throw new Error('Indique o que alterar na tarefa.');
    }
    if(a.tipo==='alterar_caso') {
      if(!objeto(d.campos)||!Object.keys(d.campos).length)throw new Error('Indique o campo a alterar.');
      const campos={};
      for(const k of Object.keys(d.campos)) {
        if(!CAMPOS.includes(k))throw new Error('Este campo exige o fluxo próprio do painel: '+k);
        if(typeof d.campos[k]!=='string'||d.campos[k].length>2000)throw new Error('Valor do campo inválido.');
        campos[k]=d.campos[k];
      }
      if(campos.status!==undefined&&!['prioridade','critico','atencao','emdia'].includes(campos.status))throw new Error('Status inválido.');
      if(campos.modalidade!==undefined&&!['digital','presencial','hibrida'].includes(campos.modalidade))throw new Error('Modalidade inválida.');
      if(campos.resp!==undefined&&!['shirley','grazi','ambas','gabriel'].includes(campos.resp))throw new Error('Responsável inválido.');
      dados={campos};
    }
    if(a.tipo==='agendar_assinatura') {
      dados={dataHora:horario(d.dataHora),descricao:typeof d.descricao==='string'?d.descricao.slice(0,1000):''};
      if(d.anterior!==undefined)dados.anterior=d.anterior===''?'':horario(d.anterior);
    }
    if(a.tipo==='preparar_orcamento') {
      dados={atoId:texto(d.atoId,100,'Tipo de ato'),valores:{}};
      for(const k of Object.keys(d.valores||{}))dados.valores[k]=dinheiro(d.valores[k]);
      for(const k of ['praticadoEm','imovelMunicipio','imovelUf','identificacao']) if(d[k]!==undefined)dados[k]=texto(d[k],300,k);
      if(d.flags!==undefined) {if(!objeto(d.flags))throw new Error('Condições do orçamento inválidas.');dados.flags=d.flags;}
      if(d.despesas!==undefined) {if(!objeto(d.despesas))throw new Error('Despesas inválidas.');dados.despesas=d.despesas;}
    }
    if(a.tipo==='gerar_minuta') {
      dados={instrucao:typeof d.instrucao==='string'?d.instrucao:'',modo:d.modo==='revisar'?'revisar':'gerar'};
      if(d.modalidade!==undefined) {
        if(!['digital','presencial','hibrida'].includes(d.modalidade))throw new Error('Escolha a modalidade da escritura.');
        dados.modalidade=d.modalidade;
      }
    }
    return {tipo:a.tipo,casoId,descricao:texto(a.descricao||a.tipo.replace(/_/g,' '),500),dados};
  }
  function plano(p, casosIds) {
    if(!objeto(p))throw new Error('A IA não devolveu um plano reconhecível.');
    const resposta=typeof p.resposta==='string'?p.resposta.trim():'';
    if(resposta.length>30000)throw new Error('Resposta grande demais.');
    const lista=p.acoes===undefined?[]:p.acoes;
    if(!Array.isArray(lista)||lista.length>6)throw new Error('O plano tem ações demais. Divida o pedido.');
    const acoes=lista.map(a=>acao(a,casosIds));
    if(!resposta&&!acoes.length)throw new Error('A IA não retornou resposta.');
    return {resposta,acoes};
  }
  const api={TIPOS,LEITURAS,CAMPOS,plano,acao,id};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.JoaninhaProtocolo=api;
})(typeof window!=='undefined'?window:globalThis);
