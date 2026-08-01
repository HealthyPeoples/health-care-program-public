/**
 * @file 유지보수 스크립트 — verify-normalize-ymd
 *
 * @description
 * normalizeYmd 단위 검증
 *
 * @module scripts/verify-normalize-ymd
 */
/**
 * Verify normalizeYmd commonization against git HEAD originals.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const shared = require('../src/utils/normalizeYmd');

const ROOT = path.join(__dirname, '..');
const API = path.join(ROOT, 'src/app/api');

const KIND = {
  normalizeYmd: ['f00110', 'f00120', 'f00130', 'f01001', 'f01002', 'f60031', 'f90030'],
  normalizeYmdEmpty: ['f00132', 'f71030', 'f71031', 'f71040', 'f71041'],
  normalizeYmdOrNull: ['f01010', 'f40010'],
  normalizeYmdEmptyParse: ['f11060', 'f14110'],
  normalizeYmdEmptyYmd8: ['f11061'],
  normalizeYmdShort: ['f11080', 'f32010', 'f32020', 'f51010', 'f60020', 'f60040'],
  normalizeYmdStrict: ['f14030', 'f14040', 'f14050'],
  normalizeYmdEmptyRaw: ['f14070', 'v10010b', 'v40100', 'v40100d', 'v40100e'],
  normalizeYmdOrNullLoose: ['f40110'],
  normalizeYmdStrictPrefix: ['f51012', 'f51013', 'f51014', 'f51015'],
  normalizeYmdEmptyTz: ['f60010', 'f60030', 'f60060'],
};

const kindOf = {};
for (const [k, arr] of Object.entries(KIND)) {
  for (const n of arr) kindOf[n] = k;
}

const SAMPLES = [
  null,
  undefined,
  '',
  '   ',
  new Date(2024, 0, 2, 15, 30, 0),
  '2024-01-02',
  '2024-01-02T15:00:00',
  '2024-01-02T15:00:00.000Z',
  '20240102',
  '2024-01-02 extra',
  'not-a-date',
  'x',
  0,
  false,
];

function extractFn(src) {
  const re = /function\s+normalizeYmd\s*\([^)]*\)\s*\{/;
  const m = re.exec(src);
  if (!m) return null;
  let i = m.index + m[0].length;
  let depth = 1;
  while (i < src.length && depth > 0) {
    const c = src[i++];
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  return src.slice(m.index, i);
}

function loadOldFn(dir) {
  try {
    const src = execSync(`git show HEAD:src/app/api/${dir}/route.js`, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    const fnSrc = extractFn(src);
    if (!fnSrc) return null;
    // eslint-disable-next-line no-new-func
    const factory = new Function(`${fnSrc}\nreturn normalizeYmd;`);
    return factory();
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

function same(a, b) {
  if (Object.is(a, b)) return true;
  if (a instanceof Date || b instanceof Date) return false;
  return a === b;
}

const behaviorMismatches = [];
const importIssues = [];
const callSiteIssues = [];
const missingUtilImport = [];
const localFnLeft = [];

const dirs = Object.keys(kindOf).sort();

console.log('=== 1) Changed API list / import wiring ===');
for (const dir of dirs) {
  const file = path.join(API, dir, 'route.js');
  const src = fs.readFileSync(file, 'utf8');
  const kind = kindOf[dir];

  if (/function\s+normalizeYmd\s*\(/.test(src)) {
    localFnLeft.push(dir);
  }
  if (!src.includes('utils/normalizeYmd')) {
    missingUtilImport.push(dir);
  }

  const importOk =
    new RegExp(
      `(import\\s*\\{\\s*${kind}(?:\\s+as\\s+normalizeYmd)?\\s*\\}\\s*from\\s*['\"][^'\"]*normalizeYmd['\"]` +
        `|const\\s*\\{\\s*${kind}\\s*:\\s*normalizeYmd\\s*\\}\\s*=\\s*require\\(['\"][^'\"]*normalizeYmd['\"]\\))`
    ).test(src);

  if (!importOk) {
    importIssues.push({ dir, kind, snippet: src.split('\n').find((l) => l.includes('normalizeYmd') && (l.includes('import') || l.includes('require'))) });
  }

  // call sites: normalizeYmd( must still exist if old had calls
  const callCount = (src.match(/normalizeYmd\s*\(/g) || []).length;
  try {
    const oldSrc = execSync(`git show HEAD:src/app/api/${dir}/route.js`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 10 << 20 });
    const oldCalls = (oldSrc.match(/normalizeYmd\s*\(/g) || []).length;
    // old includes 1 for function definition name? function normalizeYmd( — counts as match!
    // Adjust: function normalizeYmd( counts once in old
    const oldCallSites = oldCalls - 1; // minus definition
    const newCallSites = callCount; // import alias doesn't use normalizeYmd(
    if (newCallSites !== oldCallSites) {
      callSiteIssues.push({ dir, oldCallSites, newCallSites });
    }
  } catch (_) {}

  console.log(`  ${dir}: kind=${kind}, importOk=${importOk}, calls=${callCount}`);
}

console.log('\n=== 2) Module resolve (require) ===');
try {
  const m = require(path.join(ROOT, 'src/utils/normalizeYmd.js'));
  const needed = Object.keys(KIND);
  for (const k of needed) {
    if (typeof m[k] !== 'function') throw new Error(`missing export ${k}`);
  }
  console.log('  require OK — all', needed.length, 'exports present');
} catch (e) {
  console.log('  require FAIL', e.message);
  importIssues.push({ dir: 'utils', error: e.message });
}

// Dynamic import ESM named (simulate Next)
console.log('\n=== 2b) ESM named import interop ===');
(async () => {
  try {
    // Create a temp ESM wrapper test via dynamic import of CJS path
    // Node: import() of CJS gives module.exports as default typically
    const mod = await import(pathToFileURL(path.join(ROOT, 'src/utils/normalizeYmd.js')).href);
    const hasNamed = typeof mod.normalizeYmd === 'function';
    const hasDefault = mod.default && typeof mod.default.normalizeYmd === 'function';
    console.log(`  dynamic import: named=${hasNamed}, default.normalizeYmd=${hasDefault}`);
    if (!hasNamed && !hasDefault) {
      importIssues.push({ dir: 'esm-interop', error: 'neither named nor default.normalizeYmd available' });
    }
    if (!hasNamed && hasDefault) {
      importIssues.push({
        dir: 'esm-interop',
        error: 'ESM named import { normalizeYmd } from CJS may fail in Next — only default export works',
        severity: 'high',
      });
    }
  } catch (e) {
    console.log('  dynamic import error:', e.message);
    importIssues.push({ dir: 'esm-interop', error: e.message });
  }

  console.log('\n=== 3) Behavior vs HEAD originals ===');
  for (const dir of dirs) {
    const kind = kindOf[dir];
    const neu = shared[kind];
    const old = loadOldFn(dir);
    if (!old || old.error) {
      behaviorMismatches.push({ dir, error: old?.error || 'no old fn' });
      continue;
    }
    for (const sample of SAMPLES) {
      let o;
      let n;
      try {
        o = old(sample);
      } catch (e) {
        o = `__throw__:${e.message}`;
      }
      try {
        n = neu(sample);
      } catch (e) {
        n = `__throw__:${e.message}`;
      }
      if (!same(o, n)) {
        behaviorMismatches.push({
          dir,
          kind,
          sample: sample instanceof Date ? `Date(${sample.toISOString()})` : sample,
          old: o,
          neu: n,
        });
      }
    }
  }

  // Summarize unique mismatches by dir
  const byDir = {};
  for (const m of behaviorMismatches) {
    if (!m.dir) continue;
    if (!byDir[m.dir]) byDir[m.dir] = [];
    byDir[m.dir].push(m);
  }

  const mismatchDirs = Object.keys(byDir).filter((d) => byDir[d].some((x) => x.sample !== undefined));
  console.log(`  files with behavior diffs: ${mismatchDirs.length}`);
  for (const d of mismatchDirs.slice(0, 20)) {
    const rows = byDir[d].filter((x) => x.sample !== undefined).slice(0, 5);
    console.log(`  -- ${d} (${kindOf[d]})`);
    for (const r of rows) {
      console.log(`     sample=${JSON.stringify(r.sample)} old=${JSON.stringify(r.old)} neu=${JSON.stringify(r.neu)}`);
    }
  }

  console.log('\n=== 4) Call-site count diffs ===');
  if (callSiteIssues.length === 0) console.log('  all call counts match');
  else console.log(JSON.stringify(callSiteIssues, null, 2));

  console.log('\n=== 5) Diff scope (only import + fn removal?) ===');
  // Check that aside from normalizeYmd fn and import line, no other logic changed
  const unexpectedDiffFiles = [];
  for (const dir of dirs) {
    const diff = execSync(`git diff --unified=0 -- src/app/api/${dir}/route.js`, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 10 << 20,
    });
    const changedLines = diff
      .split('\n')
      .filter((l) => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'));
    const suspicious = changedLines.filter((l) => {
      const t = l.slice(1).trim();
      if (!t) return false;
      if (t.includes('normalizeYmd')) return false;
      if (t.startsWith('function normalizeYmd')) return false;
      if (t.startsWith('if (') || t.startsWith('const ') || t.startsWith('return ') || t.startsWith('}')) {
        // body of removed function
        return false;
      }
      // removed function body lines are OK
      return false; // we'll do a smarter check below
    });

    // Smarter: strip old fn from HEAD and compare to current without import
    const head = execSync(`git show HEAD:src/app/api/${dir}/route.js`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 10 << 20 });
    const cur = fs.readFileSync(path.join(API, dir, 'route.js'), 'utf8');
    const headSansFn = head.replace(/function\s+normalizeYmd\s*\([^)]*\)\s*\{[\s\S]*?\n\}/, '').replace(/\n{3,}/g, '\n\n');
    const curSansImport = cur
      .replace(/import\s*\{[^}]*\}\s*from\s*['\"][^'\"]*normalizeYmd['\"];?\s*\n?/, '')
      .replace(/const\s*\{[^}]*\}\s*=\s*require\(['\"][^'\"]*normalizeYmd['\"]\);?\s*\n?/, '')
      .replace(/\n{3,}/g, '\n\n');

    // normalize whitespace for compare
    const a = headSansFn.replace(/\r\n/g, '\n').trim();
    const b = curSansImport.replace(/\r\n/g, '\n').trim();
    if (a !== b) {
      // allow small whitespace-only diffs
      const a2 = a.replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n\n');
      const b2 = b.replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n\n');
      if (a2 !== b2) {
        unexpectedDiffFiles.push(dir);
      }
    }
  }
  console.log(`  files with diffs beyond fn removal/import: ${unexpectedDiffFiles.length}`);
  if (unexpectedDiffFiles.length) console.log(' ', unexpectedDiffFiles.join(', '));

  console.log('\n=== SUMMARY ===');
  console.log({
    apiCount: dirs.length,
    localFnLeft,
    missingUtilImport,
    importIssues,
    behaviorMismatchCount: behaviorMismatches.filter((m) => m.sample !== undefined).length,
    behaviorMismatchFiles: mismatchDirs,
    callSiteIssues,
    unexpectedDiffFiles,
  });

  // write detailed report
  fs.writeFileSync(
    path.join(__dirname, 'normalize-ymd-verify-report.json'),
    JSON.stringify(
      {
        importIssues,
        behaviorMismatches: behaviorMismatches.filter((m) => m.sample !== undefined),
        callSiteIssues,
        unexpectedDiffFiles,
        localFnLeft,
      },
      null,
      2
    )
  );
})();

function pathToFileURL(p) {
  const { pathToFileURL: f } = require('url');
  return f(p);
}
