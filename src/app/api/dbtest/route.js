/**
 * @file API /api/dbtest — DB 연결 테스트(개발용, 비활성)
 *
 * @description
 * 스키마/연결 정찰 방지를 위해 프로덕션·로컬 모두 비활성합니다.
 *
 * @module app/api/dbtest/route
 */
import { jsonError } from '../../../utils/apiResponse';

export async function GET() {
  return jsonError(
    { success: false, error: '이 엔드포인트는 비활성화되었습니다.' },
    404
  );
}
