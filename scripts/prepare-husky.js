/* Skip Husky on Vercel to speed installs and avoid hook setup on ephemeral clones. */
if (process.env.VERCEL === '1') {
  process.exit(0);
}

const path = require('path');
const { execSync } = require('child_process');

const binDir = path.join(__dirname, '..', 'node_modules', '.bin');
const env = {
  ...process.env,
  PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`
};

try {
  execSync('husky install', {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32'
  });
} catch {
  process.exit(0);
}
