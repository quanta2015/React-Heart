import React, { useEffect, useMemo, useRef } from "react";
import { Tag, Alert, Progress } from "antd";
import * as echarts from "echarts";
import s from "./index.module.less";
import { generateParentSuggestion } from "@/util/suggEngineParent";

const levelColor = (level) => {
  if (level === "非常健康") return "green";
  if (level === "良好") return "blue";
  if (level === "一般") return "gold";
  if (level === "偏低") return "orange";
  return "red";
};

const ParentResultsSection = ({ result }) => {
  if (!result) return null;

  const coreRadarRef = useRef(null);
  const parentRadarRef = useRef(null);
  const rows = Array.isArray(result.domain_rows) ? result.domain_rows : [];
  const coreRisk = result.core_risk || {
    risk_level: result.risk_level,
    risk_score: result.risk_score,
    domains: result.domains || {},
    tags: result.tags || []
  };
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const strengths = Array.isArray(result.strengths) ? result.strengths : [];
  const concerns = Array.isArray(result.concerns) ? result.concerns : [];
  const backendSuggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
  const coreDomains = coreRisk?.domains && typeof coreRisk.domains === "object" ? coreRisk.domains : {};

  const parentSuggestion = useMemo(() => {
    const domainRows = Array.isArray(result.domain_rows) ? result.domain_rows : [];
    return generateParentSuggestion({
      ...result,
      domain_rows: domainRows
    });
  }, [result]);

  const finalSuggestions = useMemo(() => {
    const advice = Array.isArray(parentSuggestion?.parent_advice) ? parentSuggestion.parent_advice : [];
    const actions = Array.isArray(parentSuggestion?.actions) ? parentSuggestion.actions : [];
    const merged = [...advice, ...actions];
    return merged.length > 0 ? merged : backendSuggestions;
  }, [parentSuggestion, backendSuggestions]);

  const riskTag = useMemo(() => {
    const map = {
      R0: { color: "green", text: "低风险" },
      R1: { color: "blue", text: "轻度关注" },
      R2: { color: "orange", text: "中度风险" },
      R3: { color: "red", text: "高风险" }
    };
    return map[coreRisk?.risk_level] || { color: "default", text: coreRisk?.risk_level || "未知" };
  }, [coreRisk?.risk_level]);

  const coreRiskMap = useMemo(() => {
    const tags = Array.isArray(coreRisk?.tags) ? coreRisk.tags : [];
    const domainPrefixToCn = {
      academicstress: "学习压力",
      depression: "抑郁",
      anxiety: "焦虑",
      selfesteem: "自尊",
      social: "社交",
      internet: "网络行为"
    };
    const map = {};
    tags.forEach((tag) => {
      const [prefix, level] = String(tag).split("_");
      const cn = domainPrefixToCn[prefix];
      if (cn && level) map[cn] = level.toLowerCase();
    });
    return map;
  }, [coreRisk?.tags]);

  const coreLevelTag = (level) => {
    if (level === "high") return <Tag color="red">高风险</Tag>;
    if (level === "medium") return <Tag color="orange">中风险</Tag>;
    if (level === "low") return <Tag color="green">低风险</Tag>;
    return <Tag>未知</Tag>;
  };

  useEffect(() => {
    if (!parentRadarRef.current || rows.length === 0) return undefined;

    const chart = echarts.init(parentRadarRef.current);
    chart.setOption({
      tooltip: { trigger: "item" },
      radar: {
        radius: "68%",
        indicator: rows.map((r) => ({ name: r.label, max: 100 })),
        axisName: { color: "#334155", fontSize: 12 },
        splitArea: { areaStyle: { color: ["#f8fbff", "#ffffff"] } },
        splitLine: { lineStyle: { color: "#dbe7f3" } },
        axisLine: { lineStyle: { color: "#dbe7f3" } }
      },
      series: [
        {
          type: "radar",
          data: [
            {
              value: rows.map((r) => Number(r.score || 0)),
              name: "家长维度评分",
              areaStyle: { color: "rgba(37, 99, 235, 0.2)" },
              lineStyle: { color: "#2563eb", width: 2 },
              itemStyle: { color: "#2563eb" }
            }
          ]
        }
      ]
    });

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(parentRadarRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [rows]);

  useEffect(() => {
    const entries = Object.entries(coreDomains);
    if (!coreRadarRef.current || entries.length === 0) return undefined;

    const chart = echarts.init(coreRadarRef.current);
    chart.setOption({
      tooltip: { trigger: "item" },
      radar: {
        radius: "68%",
        indicator: entries.map(([name]) => ({ name, max: 1 })),
        axisName: { color: "#334155", fontSize: 12 },
        splitArea: { areaStyle: { color: ["#f8fbff", "#ffffff"] } },
        splitLine: { lineStyle: { color: "#dbe7f3" } },
        axisLine: { lineStyle: { color: "#dbe7f3" } }
      },
      series: [
        {
          type: "radar",
          data: [
            {
              value: entries.map(([, score]) => Number(score || 0)),
              name: "六维评分",
              areaStyle: { color: "rgba(14, 165, 233, 0.2)" },
              lineStyle: { color: "#0284c7", width: 2 },
              itemStyle: { color: "#0284c7" }
            }
          ]
        }
      ]
    });

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(coreRadarRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [coreDomains]);

  return (
    <div className={s.wrap}>
      <div className={s.listCard}>
        <div className={s.listTitle}>第一部分：六维度风险评估</div>
        <div className={s.threeColLayout}>
          <div className={s.panel}>
            <div className={s.overallBlock}>
              <div className={s.overallTitle}>综合风险</div>
              <Tag color={riskTag.color}>{riskTag.text}</Tag>
            </div>
            <div className={s.overallBlock}>
              <div className={s.overallTitle}>风险分数</div>
              <div className={s.coreProgress}>
                <Progress percent={Math.round((Number(coreRisk?.risk_score) || 0) * 100)} />
              </div>
            </div>
          </div>

          <div className={s.panel}>
            <table className={s.scoreTable}>
              <thead>
                <tr>
                  <th>维度</th>
                  <th>得分</th>
                  <th>风险</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(coreDomains).map(([name, score]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{Number(score || 0).toFixed(2)}</td>
                    <td>{coreLevelTag(coreRiskMap[name])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={s.panel}>
            <div ref={coreRadarRef} className={s.coreRadarChart} />
          </div>
        </div>
      </div>

      <div className={s.listCard}>
        <div className={s.listTitle}>第二部分：家长十维画像</div>
        <div className={s.threeColLayout}>
          <div className={`${s.panel} ${s.metricsCol}`}>
            <div className={s.metricCard}>
              <div className={s.metricTitle}>家庭心理环境指数</div>
              <div className={s.metricValue}>{result.family_env_index ?? 0}</div>
              <div className={s.metricLevel}>{result.family_env_level || "-"}</div>
            </div>
            <div className={s.metricCard}>
              <div className={s.metricTitle}>家长压力指数</div>
              <div className={s.metricValue}>{result.parent_pressure ?? 0}</div>
              <div className={s.metricLevel}>{result.parent_pressure_level || "-"}</div>
            </div>
            <div className={s.metricCard}>
              <div className={s.metricTitle}>情绪管理指数</div>
              <div className={s.metricValue}>{result.emotion_index ?? 0}</div>
              <div className={s.metricLevel}>{result.emotion_index_level || "-"}</div>
            </div>
            <div className={s.metricCard}>
              <div className={s.metricTitle}>教养方式分类</div>
              <div className={s.metricValue}>{result.parenting_style_type || "未分类"}</div>
            </div>
          </div>

          <div className={s.panel}>
            <table className={s.scoreTable}>
              <thead>
                <tr>
                  <th>维度</th>
                  <th>评分</th>
                  <th>等级</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td>{row.score}</td>
                    <td>
                      <Tag color={levelColor(row.level)}>{row.level}</Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={s.panel}>
            <div ref={parentRadarRef} className={s.radarChart} />
          </div>
        </div>
      </div>

      <div className={s.listCard}>
        <div className={s.listTitle}>风险预警</div>
        {warnings.length === 0 ? <Tag color="green">暂无预警</Tag> : null}
        {warnings.map((w, idx) => (
          <div className={s.warn} key={`${w.level}-${idx}`}>
            <Alert type="warning" showIcon message={w.level} description={w.message} />
          </div>
        ))}
      </div>

      <div className={s.listCard}>
        <div className={s.listTitle}>优势</div>
        <div className={s.chips}>
          {strengths.map((it, idx) => (
            <span className={s.chip} key={`s-${idx}`}>
              {it}
            </span>
          ))}
        </div>
      </div>

      <div className={s.listCard}>
        <div className={s.listTitle}>需要关注</div>
        <div className={s.chips}>
          {concerns.map((it, idx) => (
            <span className={s.chip} key={`c-${idx}`}>
              {it}
            </span>
          ))}
        </div>
      </div>

      <div className={s.listCard}>
        <div className={s.listTitle}>专业建议</div>
        {parentSuggestion?.summary_content ? (
          <Alert
            type={parentSuggestion?.refer_required ? "warning" : "info"}
            showIcon
            message={parentSuggestion?.summary_title || "分析摘要"}
            description={parentSuggestion.summary_content}
            style={{ marginBottom: 10 }}
          />
        ) : null}
        {finalSuggestions.map((it, idx) => (
          <div className={s.row} key={`a-${idx}`}>
            <span>{`建议${idx + 1}`}</span>
            <span style={{ gridColumn: "span 2" }}>{it}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ParentResultsSection;
