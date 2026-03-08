// routes/parent.js - 家长测评路由
const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const STANDARD_TYPES = ["PHQ9", "GAD7", "RSES", "UCLA", "PSS", "IAT"];
const TOTAL_QUESTION_COUNT = 150;

const DOMAIN_LABELS = {
  parenting_style: "教养方式",
  parent_emotion: "情绪管理",
  parent_stress: "家长压力",
  parent_expectation: "期望压力",
  family_communication: "家庭沟通",
  parent_child_relationship: "亲子关系",
  discipline_method: "管教方式",
  family_environment: "家庭氛围",
  emotional_support: "情感支持",
  education_attitude: "教育观念"
};

const DOMAIN_ALIASES = {
  教养方式: "parenting_style",
  家长教养方式: "parenting_style",
  情绪管理: "parent_emotion",
  家长情绪管理: "parent_emotion",
  家长压力: "parent_stress",
  家长养育压力: "parent_stress",
  期望压力: "parent_expectation",
  期望与成绩压力: "parent_expectation",
  亲子沟通: "family_communication",
  家庭沟通: "family_communication",
  亲子关系: "parent_child_relationship",
  管教方式: "discipline_method",
  家庭氛围: "family_environment",
  情感支持: "emotional_support",
  教育观念: "education_attitude"
};

function normalizeDomainKey(domain) {
  if (!domain) return null;
  const key = String(domain).trim();
  if (DOMAIN_LABELS[key]) return key;
  if (DOMAIN_ALIASES[key]) return DOMAIN_ALIASES[key];
  return key.toLowerCase().replace(/\s+/g, "_");
}

function round2(v) {
  return Number(v.toFixed(2));
}

function scoreLevel(v) {
  if (v >= 80) return "非常健康";
  if (v >= 60) return "良好";
  if (v >= 40) return "一般";
  if (v >= 20) return "偏低";
  return "风险";
}

function ensureArrayJSON(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

function getDefaultScaleByType(type) {
  const t = String(type || "").toUpperCase();
  if (t === "PHQ9" || t === "GAD7") {
    return {
      min: 0,
      max: 3,
      options: [
        { text: "从不", value: 0 },
        { text: "几天", value: 1 },
        { text: "超过一半时间", value: 2 },
        { text: "几乎每天", value: 3 }
      ]
    };
  }
  if (t === "RSES" || t === "UCLA") {
    return {
      min: 1,
      max: 4,
      options: [
        { text: "非常不同意", value: 1 },
        { text: "不同意", value: 2 },
        { text: "同意", value: 3 },
        { text: "非常同意", value: 4 }
      ]
    };
  }
  if (t === "IAT") {
    return {
      min: 1,
      max: 5,
      options: [
        { text: "很少", value: 1 },
        { text: "偶尔", value: 2 },
        { text: "有时", value: 3 },
        { text: "经常", value: 4 },
        { text: "总是", value: 5 }
      ]
    };
  }
  return {
    min: 0,
    max: 4,
    options: [
      { text: "从不", value: 0 },
      { text: "很少", value: 1 },
      { text: "有时", value: 2 },
      { text: "经常", value: 3 },
      { text: "总是", value: 4 }
    ]
  };
}

function deriveRange(item) {
  const fallback = getDefaultScaleByType(item.type);

  if (Number.isFinite(Number(item.min_score)) && Number.isFinite(Number(item.max_score))) {
    const min = Number(item.min_score);
    const max = Number(item.max_score);
    if (max > min) return { min, max };
  }

  const options = ensureArrayJSON(item.options_json);
  const values = options.map((opt) => Number(opt?.value)).filter((n) => Number.isFinite(n));
  if (values.length > 0) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max > min) return { min, max };
  }

  return { min: fallback.min, max: fallback.max };
}

