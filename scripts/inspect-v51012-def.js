require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getConnectionPool } = require('../src/config/server');

async function main() {
	const pool = await getConnectionPool();
	if (!pool) {
		console.error('no pool');
		process.exit(1);
	}

	const mods = await pool.request().query(`
		SELECT m.definition
		FROM [돌봄시설DB].sys.sql_modules m
		INNER JOIN [돌봄시설DB].sys.objects o ON m.object_id = o.object_id
		WHERE o.name = N'V51012'
	`);
	const row = mods.recordset[0] || {};
	console.log('defLen:', String(row.definition || '').length);
	if (row.definition) {
		require('fs').writeFileSync(require('path').join(__dirname, 'v51012-def.sql'), row.definition, 'utf8');
		console.log('wrote scripts/v51012-def.sql');
	}

	const sample = await pool.request().query(`
		SELECT TOP 1 *
		FROM [돌봄시설DB].[dbo].[V51012]
		WHERE C01 IS NOT NULL OR H01 IS NOT NULL OR I01 IS NOT NULL
	`);
	const s = sample.recordset[0] || {};
	const keys = [
		'C01','ED_C01','C02','ED_C02','C03','ED_C03',
		'D01_01','ED_D01_01','D08_01','ED_D08_01',
		'H01','ED_H01_01','ED_H01_02','ED_H01_03','ED_H01_04','ED_H01_05',
		'I01','ED_I01_01','ED_I01_02','ED_I01_03','ED_I01_04',
		'J01','ED_J01_01','ED_J01_02',
		'K01','ED_K01_01','L01_01','ED_L01_01',
		'검사자','수급자성명','수급자생일','수급자나이','성별','장기요양인정번호','장기요양등급',
		'P_SEX','P_GRD','HEIGHT','WEIGHT','RQDT','RQEMP'
	];
	for (const k of keys) {
		if (Object.prototype.hasOwnProperty.call(s, k) || Object.keys(s).some((x) => x.toUpperCase() === k.toUpperCase())) {
			const found = Object.keys(s).find((x) => x === k || x.toUpperCase() === k.toUpperCase());
			console.log(found, '=', JSON.stringify(s[found]));
		} else {
			console.log(k, 'MISSING');
		}
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
