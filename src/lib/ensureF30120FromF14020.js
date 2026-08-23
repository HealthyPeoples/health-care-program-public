/**
 * @file F14020(일 수급자급여실적) 기준 F30120(활력증상) 공란 행 보장
 *
 * @description
 * 급여실적 전체추가·개별저장 등으로 F14020 행이 생기면
 * 같은 일자·수급자의 활력증상 등록 명단(F30120)이 없으면 공란으로 생성합니다.
 * 이미 있는 행은 유지합니다(측정값 덮어쓰지 않음).
 * 신규 행 작성자(INEMPNO/INEMPNM/NS_WRITE_NAME)는 일 급여실적 등록 직원입니다.
 */

const DB_NAME = '돌봄시설DB';
const columnSetCache = new Map();

/**
 * YYYY-MM-DD → YYYYMMDD (F30120.RSDT)
 * @param {string} svdtIso
 * @returns {string}
 */
function toRsdtDigits(svdtIso) {
	return String(svdtIso || '')
		.trim()
		.replace(/-/g, '')
		.slice(0, 8);
}

function normalizeRegistrar(registrar) {
	const empnm = registrar?.empnm != null ? String(registrar.empnm).trim() : '';
	const empnoRaw = registrar?.empno;
	const empno =
		empnoRaw == null || String(empnoRaw).trim() === '' ? null : String(empnoRaw).trim();
	return { empno, empnm };
}

function truncName(name, max) {
	const s = String(name || '').trim();
	if (!s) return null;
	return s.length > max ? s.slice(0, max) : s;
}

/**
 * @param {import('mssql').ConnectionPool} pool
 * @param {string} tableName
 * @returns {Promise<Set<string>>}
 */
async function getTableColumnSet(pool, tableName) {
	const key = String(tableName || '').toUpperCase();
	if (columnSetCache.has(key)) return columnSetCache.get(key);
	try {
		const result = await pool
			.request()
			.input('TABLE_NAME', key)
			.query(`
				SELECT COLUMN_NAME
				FROM [${DB_NAME}].INFORMATION_SCHEMA.COLUMNS
				WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = @TABLE_NAME
			`);
		const cols = new Set();
		(result.recordset || []).forEach((r) => {
			const c = String(r.COLUMN_NAME || '').trim().toUpperCase();
			if (c) cols.add(c);
		});
		if (cols.size > 0) columnSetCache.set(key, cols);
		return cols;
	} catch (e) {
		console.warn(`${key} 컬럼 스키마 조회 실패:`, e?.message || e);
		return new Set();
	}
}

/**
 * 세션 UID로 F00120 직원번호·이름을 조회합니다.
 * @param {import('mssql').ConnectionPool} pool
 * @param {string|number} ancd
 * @param {string|null|undefined} uid
 * @returns {Promise<{ empno: string|null, empnm: string }>}
 */
async function resolveSessionEmployee(pool, ancd, uid) {
	const uidStr = String(uid || '').trim();
	if (!pool || ancd == null || ancd === '' || !uidStr) {
		return { empno: null, empnm: '' };
	}
	try {
		const result = await pool
			.request()
			.input('ANCD', ancd)
			.input('UID', uidStr)
			.query(`
				SELECT TOP 1 [EMPNO], [EMPNM]
				FROM [${DB_NAME}].[dbo].[F00120]
				WHERE [ANCD] = @ANCD AND [UID] = @UID
			`);
		const row = result.recordset?.[0];
		return {
			empno: row?.EMPNO != null && String(row.EMPNO).trim() !== '' ? String(row.EMPNO).trim() : null,
			empnm: row?.EMPNM != null ? String(row.EMPNM).trim() : ''
		};
	} catch (e) {
		console.warn('세션 직원 조회 실패:', e?.message || e);
		return { empno: null, empnm: '' };
	}
}

/**
 * F14020에 등록 직원이 비어 있으면 채웁니다. 이미 있는 값은 유지합니다.
 * @param {import('mssql').ConnectionPool} pool
 * @param {string|number} ancd
 * @param {string} svdtIso
 * @param {string[]|null|undefined} pnums
 * @param {{ empno?: any, empnm?: string }|null|undefined} registrar
 */
