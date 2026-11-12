// Protocolo compartilhado pela Vercel e pelo Apps Script. Adicione este arquivo
// como "openai" no MESMO projeto do cartorio-drive-api e cartorio-rede.
function openaiPayload(opcoes, modelo) {
  function parte(b) {
    if (b.type === 'text') return {type: 'input_text', text: b.text};
    var s = b.source || {};
    if (s.type !== 'base64') throw new Error('Formato de arquivo não suportado pela IA.');
    var url = 'data:' + s.media_type + ';base64,' + s.data;
    if (b.type === 'image' || (b.type === 'document' && /^image\//.test(s.media_type))) {
      return {type: 'input_image', image_url: url, detail: 'auto'};
    }
    if (b.type === 'document' && s.media_type === 'application/pdf') {
      return {type: 'input_file', filename: 'documento.pdf', file_data: url};
    }
    throw new Error('Tipo de documento não suportado pela IA.');
  }
  var payload = {
    model: modelo || 'gpt-6-luna',
    store: false,
    max_output_tokens: opcoes.max_tokens || 4000,
    input: opcoes.messages.map(function(m) {
      return {role: m.role, content: typeof m.content === 'string' ? m.content : m.content.map(parte)};
    })
  };
  if (opcoes.system) payload.instructions = opcoes.system;
  if (opcoes.stream) payload.stream = true;
  if (opcoes.json) payload.text = {format: {type: 'json_object'}};
  // Luna usa raciocínio médio por padrão. Estas rotas têm limites curtos de
  // saída herdados do painel: reservar a saída para texto evita consumi-la
  // inteira em raciocínio e devolver uma resposta vazia (inclusive no teste OK).
  if (/^gpt-6-luna(?:-|$)/.test(payload.model)) payload.reasoning = {effort: 'none'};
  if (opcoes.tools && opcoes.tools.length) {
    var pesquisa = {type: 'web_search'};
    var ferramenta = opcoes.tools[0] || {};
    if(ferramenta.filters) pesquisa.filters = ferramenta.filters;
    if(ferramenta.user_location) pesquisa.user_location = ferramenta.user_location;
    payload.tools = [pesquisa];
    if(opcoes.pesquisarSempre) payload.tool_choice = 'required';
    payload.max_tool_calls = Number.isInteger(opcoes.max_tool_calls) ? Math.max(1,Math.min(6,opcoes.max_tool_calls)) : 6;
    payload.include = ['web_search_call.action.sources'];
  }
  return payload;
}

function openaiResultado(data) {
  if (data.error || data.status === 'failed' || data.status === 'cancelled') {
    throw new Error('A OpenAI não concluiu a resposta. Tente novamente.');
  }
  var textos = [], urls = [], recusa = false;
  (data.output || []).forEach(function(item) {
    if (item.type === 'web_search_call' && item.action) {
      (item.action.sources || []).forEach(function(s) {if (s.url) urls.push(s.url);});
    }
    (item.content || []).forEach(function(b) {
      if (b.type === 'output_text') textos.push(b.text);
      if (b.type === 'refusal') recusa = true;
      (b.annotations || []).forEach(function(a) {if (a.type === 'url_citation' && a.url) urls.push(a.url);});
    });
  });
  var truncou = data.status === 'incomplete' && data.incomplete_details && data.incomplete_details.reason === 'max_output_tokens';
  if (data.status === 'incomplete' && !truncou) throw new Error('A OpenAI interrompeu a resposta.');
  return {texto: textos.join(''), truncou: !!truncou, recusa: recusa, urls: urls.filter(function(u, i) {return urls.indexOf(u) === i;})};
}

// Só preserva categoria e contagens do limite. Nunca exibe o erro bruto,
// que pode conter identificadores da conta e outros detalhes privados.
function openaiLimite(erro) {
  erro = erro || {};
  var codigo = erro.code || erro.type || '', bruto = String(erro.message || '');
  if (/^(insufficient_quota|billing_hard_limit_reached|billing_not_active)$/.test(codigo)) return {tipo:'cota',repetir:false,mensagem:'A conta da OpenAI está sem cota disponível. Confira o faturamento e os créditos.'};
  if (codigo !== 'rate_limit_exceeded') return {tipo:'desconhecido',repetir:false,mensagem:'A OpenAI limitou esta chamada (429), mas não detalhou o tipo de limite. Confira os limites da conta antes de tentar novamente.'};
  var unidade = /\b(TPM|TPD|RPM|RPD)\b/i.exec(bruto);
  unidade = unidade ? unidade[1].toUpperCase() : /tokens per day/i.test(bruto) ? 'TPD' : /requests per day/i.test(bruto) ? 'RPD' : /tokens per min/i.test(bruto) ? 'TPM' : /requests per min/i.test(bruto) ? 'RPM' : '';
  var numeros = [], valores = {};
  [['Limit','Limite'],['Used','Utilizado'],['Requested','Solicitado']].forEach(function(campo) {
    var m = new RegExp('\\b'+campo[0]+'\\s*:?\\s*([0-9][0-9,.]{0,24})(?![0-9,.])','i').exec(bruto);
    if(m){var numero=m[1].replace(/[.,]+$/,'');numeros.push(campo[1]+': '+numero);valores[campo[0]]=Number(numero.replace(/,/g,''));}
  });
  var detalhe = numeros.length ? ' '+numeros.join('; ')+'.' : '';
  if (/request too large|requested.*exceeds/i.test(bruto) || (valores.Requested>valores.Limit)) return {tipo:'volume',repetir:false,mensagem:'O volume de dados desta solicitação ultrapassa o limite permitido pela conta OpenAI.'+detalhe+' A minuta não foi reduzida. Repetir o mesmo pedido não resolve; é necessário rever os limites da conta.'};
  if(unidade==='RPD'||unidade==='TPD'||/per day/i.test(bruto)) return {tipo:'diario',repetir:false,mensagem:'A OpenAI atingiu o limite diário de '+(unidade==='TPD'?'tokens':'solicitações')+(unidade?' ('+unidade+')':'')+'.'+detalhe+' Aguardar um minuto não resolve: é preciso esperar a renovação desse limite ou rever o nível da conta.'};
  return {tipo:'temporario',repetir:true,mensagem:'A OpenAI atingiu um limite temporário de uso'+(unidade?' ('+unidade+')':'')+'.'+detalhe+' Aguarde antes de tentar novamente. Se persistir, confira os limites do modelo na conta.'};
}

// Executado somente no Google Apps Script. A chave fica nas propriedades.
function chamarOpenAI(opcoes) {
  var props = PropertiesService.getScriptProperties();
  var chave = props.getProperty('OPENAI_API_KEY');
  if (!chave) throw new Error('OPENAI_API_KEY não configurada nas propriedades do script.');
  var pedido = {
    method: 'post', contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + chave},
    payload: JSON.stringify(openaiPayload(opcoes, props.getProperty('OPENAI_MODEL'))),
    muteHttpExceptions: true
  };
  for (var tentativa = 0; tentativa < 3; tentativa++) {
    var resposta = UrlFetchApp.fetch('https://api.openai.com/v1/responses', pedido);
    var codigo = resposta.getResponseCode(), data;
    try {data = JSON.parse(resposta.getContentText());} catch (_) {
      throw new Error('A OpenAI não respondeu em formato reconhecível (HTTP ' + codigo + ').');
    }
    if (codigo >= 200 && codigo < 300) return openaiResultado(data);
    var erro = data.error || {}, limite = codigo === 429 ? openaiLimite(erro) : null;
    var temporario = limite && limite.repetir;
    if (temporario && tentativa < 2) {
      var headers = resposta.getAllHeaders ? resposta.getAllHeaders() : {};
      var segundos = Number(headers['Retry-After'] || headers['retry-after']) || 60;
      Utilities.sleep(Math.max(1, Math.min(60, Math.ceil(segundos))) * 1000);
      continue;
    }
    if (codigo === 429) {
      throw new Error(limite.mensagem);
    }
    throw new Error('A OpenAI não respondeu (HTTP ' + codigo + '). Confira a chave, os créditos e o modelo.');
  }
}

// Teste manual sem dados de clientes e sem escrita no Drive ou no Firebase.
function testarConexaoOpenAI() {
  var resultado = chamarOpenAI({
    max_tokens: 32,
    messages: [{role: 'user', content: 'Responda somente com a palavra OK.'}]
  });
  if (resultado.recusa || resultado.truncou || resultado.texto.trim() !== 'OK') {
    throw new Error('A conexão respondeu, mas o teste não retornou OK.');
  }
  Logger.log('Conexão com a OpenAI confirmada. Nenhum dado do painel foi alterado.');
}

if (typeof module !== 'undefined' && module.exports) module.exports = {openaiPayload: openaiPayload, openaiResultado: openaiResultado, openaiLimite: openaiLimite};
