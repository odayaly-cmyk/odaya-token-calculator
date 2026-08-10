const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'token'), { recursive: true });
const files = ['index.html', 'styles.css', 'calc.js', 'app.js'];
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file));
  fs.writeFileSync(path.join(dist, file), source);
  fs.writeFileSync(path.join(dist, 'token', file), source);
}
fs.writeFileSync(path.join(dist, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: default-src \'self\'; style-src \'self\' \'unsafe-inline\'; script-src \'self\'; img-src \'self\' data:; connect-src \'none\'; frame-ancestors \'none\'; base-uri \'self\'; form-action \'none\'\n');
fs.writeFileSync(path.join(dist, '_redirects'), '/token /token/ 301\n');
console.log(`Built ${files.length * 2 + 2} files into ${dist}`);
