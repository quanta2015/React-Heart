import React, { useEffect, useMemo, useRef, useState } from "react";
import { Progress, Tag, Alert, Button } from "antd";
import * as echarts from "echarts";
import s from "./index.module.less";
import { generatePsychSuggestion } from "@/util/suggestionEngine";
import { handleExportPdf } from "./exportPdf";

const DOMAIN_NAME_MAP = {
  academicstress: "学习压力",
  depression: "抑郁",
  anxiety: "焦虑",
  selfesteem: "自尊",
  social: "社交",
  internet: "网络行为"
};

const REPORT_TITLE = "心理测评报告";

const formatDate = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}年${month}月${day}日 ${hours}:${minutes}`;
};

const parseDomainRiskFromTags = (tags) => {
  if (!tags || tags.length === 0) return {};
  const riskMap = {};

  tags.forEach((tag) => {
    const parts = tag.split("_");
    if (parts.length === 2) {
      const domainEn = parts[0].toLowerCase();
      const risk = parts[1].toLowerCase();
      const domainCn = DOMAIN_NAME_MAP[domainEn] || domainEn;
      riskMap[domainCn] = risk;
    }
  });

  return riskMap;
};

const RISK_TEXT_MAP = {
  R0: "低风险",
  R1: "轻度关注",
  R2: "中度风险",
  R3: "高风险"
};

const RISK_CLASS_MAP = {
  R0: "low",
  R1: "notice",
  R2: "medium",
  R3: "high"
};

const renderRiskTag = (level) => {
  const config = {
    high: { color: "#ff4d4f", text: "高风险" },
    medium: { color: "#faad14", text: "中风险" },
    low: { color: "#52c41a", text: "低风险" }
  };
  const cfg = config[level] || { color: "#d9d9d9", text: "未知" };
  return <Tag color={cfg.color}>{cfg.text}</Tag>;
};

const renderOverallRiskTag = (level) => {
  const config = {
    R0: { color: "#52c41a", text: "低风险" },
    R1: { color: "#1890ff", text: "轻度关注" },
    R2: { color: "#faad14", text: "中度风险" },
    R3: { color: "#ff4d4f", text: "高风险" }
  };
  const cfg = config[level] || { color: "#d9d9d9", text: level || "未知" };
  return <Tag color={cfg.color}>{cfg.text}</Tag>;
};

const ReportHeader = ({ pageNo, schoolName }) => (
  <div className={s.reportHeader}>
    <div className={s.reportHeaderLeft}>{schoolName}</div>
    <div className={s.reportHeaderCenter}>{REPORT_TITLE}</div>
    <div className={s.reportHeaderRight}>第 {pageNo} 页</div>
  </div>
);

const ResultsSection = ({ result, user }) => {
  const radarRef = useRef(null);
  const reportRef = useRef(null);
  const exportRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  console.log(user, result);

  const domainRisks = useMemo(() => {
    return parseDomainRiskFromTags(result?.tags || result?.tags_json);
  }, [result?.tags, result?.tags_json]);

  const suggestion = useMemo(() => {
    if (!result) return null;
    return generatePsychSuggestion({
      ...result,
      domains_json: result?.domains_json || result?.domains || {},
      tags_json: result?.tags_json || result?.tags || []
    });
  }, [result]);

  useEffect(() => {
    const domains = result?.domains || result?.domains_json;
    if (!domains || !radarRef.current) return;

    const chart = echarts.init(radarRef.current);

    const domainNames = Object.keys(domains);
    const indicators = domainNames.map((name) => ({
      name,
      max: 1
    }));
    const dataValues = domainNames.map((name) => Number(domains[name] || 0));

    chart.setOption({
      radar: {
        indicator: indicators,
        radius: "62%",
        splitNumber: 4,
        axisName: {
          color: "#333",
          fontSize: 14
        },
        splitArea: {
          areaStyle: {
            color: ["#fafafa", "#fff"]
          }
        },
        splitLine: {
          lineStyle: {
            color: "#d9d9d9"
          }
        },
        axisLine: {
          lineStyle: {
            color: "#d9d9d9"
          }
        }
      },
      series: [
        {
          type: "radar",
          data: [
            {
              value: dataValues,
              name: "评估结果",
              areaStyle: {
                color: "rgba(24, 144, 255, 0.18)"
              },
              lineStyle: {
                color: "#1890ff",
                width: 2
              },
              itemStyle: {
                color: "#1890ff"
              }
            }
          ]
        }
      ]
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [result]);

  const handleExportPdfClick = async () => {
    if (!reportRef.current || !result) return;

    const pages = reportRef.current.querySelectorAll(`.${s.pdfPage}`);
    await handleExportPdf({ reportRef, result, suggestion, user, setExporting, pages });
  };

  if (!result) return null;

  const displayTime = result.finished_at || result.created_at;
  const domains = result.domains || result.domains_json || {};
  const domainNames = Object.keys(domains);
  const riskText = RISK_TEXT_MAP[result.risk_level] || "未知";
  const riskClass = RISK_CLASS_MAP[result.risk_level] || "default";
  const riskPercent = Math.round((Number(result.risk_score) || 0) * 100);

  return (
    <div className={s.resultsSection}>
      <div className={s.sectionHeader}>
        <Button type="primary" onClick={handleExportPdfClick} loading={exporting}>
          导出PDF
        </Button>
      </div>

      <div ref={reportRef} className={s.reportContainer}>
        {/* 封面 */}
        <div className={s.pdfPage}>
          <div className={s.coverPage}>
            <div className={s.coverTop}>{user?.school_name || "XX 学校"}</div>
            <div className={s.coverTitle}>{REPORT_TITLE}</div>
            <div className={s.coverSubTitle}>学生心理健康测评结果</div>

            <div className={s.coverInfoCard}>
              <div className={s.coverInfoRow}>
                <span>学生姓名</span>
                <span>{user?.real_name || "-"}</span>
              </div>
              <div className={s.coverInfoRow}>
                <span>测评时间</span>
                <span>{formatDate(displayTime)}</span>
              </div>
              <div className={s.coverInfoRow}>
                <span>综合风险等级</span>
                <span>{riskText}</span>
              </div>
            </div>

            <div className={`${s.coverRiskBadge} ${s[riskClass]}`}>{riskText}</div>

            <div className={s.coverFooter}>本报告仅供学校心理健康教育工作参考使用</div>
          </div>
        </div>

        {/* 第2页：测评结果 */}
        <div className={s.pdfPage}>
          <ReportHeader pageNo={2} schoolName={user?.school_name || "XX 学校"} />

          <div className={s.reportBody}>
            <div className={s.baseInfoCard}>
              <div className={s.baseInfoGrid}>
                <div>
                  <span>学生姓名：</span>
                  {user?.real_name || "-"}
                </div>
                <div>
                  <span>评测时间：</span>
                  {formatDate(displayTime)}
                </div>
                <div>
                  <span>综合风险：</span>
                  {renderOverallRiskTag(result.risk_level)}
                </div>
                <div>
                  <span>风险分数：</span>
                  {riskPercent}%
                </div>
              </div>
            </div>

            <div className={s.bigRiskSection}>
              <div className={s.bigRiskLabel}>综合风险等级</div>
              <div className={`${s.bigRiskValue} ${s[riskClass]}`}>{riskText}</div>
            </div>

            <div className={s.reportBlock}>
              <div className={s.blockTitle}>六维度评估结果</div>

              <div className={s.radarCenterSection}>
                <div ref={radarRef} className={s.reportRadarChart} />
              </div>

              <div className={s.domainGrid}>
                {domainNames.map((domain) => {
                  const risk = domainRisks[domain] || "unknown";
                  return (
                    <div key={domain} className={s.domainGridItem}>
                      <span className={s.domainGridName}>{domain}</span>
                      {renderRiskTag(risk)}
                    </div>
                  );
                })}
              </div>

              <div className={s.scoreBarRow}>
                <div className={s.scoreBarLabel}>风险分数</div>
                <div className={s.scoreBarWrap}>
                  <Progress
                    percent={riskPercent}
                    strokeColor={{
                      "0%": "#52c41a",
                      "100%": "#ff4d4f"
                    }}
                    format={(percent) => `${percent}%`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 第3页：分析与建议 */}
        {suggestion && (
          <div className={s.pdfPage}>
            <ReportHeader pageNo={3} schoolName={user?.school_name || "XX 学校"} />

            <div className={s.reportBody}>
              <div className={s.reportBlock}>
                <div className={s.blockTitle}>分析说明</div>

                <div className={s.summaryCard}>
                  <div className={s.summaryHeader}>
                    <span className={s.summaryLevel}>{suggestion.summary_level}</span>
                    {renderOverallRiskTag(suggestion.risk_level)}
                  </div>

                  <div className={s.summaryTitle}>{suggestion.summary_title}</div>
                  <div className={s.summaryContent}>{suggestion.summary_content}</div>

                  {Array.isArray(suggestion.priority_domains) && suggestion.priority_domains.length > 0 && (
                    <div className={s.priorityRow}>
                      <span className={s.priorityLabel}>重点关注维度：</span>
                      <div className={s.priorityTags}>
                        {suggestion.priority_domains.map((item) => (
                          <Tag key={item} color="processing">
                            {item}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {suggestion.refer_required && (
                  <Alert
                    className={s.referAlert}
                    type="warning"
                    showIcon
                    message="建议人工复核 / 专业转介"
                    description="当前结果提示需要重点关注，建议由心理老师进一步访谈评估，并根据实际情况决定是否转介专业机构。"
                  />
                )}
              </div>

              <div className={s.reportBlock}>
                <div className={s.blockTitle}>建议措施</div>

                <div className={s.adviceGrid}>
                  <div className={s.adviceBlock}>
                    <div className={s.adviceTitle}>给学生的建议</div>
                    <ul className={s.adviceList}>
                      {(suggestion.student_advice || []).map((item, index) => (
                        <li key={`student-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className={s.adviceBlock}>
                    <div className={s.adviceTitle}>给教师的建议</div>
                    <ul className={s.adviceList}>
                      {(suggestion.teacher_advice || []).map((item, index) => (
                        <li key={`teacher-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className={s.adviceBlock}>
                    <div className={s.adviceTitle}>给家长的建议</div>
                    <ul className={s.adviceList}>
                      {(suggestion.parent_advice || []).map((item, index) => (
                        <li key={`parent-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className={s.reportBlock}>
                <div className={s.blockTitle}>后续跟进</div>

                <div className={s.followupCard}>
                  <div className={s.followupRow}>
                    <span className={s.followupLabel}>建议动作</span>
                    <div className={s.followupTags}>
                      {(suggestion.actions || []).map((item, index) => (
                        <Tag key={`action-${index}`} color="blue">
                          {item}
                        </Tag>
                      ))}
                    </div>
                  </div>

                  <div className={s.followupRow}>
                    <span className={s.followupLabel}>建议复评周期</span>
                    <span className={s.followupValue}>{suggestion.followup_days} 天内</span>
                  </div>

                  {Array.isArray(suggestion.matched_rules) && suggestion.matched_rules.length > 0 && (
                    <div className={s.followupRow}>
                      <span className={s.followupLabel}>命中规则</span>
                      <div className={s.followupTags}>
                        {suggestion.matched_rules.map((item) => (
                          <Tag key={item}>{item}</Tag>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsSection;
