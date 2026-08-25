/**
 * @file 비급여 식대·간식 — 계약 금액이 있는 수급자만 청구
 *
 * @description
 * 급여계산(Usp_P40100) 직후 F10110 계약의 식대 1회(EAMT)·간식비 1회(ETAMT)가
 * 있는 수급자에게만, 그날 F14020 제공여부로 일별 금액을 맞춥니다.
 *
 * - 식대: EAMT > 0 이고 아침(MOST)/점심(LCST)/저녁(DNST) 제공 시 각 EAMT
 * - 간식: ETAMT > 0 이고 오전(MGST)/오후(AGST) 제공 시 각 ETAMT. 저녁은 0원
 * - 계약 금액이 없거나 0이면 해당 비급여는 0원
 *
 * 서버 QUERY_GOVERNOR_COST_LIMIT 때문에 월 일괄이 취소되면 일자별로 재시도합니다.
 */

const sql = require('mssql');

/** Usp_P40100 전체계산 시 넘기는 수급자번호 */
const ALL_PNUM = 9999999;

function providedSql(col) {
	return `LTRIM(RTRIM(CAST(ISNULL(f.[${col}], '2') AS VARCHAR(10)))) = '1'`;
}

const LATEST_CONTRACT_JOIN = `
		LEFT JOIN (
			SELECT t.[ANCD], t.[PNUM], t.[EAMT], t.[ETAMT]
			FROM (
				SELECT
					[ANCD], [PNUM], [EAMT], [ETAMT],
					ROW_NUMBER() OVER (
						PARTITION BY [ANCD], [PNUM]
						ORDER BY [INDT] DESC, [CDT] DESC
					) AS rn
				FROM [돌봄시설DB].[dbo].[F10110]
				WHERE [ANCD] = @ANCD
			) t
			WHERE t.rn = 1
		) c
			ON c.[ANCD] = d.[ANCD]
		   AND c.[PNUM] = d.[PNUM]
`;

const SET_MEAL_SNACK_SQL = `
			d.[MOAMT] = CASE
				WHEN ISNULL(c.[EAMT], 0) > 0 AND ${providedSql('MOST')} THEN c.[EAMT]
				ELSE 0
			END,
			d.[AFAMT] = CASE
				WHEN ISNULL(c.[EAMT], 0) > 0 AND ${providedSql('LCST')} THEN c.[EAMT]
				ELSE 0
			END,
			d.[EVAMT] = CASE
				WHEN ISNULL(c.[EAMT], 0) > 0 AND ${providedSql('DNST')} THEN c.[EAMT]
				ELSE 0
			END,
			d.[AMAMT] = CASE
				WHEN ISNULL(c.[ETAMT], 0) > 0 AND ${providedSql('MGST')} THEN c.[ETAMT]
				ELSE 0
			END,
			d.[PMAMT] = CASE
				WHEN ISNULL(c.[ETAMT], 0) > 0 AND ${providedSql('AGST')} THEN c.[ETAMT]
				ELSE 0
			END,
			d.[EMAMT] = 0
`;

function daysInSalmm(salmm) {
	const y = parseInt(String(salmm).slice(0, 4), 10);
	const m = parseInt(String(salmm).slice(4, 6), 10);
	return new Date(y, m, 0).getDate();
}

function svdtForDay(salmm, day) {
	const y = String(salmm).slice(0, 4);
	const m = String(salmm).slice(4, 6);
	return `${y}-${m}-${String(day).padStart(2, '0')}`;
}

function bindAncdSalmm(req, ancd, salmm) {
	req.input('ANCD', sql.VarChar(30), String(ancd));
	req.input('SALMM', sql.Char(6), String(salmm));
}

/**
 * F40100.BSAL1 = 아침+점심+저녁 식대 합, BSAL2 = 오전+오후 간식 합
 */
async function recalcNonBenefitTotals(pool, ancd, salmm, pnum) {
	const req = pool.request();
	bindAncdSalmm(req, ancd, salmm);
	const pnumFilter = pnum ? 'AND h.[PNUM] = @PNUM' : '';
	if (pnum) req.input('PNUM', sql.VarChar(30), String(pnum));

	await req.query(`
		SET QUERY_GOVERNOR_COST_LIMIT 0;
		UPDATE h
		SET
			h.[BSAL1] = ISNULL(d.mealAmt, 0),
			h.[BSAL2] = ISNULL(d.snackAmt, 0)
		FROM [돌봄시설DB].[dbo].[F40100] h
		OUTER APPLY (
			SELECT
				SUM(ISNULL(x.[MOAMT], 0) + ISNULL(x.[AFAMT], 0) + ISNULL(x.[EVAMT], 0)) AS mealAmt,
				SUM(ISNULL(x.[AMAMT], 0) + ISNULL(x.[PMAMT], 0)) AS snackAmt
			FROM [돌봄시설DB].[dbo].[F40110] x
			WHERE x.[ANCD] = h.[ANCD]
			  AND x.[SALMM] = h.[SALMM]
			  AND x.[PNUM] = h.[PNUM]
		) d
		WHERE h.[ANCD] = @ANCD
		  AND h.[SALMM] = @SALMM
		  ${pnumFilter}
	`);
}

