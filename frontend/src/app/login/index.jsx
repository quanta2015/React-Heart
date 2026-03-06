import React, { useState, useCallback } from "react";
import { Form, Input, Button, message, Typography, Card } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { post } from "@/util/request";
import token from "@/util/token.js";
import * as urls from "@/constant/urls";
import s from "./index.module.less";
// jotai 状态管理
import { useSetAtom } from "jotai";
import { isLoginAtom, currentUserAtom } from "@/app/store/auth";

const { Title, Text } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // 全局状态更新
  const setIsLogin = useSetAtom(isLoginAtom);
  const setCurrentUser = useSetAtom(currentUserAtom);

  // 登录处理
  const handleLogin = useCallback(
    async (values) => {
      const { username, password } = values;

      setLoading(true);
      try {
        const res = await post(urls.API_LOGIN, { username, password });

        // 后端响应格式：{ code: 200, data: { token, user } }
        if (res.code === 200 && res.data) {
          const { token: jwtToken, user } = res.data || {};

          if (!user) {
            message.error("登录响应格式错误");
            setLoading(false);
            return;
          }

          // 保存 token 和用户信息到 localStorage
          token.saveUser({ token: jwtToken, ...user });

          // 更新全局状态
          setIsLogin(true);
          setCurrentUser(user);

          // 调试日志
          console.log("登录成功，用户信息:", user);

          message.success("登录成功");

          // 所有角色都跳转到首页，由首页根据角色和状态显示不同内容
          navigate("/");
        } else {
          message.error(res.message || "登录失败");
        }
      } catch (err) {
        console.error("登录错误:", err);
        message.error(err.response?.data?.message || "网络错误，请稍后重试");
      } finally {
        setLoading(false);
      }
    },
    [navigate, setIsLogin, setCurrentUser]
  );

  return (
    <div className={s.login}>
      <Card className={s.loginCard}>
        <div className={s.header}>
          <Title level={2} style={{ marginBottom: 8 }}>
            心理健康测评系统
          </Title>
          <Text type="secondary">请输入账号密码登录</Text>
        </div>

        <Form form={form} name="loginForm" onFinish={handleLogin} autoComplete="off" layout="vertical" size="large">
          <Form.Item
            name="username"
            rules={[
              { required: true, message: "请输入用户名" },
              { min: 2, message: "用户名至少 2 个字符" }
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" allowClear />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: "请输入密码" },
              { min: 4, message: "密码至少 4 个字符" }
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" allowClear />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block style={{ height: 44 }}>
              登录
            </Button>
          </Form.Item>
        </Form>

        <div className={s.footer}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            学生/教师/教育局管理员使用统一入口登录
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Login;
