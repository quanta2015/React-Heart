import { Suspense, lazy, useState, useEffect, useCallback } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Spin } from "antd";
import token from "@/util/token";
import Nav from "@/component/Nav";

const Index = lazy(() => import("./app/index"));
const Login = lazy(() => import("./app/login"));
const Assessment = lazy(() => import("./app/assessment"));
const Teacher = lazy(() => import("./app/teacher"));

const Loading = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
    <Spin size="large" />
  </div>
);

// 带导航的布局组件
const Layout = ({ children }) => (
  <div style={{ minHeight: "100vh", background: "#f0f2f5" }}>
    <Nav />
    <div>{children}</div>
  </div>
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checked, setChecked] = useState(false);

  // 检查登录状态的函数
  const checkAuth = useCallback(() => {
    const user = token.loadUser();
    const tok = token.get();
    return !!(user && tok);
  }, []);

  useEffect(() => {
    setIsAuthenticated(checkAuth());
    setChecked(true);
  }, [checkAuth]);

  // 监听 auth-change 自定义事件（处理登录/登出）
  useEffect(() => {
    const handleAuthChange = () => {
      setIsAuthenticated(checkAuth());
    };
    window.addEventListener("auth-change", handleAuthChange);
    return () => window.removeEventListener("auth-change", handleAuthChange);
  }, [checkAuth]);

  if (!checked) {
    return <Loading />;
  }

  return (
    <Router>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <Layout>
                  <Index />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/student/assessment"
            element={
              isAuthenticated ? (
                <Layout>
                  <Assessment />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/teacher"
            element={
              isAuthenticated ? (
                <Layout>
                  <Teacher />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
