// routes/teacher.js - 教师测评路由
const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const TEACHER_TYPES = ["TEC"]; // 教师专属量表
const TOTAL_QUESTION_COUNT = 150;

const DOMAIN_LABELS = {
  teacher_mental_health: "教师心理健康",
  teacher_pressure: "教师职业压力",
  teacher_burnout: "教师职业倦怠",
  teacher_emotion: "教师情绪调节",
  education_support: "教育支持方式",
  school_support: "学校支持与组织氛围",
  classroom_management: "课堂管理互动",
  work_life_balance: "工作生活平衡",
  teacher_relationship: "教师人际关系",
  risk_identification: "风险识别与转介意识"
};

const DOMAIN_ALIASES = {
  教师心理健康: "teacher_mental_health",
  教师职业压力: "teacher_pressure",
  教师职业倦怠: "teacher_burnout",
  教师情绪调节: "teacher_emotion",
  教育支持方式: "education_support",
  学校支持与组织氛围: "school_support",
  课堂管理互动: "classroom_management",
  工作生活平衡: "work_life_balance",
  教师人际关系: "teacher_relationship",
  风险识别与转介意识: "risk_identification",
  // 兼容数据库中可能存在的简短版本
  学校组织氛围: "school_support",
  教师教育支持: "education_support",
  风险识别转介: "risk_identification"
};

