/**
 * @file 유지보수 스크립트 — migrate-evaluation-checklists-one-row
 *
 * @description
 * 평가 체크리스트 1행 마이그레이션
 *
 * @module scripts/migrate-evaluation-checklists-one-row
 */
/**
 * EVALUATION_CHECKLISTS → 직원·연도당 1건(CHECKS_JSON) 마이그레이션
 * node scripts/migrate-evaluation-checklists-one-row.js
 */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { getConnectionPool } = require('../src/config/server');

const TABLE = '[돌봄시설DB].[dbo].[EVALUATION_CHECKLISTS]';

async function main() {
	const pool = await getConnectionPool();
	if (!pool) {
		console.error('DB 연결 실패');
		process.exit(1);
	}

	const cols = await pool.request().query(`
    SELECT c.name
    FROM [돌봄시설DB].sys.columns c
    INNER JOIN [돌봄시설DB].sys.tables t ON c.object_id = t.object_id
    WHERE t.name = N'EVALUATION_CHECKLISTS'
    ORDER BY c.column_id
  `);
	const names = (cols.recordset || []).map((r) => r.name);
	console.log('current columns:', names.join(', ') || '(none)');
	const hasCell = names.includes('CELL_INDEX');
	const hasJson = names.includes('CHECKS_JSON');

	if (hasJson && !hasCell) {
		console.log('이미 신 스키마입니다.');
		process.exit(0);
	}

	let grouped = new Map();
	if (hasCell) {
		const old = await pool.request().query(`SELECT * FROM ${TABLE}`);
		for (const r of old.recordset || []) {
			const key = `${r.ANCD}|${r.YEAR}|${String(r.EMPNO || '')}`;
			if (!grouped.has(key)) {
				grouped.set(key, {
					ancd: r.ANCD,
					year: r.YEAR,
					empno: String(r.EMPNO || ''),
					checks: [],
				});
			}
			grouped.get(key).checks.push({
				TASK_ID: String(r.TASK_ID || ''),
				CELL_INDEX: Number(r.CELL_INDEX || 0),
				CHECKED: !!(r.CHECKED === true || r.CHECKED === 1 || r.CHECKED === '1'),
			});
		}
		console.log('구 데이터 그룹 수:', grouped.size);
	}

	if (names.length) {
		await pool.request().query(`DROP TABLE ${TABLE}`);
	}

	await pool.request().query(`
    CREATE TABLE ${TABLE} (
      [EC_SEQ]       INT IDENTITY(1,1) NOT NULL,
      [ANCD]         INT NOT NULL,
      [YEAR]         INT NOT NULL,
      [EMPNO]        NVARCHAR(20) NOT NULL,
      [CHECKS_JSON]  NVARCHAR(MAX) NOT NULL,
      [REG_ID]       NVARCHAR(50) NULL,
      [REG_DATE]     DATETIME NULL,
      [MOD_ID]       NVARCHAR(50) NULL,
      [MOD_DATE]     DATETIME NULL,
      CONSTRAINT [PK_EVALUATION_CHECKLISTS] PRIMARY KEY CLUSTERED ([EC_SEQ]),
      CONSTRAINT [UQ_EVALUATION_CHECKLISTS_ANCD_YEAR_EMPNO] UNIQUE ([ANCD], [YEAR], [EMPNO])
    );
  `);

	const now = new Date();
	for (const g of grouped.values()) {
		await pool
			.request()
			.input('ANCD', g.ancd)
			.input('YEAR', g.year)
			.input('EMPNO', g.empno.slice(0, 20))
			.input('CHECKS_JSON', JSON.stringify(g.checks))
			.input('NOW', now)
			.query(`
        INSERT INTO ${TABLE}
          ([ANCD], [YEAR], [EMPNO], [CHECKS_JSON], [REG_ID], [REG_DATE], [MOD_ID], [MOD_DATE])
        VALUES (@ANCD, @YEAR, @EMPNO, @CHECKS_JSON, 'MIGRATE', @NOW, 'MIGRATE', @NOW)
      `);
	}

	const cnt = await pool.request().query(`SELECT COUNT(*) AS CNT FROM ${TABLE}`);
	console.log('완료. 현재 행 수:', cnt.recordset?.[0]?.CNT ?? 0);
	process.exit(0);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
