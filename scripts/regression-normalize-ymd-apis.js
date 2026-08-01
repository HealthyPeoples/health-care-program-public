/**
 * @file 유지보수 스크립트 — regression-normalize-ymd-apis
 *
 * @description
 * normalizeYmd API 회귀 검증
 *
 * @module scripts/regression-normalize-ymd-apis
 */
/**
 * normalizeYmd 사용 API 회귀 검증
 * - Request/Response/SQL 날짜 경로가 공통화 전후 동일한지 확인
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

/** API에서 실제로 들어오는 날짜 관련 입력 */
const REGRESSION_INPUTS = [
  null,
  undefined,
  '',
  '   ',
  '2024-01-02',
  '20240102',
  '2024-01-02T15:00:00',
  '2024-01-02T15:00:00.000Z',
  '2024-01-02 extra',
  new Date(2024, 0, 2, 15, 30, 0),
  'not-a-date',
  0,
  false,
  20240102,
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
  const src = execSync(`git show HEAD:src/app/api/${dir}/route.js`, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 10 << 20,
  });
  const fnSrc = extractFn(src);
  if (!fnSrc) throw new Error(`no normalizeYmd in HEAD ${dir}`);
  // eslint-disable-next-line no-new-func
  return new Function(`${fnSrc}\nreturn normalizeYmd;`)();
}

