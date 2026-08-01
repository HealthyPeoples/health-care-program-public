/**
 * @file 공통 유틸 — apiResponse.js
 *
 * @description
 * 날짜·응답·포맷 등 프로젝트 공통 유틸리티입니다.
 *
 * @module utils/apiResponse
 */
/**
 * API Route 공통 JSON Response 헬퍼.
 * 기존 `new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })`
 * 와 동일한 결과를 반환합니다. body 래핑/변환 없음.
 */

function buildHeaders(extraHeaders) {
  const headers = { 'Content-Type': 'application/json' };
  if (extraHeaders && typeof extraHeaders === 'object') {
    for (const [k, v] of Object.entries(extraHeaders)) {
      if (k === 'Content-Type') continue;
      headers[k] = v;
    }
  }
  return headers;
}

/** 성공(또는 명시 status) JSON 응답. 기본 status 200. */
function jsonOk(body, status = 200, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildHeaders(extraHeaders),
  });
}

/** 오류 JSON 응답. 기본 status 500. */
function jsonError(body, status = 500, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildHeaders(extraHeaders),
  });
}

module.exports = { jsonOk, jsonError };
