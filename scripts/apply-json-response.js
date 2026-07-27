/**
 * API Route의 new Response(JSON.stringify(...)) / NextResponse.json(...) 를
 * jsonOk/jsonError 로 치환합니다. 쿠키를 조작하는 NextResponse 는 건드리지 않습니다.
 * 평문 Response(dbtest) 는 제외합니다.
 */
const fs = require('fs');
const path = require('path');

const API_ROOT = path.join(__dirname, '..', 'src', 'app', 'api');
const UTILS_FILE = path.join(__dirname, '..', 'src', 'utils', 'apiResponse.js');

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/^route\.(js|ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

function relImport(fromFile) {
  let rel = path.relative(path.dirname(fromFile), UTILS_FILE).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel.replace(/\.js$/, '');
}

/** skip strings/comments roughly while scanning */
function skipString(src, i) {
  const q = src[i];
  if (q !== '"' && q !== "'" && q !== '`') return i;
  let escape = false;
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === q) return j + 1;
  }
  return src.length;
}

function skipLineComment(src, i) {
  if (src[i] !== '/' || src[i + 1] !== '/') return i;
  let j = i + 2;
  while (j < src.length && src[j] !== '\n') j++;
  return j;
}

function skipBlockComment(src, i) {
  if (src[i] !== '/' || src[i + 1] !== '*') return i;
  let j = i + 2;
  while (j < src.length - 1) {
    if (src[j] === '*' && src[j + 1] === '/') return j + 2;
    j++;
  }
  return src.length;
}

/** Find matching closing paren/brace/bracket starting at openIdx which must be (, {, or [ */
function matchBalanced(src, openIdx) {
  const open = src[openIdx];
  const close = open === '(' ? ')' : open === '{' ? '}' : open === '[' ? ']' : null;
  if (!close) throw new Error('not a bracket at ' + openIdx);
  let depth = 0;
  let i = openIdx;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(src, i);
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      i = skipLineComment(src, i);
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i = skipBlockComment(src, i);
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    } else if (open === '{' && (c === '{' || c === '}' || c === '(' || c === ')' || c === '[' || c === ']')) {
      // for object, also track nested different brackets via recursive? 
      // simpler: track all three depths
    }
    i++;
  }
  return -1;
}

/** Proper nested bracket matcher for (), {}, [] together */
function matchBalancedAny(src, openIdx) {
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const open = src[openIdx];
  if (!pairs[open]) throw new Error('bad open');
  const stack = [open];
  let i = openIdx + 1;
  while (i < src.length && stack.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(src, i);
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      i = skipLineComment(src, i);
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i = skipBlockComment(src, i);
      continue;
    }
    if (c === '(' || c === '{' || c === '[') {
      stack.push(c);
      i++;
      continue;
    }
    if (c === ')' || c === '}' || c === ']') {
      const top = stack[stack.length - 1];
      if (pairs[top] !== c) {
        // mismatch — still pop cautiously
        return -1;
      }
      stack.pop();
      i++;
      continue;
    }
    i++;
  }
  if (stack.length) return -1;
  return i - 1; // index of closing char
}

function parseStatusValue(statusSrc) {
  const s = statusSrc.trim();
  // shorthand property: status  (variable named status)
  if (s === 'status') return { kind: 'ident', value: 'status' };
  // status: 200
  const m = s.match(/^status\s*:\s*(.+)$/s);
  if (m) {
    const v = m[1].trim().replace(/,$/, '').trim();
    if (/^\d+$/.test(v)) return { kind: 'num', value: Number(v) };
    return { kind: 'expr', value: v };
  }
  return null;
}

