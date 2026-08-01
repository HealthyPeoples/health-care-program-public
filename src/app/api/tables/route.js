/**
 * @file API /api/tables — 테이블 목록 조회(개발용, 비활성)
 *
 * @description
 * INFORMATION_SCHEMA 노출 방지를 위해 비활성합니다.
 *
 * @module app/api/tables/route
 */
import { jsonError } from '../../../utils/apiResponse';

export async function GET() {
  return jsonError(
    { success: false, error: '이 엔드포인트는 비활성화되었습니다.' },
    404
  );
}
