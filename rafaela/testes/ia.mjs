// A porta da IA (painel/api/ia.js), sem internet e sem chave: o cliente da Anthropic é fingido.
//   node rafaela/testes/ia.mjs
import Module from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";
const require = Module.createRequire(import.meta.url);
const AQUI = path.dirname(fileURLToPath(import.meta.url));

// "@anthropic-ai/sdk" não está instalado aqui: entra um falso no lugar.
const chamadas = [];
let proxima = null;
class Falso { constructor() { this.messages = {create: async a => { chamadas.push(a); return proxima(a); }}; } }
Falso.RateLimitError = class extends Error {};
const resolver = Module._resolveFilename;
Module._resolveFilename = function (req, ...r) { return req === "@anthropic-ai/sdk" ? "@falso" : resolver.call(this, req, ...r); };
require.cache["@falso"] = {id: "@falso", filename: "@falso", loaded: true, exports: {default: Falso}};

const ia = require(path.join(AQUI, "..", "painel", "api", "ia.js"));
const T = ia.__teste;
let certos = 0, falhas = 0;
const ok = (c, m) => { if (c) certos++; else { falhas++; console.log("  ✗", m); } };

function chamar(corpo, {metodo = "POST", origem = "https://caderno.exemplo.app", host = "caderno.exemplo.app", codigo, bruto} = {}) {
  return new Promise(resolve => {
    const res = {codigo: 200, h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.codigo = c; return this; }, json(o) { resolve({codigo: this.codigo, corpo: o}); }, end() { resolve({codigo: this.codigo, corpo: null}); }};
    const headers = {host, ...(origem ? {origin: origem} : {}), ...(codigo ? {"x-codigo": codigo} : {})};
    ia({method: metodo, headers, body: bruto !== undefined ? bruto : corpo}, res);
  });
}
const texto = o => ({stop_reason: "end_turn", content: [{type: "text", text: typeof o === "string" ? o : JSON.stringify(o)}]});
const bom = {diagnostico_confiavel: true, tipo_erro: "cálculo", padrao: "esquece de converter gramas em mols", tipo_questao: "cálculo estequiométrico", materia: "Química", assunto: "Estequiometria", onde_errou: "No passo 2.", forma_correta: ["a", "b"], resposta_correta: "C", como_reconhecer: ["x"], para_fixar: "y", perguntas_para_ela: [], aviso: ""};
const pedidoBase = {acao: "corrigir", registro: {tipo: "erro", materia: "Química", assunto: "Estequiometria", raciocinio: "usei 18 g direto", minhaResposta: "B", gabarito: "C", banca: "FUVEST", ano: 2027, numero: 7}, imagens: [{rotulo: "Foto da resolução dela (1)", dados: "AAAA", tipo: "image/jpeg"}], padroes: ["lê o gráfico errado"], tipos: ["interpretação de gráfico"]};

process.env.ANTHROPIC_API_KEY = "teste";
delete process.env.RAFAELA_CODIGO;

// 1. caminho feliz
proxima = () => texto(bom);
let r = await chamar(pedidoBase);
ok(r.codigo === 200 && r.corpo.ok && r.corpo.correcao.tipo_erro === "cálculo", "corrige e devolve a classificação");
const env = chamadas.at(-1);
const conteudo = env.messages[0].content;
ok(conteudo.some(b => b.type === "image" && b.source.media_type === "image/jpeg" && b.source.data === "AAAA"), "a foto da resolução vai como imagem");
const pedido = conteudo.at(-1).text;
ok(pedido.includes("usei 18 g direto") && pedido.includes("ALTERNATIVA QUE ELA MARCOU: B") && pedido.includes("GABARITO: C"), "raciocínio, alternativa e gabarito vão no pedido");
ok(pedido.includes("lê o gráfico errado") && pedido.includes("interpretação de gráfico"), "rótulos já usados vão junto, para reaproveitar");
ok(/não presuma|NÃO presuma/i.test(env.system) && env.system.includes("perguntas_para_ela") && env.system.includes("diagnostico_confiavel"), "o prompt proíbe presumir e manda perguntar");
ok(env.system.includes("hierarquia") === false && env.system.includes("tipo_erro"), "classificação pedida no prompt");

// 2. resposta com cerca de código e texto em volta
proxima = () => texto("Claro!\n```json\n" + JSON.stringify(bom) + "\n```");
r = await chamar(pedidoBase); ok(r.codigo === 200 && r.corpo.correcao.assunto === "Estequiometria", "aceita JSON dentro de cerca de código");

// 3. diagnóstico não confiável: sem padrão, com perguntas
proxima = () => texto({...bom, diagnostico_confiavel: false, tipo_erro: "indefinido", padrao: "inventado", perguntas_para_ela: ["Você converteu em mols?", "b", "c", "d"]});
r = await chamar(pedidoBase);
ok(r.corpo.correcao.diagnostico_confiavel === false && r.corpo.correcao.padrao === "" && r.corpo.correcao.perguntas_para_ela.length === 3, "sem certeza: não guarda padrão e limita as perguntas");

