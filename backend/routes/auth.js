// routes/auth.js - 认证路由
const express = require("express");
const { pool } = require("../db");
const { requireAuth, signToken } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/v1/auth/login
 * 用户登录接口
 * 请求体: { username: string, password: string }
 * 响应: { token: string, user: Object }
 */
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};

  console.log("登录请求:", { username, password });

  // 参数校验
  if (!username || !password) {
    return res.status(422).json({
      code: 422,
      error: "INVALID_PARAMS",
      message: "用户名和密码不能为空"
    });
  }

  const conn = await pool.getConnection();
  try {
    // 查询用户
    const [rows] = await conn.query(
      `
      SELECT id, username, password, role, school_id, real_name, grade, class_no, school_name
      FROM psych_users
      WHERE username = ?
      LIMIT 1
      `,
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        code: 401,
        error: "INVALID_CREDENTIALS",
        message: "用户名或密码错误"
      });
    }

    const user = rows[0];

    // 验证密码（直接比较明文）
    if (password !== user.password) {
      return res.status(401).json({
        code: 401,
        error: "INVALID_CREDENTIALS",
        message: "用户名或密码错误"
      });
    }

    // 生成JWT token
    const token = signToken(user);

    // 返回响应（不包含密码）
    res.json({
      code: 200,
      message: "登录成功",
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          school_name: user.school_name,
          school_id: user.school_id,
          real_name: user.real_name,
          grade: user.grade,
          class_no: user.class_no
        }
      }
    });
  } catch (err) {
    console.error("登录错误:", err);
    res.status(500).json({
      code: 500,
      error: "INTERNAL_ERROR",
      message: "服务器内部错误"
    });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/v1/auth/me
 * 获取当前登录用户信息
 * 需要Bearer Token认证
 */
router.get("/me", requireAuth, async (req, res) => {
  // 直接返回JWT payload中的用户信息
  res.json({
    code: 200,
    data: {
      user: req.user
    }
  });
});

/**
 * POST /api/v1/auth/dev-create-user
 * 开发环境专用：创建测试用户
 * 生产环境应禁用此接口
 */
router.post("/dev-create-user", async (req, res) => {
  const { username, password, role, school_id, real_name = null, grade = null, class_no = null } = req.body || {};

  // 参数校验
  if (!username || !password || !role || school_id === undefined) {
    return res.status(422).json({
      code: 422,
      error: "INVALID_PARAMS",
      message: "缺少必要参数"
    });
  }

  if (!["student", "teacher", "parent"].includes(role)) {
    return res.status(422).json({
      code: 422,
      error: "INVALID_ROLE",
      message: "角色必须是 student, teacher 或 parent"
    });
  }

  const conn = await pool.getConnection();
  try {
    // 插入用户（明文密码）
    const [result] = await conn.query(
      `
      INSERT INTO psych_users (username, password, role, school_id, real_name, grade, class_no)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [username, password, role, school_id, real_name, grade, class_no]
    );

    res.json({
      code: 200,
      message: "用户创建成功",
      data: { id: result.insertId }
    });
  } catch (err) {
    if (String(err.code) === "ER_DUP_ENTRY") {
      return res.status(409).json({
        code: 409,
        error: "USERNAME_EXISTS",
        message: "用户名已存在"
      });
    }
    console.error("创建用户错误:", err);
    res.status(500).json({
      code: 500,
      error: "INTERNAL_ERROR",
      message: "服务器内部错误"
    });
  } finally {
    conn.release();
  }
});

module.exports = router;
