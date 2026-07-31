/**
 * F14030.MIMG 컬럼을 NVARCHAR(MAX)로 확장 (사진 JSON 저장용)
 * 실행: node scripts/alter-f14030-mimg.js
 */
require('dotenv').config();
const sql = require('mssql');
const { config } = require('../src/config/config');

async function main() {
  if (!config.dbconfig?.options?.database) {
    console.error('DB_DEV_DATABASE 환경변수가 없습니다. .env의 DB_DEV_DATABASE를 확인하세요.');
    process.exit(1);
  }

  const pool = await sql.connect(config.dbconfig);
  try {
    const before = await pool.request().query(`
      SELECT DATA_TYPE AS dataType, CHARACTER_MAXIMUM_LENGTH AS maxLen
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'F14030' AND COLUMN_NAME = 'MIMG'
    `);
    console.log('변경 전:', before.recordset?.[0] || '(컬럼 없음)');

    await pool.request().query(`
      ALTER TABLE [돌봄시설DB].[dbo].[F14030]
      ALTER COLUMN [MIMG] NVARCHAR(MAX) NULL;
    `);

    const after = await pool.request().query(`
      SELECT DATA_TYPE AS dataType, CHARACTER_MAXIMUM_LENGTH AS maxLen
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'F14030' AND COLUMN_NAME = 'MIMG'
    `);
    console.log('변경 후:', after.recordset?.[0] || '(컬럼 없음)');
    console.log('완료: MIMG = NVARCHAR(MAX)');
  } finally {
    await pool.close();
  }
}

main().catch((e) => {
  console.error('실패:', e.message || e);
  process.exit(1);
});
