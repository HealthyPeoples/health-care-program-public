/**
 * @file 유지보수 스크립트 — seed-evaluation-checklists-table
 *
 * @description
 * 평가 체크리스트 시드
 *
 * @module scripts/seed-evaluation-checklists-table
 */
/**
 * 전 기관 EVALUATION_CHECKLISTS_TABLE 시드
 * - 기관(ANCD) + 연도(YEAR) 당 표 형식 1건 (TASKS_JSON)
 * 사용: node scripts/seed-evaluation-checklists-table.js [year]
 */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { getConnectionPool } = require('../src/config/server');
const {
	EVALUATION_CHECKLIST_DEFAULT_TEMPLATE,
} = require('../src/lib/evaluationChecklistDefaultTemplate');

const TABLE_STRUCTURE = '[돌봄시설DB].[dbo].[EVALUATION_CHECKLISTS_TABLE]';
const TABLE_FACILITY = '[돌봄시설DB].[dbo].[F00110]';

async function ensureAndMigrate(pool) {
	await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1
      FROM [돌봄시설DB].sys.tables t
      INNER JOIN [돌봄시설DB].sys.schemas s ON t.schema_id = s.schema_id
      WHERE s.name = N'dbo' AND t.name = N'EVALUATION_CHECKLISTS_TABLE'
    )
    BEGIN
      CREATE TABLE ${TABLE_STRUCTURE} (
        [ECT_SEQ]     INT IDENTITY(1,1) NOT NULL,
        [ANCD]        INT NOT NULL,
        [YEAR]        INT NOT NULL,
        [TASKS_JSON]  NVARCHAR(MAX) NOT NULL,
        [REG_ID]      NVARCHAR(50) NULL,
        [REG_DATE]    DATETIME NULL,
        [MOD_ID]      NVARCHAR(50) NULL,
        [MOD_DATE]    DATETIME NULL,
        CONSTRAINT [PK_EVALUATION_CHECKLISTS_TABLE] PRIMARY KEY CLUSTERED ([ECT_SEQ]),
        CONSTRAINT [UQ_EVALUATION_CHECKLISTS_TABLE_ANCD_YEAR] UNIQUE ([ANCD], [YEAR])
      );
    END
  `);

	const colCheck = await pool.request().query(`
    SELECT
      CASE WHEN EXISTS (
        SELECT 1 FROM [돌봄시설DB].sys.columns c
        INNER JOIN [돌봄시설DB].sys.tables t ON c.object_id = t.object_id
        WHERE t.name = N'EVALUATION_CHECKLISTS_TABLE' AND c.name = N'TASK_ID'
      ) THEN 1 ELSE 0 END AS HAS_TASK_ID,
      CASE WHEN EXISTS (
        SELECT 1 FROM [돌봄시설DB].sys.columns c
        INNER JOIN [돌봄시설DB].sys.tables t ON c.object_id = t.object_id
        WHERE t.name = N'EVALUATION_CHECKLISTS_TABLE' AND c.name = N'TASKS_JSON'
      ) THEN 1 ELSE 0 END AS HAS_TASKS_JSON
  `);
	const flags = colCheck.recordset?.[0] || {};
	if (Number(flags.HAS_TASK_ID) === 1 && Number(flags.HAS_TASKS_JSON) === 0) {
		console.log('[seed] 구 스키마 감지 → TASKS_JSON 구조로 마이그레이션');

		const oldRows = await pool.request().query(`
      SELECT * FROM ${TABLE_STRUCTURE}
      ORDER BY [ANCD], [YEAR], [SORT_NO], [ECT_SEQ]
    `);
		const grouped = new Map();
		for (const r of oldRows.recordset || []) {
			const key = `${r.ANCD}|${r.YEAR}`;
			if (!grouped.has(key)) grouped.set(key, { ancd: r.ANCD, year: r.YEAR, tasks: [] });
			let cellTexts = [];
			try {
				cellTexts = JSON.parse(String(r.CELL_TEXTS || '[]'));
			} catch {
				cellTexts = [];
			}
			grouped.get(key).tasks.push({
				TASK_ID: String(r.TASK_ID ?? ''),
				CATEGORY: String(r.CATEGORY ?? ''),
				FREQ_LABEL: String(r.FREQ_LABEL ?? ''),
				MERGE_MODE: String(r.MERGE_MODE ?? '12'),
				CONTENT: String(r.CONTENT ?? ''),
				SORT_NO: Number(r.SORT_NO ?? 0),
				CELL_TEXTS: Array.isArray(cellTexts) ? cellTexts : [],
			});
		}

		await pool.request().query(`DROP TABLE ${TABLE_STRUCTURE}`);
		await pool.request().query(`
      CREATE TABLE ${TABLE_STRUCTURE} (
        [ECT_SEQ]     INT IDENTITY(1,1) NOT NULL,
        [ANCD]        INT NOT NULL,
        [YEAR]        INT NOT NULL,
        [TASKS_JSON]  NVARCHAR(MAX) NOT NULL,
        [REG_ID]      NVARCHAR(50) NULL,
        [REG_DATE]    DATETIME NULL,
        [MOD_ID]      NVARCHAR(50) NULL,
        [MOD_DATE]    DATETIME NULL,
        CONSTRAINT [PK_EVALUATION_CHECKLISTS_TABLE] PRIMARY KEY CLUSTERED ([ECT_SEQ]),
        CONSTRAINT [UQ_EVALUATION_CHECKLISTS_TABLE_ANCD_YEAR] UNIQUE ([ANCD], [YEAR])
      );
    `);

		const now = new Date();
		for (const g of grouped.values()) {
			g.tasks.sort((a, b) => a.SORT_NO - b.SORT_NO);
			await pool
				.request()
				.input('ANCD', g.ancd)
				.input('YEAR', g.year)
				.input('TASKS_JSON', JSON.stringify(g.tasks))
				.input('NOW', now)
				.query(`
          INSERT INTO ${TABLE_STRUCTURE}
            ([ANCD], [YEAR], [TASKS_JSON], [REG_ID], [REG_DATE], [MOD_ID], [MOD_DATE])
          VALUES (@ANCD, @YEAR, @TASKS_JSON, 'MIGRATE', @NOW, 'MIGRATE', @NOW)
        `);
		}
		console.log(`[seed] 마이그레이션 완료: ${grouped.size}건`);
	}
}

async function upsertOne(pool, ancd, year, tasksJson, now) {
	await pool
		.request()
		.input('ANCD', ancd)
		.input('YEAR', year)
		.input('TASKS_JSON', tasksJson)
		.input('USER_ID', 'SEED')
		.input('NOW', now)
		.query(`
      MERGE ${TABLE_STRUCTURE} AS T
      USING (SELECT @ANCD AS ANCD, @YEAR AS YEAR) AS S
        ON T.[ANCD] = S.ANCD AND T.[YEAR] = S.YEAR
      WHEN MATCHED THEN
        UPDATE SET [TASKS_JSON] = @TASKS_JSON, [MOD_ID] = @USER_ID, [MOD_DATE] = @NOW
      WHEN NOT MATCHED THEN
        INSERT ([ANCD], [YEAR], [TASKS_JSON], [REG_ID], [REG_DATE], [MOD_ID], [MOD_DATE])
        VALUES (@ANCD, @YEAR, @TASKS_JSON, @USER_ID, @NOW, @USER_ID, @NOW);
    `);
}

async function main() {
	const year = Number(process.argv[2]) || new Date().getFullYear();
	console.log(`[seed] EVALUATION_CHECKLISTS_TABLE year=${year} (기관당 1건)`);

	const pool = await getConnectionPool();
	if (!pool) {
		console.error('[seed] DB 연결 실패');
		process.exit(1);
	}

	await ensureAndMigrate(pool);

	const facRes = await pool.request().query(`
    SELECT [ANCD], [ANNM] FROM ${TABLE_FACILITY}
    WHERE [ANCD] IS NOT NULL ORDER BY [ANCD]
  `);
	const facilities = facRes.recordset || [];
	const tasksJson = JSON.stringify(EVALUATION_CHECKLIST_DEFAULT_TEMPLATE);
	console.log(`[seed] 기관 수: ${facilities.length}, 템플릿 항목: ${EVALUATION_CHECKLIST_DEFAULT_TEMPLATE.length}`);

	const now = new Date();
	let done = 0;
	for (const fac of facilities) {
		await upsertOne(pool, fac.ANCD, year, tasksJson, now);
		done += 1;
		if (done % 10 === 0 || done === facilities.length) {
			console.log(`[seed] ${done}/${facilities.length} (최근: ${fac.ANCD} ${fac.ANNM || ''})`);
		}
	}

	const cnt = await pool
		.request()
		.input('YEAR', year)
		.query(`SELECT COUNT(*) AS CNT FROM ${TABLE_STRUCTURE} WHERE [YEAR] = @YEAR`);
	console.log(`[seed] 완료. YEAR=${year} 표 건수(기관당 1): ${cnt.recordset?.[0]?.CNT ?? '?'}`);
	process.exit(0);
}

main().catch((err) => {
	console.error('[seed] 오류:', err);
	process.exit(1);
});
