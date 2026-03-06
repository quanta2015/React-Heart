// db.js - MySQL数据库连接池
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "liyangtom",
  database: process.env.MYSQL_DATABASE || "heart",
  connectionLimit: 10,
  charset: "utf8mb4",
  waitForConnections: true,
  queueLimit: 0
});

// 测试连接
pool
  .getConnection()
  .then((conn) => {
    console.log("✅ MySQL数据库连接池创建成功");
    conn.release();
  })
  .catch((err) => {
    console.error("❌ MySQL连接错误:", err.message);
  });

module.exports = { pool };
