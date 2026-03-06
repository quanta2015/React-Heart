// import React, { useEffect, useMemo, useRef } from "react";
// import { Progress, Tag, Alert } from "antd";
// import * as echarts from "echarts";
// import s from "./index.module.less";
// import { generatePsychSuggestion } from "@/util/suggestionEngine";

// const DOMAIN_NAME_MAP = {
//   academicstress: "学习压力",
//   depression: "抑郁",
//   anxiety: "焦虑",
//   selfesteem: "自尊",
//   social: "社交",
//   internet: "网络行为"
// };

// // 格式化日期为 YYYY年MM月DD日 HH:mm
// const formatDate = (dateString) => {
//   if (!dateString) return "-";
//   const date = new Date(dateString);
//   const year = date.getFullYear();
//   const month = String(date.getMonth() + 1).padStart(2, "0");
//   const day = String(date.getDate()).padStart(2, "0");
//   const hours = String(date.getHours()).padStart(2, "0");
//   const minutes = String(date.getMinutes()).padStart(2, "0");
//   return `${year}年${month}月${day}日 ${hours}:${minutes}`;
// };

// // 从标签解析维度风险等级
// const parseDomainRiskFromTags = (tags) => {
//   if (!tags || tags.length === 0) return {};

//   const riskMap = {};
//   tags.forEach((tag) => {
//     const parts = tag.split("_");
//     if (parts.length === 2) {
//       const domainEn = parts[0].toLowerCase();
//       const risk = parts[1].toLowerCase();
//       const domainCn = DOMAIN_NAME_MAP[domainEn] || domainEn;
//       riskMap[domainCn] = risk;
//     }
//   });

//   return riskMap;
// };

// // 渲染维度风险标签
// const renderRiskTag = (level) => {
//   const config = {
//     high: { color: "#ff4d4f", text: "高风险" },
//     medium: { color: "#faad14", text: "中风险" },
//     low: { color: "#52c41a", text: "低风险" }
//   };
//   const cfg = config[level] || { color: "#d9d9d9", text: "未知" };
//   return <Tag color={cfg.color}>{cfg.text}</Tag>;
// };

// // 渲染综合风险等级标签
// const renderOverallRiskTag = (level) => {
//   const config = {
//     R0: { color: "#52c41a", text: "低风险" },
//     R1: { color: "#1890ff", text: "轻度关注" },
//     R2: { color: "#faad14", text: "中度风险" },
//     R3: { color: "#ff4d4f", text: "高风险" }
//   };
//   const cfg = config[level] || { color: "#d9d9d9", text: level || "未知" };
//   return <Tag color={cfg.color}>{cfg.text}</Tag>;
// };

// const renderInterpretationLevelTag = (level) => {
//   const config = {
//     high: { color: "#ff4d4f", text: "高风险" },
//     medium: { color: "#faad14", text: "中风险" },
//     low: { color: "#52c41a", text: "低风险" }
//   };
//   const cfg = config[level] || { color: "#d9d9d9", text: "未知" };
//   return <Tag color={cfg.color}>{cfg.text}</Tag>;
// };

// const ResultsSection = ({ result }) => {
//   const radarRef = useRef(null);

//   const domainRisks = useMemo(() => {
//     return parseDomainRiskFromTags(result?.tags || result?.tags_json);
//   }, [result?.tags, result?.tags_json]);

//   const suggestion = useMemo(() => {
//     if (!result) return null;
//     return generatePsychSuggestion({
//       ...result,
//       domains_json: result?.domains_json || result?.domains || {},
//       tags_json: result?.tags_json || result?.tags || []
//     });
//   }, [result]);

//   useEffect(() => {
//     const domains = result?.domains || result?.domains_json;
//     if (!domains || !radarRef.current) return;

//     const chart = echarts.init(radarRef.current);

//     const domainNames = Object.keys(domains);
//     const indicators = domainNames.map((name) => ({
//       name,
//       max: 1
//     }));
//     const dataValues = domainNames.map((name) => domains[name]);

//     chart.setOption({
//       radar: {
//         indicator: indicators,
//         radius: "65%"
//       },
//       series: [
//         {
//           type: "radar",
//           data: [
//             {
//               value: dataValues,
//               name: "评估结果"
//             }
//           ],
//           areaStyle: {
//             color: "rgba(19, 182, 236, 0.3)"
//           },
//           lineStyle: {
//             color: "#13b6ec"
//           },
//           itemStyle: {
//             color: "#13b6ec"
//           }
//         }
//       ]
//     });

//     const handleResize = () => chart.resize();
//     window.addEventListener("resize", handleResize);