function stripNormalizeNoise(src) {
  let out = src;
  const re = /function\s+normalizeYmd\s*\([^)]*\)\s*\{/;
  const m = re.exec(out);
  if (m) {
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < out.length && depth > 0) {
      const c = out[i++];
      if (c === '{') depth++;
      else if (c === '}') depth--;
    }
    out = out.slice(0, m.index) + out.slice(i);
  }
  out = out.replace(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*normalizeYmd['"];?\s*\n?/g, '');
  out = out.replace(/const\s*\{[^}]*\}\s*=\s*require\(['"][^'"]*normalizeYmd['"]\);?\s*\n?/g, '');
  return out.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

function classifyCallSites(src) {
  const lines = src.split(/\r?\n/);
  const sites = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/normalizeYmd\s*\(/.test(line)) continue;
    if (/function\s+normalizeYmd/.test(line)) continue;
    if (/import\s*\{|require\(/.test(line)) continue;

    const ctx = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3)).join('\n');
    let kind = 'other';
    if (/\.input\s*\(/.test(line) || /\.input\s*\(/.test(ctx) || /request\.input/.test(ctx)) {
      kind = 'sql-param';
    } else if (/return\s+|JSON\.stringify|success:\s*true|data:|mapRow|normalizeRow|serialize/.test(ctx) || /:\s*normalizeYmd\(/.test(line)) {
      kind = 'response';
    } else if (/searchParams|body\.|get\(|pick\(|Raw|rqdt|sdt|edt|jodt|ymd/i.test(ctx)) {
      kind = 'request';
    } else if (/inputDate\s*\(/.test(ctx) || /const\s+\w+\s*=\s*normalizeYmd/.test(line)) {
      // intermediate — often feeds SQL or response
      if (/inputDate|sql\.Date|\.input/.test(ctx + lines.slice(i, i + 8).join('\n'))) kind = 'sql-param';
      else kind = 'request';
    }

    sites.push({ line: i + 1, text: line.trim(), kind });
  }
  return sites;
}

function label(v) {
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? 'Date(Invalid)' : `Date(${v.toISOString()})`;
  }
  if (v === undefined) return 'undefined';
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

const report = {
  apis: [],
  contractDiffs: [],
  valueDiffs: [],
  nullDiffs: [],
  emptyDiffs: [],
  summary: {},
};

const dirs = Object.keys(kindOf).sort();

for (const dir of dirs) {
  const kind = kindOf[dir];
  const neu = shared[kind];
  const old = loadOldFn(dir);

  const headSrc = execSync(`git show HEAD:src/app/api/${dir}/route.js`, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 10 << 20,
  });
  const curSrc = fs.readFileSync(path.join(API, dir, 'route.js'), 'utf8');

  const headSans = stripNormalizeNoise(headSrc);
  const curSans = stripNormalizeNoise(curSrc);
  const contractSame = headSans === curSans;

  if (!contractSame) {
    report.contractDiffs.push(dir);
  }

  const sites = classifyCallSites(curSrc);
  const valueDiffs = [];
  const nullDiffs = [];
  const emptyDiffs = [];

  for (const input of REGRESSION_INPUTS) {
    const o = old(input);
    const n = neu(input);
    if (!Object.is(o, n)) {
      const row = { api: dir, kind, input: label(input), before: o, after: n };
      valueDiffs.push(row);
      if (input === null || input === undefined) nullDiffs.push(row);
      if (input === '' || input === '   ') emptyDiffs.push(row);
    }
  }

  // SQL 파라미터 경로: normalizeYmd 결과가 그대로 .input에 들어가는지 코드 패턴 확인
  const sqlSites = sites.filter((s) => s.kind === 'sql-param');
  const requestSites = sites.filter((s) => s.kind === 'request');
  const responseSites = sites.filter((s) => s.kind === 'response');

  // SQL 파라미터 값 동일성 = normalizeYmd 출력 동일성 (바인딩은 동일 코드 경로)
  const sqlValueOk = valueDiffs.length === 0;

  report.apis.push({
    api: dir,
    variant: kind,
    contractSame,
    callSites: {
      total: sites.length,
      request: requestSites.length,
      response: responseSites.length,
      sqlParam: sqlSites.length,
      other: sites.filter((s) => s.kind === 'other').length,
      detail: sites,
    },
    dateValueSame: valueDiffs.length === 0,
    nullHandlingSame: nullDiffs.length === 0,
    emptyHandlingSame: emptyDiffs.length === 0,
    sqlParamSame: sqlValueOk && contractSame,
    valueDiffs,
  });

  if (valueDiffs.length) report.valueDiffs.push(...valueDiffs);
  if (nullDiffs.length) report.nullDiffs.push(...nullDiffs);
  if (emptyDiffs.length) report.emptyDiffs.push(...emptyDiffs);
}

report.summary = {
  apiCount: dirs.length,
  contractUnchanged: report.apis.filter((a) => a.contractSame).length,
  contractChanged: report.contractDiffs,
  dateValueUnchanged: report.apis.filter((a) => a.dateValueSame).length,
  dateValueChangedApis: report.apis.filter((a) => !a.dateValueSame).map((a) => a.api),
  nullHandlingUnchanged: report.apis.filter((a) => a.nullHandlingSame).length,
  emptyHandlingUnchanged: report.apis.filter((a) => a.emptyHandlingSame).length,
  sqlParamUnchanged: report.apis.filter((a) => a.sqlParamSame).length,
  totalValueDiffs: report.valueDiffs.length,
  pass:
    report.contractDiffs.length === 0 &&
    report.valueDiffs.length === 0 &&
    report.nullDiffs.length === 0 &&
    report.emptyDiffs.length === 0,
};

const outPath = path.join(__dirname, 'normalize-ymd-regression-report.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

// Console summary
console.log('=== normalizeYmd API 회귀 검증 ===\n');
console.log(`대상 API: ${report.summary.apiCount}`);
console.log(`Request/Response/비즈니스 코드(계약) 동일: ${report.summary.contractUnchanged}/${report.summary.apiCount}`);
console.log(`날짜 값 동일: ${report.summary.dateValueUnchanged}/${report.summary.apiCount}`);
console.log(`null 처리 동일: ${report.summary.nullHandlingUnchanged}/${report.summary.apiCount}`);
console.log(`빈 문자열 처리 동일: ${report.summary.emptyHandlingUnchanged}/${report.summary.apiCount}`);
console.log(`SQL 파라미터 동일: ${report.summary.sqlParamUnchanged}/${report.summary.apiCount}`);
console.log(`전체 PASS: ${report.summary.pass}`);

if (report.contractDiffs.length) {
  console.log('\n[계약/코드 diff 발견]', report.contractDiffs.join(', '));
}
if (report.valueDiffs.length) {
  console.log('\n[날짜 값 차이]');
  for (const d of report.valueDiffs.slice(0, 30)) {
    console.log(`  ${d.api} input=${d.input} before=${JSON.stringify(d.before)} after=${JSON.stringify(d.after)}`);
  }
} else {
  console.log('\n날짜/null/빈문자/SQL 바인딩 값 차이: 없음');
}

// Per-API call site table
console.log('\n=== API별 호출 경로 분류 ===');
console.log(
  'api'.padEnd(12),
  'req'.padStart(4),
  'res'.padStart(4),
  'sql'.padStart(4),
  'oth'.padStart(4),
  'ok'
);
for (const a of report.apis) {
  const ok = a.contractSame && a.dateValueSame ? 'PASS' : 'FAIL';
  console.log(
    a.api.padEnd(12),
    String(a.callSites.request).padStart(4),
    String(a.callSites.response).padStart(4),
    String(a.callSites.sqlParam).padStart(4),
    String(a.callSites.other).padStart(4),
    ok
  );
}

console.log(`\n상세 리포트: ${outPath}`);
process.exit(report.summary.pass ? 0 : 1);
