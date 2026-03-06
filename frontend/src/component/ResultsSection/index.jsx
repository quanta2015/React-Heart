import React, { useEffect, useMemo, useRef } from "react";
import { Progress, Tag } from "antd";
import * as echarts from "echarts";
import s from "./index.module.less";

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
    // 格式：academicstress_medium
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

const ResultsSection = ({ result }) => {
  const radarRef = useRef(null);

  const domainRisks = useMemo(() => {
    return parseDomainRiskFromTags(result?.tags);
  }, [result?.tags]);

  useEffect(() => {
    if (!result?.domains || !radarRef.current) return;

    const chart = echarts.init(radarRef.current);

    const domainNames = Object.keys(result.domains);
    const indicators = domainNames.map((name) => ({
      name,
      max: 1
    }));
    const dataValues = domainNames.map((name) => result.domains[name]);

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

  if (!result) return null;

  const displayTime = result.finished_at || result.created_at;
  const domainNames = Object.keys(result.domains || {});

  return (
    <div className={s.resultsSection}>
      <div className={s.sectionHeader}>
        <h2 className={s.sectionTitle}>评测结果</h2>
        <span className={s.updateTime}>更新于 {formatDate(displayTime)}</span>
      </div>

      <div className={s.resultCard}>
        <div className={s.resultHeader}>
          <div className={s.resultInfo}>
            <div className={s.infoRow}>
              <span className={s.infoLabel}>风险等级</span>
              {renderOverallRiskTag(result.risk_level)}
            </div>

            <div className={s.infoRow}>
              <span className={s.infoLabel}>风险分数</span>
              <div className={s.scoreValue}>
                <Progress
                  percent={Math.round((result.risk_score || 0) * 100)}
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
      </div>
    </div>
  );
};

export default ResultsSection;
