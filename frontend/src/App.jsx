import { Suspense, lazy, useState, useEffect, useCallback } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Spin } from "antd";
import token from "@/util/token";
import Nav from "@/component/Nav";

const Index = lazy(() => import("./app/index"));
const Login = lazy(() => import("./app/login"));
const Assessment = lazy(() => import("./app/assessment"));
const Manager = lazy(() => import("./app/manager"));

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
  const [userRole, setUserRole] = useState(null);
  const [checked, setChecked] = useState(false);

  // 检查登录状态及当前角色
  const getAuthState = useCallback(() => {
    const user = token.loadUser();
    const tok = token.get();
    const isAuthed = !!(user && tok);
    return {
      isAuthenticated: isAuthed,
      role: isAuthed ? user?.role || null : null
    };
  }, []);

  useEffect(() => {
    const state = getAuthState();
    setIsAuthenticated(state.isAuthenticated);
    setUserRole(state.role);
    setChecked(true);
  }, [getAuthState]);

  // 监听 auth-change 自定义事件（处理登录/登出）
  useEffect(() => {
    const handleAuthChange = (event) => {
      const next = event?.detail?.isAuthenticated;
      if (typeof next === "boolean") {
        setIsAuthenticated(next);
        if (!next) {
          setUserRole(null);
          return;
        }
        const state = getAuthState();
        setUserRole(state.role);
        return;
      }
      const state = getAuthState();
      setIsAuthenticated(state.isAuthenticated);
      setUserRole(state.role);
    };
    window.addEventListener("auth-change", handleAuthChange);
    return () => window.removeEventListener("auth-change", handleAuthChange);
  }, [getAuthState]);

  if (!checked) {
    return <Loading />;
  }

  return (
    <Router>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
          <Route
            path="/"
            element={
              isAuthenticated ? (
                userRole === "manager" ? (
                  <Navigate to="/manager" replace />
                ) : (
                  <Layout>
                    <Index />
                  </Layout>
                )
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
            path="/parent/assessment"
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
            path="/manager"
            element={
              isAuthenticated ? (
                <Layout>
                  <Manager />
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
