/**
 * @file 유지보수 스크립트 — alter-f11020-bhrel-etc
 *
 * @description
 * F11020.BHREL_ETC 컬럼 제거 (값은 BHRELNM으로 이관 후 DROP)
 * 실행: node scripts/alter-f11020-bhrel-etc.js
 *
 * @module scripts/alter-f11020-bhrel-etc
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { getConnectionPool } = require('../src/config/server');

async function main() {
	const pool = await getConnectionPool();
	if (!pool) {
		console.error('DB 연결 실패');
		process.exit(1);
	}

	const before = await pool.request().query(`
    SELECT DATA_TYPE AS dataType, CHARACTER_MAXIMUM_LENGTH AS maxLen
    FROM [돌봄시설DB].INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'F11020' AND COLUMN_NAME = 'BHREL_ETC'
  `);
	console.log('변경 전:', before.recordset?.[0] || '(컬럼 없음)');

	await pool.request().query(`
    IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F11020]', N'BHREL_ETC') IS NOT NULL
    BEGIN
      -- 기타(BHREL=9) 텍스트를 BHRELNM으로 이관
      UPDATE [돌봄시설DB].[dbo].[F11020]
      SET [BHRELNM] = [BHREL_ETC]
      WHERE LTRIM(RTRIM(CAST([BHREL] AS NVARCHAR(20)))) = N'9'
        AND [BHREL_ETC] IS NOT NULL
        AND LTRIM(RTRIM([BHREL_ETC])) <> N''
        AND (
          [BHRELNM] IS NULL
          OR LTRIM(RTRIM([BHRELNM])) = N''
          OR LTRIM(RTRIM([BHRELNM])) = N'기타'
        );

      ALTER TABLE [돌봄시설DB].[dbo].[F11020]
      DROP COLUMN [BHREL_ETC];
    END
  `);

	const after = await pool.request().query(`
    SELECT DATA_TYPE AS dataType, CHARACTER_MAXIMUM_LENGTH AS maxLen
    FROM [돌봄시설DB].INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'F11020' AND COLUMN_NAME = 'BHREL_ETC'
  `);
	console.log('변경 후:', after.recordset?.[0] || '(컬럼 없음)');
	console.log('완료: BHREL_ETC 컬럼 삭제');

	await pool.close();
	process.exit(0);
}

main().catch((e) => {
	console.error('실패:', e.message || e);
	process.exit(1);
});
