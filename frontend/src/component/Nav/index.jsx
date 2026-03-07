import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import cls from "classnames";
import s from "./index.module.less";
import logo from "@/img/logo.svg";
import token from "@/util/token";
import { Button, Modal } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import HelpModal from "@/component/HelpModal";

const Nav = () => {
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const user = token.loadUser();

  const handleLogout = () => {
    setOpen(true);
  };

  const confirmLogout = () => {
    token.clear();
    setOpen(false);
    nav("/login", { replace: true });
  };

  const handleLogoClick = () => {
    nav("/");
  };

  const handleHelpClick = () => {
    setHelpOpen(true);
  };

  return (
    <div className={s.nav}>
      {/* 左侧：系统图标和名称 */}
      <div className={s.left} onClick={handleLogoClick}>
        {/* <div className={s.logo}>
          <img src={logo} alt="Logo" />
        </div> */}
        <span className={s.title}>{isMobile ? "心理健康评测" : "学生心理健康测评"}</span>
      </div>

      {/* 右侧：用户信息 */}
      <div className={s.right}>
        <Button type="text" icon={<QuestionCircleOutlined />} onClick={handleHelpClick} className={s.helpBtn}>
          帮助
        </Button>
        {user ? (
          <div className={s.userInfo}>
            <span className={s.userName}>{user.real_name || user.username}</span>

            {!isMobile && (
              <span className={s.role}>
                ({user.role === "student" ? "学生" : user.role === "teacher" ? "教师" : "教育局"})
              </span>
            )}
            <Button type="primary" danger size="small" onClick={handleLogout}>
              退出
            </Button>
          </div>
        ) : (
          <Button type="primary" size="small" onClick={() => nav("/login")}>
            登录
          </Button>
        )}
      </div>

      {/* 退出确认弹窗 */}
      <Modal
        title="确认退出登录？"
        open={open}
        onOk={confirmLogout}
        onCancel={() => setOpen(false)}
        okText="确定"
        cancelText="取消"
        zIndex={2000}
      >
        退出后需要重新登录。
      </Modal>

      {/* 帮助信息弹窗 */}
      <HelpModal open={helpOpen} onCancel={() => setHelpOpen(false)} />
    </div>
  );
};

export default Nav;
