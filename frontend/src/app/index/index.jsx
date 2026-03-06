import React, { useState, useEffect, useRef } from "react";
import { Spin, message, Progress, Tag } from "antd";
import { useNavigate } from "react-router-dom";
import * as urls from "@/constant/urls";
import { get } from "@/util/request";
import token from "@/util/token";
import s from "./index.module.less";
import * as echarts from "echarts";

const Index = () => {
  const navigate = useNavigate();
  const radarRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [testStatus, setTestStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // 加载用户信息
  useEffect(() => {
    const user = token.loadUser();
    console.log("Index 组件加载用户信息:", user);
    setCurrentUser(user);

    // 教师用户重定向到教师仪表盘
    if (user?.role === "teacher") {
      navigate("/teacher", { replace: true });
    } else if (user?.role === "bureau") {
      // 教育局用户暂时重定向到首页
      message.info("教育局端功能开发中");
    }

    setLoading(false);
  }, [navigate]);

  // 获取测试结果（每次 refreshKey 变化或 currentUser 变化时重新获取）
  useEffect(() => {
    if (currentUser?.role !== "student") return;

    const fetchResult = async () => {
      try {
        // 使用 silentErrors 选项，404 和 409 时不显示错误提示
        const res = await get(urls.API_STUDENT_RESULT, {}, { silentErrors: [404, 409] });
        console.log("获取测试结果响应:", res);
        if (res?.code === 200 && res?.data) {
          setResult(res.data);
          setTestStatus("finished");
        } else {
          setResult(null);
          setTestStatus(null);
        }
      } catch (err) {
        // 404 表示没有测试结果，409 表示已完成测试，都是正常情况
        if (err.response?.status === 404 || err.response?.status === 409) {
          setResult(null);
          setTestStatus(null);
        } else {
          // 其他错误静默处理，不显示错误提示
          console.warn("获取结果失败:", err);
          setResult(null);
          setTestStatus(null);
        }
      }
    };

    fetchResult();
  }, [currentUser, refreshKey]);

  // 监听页面可见性变化（当从 assessment 页面返回时）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setRefreshKey((prev) => prev + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // 监听路由变化（当从 assessment 页面返回时）
  useEffect(() => {
    // 每次路由变化后，检查是否有提交完成的标记
    const submitDone = localStorage.getItem("test_submit_done");
    if (submitDone === "1") {
      localStorage.removeItem("test_submit_done");
      setRefreshKey((prev) => prev + 1);
    }
  }, []);

  // 初始化雷达图
  useEffect(() => {
    if (testStatus === "finished" && result?.domains && radarRef.current) {
      const chart = echarts.init(radarRef.current);

      const domains = result.domains;
      const domainNames = Object.keys(domains);
      const domainValues = domainNames.map((name) => ({
        name,
        max: 1
      }));

      const dataValues = domainNames.map((name) => domains[name]);

      chart.setOption({
        radar: {
          indicator: domainValues,
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

      return () => chart.dispose();
    }
  }, [testStatus, result]);

  // 开始测试
  const handleStartTest = async () => {
    try {
      setLoading(true);
      const res = await get(urls.API_STUDENT_TEST_CURRENT);

      if (res.code === 200 && res.data?.items) {
        navigate("/student/assessment", { state: { testId: res.data.test_id, items: res.data.items } });
      } else {
        const genRes = await get(urls.API_STUDENT_TEST_GENERATE);
        if (genRes.code === 200 && genRes.data?.items) {
          navigate("/student/assessment", { state: { testId: genRes.data.test_id, items: genRes.data.items } });
        } else {
          message.error("生成试卷失败");
        }
      }
    } catch (err) {
      console.error("开始测试失败:", err);
      if (err.response?.status === 409) {
        message.info("您已完成过测试，无法重新开始");
      } else {
        message.error("开始测试失败，请稍后重试");
      }
    } finally {
      setLoading(false);
    }
  };

  // 从标签解析维度风险等级
  const parseDomainRiskFromTags = (tags) => {
    if (!tags || tags.length === 0) return {};

    // 英文标签名到中文显示名的映射
    const domainNameMap = {
      academicstress: "学习压力",
      depression: "抑郁",
      anxiety: "焦虑",
      selfesteem: "自尊",
      social: "社交",
      internet: "网络行为"
    };

    const riskMap = {};
    tags.forEach((tag) => {
      // 标签格式：academicstress_medium, depression_low, anxiety_high
      const parts = tag.split("_");
      if (parts.length === 2) {
        const domainEn = parts[0].toLowerCase();
        const risk = parts[1].toLowerCase();
        // 将英文域名映射到中文显示名
        const domainCn = domainNameMap[domainEn] || domainEn;
        riskMap[domainCn] = risk;
      }
    });
    return riskMap;
  };

  // 渲染风险等级标签
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
    const cfg = config[level] || { color: "#d9d9d9", text: level };
    return <Tag color={cfg.color}>{cfg.text}</Tag>;
  };

  // 获取用户首字母作为头像
  const getUserAvatar = () => {
    if (currentUser?.real_name) {
      return currentUser.real_name.charAt(0).toUpperCase();
    }
    if (currentUser?.username) {
      return currentUser.username.charAt(0).toUpperCase();
    }
    return "U";
  };

  return (
    <div className={s.container}>
      {/* 加载中 */}
      {loading && (
        <div className={s.loading}>
          <Spin size="large" tip="加载中..." />
        </div>
      )}

      {/* 未登录 */}
      {!loading && !currentUser && (
        <div className={s.otherIndex}>
          <div className={s.noTestCard}>
            <div className={s.noTestIcon}>🔒</div>
            <h2 className={s.noTestTitle}>未登录</h2>
            <p className={s.noTestDesc}>请先登录系统</p>
            <button className={s.startBtn} onClick={() => navigate("/login")}>
              去登录
            </button>
          </div>
        </div>
      )}

      {/* 学生主页 */}
      {!loading && currentUser?.role === "student" && (
        <div className={s.studentIndex}>
          {/* Welcome Banner */}
          <div className={s.welcomeBanner}>
            <p className={s.greeting}>同学，你好！</p>
            <p className={s.subtitle}>保持好心情，遇见更好的自己</p>
          </div>

          {/* 有测试结果时显示详情 */}
          {testStatus === "finished" && result ? (
            <div className={s.resultsSection}>
              <div className={s.sectionHeader}>
                <h2 className={s.sectionTitle}>评测结果</h2>
                <span className={s.updateTime}>更新于 {result.finished_at || result.created_at || "-"}</span>
              </div>
              <div className={s.resultCard}>
                {/* 基本信息：风险等级、风险分数、评测时间 */}
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
                          percent={Math.round(result.risk_score * 100)}
                          strokeColor={{
                            "0%": "#52c41a",
                            "100%": "#ff4d4f"
                          }}
                          format={(percent) => percent + "%"}
                          style={{ marginBottom: 0 }}
                        />
                      </div>
                    </div>
                    <div className={s.infoRow}>
                      <span className={s.infoLabel}>评测时间</span>
                      <span className={s.infoValue}>{result.finished_at || result.created_at || "-"}</span>
                    </div>
                  </div>
                </div>

                {/* 六维度评估结果：左边雷达图，右边标签卡片 */}
                <div className={s.domainsSection}>
                  <h3 className={s.sectionSubTitle}>六维度评估结果</h3>
                  <div className={s.domainsContent}>
                    {/* 左边：雷达图 */}
                    <div className={s.radarWrapper}>
                      <div ref={radarRef} className={s.radarChart} />
                    </div>

                    {/* 右边：维度风险卡片 */}
                    <div className={s.domainCards}>
                      {(() => {
                        const domainRisks = parseDomainRiskFromTags(result.tags);
                        const domainNames = Object.keys(result.domains || {});
                        return domainNames.map((domain) => {
                          const risk = domainRisks[domain] || "unknown";
                          return (
                            <div key={domain} className={s.domainCard}>
                              <span className={s.domainName}>{domain}</span>
                              {renderRiskTag(risk)}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 无测试结果时显示开始测评卡片 */
            <>
              <div className={s.assessmentCard}>
                <div className={s.cardImage}>
                  <span className={s.psychologyIcon}>🧠</span>
                </div>
                <div className={s.cardContent}>
                  <p className={s.cardTitle}>开始心理健康测评</p>
                  <p className={s.cardDesc}>
                    共 150 题，预计耗时 20 分钟
                    <br />
                    了解你的心理状态，获取专业指导
                  </p>
                  <button className={s.startBtn} onClick={handleStartTest}>
                    立即开始
                  </button>
                </div>
              </div>

              <div className={s.resultsSection}>
                <div className={s.sectionHeader}>
                  <h2 className={s.sectionTitle}>往期结果</h2>
                  <span className={s.updateTime}>暂无数据</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 教师/教育局主页 */}
      {!loading && currentUser && currentUser.role !== "student" && (
        <div className={s.otherIndex}>
          <div className={s.noTestCard}>
            <div className={s.noTestIcon}>👋</div>
            <h2 className={s.noTestTitle}>欢迎，{currentUser.real_name || currentUser.username || "用户"}</h2>
            <p className={s.noTestDesc}>角色：{currentUser.role || "未知"}</p>
            <p className={s.noTestDesc}>学校 ID: {currentUser.school_id || "-"}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
