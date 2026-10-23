// Onde estão o Playwright e o Chromium nesta máquina.
//
// Os dois já mudaram de lugar entre uma sessão e outra (o Chromium saiu de
// chromium-1194/chrome-linux para chromium-1243/chrome-linux64), e um caminho
// fixo fazia as três suítes falharem por um motivo que não é do painel.
// Aqui a gente procura, em vez de supor.
import {readdirSync, existsSync} from 'node:fs';

const CANTOS_PLAYWRIGHT = [
  'playwright',
  '/opt/node22/lib/node_modules/playwright/index.mjs',
  '/usr/lib/node_modules/playwright/index.mjs'
];

export async function abrirChromium(opcoes = {}) {
  let playwright = null;
  for (const canto of CANTOS_PLAYWRIGHT) {
    try { playwright = await import(canto); break; } catch { /* tenta o próximo */ }
  }
  if (!playwright) throw new Error('não achei o Playwright nesta máquina');
  return playwright.chromium.launch({executablePath: acharChromium(), ...opcoes});
}

function acharChromium() {
  const base = '/opt/pw-browsers';
  if (!existsSync(base)) return undefined;   // deixa o Playwright achar sozinho
  const pastas = readdirSync(base)
    .filter(n => n.startsWith('chromium-'))
    .sort((a, b) => (parseInt(b.split('-')[1]) || 0) - (parseInt(a.split('-')[1]) || 0));
  for (const pasta of pastas) {
    for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const caminho = `${base}/${pasta}/${sub}`;
      if (existsSync(caminho)) return caminho;
    }
  }
  return undefined;
}
