// server.js - 后端服务器入口
const express = require("express");
const cors = require("cors");
const path = require("path");

// 导入路由
const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/student");
const teacherRoutes = require("./routes/teacher");

const app = express();

// 中间件配置
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// 静态文件托管
app.use(express.static(path.join(__dirname, "public")));

// API 路由挂载
app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/teacher", teacherRoutes);

// 兼容旧版登录接口
app.post("/api/login", (req, res, next) => {
  req.url = "/api/auth/login";
  app._router.handle(req, res, next);
});

// 健康检查接口
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ code: 404, error: "NOT_FOUND", message: "接口不存在" });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error("服务器错误:", err);
  res.status(500).json({
    code: 500,
    error: "INTERNAL_ERROR",
    message: process.env.NODE_ENV === "production" ? "服务器内部错误" : err.message
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 后端服务器运行在端口 ${PORT}`);
  console.log(`📁 静态文件托管路径：${path.join(__dirname, "public")}`);
  console.log(`🔗 API 基础路径：/api`);
});
