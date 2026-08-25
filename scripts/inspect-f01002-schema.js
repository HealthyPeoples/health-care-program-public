require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getConnectionPool } = require('../src/config/server');

async function main() {
	const pool = await getConnectionPool();
	const cols = await pool.request().query(`
		SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
		FROM [돌봄시설DB].INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_NAME = 'F01002'
		ORDER BY ORDINAL_POSITION
	`);
	console.log(cols.recordset);
	const sample = await pool.request().query(`
		SELECT TOP 1 * FROM [돌봄시설DB].[dbo].[F01002] WHERE CODE = 'DZ'
	`);
	console.log('sample', sample.recordset[0]);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