async function ensureParentResultsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS psych_parent_results (
      test_id BIGINT NOT NULL,
      report_json JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (test_id),
      CONSTRAINT fk_parent_res_test FOREIGN KEY (test_id) REFERENCES psych_tests(test_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
}

function classifyParentingStyle({ parentingStyle, discipline, support }) {
  if (support > 60 && discipline > 60) return "权威型";
  if (discipline > 70 && support < 40) return "专制型";
  if (support > 60 && discipline < 40) return "放任型";
  if (support < 40 && discipline < 40) return "忽视型";
  if (parentingStyle >= 60 && support >= 60) return "权威型";
  if (discipline >= 65) return "专制倾向";
  if (support >= 65) return "放任倾向";
  return "混合型";
}

function buildParentReport(domainStats, finishedAt) {
  const domainIndex = {};

  for (const [key, row] of Object.entries(domainStats)) {
    const maxScore = row.count * row.maxPerItem;
    const ratio = maxScore > 0 ? row.sum / maxScore : 0;
    domainIndex[key] = round2(ratio * 100);
  }

  const familyEnvIndex = round2(
    ((domainIndex.family_communication || 0) +
      (domainIndex.parent_child_relationship || 0) +
      (domainIndex.family_environment || 0) +
      (domainIndex.emotional_support || 0)) /
      4
  );

  const parentPressure = round2(((domainIndex.parent_stress || 0) + (domainIndex.parent_expectation || 0)) / 2);
  const emotionIndex = round2(domainIndex.parent_emotion || 0);

  const parentingStyleType = classifyParentingStyle({
    parentingStyle: domainIndex.parenting_style || 0,
    discipline: domainIndex.discipline_method || 0,
    support: domainIndex.emotional_support || 0
  });

  const warnings = [];
  if ((domainIndex.parent_stress || 0) > 80) {
    warnings.push({ level: "一级预警", message: "家长压力过高，建议尽快减压与寻求支持。" });
  }
  if ((domainIndex.parent_child_relationship || 0) < 40) {
    warnings.push({ level: "二级预警", message: "亲子关系偏紧张，建议增加高质量沟通与陪伴。" });
  }
  if ((domainIndex.family_environment || 0) < 30) {
    warnings.push({ level: "三级预警", message: "家庭氛围存在冲突风险，建议优先改善沟通模式。" });
  }

  const domainRows = Object.entries(domainIndex).map(([key, score]) => ({
    key,
    label: DOMAIN_LABELS[key] || key,
    score,
    level: scoreLevel(score)
  }));

  const strengths = domainRows
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => `${r.label}（${r.score}）`);

  const concerns = domainRows
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((r) => `${r.label}（${r.score}）`);

  const suggestions = [];
  if ((domainIndex.parent_stress || 0) > 80) {
    suggestions.push("每天安排 10-15 分钟减压时段，降低持续高压状态。");
  }
  if ((domainIndex.parent_child_relationship || 0) < 40) {
    suggestions.push("每天保持至少 10 分钟不打断的亲子交流，优先倾听。");
  }
  if ((domainIndex.family_environment || 0) < 30) {
    suggestions.push("建立家庭冲突降温规则，先处理情绪再讨论问题。");
  }
  if (suggestions.length === 0) {
    suggestions.push("每周一次家庭活动，持续增强沟通、支持与规则一致性。");
    suggestions.push("减少负面评价，更多使用描述事实和鼓励式反馈。");
  }

  return {
    assessed_at: finishedAt || new Date().toISOString(),
    domain_index: domainIndex,
    domain_rows: domainRows,
    family_env_index: familyEnvIndex,
    family_env_level: scoreLevel(familyEnvIndex),
    parent_pressure: parentPressure,
    parent_pressure_level: scoreLevel(parentPressure),
    emotion_index: emotionIndex,
    emotion_index_level: scoreLevel(emotionIndex),
    parenting_style_type: parentingStyleType,
    warnings,
    strengths,
    concerns,
    suggestions
  };
}

function buildCoreRiskReport(coreDomainRows, safetyHit) {
  const domains = {};
  let riskScore = 0;

  for (const row of coreDomainRows) {
    const maxScore = Number(row.max_score || 0);
    if (!(maxScore > 0)) continue;
    const ratio = Number(row.avg_score || 0) / maxScore;
    const v = Number(ratio.toFixed(4));
    domains[row.domain] = v;

    if (row.domain === "抑郁") riskScore += v * 0.3;
    else if (row.domain === "焦虑") riskScore += v * 0.25;
    else if (row.domain === "学习压力") riskScore += v * 0.2;
    else if (row.domain === "社交") riskScore += v * 0.15;
    else if (row.domain === "网络行为") riskScore += v * 0.1;
  }

  let riskLevel = "R3";
  if (safetyHit) riskLevel = "R3";
  else if (riskScore < 0.3) riskLevel = "R0";
  else if (riskScore < 0.5) riskLevel = "R1";
  else if (riskScore < 0.7) riskLevel = "R2";

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

  return {
    risk_level: riskLevel,
    risk_score: Number(riskScore.toFixed(4)),
    domains,
    tags,
    safety_hit: Boolean(safetyHit)
  };
}

