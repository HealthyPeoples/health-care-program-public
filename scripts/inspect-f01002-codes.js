require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getConnectionPool } = require('../src/config/server');

async function main() {
	const pool = await getConnectionPool();
	const r = await pool.request().query(`
		SELECT CODE, UCD, DSC1, DSC2
		FROM [돌봄시설DB].[dbo].[F01002]
		WHERE CODE IN ('DZ','BT','AJ','AA')
		   OR CODE LIKE 'H%'
		   OR CODE IN ('I1','I2','I3','I4','I5','EA','EB','EC','ED','EE','EF')
		ORDER BY CODE, UCD
	`);
	for (const row of r.recordset) {
		console.log([row.CODE, row.UCD, JSON.stringify(row.DSC1), JSON.stringify(row.DSC2)].join('\t'));
	}

	const codes = await pool.request().query(`
		SELECT DISTINCT CODE
		FROM [돌봄시설DB].[dbo].[F01002]
		WHERE CODE LIKE 'D%' OR CODE LIKE 'I%' OR CODE LIKE 'H%' OR CODE LIKE 'J%' OR CODE LIKE 'K%' OR CODE LIKE 'C%' OR CODE LIKE 'E%'
		ORDER BY CODE
	`);
	console.log('---all related codes---');
	console.log(codes.recordset.map((x) => x.CODE).join(', '));
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
