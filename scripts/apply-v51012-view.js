/**
 * V51012 ALTER VIEW 생성 후 DB 적용
 * 실행: node scripts/apply-v51012-view.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { getConnectionPool } = require('../src/config/server');

function caseEd(col, count) {
	const lines = [`\t\t,aa.${col}`];
	for (let i = 1; i <= count; i++) {
		const n = String(i).padStart(2, '0');
		lines.push(`\t\t,CASE aa.${col} WHEN '${i}' THEN N'Ⅴ' END ED_${col}_${n}`);
	}
	return lines.join('\n');
}

function ynEd(col) {
	return `\t\t,aa.${col}\n\t\t,(SELECT DSC2 FROM F01002 WHERE CODE = 'BT' and UCD = aa.${col})   as ED_${col}`;
}

function dzEd(col) {
	return `\t\t,aa.${col}\n\t\t,(SELECT DSC2 FROM F01002 WHERE CODE = 'DZ' and UCD = aa.${col})   as ED_${col}`;
}

function replaceOnce(src, find, repl, label) {
	if (!src.includes(find)) {
		console.error('REPLACE MISS:', label);
		console.error('FIND START:', JSON.stringify(find.slice(0, 120)));
		process.exitCode = 1;
		return src;
	}
	return src.replace(find, repl);
}

function buildViewSql() {
	let src = fs.readFileSync(path.join(__dirname, 'v51012-def.sql'), 'utf8').replace(/\r\n/g, '\n');
	src = src.replace(/CREATE VIEW \[dbo\]\.\[V51012\]/i, 'ALTER VIEW [dbo].[V51012]');
	src = src.trim();

	const cExtra = [
		dzEd('C13'),
		dzEd('C14'),
		dzEd('C15'),
		dzEd('C16'),
		dzEd('C17'),
		dzEd('C18'),
		dzEd('C19'),
		caseEd('C20', 4),
		caseEd('C21', 5),
		caseEd('C22', 5),
		caseEd('C23', 5),
	].join('\n');

	src = replaceOnce(
		src,
		`,aa.C12  \n\t\t,(SELECT DSC2 FROM F01002 WHERE CODE = 'DZ' and UCD = aa.C12)   as ED_C12\n\t\t,aa.C90`,
		`,aa.C12  \n\t\t,(SELECT DSC2 FROM F01002 WHERE CODE = 'DZ' and UCD = aa.C12)   as ED_C12\n${cExtra}\n\t\t,aa.C90`,
		'C12'
	);

	src = replaceOnce(
		src,
		`,aa.D08_03_01 \n\t`,
		`,aa.D08_03_01 \n${ynEd('D08_04')}\n${ynEd('D08_05')}\n\t`,
		'D08_03_01'
	);

	src = replaceOnce(
		src,
		`,aa.D10_02_01 \n\t`,
		`,aa.D10_02_01 \n${ynEd('D11_01')}\n${ynEd('D11_02')}\n${ynEd('D11_03')}\n\t\t,aa.D11_NOTE \n\t`,
		'D10_02_01'
	);

	const eExtra = [
		caseEd('E13', 2),
		'\t\t,aa.E13_01',
		caseEd('E14', 4),
		caseEd('E15', 2),
		'\t\t,aa.E15_01',
		caseEd('E16', 4),
		caseEd('E17', 3),
	].join('\n');

	src = replaceOnce(
		src,
		`,aa.E10_02  \n\t\t,(SELECT DSC2 FROM F01002 WHERE CODE = 'BT' and UCD = aa.E10_02) as ED_E10_02\n\t\t,aa.E90`,
		`,aa.E10_02  \n\t\t,(SELECT DSC2 FROM F01002 WHERE CODE = 'BT' and UCD = aa.E10_02) as ED_E10_02\n${eExtra}\n\t\t,aa.E90`,
		'E10_02'
	);

	const fExtra = Array.from({ length: 11 }, (_, i) => ynEd(`F${i + 12}`)).join('\n');
	src = replaceOnce(
		src,
		`,aa.F11  \n\t\t,(SELECT DSC2 FROM F01002 WHERE CODE = 'BT' and UCD = aa.F11)   as ED_F11\n\t\t,aa.F90`,
		`,aa.F11  \n\t\t,(SELECT DSC2 FROM F01002 WHERE CODE = 'BT' and UCD = aa.F11)   as ED_F11\n${fExtra}\n\t\t,aa.F90`,
		'F11'
	);

	src = replaceOnce(
		src,
		`,CASE aa.H03 WHEN '4' THEN 'Ⅴ' END ED_H03_04 \n\t\t,aa.H90`,
		`,CASE aa.H03 WHEN '4' THEN N'Ⅴ' END ED_H03_04 \n${caseEd('H04', 5)}\n\t\t,aa.H90`,
		'H03'
	);

	const iExtra = [caseEd('I06', 5), '\t\t,aa.I06_01', caseEd('I07', 4), '\t\t,aa.I07_01', caseEd('I08', 5), '\t\t,aa.I08_01'].join(
		'\n'
	);
	src = replaceOnce(
		src,
		`,CASE aa.I05 WHEN '4' THEN 'Ⅴ' END ED_I05_04\n\t\t,aa.I90`,
		`,CASE aa.I05 WHEN '4' THEN N'Ⅴ' END ED_I05_04\n${iExtra}\n\t\t,aa.I90`,
		'I05'
	);

	const jExtra = [caseEd('J04', 6), '\t\t,aa.J04_01', caseEd('J05', 4)].join('\n');
	src = replaceOnce(
		src,
		`,CASE aa.J03 WHEN '7' THEN 'Ⅴ' END ED_J03_07 \n\t\t,aa.J90`,
		`,CASE aa.J03 WHEN '7' THEN N'Ⅴ' END ED_J03_07 \n${jExtra}\n\t\t,aa.J90`,
		'J03'
	);

	const kExtra = ['K03_05', 'K03_06', 'K03_07', 'K03_08', 'K03_09'].map(ynEd).join('\n');
	src = replaceOnce(
		src,
		`,aa.K03_04 \n\t\t,aa.K90`,
		`,aa.K03_04 \n${kExtra}\n\t\t,aa.K90`,
		'K03_04'
	);

	const lExtra = ['L01_04', 'L01_05', 'L01_06', 'L01_07', 'L01_08', 'L01_09', 'L01_10'].map(ynEd).join('\n');
	src = replaceOnce(
		src,
		`,(SELECT DSC2 FROM F01002 WHERE CODE = 'BT' and UCD = aa.L01_03)   as ED_L01_03\n\n\t\t,aa.L02`,
		`,(SELECT DSC2 FROM F01002 WHERE CODE = 'BT' and UCD = aa.L01_03)   as ED_L01_03\n${lExtra}\n\t\t,aa.L03 \n\n\t\t,aa.L02`,
		'L01_03'
	);

	return src;
}

async function main() {
	const viewSql = buildViewSql();
	const outPath = path.join(__dirname, '..', 'sql', 'V51012.sql');
	fs.writeFileSync(outPath, viewSql, 'utf8');
	console.log('wrote', outPath, 'len', viewSql.length);
	if (process.exitCode) {
		console.error('view SQL patch incomplete — aborting ALTER');
		process.exit(1);
	}

	const pool = await getConnectionPool();
	if (!pool) {
		console.error('no pool');
		process.exit(1);
	}

	const who = await pool.request().query(`SELECT DB_NAME() AS dbname`);
	console.log('current db', who.recordset[0].dbname);

	const rogue = await pool.request().query(`
		SELECT DB_NAME() AS dbname, o.name
		FROM sys.objects o
		WHERE o.name = N'V51012'
	`);
	console.log('V51012 in current db', rogue.recordset);

	await pool.request().query(`
		IF NOT EXISTS (SELECT 1 FROM [돌봄시설DB].[dbo].[F01002] WHERE CODE = 'DZ' AND UCD = 'A')
			INSERT INTO [돌봄시설DB].[dbo].[F01002] (CODE, UCD, DSC1, DSC2, SEQ, DEL) VALUES ('DZ', 'A', N'완전자립', N'  ○', 4, 'I');
		IF NOT EXISTS (SELECT 1 FROM [돌봄시설DB].[dbo].[F01002] WHERE CODE = 'DZ' AND UCD = 'B')
			INSERT INTO [돌봄시설DB].[dbo].[F01002] (CODE, UCD, DSC1, DSC2, SEQ, DEL) VALUES ('DZ', 'B', N'간접도움', N' △', 5, 'I');
		IF NOT EXISTS (SELECT 1 FROM [돌봄시설DB].[dbo].[F01002] WHERE CODE = 'DZ' AND UCD = 'C')
			INSERT INTO [돌봄시설DB].[dbo].[F01002] (CODE, UCD, DSC1, DSC2, SEQ, DEL) VALUES ('DZ', 'C', N'직접도움', N' ▲', 6, 'I');
		IF NOT EXISTS (SELECT 1 FROM [돌봄시설DB].[dbo].[F01002] WHERE CODE = 'DZ' AND UCD = 'D')
			INSERT INTO [돌봄시설DB].[dbo].[F01002] (CODE, UCD, DSC1, DSC2, SEQ, DEL) VALUES ('DZ', 'D', N'완전도움', N'Ⅹ', 7, 'I');
	`);
	console.log('F01002 DZ A-D upserted');

	const escaped = viewSql.replace(/'/g, "''");
	await pool.request().query(`EXEC [돌봄시설DB].sys.sp_executesql N'${escaped}'`);
	console.log('V51012 altered');

	const cols = await pool.request().query(`
		SELECT COLUMN_NAME FROM [돌봄시설DB].INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_NAME = 'V51012' AND COLUMN_NAME IN (
			'D08_04','D11_NOTE','C13','C20','I06','E13','F12','H04','J04','K03_05','L01_04','L03','ED_C13','ED_H04_01'
		)
		ORDER BY COLUMN_NAME
	`);
	console.log('new cols:', cols.recordset.map((r) => r.COLUMN_NAME).join(', '));
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
