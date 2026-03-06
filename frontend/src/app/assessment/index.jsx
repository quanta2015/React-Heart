import React, { useState, useEffect, useRef } from "react";
import { Card, Button, Spin, message, Progress, Radio } from "antd";
import { useNavigate, useLocation } from "react-router-dom";
import { post } from "@/util/request";
import * as urls from "@/constant/urls";
import token from "@/util/token";
import s from "./index.module.less";

const Assessment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hasSubmittedRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testId, setTestId] = useState(null);
  const [items, setItems] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [progress, setProgress] = useState(0);

  // 从路由 state 获取测试数据
  useEffect(() => {
    const state = location.state;
    if (!state?.testId || !state?.items) {
      message.error("测试数据无效，请重新开始测试");
      navigate("/");
      return;
    }
    setTestId(state.testId);
    setItems(state.items);
  }, [location.state, navigate]);

  // 更新进度
  useEffect(() => {
    if (items.length > 0) {
      const answeredCount = Object.keys(answers).length;
      setProgress(Math.round((answeredCount / items.length) * 100));
    }
  }, [answers, items]);

  // 处理答案选择
  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value
    }));
  };

  // 导航到上一题
  const handlePrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  // 导航到下一题
  const handleNext = () => {
    if (currentQuestion < items.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  // 跳转到指定题目
  const handleJumpTo = (index) => {
    setCurrentQuestion(index);
  };

  // 提交测试
  const handleSubmit = async () => {
    if (hasSubmittedRef.current) return;

    const answeredCount = Object.keys(answers).length;
    if (answeredCount < items.length) {
      message.warning(`您还有 ${items.length - answeredCount} 道题未作答，请完成后再提交`);
      return;
    }

    if (!window.confirm("确认提交测试吗？提交后将无法修改。")) {
      return;
    }

    try {
      setSubmitting(true);
      hasSubmittedRef.current = true;

      // 构建提交数据
      const submitData = {
        test_id: testId,
        answers: items.map((item) => ({
          item_id: item.id,
          answer: answers[item.id]
        }))
      };

      const res = await post(urls.API_STUDENT_TEST_SUBMIT, submitData);

      if (res.code === 200) {
        message.success("测试提交成功！");
        // 设置标记，告诉 index 页面需要刷新结果
        localStorage.setItem("test_submit_done", "1");
        navigate("/");
      } else {
        message.error(res.message || "提交失败");
        hasSubmittedRef.current = false;
      }
    } catch (err) {
      console.error("提交测试失败:", err);
      message.error("提交失败，请稍后重试");
      hasSubmittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  // 随机生成所有答案
  const handleRandomFill = () => {
    if (!window.confirm("确认要随机填充所有答案吗？这将覆盖当前已选择的答案。")) {
      return;
    }
    const randomAnswers = {};
    items.forEach((item) => {
      randomAnswers[item.id] = Math.floor(Math.random() * 5) + 1;
    });
    setAnswers(randomAnswers);
    message.success("已随机填充所有答案");
  };

  // 获取当前题目
  const currentQ = items[currentQuestion];
  const domainKey = currentQ?.domain ? currentQ.domain.replace(/\s/g, "") : "default";
  const domainClass = s[`domain_${domainKey}`] || s.domain_default;

  // 加载中
  if (!items.length) {
    return (
      <div className={s.loading}>
        <Spin size="large" tip="加载题目中..." />
      </div>
    );
  }

  return (
    <div className={s.assessment}>
      <Card
        title={`心理测评 - 第 ${currentQuestion + 1} / ${items.length} 题`}
        extra={<span style={{ fontSize: "14px", color: "#666" }}>进度：{progress}%</span>}
      >
        {/* 进度条 */}
        <Progress percent={progress} strokeColor={{ "0%": "#108ee9", "100%": "#87d068" }} />

        {/* 题目内容 */}
        <div className={s.question}>
          <div className={s.questionText}>
            <span className={`${s.questionNumber} ${domainClass}`}>{currentQ?.domain || "未知"}</span>
            <span className={s.questionContent}>{currentQ?.question}</span>
          </div>

          {/* 选项 */}
          <Radio.Group
            value={answers[currentQ?.id]}
            onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
            className={s.options}
          >
            <Radio value={1} className={s.optionRadio}>
              <span className={s.optionText}>非常不符合</span>
            </Radio>
            <Radio value={2} className={s.optionRadio}>
              <span className={s.optionText}>比较不符合</span>
            </Radio>
            <Radio value={3} className={s.optionRadio}>
              <span className={s.optionText}>不太确定</span>
            </Radio>
            <Radio value={4} className={s.optionRadio}>
              <span className={s.optionText}>比较符合</span>
            </Radio>
            <Radio value={5} className={s.optionRadio}>
              <span className={s.optionText}>非常符合</span>
            </Radio>
          </Radio.Group>
        </div>

        {/* 导航按钮 */}
        <div className={s.navigation}>
          <div className={s.navButtons}>
            <Button onClick={handlePrev} disabled={currentQuestion === 0}>
              上一题
            </Button>

            <Button type="primary" onClick={handleNext} disabled={currentQuestion >= items.length - 1}>
              下一题
            </Button>

            <Button onClick={handleRandomFill} disabled={items.length === 0}>
              随机填充答案
            </Button>
          </div>

          {/* 题目导航 - 只显示当前题目附近的题目 */}
          <div className={s.questionNav}>
            {items.map((_, index) => {
              const isAnswered = answers[items[index].id];
              const isCurrent = index === currentQuestion;
              // 只显示当前题目前后各 5 题，或者当前题目本身
              const shouldShow = Math.abs(index - currentQuestion) <= 5;
              if (!shouldShow && index !== 0 && index !== items.length - 1) {
                if (index === currentQuestion - 6 || index === currentQuestion + 6) {
                  return (
                    <span key={index} className={s.navEllipsis}>
                      ...
                    </span>
                  );
                }
                return null;
              }
              return (
                <button
                  key={index}
                  className={`${s.navBtn} ${isCurrent ? s.current : ""} ${isAnswered ? s.answered : s.unanswered}`}
                  onClick={() => handleJumpTo(index)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          {/* 提交按钮 - 只有当所有题目都答完后才显示 */}
          {Object.keys(answers).length >= items.length && (
            <div className={s.submitContainer}>
              <Button type="primary" danger size="large" onClick={handleSubmit} loading={submitting}>
                提交测试
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Assessment;