async function stampF14020Registrar(pool, ancd, svdtIso, pnums, registrar) {
	const { empno, empnm } = normalizeRegistrar(registrar);
	if (!pool || !ancd || !svdtIso || (!empnm && !empno)) {
		return { ok: false, updated: 0 };
	}

	const cols = await getTableColumnSet(pool, 'F14020');
	const hasNm = cols.has('INEMPNM');
	const hasNo = cols.has('INEMPNO');
	if (!hasNm && !hasNo) return { ok: true, updated: 0 };

	const request = pool.request();
	request.input('ANCD', ancd);
	request.input('SVDT', svdtIso);
	if (hasNm) request.input('INEMPNM', empnm || null);
	if (hasNo) request.input('INEMPNO', empno);

	const normalizedPnums = Array.isArray(pnums)
		? [...new Set(pnums.map((p) => String(p ?? '').trim()).filter(Boolean))]
		: null;

	let pnumFilter = '';
	if (normalizedPnums && normalizedPnums.length > 0) {
		const placeholders = normalizedPnums.map((_, i) => {
			const key = `PNUM${i}`;
			request.input(key, normalizedPnums[i]);
			return `@${key}`;
		});
		pnumFilter = ` AND CAST([PNUM] AS VARCHAR) IN (${placeholders.join(',')})`;
	} else if (normalizedPnums && normalizedPnums.length === 0) {
		return { ok: true, updated: 0 };
	}

	const setParts = [];
	const emptyParts = [];
	if (hasNm) {
		setParts.push(`
			[INEMPNM] = CASE
				WHEN NULLIF(LTRIM(RTRIM(CAST([INEMPNM] AS NVARCHAR(100)))), N'') IS NULL THEN @INEMPNM
				ELSE [INEMPNM]
			END
		`);
		emptyParts.push(`NULLIF(LTRIM(RTRIM(CAST([INEMPNM] AS NVARCHAR(100)))), N'') IS NULL`);
	}
	if (hasNo) {
		setParts.push(`
			[INEMPNO] = CASE
				WHEN [INEMPNO] IS NULL THEN @INEMPNO
				ELSE [INEMPNO]
			END
		`);
		emptyParts.push(`[INEMPNO] IS NULL`);
	}

	try {
		const result = await request.query(`
			UPDATE [${DB_NAME}].[dbo].[F14020]
			SET ${setParts.join(',')}
			WHERE [ANCD] = @ANCD
				AND [SVDT] = @SVDT
				${pnumFilter}
				AND (${emptyParts.join(' OR ')})
		`);
		const updated = Array.isArray(result.rowsAffected)
			? result.rowsAffected.reduce((a, b) => a + (Number(b) || 0), 0)
			: Number(result.rowsAffected) || 0;
		return { ok: true, updated };
	} catch (e) {
		console.warn('F14020 등록직원 기록 경고:', e?.message || e);
		return { ok: false, updated: 0 };
	}
}

function bindPnumFilter(request, pnums) {
	const normalizedPnums = Array.isArray(pnums)
		? [...new Set(pnums.map((p) => String(p ?? '').trim()).filter(Boolean))]
		: null;

	if (normalizedPnums && normalizedPnums.length === 0) {
		return { skip: true, pnumFilter: '' };
	}

	let pnumFilter = '';
	if (normalizedPnums && normalizedPnums.length > 0) {
		const placeholders = normalizedPnums.map((_, i) => {
			const key = `PNUM${i}`;
			request.input(key, normalizedPnums[i]);
			return `@${key}`;
		});
		pnumFilter = ` AND CAST(f.[PNUM] AS VARCHAR) IN (${placeholders.join(',')})`;
	}
	return { skip: false, pnumFilter };
}

/**
 * 당일 F14020 수급자에 대해 F30120 공란 행을 보장합니다.
 *
 * @param {import('mssql').ConnectionPool} pool
 * @param {string|number} ancd
 * @param {string} svdtIso YYYY-MM-DD
 * @param {string[]|null|undefined} [pnums] 지정 시 해당 수급자만, 없으면 당일 F14020 전원
 * @param {{ empno?: any, empnm?: string }|null|undefined} [registrar] 일 급여실적 등록 직원
 * @returns {Promise<{ ok: boolean, inserted: number, rsdt: string }>}
 */
let ensureVsSeqPromise = null;

/**
 * 같은 날 복수 측정을 위한 F30120.VS_SEQ 컬럼·유니크 키를 보장합니다.
 * @param {import('mssql').ConnectionPool} pool
 */
