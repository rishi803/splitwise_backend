const mysql = require('mysql2');


const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password:'',
    database: process.env.DB_NAME || 'userdb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  }).promise();

(async () => {
    try {
        const connection = await pool.getConnection();
        console.log('Successfully connected to the database!');
        connection.release(); // Always release the connection back to the pool
    } catch (err) {
        console.error('Failed to connect to the database:', err);
    }
})();


module.exports = pool;
