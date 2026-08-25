require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getConnectionPool } = require('../src/config/server');

async function main() {
	const pool = await getConnectionPool();
	if (!pool) {
		console.error('no pool');
		process.exit(1);
	}

	const exists = await pool.request().query(`
		SELECT o.name, o.type_desc
		FROM [돌봄시설DB].sys.objects o
		WHERE o.name IN (N'V51012', N'F51012')
	`);
	console.log('objects:', exists.recordset);

	const def = await pool.request().query(`
		SELECT OBJECT_DEFINITION(OBJECT_ID(N'[돌봄시설DB].[dbo].[V51012]')) AS def
	`);
	const text = def.recordset[0]?.def || '(no view)';
	console.log('DEF_LEN', text.length);
	console.log(text);

	const cols = await pool.request().query(`
		SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
		FROM [돌봄시설DB].INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_NAME IN ('V51012', 'F51012')
		ORDER BY TABLE_NAME, ORDINAL_POSITION
	`);
	const grouped = {};
	for (const r of cols.recordset) {
		grouped[r.TABLE_NAME] = grouped[r.TABLE_NAME] || [];
		grouped[r.TABLE_NAME].push(r.COLUMN_NAME);
	}
	console.log('--- F51012 cols ---');
	console.log((grouped.F51012 || []).join(', '));
	console.log('--- V51012 cols ---');
	console.log((grouped.V51012 || []).join(', '));
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
