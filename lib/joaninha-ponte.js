// Adaptador das ações da conversa para os fluxos já existentes do painel.
// Não calcula custas com IA, não envia mensagens e não exclui registros.
export function criarPonteJoaninha(e) {
  const acompanhando=new Map(), ouvintes=new Set();
  const agendar=e.agendar||setTimeout;
  const chaveValida=v=>typeof v==='string'&&/^[-_a-zA-Z0-9]{1,180}$/.test(v);
  const emitir=evento=>ouvintes.forEach(f=>f(evento));
  const caso=id=>{if(!chaveValida(id)||!e.casos()[id])throw new Error('Este card não está disponível.');return e.casos()[id];};
  const ler=async caminho=>(await e.get(e.ref(e.db,caminho))).val();
  const gravar=patch=>e.update(e.ref(e.db),patch);
  const agora=()=>new Date().toISOString();
  const autor=()=>e.usuario()||'Equipe';
  const idNovo=()=>crypto.randomUUID();
  const acessoOrc=()=>!!e.acessoOrcamentos();
  function publico(r) {
    const p={};for(const k of ['status','mensagem','tipo','casoId','orcamentoId','jobId','docUrl','folderUrl','docNome','truncada','avisos','tarefaId'])if(r[k]!==undefined)p[k]=r[k];
    return p;
  }
  async function finalizar(op,r,patch={}) {
    patch[`casos/${op.casoId}/joaninhaOperacoes/${op.id}`]={id:op.id,tipo:op.tipo,casoId:op.casoId,status:'concluida',autor:op.autor,criadoEm:op.criadoEm,concluidoEm:agora(),resultado:publico(r)};
    await gravar(patch);return r;
  }
  async function reservar(a,id) {
    if(!chaveValida(id))throw new Error('Identificação da execução inválida.');
    caso(a.casoId);
    const op={id,casoId:a.casoId,tipo:a.tipo,autor:autor(),criadoEm:agora(),status:'reservada'};
    const tx=await e.runTransaction(e.ref(e.db,`casos/${a.casoId}/joaninhaOperacoes/${id}`),atual=>atual?undefined:op,{applyLocally:false});
    if(tx.committed)return {op};
    const existente=tx.snapshot.val();
    return {existente};
  }
  async function consultar(id) {
    caso(id);const c=await ler('casos/'+id);
    if(!c)throw new Error('O card foi removido.');
    const documentos=Object.entries(c.documentos||{}).map(([id,d])=>({id,nome:d.nome||'',tipo:d.tipo||'',tipoDocumento:d.tipoDocumento||'',pessoa:d.pessoa||'',lido:!!d.texto,truncado:!!d.truncado,caracteres:String(d.texto||'').length}));
    const r={status:'consultado',casoId:id,nome:c.nome,tipo:c.tipo,statusCaso:c.status,resp:c.resp,prazo:c.prazo,dep:c.dep,acao:c.acao,agendado:c.agendado||'',agendado_desc:c.agendado_desc||'',modalidade:c.modalidade||'',observacoes:String(c.obs||'').slice(0,24000),observacoesParciais:String(c.obs||'').length>24000,questionario:c.questionario||{},documentos,tarefas:Object.entries(c.tarefasJoaninha||{}).map(([id,t])=>({id,...t})),minutaAtual:c.docUrl||'',auditoria:c.auditoria||null};
    r.acessoOrcamentos=acessoOrc();
    if(r.acessoOrcamentos){
      const anteriores=await orcamentos(id);r.orcamentos=anteriores.map(o=>({id:o.id,versao:o.versao,entrada:o.entrada,definitivo:o.definitivo,totais:o.resultado?.totais,alertas:o.resultado?.alertas}));
    }else r.orcamentos='Entre no Financeiro para calcular, consultar e salvar orçamentos. Orçamento anterior é opcional; os dados informados na conversa podem ser usados no primeiro orçamento.';
    return JSON.parse(JSON.stringify(r));
  }
  async function orcamentos(id) {
    if(!acessoOrc())throw new Error('Entre no Financeiro para acessar os Orçamentos.');
    const todos=await ler('orcamentos');
    return Object.entries(todos||{}).map(([id,o])=>({...o,id})).filter(o=>o.casoId===id).sort((a,b)=>(a.versao||0)-(b.versao||0));
  }
  function tarefa(texto,origem,extra={}) {return {texto,feito:false,origem,criadoEm:agora(),autor:autor(),...extra};}
  async function orcamento(a,op) {
    if(!acessoOrc())throw new Error('Entre no Financeiro para preparar e salvar orçamentos.');
    const c=caso(a.casoId), anteriores=await orcamentos(a.casoId),anterior=anteriores.at(-1),d=a.dados;
    const mesma=anterior?.entrada?.atoId===d.atoId?anterior.entrada:{};
    await e.prepararTabelas();
    const entrada={atoId:d.atoId,data:e.hoje(),praticadoEm:d.praticadoEm||anterior?.entrada?.praticadoEm||'São Paulo',imovelMunicipio:d.imovelMunicipio||anterior?.entrada?.imovelMunicipio||'',imovelUf:d.imovelUf||anterior?.entrada?.imovelUf||'',identificacao:d.identificacao||anterior?.entrada?.identificacao||'',valores:{...(mesma.valores||{}),...d.valores},flags:{...(mesma.flags||{}),...(d.flags||{})},despesas:{prenotacao:true,matricula:true,registroComMatricula:true,taxaAdicional:null,taxaAdicionalValor:null,...(mesma.despesas||{}),...(d.despesas||{})}};
    const faltas=[];
    if(!entrada.imovelMunicipio)faltas.push('Em qual município fica o imóvel?');
    if(!entrada.imovelUf)faltas.push('Em qual estado fica o imóvel?');
    const r=e.calcularOrcamento(entrada);
    if(r.erro)throw new Error(r.erro);
    faltas.push(...(r.faltando||[]).map(f=>f.pergunta||f.rot));
    if(faltas.length)return finalizar(op,{status:'precisa_dados',casoId:a.casoId,mensagem:'Faltam dados para concluir o orçamento.',faltando:faltas,entrada});
    const referencia=e.push(e.ref(e.db,'orcamentos'));
    const id=referencia.key,versao=(anteriores.at(-1)?.versao||0)+1;
    const dados={id,casoId:a.casoId,casoNome:c.nome||'',data:entrada.data,status:'elaboracao',obs:'Preparado pela Joaninha a pedido de '+autor(),responsavel:autor(),entrada,resultado:r,definitivo:!!r.definitivo,tabelaVersao:r.tabelas?.notas?.versao||'',versao,veioDe:anterior?.id||null,criadoEm:agora(),atualizadoEm:agora()};
    // O recibo público do card não contém valores: os orçamentos são protegidos.
    const tid=idNovo(),revisao=idNovo();
    await finalizar(op,{status:'orcamento_salvo',tipo:'orcamento',casoId:a.casoId,orcamentoId:id,mensagem:'Orçamento versão '+versao+' salvo.'},{['orcamentos/'+id]:e.semUndefined(dados),[`casos/${a.casoId}/tarefasJoaninha/${revisao}`]:tarefa(r.definitivo?'Revisar a via do cliente':'Conferir as ressalvas do orçamento antes de enviar','orcamento_revisao',{orcamentoId:id}),[`casos/${a.casoId}/tarefasJoaninha/${tid}`]:tarefa('Enviar orçamento e acompanhar aprovação','orcamento',{orcamentoId:id,concluirQuando:'orcamento_aprovado'})});
    let imagem=null;
    try{imagem=e.desenharOrcamento({...entrada,casoNome:c.nome},r,null).toDataURL('image/png');}catch(_){/* A versão salva continua acessível pelo fluxo original. */}
    return {status:'orcamento_salvo',tipo:'orcamento',casoId:a.casoId,orcamentoId:id,versao,definitivo:!!r.definitivo,totais:r.totais,alertas:r.alertas||[],imagem,sensivel:true,mensagem:'Orçamento salvo. '+(r.definitivo?'Pronto para a sua revisão.':'É uma estimativa com ressalvas; confira antes de enviar.')};
  }
  async function minuta(a,op) {
    const c=await ler('casos/'+a.casoId);if(!c)throw new Error('O card foi removido.');
    const modalidade=a.dados.modalidade||c.modalidade;
    if(!['digital','presencial','hibrida'].includes(modalidade))return finalizar(op,{status:'precisa_dados',casoId:a.casoId,mensagem:'Escolha a modalidade: digital, presencial ou híbrida.'});
    if(a.dados.modo==='revisar'&&!c.docUrl)return finalizar(op,{status:'precisa_dados',casoId:a.casoId,mensagem:'Este card ainda não tem uma minuta atual para revisar.'});
    const blocos=[],falhas=[];
    if(c.obs)blocos.push('=== INFORMAÇÕES DO CASO ===\n'+c.obs);
    if(c.questionario&&Object.keys(c.questionario).length)blocos.push('=== RESPOSTAS DA EQUIPE ===\n'+Object.entries(c.questionario).map(([k,v])=>k+': '+v).join('\n'));
    for(const d of Object.values(c.documentos||{})){
      if(d.texto)blocos.push((d.tipo==='modelo'?'=== MODELO DE MINUTA (REFERÊNCIA FORNECIDA PELA EQUIPE) — ':'=== DOCUMENTO: ')+(d.nome||'Documento')+' ===\n'+d.texto);
      else falhas.push((d.nome||'Documento')+': sem leitura');
      if(d.truncado)falhas.push((d.nome||'Documento')+': leitura incompleta');
    }
    if(falhas.length&&!await e.confirmar('Há documentos sem leitura completa:\n\n'+falhas.join('\n')+'\n\nGerar mesmo assim, com esses avisos?'))return finalizar(op,{status:'cancelada',casoId:a.casoId,mensagem:'Geração cancelada. Nenhum documento foi criado.'});
    if(!blocos.length)return finalizar(op,{status:'precisa_dados',casoId:a.casoId,mensagem:'Inclua documentos ou informações no card antes de gerar a minuta.'});
    const jobId='joaninha-'+op.id,tid=idNovo();
    const aguardando={...op,status:'aguardando',jobId,tarefaId:tid};
    await gravar({[`casos/${a.casoId}/joaninhaOperacoes/${op.id}`]:aguardando,[`casos/${a.casoId}/tarefasJoaninha/${tid}`]:tarefa('Aguardar a geração da minuta','minuta',{jobId})});
    const response=await e.fetch('/api/iniciar-minuta',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({solicitacaoId:op.id,casoId:a.casoId,nome:c.nome,tipo:c.tipo,obs:c.obs||'',documentos:blocos.join('\n\n'),instrucao:a.dados.instrucao||'',modalidade,avisosDocumentos:falhas.join('; '),atosSecundarios:c.atosSecundarios||[],minutaAtualUrl:a.dados.modo==='revisar'?c.docUrl:''})});
    const j=await response.json();
    if(!response.ok||!j.ok||j.jobId!==jobId) {
      if(j.erro)throw Object.assign(new Error(j.erro),{naoIniciado:response.status===400});
      throw new Error('Não consegui confirmar o início da geração. Consulte o acompanhamento antes de repetir.');
    }
    acompanhar(aguardando);
    return {status:'aguardando',tipo:'minuta',casoId:a.casoId,jobId,mensagem:'Geração iniciada. Vou acompanhar e avisar quando a minuta estiver pronta.'};
  }
  function acompanhar(op) {
    if(!op.jobId||acompanhando.has(op.jobId))return;
    const controle={ativo:true};acompanhando.set(op.jobId,controle);
    const consultarJob=async()=>{
      if(!controle.ativo)return;
      try {
        const j=await ler('jobs/'+op.jobId);
        if(j?.status==='done') {
          const sucesso=!!j.ok&&!!j.docUrl;
          const temAviso=sucesso&&(j.truncada||(j.avisos||[]).length);
          const mensagem=sucesso?(j.truncada?'O documento foi gerado, mas pode estar incompleto. Confira o final e solicite continuação.':temAviso?'A minuta foi gerada com avisos. Confira antes de usar.':j.conferenciaIA==='pendente'?'A minuta foi gerada pela Anthropic. A conferência da OpenAI está pendente; acompanhe o card antes de usar.':'A minuta está pronta. Confira o documento e os avisos antes de usar.'):j.erro||'A geração não foi concluída.';
          const r={status:sucesso?(temAviso?'minuta_com_avisos':'minuta_pronta'):'falhou',tipo:'minuta',casoId:op.casoId,jobId:op.jobId,mensagem,...(sucesso?{docUrl:j.docUrl,folderUrl:j.folderUrl||'',docNome:j.docNome||'Minuta',truncada:!!j.truncada,avisos:j.avisos||[]}:{} )};
          const patch={};
          if(op.tarefaId)patch[`casos/${op.casoId}/tarefasJoaninha/${op.tarefaId}/feito`]=sucesso;
          if(op.tarefaId&&!sucesso)patch[`casos/${op.casoId}/tarefasJoaninha/${op.tarefaId}/texto`]='Conferir erro na geração da minuta';
          if(sucesso){
            patch[`casos/${op.casoId}/docUrl`]=j.docUrl;
            if(j.folderUrl)patch[`casos/${op.casoId}/driveUrl`]=j.folderUrl;
            patch[`casos/${op.casoId}/tarefasJoaninha/${op.id}-revisar`]=tarefa(j.truncada?'Conferir possível corte na minuta e pedir continuação':'Revisar a minuta gerada e os apontamentos da conferência','minuta',{docUrl:j.docUrl});
          }
          await finalizar(op,r,patch);controle.ativo=false;acompanhando.delete(op.jobId);emitir({tipo:'minuta',operacaoId:op.id,...r});return;
        }
      }catch(_){/* Interrupção de rede não é tratada como conclusão. */}
      if(Date.now()-new Date(op.criadoEm).getTime()>20*60*1000){
        controle.ativo=false;acompanhando.delete(op.jobId);emitir({tipo:'minuta',status:'pendente',casoId:op.casoId,jobId:op.jobId,mensagem:'A geração ainda não confirmou a conclusão. O acompanhamento será retomado ao reabrir o painel.'});return;
      }
      agendar(consultarJob,4000);
    };agendar(consultarJob,1500);
  }
  async function executar(a,execucaoId) {
    const P=e.protocolo;a=P.acao(a,Object.keys(e.casos()));
    if(a.tipo==='consultar_caso')return consultar(a.casoId);
    if(a.tipo==='ler_documento'){
      const d=await ler(`casos/${a.casoId}/documentos/${a.dados.documentoId}`);
      if(!d?.texto)return {status:'sem_leitura',casoId:a.casoId,mensagem:'O documento ainda não tem texto lido.'};
      const t=String(d.texto),inicio=a.dados.inicio,fim=Math.min(t.length,inicio+12000);
      return {status:'documento_lido',casoId:a.casoId,nome:d.nome||'',texto:t.slice(inicio,fim),inicio,fim,total:t.length,parcial:fim<t.length,truncado:!!d.truncado};
    }
    const reserva=await reservar(a,execucaoId);
    if(reserva.existente){
      const v=reserva.existente;if(v.status==='aguardando')acompanhar(v);
      return v.resultado||{status:v.status,mensagem:'Esta execução já foi iniciada. Não vou repeti-la.',casoId:a.casoId};
    }
    const op=reserva.op,base='casos/'+a.casoId;
    try {
      if(a.tipo==='preparar_orcamento')return await orcamento(a,op);
      if(a.tipo==='gerar_minuta')return await minuta(a,op);
      let resultado;
      const historicoId=idNovo(),tarefaId=idNovo();
      const tx=await e.runTransaction(e.ref(e.db,base),c=>{
        if(!c)throw new Error('O card foi removido.');
        if(c.joaninhaOperacoes?.[op.id]?.status==='concluida'){
          resultado=c.joaninhaOperacoes[op.id].resultado;return;
        }
        const novo={...c};
        let r={status:'salvo',casoId:a.casoId,mensagem:'Alteração salva no card.'};
        if(a.tipo==='anotar_caso') {
          const texto=a.dados.texto;
          novo.obs=e.montarObservacao(c.obs||'','🐞 '+texto);
          novo.historico={...(c.historico||{}),[historicoId]:{data:agora(),texto,resumo:texto,pendencias:[],origem:'joaninha',autor:autor()}};
          r.mensagem='Anotação acrescentada ao card, preservando as anteriores.';
        }
        if(a.tipo==='alterar_caso') {
          const antes={},depois=a.dados.campos;
          for(const [k,v]of Object.entries(depois)){antes[k]=c[k]??null;novo[k]=v;}
          if(depois.dep!==undefined&&depois.dep!==c.dep)novo.depDesde=e.hoje();
          novo.historico={...(c.historico||{}),[historicoId]:{data:agora(),texto:'Campos alterados pela Joaninha a pedido de '+autor(),resumo:'Alteração de '+Object.keys(depois).join(', '),pendencias:[],origem:'joaninha',antes,depois,autor:autor()}};
        }
        if(a.tipo==='agendar_assinatura') {
          const d=a.dados;
          if(d.dataHora.slice(0,10)<e.hoje())throw new Error('A data proposta já passou. Confira a data completa antes de agendar.');
          if(c.agendado===d.dataHora)throw new Error('Este card já está agendado para esse horário. Nenhum novo evento foi criado.');
          if((c.agendado||'')!==(d.anterior||''))throw new Error('A assinatura do card já tem outra data. Consulte o card e confirme a troca mostrando a data anterior.');
          novo.agendado=d.dataHora;novo.agendado_desc=d.descricao||'';
          novo.historico={...(c.historico||{}),[historicoId]:{data:agora(),texto:'Assinatura agendada pela Joaninha a pedido de '+autor(),resumo:'Assinatura: '+d.dataHora,pendencias:[],origem:'joaninha',antes:{agendado:c.agendado||''},depois:{agendado:d.dataHora},autor:autor()}};
          r={status:'assinatura_salva',casoId:a.casoId,mensagem:'Assinatura salva no card para '+d.dataHora.replace('T',' às ')+'. A confirmação no Google Calendar ainda está pendente.'};
        }
        if(a.tipo==='criar_tarefa') {
          novo.tarefasJoaninha={...(c.tarefasJoaninha||{}),[tarefaId]:tarefa(a.dados.texto,'comando')};
          r={...r,tarefaId,mensagem:'Tarefa criada no caso.'};
        }
        if(a.tipo==='alterar_tarefa') {
          const t=c.tarefasJoaninha?.[a.dados.tarefaId];if(!t)throw new Error('Esta tarefa não existe mais.');
          const alterada={...t,atualizadoEm:agora()};
          for(const k of ['texto','feito'])if(a.dados[k]!==undefined)alterada[k]=a.dados[k];
          novo.tarefasJoaninha={...c.tarefasJoaninha,[a.dados.tarefaId]:alterada};r.mensagem='Tarefa atualizada.';
        }
        novo.atualizado=e.hoje();
        novo.joaninhaOperacoes={...(c.joaninhaOperacoes||{}),[op.id]:{id:op.id,tipo:op.tipo,casoId:op.casoId,status:'concluida',autor:op.autor,criadoEm:op.criadoEm,concluidoEm:agora(),resultado:publico(r)}};
        resultado=r;return novo;
      },{applyLocally:false});
      if(!tx.committed&&!resultado)throw new Error('A alteração não foi confirmada pelo banco.');
      if(a.tipo==='agendar_assinatura'&&tx.committed){
        let calendario;
        try{calendario=await e.sincronizarAssinatura(a.casoId,tx.snapshot.val());}catch(_){calendario={ok:false};}
        resultado={...resultado,status:calendario?.ok?'assinatura_agendada':'assinatura_salva',mensagem:'Assinatura salva no card para '+a.dados.dataHora.replace('T',' às ')+(calendario?.ok?'. Evento confirmado no Google Calendar.':'. Não consegui confirmar o evento no Google Calendar. Confira a agenda antes de tentar novamente.')};
        // A data já foi confirmada no banco: falha ao guardar o recibo final
        // não pode apagar o resultado real nem provocar novo envio ao Calendar.
        try{await finalizar(op,resultado);}catch(_){resultado.mensagem+=' O registro da confirmação ficou pendente.';}
      }
      return resultado;
    }catch(err){
      // Um job já enviado pode continuar no Google mesmo após falha da rede.
      const existente=await ler(base+'/joaninhaOperacoes/'+op.id).catch(()=>null);
      if(existente?.status==='aguardando'&&!err.naoIniciado){acompanhar(existente);return {status:'aguardando',casoId:a.casoId,jobId:existente.jobId,mensagem:'A confirmação de rede falhou. Estou conferindo o job antes de permitir uma nova tentativa.'};}
      const falha={[base+'/joaninhaOperacoes/'+op.id]:{...op,status:'falhou',erro:err.message}};
      if(existente?.tarefaId)falha[base+'/tarefasJoaninha/'+existente.tarefaId+'/texto']='Conferir falha no início da geração';
      await gravar(falha).catch(()=>{});throw err;
    }
  }
  let anterior=null;
  function observar(casos) {
    for(const [id,c]of Object.entries(casos||{})) {
      for(const op of Object.values(c.joaninhaOperacoes||{})){
        if(op.status==='aguardando')acompanhar(op);
        else if(op.status==='concluida'&&op.resultado?.tipo==='minuta'&&op.resultado.jobId)emitir({tipo:'minuta',operacaoId:op.id,...op.resultado});
      }
      if(anterior?.[id]) {
        const novos=Object.keys(c.documentos||{}).filter(k=>!anterior[id].documentos?.[k]);
        if(novos.length)emitir({tipo:'documentos',casoId:id,eventoId:'docs:'+id+':'+novos.sort().join(','),mensagem:`${novos.length} documento(s) recebido(s) no caso ${c.nome}. Recebimento não significa conferência concluída.`});
        if(c.auditoria?.atualizado&&c.auditoria.atualizado!==anterior[id].auditoria?.atualizado)emitir({tipo:'auditoria',casoId:id,eventoId:'auditoria:'+id+':'+c.auditoria.atualizado,mensagem:c.auditoria.status==='pendente'?'A conferência pela OpenAI está pendente. A minuta já pode ser aberta para revisão.':(c.auditoria.achados?.length?'A OpenAI concluiu a conferência com '+c.auditoria.achados.length+' apontamento(s). Confira no card.':'A OpenAI concluiu a conferência sem apontamentos automáticos. A revisão da equipe continua necessária.')});
        if(c.orcAprovacao?.em&&c.orcAprovacao.em!==anterior[id].orcAprovacao?.em){
          const tarefas=Object.entries(c.tarefasJoaninha||{}).filter(([,t])=>!t.feito&&t.origem==='orcamento'&&t.concluirQuando==='orcamento_aprovado'&&t.orcamentoId===c.orcAprovacao.orcId);
          if(tarefas.length){
            const patch={};
            for(const [tid]of tarefas){patch[`casos/${id}/tarefasJoaninha/${tid}/feito`]=true;patch[`casos/${id}/tarefasJoaninha/${tid}/concluidaPorEvento`]='orcamento_aprovado';}
            gravar(patch).then(()=>emitir({tipo:'orcamento_aprovado',casoId:id,eventoId:'orc-aprovado:'+id+':'+c.orcAprovacao.em,mensagem:'A aprovação do orçamento foi registrada. Atualizei as tarefas correspondentes da Joaninha.'})).catch(()=>emitir({tipo:'erro',casoId:id,eventoId:'orc-erro:'+id+':'+c.orcAprovacao.em,mensagem:'O orçamento foi aprovado, mas não consegui confirmar a atualização das tarefas.'}));
          }else emitir({tipo:'orcamento_aprovado',casoId:id,eventoId:'orc-aprovado:'+id+':'+c.orcAprovacao.em,mensagem:'A aprovação do orçamento foi registrada no caso.'});
        }
      }
    }
    anterior=casos;
  }
  return {executar,consultar,observar,ouvir:f=>{ouvintes.add(f);return()=>ouvintes.delete(f);},casos:e.casos,atos:e.atos,usuario:e.usuario,acessoOrcamentos:acessoOrc,abrirCaso:e.abrirCaso,abrirOrcamento:e.abrirOrcamento,abrirFerramentas:e.abrirFerramentas,chaveUsuario:e.chaveUsuario,entrar:e.entrar};
}
