import templateLib from "@/constant/sugg-parent.json";

/**
 * 家长维度中文名 -> code
 */
function getParentDomainCodeByCnName(cnName) {
  const map = {
    教养方式: "parentingstyle",
    情绪管理: "parentemotion",
    家长压力: "parentstress",
    期望压力: "parentexpectation",
    家庭沟通: "familycommunication",
    亲子关系: "parentchildrelationship",
    管教方式: "disciplinemethod",
    家庭氛围: "familyenvironment",
    情感支持: "emotionalsupport",
    教育观念: "educationattitude"
  };
  return map[cnName];
}

function parseTags(tags) {
  const result = {};
  (tags || []).forEach((tag) => {
    const idx = String(tag).lastIndexOf("_");
    if (idx <= 0) return;
    const key = tag.slice(0, idx);
    const value = tag.slice(idx + 1);
    result[key] = value;
  });
  return result;
}

function scoreToLevel(score, thresholds) {
  const n = Number(score || 0);
  if (n <= thresholds.lowMax) return "low";
  if (n <= thresholds.mediumMax) return "medium";
  return "high";
}

function buildParentLevelMap(domains, tagMap, thresholds) {
  return {
    parentingstyle: tagMap.parentingstyle || scoreToLevel(domains["教养方式"], thresholds),
    parentemotion: tagMap.parentemotion || scoreToLevel(domains["情绪管理"], thresholds),
    parentstress: tagMap.parentstress || scoreToLevel(domains["家长压力"], thresholds),
    parentexpectation: tagMap.parentexpectation || scoreToLevel(domains["期望压力"], thresholds),
    familycommunication: tagMap.familycommunication || scoreToLevel(domains["家庭沟通"], thresholds),
    parentchildrelationship: tagMap.parentchildrelationship || scoreToLevel(domains["亲子关系"], thresholds),
    disciplinemethod: tagMap.disciplinemethod || scoreToLevel(domains["管教方式"], thresholds),
    familyenvironment: tagMap.familyenvironment || scoreToLevel(domains["家庭氛围"], thresholds),
    emotionalsupport: tagMap.emotionalsupport || scoreToLevel(domains["情感支持"], thresholds),
    educationattitude: tagMap.educationattitude || scoreToLevel(domains["教育观念"], thresholds)
  };
}

function rankDomains(domains) {
  return Object.entries(domains || {})
    .map(([name, score]) => ({
      name,
      score: Number(score || 0)
    }))
    .sort((a, b) => b.score - a.score);
}

function uniqueAndLimit(arr, limit = 6) {
  const seen = new Set();
  const result = [];
  for (const item of arr || []) {
    const text = String(item || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function getGeneralTemplates(role, riskLevel) {
  return templateLib.templates.general?.[role]?.[riskLevel] || [];
}

function getGeneralActionTemplates(riskLevel) {
  return templateLib.templates.general?.actions?.[riskLevel] || [];
}

function isRuleMatched(ctx, conditions) {
  for (const key of Object.keys(conditions || {})) {
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

function matchCombinationRules(ctx, rules) {
  return [...(rules || [])]
    .filter((rule) => isRuleMatched(ctx, rule.conditions || {}))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

/**
 * 生成家长测评建议
 * @param {Object} data
 * @returns {Object}
 */
export function generateParentSuggestion(data) {
  const riskLevel = data?.risk_level || data?.core_risk?.risk_level || "R0";
  const riskScore = Number(data?.risk_score ?? data?.core_risk?.risk_score ?? 0);

  const domainsFromRows = Array.isArray(data?.domain_rows)
    ? data.domain_rows.reduce((acc, row) => {
        if (row?.label != null) acc[row.label] = Number(row.score || 0);
        return acc;
      }, {})
    : {};
  const domains = data?.domains_json || data?.domain_index_cn || domainsFromRows || {};

  const tags = Array.isArray(data?.tags_json)
    ? data.tags_json
    : Array.isArray(data?.core_risk?.tags)
      ? data.core_risk.tags
      : Array.isArray(data?.tags)
        ? data.tags
        : [];

  const tagMap = parseTags(tags);
  const levelMap = buildParentLevelMap(domains, tagMap, templateLib.scoreLevelThresholds);
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

  let parentAdvice = [];
  let actions = [];
  let matchedRuleCodes = [];
  let referRequired = false;

  // 1. 通用建议
  parentAdvice.push(...getGeneralTemplates("parent", riskLevel));
  actions.push(...getGeneralActionTemplates(riskLevel));

  // 2. 前三个重点维度建议
  topDomains.forEach((domainName) => {
    const key = getParentDomainCodeByCnName(domainName);
    if (!key) return;

    const severity = levelMap[key];
    if (!severity) return;

    const domainBlock = templateLib.templates.domain[key]?.[severity];
    if (!domainBlock) return;

    parentAdvice.push(...(domainBlock.parent || []));
  });

  // 3. 组合规则建议
  matchedRules.forEach((rule) => {
    matchedRuleCodes.push(rule.code);
    const extra = rule.extra || {};
    parentAdvice.push(...(extra.parent || []));
    actions.push(...(extra.actions || []));
    if (extra.refer_required === true) {
      referRequired = true;
    }
  });

  // 4. 高风险修正
  if (riskLevel === "R3" && highCount >= 2) {
    referRequired = true;
  }

  // 5. 去重与限制
  parentAdvice = uniqueAndLimit(parentAdvice, 6);
  actions = uniqueAndLimit(actions, 6);

  // 6. 维度解释
  const domainInterpretation = rankedDomains.map((item) => {
    const code = getParentDomainCodeByCnName(item.name);
    return {
      domain: item.name,
      score: item.score,
      level: code ? levelMap[code] : "low"
    };
  });

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
    parent_advice: parentAdvice,
    actions,
    followup_days: followupDays,
    refer_required: referRequired
  };
}
