// middleware/auth.js - JWT认证中间件
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_heart_2026";

/**
 * 验证JWT Token的中间件
 * 从Authorization header中提取Bearer token并验证
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      code: 401,
      error: "UNAUTHORIZED",
      message: "未登录或token已过期"
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // 将用户信息挂载到req对象
    next();
  } catch (err) {
    return res.status(401).json({
      code: 401,
      error: "UNAUTHORIZED",
      message: "token无效或已过期"
    });
  }
}

/**
 * 角色权限验证中间件
 * @param {...string} roles - 允许的角色列表
 * @returns {Function} Express中间件
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        code: 401,
        error: "UNAUTHORIZED",
        message: "未登录"
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        code: 403,
        error: "FORBIDDEN",
        message: "无权限访问"
      });
    }

    next();
  };
}

/**
 * 生成JWT Token
 * @param {Object} user - 用户信息对象
 * @returns {string} JWT token
 */
function signToken(user) {
  const payload = {
    id: user.id,
    role: user.role,
    school_id: user.school_id ?? null,
    grade: user.grade ?? null,
    class_no: user.class_no ?? null,
    real_name: user.real_name ?? null,
    username: user.username
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

module.exports = { requireAuth, requireRole, signToken, JWT_SECRET };
