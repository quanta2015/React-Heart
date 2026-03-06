// routes/student.js - 学生端路由
const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * GET /api/student/test/generate
 * 生成试卷（150 题），创建 psych_tests 和 psych_answers（空答案记录）
 */
router.get("/test/generate", requireAuth, requireRole("student"), async (req, res) => {
  const userId = req.user.id;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. 检查是否已有测试
    const [existingTests] = await conn.query(
      "SELECT test_id, status FROM psych_tests WHERE user_id = ? ORDER BY test_id DESC LIMIT 1",
      [userId]
    );

    if (existingTests.length > 0) {
      const test = existingTests[0];
      if (test.status === "finished") {
        await conn.rollback();
        return res.status(409).json({
          code: 409,
          error: "ALREADY_TESTED",
          message: "您已完成过测试，无法重新生成"
        });
      }
      if (test.status === "in_progress") {
        // 返回进行中的测试 - 从 psych_answers 获取题目
        const [items] = await conn.query(
          `
          SELECT i.id, i.type, i.question, i.domain, i.facet, i.reverse_scored,
                 COALESCE(i.options_json, so.options_json) AS options_json
          FROM psych_answers a
          JOIN psych_items i ON i.id = a.item_id
          LEFT JOIN scale_options so ON so.type = i.type
          WHERE a.test_id = ?
          ORDER BY FIELD(i.type,'PHQ9','GAD7','RSES','UCLA','PSS','IAT','EXT5'), i.domain, i.id
          `,
          [test.test_id]
        );
        await conn.rollback();
        return res.json({
          code: 200,
          data: { test_id: test.test_id, items }
        });
      }
    }

    // 2. 创建新测试
    const [testResult] = await conn.query(
      "INSERT INTO psych_tests (user_id, version, status) VALUES (?, 'ISWB-CN-v1', 'in_progress')",
      [userId]
    );
    const testId = testResult.insertId;

    // 3. 抽题 SQL（固定 76 + EXT5 抽 74）
    const [pickedRows] = await conn.query(`
      WITH
      std AS (SELECT i.id FROM psych_items i WHERE i.type IN ('PHQ9','GAD7','RSES','UCLA','PSS','IAT')),
      ext_facet_one AS (
        SELECT id, domain, facet
        FROM (
          SELECT i.id, i.domain, i.facet,
                 ROW_NUMBER() OVER (PARTITION BY i.domain, i.facet ORDER BY RAND()) AS rnf
          FROM psych_items i
          WHERE i.type='EXT5'
            AND i.domain IN ('学习压力','家庭关系','抑郁','焦虑','社交','网络行为','自尊')
        ) x
        WHERE x.rnf=1
      ),
      ext_rank AS (
        SELECT e.id, e.domain,
               ROW_NUMBER() OVER (PARTITION BY e.domain ORDER BY RAND()) AS rn_dom
        FROM ext_facet_one e
      ),
      ext_stage1 AS (
        SELECT id, domain
        FROM ext_rank
        WHERE ((domain IN ('学习压力','焦虑','抑郁','社交') AND rn_dom<=11)
            OR (domain IN ('网络行为','自尊','家庭关系') AND rn_dom<=10))
      ),
      ext_cnt AS (SELECT domain, COUNT(*) AS c FROM ext_stage1 GROUP BY domain),
      ext_stage2 AS (
        SELECT id
        FROM (
          SELECT i.id, i.domain,
                 ROW_NUMBER() OVER (PARTITION BY i.domain ORDER BY RAND()) AS rn_fill
          FROM psych_items i
          LEFT JOIN ext_stage1 s ON s.id=i.id
          WHERE i.type='EXT5'
            AND i.domain IN ('学习压力','家庭关系','抑郁','焦虑','社交','网络行为','自尊')
            AND s.id IS NULL
        ) z
        JOIN ext_cnt c ON c.domain=z.domain
        WHERE z.rn_fill <= (
          CASE
            WHEN z.domain IN ('学习压力','焦虑','抑郁','社交') THEN 11 - c.c
            WHEN z.domain IN ('网络行为','自尊','家庭关系') THEN 10 - c.c
            ELSE 0
          END
        )
      ),
      picked AS (
        SELECT id FROM std
        UNION ALL SELECT id FROM ext_stage1
        UNION ALL SELECT id FROM ext_stage2
      )
      SELECT id FROM picked;
    `);

    if (pickedRows.length !== 150) {
      throw new Error(`PICK_COUNT_NOT_150: ${pickedRows.length}`);
    }

    // 4. 写入 psych_answers（空答案记录，代替 psych_test_items）
    const values = pickedRows.map((r) => [testId, r.id, null, null]);
    await conn.query("INSERT IGNORE INTO psych_answers (test_id, item_id, answer, score) VALUES ?", [values]);

    // 5. 返回题目
    const [items] = await conn.query(
      `
      SELECT i.id, i.type, i.question, i.domain, i.facet, i.reverse_scored,
             COALESCE(i.options_json, so.options_json) AS options_json
      FROM psych_answers a
      JOIN psych_items i ON i.id = a.item_id
      LEFT JOIN scale_options so ON so.type = i.type
      WHERE a.test_id = ?
      ORDER BY FIELD(i.type,'PHQ9','GAD7','RSES','UCLA','PSS','IAT','EXT5'), i.domain, i.id
      `,
      [testId]
    );

    await conn.commit();
    res.json({ code: 200, data: { test_id: testId, items } });
  } catch (err) {
    await conn.rollback();
    console.error("生成试卷错误:", err);
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
 * GET /api/student/test/current
 * 获取当前进行中的试卷
 */
router.get("/test/current", requireAuth, requireRole("student"), async (req, res) => {
  const userId = req.user.id;
  const conn = await pool.getConnection();

  try {
    const [tests] = await conn.query(
      "SELECT test_id FROM psych_tests WHERE user_id = ? AND status = 'in_progress' ORDER BY test_id DESC LIMIT 1",
      [userId]
    );

    if (tests.length === 0) {
      return res.json({ code: 200, data: null });
    }

    const testId = tests[0].test_id;

    const [items] = await conn.query(
      `
      SELECT i.id, i.type, i.question, i.domain, i.facet, i.reverse_scored,
             COALESCE(i.options_json, so.options_json) AS options_json
      FROM psych_answers a
      JOIN psych_items i ON i.id = a.item_id
      LEFT JOIN scale_options so ON so.type = i.type
      WHERE a.test_id = ?
      ORDER BY FIELD(i.type,'PHQ9','GAD7','RSES','UCLA','PSS','IAT','EXT5'), i.domain, i.id
      `,
      [testId]
    );

    res.json({ code: 200, data: { test_id: testId, items } });
  } catch (err) {
    console.error("获取当前试卷错误:", err);
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
 * POST /api/student/test/submit
 * 提交答案
 */
router.post("/test/submit", requireAuth, requireRole("student"), async (req, res) => {
  const userId = req.user.id;
  const { test_id, answers } = req.body || {};

  if (!test_id || !answers || !Array.isArray(answers)) {
    return res.status(422).json({
      code: 422,
      error: "INVALID_PARAMS",
      message: "缺少必要参数"
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. 验证测试归属和状态
    const [tests] = await conn.query("SELECT status FROM psych_tests WHERE test_id = ? AND user_id = ?", [
      test_id,
      userId
    ]);

    if (tests.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        code: 404,
        error: "NOT_FOUND",
        message: "测试不存在"
      });
    }

    if (tests[0].status !== "in_progress") {
      await conn.rollback();
      return res.status(409).json({
        code: 409,
        error: "NOT_IN_PROGRESS",
        message: "测试状态不正确"
      });
    }

    // 2. 批量写入答案
    for (const ans of answers) {
      const { item_id, answer } = ans;

      // 获取题目信息
      const [items] = await conn.query(
        `SELECT i.reverse_scored, i.type, so.max_score
         FROM psych_items i
         LEFT JOIN scale_options so ON so.type = i.type
         WHERE i.id = ?`,
        [item_id]
      );

      if (items.length === 0) continue;

      const item = items[0];
      const maxScore = item.max_score || 5;

      // 确保 answer 在有效范围内 (1 到 maxScore)
      const validAnswer = Math.max(1, Math.min(answer, maxScore));

      // 计算分数：反向计分题目用 (maxScore + 1 - answer)，正向计分用 answer
      // 注意：如果量表是 0-based (如 PHQ9: 0-3)，需要调整
      let score;
      if (item.reverse_scored) {
        score = maxScore + 1 - validAnswer;
      } else {
        // 对于 0-based 量表 (PHQ9, GAD7 等)，answer 1-4 对应 0-3
        if (["PHQ9", "GAD7"].includes(item.type)) {
          score = validAnswer - 1;
        } else {
          score = validAnswer;
        }
      }

      // 确保 score 非负
      score = Math.max(0, score);

      await conn.query(
        "INSERT INTO psych_answers (test_id, item_id, answer, score) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE answer=?, score=?",
        [test_id, item_id, validAnswer, score, validAnswer, score]
      );
    }

    // 3. 计算结果
    const [domainRows] = await conn.query(
      `
      SELECT i.domain, AVG(a.score) AS avg_score, MAX(so.max_score) AS max_score
      FROM psych_answers a
      JOIN psych_items i ON i.id = a.item_id
      LEFT JOIN scale_options so ON so.type = i.type
      WHERE a.test_id = ? AND i.domain IN ('学习压力','焦虑','抑郁','自尊','社交','网络行为')
      GROUP BY i.domain
      `,
      [test_id]
    );

    const domains = {};
    let riskScore = 0;

    for (const row of domainRows) {
      const v = row.avg_score / row.max_score;
      domains[row.domain] = parseFloat(v.toFixed(4));

      // 计算风险分数
      if (row.domain === "抑郁") riskScore += v * 0.3;
      else if (row.domain === "焦虑") riskScore += v * 0.25;
      else if (row.domain === "学习压力") riskScore += v * 0.2;
      else if (row.domain === "社交") riskScore += v * 0.15;
      else if (row.domain === "网络行为") riskScore += v * 0.1;
    }

    // 检查 PHQ9-09 自杀意念
    const [safetyRows] = await conn.query(
      "SELECT answer FROM psych_answers WHERE test_id = ? AND item_id = 'PHQ9-09'",
      [test_id]
    );
    const safetyHit = safetyRows.length > 0 && safetyRows[0].answer >= 3;

    // 确定风险等级
    let riskLevel;
    if (safetyHit) {
      riskLevel = "R3";
    } else if (riskScore < 0.3) {
      riskLevel = "R0";
    } else if (riskScore < 0.5) {
      riskLevel = "R1";
    } else if (riskScore < 0.7) {
      riskLevel = "R2";
    } else {
      riskLevel = "R3";
    }

    // 生成标签
    const tags = [];
    for (const [domain, v] of Object.entries(domains)) {
      let tag = null;
      if (domain === "自尊") {
        tag = v < 0.5 ? "selfesteem_low" : v < 0.7 ? "selfesteem_medium" : "selfesteem_high";
      } else if (domain === "学习压力") {
        tag = v < 0.5 ? "academicstress_low" : v < 0.7 ? "academicstress_medium" : "academicstress_high";
      } else if (domain === "焦虑") {
        tag = v < 0.5 ? "anxiety_low" : v < 0.7 ? "anxiety_medium" : "anxiety_high";
      } else if (domain === "抑郁") {
        tag = v < 0.5 ? "depression_low" : v < 0.7 ? "depression_medium" : "depression_high";
      } else if (domain === "社交") {
        tag = v < 0.5 ? "social_low" : v < 0.7 ? "social_medium" : "social_high";
      } else if (domain === "网络行为") {
        tag = v < 0.5 ? "internet_low" : v < 0.7 ? "internet_medium" : "internet_high";
      }
      if (tag) tags.push(tag);
    }

    // 4. 写入结果
    await conn.query(
      `INSERT INTO psych_results (test_id, risk_level, risk_score, domains_json, tags_json)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE risk_level=?, risk_score=?, domains_json=?, tags_json=?`,
      [
        test_id,
        riskLevel,
        parseFloat(riskScore.toFixed(4)),
        JSON.stringify(domains),
        JSON.stringify(tags),
        riskLevel,
        parseFloat(riskScore.toFixed(4)),
        JSON.stringify(domains),
        JSON.stringify(tags)
      ]
    );

    // 5. 更新测试状态
    await conn.query("UPDATE psych_tests SET status = 'finished', finished_at = NOW() WHERE test_id = ?", [test_id]);

    await conn.commit();
    res.json({
      code: 200,
      message: "提交成功",
      data: {
        risk_level: riskLevel,
        risk_score: parseFloat(riskScore.toFixed(4)),
        domains,
        tags
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error("提交答案错误:", err);
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
 * GET /api/student/result
 * 获取学生测试结果
 */
router.get("/result", requireAuth, requireRole("student"), async (req, res) => {
  const userId = req.user.id;
  const conn = await pool.getConnection();

  try {
    const [rows] = await conn.query(
      `
      SELECT r.*, t.finished_at
      FROM psych_results r
      JOIN psych_tests t ON t.test_id = r.test_id
      WHERE t.user_id = ?
      ORDER BY r.created_at DESC
      LIMIT 1
      `,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        code: 404,
        error: "NOT_FOUND",
        message: "暂无测试结果"
      });
    }

    const result = rows[0];

    // 解析 JSON 字段
    try {
      result.domains = typeof result.domains_json === "string" ? JSON.parse(result.domains_json) : result.domains_json;
      result.tags = typeof result.tags_json === "string" ? JSON.parse(result.tags_json) : result.tags_json;
    } catch (e) {
      console.error("解析 JSON 失败:", e);
    }

    res.json({ code: 200, data: result });
  } catch (err) {
    console.error("获取结果错误:", err);
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
