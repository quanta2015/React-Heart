import React, { useState, useEffect } from "react";
import { Card, Button, Spin, message, Descriptions, Tag, Progress } from "antd";
import { useNavigate } from "react-router-dom";
import * as urls from "@/constant/urls";
import { get } from "@/util/request";
import token from "@/util/token";
import s from "./index.module.less";

const Index = () => {
  const navigate = useNavigate();

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
        const res = await get(urls.API_STUDENT_RESULT);
        console.log("获取测试结果响应:", res);
        if (res.code === 200 && res.data) {
          setResult(res.data);
          setTestStatus("finished");
        } else {
          setTestStatus(null);
        }
      } catch (err) {
        if (err.response?.status === 404) {
          setTestStatus(null);
        } else {
          console.error("获取结果失败:", err);
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

  // 渲染风险等级标签
  const renderRiskTag = (level) => {
    const config = {
      R0: { color: "green", text: "低风险" },
      R1: { color: "blue", text: "轻度关注" },
      R2: { color: "orange", text: "中度风险" },
      R3: { color: "red", text: "高风险" }
    };
    const cfg = config[level] || { color: "default", text: level };
    return <Tag color={cfg.color}>{cfg.text}</Tag>;
  };

  // 加载中
  if (loading) {
    return (
      <div className={s.loading}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  // 未登录
  if (!currentUser) {
    return (
      <div className={s.otherIndex}>
        <Card title="未登录">
          <p>请先登录</p>
          <Button type="primary" onClick={() => navigate("/login")}>
            去登录
          </Button>
        </Card>
      </div>
    );
  }

  // 学生主页
  if (currentUser.role === "student") {
    return (
      <div className={s.studentIndex}>
        <Card title="心理健康测评" className={s.resultCard}>
          {testStatus === "finished" && result ? (
            <div className={s.resultContent}>
              <Descriptions title="测评结果" bordered column={2}>
                <Descriptions.Item label="风险等级">{renderRiskTag(result.risk_level)}</Descriptions.Item>
                <Descriptions.Item label="风险分数">
                  <Progress
                    percent={Math.round(result.risk_score * 100)}
                    strokeColor={{
                      "0%": "#52c41a",
                      "100%": "#ff4d4f"
                    }}
                    format={(percent) => percent + "%"}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="测评时间">{result.finished_at || result.created_at}</Descriptions.Item>
                <Descriptions.Item label="测评版本">{result.version || "ISWB-CN-v1"}</Descriptions.Item>
              </Descriptions>

              {result.domains && (
                <div className={s.domainsSection}>
                  <h3>六维度评估结果</h3>
                  <div className={s.domainsGrid}>
                    {Object.entries(result.domains).map(([domain, value]) => (
                      <Card key={domain} size="small" className={s.domainCard}>
                        <div className={s.domainName}>{domain}</div>
                        <Progress
                          percent={Math.round(value * 100)}
                          strokeColor={{
                            "0%": "#52c41a",
                            "100%": "#ff4d4f"
                          }}
                          format={(percent) => percent + "%"}
                        />
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {result.tags && result.tags.length > 0 && (
                <div className={s.tagsSection}>
                  <h3>评估标签</h3>
                  <div>
                    {result.tags.map((tag, idx) => (
                      <Tag key={idx} color="blue">
                        {tag}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={s.noTestContent}>
              <div className={s.noTestIcon}>📋</div>
              <h2>尚未进行测试</h2>
              <p className={s.noTestDesc}>请完成心理健康测评，共 150 道题目，预计用时 15-20 分钟</p>
              <Button type="primary" size="large" onClick={handleStartTest} className={s.startBtn}>
                开始测试
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // 教师/教育局主页
  return (
    <div className={s.otherIndex}>
      <Card title={`欢迎，${currentUser.real_name || currentUser.username || "用户"}`}>
        <p>角色：{currentUser.role || "未知"}</p>
        <p>学校 ID: {currentUser.school_id || "-"}</p>
      </Card>
    </div>
  );
};

export default Index;
