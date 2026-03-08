import templateLib from "@/constant/sugg-student.json";

/**
 * 传入测评结果 data，返回建议结果
 */
export function generatePsychSuggestion(data) {
  const riskLevel = data?.risk_level || "R0";
  const riskScore = Number(data?.risk_score || 0);
  const domains = data?.domains_json || {};
  const tags = Array.isArray(data?.tags_json) ? data.tags_json : [];

  const tagMap = parseTags(tags);
  const levelMap = buildLevelMap(domains, tagMap, templateLib.scoreLevelThresholds);
  const rankedDomains = rankDomains(domains);
  const topDomains = rankedDomains.slice(0, 3).map((item) => item.name);
  const highCount = Object.values(levelMap).filter((v) => v === "high").length;

  const ctx = {
    riskLevel,
    riskScore,
    highCount,
    ...levelMap
  };

  const matchedRules = matchCombinationRules(ctx, templateLib.templates.combinationRules);

  const summary = templateLib.riskSummary[riskLevel] || templateLib.riskSummary.R0;
  const followupDays = templateLib.riskFollowupDays[riskLevel] ?? 30;

  let studentAdvice = [];
  let teacherAdvice = [];
  let parentAdvice = [];
  let actions = [];
  let matchedRuleCodes = [];
  let referRequired = false;

  // 1. 总体建议
  studentAdvice.push(...getGeneralTemplates("student", riskLevel));
  teacherAdvice.push(...getGeneralTemplates("teacher", riskLevel));
  parentAdvice.push(...getGeneralTemplates("parent", riskLevel));
  actions.push(...getGeneralActionTemplates(riskLevel));

  // 2. 重点维度建议（前三个维度）
  topDomains.forEach((domainName) => {
    const key = getDomainCodeByCnName(domainName);
    if (!key) return;
    const severity = levelMap[key];
    if (!severity) return;

    const domainBlock = templateLib.templates.domain[key]?.[severity];
    if (!domainBlock) return;

    studentAdvice.push(...(domainBlock.student || []));
    teacherAdvice.push(...(domainBlock.teacher || []));
    parentAdvice.push(...(domainBlock.parent || []));
  });

  // 3. 组合规则建议
  matchedRules.forEach((rule) => {
    matchedRuleCodes.push(rule.code);
    const extra = rule.extra || {};
    studentAdvice.push(...(extra.student || []));
    teacherAdvice.push(...(extra.teacher || []));
    parentAdvice.push(...(extra.parent || []));
    actions.push(...(extra.actions || []));
    if (extra.refer_required === true) {
      referRequired = true;
    }
  });

  // 4. 风险升级修正
  if (riskLevel === "R3" && highCount >= 2) {
    referRequired = referRequired || true;
  }

  // 5. 去重 + 限制条数
  studentAdvice = uniqueAndLimit(studentAdvice, 6);
  teacherAdvice = uniqueAndLimit(teacherAdvice, 6);
  parentAdvice = uniqueAndLimit(parentAdvice, 6);
  actions = uniqueAndLimit(actions, 6);

  // 6. 维度解读
  const domainInterpretation = rankedDomains.map((item) => ({
    domain: item.name,
    score: item.score,
    level: getDomainLevelByCnName(item.name, levelMap)
  }));

  return {
    test_id: data?.test_id,
    risk_level: riskLevel,
    risk_score: riskScore,
    summary_level: summary.summary_level,
    summary_title: summary.title,
    summary_content: summary.content,
    priority_domains: topDomains,
    matched_rules: matchedRuleCodes,
    domain_interpretation: domainInterpretation,
    student_advice: studentAdvice,
    teacher_advice: teacherAdvice,
    parent_advice: parentAdvice,
    actions,
    followup_days: followupDays,
    refer_required: referRequired
  };
}

/**
 * 解析 tags_json:
 * ["anxiety_medium", "social_high"] -> { anxiety: "medium", social: "high" }
 */
function parseTags(tags) {
  const result = {};
  tags.forEach((tag) => {
    const idx = tag.lastIndexOf("_");
    if (idx <= 0) return;
    const key = tag.slice(0, idx);
    const value = tag.slice(idx + 1);
    result[key] = value;
  });
  return result;
}

/**
 * 用 tags 优先，缺失时再用 score 推断严重程度
 */
function buildLevelMap(domains, tagMap, thresholds) {
  return {
    depression: tagMap.depression || scoreToLevel(domains["抑郁"], thresholds),
    anxiety: tagMap.anxiety || scoreToLevel(domains["焦虑"], thresholds),
    social: tagMap.social || scoreToLevel(domains["社交"], thresholds),
    selfesteem: tagMap.selfesteem || scoreToLevel(domains["自尊"], thresholds),
    academicstress: tagMap.academicstress || scoreToLevel(domains["学习压力"], thresholds),
    internet: tagMap.internet || scoreToLevel(domains["网络行为"], thresholds)
  };
}

function scoreToLevel(score, thresholds) {
  const n = Number(score || 0);
  if (n <= thresholds.lowMax) return "low";
  if (n <= thresholds.mediumMax) return "medium";
  return "high";
}

function rankDomains(domains) {
  return Object.entries(domains)
    .map(([name, score]) => ({
      name,
      score: Number(score || 0)
    }))
    .sort((a, b) => b.score - a.score);
}

function getGeneralTemplates(role, riskLevel) {
  return templateLib.templates.general?.[role]?.[riskLevel] || [];
}

function getGeneralActionTemplates(riskLevel) {
  return templateLib.templates.general?.actions?.[riskLevel] || [];
}

function getDomainCodeByCnName(cnName) {
  const map = {
    抑郁: "depression",
    焦虑: "anxiety",
    社交: "social",
    自尊: "selfesteem",
    学习压力: "academicstress",
    网络行为: "internet"
  };
  return map[cnName];
}

function getDomainLevelByCnName(cnName, levelMap) {
  const code = getDomainCodeByCnName(cnName);
  return code ? levelMap[code] : "low";
}

function matchCombinationRules(ctx, rules) {
  return [...rules]
    .filter((rule) => isRuleMatched(ctx, rule.conditions || {}))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

function isRuleMatched(ctx, conditions) {
  for (const key of Object.keys(conditions)) {
    const expected = conditions[key];

    if (key === "highCountMin") {
      if ((ctx.highCount || 0) < expected) return false;
      continue;
    }

    if (key === "riskLevel") {
      if (!Array.isArray(expected) || !expected.includes(ctx.riskLevel)) return false;
      continue;
    }

    if (!Array.isArray(expected)) return false;
    if (!expected.includes(ctx[key])) return false;
  }
  return true;
}

function uniqueAndLimit(arr, limit = 6) {
  const seen = new Set();
  const result = [];
  for (const item of arr) {
    const text = String(item || "").trim();
    if (!text) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}
