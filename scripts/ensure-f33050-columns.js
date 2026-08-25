const { connPool } = require('../src/config/server');

(async () => {
	const pool = await connPool;
	if (!pool) {
		console.error('NO_POOL');
		process.exit(1);
	}

	await pool.request().query(`
		IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F33050]', N'MG_TM') IS NULL
			ALTER TABLE [돌봄시설DB].[dbo].[F33050] ADD [MG_TM] VARCHAR(8) NULL;

		IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F33050]', N'BAG_POS') IS NULL
			ALTER TABLE [돌봄시설DB].[dbo].[F33050] ADD [BAG_POS] NVARCHAR(20) NULL;
	`);

	const r = await pool.request().query(`
		SELECT c.name, ty.name AS type_name, c.max_length
		FROM [돌봄시설DB].sys.columns c
		INNER JOIN [돌봄시설DB].sys.tables t ON c.object_id = t.object_id
		INNER JOIN [돌봄시설DB].sys.types ty ON c.user_type_id = ty.user_type_id
		WHERE t.name = N'F33050'
		  AND c.name IN (N'MG_TM', N'BAG_POS', N'VTM_GU', N'CH_01', N'CH_02', N'CH_03', N'PSS_VAL', N'INEMPNM')
		ORDER BY c.name;
	`);
	console.log(JSON.stringify(r.recordset, null, 2));
	process.exit(0);
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
