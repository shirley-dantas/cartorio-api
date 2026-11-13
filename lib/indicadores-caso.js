// Indicadores derivados dos arquivos salvos e dos pedidos efetivamente enviados.
const tipos={FICHA_CADASTRAL_JUCESP:'jucesp:ficha',CONTRATO_SOCIAL:'jucesp:contrato',VALOR_VENAL_REFERENCIA:'valor',NEGATIVA_IPTU:'negativa',DADOS_CADASTRAIS_IMOVEL:'cadastrais'};
const servicos=new Set(['jucesp:ficha','jucesp:contrato','jucesp:cnpj','matricula:visualizacao','matricula:certidao','valor','negativa','cadastrais','trabalhista','cnd','indisponibilidade']);
const normal=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function servicoDocumento(d){
 if(!d||d.provisorio||d.tipo==='modelo'||d.tipo==='informacoes')return '';
 if(servicos.has(d.certidaoServico))return d.certidaoServico;
 if(tipos[d.tipoDocumento])return tipos[d.tipoDocumento];
 const nome=String(d.nomeOriginal||'');
 if(/^RIDIGITAL_ATUALIZADA_/i.test(nome))return 'matricula:certidao';
 if(/^RIDIGITAL_VISUALIZACAO_/i.test(nome))return 'matricula:visualizacao';
 return '';
}
export function pedidoCertidao(p){
 if(!p||!/^aj[a-z0-9]+$/i.test(p.id||''))return null;
 let lista=[],sujeito='';
 if(p.site==='onr'){lista=p.servico==='certidao'?['matricula:certidao']:p.servico==='visualizacao'?['matricula:visualizacao']:[];sujeito=[p.uf,p.cidade,p.cartorio,...(p.matriculas||[])].join(' ');}
 else if(p.site==='pref'){const tipo={'valor-venal':'valor','negativa-iptu':'negativa','dados-cadastrais':'cadastrais'}[p.servico];lista=tipo?[tipo]:[];sujeito=String(p.sql||'');}
 else if(!p.site&&p.cnpj){lista=(p.quero||[]).filter(s=>['ficha','contrato'].includes(s)).map(s=>'jucesp:'+s);sujeito=String(p.cnpj);}
 return lista.length?{servicos:[...new Set(lista)],sujeito,estado:'solicitada',...(p.site==='onr'?{matriculas:(p.matriculas||[]).map(String)}:{})}:null;
}
export function indicadoresCaso(c={}){
 const arquivos=Object.values(c.documentos||{}).filter(d=>d&&d.tipo!=='modelo'&&d.tipo!=='informacoes'&&!d.provisorio);
 const certificados=arquivos.filter(d=>servicoDocumento(d));
 const ultimos=new Map();
 for(const p of Object.values(c.certidoesPedidos||{})){
  if(!p||!Array.isArray(p.servicos))continue;
  for(const s of p.servicos){if(!servicos.has(s))continue;const chave=s+':'+normal(p.sujeito),anterior=ultimos.get(chave);if(!anterior||Number(p.solicitadoEm)>=Number(anterior.solicitadoEm))ultimos.set(chave,{...p,servico:s});}
 }
 const resultado={};
 for(const s of servicos){
  const salvos=certificados.filter(d=>servicoDocumento(d)===s),pedidos=[...ultimos.values()].filter(p=>p.servico===s&&p.estado!=='cancelada');
  const pendentes=pedidos.filter(p=>{
   const novos=salvos.filter(d=>Date.parse(d.salvoEm||'')>=Number(p.solicitadoEm));
   if(p.estado==='aguardandoArquivo'&&Array.isArray(p.matriculas)&&p.matriculas.length)return !p.matriculas.every(m=>/^\d+$/.test(m)&&novos.some(d=>new RegExp('(?:^|[^0-9])'+m+'(?:[^0-9]|$)').test(d.nomeOriginal||'')));
   return !novos.some(d=>{const alvo=normal(p.sujeito);return alvo&&(normal(d.certidaoSujeito)===alvo||normal(d.pessoa)===alvo||(/^\d{11,14}$/.test(alvo)&&normal([d.nomeOriginal,d.nome,d.texto].join(' ')).includes(alvo)));});
  });
  resultado[s]={salvos:salvos.length,solicitadas:pendentes.filter(p=>p.estado==='solicitada'||p.estado==='aguardandoArquivo').length,erros:pendentes.filter(p=>p.estado==='erro').length};
 }
 const somar=lista=>lista.reduce((a,b)=>({salvos:a.salvos+b.salvos,solicitadas:a.solicitadas+b.solicitadas,erros:a.erros+b.erros}),{salvos:0,solicitadas:0,erros:0});
 for(const grupo of ['jucesp','matricula'])resultado[grupo]=somar([...servicos].filter(s=>s.startsWith(grupo+':')).map(s=>resultado[s]));
 resultado.Certidões=somar([...servicos].map(s=>resultado[s]));
 resultado.Documentos={salvos:arquivos.length,solicitadas:0,erros:0};
 return resultado;
}
export function indicadorHtml(estado){
 if(!estado)return '';
 return (estado.salvos?`<span class="signature-pill-status salvo" aria-hidden="true" title="${estado.salvos} arquivo(s) disponível(is) neste caso; confira o conteúdo e a validade">✓<small>${estado.salvos}</small></span>`:'')+
 (estado.solicitadas?'<span class="signature-pill-status solicitado" aria-hidden="true" title="Pedido enviado ao Ajudante; o arquivo ainda não foi confirmado no caso">◷ <small>Solicitada</small></span>':'')+
 (estado.erros?'<span class="signature-pill-status erro" aria-hidden="true" title="Uma solicitação precisa de atenção; confira o andamento abaixo">! <small>Verificar</small></span>':'');
}

export function descricaoIndicador(e){return !e?'':[e.salvos?e.salvos+' arquivo(s) disponível(is)':'',e.solicitadas?'Solicitação enviada; aguardando arquivo no caso':'',e.erros?'Solicitação com falha; verificar andamento':''].filter(Boolean).join('. ');}
