# 心理健康测评系统 - 项目设计文档

## 1. 项目概述

### 1.1 项目名称
心理健康测评系统 (Heart Health Assessment System)

### 1.2 项目简介
本项目是一个面向学校的学生心理健康测评系统，支持学生在线完成心理测评问卷，系统自动计算风险等级并生成评估报告。教师端提供班级/年级维度的统计分析功能，帮助学校及时发现和关注需要心理支持的学生。

### 1.3 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端框架 | React 18 + Vite |
| UI 组件库 | Ant Design 5.x |
| 状态管理 | Jotai |
| 路由 | React Router DOM 7.x |
| 图表 | ECharts 6.x |
| HTTP 客户端 | Axios |
| 样式 | Less + CSS Modules |
| 后端框架 | Node.js + Express 5.x |
| 数据库 | MySQL 8.x (mysql2) |
| 认证 | JWT (jsonwebtoken) |
| 文件上传 | Multer |

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         前端 (Frontend)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   登录页    │  │   学生端    │  │   教师端    │              │
│  │   Login     │  │  Student    │  │   Teacher   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│         │                │                │                      │
│         └────────────────┴────────────────┘                      │
│                          │                                       │
│                  ┌───────┴───────┐                              │
│                  │  Axios 请求层  │                              │
│                  └───────┬───────┘                              │
└──────────────────────────┼──────────────────────────────────────┘
                           │ HTTP/JSON
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                         后端 (Backend)                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Express Server                        │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │    │
│  │  │ Auth Routes │  │Student Routes│ │Teacher Routes│      │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │    │
│  │         │                │                │               │    │
│  │         └────────────────┴────────────────┘               │    │
│  │                          │                                │    │
│  │                  ┌───────┴───────┐                        │    │
│  │                  │ Auth Middleware│                       │    │
│  │                  │ (JWT Verify)  │                        │    │
│  │                  └───────┬───────┘                        │    │
│  └──────────────────────────┼────────────────────────────────┘    │
│                             │                                     │
│                     ┌───────┴───────┐                            │
│                     │  MySQL Pool   │                            │
│                     └───────┬───────┘                            │
└─────────────────────────────┼─────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   MySQL Database│
                    │   (psych_*)     │
                    └─────────────────┘
```

### 2.2 目录结构

```
heart/
├── backend/
│   ├── server.js              # Express 服务器入口
│   ├── db.js                  # MySQL 连接池配置
│   ├── package.json           # 后端依赖配置
│   ├── middleware/
│   │   └── auth.js            # JWT 认证中间件
│   └── routes/
│       ├── auth.js            # 认证路由 (登录/用户信息)
│       ├── student.js         # 学生端路由 (测评/结果)
│       └── teacher.js         # 教师端路由 (统计/学生列表)
│
└── frontend/
    ├── package.json           # 前端依赖配置
    ├── vite.config.js         # Vite 构建配置
    ├── index.html             # HTML 入口
    └── src/
        ├── main.jsx           # React 应用入口
        ├── App.jsx            # 根组件 (路由配置)
        ├── index.less         # 全局样式
        ├── var.less           # 样式变量
        ├── app/               # 页面组件
        │   ├── login/         # 登录页
        │   ├── index/         # 首页 (学生)
        │   ├── assessment/    # 测评页面
        │   ├── teacher/       # 教师仪表盘
        │   └── store/         # 全局状态 (Jotai)
        ├── component/         # 公共组件
        │   ├── Nav/           # 顶部导航
        │   ├── HelpModal/     # 帮助弹窗
        │   └── ResultsSection/# 结果展示组件
        ├── constant/          # 常量配置
        │   ├── apis.js        # API 服务器地址
        │   ├── urls.js        # API 路径常量
        │   ├── data.js        # 静态数据
        │   └── sugg.json      # 建议文案模板
        ├── util/              # 工具函数
        │   ├── request.js     # Axios 封装
        │   ├── token.js       # Token 管理
        │   ├── fn.js          # 通用函数
        │   ├── suggestionEngine.js  # 建议生成引擎
        │   ├── teacherReportPdf.js  # PDF 报告生成
        │   └── pdfFonts.js    # PDF 字体配置
        └── img/               # 静态图片资源