//     return () => {
//       window.removeEventListener("resize", handleResize);
//       chart.dispose();
//     };
//   }, [result]);

//   if (!result) return null;

//   const displayTime = result.finished_at || result.created_at;
//   const domains = result.domains || result.domains_json || {};
//   const domainNames = Object.keys(domains);

//   return (
//     <div className={s.resultsSection}>
//       <div className={s.sectionHeader}>
//         <h2 className={s.sectionTitle}>评测结果</h2>
//         <span className={s.updateTime}>更新于 {formatDate(displayTime)}</span>
//       </div>

//       <div className={s.resultCard}>
//         <div className={s.resultHeader}>
//           <div className={s.resultInfo}>
//             <div className={s.infoRow}>
//               <span className={s.infoLabel}>风险等级</span>
//               {renderOverallRiskTag(result.risk_level)}
//             </div>

//             <div className={s.infoRow}>
//               <span className={s.infoLabel}>风险分数</span>
//               <div className={s.scoreValue}>
//                 <Progress
//                   percent={Math.round((Number(result.risk_score) || 0) * 100)}
//                   strokeColor={{
//                     "0%": "#52c41a",
//                     "100%": "#ff4d4f"
//                   }}
//                   format={(percent) => `${percent}%`}
//                   style={{ marginBottom: 0 }}
//                 />
//               </div>
//             </div>

//             <div className={s.infoRow}>
//               <span className={s.infoLabel}>评测时间</span>
//               <span className={s.infoValue}>{formatDate(displayTime)}</span>
//             </div>
//           </div>
//         </div>

//         <div className={s.domainsSection}>
//           <h3 className={s.sectionSubTitle}>六维度评估结果</h3>

//           <div className={s.domainsContent}>
//             <div className={s.radarWrapper}>
//               <div ref={radarRef} className={s.radarChart} />
//             </div>

//             <div className={s.domainCards}>
//               {domainNames.map((domain) => {
//                 const risk = domainRisks[domain] || "unknown";
//                 return (
//                   <div key={domain} className={s.domainCard}>
//                     <span className={s.domainName}>{domain}</span>
//                     {renderRiskTag(risk)}
//                   </div>
//                 );
//               })}
//             </div>
//           </div>
//         </div>

//         {suggestion && (
//           <>
//             <div className={s.analysisSection}>
//               <h3 className={s.sectionSubTitle}>分析说明</h3>

//               <div className={s.summaryCard}>
//                 <div className={s.summaryHeader}>
//                   <span className={s.summaryLevel}>{suggestion.summary_level}</span>
//                   {renderOverallRiskTag(suggestion.risk_level)}
//                 </div>
//                 <div className={s.summaryTitle}>{suggestion.summary_title}</div>
//                 <div className={s.summaryContent}>{suggestion.summary_content}</div>

//                 {Array.isArray(suggestion.priority_domains) && suggestion.priority_domains.length > 0 && (
//                   <div className={s.priorityRow}>
//                     <span className={s.priorityLabel}>重点关注维度：</span>
//                     <div className={s.priorityTags}>
//                       {suggestion.priority_domains.map((item) => (
//                         <Tag key={item} color="processing">
//                           {item}
//                         </Tag>
//                       ))}
//                     </div>
//                   </div>
//                 )}
//               </div>

//               {suggestion.refer_required && (
//                 <Alert
//                   className={s.referAlert}
//                   type="warning"
//                   showIcon
//                   message="建议人工复核 / 专业转介"
//                   description="当前结果提示需要重点关注，建议由心理老师进一步访谈评估，并根据实际情况决定是否转介专业机构。"
//                 />
//               )}
//             </div>

//             <div className={s.analysisSection}>
//               <h3 className={s.sectionSubTitle}>建议措施</h3>

//               <div className={s.adviceGrid}>
//                 <div className={s.adviceBlock}>
//                   <div className={s.adviceTitle}>给学生的建议</div>
//                   <ul className={s.adviceList}>
//                     {(suggestion.student_advice || []).map((item, index) => (
//                       <li key={`student-${index}`}>{item}</li>
//                     ))}
//                   </ul>
//                 </div>

//                 <div className={s.adviceBlock}>
//                   <div className={s.adviceTitle}>给教师的建议</div>
//                   <ul className={s.adviceList}>
//                     {(suggestion.teacher_advice || []).map((item, index) => (
//                       <li key={`teacher-${index}`}>{item}</li>
//                     ))}
//                   </ul>
//                 </div>