function normalizeDomainKey(domain) {
  if (!domain) return null;
  // 清理输入：去除首尾空格，标准化空白字符
  let key = String(domain).trim().replace(/\s+/g, " ");

  // 直接匹配 DOMAIN_LABELS（英文键）
  if (DOMAIN_LABELS[key]) return key;

  // 直接匹配 DOMAIN_ALIASES（中文键）
  if (DOMAIN_ALIASES[key]) return DOMAIN_ALIASES[key];

  // 尝试模糊匹配：移除所有空格后匹配
  const keyNoSpace = key.replace(/\s/g, "");
  for (const [alias, normalized] of Object.entries(DOMAIN_ALIASES)) {
    const aliasNoSpace = alias.replace(/\s/g, "");
    if (aliasNoSpace === keyNoSpace) {
      return normalized;
    }
  }

  // 最后尝试转换为小写下划线格式
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
  if (t === "TEC") {
    return {
      min: 1,
      max: 5,
      options: [
        { text: "从不", value: 1 },
        { text: "较少", value: 2 },
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

async function ensureTeacherResultsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS psych_teacher_results (
      test_id BIGINT NOT NULL,
      report_json JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (test_id),
      CONSTRAINT fk_teacher_res_test FOREIGN KEY (test_id) REFERENCES psych_tests(test_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
}

function classifyBurnoutLevel({ burnout, exhaustion, accomplishment }) {
  if (burnout < 30 && exhaustion < 30) return "职业状态良好";
  if (burnout >= 60 || exhaustion >= 70) return "高度倦怠风险";
  if (burnout >= 40 || exhaustion >= 50) return "中度倦怠倾向";
  if (accomplishment < 40) return "成就感不足";
  return "轻度倦怠信号";
}

function buildTeacherReport(domainStats, finishedAt) {
  const domainIndex = {};

  for (const [key, row] of Object.entries(domainStats)) {
    const maxScore = row.count * row.maxPerItem;
    const ratio = maxScore > 0 ? row.sum / maxScore : 0;
    domainIndex[key] = round2(ratio * 100);
  }

  // 定义权重
  const weights = {
    teacher_mental_health: 0.15,
    teacher_pressure: 0.10,
    teacher_burnout: 0.10,
    teacher_emotion: 0.10,
    education_support: 0.10,
    school_support: 0.10,
    classroom_management: 0.10,
    work_life_balance: 0.10,
    teacher_relationship: 0.10,
    risk_identification: 0.05
  };

  // 计算心理健康指数 = Σ (维度得分 × 权重)
  let mentalHealthIndex = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const score = domainIndex[key] || 0;
    mentalHealthIndex += score * weight;
  }
  mentalHealthIndex = round2(mentalHealthIndex);

  // 确定心理健康等级
  let mentalHealthLevel;
  if (mentalHealthIndex >= 81) mentalHealthLevel = "非常健康";
  else if (mentalHealthIndex >= 61) mentalHealthLevel = "良好";
  else if (mentalHealthIndex >= 41) mentalHealthLevel = "一般";
  else if (mentalHealthIndex >= 21) mentalHealthLevel = "偏低";
  else mentalHealthLevel = "风险";

  const warnings = [];
  if (mentalHealthIndex < 40) {
    warnings.push({ level: "一级预警", message: "心理健康指数偏低，建议尽快进行心理调适与寻求支持。" });
  }
  if ((domainIndex.teacher_pressure || 0) > 70) {
    warnings.push({ level: "二级预警", message: "教师职业压力过高，建议寻求同事支持或专业辅导。" });
  }
  if ((domainIndex.teacher_burnout || 0) > 70) {
    warnings.push({ level: "二级预警", message: "教师职业倦怠程度较高，建议进行心理调适。" });
  }
  if ((domainIndex.work_life_balance || 0) < 40) {
    warnings.push({ level: "三级预警", message: "工作与生活平衡存在问题，建议优化时间管理。" });
  }

  const domainRows = Object.entries(domainIndex).map(([key, score]) => ({
    key,
    label: DOMAIN_LABELS[key] || key,
    score,
    level: scoreLevel(score),
    weight: weights[key] || 0
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
  if (mentalHealthIndex < 40) {
    suggestions.push("建议关注个人心理健康状态，必要时寻求专业心理咨询支持。");
  }
  if ((domainIndex.teacher_burnout || 0) > 70) {
    suggestions.push("建议每天安排15-20分钟的放松时间，进行深呼吸或冥想练习，缓解职业倦怠。");
  }
  if ((domainIndex.teacher_pressure || 0) > 70) {
    suggestions.push("与同事或领导沟通教学压力，寻求团队支持与资源协助。");
  }
  if ((domainIndex.work_life_balance || 0) < 40) {
    suggestions.push("明确工作与休息的界限，下班后减少非必要的工作联系，平衡工作与生活。");
  }
  if (suggestions.length === 0) {
    suggestions.push("保持良好的职业状态，定期进行自我反思与职业规划。");
    suggestions.push("参与专业发展活动，持续提升教学能力与职业满足感。");
  }

  return {
    assessed_at: finishedAt || new Date().toISOString(),
    domain_index: domainIndex,
    domain_rows: domainRows,
    mental_health_index: mentalHealthIndex,
    mental_health_level: mentalHealthLevel,
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
        WHEN UPPER(i.type) = 'TEC' THEN 2
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
 * GET /api/teacher/test/generate
 * 教师试卷生成：仅使用TEC题库，合计150题
 */
router.get("/test/generate", requireAuth, requireRole("teacher"), async (req, res) => {
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
      "INSERT INTO psych_tests (user_id, version, status) VALUES (?, 'TEACHER-v1', 'in_progress')",
      [userId]
    );
    const testId = testResult.insertId;

    // 仅使用TEC类型题目，随机抽取150题
    const [teacherRows] = await conn.query(
      "SELECT id FROM psych_items WHERE UPPER(type) = 'TEC' ORDER BY RAND() LIMIT ?",
      [TOTAL_QUESTION_COUNT]
    );

    if (teacherRows.length < TOTAL_QUESTION_COUNT) {
      throw new Error(`TEACHER_ITEM_NOT_ENOUGH: need=${TOTAL_QUESTION_COUNT}, actual=${teacherRows.length}`);
    }

    const pickedIds = teacherRows.map((row) => row.id);

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
    console.error("生成教师试卷错误:", err);
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
 * GET /api/teacher/test/current
 * 获取当前进行中的教师试卷
 */
router.get("/test/current", requireAuth, requireRole("teacher"), async (req, res) => {
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
    console.error("获取教师当前试卷错误:", err);
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
 * POST /api/teacher/test/submit
 * 提交教师答案并生成教师报告
 */
router.post("/test/submit", requireAuth, requireRole("teacher"), async (req, res) => {
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
    await ensureTeacherResultsTable(conn);

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
      SELECT i.domain, SUM(a.score) AS sum_score, COUNT(*) AS item_count, MAX(so.max_score) AS max_score
      FROM psych_answers a
      JOIN psych_items i ON i.id = a.item_id
      LEFT JOIN scale_options so ON so.type = i.type
      WHERE a.test_id = ? AND UPPER(i.type) = 'TEC'
      GROUP BY i.domain
      `,
      [test_id]
    );

    if (domainRows.length === 0) {
      await conn.rollback();
      return res.status(422).json({
        code: 422,
        error: "NO_TEACHER_ITEMS",
        message: "未检测到教师题库作答数据"
      });
    }

    const domainStats = {};
    for (const row of domainRows) {
      const key = normalizeDomainKey(row.domain);
      if (!key) continue;
      if (!domainStats[key]) {
        const maxPerItem = Number(row.max_score) || 5;
        domainStats[key] = { sum: 0, count: 0, maxPerItem };
      }
      domainStats[key].sum += Number(row.sum_score || 0);
      domainStats[key].count += Number(row.item_count || 0);
    }

    const [finishedRows] = await conn.query("SELECT NOW() AS finished_at");
    const finishedAt = finishedRows?.[0]?.finished_at || null;
    const report = buildTeacherReport(domainStats, finishedAt);

    // 为教师报告添加基本的风险评估
    const burnoutRisk = (report.domain_index?.teacher_burnout || 0) > 70 ? 0.4 : (report.domain_index?.teacher_burnout || 0) > 50 ? 0.2 : 0;
    const pressureRisk = (report.domain_index?.teacher_pressure || 0) > 70 ? 0.3 : (report.domain_index?.teacher_pressure || 0) > 50 ? 0.15 : 0;
    const balanceRisk = (report.domain_index?.work_life_balance || 0) < 40 ? 0.3 : (report.domain_index?.work_life_balance || 0) < 60 ? 0.15 : 0;

    const riskScore = burnoutRisk + pressureRisk + balanceRisk;
    let riskLevel;
    if (riskScore >= 0.7) riskLevel = "R3";
    else if (riskScore >= 0.5) riskLevel = "R2";
    else if (riskScore >= 0.3) riskLevel = "R1";
    else riskLevel = "R0";

    report.risk_level = riskLevel;
    report.risk_score = parseFloat(riskScore.toFixed(4));

    await conn.query(
      `
      INSERT INTO psych_teacher_results (test_id, report_json)
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
    console.error("提交教师答案错误:", err);
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
 * GET /api/teacher/result
 * 获取教师最新测评结果
 */
router.get("/result", requireAuth, requireRole("teacher"), async (req, res) => {
  const userId = req.user.id;
  const conn = await pool.getConnection();

  try {
    await ensureTeacherResultsTable(conn);

    const [rows] = await conn.query(
      `
      SELECT tr.report_json, tr.created_at, t.finished_at
      FROM psych_teacher_results tr
      JOIN psych_tests t ON t.test_id = tr.test_id
      WHERE t.user_id = ?
      ORDER BY tr.created_at DESC
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
    console.error("获取教师结果错误:", err);
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