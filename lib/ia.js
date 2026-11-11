const {openaiPayload, openaiResultado, openaiLimite} = require('../apps-script/openai.js');

function erro(mensagem, status) {
  return Object.assign(new Error(mensagem), {status});
}

async function erroHTTP(response) {
  let detalhe;
  try {detalhe = (await response.json()).error;} catch (_) { /* gateways podem retornar texto */ }
  const codigo = detalhe && (detalhe.code || detalhe.type);
  if (response.status === 400) {
    const formato = /^text\.format(?:\.|$)/.test(String(detalhe?.param || '')) || /json_object|json mode/i.test(String(detalhe?.message || ''));
    return Object.assign(erro(formato ? 'A OpenAI recusou o formato solicitado para a resposta.' : 'A OpenAI recusou os parâmetros desta solicitação (HTTP 400). Nenhuma ação foi executada. Não é uma indicação de falta de créditos.', 400), {formatoRecusado:formato});
  }
  if (response.status === 429) {
    const limite = openaiLimite(detalhe);
    const e = erro(limite.mensagem,429);
    if(limite.repetir)e.repetirApos=Math.max(1,Math.min(90,Math.ceil(Number(response.headers.get('retry-after'))||60)));
    return e;
  }
  if (response.status === 401) return erro('A OpenAI não aceitou a chave configurada. Confira a variável OPENAI_API_KEY desta versão do painel.', 401);
  if (response.status === 403) return erro('A chave OpenAI não tem permissão para esta operação ou modelo. Confira as permissões de Respostas no projeto.', 403);
  return erro(`A OpenAI não respondeu (HTTP ${response.status}). Confira a chave, os créditos e o modelo.`, response.status);
}

async function gerar(opcoes, onChunk) {
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) throw erro('A chave da IA (OPENAI_API_KEY) não está configurada.', 500);
  const payload = openaiPayload({...opcoes, stream: !!onChunk}, process.env.OPENAI_MODEL);
  const enviar = () => fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${chave}`},
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(50000)
  });
  let response = await enviar();
  if (!response.ok) {
    const falha = await erroHTTP(response);
    if (opcoes.json && response.status === 400 && falha.formatoRecusado) {
      // Alguns modelos não aceitam JSON mode. O contrato ainda é conferido
      // pelo chamador antes de qualquer execução; não repetir outros erros.
      delete payload.text;
      response = await enviar();
      if (!response.ok) throw await erroHTTP(response);
    } else throw falha;
  }
  if (!onChunk) {
    let data;
    try {data = await response.json();} catch (_) {throw erro('A IA não respondeu em formato reconhecível.', 502);}
    return openaiResultado(data);
  }
  let buffer = '', resultado;
  const decoder = new TextDecoder();
  function evento(bloco) {
    const raw = bloco.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
    if (!raw || raw === '[DONE]') return;
    let evt;
    try {evt = JSON.parse(raw);} catch (_) {throw erro('Resposta de streaming inválida da OpenAI.', 502);}
    if (evt.type === 'response.output_text.delta') onChunk(evt.delta || '');
    if (['response.completed', 'response.incomplete'].includes(evt.type)) resultado = openaiResultado(evt.response);
    if (['error', 'response.failed'].includes(evt.type)) throw erro('A OpenAI interrompeu a resposta. Tente novamente.', 502);
  }
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, {stream: true});
    buffer = buffer.replace(/\r\n/g, '\n');
    let fim;
    while ((fim = buffer.indexOf('\n\n')) !== -1) {
      evento(buffer.slice(0, fim)); buffer = buffer.slice(fim + 2);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) evento(buffer);
  if (!resultado) throw erro('A conexão com a OpenAI terminou antes de concluir a resposta.', 502);
  if (resultado.recusa || resultado.truncou) throw erro('A OpenAI não concluiu o texto. Tente novamente.', 502);
  return resultado;
}

async function texto(opcoes, onChunk) {
  const r = await gerar(opcoes, onChunk);
  if (r.recusa || r.truncou || !r.texto) throw erro('A OpenAI não concluiu o texto. Tente novamente.', 502);
  return r.texto;
}

module.exports = {gerar, texto};