async function fetchTestItems(conn, testId) {
  const [items] = await conn.query(
    `
    SELECT i.id, i.type, i.question, i.domain, i.facet, i.reverse_scored,
           so.options_json AS options_json
    FROM psych_answers a
    JOIN psych_items i ON i.id = a.item_id
    LEFT JOIN scale_options so ON so.type = i.type
    WHERE a.test_id = ?
    ORDER BY
      CASE
        WHEN i.type IN ('PHQ9','GAD7','RSES','UCLA','PSS','IAT') THEN 1
        WHEN LOWER(i.type) = 'parent' THEN 2
        ELSE 3
      END,
      FIELD(i.type,'PHQ9','GAD7','RSES','UCLA','PSS','IAT'),
      i.domain,
      i.id
    `,
    [testId]
  );
  return items.map((item) => {
    const opts = ensureArrayJSON(item.options_json);
    const values = opts.map((opt) => Number(opt?.value)).filter((n) => Number.isFinite(n));
    const hasUsableOptions = values.length >= 2 && Math.max(...values) > Math.min(...values);
    if (hasUsableOptions) return item;
    return {
      ...item,
      options_json: getDefaultScaleByType(item.type).options
    };
  });
}

/**
 * GET /api/parent/test/generate
 * 家长试卷生成：六大量表 + parent题库，合计150题
 */