function parseResponseOptions(optSrc) {
  // optSrc is inside { ... }
  const inner = optSrc.slice(1, -1);
  let statusInfo = null;
  let extraHeaders = null;
  let hasContentType = false;

  // Find status (shorthand or status: N)
  // Find headers: { ... }
  let i = 0;
  while (i < inner.length) {
    const c = inner[i];
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(inner, i);
      continue;
    }
    if (c === '/' && inner[i + 1] === '/') {
      i = skipLineComment(inner, i);
      continue;
    }
    if (c === '/' && inner[i + 1] === '*') {
      i = skipBlockComment(inner, i);
      continue;
    }
    if (inner.slice(i).match(/^status\b/)) {
      // could be status, or status:
      const rest = inner.slice(i);
      if (/^status\s*,/.test(rest) || /^status\s*$/.test(rest.trim()) || /^status\s*\}/.test(rest)) {
        statusInfo = { kind: 'ident', value: 'status' };
        i += 'status'.length;
        continue;
      }
      if (/^status\s*:/.test(rest)) {
        i += rest.match(/^status\s*:/)[0].length;
        while (i < inner.length && /\s/.test(inner[i])) i++;
        const start = i;
        // value until comma or end at depth 0
        let depth = 0;
        while (i < inner.length) {
          const ch = inner[i];
          if (ch === '"' || ch === "'" || ch === '`') {
            i = skipString(inner, i);
            continue;
          }
          if (ch === '(' || ch === '{' || ch === '[') {
            depth++;
            i++;
            continue;
          }
          if (ch === ')' || ch === '}' || ch === ']') {
            if (depth === 0) break;
            depth--;
            i++;
            continue;
          }
          if (ch === ',' && depth === 0) break;
          i++;
        }
        const val = inner.slice(start, i).trim();
        if (/^\d+$/.test(val)) statusInfo = { kind: 'num', value: Number(val) };
        else statusInfo = { kind: 'expr', value: val };
        continue;
      }
    }
    if (inner.slice(i).match(/^headers\s*:/)) {
      i += inner.slice(i).match(/^headers\s*:/)[0].length;
      while (i < inner.length && /\s/.test(inner[i])) i++;
      if (inner[i] !== '{') throw new Error('headers not object');
      const end = matchBalancedAny(inner, i);
      if (end < 0) throw new Error('headers unbalanced');
      const headersObj = inner.slice(i, end + 1);
      hasContentType = /Content-Type/.test(headersObj);
      // extract Cache-Control and other non-Content-Type
      const extras = {};
      const cache = headersObj.match(/['"]Cache-Control['"]\s*:\s*['"]([^'"]+)['"]/);
      if (cache) extras['Cache-Control'] = cache[1];
      // any other header keys besides Content-Type and Cache-Control?
      const keyRe = /['"]([A-Za-z0-9-]+)['"]\s*:/g;
      let km;
      const keys = [];
      while ((km = keyRe.exec(headersObj))) keys.push(km[1]);
      for (const k of keys) {
        if (k === 'Content-Type' || k === 'Cache-Control') continue;
        throw new Error('unexpected header key: ' + k + ' in ' + headersObj);
      }
      if (Object.keys(extras).length) extraHeaders = extras;
      i = end + 1;
      continue;
    }
    i++;
  }

  if (!hasContentType && !/headers/.test(inner)) {
    // NextResponse.json options may only have status
  }
  return { statusInfo, extraHeaders };
}

function chooseFn(statusInfo) {
  if (!statusInfo) return 'jsonOk';
  if (statusInfo.kind === 'num') return statusInfo.value >= 400 ? 'jsonError' : 'jsonOk';
  if (statusInfo.kind === 'ident' || statusInfo.kind === 'expr') {
    // default helper uses status param — pick jsonOk and pass status (same Response)
    return 'jsonOk';
  }
  return 'jsonOk';
}

function formatCall(fn, body, statusInfo, extraHeaders) {
  const extrasLit =
    extraHeaders && Object.keys(extraHeaders).length
      ? ', { ' +
        Object.entries(extraHeaders)
          .map(([k, v]) => `'${k}': '${v}'`)
          .join(', ') +
        ' }'
      : '';

  if (!statusInfo) {
    if (extrasLit) return `${fn}(${body}, 200${extrasLit})`;
    return `${fn}(${body})`;
  }
  if (statusInfo.kind === 'num') {
    if (statusInfo.value === 200 && !extrasLit && fn === 'jsonOk') return `jsonOk(${body})`;
    if (statusInfo.value === 500 && !extrasLit && fn === 'jsonError') return `jsonError(${body})`;
    return `${fn}(${body}, ${statusInfo.value}${extrasLit})`;
  }
  // ident or expr
  return `${fn}(${body}, ${statusInfo.value}${extrasLit})`;
}

function findCookieAssignedRanges(src) {
  // Find: const/let/var response = NextResponse.json(...); ... response.cookies
  const ranges = [];
  const re = /\b(?:const|let|var)\s+(\w+)\s*=\s*NextResponse\.json\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const varName = m[1];
    const callStart = m.index + m[0].length - 1; // at (
    const callEnd = matchBalancedAny(src, callStart);
    if (callEnd < 0) continue;
    // look ahead ~800 chars for varName.cookies
    const ahead = src.slice(callEnd, callEnd + 800);
    if (new RegExp('\\b' + varName + '\\.cookies\\b').test(ahead)) {
      ranges.push([m.index, callEnd + 1]);
    }
  }
  return ranges;
}

function inRanges(idx, ranges) {
  return ranges.some(([a, b]) => idx >= a && idx < b);
}

function ensureImport(src, rel) {
  if (/from\s+['"][^'"]*apiResponse['"]/.test(src) || /require\(['"][^'"]*apiResponse['"]\)/.test(src)) {
    return src;
  }
  const imp = `import { jsonOk, jsonError } from '${rel}';\n`;
  // insert after last import or at top
  const importRe = /^(import\s[\s\S]*?;\s*\n)/gm;
  let lastEnd = 0;
  let m;
  const copy = src;
  while ((m = importRe.exec(copy))) {
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd > 0) return src.slice(0, lastEnd) + imp + src.slice(lastEnd);
  // require style at top
  if (/^['"]use client['"]/.test(src)) {
    return src.replace(/^(['"]use client['"];\s*\n)/, `$1${imp}`);
  }
  return imp + src;
}

function replaceLocalJsonHelper(src) {
  // Remove function json(...) { return new Response... }
  const helperRe =
    /function\s+json\s*\(\s*data\s*,\s*status\s*=\s*200\s*\)\s*\{\s*return\s+new\s+Response\s*\(\s*JSON\.stringify\s*\(\s*data\s*\)\s*,\s*\{\s*status\s*,\s*headers\s*:\s*\{\s*["']Content-Type["']\s*:\s*["']application\/json["']\s*\}\s*,?\s*\}\s*\)\s*;\s*\}\s*/m;
  if (!helperRe.test(src)) return { src, removed: false };
  src = src.replace(helperRe, '');
  return { src, removed: true };
}

function replaceLocalJsonCalls(src) {
  // Replace (not .json) json(body) or json(body, status)
  let out = '';
  let i = 0;
  let count = 0;
  while (i < src.length) {
    // find \bjson(
    const idx = src.indexOf('json(', i);
    if (idx < 0) {
      out += src.slice(i);
      break;
    }
    // check not .json( and not function json( already removed, and not req.json
    if (idx > 0 && (src[idx - 1] === '.' || /[A-Za-z0-9_$]/.test(src[idx - 1]))) {
      out += src.slice(i, idx + 4);
      i = idx + 4;
      continue;
    }
    // skip if it's inside identifier like foojson(
    const open = idx + 4; // at (
    const close = matchBalancedAny(src, open);
    if (close < 0) {
      out += src.slice(i, idx + 5);
      i = idx + 5;
      continue;
    }
    const argsSrc = src.slice(open + 1, close);
    // split args at top-level comma
    const args = splitTopLevelArgs(argsSrc);
    const body = (args[0] || '').trim();
    const statusArg = args[1] ? args[1].trim() : null;
    let statusInfo = null;
    if (statusArg != null) {
      if (/^\d+$/.test(statusArg)) statusInfo = { kind: 'num', value: Number(statusArg) };
      else statusInfo = { kind: 'expr', value: statusArg };
    } else {
      statusInfo = { kind: 'num', value: 200 };
    }
    const fn = chooseFn(statusInfo);
    // for default 200 omit status
    let call;
    if (statusInfo.kind === 'num' && statusInfo.value === 200 && fn === 'jsonOk') {
      call = `jsonOk(${body})`;
    } else if (statusInfo.kind === 'num' && statusInfo.value === 500 && fn === 'jsonError') {
      call = `jsonError(${body})`;
    } else {
      call = `${fn}(${body}, ${statusInfo.kind === 'num' ? statusInfo.value : statusInfo.value})`;
    }
    out += src.slice(i, idx) + call;
    i = close + 1;
    count++;
  }
  return { src: out, count };
}

function splitTopLevelArgs(argsSrc) {
  const args = [];
  let start = 0;
  let depth = 0;
  let i = 0;
  while (i < argsSrc.length) {
    const c = argsSrc[i];
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(argsSrc, i);
      continue;
    }
    if (c === '(' || c === '{' || c === '[') {
      depth++;
      i++;
      continue;
    }
    if (c === ')' || c === '}' || c === ']') {
      depth--;
      i++;
      continue;
    }
    if (c === ',' && depth === 0) {
      args.push(argsSrc.slice(start, i));
      start = i + 1;
      i++;
      continue;
    }
    i++;
  }
  args.push(argsSrc.slice(start));
  return args;
}

function replaceNewResponseJson(src, cookieRanges) {
  let out = '';
  let i = 0;
  let count = 0;
  while (i < src.length) {
    // Always use whitespace-tolerant regex so multiline forms are not skipped
    // when a later compact `new Response(JSON.stringify(` also exists.
    const re = /new\s+Response\s*\(\s*JSON\.stringify\s*\(/g;
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) {
      out += src.slice(i);
      break;
    }
    const matchStart = m.index;
    const stringifyOpen = m.index + m[0].length - 1;

    if (inRanges(matchStart, cookieRanges)) {
      out += src.slice(i, matchStart + 1);
      i = matchStart + 1;
      continue;
    }

    const bodyClose = matchBalancedAny(src, stringifyOpen);
    if (bodyClose < 0) {
      out += src.slice(i, matchStart + 4);
      i = matchStart + 4;
      continue;
    }
    const body = src.slice(stringifyOpen + 1, bodyClose);
    // after bodyClose: ) then , options then )
    let j = bodyClose + 1; // after stringify's )
    while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] !== ',') {
      // unexpected — leave as-is
      out += src.slice(i, matchStart + 4);
      i = matchStart + 4;
      continue;
    }
    j++;
    while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] !== '{') {
      out += src.slice(i, matchStart + 4);
      i = matchStart + 4;
      continue;
    }
    const optClose = matchBalancedAny(src, j);
    if (optClose < 0) {
      out += src.slice(i, matchStart + 4);
      i = matchStart + 4;
      continue;
    }
    let k = optClose + 1;
    while (k < src.length && /\s/.test(src[k])) k++;
    if (src[k] !== ')') {
      out += src.slice(i, matchStart + 4);
      i = matchStart + 4;
      continue;
    }
    const optSrc = src.slice(j, optClose + 1);
    let parsed;
    try {
      parsed = parseResponseOptions(optSrc);
    } catch (e) {
      console.warn('skip parse options:', e.message, 'at', matchStart);
      out += src.slice(i, matchStart + 4);
      i = matchStart + 4;
      continue;
    }
    if (!parsed.statusInfo && !/status/.test(optSrc)) {
      // Response without status defaults to 200
      parsed.statusInfo = { kind: 'num', value: 200 };
    }
    const fn = chooseFn(parsed.statusInfo);
    const call = formatCall(fn, body, parsed.statusInfo, parsed.extraHeaders);
    out += src.slice(i, matchStart) + call;
    i = k + 1;
    count++;
  }
  return { src: out, count };
}

function replaceNextResponseJson(src, cookieRanges) {
  let out = '';
  let i = 0;
  let count = 0;
  while (i < src.length) {
    const re = /NextResponse\.json\s*\(/g;
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) {
      out += src.slice(i);
      break;
    }
    const matchStart = m.index;
    if (inRanges(matchStart, cookieRanges)) {
      out += src.slice(i, matchStart + 'NextResponse'.length);
      i = matchStart + 'NextResponse'.length;
      continue;
    }
    const open = matchStart + m[0].length - 1;
    const close = matchBalancedAny(src, open);
    if (close < 0) {
      out += src.slice(i, matchStart + 12);
      i = matchStart + 12;
      continue;
    }
    const argsSrc = src.slice(open + 1, close);
    const args = splitTopLevelArgs(argsSrc);
    const body = (args[0] || '').trim();
    let statusInfo = { kind: 'num', value: 200 };
    let extraHeaders = null;
    if (args[1]) {
      const opt = args[1].trim();
      if (opt.startsWith('{')) {
        try {
          const parsed = parseResponseOptions(opt);
          if (parsed.statusInfo) statusInfo = parsed.statusInfo;
          extraHeaders = parsed.extraHeaders;
        } catch (e) {
          console.warn('skip NextResponse options', e.message);
          out += src.slice(i, matchStart + 12);
          i = matchStart + 12;
          continue;
        }
      }
    }
    const fn = chooseFn(statusInfo);
    const call = formatCall(fn, body, statusInfo, extraHeaders);
    out += src.slice(i, matchStart) + call;
    i = close + 1;
    count++;
  }
  return { src: out, count };
}

function processFile(file) {
  const rel = path.relative(process.cwd(), file);
  let src = fs.readFileSync(file, 'utf8');
  const original = src;

  // skip pure text responses only file partially — still process JSON parts if any
  const cookieRanges = findCookieAssignedRanges(src);

  let total = 0;

  // 1) local helper removal + call replacement first (so new Response inside helper is gone)
  const helper = replaceLocalJsonHelper(src);
  src = helper.src;
  if (helper.removed) {
    const calls = replaceLocalJsonCalls(src);
    src = calls.src;
    total += calls.count;
  }

  // 2) new Response(JSON.stringify
  const r1 = replaceNewResponseJson(src, cookieRanges);
  src = r1.src;
  total += r1.count;

  // 3) NextResponse.json (non-cookie)
  // recompute cookie ranges on current src (offsets may have shifted — safer recompute from original positions only if we didn't change before cookie ranges)
  // Re-find on current src
  const cookieRanges2 = findCookieAssignedRanges(src);
  const r2 = replaceNextResponseJson(src, cookieRanges2);
  src = r2.src;
  total += r2.count;

  if (total === 0 && src === original) {
    return { file: rel, changed: false, count: 0 };
  }

  if (total > 0 || src !== original) {
    src = ensureImport(src, relImport(file));
    // cleanup unused NextResponse import if no longer referenced
    if (!/NextResponse/.test(src.replace(/import\s*\{[^}]*NextResponse[^}]*\}\s*from\s*['"]next\/server['"]\s*;?/, ''))) {
      src = src.replace(
        /import\s*\{([^}]*)\}\s*from\s*['"]next\/server['"]\s*;?\s*\n/,
        (full, inner) => {
          const parts = inner
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .filter((p) => p !== 'NextResponse');
          if (!parts.length) return '';
          return `import { ${parts.join(', ')} } from 'next/server';\n`;
        }
      );
    }
    // cleanup unused NextRequest similarly if needed — leave alone
    fs.writeFileSync(file, src, 'utf8');
  }

  return { file: rel, changed: src !== original, count: total };
}

function main() {
  const files = walk(API_ROOT);
  const results = [];
  for (const f of files) {
    try {
      results.push(processFile(f));
    } catch (e) {
      console.error('FAIL', f, e);
      results.push({ file: f, changed: false, count: 0, error: String(e) });
    }
  }
  const changed = results.filter((r) => r.changed);
  console.log(JSON.stringify({ totalFiles: files.length, changed: changed.length, results: changed }, null, 2));

  // leftover check
  let leftoverResponse = 0;
  let leftoverNext = 0;
  for (const f of files) {
    const t = fs.readFileSync(f, 'utf8');
    leftoverResponse += [...t.matchAll(/new\s+Response\s*\(\s*JSON\.stringify/g)].length;
    // NextResponse.json that are NOT followed by cookie usage — count all remaining
    leftoverNext += [...t.matchAll(/NextResponse\.json\s*\(/g)].length;
  }
  console.log('leftover new Response(JSON.stringify:', leftoverResponse);
  console.log('leftover NextResponse.json:', leftoverNext);
}

main();