//                 <div className={s.adviceBlock}>
//                   <div className={s.adviceTitle}>给家长的建议</div>
//                   <ul className={s.adviceList}>
//                     {(suggestion.parent_advice || []).map((item, index) => (
//                       <li key={`parent-${index}`}>{item}</li>
//                     ))}
//                   </ul>
//                 </div>
//               </div>
//             </div>

//             <div className={s.analysisSection}>
//               <h3 className={s.sectionSubTitle}>后续跟进</h3>

//               <div className={s.followupCard}>
//                 <div className={s.followupRow}>
//                   <span className={s.followupLabel}>建议动作</span>
//                   <div className={s.followupTags}>
//                     {(suggestion.actions || []).map((item, index) => (
//                       <Tag key={`action-${index}`} color="blue">
//                         {item}
//                       </Tag>
//                     ))}
//                   </div>
//                 </div>

//                 <div className={s.followupRow}>
//                   <span className={s.followupLabel}>建议复评周期</span>
//                   <span className={s.followupValue}>{suggestion.followup_days} 天内</span>
//                 </div>

//                 {Array.isArray(suggestion.matched_rules) && suggestion.matched_rules.length > 0 && (
//                   <div className={s.followupRow}>
//                     <span className={s.followupLabel}>命中规则</span>
//                     <div className={s.followupTags}>
//                       {suggestion.matched_rules.map((item) => (
//                         <Tag key={item}>{item}</Tag>
//                       ))}
//                     </div>
//                   </div>
//                 )}
//               </div>
//             </div>
//           </>
//         )}
//       </div>
//     </div>
//   );
// };

// export default ResultsSection;

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Progress, Tag, Alert, Button, message } from "antd";
import * as echarts from "echarts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import s from "./index.module.less";
import { generatePsychSuggestion } from "@/util/suggestionEngine";

const DOMAIN_NAME_MAP = {
  academicstress: "学习压力",
  depression: "抑郁",
  anxiety: "焦虑",
  selfesteem: "自尊",
  social: "社交",
  internet: "网络行为"
};

// 格式化日期为 YYYY年MM月DD日 HH:mm
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

// 从标签解析维度风险等级
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

// 渲染维度风险标签
const renderRiskTag = (level) => {
  const config = {
    high: { color: "#ff4d4f", text: "高风险" },
    medium: { color: "#faad14", text: "中风险" },
    low: { color: "#52c41a", text: "低风险" }
  };
  const cfg = config[level] || { color: "#d9d9d9", text: "未知" };
  return <Tag color={cfg.color}>{cfg.text}</Tag>;
};

// 渲染综合风险等级标签
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

const renderInterpretationLevelTag = (level) => {
  const config = {
    high: { color: "#ff4d4f", text: "高风险" },
    medium: { color: "#faad14", text: "中风险" },
    low: { color: "#52c41a", text: "低风险" }
  };
  const cfg = config[level] || { color: "#d9d9d9", text: "未知" };
  return <Tag color={cfg.color}>{cfg.text}</Tag>;
};

