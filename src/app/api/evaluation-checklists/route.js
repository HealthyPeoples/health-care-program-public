import { connPool } from '../../../config/server';
import {
	assertAnCdMatchesSession,
	parseUserInfoCookieValue,
} from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';
import { EVALUATION_CHECKLIST_DEFAULT_TEMPLATE } from '../../../lib/evaluationChecklistDefaultTemplate';

const TABLE_STRUCTURE = '[돌봄시설DB].[dbo].[EVALUATION_CHECKLISTS_TABLE]';
const TABLE_CHECKS = '[돌봄시설DB].[dbo].[EVALUATION_CHECKLISTS]';
const TABLE_FACILITY = '[돌봄시설DB].[dbo].[F00110]';

let ensureTablePromise = null;

function truncStr(v, max) {
	if (v == null) return '';
	const s = String(v);
	return s.length <= max ? s : s.slice(0, max);
}

function parseCellTexts(raw) {
	if (raw == null || raw === '') return [];
	if (Array.isArray(raw)) return raw.map((t) => String(t ?? ''));
	try {
		const parsed = JSON.parse(String(raw));
		if (Array.isArray(parsed)) return parsed.map((t) => String(t ?? ''));
	} catch {
		/* ignore */
	}
	return [];
}

function parseTasksJson(raw) {
	if (Array.isArray(raw)) return raw;
	if (raw == null || raw === '') return [];
	try {
		const parsed = JSON.parse(String(raw));
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function parseChecksJson(raw) {
	if (Array.isArray(raw)) return raw;
	if (raw == null || raw === '') return [];
	try {
		const parsed = JSON.parse(String(raw));
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function normalizeChecksPayload(checks) {
	if (!Array.isArray(checks)) return [];
	return checks
		.map((c) => {
			const taskId = truncStr(c.TASK_ID ?? c.taskId ?? c.id, 64);
			const cellIndex = Number(c.CELL_INDEX ?? c.cellIndex);
			if (!taskId || !Number.isFinite(cellIndex) || cellIndex < 0) return null;
			const checked =
				c.CHECKED === true ||
				c.CHECKED === 1 ||
				c.CHECKED === '1' ||
				c.checked === true;
			return {
				TASK_ID: taskId,
				CELL_INDEX: cellIndex,
				CHECKED: !!checked,
			};
		})
		.filter(Boolean);
}

async function ensureTables(pool) {
	if (!pool) return;
	if (!ensureTablePromise) {
		ensureTablePromise = (async () => {
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

        IF NOT EXISTS (
          SELECT 1
          FROM [돌봄시설DB].sys.tables t
          INNER JOIN [돌봄시설DB].sys.schemas s ON t.schema_id = s.schema_id
          WHERE s.name = N'dbo' AND t.name = N'EVALUATION_CHECKLISTS'
        )
        BEGIN
          CREATE TABLE ${TABLE_CHECKS} (
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
        END
      `);

			// STRUCTURE: 구 스키마(TASK_ID 행단위) → TASKS_JSON
			const structCols = await pool.request().query(`
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
			const sf = structCols.recordset?.[0] || {};
			if (Number(sf.HAS_TASK_ID) === 1 && Number(sf.HAS_TASKS_JSON) === 0) {
				const oldRows = await pool.request().query(`
          SELECT * FROM ${TABLE_STRUCTURE}
          ORDER BY [ANCD], [YEAR], [SORT_NO], [ECT_SEQ]
        `);
				const grouped = new Map();
				for (const r of oldRows.recordset || []) {
					const key = `${r.ANCD}|${r.YEAR}`;
					if (!grouped.has(key)) grouped.set(key, { ancd: r.ANCD, year: r.YEAR, tasks: [] });
					grouped.get(key).tasks.push({
						TASK_ID: String(r.TASK_ID ?? ''),
						CATEGORY: String(r.CATEGORY ?? ''),
						FREQ_LABEL: String(r.FREQ_LABEL ?? ''),
						MERGE_MODE: String(r.MERGE_MODE ?? '12'),
						CONTENT: String(r.CONTENT ?? ''),
						SORT_NO: Number(r.SORT_NO ?? 0),
						CELL_TEXTS: parseCellTexts(r.CELL_TEXTS),
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
			}

			// CHECKS: 구 스키마(칸 단위) → 직원당 1건 CHECKS_JSON
			const checkCols = await pool.request().query(`
        SELECT
          CASE WHEN EXISTS (
            SELECT 1 FROM [돌봄시설DB].sys.columns c
            INNER JOIN [돌봄시설DB].sys.tables t ON c.object_id = t.object_id
            WHERE t.name = N'EVALUATION_CHECKLISTS' AND c.name = N'CELL_INDEX'
          ) THEN 1 ELSE 0 END AS HAS_CELL_INDEX,
          CASE WHEN EXISTS (
            SELECT 1 FROM [돌봄시설DB].sys.columns c
            INNER JOIN [돌봄시설DB].sys.tables t ON c.object_id = t.object_id
            WHERE t.name = N'EVALUATION_CHECKLISTS' AND c.name = N'CHECKS_JSON'
          ) THEN 1 ELSE 0 END AS HAS_CHECKS_JSON
      `);
			const cf = checkCols.recordset?.[0] || {};
			if (Number(cf.HAS_CELL_INDEX) === 1 && Number(cf.HAS_CHECKS_JSON) === 0) {
				const oldRows = await pool.request().query(`
          SELECT * FROM ${TABLE_CHECKS}
          ORDER BY [ANCD], [YEAR], [EMPNO], [TASK_ID], [CELL_INDEX]
        `);
				const grouped = new Map();
				for (const r of oldRows.recordset || []) {
					const key = `${r.ANCD}|${r.YEAR}|${String(r.EMPNO ?? '')}`;
					if (!grouped.has(key)) {
						grouped.set(key, {
							ancd: r.ANCD,
							year: r.YEAR,
							empno: String(r.EMPNO ?? ''),
							checks: [],
						});
					}
					grouped.get(key).checks.push({
						TASK_ID: String(r.TASK_ID ?? ''),
						CELL_INDEX: Number(r.CELL_INDEX ?? 0),
						CHECKED: r.CHECKED === true || r.CHECKED === 1 || r.CHECKED === '1',
					});
				}
				await pool.request().query(`DROP TABLE ${TABLE_CHECKS}`);
				await pool.request().query(`
          CREATE TABLE ${TABLE_CHECKS} (
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
						.input('EMPNO', truncStr(g.empno, 20))
						.input('CHECKS_JSON', JSON.stringify(g.checks))
						.input('NOW', now)
						.query(`
              INSERT INTO ${TABLE_CHECKS}
                ([ANCD], [YEAR], [EMPNO], [CHECKS_JSON], [REG_ID], [REG_DATE], [MOD_ID], [MOD_DATE])
              VALUES (@ANCD, @YEAR, @EMPNO, @CHECKS_JSON, 'MIGRATE', @NOW, 'MIGRATE', @NOW)
            `);
				}
			}
		})().catch((err) => {
			ensureTablePromise = null;
			throw err;
		});
	}
	await ensureTablePromise;
}

function resolveUserId(req) {
	const session = parseUserInfoCookieValue(req.cookies.get('user_info')?.value);
	const id = String(session?.uid ?? session?.empno ?? '').trim();
	return id ? truncStr(id, 50) : '';
}

function resolveEmpno(req, bodyEmpno) {
	const fromBody = String(bodyEmpno ?? '').trim();
	if (fromBody) return truncStr(fromBody, 20);
	const session = parseUserInfoCookieValue(req.cookies.get('user_info')?.value);
	const empno = String(session?.empno ?? '').trim();
	return empno ? truncStr(empno, 20) : '';
}

function parseYear(v) {
	const n = Number(v);
	if (!Number.isFinite(n) || n < 2000 || n > 2100) return null;
	return Math.trunc(n);
}

function normalizeTasksPayload(tasks) {
	if (!Array.isArray(tasks)) return [];
	return tasks
		.map((t, i) => {
			const taskId = truncStr(t.id ?? t.TASK_ID ?? t.taskId, 64);
			if (!taskId) return null;
			const cellTexts = Array.isArray(t.cells)
				? t.cells.map((c) => String(c?.text ?? ''))
				: parseCellTexts(t.CELL_TEXTS ?? t.cellTexts);
			return {
				TASK_ID: taskId,
				CATEGORY: truncStr(t.category ?? t.CATEGORY, 20) || '기관운영',
				FREQ_LABEL: truncStr(t.freqLabel ?? t.FREQ_LABEL, 20) || '',
				MERGE_MODE: truncStr(t.mergeMode ?? t.MERGE_MODE, 4) || '12',
				CONTENT: truncStr(t.content ?? t.CONTENT, 500) || '',
				SORT_NO: Number.isFinite(Number(t.sortNo ?? t.SORT_NO)) ? Number(t.sortNo ?? t.SORT_NO) : i,
				CELL_TEXTS: cellTexts,
			};
		})
		.filter(Boolean)
		.sort((a, b) => a.SORT_NO - b.SORT_NO);
}

function mapStructureToApi(tasksJson) {
	return parseTasksJson(tasksJson).map((r) => ({
		TASK_ID: String(r.TASK_ID ?? ''),
		CATEGORY: String(r.CATEGORY ?? ''),
		FREQ_LABEL: String(r.FREQ_LABEL ?? ''),
		MERGE_MODE: String(r.MERGE_MODE ?? '12'),
		CONTENT: String(r.CONTENT ?? ''),
		SORT_NO: Number(r.SORT_NO ?? 0),
		CELL_TEXTS: parseCellTexts(r.CELL_TEXTS),
	}));
}

function mapChecksToApi(checksJson) {
	return parseChecksJson(checksJson).map((c) => ({
		TASK_ID: String(c.TASK_ID ?? ''),
		CELL_INDEX: Number(c.CELL_INDEX ?? 0),
		CHECKED: !!c.CHECKED,
	}));
}

async function upsertStructure(pool, { ancd, year, tasks, userId, now }) {
	const normalized = normalizeTasksPayload(tasks);
	const tasksJson = JSON.stringify(normalized);

	await pool
		.request()
		.input('ANCD', ancd)
		.input('YEAR', year)
		.input('TASKS_JSON', tasksJson)
		.input('USER_ID', userId || null)
		.input('NOW', now)
		.query(`
      MERGE ${TABLE_STRUCTURE} AS T
      USING (SELECT @ANCD AS ANCD, @YEAR AS YEAR) AS S
        ON T.[ANCD] = S.ANCD AND T.[YEAR] = S.YEAR
      WHEN MATCHED THEN
        UPDATE SET
          [TASKS_JSON] = @TASKS_JSON,
          [MOD_ID] = @USER_ID,
          [MOD_DATE] = @NOW
      WHEN NOT MATCHED THEN
        INSERT ([ANCD], [YEAR], [TASKS_JSON], [REG_ID], [REG_DATE], [MOD_ID], [MOD_DATE])
        VALUES (@ANCD, @YEAR, @TASKS_JSON, @USER_ID, @NOW, @USER_ID, @NOW);
    `);

	return normalized;
}

/** 직원·연도당 체크 1건 MERGE */
async function upsertChecks(pool, { ancd, year, empno, checks, userId, now }) {
	const normalized = normalizeChecksPayload(checks);
	const checksJson = JSON.stringify(normalized);

	await pool
		.request()
		.input('ANCD', ancd)
		.input('YEAR', year)
		.input('EMPNO', empno)
		.input('CHECKS_JSON', checksJson)
		.input('USER_ID', userId || null)
		.input('NOW', now)
		.query(`
      MERGE ${TABLE_CHECKS} AS T
      USING (SELECT @ANCD AS ANCD, @YEAR AS YEAR, @EMPNO AS EMPNO) AS S
        ON T.[ANCD] = S.ANCD AND T.[YEAR] = S.YEAR AND T.[EMPNO] = S.EMPNO
      WHEN MATCHED THEN
        UPDATE SET
          [CHECKS_JSON] = @CHECKS_JSON,
          [MOD_ID] = @USER_ID,
          [MOD_DATE] = @NOW
      WHEN NOT MATCHED THEN
        INSERT ([ANCD], [YEAR], [EMPNO], [CHECKS_JSON], [REG_ID], [REG_DATE], [MOD_ID], [MOD_DATE])
        VALUES (@ANCD, @YEAR, @EMPNO, @CHECKS_JSON, @USER_ID, @NOW, @USER_ID, @NOW);
    `);

	return normalized;
}

/** 표에서 삭제된 TASK_ID를 직원 체크 JSON에서도 정리 */
async function pruneChecksForRemovedTasks(pool, { ancd, year, keepTaskIds }) {
	const rows = await pool
		.request()
		.input('ANCD', ancd)
		.input('YEAR', year)
		.query(`
      SELECT [EC_SEQ], [EMPNO], [CHECKS_JSON]
      FROM ${TABLE_CHECKS}
      WHERE [ANCD] = @ANCD AND [YEAR] = @YEAR
    `);

	const keep = new Set(keepTaskIds);
	const now = new Date();
	for (const r of rows.recordset || []) {
		const checks = parseChecksJson(r.CHECKS_JSON);
		const next = checks.filter((c) => keep.has(String(c.TASK_ID ?? '')));
		if (next.length === checks.length) continue;
		await pool
			.request()
			.input('EC_SEQ', r.EC_SEQ)
			.input('CHECKS_JSON', JSON.stringify(next))
			.input('NOW', now)
			.query(`
        UPDATE ${TABLE_CHECKS}
        SET [CHECKS_JSON] = @CHECKS_JSON, [MOD_ID] = 'PRUNE', [MOD_DATE] = @NOW
        WHERE [EC_SEQ] = @EC_SEQ
      `);
	}
}

async function seedStructureForAllFacilities(pool, year, userId) {
	const now = new Date();
	const facilities = await pool.request().query(`
    SELECT [ANCD], [ANNM]
    FROM ${TABLE_FACILITY}
    WHERE [ANCD] IS NOT NULL
    ORDER BY [ANCD]
  `);
	const rows = facilities.recordset || [];
	let facilityCount = 0;

	for (const fac of rows) {
		await upsertStructure(pool, {
			ancd: fac.ANCD,
			year,
			tasks: EVALUATION_CHECKLIST_DEFAULT_TEMPLATE,
			userId,
			now,
		});
		facilityCount += 1;
	}

	return {
		facilityCount,
		templateRows: EVALUATION_CHECKLIST_DEFAULT_TEMPLATE.length,
		rowsPerFacility: 1,
	};
}

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const year = parseYear(searchParams.get('year'));
		const paramAncd = searchParams.get('ancd');
		const paramEmpno = searchParams.get('empno');

		const auth = assertAnCdMatchesSession(req, paramAncd);
		if (!auth.ok) return auth.response;

		if (year == null) {
			return jsonError({ success: false, error: 'year가 필요합니다.' }, 400);
		}

		const ancd = auth.sessionAncd;
		const empno = resolveEmpno(req, paramEmpno);
		if (!empno) {
			return jsonError({ success: false, error: '직원번호(EMPNO)를 확인할 수 없습니다.' }, 400);
		}

		const pool = await connPool;
		await ensureTables(pool);

		const structureRes = await pool
			.request()
			.input('ANCD', ancd)
			.input('YEAR', year)
			.query(`
        SELECT TOP 1 *
        FROM ${TABLE_STRUCTURE}
        WHERE [ANCD] = @ANCD AND [YEAR] = @YEAR
      `);

		const structureRow = structureRes.recordset?.[0];
		const structure = structureRow ? mapStructureToApi(structureRow.TASKS_JSON) : [];

		const checksRes = await pool
			.request()
			.input('ANCD', ancd)
			.input('YEAR', year)
			.input('EMPNO', empno)
			.query(`
        SELECT TOP 1 *
        FROM ${TABLE_CHECKS}
        WHERE [ANCD] = @ANCD AND [YEAR] = @YEAR AND [EMPNO] = @EMPNO
      `);

		const checkRow = checksRes.recordset?.[0];
		const checks = checkRow ? mapChecksToApi(checkRow.CHECKS_JSON) : [];

		return jsonOk({
			success: true,
			ancd,
			year,
			empno,
			structure,
			checks,
		});
	} catch (error) {
		console.error('evaluation-checklists GET 오류:', error);
		return jsonError({
			success: false,
			error: '평가 체크리스트 조회 중 오류가 발생했습니다.',
			details: error.message,
		});
	}
}

export async function POST(req) {
	try {
		const body = await req.json();
		const year = parseYear(body?.year ?? body?.YEAR);
		const mode = String(body?.mode ?? 'both').toLowerCase();
		const paramAncd = body?.ancd ?? body?.ANCD;

		const auth = assertAnCdMatchesSession(req, paramAncd);
		if (!auth.ok) return auth.response;

		if (year == null) {
			return jsonError({ success: false, error: 'year가 필요합니다.' }, 400);
		}

		const ancd = auth.sessionAncd;
		const empno = resolveEmpno(req, body?.empno ?? body?.EMPNO);
		const userId = resolveUserId(req);
		const pool = await connPool;
		await ensureTables(pool);
		const now = new Date();

		if (mode === 'seedallstructure' || mode === 'seed_all_structure') {
			const result = await seedStructureForAllFacilities(pool, year, userId || 'SEED');
			return jsonOk({
				success: true,
				message: `전 기관(${result.facilityCount}곳) 표 형식 각 1건 저장 완료`,
				year,
				...result,
			});
		}

		const saveStructure = mode === 'structure' || mode === 'both';
		const saveChecks = mode === 'checks' || mode === 'both';

		if (saveChecks && !empno) {
			return jsonError({ success: false, error: '직원번호(EMPNO)를 확인할 수 없습니다.' }, 400);
		}

		if (saveStructure) {
			const tasks = Array.isArray(body?.tasks) ? body.tasks : [];
			const normalized = await upsertStructure(pool, {
				ancd,
				year,
				tasks,
				userId,
				now,
			});
			await pruneChecksForRemovedTasks(pool, {
				ancd,
				year,
				keepTaskIds: normalized.map((t) => t.TASK_ID),
			});
		}

		if (saveChecks) {
			const checks = Array.isArray(body?.checks) ? body.checks : [];
			await upsertChecks(pool, {
				ancd,
				year,
				empno,
				checks,
				userId,
				now,
			});
		}

		return jsonOk({
			success: true,
			message: '저장되었습니다.',
			ancd,
			year,
			empno: saveChecks ? empno : undefined,
			mode,
		});
	} catch (error) {
		console.error('evaluation-checklists POST 오류:', error);
		return jsonError({
			success: false,
			error: '평가 체크리스트 저장 중 오류가 발생했습니다.',
			details: error.message,
		});
	}
}
