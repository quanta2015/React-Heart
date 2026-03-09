import React, { useState, useCallback, useMemo } from "react";
import { Form, Input, Button, message, Typography, Card } from "antd";
import { UserOutlined, LockOutlined, TeamOutlined, BookOutlined, HomeOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { post } from "@/util/request";
import token from "@/util/token.js";
import * as urls from "@/constant/urls";
import s from "./index.module.less";
import { useSetAtom } from "jotai";
import { isLoginAtom, currentUserAtom } from "@/app/store/auth";

const { Title, Text } = Typography;

const roleOptions = [
  {
    key: "student",
    label: "学生",
    desc: "参与学生心理测评，查看个人健康状态与反馈建议",
    icon: <BookOutlined />
  },
  {
    key: "teacher",
    label: "教师",
    desc: "管理学生测评任务，查看统计结果并开展干预工作",
    icon: <TeamOutlined />
  },
  {
    key: "parent",
    label: "家长",
    desc: "参与家长心理测评，评估家庭因素对孩子心理状态的影响",
    icon: <HomeOutlined />
  }
];

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState("student");
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const setIsLogin = useSetAtom(isLoginAtom);
  const setCurrentUser = useSetAtom(currentUserAtom);

  const currentRole = useMemo(() => {
    return roleOptions.find((item) => item.key === selectedRole) || roleOptions[0];
  }, [selectedRole]);

  const handleLogin = useCallback(
    async (values) => {
      const { username, password } = values;

      const preloadTargetPage = () =>
        selectedRole === "teacher" ? import("@/app/teacher") : import("@/app/index");
      preloadTargetPage().catch(() => {});

      setLoading(true);
      try {
        const res = await post(
          urls.API_LOGIN,
          {
            username,
            password,
            role: selectedRole
          },
          { skipGlobalError: true }
        );

        if (res.code === 200 && res.data) {
          const { token: jwtToken, user } = res.data || {};

          if (!user) {
            message.error("登录响应格式错误");
            setLoading(false);
            return;
          }

          const mergedUser = {
            ...user,
            role: user.role || user.userType || selectedRole
          };

          token.saveUser({
            token: jwtToken,
            ...mergedUser
          });

          setIsLogin(true);
          setCurrentUser(mergedUser);

          message.success(`登录成功`);

          // 先更新 App 组件的认证状态，再跳转
          window.dispatchEvent(
            new CustomEvent("auth-change", {
              detail: { isAuthenticated: true }
            })
          );

          navigate("/", { replace: true });
        } else {
          message.error(res.message || "登录失败");
        }
      } catch (err) {
        console.error("登录错误:", err);
        const errorMessage = err.response?.data?.message || "网络错误，请稍后重试";
        message.error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [navigate, selectedRole, currentRole.label, setIsLogin, setCurrentUser]
  );

  return (
    <div className={s.login}>
      <div className={s.bgGlowTop} />
      <div className={s.bgGlowBottom} />

      <Card className={s.loginCard}>
        <div className={s.loginLayout}>
          <div className={s.leftPanel}>
            <div className={s.header}>
              <div className={s.logoWrap}>
                <div className={s.logoBadge}>
                  <svg
                    className={s.logoMark}
                    viewBox="0 0 64 64"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-label="心理测评图标"
                    role="img"
                  >
                    <path d="M32 12C20.4 12 11 21.4 11 33V37C11 40.3 13.7 43 17 43H19V31H17C16.2 31 15.5 31.2 14.8 31.5C15.6 22.4 23 15 32 15C41 15 48.4 22.4 49.2 31.5C48.5 31.2 47.8 31 47 31H45V43H47C50.3 43 53 40.3 53 37V33C53 21.4 43.6 12 32 12Z" />
                    <path d="M24 31.5C24 27.9 26.9 25 30.5 25H33.5C37.1 25 40 27.9 40 31.5C40 34.5 37.9 37 35 37.7V40.5C35 42.4 33.4 44 31.5 44H30.5" />
                    <path d="M28.5 44L31 46.5L36 41.5" />
                  </svg>
                </div>
              </div>

              <Title level={2} className={s.title}>
                心理健康测评系统
              </Title>
              <Text className={s.subtitle}>请选择登录身份后输入账号密码</Text>
            </div>

            <div className={s.roleSection}>
              <div className={s.roleSectionHead}>
                <div className={s.roleSectionTitle}>选择用户身份</div>
                <div className={s.currentRoleText}>当前：{currentRole.label}</div>
              </div>

              <div className={s.roleList}>
                {roleOptions.map((role) => {
                  const active = selectedRole === role.key;

                  return (
                    <button
                      key={role.key}
                      type="button"
                      className={`${s.roleCard} ${active ? s.roleCardActive : ""}`}
                      onClick={() => setSelectedRole(role.key)}
                    >
                      <div className={s.roleIcon}>{role.icon}</div>

                      <div className={s.roleContent}>
                        <div className={s.roleTitleRow}>
                          <span className={s.roleTitle}>{role.label}</span>
                          {active ? <span className={s.roleTag}>已选</span> : null}
                        </div>
                        <span className={s.roleDesc}>{role.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={s.rightPanel}>
            <div className={s.formHeader}>
              <Text className={s.formTitle}>{currentRole.label}登录</Text>
              <Text className={s.formTip}>请输入账号和密码后登录系统</Text>
            </div>

            <Form form={form} name="loginForm" onFinish={handleLogin} autoComplete="off" layout="vertical" size="large">
              <Form.Item
                name="username"
                rules={[
                  { required: true, message: "请输入用户名" },
                  { min: 2, message: "用户名至少 2 个字符" }
                ]}
              >
                <Input prefix={<UserOutlined />} placeholder={`请输入${currentRole.label}用户名`} allowClear />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[
                  { required: true, message: "请输入密码" },
                  { min: 4, message: "密码至少 4 个字符" }
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" allowClear />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block>
                  登录
                </Button>
              </Form.Item>
            </Form>

            <div className={s.footer}>
              <Text className={s.footerText}>支持学生、教师、家长三种身份统一登录，家长登录后同样参与心理测评</Text>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Login;