async function ensureF30120VsSeq(pool) {
	if (!pool) return;
	if (!ensureVsSeqPromise) {
		ensureVsSeqPromise = (async () => {
			await pool.request().query(`
				IF COL_LENGTH(N'[${DB_NAME}].[dbo].[F30120]', N'VS_SEQ') IS NULL
				BEGIN
					ALTER TABLE [${DB_NAME}].[dbo].[F30120]
					ADD [VS_SEQ] INT NULL;
				END
			`);
			await pool.request().query(`
				UPDATE [${DB_NAME}].[dbo].[F30120]
				SET [VS_SEQ] = 1
				WHERE [VS_SEQ] IS NULL;
			`);
			try {
				await pool.request().query(`
					DECLARE @pkName sysname;
					DECLARE @pkHasSeq bit = 0;

					SELECT @pkName = kc.name
					FROM [${DB_NAME}].sys.key_constraints kc
					INNER JOIN [${DB_NAME}].sys.tables t ON kc.parent_object_id = t.object_id
					WHERE t.name = N'F30120' AND kc.[type] = 'PK';

					IF @pkName IS NOT NULL
					BEGIN
						IF EXISTS (
							SELECT 1
							FROM [${DB_NAME}].sys.index_columns ic
							INNER JOIN [${DB_NAME}].sys.columns c
								ON ic.object_id = c.object_id AND ic.column_id = c.column_id
							INNER JOIN [${DB_NAME}].sys.key_constraints kc
								ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
							INNER JOIN [${DB_NAME}].sys.tables t ON kc.parent_object_id = t.object_id
							WHERE t.name = N'F30120' AND kc.[type] = 'PK' AND c.name = N'VS_SEQ'
						)
							SET @pkHasSeq = 1;

						IF @pkHasSeq = 0
						BEGIN
							DECLARE @dropPk nvarchar(400) =
								N'ALTER TABLE [${DB_NAME}].[dbo].[F30120] DROP CONSTRAINT [' + REPLACE(@pkName, ']', ']]') + N']';
							EXEC (@dropPk);
						END
					END

					IF NOT EXISTS (
						SELECT 1 FROM [${DB_NAME}].sys.indexes i
						INNER JOIN [${DB_NAME}].sys.tables t ON i.object_id = t.object_id
						WHERE t.name = N'F30120' AND i.name = N'UQ_F30120_ANCD_PNUM_RSDT_SEQ'
					)
					BEGIN
						CREATE UNIQUE INDEX [UQ_F30120_ANCD_PNUM_RSDT_SEQ]
							ON [${DB_NAME}].[dbo].[F30120] ([ANCD], [PNUM], [RSDT], [VS_SEQ]);
					END
				`);
			} catch (keyErr) {
				console.warn('F30120 동일일자 복수 키 설정 경고:', keyErr?.message || keyErr);
			}
		})().catch((err) => {
			ensureVsSeqPromise = null;
			throw err;
		});
	}
	await ensureVsSeqPromise;
}

