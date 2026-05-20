/**
 * Ensures `eslint-plugin-angular-rubic` exists under node_modules.
 * The package is declared as `file:angular-eslint-rubic`; on some installs the
 * link/copy into node_modules can be missing or empty, which breaks ESLint.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'angular-eslint-rubic');
const dest = path.join(root, 'node_modules', 'eslint-plugin-angular-rubic');
const srcPkg = path.join(src, 'package.json');
const nodeModules = path.join(root, 'node_modules');

if (!fs.existsSync(srcPkg)) {
  console.warn(
    '[ensure-eslint-plugin-angular-rubic] Skip: angular-eslint-rubic not found at',
    src
  );
  process.exit(0);
}

if (!fs.existsSync(nodeModules)) {
  console.warn(
    '[ensure-eslint-plugin-angular-rubic] Skip: node_modules missing (run npm install first).'
  );
  process.exit(0);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(
  '[ensure-eslint-plugin-angular-rubic] Installed local plugin at node_modules/eslint-plugin-angular-rubic'
);
