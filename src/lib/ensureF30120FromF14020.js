/**
 * @file F14020(일 수급자급여실적) 기준 F30120(활력증상) 공란 행 보장
 *
 * @description
 * 급여실적 전체추가·개별저장 등으로 F14020 행이 생기면
 * 같은 일자·수급자의 활력증상 등록 명단(F30120)이 없으면 공란으로 생성합니다.
 * 이미 있는 행은 유지합니다(측정값 덮어쓰지 않음).
 */

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

/**
 * 당일 F14020 수급자에 대해 F30120 공란 행을 보장합니다.
 *
 * @param {import('mssql').ConnectionPool} pool
 * @param {string|number} ancd
 * @param {string} svdtIso YYYY-MM-DD
 * @param {string[]|null|undefined} [pnums] 지정 시 해당 수급자만, 없으면 당일 F14020 전원
 * @returns {Promise<{ ok: boolean, inserted: number, rsdt: string }>}
 */
async function ensureF30120FromF14020(pool, ancd, svdtIso, pnums) {
	const rsdt = toRsdtDigits(svdtIso);
	if (!pool || !ancd || !/^\d{8}$/.test(rsdt)) {
		return { ok: false, inserted: 0, rsdt };
	}

	const now = new Date();
	const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');

	const request = pool.request();
	request.input('ANCD', ancd);
	request.input('SVDT', svdtIso);
	request.input('RSDT', rsdt);
	request.input('INDT', nowStr);

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
		pnumFilter = ` AND CAST(f.[PNUM] AS VARCHAR) IN (${placeholders.join(',')})`;
	} else if (normalizedPnums && normalizedPnums.length === 0) {
		return { ok: true, inserted: 0, rsdt };
	}

	const result = await request.query(`
		INSERT INTO [돌봄시설DB].[dbo].[F30120] (
			[ANCD],[PNUM],[RSDT],
			[SBDS],[EBDS],[SBDP],[EBDP],[TMPBD],[PUCNT],[BRCNT],[WEIGHT],[HEIGHT],
			[BJYN],[BJDG],[BJPA],[NUDES],
			[INDT],
			[NS_MEDI_CHK],[NS_JUSA_CHK],[NS_ACT_CHK],[NS_FAL_CHK],[NS_DRY_CHK],[NS_DNG_CHK],
			[NS_PAN_CHK],[NS_DLM_CHK],[NS_SORE_MNG],[NS_SORE_DESC],[NS_WRITE_NAME],
			[WATER_INTAKE],[DRESSING_FLAG]
		)
		SELECT
			f.[ANCD],
			f.[PNUM],
			@RSDT,
			NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
			NULL,NULL,NULL,N'',
			@INDT,
			NULL,NULL,NULL,NULL,NULL,NULL,
			NULL,NULL,NULL,NULL,NULL,
			NULL,NULL
		FROM [돌봄시설DB].[dbo].[F14020] f
		WHERE f.[ANCD] = @ANCD
			AND f.[SVDT] = @SVDT
			${pnumFilter}
			AND NOT EXISTS (
				SELECT 1
				FROM [돌봄시설DB].[dbo].[F30120] v
				WHERE v.[ANCD] = f.[ANCD]
					AND CAST(v.[PNUM] AS VARCHAR) = CAST(f.[PNUM] AS VARCHAR)
					AND v.[RSDT] = @RSDT
			)
	`);

	const inserted = Array.isArray(result.rowsAffected)
		? result.rowsAffected.reduce((a, b) => a + (Number(b) || 0), 0)
		: Number(result.rowsAffected) || 0;

	return { ok: true, inserted, rsdt };
}

module.exports = {
	ensureF30120FromF14020,
	toRsdtDigits
};
