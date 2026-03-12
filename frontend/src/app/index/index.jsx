import React, { Suspense, lazy, useState, useEffect, useMemo } from "react";
import { Spin, message } from "antd";
import { useNavigate } from "react-router-dom";
import * as urls from "@/constant/urls";
import { get } from "@/util/request";
import token from "@/util/token";
import s from "./index.module.less";

const ResultsSection = lazy(() => import("@/component/ResultsSection"));
const ParentResultsSection = lazy(() => import("@/component/ParentResultsSection"));

const Index = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [testStatus, setTestStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const isStudent = currentUser?.role === "student";
  const isParent = currentUser?.role === "parent";

  const endpointMap = useMemo(
    () => ({
      current: isParent ? urls.API_PARENT_TEST_CURRENT : urls.API_STUDENT_TEST_CURRENT,
      generate: isParent ? urls.API_PARENT_TEST_GENERATE : urls.API_STUDENT_TEST_GENERATE,
      result: isParent ? urls.API_PARENT_RESULT : urls.API_STUDENT_RESULT,
      assessmentRoute: isParent ? "/parent/assessment" : "/student/assessment"
    }),
    [isParent]
  );

  useEffect(() => {
    const user = token.loadUser();
    console.log("Index 组件加载用户信息:", user);
    setCurrentUser(user);

    if (user?.role === "manager") {
      navigate("/manager", { replace: true });
    } else if (user?.role === "bureau") {
      message.info("教育局端功能开发中");
    }

    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    if (!isStudent && !isParent) return;

    const fetchResult = async () => {
      try {
        const res = await get(endpointMap.result, {}, { silentErrors: [404, 409] });
        console.log("获取测试结果响应:", res);

        if (res?.code === 200 && res?.data) {
          setResult(res.data);
          setTestStatus("finished");
        } else {
          setResult(null);
          setTestStatus(null);
        }
      } catch (err) {
        if (err.response?.status === 404 || err.response?.status === 409) {
          setResult(null);
          setTestStatus(null);
        } else {
          console.warn("获取结果失败:", err);
          setResult(null);
          setTestStatus(null);
        }
      }
    };

    fetchResult();
  }, [currentUser, refreshKey, isStudent, isParent, endpointMap.result]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setRefreshKey((prev) => prev + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    const submitDone = localStorage.getItem("test_submit_done");
    if (submitDone === "1") {
      localStorage.removeItem("test_submit_done");
      setRefreshKey((prev) => prev + 1);
    }
  }, []);

  const handleStartTest = async () => {
    try {
      setLoading(true);
      const res = await get(endpointMap.current);

      if (res.code === 200 && res.data?.items) {
        navigate(endpointMap.assessmentRoute, {
          state: { testId: res.data.test_id, items: res.data.items }
        });
      } else {
        const genRes = await get(endpointMap.generate);
        if (genRes.code === 200 && genRes.data?.items) {
          navigate(endpointMap.assessmentRoute, {
            state: { testId: genRes.data.test_id, items: genRes.data.items }
          });
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

  const resultsLoadingNode = (
    <div className={s.loading}>
      <Spin size="large" tip="报告加载中..." />
    </div>
  );

  return (
    <div className={s.container}>
      {loading && (
        <div className={s.loading}>
          <Spin size="large" tip="加载中..." />
        </div>
      )}

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

      {!loading && (isStudent || isParent) && (
        <div className={s.studentIndex}>
          <div className={s.welcomeBanner}>
            <p className={s.greeting}>{isParent ? "家长，您好！" : "同学，你好！"}</p>
            <p className={s.subtitle}>
              {isParent ? "完成家长心理测评，获取家庭教养与沟通建议" : "保持好心情，遇见更好的自己"}
            </p>
          </div>

          {testStatus === "finished" && result ? (
            isStudent ? (
              <div className={s.completedCard}>
                <div className={s.completedIcon}>✅</div>
                <h2 className={s.completedTitle}>测评已完成</h2>
                <p className={s.completedDesc}>
                  你已完成本次心理健康测评
                  <br />
                  测评结果将由学校心理老师进行专业分析
                </p>
              </div>
            ) : (
              <Suspense fallback={resultsLoadingNode}>
                <ParentResultsSection result={result} user={currentUser} />
              </Suspense>
            )
          ) : (
            <div className={s.assessmentCard}>
              <div className={s.cardImage}>
                <span className={s.psychologyIcon}></span>
              </div>
              <div className={s.cardContent}>
                <p className={s.cardTitle}>{isParent ? "开始家长心理测评" : "开始心理健康测评"}</p>
                <p className={s.cardDesc}>
                  共 150 题，预计耗时 20 分钟
                  <br />
                  {isParent ? "评估家庭心理环境与教养方式，获取专业建议" : "了解你的心理状态，获取专业指导"}
                </p>
                <button className={s.startBtn} onClick={handleStartTest}>
                  立即开始
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && currentUser && !isStudent && !isParent && (
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