async function adjustOneDay(pool, ancd, salmm, pnum, svdtIso) {
	const all = pnum == null;
	const req = pool.request();
	bindAncdSalmm(req, ancd, salmm);
	req.input('SVDT', sql.Date, svdtIso);
	if (!all) req.input('PNUM', sql.VarChar(30), String(pnum));
	const pnumFilter = all ? '' : 'AND d.[PNUM] = @PNUM';

	await req.query(`
		UPDATE d
		SET
			${SET_MEAL_SNACK_SQL}
		FROM [돌봄시설DB].[dbo].[F40110] d
		LEFT JOIN [돌봄시설DB].[dbo].[F14020] f
			ON f.[ANCD] = d.[ANCD]
		   AND f.[PNUM] = d.[PNUM]
		   AND CONVERT(date, f.[SVDT]) = @SVDT
		${LATEST_CONTRACT_JOIN}
		WHERE d.[ANCD] = @ANCD
		  AND d.[SALMM] = @SALMM
		  AND CONVERT(date, d.[SVDT]) = @SVDT
		  ${pnumFilter}
	`);
}

async function adjustByDay(pool, ancd, salmm, pnum) {
	const last = daysInSalmm(salmm);
	for (let day = 1; day <= last; day += 1) {
		await adjustOneDay(pool, ancd, salmm, pnum, svdtForDay(salmm, day));
	}
}

async function adjustWholeMonth(pool, ancd, salmm, pnum) {
	const all = pnum == null;
	const req = pool.request();
	bindAncdSalmm(req, ancd, salmm);
	if (!all) req.input('PNUM', sql.VarChar(30), String(pnum));
	const pnumFilter = all ? '' : 'AND d.[PNUM] = @PNUM';

	await req.query(`
		SET QUERY_GOVERNOR_COST_LIMIT 0;

		UPDATE d
		SET
			${SET_MEAL_SNACK_SQL}
		FROM [돌봄시설DB].[dbo].[F40110] d
		LEFT JOIN [돌봄시설DB].[dbo].[F14020] f
			ON f.[ANCD] = d.[ANCD]
		   AND f.[PNUM] = d.[PNUM]
		   AND CONVERT(date, f.[SVDT]) = CONVERT(date, d.[SVDT])
		${LATEST_CONTRACT_JOIN}
		WHERE d.[ANCD] = @ANCD
		  AND d.[SALMM] = @SALMM
		  ${pnumFilter};
	`);
}

/**
 * 급여계산 후 비급여 식대·간식을 계약 금액 + 제공여부로 맞춥니다.
 */
async function adjustSnackCopayAfterSalaryCalc(pool, ancd, salmm, pnum) {
	if (!pool || ancd == null || !salmm) return { ok: false };

	const all = Number(pnum) === ALL_PNUM || pnum == null;
	const pnumKey = all ? null : String(pnum);

	try {
		await adjustWholeMonth(pool, ancd, salmm, pnumKey);
	} catch (monthErr) {
		console.warn('비급여 식대·간식 월 일괄 보정 실패, 일자별로 재시도:', monthErr?.message || monthErr);
		await adjustByDay(pool, ancd, salmm, pnumKey);
	}

	try {
		await recalcNonBenefitTotals(pool, ancd, salmm, pnumKey);
	} catch (sumErr) {
		console.warn('비급여 합계 일괄 보정 실패, 단순 합계로 재시도:', sumErr?.message || sumErr);
		const req = pool.request();
		bindAncdSalmm(req, ancd, salmm);
		const pnumFilter = pnumKey ? 'AND h.[PNUM] = @PNUM' : '';
		if (pnumKey) req.input('PNUM', sql.VarChar(30), String(pnumKey));
		await req.query(`
			UPDATE h
			SET
				h.[BSAL1] = ISNULL((
					SELECT SUM(ISNULL(x.[MOAMT], 0) + ISNULL(x.[AFAMT], 0) + ISNULL(x.[EVAMT], 0))
					FROM [돌봄시설DB].[dbo].[F40110] x
					WHERE x.[ANCD] = h.[ANCD]
					  AND x.[SALMM] = h.[SALMM]
					  AND x.[PNUM] = h.[PNUM]
				), 0),
				h.[BSAL2] = ISNULL((
					SELECT SUM(ISNULL(x.[AMAMT], 0) + ISNULL(x.[PMAMT], 0))
					FROM [돌봄시설DB].[dbo].[F40110] x
					WHERE x.[ANCD] = h.[ANCD]
					  AND x.[SALMM] = h.[SALMM]
					  AND x.[PNUM] = h.[PNUM]
				), 0)
			FROM [돌봄시설DB].[dbo].[F40100] h
			WHERE h.[ANCD] = @ANCD
			  AND h.[SALMM] = @SALMM
			  ${pnumFilter}
		`);
	}

	return { ok: true };
}

module.exports = {
	adjustSnackCopayAfterSalaryCalc,
};