const ResultsSection = ({ result, user }) => {
  const radarRef = useRef(null);
  const exportRef = useRef(null);
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

  useEffect(() => {
    const domains = result?.domains || result?.domains_json;
    if (!domains || !radarRef.current) return;

    const chart = echarts.init(radarRef.current);

    const domainNames = Object.keys(domains);
    const indicators = domainNames.map((name) => ({
      name,
      max: 1
    }));
    const dataValues = domainNames.map((name) => domains[name]);

    chart.setOption({
      radar: {
        indicator: indicators,
        radius: "65%"
      },
      series: [
        {
          type: "radar",
          data: [
            {
              value: dataValues,
              name: "评估结果"
            }
          ],
          areaStyle: {
            color: "rgba(19, 182, 236, 0.3)"
          },
          lineStyle: {
            color: "#13b6ec"
          },
          itemStyle: {
            color: "#13b6ec"
          }
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

  // const handleExportPdf = async () => {
  //   if (!exportRef.current || !result) return;

  //   try {
  //     setExporting(true);

  //     const element = exportRef.current;

  //     const canvas = await html2canvas(element, {
  //       scale: 2,
  //       useCORS: true,
  //       backgroundColor: "#ffffff",
  //       scrollY: -window.scrollY
  //     });

  //     const imgData = canvas.toDataURL("image/jpeg", 1.0);

  //     // const pdf = new jsPDF("p", "mm", "a4");
  //     const pdf = new jsPDF();
  //     const pdfWidth = pdf.internal.pageSize.getWidth();
  //     const pdfHeight = pdf.internal.pageSize.getHeight();

  //     const imgWidth = pdfWidth;
  //     const imgHeight = (canvas.height * imgWidth) / canvas.width;

  //     let heightLeft = imgHeight;
  //     let position = 0;

  //     pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
  //     heightLeft -= pdfHeight;

  //     while (heightLeft > 0) {
  //       position = heightLeft - imgHeight;
  //       pdf.addPage();
  //       pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
  //       heightLeft -= pdfHeight;
  //     }

  //     const displayTime = result.finished_at || result.created_at;
  //     const fileName = `评测结果_${formatDate(displayTime)
  //       .replace(/[年月]/g, "-")
  //       .replace(/[日]/g, "")
  //       .replace(" ", "_")
  //       .replace(":", "-")}.pdf`;

  //     pdf.save(fileName);
  //     message.success("PDF 导出成功");
  //   } catch (error) {
  //     console.error("导出 PDF 失败:", error);
  //     message.error("PDF 导出失败，请稍后重试");
  //   } finally {
  //     setExporting(false);
  //   }
  // };

  const handleExportPdf = async () => {
    if (!exportRef.current || !result) return;

    try {
      setExporting(true);

      const element = exportRef.current;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        scrollY: -window.scrollY
      });

      const imgData = canvas.toDataURL("image/jpeg", 1.0);

      // 图片尺寸
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // jsPDF 使用 px 单位
      const pdf = new jsPDF({
        orientation: "p",
        unit: "px",
        format: [imgWidth, imgHeight]
      });

      pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);

      const displayTime = result.finished_at || result.created_at;

      const fileName = `评测结果_${formatDate(displayTime)
        .replace(/[年月]/g, "-")
        .replace(/[日]/g, "")
        .replace(" ", "_")
        .replace(":", "-")}.pdf`;

      pdf.save(fileName);

      message.success("PDF 导出成功");
    } catch (error) {
      console.error("导出 PDF 失败:", error);
      message.error("PDF 导出失败");
    } finally {
      setExporting(false);
    }
  };

  if (!result) return null;

  console.log("结果数据:", user, result);

  const displayTime = result.finished_at || result.created_at;
  const domains = result.domains || result.domains_json || {};
  const domainNames = Object.keys(domains);

  return (
    <div className={s.resultsSection}>
      <div className={s.sectionHeader}>
        <div>
          <h2 className={s.sectionTitle}>评测结果</h2>
          <span className={s.updateTime}>更新于 {formatDate(displayTime)}</span>
        </div>

        <Button type="primary" onClick={handleExportPdf} loading={exporting}>
          导出 PDF
        </Button>
      </div>

      <div ref={exportRef} className={s.exportContainer}>
        <div className={s.resultCard}>
          <div className={s.resultHeader}>
            <div className={s.resultInfo}>
              <div className={s.infoRow}>
                <span className={s.infoLabel}>学生姓名：</span>
                <span className={s.infoValue}>{result.student_name}</span>
              </div>

              <div className={s.infoRow}>
                <span className={s.infoLabel}>风险等级</span>
                {renderOverallRiskTag(result.risk_level)}
              </div>

              <div className={s.infoRow}>
                <span className={s.infoLabel}>风险分数</span>
                <div className={s.scoreValue}>
                  <Progress
                    percent={Math.round((Number(result.risk_score) || 0) * 100)}
                    strokeColor={{
                      "0%": "#52c41a",
                      "100%": "#ff4d4f"
                    }}
                    format={(percent) => `${percent}%`}
                    style={{ marginBottom: 0 }}
                  />
                </div>
              </div>

              <div className={s.infoRow}>
                <span className={s.infoLabel}>评测时间</span>
                <span className={s.infoValue}>{formatDate(displayTime)}</span>
              </div>
            </div>
          </div>

          <div className={s.domainsSection}>
            <h3 className={s.sectionSubTitle}>六维度评估结果</h3>

            <div className={s.domainsContent}>
              <div className={s.radarWrapper}>
                <div ref={radarRef} className={s.radarChart} />
              </div>

              <div className={s.domainCards}>
                {domainNames.map((domain) => {
                  const risk = domainRisks[domain] || "unknown";
                  return (
                    <div key={domain} className={s.domainCard}>
                      <span className={s.domainName}>{domain}</span>
                      {renderRiskTag(risk)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {suggestion && (
            <>
              <div className={s.analysisSection}>
                <h3 className={s.sectionSubTitle}>分析说明</h3>

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

              <div className={s.analysisSection}>
                <h3 className={s.sectionSubTitle}>建议措施</h3>

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

              <div className={s.analysisSection}>
                <h3 className={s.sectionSubTitle}>后续跟进</h3>

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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultsSection;
