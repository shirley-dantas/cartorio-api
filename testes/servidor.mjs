// Servidor mínimo: o Chromium precisa de http:// para o crypto.subtle
// funcionar (em file:// ele não é considerado contexto seguro, e o cofre
// pessoal deixaria de abrir no teste por um motivo que não é do painel).
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const TIPOS = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png'};

export function servir(porta = 8199) {
  const s = createServer((req, res) => {
    const nome = (req.url || '/').split('?')[0].replace(/^\//, '') || 'harness.html';
    try {
      const corpo = readFileSync(join(AQUI, nome));
      res.writeHead(200, {'Content-Type': TIPOS[nome.slice(nome.lastIndexOf('.'))] || 'text/plain'});
      res.end(corpo);
    } catch {
      res.writeHead(404).end('não achei');
    }
  });
  return new Promise(ok => s.listen(porta, '127.0.0.1', () => ok(s)));
}
