/**
 * Cross-platform postbuild: copy static/public into Next standalone output.
 * Replaces .postbuild.sh so Windows local builds work without bash.
 */
const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function rmDir(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

console.log('=== Post-build: Copying static files for standalone mode ===');
console.log('Current directory:', process.cwd());

const standalone = path.join('.next', 'standalone');
if (!fs.existsSync(standalone)) {
  console.error('Error: .next/standalone directory not found');
  try {
    console.error('Contents of .next:', fs.readdirSync('.next').join(', '));
  } catch {
    console.error('No .next directory found');
  }
  process.exit(1);
}

console.log('Found .next/standalone directory');
fs.mkdirSync(path.join(standalone, '.next'), { recursive: true });
console.log('Created .next/standalone/.next directory');

const staticSrc = path.join('.next', 'static');
const staticDest = path.join(standalone, '.next', 'static');
if (fs.existsSync(staticSrc)) {
  console.log('Copying .next/static to .next/standalone/.next/static...');
  rmDir(staticDest);
  copyDir(staticSrc, staticDest);
  console.log('Copied .next/static');
} else {
  console.warn('Warning: .next/static directory not found');
}

const publicSrc = 'public';
const publicDest = path.join(standalone, 'public');
if (fs.existsSync(publicSrc)) {
  console.log('Copying public folder to .next/standalone/public...');
  rmDir(publicDest);
  copyDir(publicSrc, publicDest);
  console.log('Copied public folder');
} else {
  console.warn('Warning: public directory not found');
}

if (fs.existsSync('package.json')) {
  console.log('Copying package.json to .next/standalone/package.json...');
  fs.copyFileSync('package.json', path.join(standalone, 'package.json'));
  console.log('Copied package.json');
}

if (fs.existsSync(path.join(standalone, 'server.js'))) {
  console.log('Verified server.js exists');
} else {
  console.error('Error: .next/standalone/server.js not found');
  process.exit(1);
}

console.log('=== Post-build completed successfully ===');
