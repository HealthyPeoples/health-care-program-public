/**
 * F10010에 생활실(ROOM_NO) 컬럼을 보장하고,
 * 비어 있는 수급자는 F14090 → F30112 순으로 한 번 채웁니다.
 * 이후 조회/저장은 F10010만 사용합니다.
 */
const DB = '돌봄시설DB';
const T_F10010 = `[${DB}].[dbo].[F10010]`;
const T_F14090 = `[${DB}].[dbo].[F14090]`;
const T_F30112 = `[${DB}].[dbo].[F30112]`;

let ensureColumnPromise = null;
const backfilledAncd = new Set();

async function hasF10010RoomNoColumn(pool) {
	const result = await pool.request().query(`
		SELECT 1 AS ok
		FROM [${DB}].sys.columns c
		INNER JOIN [${DB}].sys.tables t ON c.object_id = t.object_id
		INNER JOIN [${DB}].sys.schemas s ON t.schema_id = s.schema_id
		WHERE s.name = N'dbo'
		  AND t.name = N'F10010'
		  AND c.name = N'ROOM_NO'
	`);
	return (result.recordset || []).length > 0;
}

async function ensureF10010RoomNoColumn(pool) {
	if (!pool) return;
	if (!ensureColumnPromise) {
		ensureColumnPromise = (async () => {
			if (await hasF10010RoomNoColumn(pool)) return;
			await pool.request().query(`
				ALTER TABLE ${T_F10010}
				ADD [ROOM_NO] NVARCHAR(30) NULL;
			`);
			if (!(await hasF10010RoomNoColumn(pool))) {
				throw new Error('F10010.ROOM_NO 컬럼 추가 후에도 확인되지 않습니다.');
			}
			console.log('F10010.ROOM_NO 컬럼을 추가했습니다.');
		})().catch((err) => {
			ensureColumnPromise = null;
			console.error('F10010.ROOM_NO 컬럼 추가 실패:', err?.message || err);
			throw err;
		});
	}
	await ensureColumnPromise;
}

function isEmptyRoomSql(alias) {
	return `(
		${alias}.[ROOM_NO] IS NULL
		OR LTRIM(RTRIM(CAST(${alias}.[ROOM_NO] AS NVARCHAR(50)))) = N''
		OR LTRIM(RTRIM(CAST(${alias}.[ROOM_NO] AS NVARCHAR(50)))) = N'0'
	)`;
}

async function backfillRoomAndFloor(pool, sessionAncd) {
	const key = String(sessionAncd ?? '').trim();
	if (!key || backfilledAncd.has(key)) return;

	const req = () => pool.request().input('ANCD', key);

	await req().query(`
		UPDATE t
		SET t.[ROOM_NO] = src.[ROOM_NO]
		FROM ${T_F10010} t
		INNER JOIN (
			SELECT
				s.[ANCD],
				s.[PNUM],
				s.[ROOM_NO],
				ROW_NUMBER() OVER (
					PARTITION BY s.[ANCD], s.[PNUM]
					ORDER BY CAST(s.[YYYYMM] AS INT) DESC
				) AS rn
			FROM ${T_F14090} s
			WHERE s.[ANCD] = @ANCD
			  AND s.[ROOM_NO] IS NOT NULL
			  AND LTRIM(RTRIM(CAST(s.[ROOM_NO] AS NVARCHAR(50)))) <> N''
			  AND LTRIM(RTRIM(CAST(s.[ROOM_NO] AS NVARCHAR(50)))) <> N'0'
		) src
			ON t.[ANCD] = src.[ANCD]
		   AND CAST(t.[PNUM] AS VARCHAR) = CAST(src.[PNUM] AS VARCHAR)
		   AND src.rn = 1
		WHERE t.[ANCD] = @ANCD
		  AND ${isEmptyRoomSql('t')}
	`);

	await req().query(`
		UPDATE t
		SET t.[ROOM_NO] = src.[ROOM_NO]
		FROM ${T_F10010} t
		INNER JOIN (
			SELECT
				s.[ANCD],
				s.[PNUM],
				s.[ROOM_NO],
				ROW_NUMBER() OVER (
					PARTITION BY s.[ANCD], s.[PNUM]
					ORDER BY s.[INDT] DESC
				) AS rn
			FROM ${T_F30112} s
			WHERE s.[ANCD] = @ANCD
			  AND s.[ROOM_NO] IS NOT NULL
			  AND LTRIM(RTRIM(CAST(s.[ROOM_NO] AS NVARCHAR(50)))) <> N''
			  AND LTRIM(RTRIM(CAST(s.[ROOM_NO] AS NVARCHAR(50)))) <> N'0'
		) src
			ON t.[ANCD] = src.[ANCD]
		   AND CAST(t.[PNUM] AS VARCHAR) = CAST(src.[PNUM] AS VARCHAR)
		   AND src.rn = 1
		WHERE t.[ANCD] = @ANCD
		  AND ${isEmptyRoomSql('t')}
	`);

	await req().query(`
		UPDATE t
		SET t.[P_FLOOR] = FLOOR(n.num / 100.0)
		FROM ${T_F10010} t
		CROSS APPLY (
			SELECT TRY_CAST(
				REPLACE(REPLACE(LTRIM(RTRIM(CAST(t.[ROOM_NO] AS NVARCHAR(50)))), N'호', N''), N'층', N'')
				AS INT
			) AS num
		) n
		WHERE t.[ANCD] = @ANCD
		  AND t.[P_FLOOR] IS NULL
		  AND n.num IS NOT NULL
		  AND n.num >= 100
	`);

	backfilledAncd.add(key);
}

/**
 * @param {import('mssql').ConnectionPool} pool
 * @param {string|number} sessionAncd
 */
async function ensureF10010RoomNo(pool, sessionAncd) {
	if (!pool) return;
	await ensureF10010RoomNoColumn(pool);
	try {
		await backfillRoomAndFloor(pool, sessionAncd);
	} catch (err) {
		console.warn('F10010 생활실/층수 백필 경고:', err?.message || err);
	}
}

module.exports = {
	ensureF10010RoomNo,
	ensureF10010RoomNoColumn,
};
