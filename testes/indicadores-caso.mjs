import assert from 'node:assert/strict';
import test from 'node:test';
import {indicadoresCaso,pedidoCertidao,servicoDocumento} from '../lib/indicadores-caso.js';
test('conta arquivos efetivos e distingue matrícula recebida de certidão emitida',()=>{
 const c={documentos:{a:{nome:'RG.pdf'},b:{tipo:'modelo'},c:{tipo:'informacoes'},d:{provisorio:true},e:{tipoDocumento:'MATRICULA_IMOVEL'},f:{tipoDocumento:'FICHA_CADASTRAL_JUCESP'}}};
 const antes=JSON.stringify(c),r=indicadoresCaso(c);assert.equal(r.Documentos.salvos,3);assert.equal(r.Certidões.salvos,1);assert.equal(r.matricula.salvos,0);assert.equal(r['jucesp:ficha'].salvos,1);assert.equal(JSON.stringify(c),antes);
 assert.equal(servicoDocumento({nome:'Certidão Trabalhista.pdf'}),'','não adivinha pelo nome');
 assert.equal(servicoDocumento({nomeOriginal:'RIDIGITAL_ATUALIZADA_123.pdf'}),'matricula:certidao');
 assert.equal(servicoDocumento({certidaoServico:'trabalhista'}),'trabalhista');
});
test('solicitações guardadas sobrevivem à releitura, sem virar arquivo disponível',()=>{
 const p=pedidoCertidao({id:'ajteste1',cnpj:'12345678000199',quero:['ficha','contrato']});assert.deepEqual(p.servicos,['jucesp:ficha','jucesp:contrato']);
 const c=JSON.parse(JSON.stringify({certidoesPedidos:{ajteste1:{...p,solicitadoEm:100}}}));const r=indicadoresCaso(c);assert.equal(r.Certidões.salvos,0);assert.equal(r['jucesp:ficha'].solicitadas,1);
 assert.equal(pedidoCertidao({id:'../x',cnpj:'123',quero:['ficha']}),null);assert.equal(pedidoCertidao({id:'ajteste',site:'desconhecido'}),null);
 assert.deepEqual(pedidoCertidao({id:'ajteste',site:'pref',servico:'negativa-iptu',sql:'123'}).servicos,['negativa']);
 assert.deepEqual(pedidoCertidao({id:'ajteste',site:'onr',servico:'certidao',matriculas:['123']}).servicos,['matricula:certidao']);
});
test('arquivo correto encerra a pendência; documento antigo ou de outro titular não encerra',()=>{
 const p={servicos:['trabalhista'],sujeito:'Maria',estado:'aguardandoArquivo',solicitadoEm:2000};
 const c={certidoesPedidos:{a:p},documentos:{d:{certidaoServico:'trabalhista',certidaoSujeito:'Ana',salvoEm:new Date(3000).toISOString()}}};
 assert.equal(indicadoresCaso(c).trabalhista.solicitadas,1);c.documentos.d.certidaoSujeito='Maria';c.documentos.d.salvoEm=new Date(1000).toISOString();assert.equal(indicadoresCaso(c).trabalhista.solicitadas,1);
 c.documentos.d.salvoEm=new Date(3000).toISOString();assert.equal(indicadoresCaso(c).trabalhista.solicitadas,0);assert.equal(indicadoresCaso(c).trabalhista.salvos,1);
 delete c.documentos.d;assert.equal(indicadoresCaso(c).trabalhista.salvos,0);
});
test('último pedido por titular prevalece, cancelamento não é pendência e falha não é sucesso',()=>{
 const c={certidoesPedidos:{a:{servicos:['valor'],sujeito:'123',estado:'erro',solicitadoEm:1},b:{servicos:['valor'],sujeito:'123',estado:'cancelada',solicitadoEm:2},c:{servicos:['valor'],sujeito:'456',estado:'erro',solicitadoEm:3}}};
 const r=indicadoresCaso(c).valor;assert.equal(r.erros,1);assert.equal(r.solicitadas,0);assert.equal(r.salvos,0);
});
test('matrícula atualizada só encerra após retorno e arquivos de todas as matrículas pedidas',()=>{
 const c={certidoesPedidos:{a:{servicos:['matricula:certidao'],matriculas:['123','456'],estado:'aguardandoArquivo',solicitadoEm:1000}},documentos:{a:{nomeOriginal:'RIDIGITAL_ATUALIZADA_123.pdf',salvoEm:new Date(2000).toISOString()}}};
 assert.equal(indicadoresCaso(c)['matricula:certidao'].solicitadas,1);
 c.documentos.b={nomeOriginal:'RIDIGITAL_ATUALIZADA_4567.pdf',salvoEm:new Date(2000).toISOString()};assert.equal(indicadoresCaso(c)['matricula:certidao'].solicitadas,1);
 c.documentos.b.nomeOriginal='RIDIGITAL_ATUALIZADA_456.pdf';assert.equal(indicadoresCaso(c)['matricula:certidao'].solicitadas,0);
});
