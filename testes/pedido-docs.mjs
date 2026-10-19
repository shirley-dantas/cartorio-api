// O catálogo de "Pedir documentos": as regras dela, sem navegador.
//   node testes/pedido-docs.mjs
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const P = createRequire(import.meta.url)('../pedido-docs.js');
let erros = 0;
const passo = (n, f) => { try { f(); console.log('  ok  ' + n); } catch (e) { erros++; console.log('FALHA ' + n + ' → ' + e.message); } };
const txt = (e) => P.comporTexto({publico: 'cliente', ...e});
const itens = (e) => P.montar({publico: 'cliente', ...e}).flatMap(s => s.itens.map(i => i.texto));

passo('nunca pede certidão "atualizada" nem prazo de 90 dias', () => {
  for (const tipo of Object.keys(P.MODELO_DO_TIPO)) for (const publico of Object.keys(P.PUBLICOS))
    assert(!/atualizad|90 dias/i.test(txt({tipo, publico, bens: {urbano: true}, partilha: true, pacto: true, uniaoEstavel: true})), tipo + '/' + publico);
});
passo('casado: pede os dados do cônjuge e diz que a certidão é uma só', () => {
  const t = txt({tipo: 'Escritura de Compra e Venda'});
  assert(/mesmos dados do cônjuge/.test(t) && /uma só, do casal/.test(t));
});
passo('divorciandos: uma certidão de casamento só, e sem pedir "cônjuge" de novo', () => {
  const v = itens({tipo: 'Divórcio'});
  assert.equal(v.filter(t => /certidão de casamento/i.test(t)).length, 1);
  assert(!v.some(t => /mesmos dados do cônjuge/.test(t)));
});
passo('inventário: só pede os documentos dos bens marcados', () => {
  assert(!txt({tipo: 'Inventário'}).includes('Matrícula'));
  const casa = txt({tipo: 'Inventário', bens: {urbano: true}});
  assert(casa.includes('Matrícula do imóvel urbano') && !/veículo|extrato|joias|ITR/i.test(casa));
  const rural = txt({tipo: 'Inventário', bens: {rural: true}});
  assert(rural.includes('ITR') && rural.includes('CCIR'));
});
passo('pacto marcado em outro ato: pede o pacto E o registro no RI do primeiro domicílio', () => {
  const t = txt({tipo: 'Escritura de Compra e Venda', pacto: true});
  assert(/pacto antenupcial/.test(t) && /Registro de Imóveis do primeiro domicílio/.test(t));
});
passo('na escritura DE pacto não se pede o registro, só certidões do casal', () => {
  const t = txt({tipo: 'Pacto Antenupcial', pacto: true});
  assert(!/Registro de Imóveis/.test(t) && /Certidão de nascimento/.test(t));
});
passo('união estável é documento marcável, não estado civil', () => {
  assert(!txt({tipo: 'Escritura de Compra e Venda'}).includes('Livro E'));
  assert(txt({tipo: 'Escritura de Compra e Venda', uniaoEstavel: true}).includes('Livro E'));
  assert(!/união estável/i.test(txt({tipo: 'Escritura de Compra e Venda'})), 'sem marcar, a união estável não aparece em lugar nenhum');
});
passo('compra e venda: valor só do comprador; banco das duas partes; corretor só dados e matrícula', () => {
  const por = (p) => P.montar({publico: 'cliente', tipo: 'Escritura de Compra e Venda'}).find(s => s.id === p).itens.map(i => i.texto).join('|');
  assert(!/Valor da transação/.test(por('vendedor')) && /Valor da transação/.test(por('comprador')));
  assert(/bancários/.test(por('vendedor')) && /bancários/.test(por('comprador')));
  const c = txt({tipo: 'Escritura de Compra e Venda', publico: 'corretor'});
  assert(/Matrícula/.test(c) && !/bancários|Valor da transação/.test(c));
  assert(!c.includes('Contrato, se houver'), 'o contrato nasce desmarcado');
});
passo('doação: cláusulas ou marcadas por ela, ou escolhidas pela pessoa', () => {
  assert(!txt({tipo: 'Doação'}).includes('Cláusulas'));
  const m = txt({tipo: 'Doação', marc: {'clausula.usufruto': true, 'clausula.reversao': true}});
  assert(/Cláusulas previstas: reserva de usufruto, cláusula de reversão/.test(m));
  assert(/Informe se deseja alguma destas cláusulas/.test(txt({tipo: 'Doação', clausulasModo: 'cliente'})));
});
passo('testamento: a certidão de inexistência de testamento nasce desmarcada', () => {
  assert(!txt({tipo: 'Inventário'}).includes('inexistência de testamento'));
});
passo('construtora: só os dados de quem comprou', () => {
  const t = txt({tipo: 'Escritura de Compra e Venda', publico: 'construtora'});
  assert(/DADOS DE QUEM COMPROU/.test(t) && !/Matrícula|bancários/.test(t));
});
passo('divórcio sem partilha não traz bens; com partilha traz', () => {
  assert(!txt({tipo: 'Divórcio', bens: {urbano: true}}).includes('Matrícula'));
  assert(txt({tipo: 'Divórcio', partilha: true, bens: {urbano: true}}).includes('Matrícula do imóvel urbano'));
});
passo('o link entra quando existe; sem ele, pede por aqui mesmo', () => {
  assert(txt({tipo: 'Doação'}).includes('por aqui mesmo'));
  assert(txt({tipo: 'Doação', link: 'https://x.y/z'}).includes('https://x.y/z'));
});
passo('item desmarcado some do texto; item acrescentado entra', () => {
  const conta = (t) => t.split('• Profissão').length - 1;
  assert.equal(conta(txt({tipo: 'Escritura de Compra e Venda'})), 2, 'vendedor e comprador pedem profissão');
  assert.equal(conta(txt({tipo: 'Escritura de Compra e Venda', marc: {'vendedor.prof': false}})), 1, 'desmarcar tira só a do vendedor');
  assert(txt({tipo: 'Escritura de Compra e Venda', extras: ['Declaração de quitação do condomínio']}).includes('• Declaração de quitação do condomínio'));
});
passo('a abertura usa o artigo certo', () => {
  assert(txt({tipo: 'Doação'}).includes('elaboração da Doação'));
  assert(txt({tipo: 'Inventário'}).includes('elaboração do Inventário'));
  assert(txt({tipo: 'Pacto Antenupcial'}).includes('elaboração do Pacto Antenupcial'));
});
console.log(erros ? '\n' + erros + ' falha(s)' : '\ntudo certo');
process.exit(erros ? 1 : 0);
