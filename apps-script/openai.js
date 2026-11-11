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
    model: modelo || 'gpt-4.1',
    store: false,
    max_output_tokens: opcoes.max_tokens || 4000,
    input: opcoes.messages.map(function(m) {
      return {role: m.role, content: typeof m.content === 'string' ? m.content : m.content.map(parte)};
    })
  };
  if (opcoes.system) payload.instructions = opcoes.system;
  if (opcoes.stream) payload.stream = true;
  if (opcoes.tools && opcoes.tools.length) {
    payload.tools = [{type: 'web_search'}];
    payload.max_tool_calls = 6;
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

// Executado somente no Google Apps Script. A chave fica nas propriedades.
function chamarOpenAI(opcoes) {
  var props = PropertiesService.getScriptProperties();
  var chave = props.getProperty('OPENAI_API_KEY');
  if (!chave) throw new Error('OPENAI_API_KEY não configurada nas propriedades do script.');
  var resposta = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
    method: 'post', contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + chave},
    payload: JSON.stringify(openaiPayload(opcoes, props.getProperty('OPENAI_MODEL'))),
    muteHttpExceptions: true
  });
  var codigo = resposta.getResponseCode();
  if (codigo < 200 || codigo >= 300) throw new Error('A OpenAI não respondeu (HTTP ' + codigo + '). Confira a chave, os créditos e o modelo.');
  var data;
  try {data = JSON.parse(resposta.getContentText());} catch (_) {throw new Error('Resposta inválida da OpenAI.');}
  return openaiResultado(data);
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

if (typeof module !== 'undefined' && module.exports) module.exports = {openaiPayload: openaiPayload, openaiResultado: openaiResultado};
