/**
 * Verificação do painel — carrega o index.html DE VERDADE no Chromium, com o
 * Firebase trocado por um banco em memória, e confere o que passa despercebido
 * numa olhada na tela.
 *
 *   node dev/verificar-painel.mjs
 *
 * Sai com código 1 se alguma checagem falhar, então serve em CI também.
 *
 * Por que isto existe: o index.html tem ~3.500 linhas e funções não
 * relacionadas moram coladas umas nas outras. Já aconteceu de uma edição levar
 * junto `mudarCampo` — sem ela NENHUM campo de card salva, e a tela continua
 * parecendo perfeita. A checagem de paridade (1) pega exatamente isso.
 *
 * As checagens:
 *   1. paridade  — nenhuma função sumiu em relação ao último commit
 *   2. handlers  — todo onclick/onchange resolve numa função de window
 *   3. campos    — os campos e botões do card de caso continuam presentes
 *   4. estado    — painéis abertos sobrevivem a um re-render de outra pessoa
 *   5. layout    — nada estoura a página em desktop e celular
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const INDEX = path.join(RAIZ, 'index.html');

// O Chromium do ambiente, quando existe, evita baixar um browser inteiro.
const CHROMIUM = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium']
  .find(p => existsSync(p));

let falhas = 0;
const ok   = (t, extra = '') => console.log(`  ✓ ${t}${extra ? '  ' + extra : ''}`);
const erro = (t, extra = '') => { falhas++; console.log(`  ✗ ${t}${extra ? '  ' + extra : ''}`); };

// ── 1. PARIDADE DE FUNÇÕES ────────────────────────────────────────────────
// Compara com o commit anterior em vez de com uma lista fixa: a lista fixa
// envelhece e vira mentira; o git é sempre a verdade do que existia ontem.
console.log('\n1. Paridade de funções (contra HEAD)');
{
  const nomes = (txt) => ({
    window:   new Set([...txt.matchAll(/window\.([a-zA-Z_$][\w$]*)\s*=/g)].map(m => m[1])),
    funcao:   new Set([...txt.matchAll(/^function ([a-zA-Z_$][\w$]*)/gm)].map(m => m[1])),
  });
  const agora = nomes(readFileSync(INDEX, 'utf8'));
  let antes;
  try { antes = nomes(execSync('git show HEAD:index.html', { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 26 })); }
  catch { antes = null; }

  if (!antes) console.log('  – sem HEAD para comparar (repositório novo?)');
  else for (const tipo of ['window', 'funcao']) {
    const sumiram = [...antes[tipo]].filter(n => !agora[tipo].has(n));
    sumiram.length ? erro(`${tipo}: sumiram`, sumiram.join(', ')) : ok(`${tipo}: nada sumiu`);
  }
}

// ── Firebase falso ────────────────────────────────────────────────────────
// Mesma assinatura do SDK. Grava de verdade e reemite pros listeners, que é o
// que faz o painel redesenhar — sem isso a checagem 4 não testaria nada.
// Assíncrono de propósito: um stub síncrono dispara callbacks antes das
// declarações `let` do fim do arquivo existirem (erro de TDZ que não acontece
// em produção).
const STUB_DB = `
  const __ouvintes=[];
  const __p=(r)=>typeof r==='string'?r:(r&&r.path)||'';
  const __ler=(p)=>{ if(!p)return null; let n=window.__FAKE;
    for(const k of p.split('/')){ if(n==null||typeof n!=='object')return null; n=n[k]; }
    return n===undefined?null:n; };
  const __gravar=(p,v)=>{ const ks=p.split('/'); let n=window.__FAKE;
    for(let i=0;i<ks.length-1;i++){ if(typeof n[ks[i]]!=='object'||n[ks[i]]===null)n[ks[i]]={}; n=n[ks[i]]; }
    if(v===null)delete n[ks.at(-1)]; else n[ks.at(-1)]=v; };
  const __emitir=()=>__ouvintes.forEach(([p,cb])=>cb({val:()=>__ler(p)}));
  export const initializeApp=()=>({});
  export const getDatabase=()=>({});
  export const getStorage=()=>({});
  export const uploadBytes=async()=>({});
  export const getDownloadURL=async()=>'';
  export const ref=(db,path)=>({path:typeof db==='string'?db:(path||'')});
  export const onValue=(r,cb)=>{ const p=__p(r); __ouvintes.push([p,cb]);
    setTimeout(()=>cb({val:()=>__ler(p)}),0); return ()=>{}; };
  export const set=(r,v)=>{ __gravar(__p(r),v); setTimeout(__emitir,0); return Promise.resolve(); };
  export const remove=(r)=>{ __gravar(__p(r),null); setTimeout(__emitir,0); return Promise.resolve(); };
  export const update=(r,v)=>{ const b=__p(r);
    Object.entries(v||{}).forEach(([k,val])=>__gravar(b?b+'/'+k:k,val));
    setTimeout(__emitir,0); return Promise.resolve(); };
  export const push=()=>({key:'n'+Math.random().toString(36).slice(2,9)});
`;

const dias = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const hora = (d, h) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, 30, 0, 0); return x.toISOString().slice(0, 16); };

// Casos com forma real: etapas que existem no DEP_CONFIG, um caso sem etapa,
// um com segunda parte, um concluído, um com dados de registro preenchidos.
const DADOS = {
  casos: {
    c1: { id:'c1', nome:'Alfredo Patrão | ABG', tipo:'Inventário', status:'critico', resp:'shirley', dep:'Minutando', depDesde:dias(9), atualizado:dias(9), obs:'1 - [12/08] Exigiu sobrepartilha.', concluido:false, driveUrl:'https://drive.google.com/x', segundaParte:{status:'pendente',quem:'Banco'}, obsAnterior:'anterior' },
    c2: { id:'c2', nome:'Gustavo Bertola', tipo:'Compra e Venda', status:'atencao', resp:'grazi', dep:'Aguardando TQ', depDesde:dias(21), atualizado:dias(21), obs:'', concluido:false },
    c3: { id:'c3', nome:'Dr. Vitor Leite', tipo:'Escritura', status:'atencao', resp:'shirley', dep:'Travar agenda', depDesde:dias(1), atualizado:dias(1), agendado:hora(0,15), obs:'', concluido:false },
    c4: { id:'c4', nome:'B3 | Procuração', tipo:'Procuração', status:'emdia', resp:'shirley', dep:'Aguardando cliente (outro)', depDesde:dias(4), atualizado:dias(4), obs:'', concluido:false },
    c5: { id:'c5', nome:'Leila Prado', tipo:'Permuta', status:'emdia', resp:'gabriel', dep:'', depDesde:dias(0), atualizado:dias(0), obs:'', concluido:false },
    c7:  { id:'c7',  nome:'Miguel | Un. 2216', tipo:'Confissão de Dívida', status:'critico', resp:'grazi', dep:'Minutando', depDesde:dias(5), atualizado:dias(5), obs:'', concluido:false },
    c8:  { id:'c8',  nome:'Rejane Gregorio', tipo:'Cessão', status:'atencao', resp:'shirley', dep:'Falta documentos', depDesde:dias(12), atualizado:dias(12), obs:'1 - [01/08] Faltam dados bancários.', concluido:false },
    c9:  { id:'c9',  nome:'Fabio / Julia', tipo:'Baixa de Hipoteca', status:'atencao', resp:'gabriel', dep:'Aguardando TQ', depDesde:dias(8), atualizado:dias(8), obs:'', concluido:false },
    c10: { id:'c10', nome:'Espólio Nascimento', tipo:'Inventário', status:'prioridade', resp:'shirley', dep:'Traslado pronto — providenciar envio', depDesde:dias(5), atualizado:dias(5), obs:'', concluido:false },
    c11: { id:'c11', nome:'Condomínio Vista Verde', tipo:'Ata Notarial', status:'atencao', resp:'gabriel', dep:'Nota de exigência', depDesde:dias(3), atualizado:dias(3), obs:'', concluido:false },
    c12: { id:'c12', nome:'Juliana Halabi', tipo:'Baixa de Hipoteca', status:'emdia', resp:'grazi', dep:'Registro de Imóveis', depDesde:dias(34), atualizado:dias(6), obs:'', concluido:false },
    c6: { id:'c6', nome:'Marina Coutinho', tipo:'Compra e Venda', status:'emdia', resp:'gabriel', dep:'Concluído', depDesde:dias(11), atualizado:dias(11), obs:'', concluido:true, registroPrenotado:'141.007', livro:'2-AE', folha:'203' },
  },
  focos: {
    f1: { id:'f1', text:'Ligar sobre o TQ', casoNome:'Gustavo Bertola', resp:'grazi', quando:hora(-1,16), done:false },
    f2: { id:'f2', text:'Conferir ITBI', casoNome:'', resp:'shirley', urgente:true, done:false },
  },
  resolucoesCentral: {}, lembretes: {}, meta: { historicoDesde: dias(0) },
};

const navegador = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
const pagina = await navegador.newPage({ viewport: { width: 1440, height: 1200 } });
const errosJs = [];
pagina.on('pageerror', e => errosJs.push(e.message));
pagina.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errosJs.push(m.text()); });

await pagina.addInitScript(d => { window.__FAKE = d; localStorage.setItem('painel_usuario', 'Shirley'); }, DADOS);
await pagina.route('**/firebase-*.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: STUB_DB }));
await pagina.goto('file://' + INDEX);
await pagina.waitForTimeout(2500);

