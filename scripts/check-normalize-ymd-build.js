const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const api = path.join(ROOT, 'src/app/api');
const util = require(path.join(ROOT, 'src/utils/normalizeYmd'));

const exportsUsed = new Set();
const issues = [];
const modified = [];

for (const d of fs.readdirSync(api)) {
  const file = path.join(api, d, 'route.js');
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes('utils/normalizeYmd')) continue;
  modified.push(d);

  const mImport = src.match(
    /import\s*\{\s*(\w+)(?:\s+as\s+(\w+))?\s*\}\s*from\s*['"][^'"]*normalizeYmd['"]/
  );
  const mReq = src.match(
    /const\s*\{\s*(\w+)(?:\s*:\s*(\w+))?\s*\}\s*=\s*require\(['"][^'"]*normalizeYmd['"]\)/
  );

  let exported;
  let local;
  if (mImport) {
    exported = mImport[1];
    local = mImport[2] || mImport[1];
  } else if (mReq) {
    exported = mReq[1];
    local = mReq[2] || mReq[1];
  } else {
    issues.push(`${d}: cannot parse normalizeYmd import`);
    continue;
  }

  if (typeof util[exported] !== 'function') {
    issues.push(`${d}: missing export ${exported}`);
  }
  exportsUsed.add(exported);

  const callRe = new RegExp(`\\b${local}\\s*\\(`, 'g');
  const uses = (src.match(callRe) || []).length;
  if (uses === 0) {
    issues.push(`${d}: imported ${local} never called`);
  }

  // extra unused imports in file related to normalize? none expected
}

const allExports = Object.keys(util);
const unusedExports = allExports.filter((e) => !exportsUsed.has(e));

console.log('Modified APIs:', modified.length);
console.log('Exports used:', [...exportsUsed].sort().join(', '));
console.log('Unused util exports:', unusedExports.length ? unusedExports.join(', ') : '(none)');
console.log('Import/usage issues:', issues.length ? issues : '(none)');

const nextServer = path.join(ROOT, '.next/server');
const missingCompiled = [];
for (const d of modified) {
  const compiled = path.join(nextServer, 'app', 'api', d, 'route.js');
  if (!fs.existsSync(compiled)) missingCompiled.push(d);
}
console.log(
  'Missing compiled route.js:',
  missingCompiled.length ? missingCompiled.join(', ') : '(none)'
);

// Try requiring compiled bundles would fail (ESM). Instead check file size > 0
let emptyCompiled = [];
for (const d of modified) {
  const compiled = path.join(nextServer, 'app', 'api', d, 'route.js');
  if (fs.existsSync(compiled) && fs.statSync(compiled).size < 100) emptyCompiled.push(d);
}
console.log('Empty/tiny compiled routes:', emptyCompiled.length ? emptyCompiled : '(none)');

// Search standalone for util
const standaloneUtilHints = [];
function walk(dir, n = 0) {
  if (!fs.existsSync(dir) || n > 8) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, n + 1);
    else if (ent.name.includes('normalizeYmd') || (ent.name.endsWith('.js') && n < 6)) {
      if (ent.name.includes('normalizeYmd')) standaloneUtilHints.push(p);
    }
  }
}
walk(path.join(ROOT, '.next'));
console.log(
  'Build artifacts named normalizeYmd*:',
  standaloneUtilHints.length ? standaloneUtilHints.slice(0, 20) : '(bundled into chunks, no separate file)'
);

process.exit(issues.length || missingCompiled.length ? 1 : 0);
