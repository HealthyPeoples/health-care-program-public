require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  dbconfig: {
    server: process.env.DB_DEV_SERVER,
    port: parseInt(process.env.DB_DEV_PORT, 10),
    pool: {
      max: 5,
      min: 1,
      idleTimeoutMillis: 30000,
    },
    options: {
      encrypt: true,
      database: process.env.DB_DEV_DATABASE, 
      trustServerCertificate: true,
    },
    authentication: {
      type: 'default',
      options: {
        userName: process.env.DB_DEV_USERNAME,
        password: process.env.DB_DEV_PASSWORD, 
      },
    },
  },
};

module.exports = { config };