// ── 2. HANDLERS ───────────────────────────────────────────────────────────
console.log('\n2. Handlers inline resolvem em window');
{
  const usados = await pagina.evaluate(() => {
    const n = new Set();
    document.querySelectorAll('[onclick],[onchange],[oninput]').forEach(el =>
      ['onclick','onchange','oninput'].forEach(a => {
        // Tira os literais de string antes de procurar: nomes de etapa como
        // "Aguardando cliente (outro)" casavam com o padrão de chamada e viravam
        // uma função inexistente chamada "cliente".
        const v = (el.getAttribute(a) || '').replace(/'[^']*'|"[^"]*"/g, "''");
        [...v.matchAll(/(?<![\w.$])([a-zA-Z_$][\w$]*)\s*\(/g)].forEach(m => n.add(m[1]));
      }));
    return [...n];
  });
  const ignorar = new Set(['event','stopPropagation','getElementById','if','document','open','querySelector']);
  const alvos = usados.filter(h => !ignorar.has(h));
  const faltando = await pagina.evaluate(ns => ns.filter(n => typeof window[n] !== 'function'), alvos);
  faltando.length ? erro('referenciados e inexistentes', faltando.join(', '))
                  : ok(`${alvos.length} handlers, todos resolvem`);
}

// ── 3. CAMPOS E BOTÕES DO CARD ────────────────────────────────────────────
console.log('\n3. Card de caso — campos e ações');
{
  const CAMPOS = ['tipo','status','dep','resp','agendado','registroPrenotado','prenotacao','livro','folha','controle'];
  const BOTOES = ['Minuta','Drive','Obs','2ª parte','Reeditar','Atendimento','Excluir','Concluir','Desfazer'];
  const achado = await pagina.evaluate(() => {
    const c = document.getElementById('card-c1');
    if (!c) return null;
    return {
      campos: [...c.querySelectorAll('[onchange]')]
        .map(e => (e.getAttribute('onchange').match(/'([a-zA-Z]+)',\s*this/) || [])[1]).filter(Boolean),
      botoes: [...c.querySelectorAll('button')].map(b => b.textContent.trim()),
    };
  });
  if (!achado) erro('card não renderizou');
  else {
    const semCampo = CAMPOS.filter(f => !achado.campos.includes(f));
    semCampo.length ? erro('campos ausentes', semCampo.join(', ')) : ok(`${CAMPOS.length} campos editáveis presentes`);
    const semBotao = BOTOES.filter(b => !achado.botoes.some(t => t.includes(b)));
    semBotao.length ? erro('botões ausentes', semBotao.join(', ')) : ok(`${BOTOES.length} botões presentes`);
  }
}

// ── 4. ESTADO SOBREVIVE A RE-RENDER ───────────────────────────────────────
// O painel redesenha inteiro quando qualquer pessoa da equipe edita algo. O
// que o usuário deixou aberto não pode fechar sozinho na cara dele.
console.log('\n4. Estado aberto sobrevive a edição de outra pessoa');
{
  const abrir = async (sel) => { const el = await pagina.$(sel); if (el) { await el.click(); await pagina.waitForTimeout(150); } };
  await abrir('.cc-item .cc-item-gatilho');
  await abrir('.cx-card .cx-reg-resumo');
  const antes = await pagina.evaluate(() => ({
    acoes: document.querySelectorAll('.cc-item.aberto').length,
    reg:   document.querySelectorAll('.cx-reg-campos.aberto').length,
  }));
  await pagina.evaluate(() => window.mudarCampo('c4', 'resp', 'gabriel'));
  await pagina.waitForTimeout(500);
  const depois = await pagina.evaluate(() => ({
    acoes: document.querySelectorAll('.cc-item.aberto').length,
    reg:   document.querySelectorAll('.cx-reg-campos.aberto').length,
  }));
  if (!antes.acoes) erro('nada abriu — a checagem não testou nada (dataset pequeno demais?)');
  else depois.acoes >= antes.acoes ? ok('ações da Central seguem abertas')
    : erro('ações fecharam sozinhas', `${antes.acoes} → ${depois.acoes}`);
  antes.reg && depois.reg >= antes.reg ? ok('dados do registro seguem abertos')
    : erro('registro fechou sozinho', `${antes.reg} → ${depois.reg}`);
}

// ── 5. LAYOUT ─────────────────────────────────────────────────────────────
console.log('\n5. Layout em desktop e celular');
for (const [nome, w] of [['desktop', 1440], ['celular', 390]]) {
  await pagina.setViewportSize({ width: w, height: 1200 });
  await pagina.waitForTimeout(400);
  const r = await pagina.evaluate(() => ({
    rolagem: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    cortados: [...document.querySelectorAll('.sidebar-item span:not(.sidebar-count):not(.em-breve)')]
      .filter(e => e.scrollWidth > Math.ceil(e.getBoundingClientRect().width) + 1).map(e => e.textContent),
  }));
  r.rolagem ? erro(`${nome}: página rola na horizontal`) : ok(`${nome}: sem rolagem horizontal`);
  r.cortados.length ? erro(`${nome}: rótulos cortados`, r.cortados.join(', ')) : ok(`${nome}: rótulos inteiros`);
}

// ── Erros de JS ───────────────────────────────────────────────────────────
console.log('\n6. Console limpo');
errosJs.length ? erro(`${errosJs.length} erro(s) de JS`, [...new Set(errosJs)].slice(0, 4).join(' | '))
               : ok('nenhum erro de JS');

await navegador.close();
console.log(falhas ? `\n${falhas} checagem(ns) falharam.\n` : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
