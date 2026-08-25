// A varredura das minutas, na parte que dá para provar fora do Google.
//
// Roda com: node testes/rede-varredura.mjs
//
// O apps-script/cartorio-rede.js só roda de verdade dentro do Apps Script —
// ele fala com o Drive, com o Firebase e com a IA. Mas a conta que decide
// QUEM É A MESMA PESSOA não depende de nada disso, e é a peça em que um erro
// silencioso custa caro: se a impressão digital mudar de resultado, o cadastro
// duplica; se ela deixar o CPF passar, o número vaza para o banco.
//
// Então aqui o arquivo é carregado com os objetos do Google fingidos, e só
// essas contas são exercitadas.
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import vm from 'node:vm';

const AQUI = dirname(fileURLToPath(import.meta.url));
const fonte = readFileSync(join(AQUI, '..', 'apps-script', 'cartorio-rede.js'), 'utf8');

const propriedades = {REDE_CHAVE: 'chave-secreta-de-teste-nao-usar-no-ar', ANTHROPIC_API_KEY: 'x'};

const caixa = {
  // O Apps Script devolve bytes com sinal (-128 a 127). Fingir isso é de
  // propósito: é assim que se prova que a conversão para hexadecimal do
  // cartorio-rede.js trata o número negativo em vez de gerar lixo.
  Utilities: {
    computeHmacSha256Signature(texto, chave){
      return Array.from(createHmac('sha256', chave).update(texto).digest())
        .map(b => b > 127 ? b - 256 : b);
    }
  },
  PropertiesService: {
    getScriptProperties: () => ({getProperty: k => propriedades[k] || null})
  },
  Logger: {log(){}},
  console,
  // Estes vêm do outro arquivo do mesmo projeto; aqui só precisam existir.
  FIREBASE_URL: 'https://exemplo',
  UrlFetchApp: {}, DriveApp: {}, DocumentApp: {}, ScriptApp: {}, MimeType: {},
  getPastaMinutasIA(){ throw new Error('não deve ser chamada neste teste'); }
};
vm.createContext(caixa);
// As funções do arquivo viram globais da caixa sozinhas; os const, não.
// A última linha traz para fora os dois que o teste precisa ler.
vm.runInContext(fonte + '\n;globalThis.REDE_EXTRACAO = REDE_EXTRACAO;'
                      + '\nglobalThis.REDE_FORA = REDE_FORA;', caixa);

