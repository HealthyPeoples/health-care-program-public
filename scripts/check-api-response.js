/**
 * @file 유지보수 스크립트 — check-api-response
 *
 * @description
 * API 응답 헬퍼 사용 여부 점검
 *
 * @module scripts/check-api-response
 */
/**
 * jsonOk/jsonError 적용 후 점검:
 * - leftover new Response(JSON.stringify
 * - leftover NextResponse.json (쿠키 경로만 허용)
 * - import 누락/미사용
 * - dbtest 평문 Response 유지
 */
const fs = require('fs');
const path = require('path');

const API_ROOT = path.join(__dirname, '..', 'src', 'app', 'api');

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/^route\.(js|ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

function findCookieAssigned(src) {
  const ranges = [];
  const re = /\b(?:const|let|var)\s+(\w+)\s*=\s*NextResponse\.json\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    ranges.push({ varName: m[1], index: m.index });
  }
  return ranges;
}

const files = walk(API_ROOT);
const report = {
  totalRoutes: files.length,
  withHelpers: 0,
  withoutHelpers: [],
  missingImport: [],
  unusedImport: [],
  leftoverJsonResponse: [],
  leftoverNextResponse: [],
  cookieNextResponse: [],
  plainTextResponseFiles: [],
};

for (const f of files) {
  const rel = path.relative(process.cwd(), f);
  const t = fs.readFileSync(f, 'utf8');
  const usesOk = /\bjsonOk\b/.test(t);
  const usesErr = /\bjsonError\b/.test(t);
  const hasImp = /apiResponse/.test(t);
  if (usesOk || usesErr) {
    report.withHelpers++;
    if (!hasImp) report.missingImport.push(rel);
  } else {
    report.withoutHelpers.push(rel);
  }
  if (hasImp && !usesOk && !usesErr) report.unusedImport.push(rel);

  const jsonResp = [...t.matchAll(/new\s+Response\s*\(\s*JSON\.stringify/g)];
  if (jsonResp.length) report.leftoverJsonResponse.push({ file: rel, count: jsonResp.length });

  const nextResp = [...t.matchAll(/NextResponse\.json\s*\(/g)];
  if (nextResp.length) {
    const cookies = findCookieAssigned(t);
    report.leftoverNextResponse.push({ file: rel, count: nextResp.length });
    if (cookies.length) report.cookieNextResponse.push({ file: rel, vars: cookies.map((c) => c.varName) });
  }

  if (/new\s+Response\s*\(\s*['`]/.test(t)) {
    report.plainTextResponseFiles.push(rel);
  }
}

console.log(JSON.stringify(report, null, 2));

let failed = false;
if (report.leftoverJsonResponse.length) {
  console.error('FAIL: leftover JSON Response');
  failed = true;
}
if (report.missingImport.length) {
  console.error('FAIL: missing import');
  failed = true;
}
if (report.unusedImport.length) {
  console.error('FAIL: unused import');
  failed = true;
}
// leftover NextResponse must all be cookie paths
for (const item of report.leftoverNextResponse) {
  const ok = report.cookieNextResponse.some((c) => c.file === item.file);
  if (!ok) {
    console.error('FAIL: non-cookie NextResponse.json leftover', item.file);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('check-api-response: PASS');
