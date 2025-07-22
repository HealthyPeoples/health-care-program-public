const sql = require('mssql');
const { config } = require('./config');

console.log('DB 연결 시도 중...');
const connPool = new sql.ConnectionPool(config.dbconfig)
  .connect()
  .then((pool) => {
    console.log('DB연결 성공');
    return pool;
  })
  .catch((err) => {
    console.error('DB 연결 실패! 에러 내용:', err);
    if (err.code) console.error('에러 코드:', err.code);
    if (err.message) console.error('에러 메시지:', err.message);
    if (err.stack) console.error('에러 스택:', err.stack);
  });

module.exports = {
  sql,
  connPool
};