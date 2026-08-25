// Monta as páginas de teste a partir do index.html de verdade.
//
// O painel é um arquivo só, e o financeiro é um bloco dentro dele. Em vez de
// manter uma cópia do bloco aqui (que envelheceria em silêncio e passaria a
// testar código que não está no ar), este script recorta o bloco do próprio
// index.html a cada execução. Se o teste passa, passou no que está publicado.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(AQUI, '..', 'index.html'), 'utf8');

function entre(inicio, fim, incluirFim = false) {
  const a = html.indexOf(inicio);
  if (a === -1) throw new Error('não achei no index.html: ' + inicio.slice(0, 50));
  const b = html.indexOf(fim, a);
  if (b === -1) throw new Error('não achei o fim de: ' + inicio.slice(0, 50));
  return html.slice(a, incluirFim ? b + fim.length : b);
}

const estilo  = entre('<style>', '</style>', true);
const markup  = entre('<!-- Financeiro — a esteira do dinheiro', '<script src="design-system/mascots/joaninha/joaninha.js">');
const atalho  = entre('<div class="fin-atalho-mobile">', '<div class="central-nova">');
// o bloco de código começa no comentário de acesso e termina no service worker
const iJs = html.lastIndexOf('\n', html.indexOf('// ── Quem pode ver o dinheiro')) + 1;
const codigo = html.slice(iJs, html.indexOf("\n\nif('serviceWorker' in navigator){"));
// O quadro mora fora do bloco financeiro, mas os cartões do dinheiro se
// penduram nele — daqui saem só os quatro ajudantes de que eles precisam
// (o cartão, a legenda, o plural e o estado da tabela), recortados do mesmo
// index.html pra não virarem cópia.
const doQuadro = entre('let quadroTabela=false;', '// esc() do painel')
               + entre('function dashPlural(', '// 1. ONDE OS CASOS TRAVAM');

// A Rede mora fora do bloco financeiro (depois do service worker), e tem
// harness próprio: ela precisa do markup do modal e do código dela, mas
// também do financeiro, de onde vêm o login, o finEhDona e o finToast.
const redeMarkup = entre('<!-- A Rede — prospecção.', '<script src="design-system/mascots/joaninha/joaninha.js">');
const redeCodigo = html.slice(html.indexOf('// ══ A REDE ═'), html.lastIndexOf('</script>'));

const fazDeContaNav = readFileSync(join(AQUI, 'faz-de-conta-navegador.js'), 'utf8');
const fazDeContaNode = readFileSync(join(AQUI, 'faz-de-conta-node.js'), 'utf8');

const CABECA = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">'
  + '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
const FONTES = '<link href="https://fonts.googleapis.com/css2?family=Jost:wght@200;300;400;500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">'
  + '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">';

function pagina({fontes = '', corpo = '', semente = '', rodape = ''}) {
  return CABECA + fontes + estilo + '</head><body><div class="nav-toast" id="nav-toast"></div>'
    + corpo + markup + '<script type="module">' + fazDeContaNav + semente + doQuadro + codigo + rodape
    + '\nwindow.__pronto=true;\n</script></body></html>';
}

// A casca do painel, com um card de mentira: é por ele que o teste digita o
// número de controle e confere a faixa do financeiro.
// O #cdc-quadro é o mesmo buraco em que o painel escreve o quadro: lá o
// renderQuadro despeja o que finQuadroHtml() devolve, e aqui o teste despeja
// a mesma coisa — sem arrastar os quatro cartões de casos, que não são deste
// bloco.
const casca = '<div class="app-shell"><aside class="sidebar"></aside><div class="main-area"><div class="container">'
  + atalho + '<div class="central-nova"><div class="cx-fin" id="cartao-teste"></div></div>'
  + '<div class="modal-box" style="max-width:940px;margin-top:20px"><div id="cdc-quadro"></div></div>'
  + '</div></div></div>';

writeFileSync(join(AQUI, 'harness.html'), pagina({corpo: casca}));

// O preview usa o fechamento real de agosto de 2026 — as dezessete escrituras
// que a Shirley conferiu à mão. É com ele que se olha o desenho da tela.
const semente = readFileSync(join(AQUI, 'fechamento-de-agosto.js'), 'utf8');
writeFileSync(join(AQUI, 'preview.html'), pagina({fontes: FONTES, semente}));

// O quadro do dinheiro, com dois fechamentos no banco — sem um mês anterior
// não há evolução que desenhar. A senha do login de mentira é 'certa'.
writeFileSync(join(AQUI, 'preview-quadro.html'), pagina({
  fontes: FONTES,
  // Sem a lateral do painel: no ar o quadro é um modal por cima da tela
  // inteira, e desenhar num container estreito daria uma medida que não é a
  // que ela vai ver.
  corpo: '<div style="min-height:100vh;padding:26px 20px;display:flex;justify-content:center;align-items:flex-start;background:rgba(22,40,58,.35)">'
    + '<div class="modal-box" style="max-width:940px;width:100%"><div class="modal-title">O quadro</div>'
    + '<div class="modal-sub">Como estamos indo — os casos ativos lidos em quatro cortes, e o fechamento em dinheiro.</div>'
    + '<div id="cdc-quadro"></div></div></div>',
  semente: semente + readFileSync(join(AQUI, 'fechamento-de-julho.js'), 'utf8'),
  rodape: `
await signInWithEmailAndPassword(auth,'cartorio@shirleydantas.com','certa');
setTimeout(()=>{document.getElementById('cdc-quadro').innerHTML=finQuadroHtml();},60);
`}));

// E a versão sem navegador, para as verificações de conta.
writeFileSync(join(AQUI, 'calculo.gerado.mjs'),
  fazDeContaNode + codigo + readFileSync(join(AQUI, 'calculo.js'), 'utf8'));

// ── A Rede ──
// Precisa do markup do modal e de um lugar para o botão da lateral existir,
// senão atualizarSidebarRede() não teria o que mostrar.
writeFileSync(join(AQUI, 'harness-rede.html'),
  CABECA + FONTES + estilo + '</head><body><div class="nav-toast" id="nav-toast"></div>'
  + '<aside class="sidebar"><button type="button" class="sidebar-item" id="sidebar-rede" style="display:none" onclick="abrirRede()"><span>Rede</span></button></aside>'
  + '<div class="fin-atalho-mobile"><button type="button" class="fin-atalho" id="fin-atalho-rede" style="display:none" onclick="abrirRede()"><span>Rede</span></button></div>'
  + redeMarkup + markup
  + '<script type="module">' + fazDeContaNav + codigo + redeCodigo
  + '\nwindow.__pronto=true;\n</script></body></html>');

mkdirSync(join(AQUI, 'saida'), {recursive: true});
console.log('montado a partir do index.html · ' + codigo.split('\n').length + ' linhas de financeiro');