// 4. tipo de erro fora da lista vira indefinido
proxima = () => texto({...bom, tipo_erro: "preguiça"}); r = await chamar(pedidoBase);
ok(r.corpo.correcao.tipo_erro === "indefinido", "tipo de erro inventado não passa");

// 5. lixo da IA
proxima = () => texto("não sei"); r = await chamar(pedidoBase); ok(r.codigo === 502 && !r.corpo.ok, "resposta ilegível vira erro claro");
proxima = () => ({stop_reason: "refusal", content: []}); r = await chamar(pedidoBase); ok(r.codigo === 422, "recusa vira erro claro");
proxima = () => { throw new Error("rede"); }; r = await chamar(pedidoBase); ok(r.codigo === 500 && r.corpo.erro.includes("não respondeu"), "falha de rede não vaza detalhe");
proxima = () => { throw new Falso.RateLimitError("x"); }; r = await chamar(pedidoBase); ok(r.codigo === 429, "limite de uso vira 429");

// 6. dicas
const resumo = {totais: {registros: 3}, prioridades: [{materia: "Química", assunto: "Estequiometria", padroesDeErro: ["esquece de converter gramas em mols"]}]};
proxima = () => texto({resumo: "r", itens: [{materia: "Química", assunto: "Estequiometria", padrao: "p", macete: "m", dica_pratica: "d", como_reconhecer: "c", antes_de_marcar: ["1", "2"]}], aviso: ""});
r = await chamar({acao: "dicas", resumo});
ok(r.codigo === 200 && r.corpo.dicas.itens.length === 1, "gera dicas");
ok(chamadas.at(-1).messages[0].content[0].text.includes("esquece de converter gramas em mols"), "o resumo real vai no pedido");
ok(/Fale apenas dos assuntos/.test(chamadas.at(-1).system) && /macete vazio|deixe macete vazio/.test(chamadas.at(-1).system), "o prompt veda assunto inventado e macete duvidoso");
r = await chamar({acao: "dicas", resumo: {prioridades: []}}); ok(r.codigo === 400, "sem registros não gera dicas");

// 7. trancas
const antes = chamadas.length;
r = await chamar(pedidoBase, {origem: "https://site-de-outro.com"}); ok(r.codigo === 403 && chamadas.length === antes, "origem estranha é recusada sem gastar a IA");
r = await chamar(pedidoBase, {origem: "http://localhost:3000", host: "x"}); ok(r.codigo === 200 || r.codigo === 502, "localhost passa (desenvolvimento)");
process.env.RAFAELA_ORIGENS = "https://outro.app"; proxima = () => texto(bom);
r = await chamar(pedidoBase, {origem: "https://outro.app"}); ok(r.codigo === 200, "origem listada em RAFAELA_ORIGENS passa");
delete process.env.RAFAELA_ORIGENS;
process.env.RAFAELA_CODIGO = "segredo";
r = await chamar(pedidoBase); ok(r.codigo === 401 && r.corpo.codigo === true, "com código configurado, pede o código");
r = await chamar(pedidoBase, {codigo: "errado"}); ok(r.codigo === 401, "código errado recusado");
r = await chamar(pedidoBase, {codigo: "segredo"}); ok(r.codigo === 200, "código certo passa");
delete process.env.RAFAELA_CODIGO;
r = await chamar(pedidoBase, {metodo: "GET"}); ok(r.codigo === 200 && r.corpo.chaveDaIA === true && !JSON.stringify(r.corpo).includes("teste"), "GET diz se há chave sem revelá-la");
r = await chamar({acao: "outra"}); ok(r.codigo === 400, "ação desconhecida");
r = await chamar(null, {bruto: "{quebrado"}); ok(r.codigo === 400, "JSON inválido");
r = await chamar({...pedidoBase, imagens: [{dados: "A".repeat(4 * 1024 * 1024), tipo: "image/jpeg"}]}); ok(r.codigo === 413, "fotos grandes demais são recusadas antes da IA");
r = await chamar({...pedidoBase, imagens: Array(9).fill({dados: "AAAA", tipo: "image/jpeg"})}); const n = chamadas.at(-1).messages[0].content.filter(b => b.type === "image").length; ok(n <= 5, "no máximo 5 imagens chegam à IA (" + n + ")");
delete process.env.ANTHROPIC_API_KEY; T.definirCliente(null);
r = await chamar(pedidoBase); ok(r.codigo === 500 && r.corpo.erro.includes("chave"), "sem chave configurada, diz isso");

console.log(`\n${certos} verificações certas, ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
