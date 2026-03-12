// routes/manager.js - 教师端路由
const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * GET /api/manager/stats/overview
 * 获取学校整体统计概览
 * 参数：grade, class_no (可选)
 */
router.get("/stats/overview", requireAuth, requireRole("manager"), async (req, res) => {
  const userId = req.user.id;
  const schoolId = req.user.school_id;
  const { grade, class_no } = req.query;
  const conn = await pool.getConnection();

  try {
    // 获取学生总数
    let studentQuery = `SELECT COUNT(*) AS total FROM psych_users WHERE role = 'student' AND school_id = ?`;
    let studentParams = [schoolId];

    if (grade) {
      studentQuery += ` AND grade = ?`;
      studentParams.push(grade);
    }
    if (class_no) {
      studentQuery += ` AND class_no = ?`;
      studentParams.push(class_no);
    }

    const [students] = await conn.query(studentQuery, studentParams);
    const totalStudents = students[0].total;

    // 获取已完成测试的学生数
    let finishedQuery = `
      SELECT COUNT(DISTINCT u.id) AS finished
      FROM psych_users u
      JOIN psych_tests t ON t.user_id = u.id
      WHERE u.role = 'student' AND u.school_id = ? AND t.status = 'finished'
    `;
    let finishedParams = [schoolId];

    if (grade) {
      finishedQuery += ` AND u.grade = ?`;
      finishedParams.push(grade);
    }
    if (class_no) {
      finishedQuery += ` AND u.class_no = ?`;
      finishedParams.push(class_no);
    }

    const [finished] = await conn.query(finishedQuery, finishedParams);
    const finishedCount = finished[0].finished;

    // 获取风险等级分布
    let riskQuery = `
      SELECT r.risk_level, COUNT(*) AS count
      FROM psych_results r
      JOIN psych_tests t ON t.test_id = r.test_id
      JOIN psych_users u ON u.id = t.user_id
      WHERE u.school_id = ?
    `;
    let riskParams = [schoolId];

    if (grade) {
      riskQuery += ` AND u.grade = ?`;
      riskParams.push(grade);
    }
    if (class_no) {
      riskQuery += ` AND u.class_no = ?`;
      riskParams.push(class_no);
    }

    riskQuery += ` GROUP BY r.risk_level`;

    const [riskDist] = await conn.query(riskQuery, riskParams);

    // 获取领域平均分 - 先获取所有 domains_json 然后在 JS 中解析
    let domainQuery = `
      SELECT r.domains_json
      FROM psych_results r
      JOIN psych_tests t ON t.test_id = r.test_id
      JOIN psych_users u ON u.id = t.user_id
      WHERE u.school_id = ?
    `;
    let domainParams = [schoolId];

    if (grade) {
      domainQuery += ` AND u.grade = ?`;
      domainParams.push(grade);
    }
    if (class_no) {
      domainQuery += ` AND u.class_no = ?`;
      domainParams.push(class_no);
    }

    const [domainRows] = await conn.query(domainQuery, domainParams);

    // 在 JS 中计算平均分
    const domainAvg = {
      learning_pressure: 0,
      anxiety: 0,
      depression: 0,
      self_esteem: 0,
      social: 0,
      internet: 0
    };

    if (domainRows.length > 0) {
      let sums = { learning_pressure: 0, anxiety: 0, depression: 0, self_esteem: 0, social: 0, internet: 0 };
      let count = 0;

      domainRows.forEach((row) => {
        try {
          const domains = typeof row.domains_json === "string" ? JSON.parse(row.domains_json) : row.domains_json;
          if (domains) {
            if (domains["学习压力"] !== undefined) sums.learning_pressure += parseFloat(domains["学习压力"]) || 0;
            if (domains["焦虑"] !== undefined) sums.anxiety += parseFloat(domains["焦虑"]) || 0;
            if (domains["抑郁"] !== undefined) sums.depression += parseFloat(domains["抑郁"]) || 0;
            if (domains["自尊"] !== undefined) sums.self_esteem += parseFloat(domains["自尊"]) || 0;
            if (domains["社交"] !== undefined) sums.social += parseFloat(domains["社交"]) || 0;
            if (domains["网络行为"] !== undefined) sums.internet += parseFloat(domains["网络行为"]) || 0;
            count++;
          }
        } catch (e) {
          console.error("解析 domains_json 失败:", e);
        }
      });

      if (count > 0) {
        domainAvg.learning_pressure = (sums.learning_pressure / count).toFixed(2);
        domainAvg.anxiety = (sums.anxiety / count).toFixed(2);
        domainAvg.depression = (sums.depression / count).toFixed(2);
        domainAvg.self_esteem = (sums.self_esteem / count).toFixed(2);
        domainAvg.social = (sums.social / count).toFixed(2);
        domainAvg.internet = (sums.internet / count).toFixed(2);
      }
    }

    res.json({
      code: 200,
      data: {
        completion: {
          finished: finishedCount,
          total_students: totalStudents,
          rate: totalStudents > 0 ? (finishedCount / totalStudents).toFixed(2) : 0
        },
        risk_dist: riskDist.reduce(
          (acc, row) => {
            acc[row.risk_level] = row.count;
            return acc;
          },
          { R0: 0, R1: 0, R2: 0, R3: 0 }
        ),
        domain_avg: {
          学习压力: domainAvg.learning_pressure || "0.00",
          焦虑: domainAvg.anxiety || "0.00",
          抑郁: domainAvg.depression || "0.00",
          自尊: domainAvg.self_esteem || "0.00",
          社交: domainAvg.social || "0.00",
          网络行为: domainAvg.internet || "0.00"
        }
      }
    });
  } catch (err) {
    console.error("获取概览统计错误:", err);
    res.status(500).json({
      code: 500,
      error: "INTERNAL_ERROR",
      message: err.message
    });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/manager/stats/by-grade
 * 按年级统计
 */
router.get("/stats/by-grade", requireAuth, requireRole("manager"), async (req, res) => {
  const schoolId = req.user.school_id;
  const conn = await pool.getConnection();

  try {
    const [rows] = await conn.query(
      `
      SELECT 
        u.grade,
        COUNT(DISTINCT u.id) AS total_students,
        COUNT(DISTINCT CASE WHEN t.status = 'finished' THEN u.id END) AS finished_students,
        AVG(CASE WHEN r.risk_level = 'R0' THEN 1 ELSE 0 END) AS r0_rate,
        AVG(CASE WHEN r.risk_level = 'R1' THEN 1 ELSE 0 END) AS r1_rate,
        AVG(CASE WHEN r.risk_level = 'R2' THEN 1 ELSE 0 END) AS r2_rate,
        AVG(CASE WHEN r.risk_level = 'R3' THEN 1 ELSE 0 END) AS r3_rate
      FROM psych_users u
      LEFT JOIN psych_tests t ON t.user_id = u.id AND t.status = 'finished'
      LEFT JOIN psych_results r ON r.test_id = t.test_id
      WHERE u.role = 'student' AND u.school_id = ?
      GROUP BY u.grade
      ORDER BY u.grade
      `,
      [schoolId]
    );

    res.json({
      code: 200,
      data: rows.map((row) => ({
        grade: row.grade,
        total_students: row.total_students,
        finished_students: row.finished_students,
        completion_rate: row.total_students > 0 ? (row.finished_students / row.total_students).toFixed(2) : 0,
        risk_dist: {
          R0: Math.round(row.r0_rate * row.finished_students),
          R1: Math.round(row.r1_rate * row.finished_students),
          R2: Math.round(row.r2_rate * row.finished_students),
          R3: Math.round(row.r3_rate * row.finished_students)
        }
      }))
    });
  } catch (err) {
    console.error("按年级统计错误:", err);
    res.status(500).json({
      code: 500,
      error: "INTERNAL_ERROR",
      message: err.message
    });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/manager/stats/by-class
 * 按班级统计
 * 参数：grade
 */
router.get("/stats/by-class", requireAuth, requireRole("manager"), async (req, res) => {
  const schoolId = req.user.school_id;
  const { grade } = req.query;
  const conn = await pool.getConnection();

  try {
    let query = `
      SELECT 
        u.class_no,
        COUNT(DISTINCT u.id) AS total_students,
        COUNT(DISTINCT CASE WHEN t.status = 'finished' THEN u.id END) AS finished_students,
        AVG(CASE WHEN r.risk_level = 'R0' THEN 1 ELSE 0 END) AS r0_rate,
        AVG(CASE WHEN r.risk_level = 'R1' THEN 1 ELSE 0 END) AS r1_rate,
        AVG(CASE WHEN r.risk_level = 'R2' THEN 1 ELSE 0 END) AS r2_rate,
        AVG(CASE WHEN r.risk_level = 'R3' THEN 1 ELSE 0 END) AS r3_rate
      FROM psych_users u
      LEFT JOIN psych_tests t ON t.user_id = u.id AND t.status = 'finished'
      LEFT JOIN psych_results r ON r.test_id = t.test_id
      WHERE u.role = 'student' AND u.school_id = ?
    `;
    let params = [schoolId];

    if (grade) {
      query += ` AND u.grade = ?`;
      params.push(grade);
    }

    query += ` GROUP BY u.class_no ORDER BY u.class_no`;

    const [rows] = await conn.query(query, params);

    res.json({
      code: 200,
      data: rows.map((row) => ({
        class_no: row.class_no,
        total_students: row.total_students,
        finished_students: row.finished_students,
        completion_rate: row.total_students > 0 ? (row.finished_students / row.total_students).toFixed(2) : 0,
        risk_dist: {
          R0: Math.round(row.r0_rate * row.finished_students),
          R1: Math.round(row.r1_rate * row.finished_students),
          R2: Math.round(row.r2_rate * row.finished_students),
          R3: Math.round(row.r3_rate * row.finished_students)
        }
      }))
    });
  } catch (err) {
    console.error("按班级统计错误:", err);
    res.status(500).json({
      code: 500,
      error: "INTERNAL_ERROR",
      message: err.message
    });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/manager/students
 * 获取学生列表
 * 参数：grade, class_no, keyword
 */
router.get("/students", requireAuth, requireRole("manager"), async (req, res) => {
  const schoolId = req.user.school_id;
  const { grade, class_no, keyword } = req.query;
  const conn = await pool.getConnection();

  try {
    let query = `
      SELECT 
        u.id,
        u.username,
        u.real_name,
        u.school_name,
        u.grade,
        u.class_no,
        CASE WHEN t.status = 'finished' THEN 1 ELSE 0 END AS has_test,
        r.risk_level,
        r.risk_score,
        t.finished_at
      FROM psych_users u
      LEFT JOIN psych_tests t ON t.user_id = u.id AND t.status = 'finished'
      LEFT JOIN psych_results r ON r.test_id = t.test_id
      WHERE u.role = 'student' AND u.school_id = ?
    `;
    let params = [schoolId];

    if (grade) {
      query += ` AND u.grade = ?`;
      params.push(grade);
    }
    if (class_no) {
      query += ` AND u.class_no = ?`;
      params.push(class_no);
    }
    if (keyword) {
      query += ` AND (u.real_name LIKE ? OR u.username LIKE ?)`;
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    query += ` ORDER BY u.grade, u.class_no, u.real_name`;

    const [rows] = await conn.query(query, params);

    res.json({
      code: 200,
      data: rows
    });
  } catch (err) {
    console.error("获取学生列表错误:", err);
    res.status(500).json({
      code: 500,
      error: "INTERNAL_ERROR",
      message: err.message
    });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/manager/student/:studentId/result
 * 获取指定学生的测试结果
 */
router.get("/student/:studentId/result", requireAuth, requireRole("manager"), async (req, res) => {
  const schoolId = req.user.school_id;
  const { studentId } = req.params;
  const conn = await pool.getConnection();

  try {
    // 验证学生属于同一学校
    const [students] = await conn.query(
      "SELECT school_id, real_name, grade, class_no, school_name FROM psych_users WHERE id = ? AND role = 'student'",
      [studentId]
    );

    if (students.length === 0) {
      return res.status(404).json({
        code: 404,
        error: "NOT_FOUND",
        message: "学生不存在"
      });
    }

    if (students[0].school_id !== schoolId) {
      return res.status(403).json({
        code: 403,
        error: "FORBIDDEN",
        message: "无权访问该学生数据"
      });
    }

    // 获取测试结果
    const [results] = await conn.query(
      `
      SELECT r.*, t.finished_at
      FROM psych_results r
      JOIN psych_tests t ON t.test_id = r.test_id
      WHERE t.user_id = ?
      ORDER BY r.created_at DESC
      LIMIT 1
      `,
      [studentId]
    );

    if (results.length === 0) {
      return res.status(404).json({
        code: 404,
        error: "NOT_FOUND",
        message: "该学生尚未完成测试"
      });
    }

    const result = results[0];

    // 解析 JSON 字段
    try {
      result.domains = typeof result.domains_json === "string" ? JSON.parse(result.domains_json) : result.domains_json;
      result.tags = typeof result.tags_json === "string" ? JSON.parse(result.tags_json) : result.tags_json;
    } catch (e) {
      console.error("解析 JSON 失败:", e);
    }

    res.json({
      code: 200,
      data: {
        student: {
          id: studentId,
          real_name: students[0].real_name,
          grade: students[0].grade,
          class_no: students[0].class_no
        },
        result
      }
    });
  } catch (err) {
    console.error("获取学生结果错误:", err);
    res.status(500).json({
      code: 500,
      error: "INTERNAL_ERROR",
      message: err.message
    });
  } finally {
    conn.release();
  }
});

module.exports = router;
