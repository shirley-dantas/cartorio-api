// A geração de minuta, na parte que dá para provar fora do Apps Script e sem
// internet.
//
// Roda com: node testes/minuta.mjs
//
// O apps-script/cartorio-drive-api.js só roda de verdade dentro do Apps
// Script — ele fala com o Drive, o Firebase e a IA. Mas as peças que decidem
// se um corte fica em silêncio ou aparece na tela não dependem de nada
// disso: parsearResposta (as pendências e a linha proibida), chaveTipo e
// abreviarTipoAto (a chave do modelo aprendido e o nome do documento),
// respostaIndicaConclusao e unirTextoMinuta (o teste do "CONCLUIDO" e a
// colagem entre rodadas), precisouTruncarGeracao (a 6ª rodada que não pode
// virar sucesso calado) e conferirMinuta (a segunda camada: encerramento
// obrigatório, abertura compatível com a modalidade, marcador sem fechar).
//
// Como em rede-varredura.mjs: o arquivo é carregado com os objetos do Google
// fingidos, e só essas contas puras são exercitadas — nada aqui fala com
// rede nenhuma.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import vm from 'node:vm';

const AQUI = dirname(fileURLToPath(import.meta.url));
const fonte = readFileSync(join(AQUI, '..', 'apps-script', 'cartorio-drive-api.js'), 'utf8');

const caixa = {
  console,
  Logger: {log(){}},
  PropertiesService: {getScriptProperties: () => ({getProperty: () => 'x'})},
  UrlFetchApp: {fetch(){ throw new Error('não deve ser chamado neste teste'); }},
  DriveApp: {}, DocumentApp: {}, ScriptApp: {}, CalendarApp: {}, ContentService: {MimeType: {}},
  FIREBASE_URL: 'https://exemplo',
};
vm.createContext(caixa);
vm.runInContext(
  fonte +
  '\n;globalThis.parsearResposta = parsearResposta;' +
  '\nglobalThis.chaveTipo = chaveTipo;' +
  '\nglobalThis.abreviarTipoAto = abreviarTipoAto;' +
  '\nglobalThis.respostaIndicaConclusao = respostaIndicaConclusao;' +
  '\nglobalThis.unirTextoMinuta = unirTextoMinuta;' +
  '\nglobalThis.precisouTruncarGeracao = precisouTruncarGeracao;' +
  '\nglobalThis.conferirMinuta = conferirMinuta;' +
  '\nglobalThis.anoPorExtenso = anoPorExtenso;' +
  '\nglobalThis.montarSystemPrompt = montarSystemPrompt;' +
  '\nglobalThis.extrairJsonAuditoria = extrairJsonAuditoria;' +
  '\nglobalThis.AUDITORIA_SYSTEM_PROMPT = AUDITORIA_SYSTEM_PROMPT;' +
  '\nglobalThis.extrairIdDocumento = extrairIdDocumento;',
  caixa
);