router.get("/test/generate", requireAuth, requireRole("parent"), async (req, res) => {
  const userId = req.user.id;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

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
        const items = await fetchTestItems(conn, test.test_id);
        await conn.rollback();
        return res.json({
          code: 200,
          data: { test_id: test.test_id, items }
        });
      }
    }

    const [testResult] = await conn.query(
      "INSERT INTO psych_tests (user_id, version, status) VALUES (?, 'PARENT-v1', 'in_progress')",
      [userId]
    );
    const testId = testResult.insertId;

    const [stdRows] = await conn.query(
      "SELECT id FROM psych_items WHERE type IN ('PHQ9','GAD7','RSES','UCLA','PSS','IAT') ORDER BY id"
    );
    const stdIds = stdRows.map((row) => row.id);
    const needParentCount = TOTAL_QUESTION_COUNT - stdIds.length;

    if (needParentCount <= 0) {
      throw new Error(`STANDARD_ITEMS_OVERFLOW: ${stdIds.length}`);
    }

    const [parentRows] = await conn.query(
      "SELECT id FROM psych_items WHERE LOWER(type) = 'parent' ORDER BY RAND() LIMIT ?",
      [needParentCount]
    );

    if (parentRows.length < needParentCount) {
      throw new Error(`PARENT_ITEM_NOT_ENOUGH: need=${needParentCount}, actual=${parentRows.length}`);
    }

    const pickedIds = [...stdIds, ...parentRows.map((row) => row.id)];

    if (pickedIds.length !== TOTAL_QUESTION_COUNT) {
      throw new Error(`PICK_COUNT_NOT_150: ${pickedIds.length}`);
    }

    const values = pickedIds.map((id) => [testId, id, null, null]);
    await conn.query("INSERT IGNORE INTO psych_answers (test_id, item_id, answer, score) VALUES ?", [values]);

    const items = await fetchTestItems(conn, testId);

    await conn.commit();
    res.json({
      code: 200,
      data: { test_id: testId, items }
    });
  } catch (err) {
    await conn.rollback();
    console.error("生成家长试卷错误:", err);
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
 * GET /api/parent/test/current
 * 获取当前进行中的家长试卷
 */
router.get("/test/current", requireAuth, requireRole("parent"), async (req, res) => {
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
    const items = await fetchTestItems(conn, testId);

    res.json({ code: 200, data: { test_id: testId, items } });
  } catch (err) {
    console.error("获取家长当前试卷错误:", err);
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
 * POST /api/parent/test/submit
 * 提交家长答案并生成家长报告
 */
router.post("/test/submit", requireAuth, requireRole("parent"), async (req, res) => {
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
    await ensureParentResultsTable(conn);

    const [tests] = await conn.query("SELECT status FROM psych_tests WHERE test_id = ? AND user_id = ?", [test_id, userId]);
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

    const [metaRows] = await conn.query(
      `
      SELECT a.item_id, i.type, i.reverse_scored, so.options_json, so.min_score, so.max_score
      FROM psych_answers a
      JOIN psych_items i ON i.id = a.item_id
      LEFT JOIN scale_options so ON so.type = i.type
      WHERE a.test_id = ?
      `,
      [test_id]
    );

    const metaMap = new Map();
    metaRows.forEach((row) => {
      metaMap.set(String(row.item_id), row);
    });

    let updatedCount = 0;

    for (const ans of answers) {
      const { item_id, answer } = ans || {};
      if (!item_id) continue;

      const item = metaMap.get(String(item_id));
      if (!item) continue;
      const range = deriveRange({
        type: item.type,
        min_score: item.min_score,
        max_score: item.max_score,
        options_json: item.options_json
      });

      const rawAnswer = Number(answer);
      if (!Number.isFinite(rawAnswer)) continue;

      const validAnswer = Math.max(range.min, Math.min(rawAnswer, range.max));
      const score = item.reverse_scored ? range.min + range.max - validAnswer : validAnswer;

      await conn.query(
        "INSERT INTO psych_answers (test_id, item_id, answer, score) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE answer=?, score=?",
        [test_id, item_id, validAnswer, score, validAnswer, score]
      );
      updatedCount++;
    }

    if (updatedCount === 0) {
      await conn.rollback();
      return res.status(422).json({
        code: 422,
        error: "NO_VALID_ANSWERS",
        message: "未识别到有效答案，请检查题目与提交数据是否一致"
      });
    }

    const [domainRows] = await conn.query(
      `
      SELECT i.domain, SUM(a.score) AS sum_score, COUNT(*) AS item_count
      FROM psych_answers a
      JOIN psych_items i ON i.id = a.item_id
      WHERE a.test_id = ? AND LOWER(i.type) = 'parent'
      GROUP BY i.domain
      `,
      [test_id]
    );

    if (domainRows.length === 0) {
      await conn.rollback();
      return res.status(422).json({
        code: 422,
        error: "NO_PARENT_ITEMS",
        message: "未检测到家长题库作答数据"
      });
    }

    const domainStats = {};
    for (const row of domainRows) {
      const key = normalizeDomainKey(row.domain);
      if (!key) continue;
      if (!domainStats[key]) {
        domainStats[key] = { sum: 0, count: 0, maxPerItem: 4 };
      }
      domainStats[key].sum += Number(row.sum_score || 0);
      domainStats[key].count += Number(row.item_count || 0);
    }

    const [coreDomainRows] = await conn.query(
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

    const [safetyRows] = await conn.query(
      "SELECT answer FROM psych_answers WHERE test_id = ? AND item_id = 'PHQ9-09'",
      [test_id]
    );
    const safetyHit = safetyRows.length > 0 && Number(safetyRows[0].answer) >= 3;

    const coreRisk = buildCoreRiskReport(coreDomainRows, safetyHit);

    const [finishedRows] = await conn.query("SELECT NOW() AS finished_at");
    const finishedAt = finishedRows?.[0]?.finished_at || null;
    const report = buildParentReport(domainStats, finishedAt);
    report.core_risk = coreRisk;
    report.risk_level = coreRisk.risk_level;
    report.risk_score = coreRisk.risk_score;
    report.domains = coreRisk.domains;
    report.tags = coreRisk.tags;

    await conn.query(
      `
      INSERT INTO psych_parent_results (test_id, report_json)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE report_json = VALUES(report_json), created_at = CURRENT_TIMESTAMP
      `,
      [test_id, JSON.stringify(report)]
    );

    await conn.query("UPDATE psych_tests SET status = 'finished', finished_at = NOW() WHERE test_id = ?", [test_id]);

    await conn.commit();
    res.json({
      code: 200,
      message: "提交成功",
      data: report
    });
  } catch (err) {
    await conn.rollback();
    console.error("提交家长答案错误:", err);
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
 * GET /api/parent/result
 * 获取家长最新测评结果
 */
router.get("/result", requireAuth, requireRole("parent"), async (req, res) => {
  const userId = req.user.id;
  const conn = await pool.getConnection();

  try {
    await ensureParentResultsTable(conn);

    const [rows] = await conn.query(
      `
      SELECT pr.report_json, pr.created_at, t.finished_at
      FROM psych_parent_results pr
      JOIN psych_tests t ON t.test_id = pr.test_id
      WHERE t.user_id = ?
      ORDER BY pr.created_at DESC
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

    const row = rows[0];
    let report = row.report_json;
    if (typeof report === "string") {
      try {
        report = JSON.parse(report);
      } catch (e) {
        report = {};
      }
    }

    res.json({
      code: 200,
      data: {
        ...report,
        finished_at: row.finished_at || row.created_at
      }
    });
  } catch (err) {
    console.error("获取家长结果错误:", err);
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
