// O catálogo de "Pedir documentos": as regras dela, sem navegador.
//   node testes/pedido-docs.mjs
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const P = createRequire(import.meta.url)('../pedido-docs.js');
let erros = 0;
const passo = (n, f) => { try { f(); console.log('  ok  ' + n); } catch (e) { erros++; console.log('FALHA ' + n + ' → ' + e.message); } };
const txt = (e) => P.comporTexto({publico: 'cliente', ...e});
const linhas = (e) => txt(e).split('\n').filter(l => l.startsWith('• '));
const TODOS = Object.keys(P.MODELO_DO_TIPO);

passo('os dados pessoais vão numa linha só, nunca em seis', () => {
  const l = linhas({tipo: 'Escritura de Compra e Venda'});
  assert(l.some(x => /RG, CPF, certidão de estado civil, endereço e profissão/.test(x)));
  assert(!l.some(x => x === '• Profissão' || x === '• Estado civil' || x === '• RG e CPF'));
});
passo('o pedido é curto: no máximo 6 linhas na compra e venda e na doação, e a mensagem cabe em 12 linhas', () => {
  assert(txt({tipo: 'Escritura de Compra e Venda'}).split('\n').length <= 12);
  assert(linhas({tipo: 'Escritura de Compra e Venda'}).length <= 6);
  assert(linhas({tipo: 'Doação'}).length <= 6);
});
passo('nunca pede certidão "atualizada" nem prazo de 90 dias', () => {
  for (const tipo of TODOS) for (const publico of Object.keys(P.PUBLICOS))
    assert(!/atualizad|90 dias/i.test(txt({tipo, publico, bens: {urbano: true}, partilha: true, pacto: true, uniaoEstavel: true})), tipo + '/' + publico);
});
passo('casado: pede os dados do cônjuge e diz que a certidão é uma só', () => {
  const t = txt({tipo: 'Escritura de Compra e Venda'});
  assert(/se casado\(a\), também do cônjuge/.test(t));
});
passo('divorciandos: o cônjuge não é pedido de novo (são um o cônjuge do outro)', () => {
  assert(!/do cônjuge/.test(txt({tipo: 'Divórcio'})));
});
passo('inventário: só pede os documentos dos bens marcados', () => {
  assert(!txt({tipo: 'Inventário'}).includes('Matrícula'));
  const casa = txt({tipo: 'Inventário', bens: {urbano: true}});
  assert(casa.includes('Matrícula do imóvel urbano') && !/veículo|extrato|joias|ITR/i.test(casa));
  const rural = txt({tipo: 'Inventário', bens: {rural: true}});
  assert(rural.includes('ITR') && rural.includes('CCIR'));
});
passo('inventário: o advogado só entra no pedido para o advogado', () => {
  assert(!txt({tipo: 'Inventário', publico: 'cliente'}).includes('OAB'));
  assert(txt({tipo: 'Inventário', publico: 'advogado'}).includes('OAB'));
});
passo('pacto marcado em outro ato: pede o pacto E o registro no RI do primeiro domicílio', () => {
  const t = txt({tipo: 'Escritura de Compra e Venda', pacto: true});
  assert(/pacto antenupcial/.test(t) && /Registro de Imóveis do primeiro domicílio/.test(t));
});
passo('na escritura DE pacto não se pede o registro, só os dados e as certidões do casal', () => {
  const t = txt({tipo: 'Pacto Antenupcial', pacto: true});
  assert(!/Registro de Imóveis/.test(t) && /certidão de estado civil/.test(t));
});
passo('união estável é documento marcável, não estado civil', () => {
  assert(!/união estável/i.test(txt({tipo: 'Escritura de Compra e Venda'})), 'sem marcar, não aparece');
  assert(txt({tipo: 'Escritura de Compra e Venda', uniaoEstavel: true}).includes('Livro E'));
});
passo('compra e venda: valor só do comprador, banco das duas partes; corretor só dados e matrícula', () => {
  const t = txt({tipo: 'Escritura de Compra e Venda'});
  assert(/Pagamento: valor da transação, sinal \(se houve\), forma \(TED ou PIX\) e dados bancários de comprador e vendedor/.test(t));
  const c = txt({tipo: 'Escritura de Compra e Venda', publico: 'corretor'});
  assert(/Matrícula/.test(c) && !/bancários|Valor da transação|Pagamento/.test(c));
  assert(!c.includes('Contrato, se houver'), 'o contrato nasce desmarcado');
  assert(P.comporTexto({publico: 'corretor', tipo: 'Escritura de Compra e Venda', marc: {'imovel.contrato': true}}).includes('Contrato, se houver'));
});
passo('construtora: só os dados de quem comprou — nada da construtora, do vendedor nem da matrícula', () => {
  const l = linhas({tipo: 'Escritura de Compra e Venda', publico: 'construtora'});
  assert.equal(l.length, 1);
  assert(/Seus dados/.test(l[0]) && !/vendedor|construtora|Matrícula|bancários/i.test(l[0]));
});
passo('doação: cláusulas ou marcadas por ela, ou escolhidas pela pessoa', () => {
  assert(!txt({tipo: 'Doação'}).includes('láusulas'));
  assert(/Cláusulas previstas: reserva de usufruto, cláusula de reversão/.test(txt({tipo: 'Doação', marc: {'clausula.usufruto': true, 'clausula.reversao': true}})));
  assert(/Informe se deseja: reserva de usufruto/.test(txt({tipo: 'Doação', clausulasModo: 'cliente'})));
});
passo('testamento: a certidão de inexistência nasce desmarcada', () => {
  assert(!txt({tipo: 'Inventário'}).includes('inexistência de testamento'));
  assert(txt({tipo: 'Inventário', marc: {'falecido.testamento': true}}).includes('inexistência de testamento'));
});
passo('divórcio sem partilha não traz bens; com partilha traz', () => {
  assert(!txt({tipo: 'Divórcio', bens: {urbano: true}}).includes('Matrícula'));
  assert(txt({tipo: 'Divórcio', partilha: true, bens: {urbano: true}}).includes('Matrícula do imóvel urbano'));
});
passo('o link entra quando existe; sem ele, pede por aqui mesmo', () => {
  assert(txt({tipo: 'Doação'}).includes('por aqui'));
  assert(txt({tipo: 'Doação', link: 'https://x.y/z'}).includes('https://x.y/z'));
});
passo('item desmarcado some do texto; item acrescentado entra', () => {
  const antes = linhas({tipo: 'Escritura de Compra e Venda'}).length;
  assert.equal(linhas({tipo: 'Escritura de Compra e Venda', marc: {'imovel.mat': false}}).length, antes - 1);
  assert(txt({tipo: 'Escritura de Compra e Venda', extras: ['Declaração de quitação do condomínio']}).includes('• Declaração de quitação do condomínio'));
});
passo('a abertura usa o artigo certo', () => {
  assert(txt({tipo: 'Doação'}).includes('Para a Doação'));
  assert(txt({tipo: 'Inventário'}).includes('Para o Inventário'));
  assert(txt({tipo: 'Pacto Antenupcial'}).includes('Para o Pacto Antenupcial'));
});
passo('todo ato de todo público monta sem erro e com ao menos uma linha', () => {
  for (const tipo of TODOS) for (const publico of Object.keys(P.PUBLICOS)) assert(linhas({tipo, publico}).length >= 1, tipo + '/' + publico);
});
passo('mandando só para o comprador: nada do vendedor, pagamento sim, matrícula desmarcada', () => {
  const t = linhas({tipo: 'Escritura de Compra e Venda', papel: 'comprador'}).join('\n');
  assert(/Seus dados: RG, CPF/.test(t) && /Pagamento: valor da transação/.test(t) && /conta de onde sairá/.test(t));
  assert(!/vendedor|Matrícula/i.test(t), t);
});
passo('mandando só para o vendedor: dados pessoais, documentos e matrícula; sem valor e sem conta (a conta é um pedido a mais)', () => {
  const t = linhas({tipo: 'Escritura de Compra e Venda', papel: 'vendedor'}).join('\n');
  assert(/Seus dados/.test(t) && /Matrícula do imóvel/.test(t) && !/bancários|valor da transação|comprador/i.test(t), t);
  assert(!P.formulario({tipo: 'Escritura de Compra e Venda', papel: 'vendedor'}).some((x) => x.k === 'pagamento'));
  const o = P.formulario({tipo: 'Escritura de Compra e Venda', papel: 'vendedor', marc: {pagamento: true}}).find((x) => x.k === 'pagamento');
  assert(o && o.lado === 'vendedor', 'ela pode ligar a conta do vendedor');
});
passo('o advogado mandando para um lado só fala "Dados do comprador", não "Seus dados"', () => {
  const t = linhas({tipo: 'Escritura de Compra e Venda', papel: 'comprador', publico: 'advogado'}).join('\n');
  assert(/Dados do\(a\) comprador/.test(t) && !/Seus dados/.test(t), t);
});
passo('doação: o donatário não recebe matrícula nem cláusulas', () => {
  const t = txt({tipo: 'Doação', papel: 'donatario', clausulasModo: 'cliente'});
  assert(!/Matrícula|cláusulas|Informe se deseja/.test(t) && /Seus dados/.test(t), t);
});
passo('procuração: o procurador só informa o que é dele', () => {
  const t = linhas({tipo: 'Procuração', papel: 'procurador', poderes: {imovel: true}}).join('\n');
  assert(!/Matrícula|certidão/i.test(t) && /RG, CPF, endereço e profissão/.test(t), t);
});
passo('papel que não existe no ato volta para "os dois"', () => {
  assert.equal(P.papelDe({papel: 'comprador'}, 'inventario'), 'ambos');
  assert.equal(P.papelDe({papel: 'xyz'}, 'compra-venda'), 'ambos');
});
passo('valor e dados bancários são UM pedido só, com o valor antes da conta', () => {
  const l = linhas({tipo: 'Escritura de Compra e Venda'});
  assert.equal(l.filter((x) => /bancários|Pagamento/.test(x)).length, 1, 'um item só de pagamento');
  const pag = l.find((x) => /Pagamento/.test(x));
  assert(pag.indexOf('valor da transação') < pag.indexOf('dados bancários'), pag);
  assert(l.indexOf(pag) > 0 && /RG, CPF/.test(l[0]), 'vem depois dos dados da pessoa');
});
passo('comprador paga (valor, sinal, forma, conta pagadora); vendedor só informa a conta que recebe', () => {
  const c = linhas({tipo: 'Escritura de Compra e Venda', papel: 'comprador'}).join('\n');
  assert(/valor da transação, sinal \(se houve\), forma \(TED ou PIX\) e conta de onde sairá o pagamento/.test(c));
  const v = linhas({tipo: 'Escritura de Compra e Venda', papel: 'vendedor', marc: {pagamento: true}}).join('\n');
  assert(/Dados bancários para receber o pagamento/.test(v) && !/valor da transação|sinal/.test(v));
});
passo('o formulário do pagamento nasce do pedido: lado e campos com rótulo (é o que a ficha lê)', () => {
  const b = P.formulario({tipo: 'Escritura de Compra e Venda', publico: 'cliente', papel: 'vendedor', marc: {pagamento: true}}).find((x) => x.k === 'pagamento');
  assert.equal(b.lado, 'vendedor'); assert.equal(b.titulo, 'Pagamento');
  assert(b.campos.some((c) => c.id === 'sinalValor' && /sinal/.test(c.rotulo)));
  assert(!P.formulario({tipo: 'Escritura de Compra e Venda', publico: 'corretor'}).some((x) => x.k === 'pagamento'), 'corretor não pede pagamento');
});
passo('pedir mais: arquivo ou só informação, para todos ou para um lado; nasce no formulário e no texto', () => {
  const e = {tipo: 'Escritura de Compra e Venda', papel: 'ambos', extras: [
    'Comprovante de residência',
    {texto: 'Número do IPTU', tipo: 'info', para: 'todos'},
    {texto: 'Certidão do condomínio', tipo: 'arquivo', para: 'vendedor'}]};
  const f = P.formulario(e);
  assert(f.some((b) => b.k === 'doc' && b.rotulo === 'Comprovante de residência'), 'texto antigo = arquivo');
  const i = f.find((b) => b.k === 'campos' && b.titulo === 'Número do IPTU');
  assert(i && i.campos[0].tipo === 'texto' && !i.campos[0].opcional, 'informação vira campo de texto');
  assert(f.some((b) => b.k === 'doc' && /^Vendedor: Certidão do condomínio/.test(b.rotulo)), 'com os dois lados, o rótulo diz de quem é');
  assert(/Informe: Número do IPTU/.test(P.comporTexto(e)));
  const c = P.formulario({...e, papel: 'comprador'});
  assert(!c.some((b) => /condomínio/.test(b.rotulo || '')), 'o que é do vendedor não vai para o comprador');
  assert(c.some((b) => b.titulo === 'Número do IPTU') && c.some((b) => b.rotulo === 'Comprovante de residência'));
  const v = P.formulario({...e, papel: 'vendedor'}).find((b) => /condomínio/.test(b.rotulo || ''));
  assert(v && v.rotulo === 'Certidão do condomínio', 'para um lado só, o rótulo não repete quem é');
});
passo('divórcio, união e pacto: cada parte recebe só o seu bloco; "os dois" traz as duas', () => {
  const papeis = (tipo, papel) => P.formulario({tipo, papel}).find((b) => b.k === 'pessoa').papeis;
  assert.deepEqual(papeis('Divórcio', 'div2'), ['Divorciando(a) 2']);
  assert.deepEqual(papeis('Divórcio', 'ambos'), ['Divorciando(a) 1', 'Divorciando(a) 2']);
  assert.deepEqual(papeis('União Estável', 'conv1'), ['Convivente 1']);
  assert.deepEqual(papeis('Pacto Antenupcial', 'noivo2'), ['Noivo(a) 2']);
  assert.deepEqual(P.formulario({tipo: 'Procuração', papel: 'outorgante'}).filter((b) => b.k === 'pessoa').map((b) => b.papeis[0]), ['Outorgante']);
});
passo('só a lista de inventário marca a pessoa para pedir o óbito do cônjuge', () => {
  const marca = (tipo) => P.formulario({tipo, publico: 'advogado'}).filter((b) => b.k === 'pessoa').some((b) => b.obito);
  assert(marca('Inventário') && !marca('Escritura de Compra e Venda') && !marca('Doação') && !marca('Divórcio'));
});
console.log(erros ? '\n' + erros + ' falha(s)' : '\ntudo certo');
process.exit(erros ? 1 : 0);