const erros = [];
const passo = (n, f) => {
  try { f(); console.log('  ok  ' + n); }
  catch (e) { erros.push(n + ' → ' + e.message); console.log('FALHA ' + n + ' → ' + e.message); }
};
const igual = (a, b, m) => { if (a !== b) throw new Error(m + ' → ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b)); };
const ok = (cond, m) => { if (!cond) throw new Error(m); };

console.log('\n— parsearResposta: pendências e linha proibida —');

passo('arranca os marcadores 【PENDÊNCIA: ...】 e numera em ordem', () => {
  const r = caixa.parsearResposta('Texto A 【PENDÊNCIA: falta CPF】 texto B 【PENDÊNCIA: falta matrícula】 fim.');
  igual(r.comentarios.length, 2, 'devia ter achado 2 pendências');
  igual(r.comentarios[0], 'Pendencia 1: falta CPF', 'primeira pendência não bateu');
  igual(r.comentarios[1], 'Pendencia 2: falta matrícula', 'segunda pendência não bateu');
  ok(r.minuta.indexOf('【') === -1, 'sobrou marcador no texto da minuta');
  ok(r.minuta.indexOf('falta CPF') === -1, 'o texto da pendência vazou pra minuta');
});

passo('corta a linha "## ANÁLISE DOCUMENTAL" (título de seção proibido)', () => {
  const r = caixa.parsearResposta('# ESCRITURA\n\nConteúdo normal.\n\n## ANÁLISE DOCUMENTAL\n\nIsso não devia aparecer.');
  ok(r.minuta.indexOf('Conteúdo normal') !== -1, 'perdeu o conteúdo válido');
  ok(r.minuta.indexOf('ANÁLISE DOCUMENTAL') === -1, 'não cortou o título proibido');
  ok(r.minuta.indexOf('Isso não devia aparecer') === -1, 'não cortou o que vinha depois do título');
});

passo('NÃO corta quando a palavra aparece dentro de uma frase normal', () => {
  const r = caixa.parsearResposta('# ESCRITURA\n\nO banco fará análise de crédito do comprador antes da liberação.');
  ok(r.minuta.indexOf('análise de crédito') !== -1, 'cortou uma frase legítima só por conter a palavra');
});

console.log('\n— chaveTipo e abreviarTipoAto —');

passo('tipo composto casa pela chave conhecida contida nele', () => {
  igual(caixa.chaveTipo('Inventário + Sobrepartilha'), 'inventario', 'não achou a chave dentro do texto composto');
});

passo('tipo desconhecido vira "geral", não quebra', () => {
  igual(caixa.chaveTipo('Alguma coisa nunca vista'), 'alguma-coisa-nunca-vista');
  igual(caixa.chaveTipo(''), 'geral');
  igual(caixa.chaveTipo(null), 'geral');
});

passo('abreviarTipoAto reconhece pelo mesmo critério de indexOf', () => {
  igual(caixa.abreviarTipoAto('Escritura de Compra e Venda + Confissão de Dívida'), 'V/C', 'devia ter casado por "Escritura de Compra e Venda"');
  igual(caixa.abreviarTipoAto('Tipo nunca cadastrado'), 'TIPO NUNCA CADASTRADO');
  igual(caixa.abreviarTipoAto(''), 'ATO');
});

passo('tipo composto sem a chave exata cai no próprio texto em maiúsculas', () => {
  igual(caixa.abreviarTipoAto('Escritura + Confissão de Dívida'), 'ESCRITURA + CONFISSÃO DE DÍVIDA',
        'sem uma das chaves conhecidas contida no texto, o fallback é o texto original');
});

console.log('\n— respostaIndicaConclusao: o teste do "CONCLUIDO" —');

passo('igualdade exata ainda funciona', () => {
  ok(caixa.respostaIndicaConclusao('CONCLUIDO'), 'CONCLUIDO puro devia bater');
});

passo('"CONCLUIDO." com ponto final não vira parte da escritura', () => {
  ok(caixa.respostaIndicaConclusao('CONCLUIDO.'), 'ponto final devia ser ignorado na comparação');
});

passo('acento, minúscula e espaço sobrando também são reconhecidos', () => {
  ok(caixa.respostaIndicaConclusao('  concluído!  '), 'devia ter normalizado acento/caixa/espaço/pontuação');
});

passo('texto de minuta de verdade NÃO é lido como CONCLUIDO', () => {
  ok(!caixa.respostaIndicaConclusao('CONCLUIDO o pagamento, as partes assinam este instrumento.'),
     'uma frase que só começa com a palavra não pode encerrar a geração cedo');
});

console.log('\n— unirTextoMinuta: a colagem entre rodadas —');

passo('insere espaço quando os dois lados grudariam numa palavra só', () => {
  igual(caixa.unirTextoMinuta('...ficam obrigados ao contrato', 'para todos os efeitos legais...'),
        '...ficam obrigados ao contrato para todos os efeitos legais...');
});

passo('não insere espaço a mais quando já existe quebra de linha/espaço na borda', () => {
  igual(caixa.unirTextoMinuta('Cláusula 1ª.\n', '\nCláusula 2ª.'), 'Cláusula 1ª.\n\nCláusula 2ª.');
});

passo('pedaço vazio de um dos lados não quebra a colagem', () => {
  igual(caixa.unirTextoMinuta('', 'primeiro pedaço'), 'primeiro pedaço');
  igual(caixa.unirTextoMinuta('só isso', ''), 'só isso');
});

console.log('\n— precisouTruncarGeracao: a 6ª rodada não é sucesso calado —');

passo('bateu o limite de rodadas ainda precisando continuar → truncou', () => {
  ok(caixa.precisouTruncarGeracao(6, 6, true), 'devia ter marcado truncamento');
});

passo('terminou sozinho antes do limite → não truncou', () => {
  ok(!caixa.precisouTruncarGeracao(3, 6, false), 'terminou normalmente, não devia marcar truncamento');
});

passo('bateu o limite mas a última rodada já não precisava continuar → não truncou', () => {
  ok(!caixa.precisouTruncarGeracao(6, 6, false), 'a rodada final já tinha fechado sozinha');
});

console.log('\n— conferirMinuta: encerramento, modalidade e marcador aberto —');

const ENCERRAMENTO_DIGITAL = '**INDISPONIBILIDADE:** consulta negativa. **ARQUIVAMENTO:** sob controle 123. **CERTIFICAÇÃO:** assinado digitalmente.';
const ENCERRAMENTO_PRESENCIAL = '**INDISPONIBILIDADE:** consulta negativa. **ARQUIVAMENTO:** sob controle 123.';

passo('minuta digital completa não gera aviso', () => {
  const texto = 'Aos ... por meio de VIDEOCONFERÊNCIA ... ' + ENCERRAMENTO_DIGITAL;
  const r = caixa.conferirMinuta(texto, 'digital');
  igual(r.avisos.length, 0, 'não devia ter avisos → ' + JSON.stringify(r.avisos));
});

passo('minuta presencial completa (sem CERTIFICAÇÃO) não gera aviso', () => {
  const texto = 'Aos ... perante mim ... ' + ENCERRAMENTO_PRESENCIAL;
  const r = caixa.conferirMinuta(texto, 'presencial');
  igual(r.avisos.length, 0, 'CERTIFICAÇÃO não é obrigatória em ato presencial → ' + JSON.stringify(r.avisos));
});

passo('digital sem CERTIFICAÇÃO no encerramento vira aviso', () => {
  const texto = 'Aos ... por meio de VIDEOCONFERÊNCIA ... ' + ENCERRAMENTO_PRESENCIAL;
  const r = caixa.conferirMinuta(texto, 'digital');
  ok(r.avisos.some(a => /CERTIFICAÇÃO/.test(a)), 'devia ter avisado da CERTIFICAÇÃO faltando');
});

passo('faltando INDISPONIBILIDADE ou ARQUIVAMENTO vira aviso em qualquer modalidade', () => {
  const r = caixa.conferirMinuta('Minuta sem nenhuma seção de encerramento.', 'presencial');
  ok(r.avisos.some(a => /INDISPONIBILIDADE/.test(a)), 'devia ter avisado da INDISPONIBILIDADE faltando');
  ok(r.avisos.some(a => /ARQUIVAMENTO/.test(a)), 'devia ter avisado do ARQUIVAMENTO faltando');
});

passo('abertura presencial que menciona VIDEOCONFERÊNCIA vira aviso', () => {
  const texto = 'Aos ... por meio de VIDEOCONFERÊNCIA ... ' + ENCERRAMENTO_PRESENCIAL;
  const r = caixa.conferirMinuta(texto, 'presencial');
  ok(r.avisos.some(a => /PRESENCIAL/.test(a)), 'ato presencial não pode ter abertura de videoconferência sem aviso');
});

passo('abertura digital sem VIDEOCONFERÊNCIA vira aviso', () => {
  const texto = 'Aos ... perante mim ... ' + ENCERRAMENTO_DIGITAL;
  const r = caixa.conferirMinuta(texto, 'digital');
  ok(r.avisos.some(a => /DIGITAL/.test(a)), 'ato digital sem menção a videoconferência devia gerar aviso');
});

passo('marcador 【 sem fechar (corte no meio de uma pendência) vira aviso', () => {
  const texto = 'Texto normal 【PENDÊNCIA: cortou aqui no meio' + ENCERRAMENTO_DIGITAL;
  const r = caixa.conferirMinuta(texto, 'digital');
  ok(r.avisos.some(a => /【/.test(a)), 'devia ter avisado do marcador sem fechar');
});

passo('conta os campos em branco (______), sem travar em zero', () => {
  const r = caixa.conferirMinuta('Nome: ______, CPF: ______.' + ENCERRAMENTO_DIGITAL, 'digital');
  igual(r.brancos, 2);
});

console.log('\n— anoPorExtenso e montarSystemPrompt: sem ano escrito à mão —');

passo('2026 vira "dois mil e vinte e seis" (o texto que estava fixo no prompt)', () => {
  igual(caixa.anoPorExtenso(2026), 'dois mil e vinte e seis');
});

passo('cobre a virada do ano sozinho — 2027 não precisa de ninguém mexer no código', () => {
  igual(caixa.anoPorExtenso(2027), 'dois mil e vinte e sete');
  igual(caixa.anoPorExtenso(2030), 'dois mil e trinta');
  igual(caixa.anoPorExtenso(2000), 'dois mil');
  igual(caixa.anoPorExtenso(2019), 'dois mil e dezenove');
});

passo('o SYSTEM_PROMPT não carrega mais nenhum ano escrito à mão', () => {
  const prompt2026 = caixa.montarSystemPrompt(2026);
  const prompt2027 = caixa.montarSystemPrompt(2027);
  ok(prompt2026.indexOf('dois mil e vinte e seis (2026)') !== -1, 'o marcador não foi preenchido para 2026');
  ok(prompt2027.indexOf('dois mil e vinte e sete (2027)') !== -1, 'o marcador não foi preenchido para 2027');
  ok(prompt2026 !== prompt2027, 'o prompt de anos diferentes saiu idêntico');
  ok(prompt2027.indexOf('2026') === -1, 'sobrou o ano fixo de 2026 mesmo pedindo 2027');
});

console.log('\n— extrairJsonAuditoria: a auditoria (Etapa 2) —');

passo('extrai o JSON mesmo com texto/markdown em volta', () => {
  const r = caixa.extrairJsonAuditoria('Aqui está:\n```json\n{"achados":["CPF não bate"]}\n```\nPronto.');
  igual(r.achados.length, 1);
  igual(r.achados[0], 'CPF não bate');
});

passo('lista vazia é uma resposta válida ("conferi e está tudo certo")', () => {
  const r = caixa.extrairJsonAuditoria('{"achados":[]}');
  igual(r.achados.length, 0);
});

passo('resposta sem chaves nenhuma lança erro, não finge sucesso', () => {
  let erro = null;
  try { caixa.extrairJsonAuditoria('não consegui analisar isso'); }
  catch (e) { erro = e; }
  ok(erro, 'devia ter lançado erro pra resposta sem JSON nenhum');
});

passo('o prompt da auditoria proíbe reescrever a minuta e pede só JSON', () => {
  ok(/nunca reescrever/i.test(caixa.AUDITORIA_SYSTEM_PROMPT), 'devia deixar explícito que a auditoria não reescreve');
  ok(/"achados"/.test(caixa.AUDITORIA_SYSTEM_PROMPT), 'devia pedir o formato {"achados": [...]}');
});

console.log('\n— extrairIdDocumento e a curadoria do modelo aprendido —');

passo('reconhece o id no link comum do Google Docs', () => {
  igual(caixa.extrairIdDocumento('https://docs.google.com/document/d/1AbC-xyz_9Q/edit'), '1AbC-xyz_9Q');
});

passo('reconhece o id no link com parâmetros depois', () => {
  igual(caixa.extrairIdDocumento('https://docs.google.com/document/d/1AbC-xyz_9Q/edit?usp=sharing'), '1AbC-xyz_9Q');
});

passo('aceita o id sozinho, sem link', () => {
  igual(caixa.extrairIdDocumento('1AbC-xyz_9Q'), '1AbC-xyz_9Q');
});

passo('link que não é de documento não devolve nada', () => {
  igual(caixa.extrairIdDocumento('https://docs.google.com/spreadsheets/d/1AbC/edit'), '');
  igual(caixa.extrairIdDocumento(''), '');
  igual(caixa.extrairIdDocumento(null), '');
});

passo('gerarECriarMinuta não aprende mais sozinho de toda minuta gerada', () => {
  // Antes, toda minuta virava o modelo do tipo — boa ou ruim. A curadoria
  // (Etapa 2) tirou essa chamada de dentro da geração: só entra modelo
  // quando ela marca pelo painel (ação "marcar-modelo" → marcarModelo).
  const inicio = fonte.indexOf('function gerarECriarMinuta');
  const fim = fonte.indexOf('function _criarMinutaDocInterno');
  ok(inicio !== -1 && fim !== -1 && fim > inicio, 'não achei os limites de gerarECriarMinuta no arquivo');
  const corpo = fonte.slice(inicio, fim);
  ok(!/salvarModeloAprendido\(/.test(corpo), 'gerarECriarMinuta ainda chama salvarModeloAprendido sozinho');
});

passo('a ação marcar-modelo existe e está ligada no doPost', () => {
  ok(/acao === "marcar-modelo"/.test(fonte), 'doPost não reconhece a ação marcar-modelo');
  ok(/function marcarModelo\(/.test(fonte), 'a função marcarModelo não existe');
});

console.log('\n' + (erros.length ? `${erros.length} falha(s).` : 'Tudo certo.'));
if (erros.length) process.exit(1);
