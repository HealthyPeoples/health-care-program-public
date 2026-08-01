/**
 * @file 유지보수 스크립트 — rename-outing-process-to-info
 *
 * @description
 * OUTING_PROCESS→OUTING_INFO 리네임
 *
 * @module scripts/rename-outing-process-to-info
 */
/**
 * OUTING_PROCESS → OUTING_INFO 즉시 이름 변경
 * 사용: node scripts/rename-outing-process-to-info.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { getConnectionPool } = require('../src/config/server');
const { ensureOutingInfoTable } = require('../src/lib/outingF14020Sync');

async function main() {
	const pool = await getConnectionPool();
	if (!pool) {
		console.error('DB 연결 실패 (설정 없음)');
		process.exit(1);
	}

	const before = await pool.request().query(`
    SELECT
      CASE WHEN OBJECT_ID(N'[돌봄시설DB].[dbo].[OUTING_PROCESS]', N'U') IS NOT NULL THEN 1 ELSE 0 END AS has_process,
      CASE WHEN OBJECT_ID(N'[돌봄시설DB].[dbo].[OUTING_INFO]', N'U') IS NOT NULL THEN 1 ELSE 0 END AS has_info
  `);
	console.log('변경 전:', before.recordset[0]);

	await ensureOutingInfoTable(pool);

	const after = await pool.request().query(`
    SELECT
      CASE WHEN OBJECT_ID(N'[돌봄시설DB].[dbo].[OUTING_PROCESS]', N'U') IS NOT NULL THEN 1 ELSE 0 END AS has_process,
      CASE WHEN OBJECT_ID(N'[돌봄시설DB].[dbo].[OUTING_INFO]', N'U') IS NOT NULL THEN 1 ELSE 0 END AS has_info
  `);
	console.log('변경 후:', after.recordset[0]);

	const row = after.recordset[0];
	if (row.has_info === 1 && row.has_process === 0) {
		console.log('OK: OUTING_INFO 준비 완료');
	} else if (row.has_process === 1 && row.has_info === 1) {
		console.error('둘 다 존재함 — 수동 확인 필요');
		process.exit(1);
	} else if (row.has_process === 1) {
		console.error('이름 변경 실패 — OUTING_PROCESS 그대로 남음');
		process.exit(1);
	}

	await pool.close();
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