```

---

## 3. 数据库设计

### 3.1 核心数据表

#### 3.1.1 用户表 (psych_users)
| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT | 主键 |
| username | VARCHAR | 用户名 (唯一) |
| password | VARCHAR | 密码 (明文) |
| role | ENUM | 角色：student/teacher/bureau |
| school_id | INT | 学校 ID |
| school_name | VARCHAR | 学校名称 |
| real_name | VARCHAR | 真实姓名 |
| grade | INT | 年级 |
| class_no | INT | 班级 |

#### 3.1.2 量表题目表 (psych_items)
| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | VARCHAR | 题目 ID (如 PHQ9-01) |
| type | VARCHAR | 量表类型 (PHQ9/GAD7/RSES/UCLA/PSS/IAT/EXT5) |
| question | TEXT | 题目内容 |
| domain | VARCHAR | 所属维度 (学习压力/焦虑/抑郁等) |
| facet | VARCHAR | 子维度 |
| reverse_scored | TINYINT | 是否反向计分 |
| options_json | JSON | 选项配置 |

#### 3.1.3 量表选项表 (scale_options)
| 字段名 | 类型 | 说明 |
|--------|------|------|
| type | VARCHAR | 量表类型 |
| options_json | JSON | 选项配置 |
| max_score | INT | 最大分值 |

#### 3.1.4 测评记录表 (psych_tests)
| 字段名 | 类型 | 说明 |
|--------|------|------|
| test_id | INT | 主键 |
| user_id | INT | 用户 ID |
| version | VARCHAR | 题库版本 |
| status | ENUM | 状态：in_progress/finished |
| finished_at | DATETIME | 完成时间 |
| created_at | DATETIME | 创建时间 |

#### 3.1.5 答案记录表 (psych_answers)
| 字段名 | 类型 | 说明 |
|--------|------|------|
| test_id | INT | 测评 ID |
| item_id | VARCHAR | 题目 ID |
| answer | INT | 用户答案 |
| score | INT | 计算后的分数 |

#### 3.1.6 测评结果表 (psych_results)
| 字段名 | 类型 | 说明 |
|--------|------|------|
| test_id | INT | 测评 ID |
| risk_level | ENUM | 风险等级：R0/R1/R2/R3 |
| risk_score | DECIMAL | 风险分数 (0-1) |
| domains_json | JSON | 各维度得分 |
| tags_json | JSON | 风险标签 |
| created_at | DATETIME | 创建时间 |

---

## 4. API 接口设计

### 4.1 认证接口

#### POST /api/auth/login
用户登录
```json
// 请求
{ "username": "xxx", "password": "xxx" }

// 响应
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "jwt_token",
    "user": {
      "id": 1,
      "username": "xxx",
      "role": "student",
      "school_id": 101,
      "real_name": "张三",
      "grade": 7,
      "class_no": 2
    }
  }
}
```

#### GET /api/auth/me
获取当前用户信息 (需 Token)

### 4.2 学生端接口

#### GET /api/student/test/generate
生成试卷 (150 题)
```json
// 响应
{
  "code": 200,
  "data": {
    "test_id": 123,
    "items": [
      {
        "id": "PHQ9-01",
        "type": "PHQ9",
        "question": "做事时提不起劲或没有兴趣",
        "domain": "抑郁",
        "facet": "情绪低落",
        "reverse_scored": 0,
        "options_json": [...]
      }
    ]
  }
}
```

#### GET /api/student/test/current
获取当前进行中的试卷

#### POST /api/student/test/submit
提交答案
```json
// 请求
{
  "test_id": 123,
  "answers": [
    { "item_id": "PHQ9-01", "answer": 2 },
    { "item_id": "GAD7-01", "answer": 1 }
  ]
}
```

#### GET /api/student/result
获取测试结果

### 4.3 教师端接口

#### GET /api/teacher/stats/overview
获取统计概览 (完成率/风险分布/维度均值)

#### GET /api/teacher/stats/by-grade
按年级统计

#### GET /api/teacher/stats/by-class
按班级统计

#### GET /api/teacher/students
获取学生列表

#### GET /api/teacher/student/:studentId/result
获取指定学生结果

---

## 5. 前端架构设计

### 5.1 路由配置

```jsx
// App.jsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/" element={<Index />} />           // 学生首页
  <Route path="/student/assessment" element={<Assessment />} />
  <Route path="/teacher" element={<Teacher />} />  // 教师仪表盘
</Routes>
```

### 5.2 状态管理 (Jotai)

```jsx
// app/store/auth.js
export const isLoginAtom = atom(false);      // 登录状态
export const currentUserAtom = atom(null);   // 当前用户信息
```

### 5.3 请求封装

```jsx
// util/request.js
const service = axios.create({
  baseURL: "/api",
  timeout: 300000,
  withCredentials: false
});

