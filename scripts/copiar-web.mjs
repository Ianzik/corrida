// Copia os arquivos do site (que vivem na raiz, para o GitHub Pages)
// para a pasta www/, que é de onde o Capacitor monta o app Android.
// Sem bundler: é só uma cópia.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const ITENS = ['index.html', 'manifest.json', 'sw.js', 'css', 'js', 'icons'];

rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const item of ITENS) cpSync(item, 'www/' + item, { recursive: true });
console.log('Arquivos web copiados para www/');
