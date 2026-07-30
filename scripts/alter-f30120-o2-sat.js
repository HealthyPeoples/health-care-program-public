/**
 * F30120.O2_SAT 컬럼 추가 (산소포화도)
 * 실행: node scripts/alter-f30120-o2-sat.js
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
    SELECT DATA_TYPE AS dataType, NUMERIC_PRECISION AS prec, NUMERIC_SCALE AS scale
    FROM [돌봄시설DB].INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'F30120' AND COLUMN_NAME = 'O2_SAT'
  `);
	console.log('변경 전:', before.recordset?.[0] || '(컬럼 없음)');

	await pool.request().query(`
    IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F30120]', N'O2_SAT') IS NULL
    BEGIN
      ALTER TABLE [돌봄시설DB].[dbo].[F30120]
      ADD [O2_SAT] DECIMAL(4,1) NULL;
    END
  `);

	const after = await pool.request().query(`
    SELECT DATA_TYPE AS dataType, NUMERIC_PRECISION AS prec, NUMERIC_SCALE AS scale
    FROM [돌봄시설DB].INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'F30120' AND COLUMN_NAME = 'O2_SAT'
  `);
	console.log('변경 후:', after.recordset?.[0] || '(컬럼 없음)');
	console.log('완료: O2_SAT = DECIMAL(4,1)');

	await pool.close();
	process.exit(0);
}

main().catch((e) => {
	console.error('실패:', e.message || e);
	process.exit(1);
});