const erros = [];
const passo = (n, f) => {
  try { f(); console.log('  ok  ' + n); }
  catch (e) { erros.push(n + ' → ' + e.message); console.log('FALHA ' + n + ' → ' + e.message); }
};
const igual = (a, b, m) => { if(a !== b) throw new Error(m + ' → ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b)); };

console.log('\n— A impressão digital do CPF —');

const CPF_A = '03230018826';
const CPF_B = '35580948832';

passo('o mesmo CPF dá sempre o mesmo código', () => {
  igual(caixa.impressaoDigital(CPF_A), caixa.impressaoDigital(CPF_A), 'variou entre duas chamadas');
});

passo('CPFs diferentes dão códigos diferentes', () => {
  if(caixa.impressaoDigital(CPF_A) === caixa.impressaoDigital(CPF_B))
    throw new Error('dois CPFs bateram no mesmo código');
});

passo('o código não carrega o CPF dentro dele', () => {
  const c = caixa.impressaoDigital(CPF_A);
  if(c.includes(CPF_A)) throw new Error('o número apareceu inteiro no código');
  if(c.includes(CPF_A.slice(0,6))) throw new Error('metade do número apareceu no código');
  if(!/^[0-9a-f]{24}$/.test(c)) throw new Error('não é hexadecimal limpo → ' + c);
});

passo('trocar a chave secreta muda todos os códigos', () => {
  const antes = caixa.impressaoDigital(CPF_A);
  propriedades.REDE_CHAVE = 'outra-chave';
  const depois = caixa.impressaoDigital(CPF_A);
  propriedades.REDE_CHAVE = 'chave-secreta-de-teste-nao-usar-no-ar';
  if(antes === depois) throw new Error('a chave não estava sendo usada de verdade');
  igual(caixa.impressaoDigital(CPF_A), antes, 'não voltou ao mesmo com a chave de volta');
});

passo('sem a chave, a varredura para e explica, em vez de inventar', () => {
  const guardada = propriedades.REDE_CHAVE;
  propriedades.REDE_CHAVE = null;
  let recado = '';
  try { caixa.impressaoDigital(CPF_A); } catch(e){ recado = e.message; }
  propriedades.REDE_CHAVE = guardada;
  if(!recado) throw new Error('deixou passar sem chave');
  if(!/REDE_CHAVE/.test(recado)) throw new Error('não disse o que falta → ' + recado);
  if(!/duplicar|duplica/.test(recado)) throw new Error('não avisou do risco de trocar a chave');
});

console.log('\n— Quem é a mesma pessoa —');

passo('mesma pessoa, escrita diferente, mesmo CPF: um cadastro só', () => {
  const a = caixa.redeChaveDaPessoa({nome:'Letícia Miranda Aleixo Ferreira', cpf:'058.780.366-57'});
  const b = caixa.redeChaveDaPessoa({nome:'LETICIA M. A. FERREIRA', cpf:'05878036657'});
  igual(a.id, b.id, 'o CPF é o mesmo, o cadastro devia ser um só');
  igual(a.porNome, false, 'devia ter reconhecido pelo CPF');
});

passo('sem CPF, casa por nome e cidade — e deixa isso registrado', () => {
  const a = caixa.redeChaveDaPessoa({nome:'Simone Paulino da Silva', cidade:'São Paulo', cpf:''});
  const b = caixa.redeChaveDaPessoa({nome:'simone paulino da silva', cidade:'SAO PAULO'});
  igual(a.id, b.id, 'acento e caixa não deviam separar a mesma pessoa');
  igual(a.porNome, true, 'devia ficar marcado que foi pelo nome, não pelo CPF');
});

passo('mesmo nome em cidades diferentes não vira a mesma pessoa', () => {
  const a = caixa.redeChaveDaPessoa({nome:'José da Silva', cidade:'São Paulo'});
  const b = caixa.redeChaveDaPessoa({nome:'José da Silva', cidade:'Gravataí'});
  if(a.id === b.id) throw new Error('juntou dois homônimos de cidades diferentes');
});

passo('CPF incompleto não é aceito como CPF', () => {
  const a = caixa.redeChaveDaPessoa({nome:'Fulano', cidade:'São Paulo', cpf:'123'});
  igual(a.porNome, true, 'CPF com 3 dígitos não devia servir de identidade');
});

console.log('\n— Quem não entra na teia —');

passo('a própria casa fica de fora', () => {
  const casa = [
    ['Shirley Dantas da Silva', 'escrevente autorizada'],
    ['Fulano de Tal', 'Substituto Legal do Tabelião'],
    ['10º Oficial de Registro de Imóveis', ''],
    ['15º Tabelião de Notas', '']
  ];
  casa.forEach(([nome, prof]) => {
    if(!caixa.redeEhDaCasa(nome, prof)) throw new Error('devia estar fora: ' + nome);
  });
});

passo('cliente e gente de construtora continuam entrando', () => {
  const gente = [
    ['Rejane Gregório', 'corretora de imóveis'],
    ['Letícia Miranda Aleixo Ferreira', 'gerente financeira'],
    ['Tânia de Barros Bertola', 'bibliotecária'],
    ['Gustavo Bertola', '']
  ];
  gente.forEach(([nome, prof]) => {
    if(caixa.redeEhDaCasa(nome, prof)) throw new Error('não devia ter sido cortada: ' + nome);
  });
});

console.log('\n— O que a IA recebe —');

passo('as instruções proíbem inventar profissão', () => {
  if(!/NÃO invente/.test(caixa.REDE_EXTRACAO)) throw new Error('não proibiu inventar');
  if(!/string vazia/.test(caixa.REDE_EXTRACAO)) throw new Error('não mandou devolver vazio quando falta');
});

passo('as instruções mandam deixar o cartório de fora', () => {
  if(!/NUNCA inclua o escrevente/.test(caixa.REDE_EXTRACAO)) throw new Error('não excluiu o pessoal da casa');
});

passo('as instruções preveem o duvidoso, em vez de chutar', () => {
  if(!/duvidoso/.test(caixa.REDE_EXTRACAO)) throw new Error('não previu o duvidoso');
  if(!/empresário/.test(caixa.REDE_EXTRACAO)) throw new Error('não deu exemplo de cargo genérico');
});

if(erros.length){
  console.log('\n' + erros.length + ' problema(s):');
  erros.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
console.log('\nA varredura passou nas contas que dá para conferir daqui.');
