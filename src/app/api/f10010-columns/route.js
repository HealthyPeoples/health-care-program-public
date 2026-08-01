/**
 * @file API /api/f10010-columns — 수급자 컬럼 메타(비활성)
 *
 * @description
 * 스키마 노출 방지를 위해 비활성합니다.
 *
 * @module app/api/f10010-columns/route
 */
import { jsonError } from '../../../utils/apiResponse';

export async function GET() {
  return jsonError(
    { success: false, error: '이 엔드포인트는 비활성화되었습니다.' },
    404
  );
}