// 请求拦截器：自动添加 Token
service.interceptors.request.use((config) => {
  const token = localStorage.getItem("AUTH_TOKEN");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一错误处理
service.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // 401: 清除 Token 并跳转登录页
    if (error.response?.status === 401) {
      localStorage.removeItem("AUTH_TOKEN");
      localStorage.removeItem("APP_USER");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
```

### 5.4 核心组件

#### 5.4.1 登录组件 (Login)
- 用户名/密码表单
- Token 存储与状态同步
- 登录成功后跳转首页

#### 5.4.2 测评组件 (Assessment)
- 题目展示 (单选)
- 进度条显示
- 题目导航 (前后跳转)
- 答案提交

#### 5.4.3 结果展示组件 (ResultsSection)
- 综合风险等级展示
- 六维度雷达图 (ECharts)
- 风险标签展示
- 建议措施生成
- PDF 导出功能

#### 5.4.4 教师仪表盘 (Teacher)
- 筛选条件 (年级/班级)
- 完成情况统计
- 风险等级分布
- 领域分布雷达图
- 学生列表表格
- 学生详情弹窗

---

## 6. 核心业务逻辑

### 6.1 抽题算法 (150 题)

```sql
-- 固定 76 题 (PHQ9/GAD7/RSES/UCLA/PSS/IAT) + EXT5 抽 74 题
-- EXT5 抽题规则：
-- 1. 每个 domain/facet 组合先选 1 题
-- 2. 按 domain 配额分配：
--    - 学习压力/焦虑/抑郁/社交：各 11 题
--    - 网络行为/自尊/家庭关系：各 10 题
```

### 6.2 风险等级计算

```javascript
// 风险分数计算权重
riskScore = 
  抑郁得分 * 0.30 +
  焦虑得分 * 0.25 +
  学习压力得分 * 0.20 +
  社交得分 * 0.15 +
  网络行为得分 * 0.10

// 风险等级判定
if (PHQ9-09 自杀意念题 answer >= 3) riskLevel = "R3"
else if (riskScore < 0.3) riskLevel = "R0"  // 低风险
else if (riskScore < 0.5) riskLevel = "R1"  // 轻度关注
else if (riskScore < 0.7) riskLevel = "R2"  // 中度风险
else riskLevel = "R3"                        // 高风险
```

### 6.3 维度风险标签

```javascript
// 根据维度得分生成标签
tags = {
  自尊：v < 0.5 ? "selfesteem_low" : v < 0.7 ? "selfesteem_medium" : "selfesteem_high",
  学习压力：v < 0.5 ? "academicstress_low" : v < 0.7 ? "academicstress_medium" : "academicstress_high",
  焦虑：v < 0.5 ? "anxiety_low" : v < 0.7 ? "anxiety_medium" : "anxiety_high",
  抑郁：v < 0.5 ? "depression_low" : v < 0.7 ? "depression_medium" : "depression_high",
  社交：v < 0.5 ? "social_low" : v < 0.7 ? "social_medium" : "social_high",
  网络行为：v < 0.5 ? "internet_low" : v < 0.7 ? "internet_medium" : "internet_high"
}
```

### 6.4 建议生成引擎

```javascript
// util/suggestionEngine.js
// 根据风险等级和维度得分生成个性化建议
generatePsychSuggestion(result) {
  return {
    summary_level: "轻度关注",
    summary_title: "整体心理状态基本良好...",
    summary_content: "...",
    priority_domains: ["学习压力", "焦虑"],
    refer_required: false,
    student_advice: ["建议 1", "建议 2", ...],
    teacher_advice: ["建议 1", "建议 2", ...],
    parent_advice: ["建议 1", "建议 2", ...],
    actions: ["定期随访", "心理访谈"],
    followup_days: 30,
    matched_rules: ["RULE_01", ...]
  }
}
```

---

## 7. 安全设计

### 7.1 认证机制
- JWT Token 认证，有效期 7 天
- Token 存储于 localStorage
- 请求头携带：`Authorization: Bearer <token>`

### 7.2 权限控制
- 学生只能访问自己的测评数据
- 教师只能访问本校学生数据
- 教育局可访问辖区所有学校数据

### 7.3 中间件实现
```javascript
// middleware/auth.js
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  const decoded = jwt.verify(token, JWT_SECRET);
  req.user = decoded;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    next();
  };
}
```

---

## 8. 部署配置

### 8.1 环境变量

```bash
# 后端环境变量
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=heart
JWT_SECRET=your_secret_key
PORT=3000
```

### 8.2 前端构建配置

```javascript
// vite.config.js
export default defineConfig({
  server: {
    sourcemap: true
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@app": path.resolve(__dirname, "src/app"),
      "@util": path.resolve(__dirname, "src/util"),
      "@constant": path.resolve(__dirname, "src/constant"),
      "@component": path.resolve(__dirname, "src/component")
    }
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "js/[name]-[hash].js",
        chunkFileNames: "js/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith(".css")) {
            return "css/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        }
      }
    }
  }
});
```

---

## 9. 开发指南

### 9.1 启动开发环境

```bash
# 后端
cd backend
npm install
npm run dev

# 前端
cd frontend
npm install
npm run dev
```

### 9.2 代码规范
- 前端使用 ESLint 进行代码检查
- 组件采用函数式写法 + Hooks
- 样式使用 Less + CSS Modules
- 文件命名：kebab-case (文件), camelCase (变量), PascalCase (组件)

---

## 10. 功能清单

### 10.1 学生端
- [x] 用户登录
- [x] 生成测评试卷 (150 题)
- [x] 在线答题 (支持跳转/暂存)
- [x] 提交答案
- [x] 查看测评结果
- [x] 导出 PDF 报告

### 10.2 教师端
- [x] 统计概览 (完成率/风险分布)
- [x] 年级/班级维度统计
- [x] 学生列表查询
- [x] 学生详情查看
- [x] 导出统计报告

### 10.3 待开发功能
- [ ] 教育局端功能
- [ ] 批量导入学生账号
- [ ] 测评历史记录
- [ ] 预警通知功能
- [ ] 移动端适配优化

---

## 11. 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0.0 | 2026-03 | 初始版本，完成核心测评功能 |

---

## 12. 联系方式

如有问题或建议，请联系开发团队。
