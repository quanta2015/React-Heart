import React from "react";
import { Card, Tag, Row, Col, Progress, Empty } from "antd";
import RadarChart from "@/app/manager/chart/RadarChart";
import s from "./index.module.less";

const levelColors = {
  非常健康: "#52c41a",
  良好: "#1890ff",
  一般: "#faad14",
  偏低: "#fa8c16",
  风险: "#f5222d"
};

const TeacherResultsSection = ({ result, user }) => {
  if (!result) {
    return <Empty description="暂无测评结果" />;
  }

  const {
    mental_health_index,
    mental_health_level,
    domain_index = {},
    domain_rows = [],
    warnings = [],
    strengths = [],
    concerns = [],
    suggestions = [],
    finished_at
  } = result;

  const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const getLevelByIndex = (value) => {
    if (value >= 81) return "非常健康";
    if (value >= 61) return "良好";
    if (value >= 41) return "一般";
    if (value >= 21) return "偏低";
    return "风险";
  };

  const derivedIndex = (() => {
    const direct = toNumber(mental_health_index);
    if (direct > 0) return direct;
    if (!Array.isArray(domain_rows) || domain_rows.length === 0) return direct;

    let total = 0;
    let weightSum = 0;
    domain_rows.forEach((row) => {
      const score = toNumber(row?.score);
      const weight = toNumber(row?.weight);
      if (weight > 0) {
        total += score * weight;
        weightSum += weight;
      }
    });

    if (weightSum > 0 && total > 0) return Number(total.toFixed(2));
    // 如果没有权重，回退为简单平均
    if (weightSum === 0) {
      const scores = domain_rows.map((row) => toNumber(row?.score)).filter((score) => score > 0);
      if (scores.length > 0) {
        const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        return Number(avg.toFixed(2));
      }
    }
    return direct;
  })();

  const derivedLevel = derivedIndex > 0 ? getLevelByIndex(derivedIndex) : mental_health_level;

  // 准备雷达图数据 - 转换为0-1范围
  const radarData = {};
  const domainLabelsMap = {
    teacher_mental_health: "教师心理健康",
    teacher_pressure: "教师职业压力",
    teacher_burnout: "教师职业倦怠",
    teacher_emotion: "教师情绪调节",
    education_support: "教师教育支持",
    school_support: "学校组织氛围",
    classroom_management: "课堂管理互动",
    work_life_balance: "工作生活平衡",
    teacher_relationship: "教师人际关系",
    risk_identification: "风险识别转介"
  };

  const hasIndexValues = Object.values(domain_index || {}).some((value) => toNumber(value) > 0);

  if (hasIndexValues) {
    const indexEntries = Object.entries(domain_index || {});
    indexEntries.forEach(([key, value]) => {
      const mappedLabel = domainLabelsMap[key] || key;
      const safeValue = toNumber(value);
      if (safeValue > 0) {
        radarData[mappedLabel] = safeValue / 100;
      }
    });
  }

  if (Object.keys(radarData).length === 0 && Array.isArray(domain_rows) && domain_rows.length > 0) {
    domain_rows.forEach((row) => {
      const label = row?.label || row?.key || row?.domain;
      if (!label) return;
      const value = toNumber(row?.score);
      if (value > 0) {
        radarData[label] = value / 100;
      }
    });
  }

  const tableRows = (() => {
    if (Array.isArray(domain_rows) && domain_rows.length > 0) {
      return domain_rows
        .map((row) => {
          const label = row?.label || row?.key || row?.domain || "-";
          const score = toNumber(row?.score);
          const level = row?.level || (score > 0 ? getLevelByIndex(score) : "-");
          return { label, score, level };
        })
        .filter((row) => row.label !== "-" || row.score > 0);
    }

    const indexEntries = Object.entries(domain_index || {});
    if (indexEntries.length > 0) {
      return indexEntries
        .map(([key, value]) => {
          const label = domainLabelsMap[key] || key;
          const score = toNumber(value);
          const level = score > 0 ? getLevelByIndex(score) : "-";
          return { label, score, level };
        })
        .filter((row) => row.score > 0);
    }

    return [];
  })();

  return (
    <div className={s.teacherResults}>
      <div className={s.listCard}>
        <div className={s.listTitle}>教师心理测评报告</div>
        <div className={s.listSubtitle}>
          评估时间：{finished_at ? new Date(finished_at).toLocaleString("zh-CN") : "-"}
        </div>

        <div className={s.threeColLayout}>
          <div className={`${s.panel} ${s.metricsCol}`}>
            <div className={s.metricCard}>
              <div className={s.metricTitle}>心理健康指数</div>
              <div className={s.metricCircle}>
                <Progress
                  type="circle"
                  percent={derivedIndex || 0}
                  strokeColor={levelColors[derivedLevel] || "#1890ff"}
                  width={150}
                  strokeWidth={10}
                  format={(percent) => (
                    <div className={s.indexContent}>
                      <div className={s.indexValue}>{percent}</div>
                      <div className={s.indexLabel}>{derivedLevel}</div>
                    </div>
                  )}
                />
              </div>
              <div className={s.metricDesc}>{"综合评估教师的心理健康状态\n基于十维度加权计算"}</div>
            </div>
          </div>

          <div className={s.panel}>
            {tableRows.length > 0 ? (
              <table className={s.scoreTable}>
                <thead>
                  <tr>
                    <th>维度</th>
                    <th>得分</th>
                    <th>等级</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, index) => (
                    <tr key={`${row.label}-${index}`}>
                      <td>{row.label}</td>
                      <td>{row.score ? row.score.toFixed(2).replace(/\.00$/, "") : "-"}</td>
                      <td>
                        <Tag color={levelColors[row.level] || "blue"}>{row.level}</Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty description="暂无数据" />
            )}
          </div>

          <div className={`${s.panel} ${s.radarCol}`}>
            <RadarChart domainAvg={radarData} />
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <Card title="预警提示" className={s.warningCard}>
          {warnings.map((warning, index) => (
            <div key={index} className={s.warningItem}>
              <Tag color={warning.level === "一级预警" ? "red" : warning.level === "二级预警" ? "orange" : "blue"}>
                {warning.level}
              </Tag>
              <span>{warning.message}</span>
            </div>
          ))}
        </Card>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="优势领域" className={s.strengthCard}>
            {strengths.length > 0 ? (
              <ul className={s.list}>
                {strengths.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="关注领域" className={s.concernCard}>
            {concerns.length > 0 ? (
              <ul className={s.list}>
                {concerns.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
      </Row>

      {suggestions.length > 0 && (
        <Card title="专业建议" className={s.suggestionCard}>
          <ol className={s.suggestionList}>
            {suggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
};

export default TeacherResultsSection;