async function ensureF30120FromF14020(pool, ancd, svdtIso, pnums, registrar) {
	const rsdt = toRsdtDigits(svdtIso);
	if (!pool || !ancd || !/^\d{8}$/.test(rsdt)) {
		return { ok: false, inserted: 0, rsdt };
	}
	await ensureF30120VsSeq(pool);

	const now = new Date();
	const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');
	const { empno, empnm } = normalizeRegistrar(registrar);
	const writerName = truncName(empnm, 100);
	const writeName = truncName(empnm, 20);

	const f14020Cols = await getTableColumnSet(pool, 'F14020');
	const hasF14020Nm = f14020Cols.has('INEMPNM');
	const hasF14020No = f14020Cols.has('INEMPNO');

	const request = pool.request();
	request.input('ANCD', ancd);
	request.input('SVDT', svdtIso);
	request.input('RSDT', rsdt);
	request.input('INDT', nowStr);
	request.input('INEMPNO', empno);
	request.input('INEMPNM', writerName);
	request.input('NS_WRITE_NAME', writeName);

	const { skip, pnumFilter } = bindPnumFilter(request, pnums);
	if (skip) return { ok: true, inserted: 0, rsdt };

	const inempnoExpr = hasF14020No
		? 'COALESCE(f.[INEMPNO], @INEMPNO)'
		: '@INEMPNO';
	const inempnmExpr = hasF14020Nm
		? `COALESCE(NULLIF(LTRIM(RTRIM(CAST(f.[INEMPNM] AS NVARCHAR(100)))), N''), @INEMPNM)`
		: '@INEMPNM';
	const writeNameExpr = hasF14020Nm
		? `LEFT(COALESCE(NULLIF(LTRIM(RTRIM(CAST(f.[INEMPNM] AS NVARCHAR(100)))), N''), @NS_WRITE_NAME), 20)`
		: '@NS_WRITE_NAME';

	const result = await request.query(`
		INSERT INTO [${DB_NAME}].[dbo].[F30120] (
			[ANCD],[PNUM],[RSDT],
			[SBDS],[EBDS],[SBDP],[EBDP],[TMPBD],[PUCNT],[BRCNT],[WEIGHT],[HEIGHT],
			[BJYN],[BJDG],[BJPA],[NUDES],
			[INDT],
			[INEMPNO],[INEMPNM],
			[NS_MEDI_CHK],[NS_JUSA_CHK],[NS_ACT_CHK],[NS_FAL_CHK],[NS_DRY_CHK],[NS_DNG_CHK],
			[NS_PAN_CHK],[NS_DLM_CHK],[NS_SORE_MNG],[NS_SORE_DESC],[NS_WRITE_NAME],
			[WATER_INTAKE],[DRESSING_FLAG],[VS_SEQ]
		)
		SELECT
			f.[ANCD],
			f.[PNUM],
			@RSDT,
			NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
			NULL,NULL,NULL,N'',
			@INDT,
			${inempnoExpr},
			${inempnmExpr},
			NULL,NULL,NULL,NULL,NULL,NULL,
			NULL,NULL,NULL,NULL,${writeNameExpr},
			NULL,NULL,1
		FROM [${DB_NAME}].[dbo].[F14020] f
		WHERE f.[ANCD] = @ANCD
			AND f.[SVDT] = @SVDT
			${pnumFilter}
			AND NOT EXISTS (
				SELECT 1
				FROM [${DB_NAME}].[dbo].[F30120] v
				WHERE v.[ANCD] = f.[ANCD]
					AND CAST(v.[PNUM] AS VARCHAR) = CAST(f.[PNUM] AS VARCHAR)
					AND v.[RSDT] = @RSDT
			)
	`);

	const inserted = Array.isArray(result.rowsAffected)
		? result.rowsAffected.reduce((a, b) => a + (Number(b) || 0), 0)
		: Number(result.rowsAffected) || 0;

	try {
		const backfill = pool.request();
		backfill.input('ANCD', ancd);
		backfill.input('SVDT', svdtIso);
		backfill.input('RSDT', rsdt);
		backfill.input('INEMPNO', empno);
		backfill.input('INEMPNM', writerName);
		backfill.input('NS_WRITE_NAME', writeName);
		const backfillFilter = bindPnumFilter(backfill, pnums);
		if (!backfillFilter.skip) {
			const sourceNm = hasF14020Nm
				? `COALESCE(NULLIF(LTRIM(RTRIM(CAST(f.[INEMPNM] AS NVARCHAR(100)))), N''), @INEMPNM)`
				: `@INEMPNM`;
			const sourceNo = hasF14020No
				? 'COALESCE(f.[INEMPNO], @INEMPNO)'
				: '@INEMPNO';
			await backfill.query(`
				UPDATE v
				SET
					v.[INEMPNM] = LEFT(${sourceNm}, 100),
					v.[NS_WRITE_NAME] = LEFT(${sourceNm}, 20),
					v.[INEMPNO] = COALESCE(v.[INEMPNO], ${sourceNo})
				FROM [${DB_NAME}].[dbo].[F30120] v
				INNER JOIN [${DB_NAME}].[dbo].[F14020] f
					ON v.[ANCD] = f.[ANCD]
					AND CAST(v.[PNUM] AS VARCHAR) = CAST(f.[PNUM] AS VARCHAR)
					AND f.[SVDT] = @SVDT
				WHERE v.[ANCD] = @ANCD
					AND v.[RSDT] = @RSDT
					${backfillFilter.pnumFilter}
					AND NULLIF(LTRIM(RTRIM(CAST(v.[NS_WRITE_NAME] AS NVARCHAR(20)))), N'') IS NULL
					AND NULLIF(LTRIM(RTRIM(CAST(v.[INEMPNM] AS NVARCHAR(100)))), N'') IS NULL
					AND NULLIF(LTRIM(RTRIM(CAST(${sourceNm} AS NVARCHAR(100)))), N'') IS NOT NULL
			`);
		}
	} catch (e) {
		console.warn('F30120 작성자 보정 경고:', e?.message || e);
	}

	return { ok: true, inserted, rsdt };
}

module.exports = {
	ensureF30120FromF14020,
	ensureF30120VsSeq,
	resolveSessionEmployee,
	stampF14020Registrar,
	toRsdtDigits
};
