import React, { useEffect, useMemo, useRef, useState } from "react";
import { Progress, Tag, Alert, Button, Grid } from "antd";
import * as echarts from "echarts";
import s from "./index.module.less";
import { generatePsychSuggestion } from "@/util/suggEngineStudent";
import { handleExportPdf } from "./exportPdf";

const { useBreakpoint } = Grid;

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

const shortName = (name, max = 4) => {
  if (!name) return "";
  return name.length > max ? `${name.slice(0, max)}…` : name;
};

const ReportHeader = ({ pageNo, schoolName, isMobile }) => (
  <div className={`${s.reportHeader} ${isMobile ? s.reportHeaderMobile : ""}`}>
    <div className={s.reportHeaderLeft}>{schoolName}</div>
    <div className={s.reportHeaderCenter}>{REPORT_TITLE}</div>
    <div className={s.reportHeaderRight}>第 {pageNo} 页</div>
  </div>
);

const ResultsSection = ({ result, user }) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const radarRef = useRef(null);
  const reportRef = useRef(null);
  const chartRef = useRef(null);
  const [exporting, setExporting] = useState(false);

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

  const domains = result?.domains || result?.domains_json || {};
  const domainEntries = useMemo(() => Object.entries(domains || {}), [domains]);

  useEffect(() => {
    if (!radarRef.current || !domainEntries.length) return;

    const chart = echarts.init(radarRef.current);
    chartRef.current = chart;

    const indicators = domainEntries.map(([name]) => ({
      name: isMobile ? shortName(name, 4) : name,
      max: 1
    }));

    const dataValues = domainEntries.map(([, value]) => Number(value || 0));

    chart.setOption({
      animationDuration: 300,
      tooltip: {
        trigger: "item",
        confine: true,
        backgroundColor: "rgba(50,50,50,0.92)",
        borderWidth: 0,
        textStyle: {
          fontSize: isMobile ? 11 : 12
        },
        formatter() {
          return domainEntries.map(([name, value]) => `${name}：${Number(value || 0).toFixed(2)}`).join("<br/>");
        }
      },
      radar: {
        center: ["50%", isMobile ? "52%" : "54%"],
        radius: isMobile ? "58%" : "64%",
        splitNumber: isMobile ? 4 : 5,
        indicator: indicators,
        axisName: {
          color: "#333",
          fontSize: isMobile ? 10 : 14,
          width: isMobile ? 56 : 90,
          overflow: "truncate"
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
                width: isMobile ? 1.5 : 2
              },
              itemStyle: {
                color: "#1890ff"
              },
              symbol: "circle",
              symbolSize: isMobile ? 4 : 6
            }
          ]
        }
      ]
    });

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });

    resizeObserver.observe(radarRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [domainEntries, isMobile]);

  const handleExportPdfClick = async () => {
    if (!reportRef.current || !result) return;
    const pages = reportRef.current.querySelectorAll(`.${s.pdfPage}`);
    await handleExportPdf({ reportRef, result, suggestion, user, setExporting, pages });
  };

  if (!result) return null;

  const displayTime = result.finished_at || result.created_at;
  const domainNames = Object.keys(domains);
  const riskText = RISK_TEXT_MAP[result.risk_level] || "未知";
  const riskClass = RISK_CLASS_MAP[result.risk_level] || "default";
  const riskPercent = Math.round((Number(result.risk_score) || 0) * 100);

  return (
    <div className={`${s.resultsSection} ${isMobile ? s.mobileResultsSection : ""}`}>
      <div className={s.sectionHeader}>
        <Button
          type="primary"
          onClick={handleExportPdfClick}
          loading={exporting}
          block={isMobile}
          size={isMobile ? "large" : "middle"}
        >
          导出PDF
        </Button>
      </div>

      <div ref={reportRef} className={s.reportContainer}>
        <div className={s.pdfPage}>
          <div className={`${s.coverPage} ${isMobile ? s.coverPageMobile : ""}`}>
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

        <div className={s.pdfPage}>
          <ReportHeader pageNo={2} schoolName={user?.school_name || "XX 学校"} isMobile={isMobile} />

          <div className={s.reportBody}>
            <div className={s.baseInfoCard}>
              <div className={`${s.baseInfoGrid} ${isMobile ? s.baseInfoGridMobile : ""}`}>
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
                <div ref={radarRef} className={s.reportRadarChart} style={{ height: isMobile ? 220 : 320 }} />
              </div>

              {isMobile && domainEntries.length > 0 && (
                <div className={s.mobileDomainValueGrid}>
                  {domainEntries.map(([name, value]) => (
                    <div key={name} className={s.mobileDomainValueItem}>
                      <div className={s.mobileDomainValueName}>{name}</div>
                      <div className={s.mobileDomainValueScore}>{Number(value || 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className={`${s.domainGrid} ${isMobile ? s.domainGridMobile : ""}`}>
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

              <div className={`${s.scoreBarRow} ${isMobile ? s.scoreBarRowMobile : ""}`}>
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

        {suggestion && (
          <div className={s.pdfPage}>
            <ReportHeader pageNo={3} schoolName={user?.school_name || "XX 学校"} isMobile={isMobile} />

            <div className={s.reportBody}>
              <div className={s.reportBlock}>
                <div className={s.blockTitle}>分析说明</div>

                <div className={s.summaryCard}>
                  <div className={`${s.summaryHeader} ${isMobile ? s.summaryHeaderMobile : ""}`}>
                    <span className={s.summaryLevel}>{suggestion.summary_level}</span>
                    {renderOverallRiskTag(suggestion.risk_level)}
                  </div>

                  <div className={s.summaryTitle}>{suggestion.summary_title}</div>
                  <div className={s.summaryContent}>{suggestion.summary_content}</div>

                  {Array.isArray(suggestion.priority_domains) && suggestion.priority_domains.length > 0 && (
                    <div className={`${s.priorityRow} ${isMobile ? s.priorityRowMobile : ""}`}>
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

                <div className={`${s.adviceGrid} ${isMobile ? s.adviceGridMobile : ""}`}>
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
                  <div className={`${s.followupRow} ${isMobile ? s.followupRowMobile : ""}`}>
                    <span className={s.followupLabel}>建议动作</span>
                    <div className={s.followupTags}>
                      {(suggestion.actions || []).map((item, index) => (
                        <Tag key={`action-${index}`} color="blue">
                          {item}
                        </Tag>
                      ))}
                    </div>
                  </div>

                  <div className={`${s.followupRow} ${isMobile ? s.followupRowMobile : ""}`}>
                    <span className={s.followupLabel}>建议复评周期</span>
                    <span className={s.followupValue}>{suggestion.followup_days} 天内</span>
                  </div>

                  {Array.isArray(suggestion.matched_rules) && suggestion.matched_rules.length > 0 && (
                    <div className={`${s.followupRow} ${isMobile ? s.followupRowMobile : ""}`}>
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
