下面给你三块内容：**完整 Node.js API 设计**、**React 页面结构**、**心理报告自动生成模板**（学生/老师视角均可用）。我按你现有表：`psych_items/psych_tests/psych_answers/psych_results/scale_options` 来设计，并补一个 `psych_users`（含 school_id/role/grade/class_no）用于权限与统计；不建班级表。

---

## 1) 完整 Node.js API 设计（REST + JWT + RBAC）

### 1.1 通用约定

- Base：`/api/v1`
- 鉴权：`Authorization: Bearer <JWT>`
- 角色：`student | teacher | bureau`
- 错误码建议：
  - `401` 未登录
  - `403` 无权限
  - `409` 冲突（比如学生已测评）
  - `422` 参数错误

- 关键安全规则：
  - 学生只能访问自己的 test/result
  - 老师只能访问同 school_id 的学生数据
  - 教育局可访问其辖区/所有学校（看你后续如何绑定）

---

### 1.2 Auth（登录/当前用户）

**POST** `/auth/login`
请求：

```json
{ "username": "xxx", "password": "xxx" }
```

响应：

```json
{ "token": "jwt", "user": { "id": 1, "role": "student", "school_id": 101, "grade": 7, "class_no": 2 } }
```

**GET** `/auth/me`
响应：当前用户信息（用于前端路由守卫）

---

### 1.3 学生端（测评/结果）

**POST** `/student/test/generate`
用途：生成本次试卷（150题），并创建 `psych_tests`（确保只能一次）
逻辑：

1. 检查该 user_id 是否存在任何 `psych_tests`（建议 `UNIQUE(user_id)`）
2. 插入 `psych_tests(status=in_progress, version=...)`
3. 抽题：固定76 + EXT5抽74（你已有SQL）
4. 返回题目列表（含 options_json）

响应：

```json
{
  "test_id": 123,
  "items": [
    { "id":"PHQ9-01","type":"PHQ9","question":"...","domain":"抑郁","facet":"...","reverse_scored":0,"options":[...] }
  ]
}
```

**GET** `/student/test/current`
用途：学生刷新页面继续答题
逻辑：如果没有保存试卷明细表，必须“生成后缓存/保存”，否则无法保证同一 test 返回同一套题。
强烈建议你加 `psych_test_items` 保存试卷题目。若你暂时不加：就只能在后端缓存（不推荐）。
响应：同 generate

**POST** `/student/test/submit`
请求：

```json
{
  "test_id": 123,
  "answers": [
    { "item_id": "PHQ9-01", "answer": 2 },
    { "item_id": "GAD7-01", "answer": 1 }
  ]
}
```

服务端处理：

1. 校验 test 归属 & 状态 in_progress
2. 校验答案题目是否属于该试卷（推荐用 `psych_test_items`）
3. 批量写入 `psych_answers`（score用 max_score & reverse_scored计算）
4. 更新 `psych_tests(status=finished, finished_at=NOW())`
5. 计算 `psych_results`（risk_level / risk_score / domains_json / tags_json）
   响应：

```json
{ "ok": true, "result": { "risk_level":"R1","risk_score":0.43,"domains":{...},"tags":[...] } }
```

**GET** `/student/result`
用途：学生查看自己的结果
响应：同上 result + 建议文案（由模板引擎生成）

---

### 1.4 老师端（统计/学生详情）

**GET** `/teacher/stats/overview`
参数：`?grade=&class_no=`（可选）
返回：

```json
{
  "completion": { "finished": 860, "total_students": 1000, "rate": 0.86 },
  "risk_dist": { "R0": 300, "R1": 400, "R2": 130, "R3": 30 },
  "domain_avg": { "学习压力": 0.55, "焦虑": 0.42, "抑郁": 0.31, "自尊": 0.62, "社交": 0.48, "网络行为": 0.37 }
}
```

**GET** `/teacher/stats/by-grade`
返回：每个年级 risk 分布、均值（ECharts数据）

**GET** `/teacher/stats/by-class?grade=7`
返回：7年级每班风险分布/均值/完成率

**GET** `/teacher/students`
参数：`?grade=&class_no=&keyword=`
返回：学生列表 + 是否完成测评 + risk_level（若完成）

**GET** `/teacher/student/:studentId/result`
返回：该学生总结果 + 6方面结果（domains_json拆开）

> 老师权限：`teacher.school_id == student.school_id`

---

### 1.5 教育局端（学校统计）

**GET** `/bureau/schools`
返回：各校完成率、R3占比、均值、排名

**GET** `/bureau/schools/:schoolId`
返回：该校年级统计（可选下钻到班级，取决于教育局权限）

**GET** `/bureau/export/schools.csv`（可选）
导出统计CSV

---

### 1.6 管理/运维（可选但建议）

**POST** `/admin/items/import`（导入题库）
**GET** `/admin/health`（健康检查）
**GET** `/admin/version`（题库版本信息）

---

## 2) React 页面结构（路由 + 组件分层）

### 2.1 推荐目录结构

```
src/
  api/
    http.ts
    auth.ts
    student.ts
    teacher.ts
    bureau.ts
  pages/
    Login/
    student/
      AssessmentStart.tsx
      AssessmentForm.tsx
      Result.tsx
    teacher/
      Dashboard.tsx
      Students.tsx
      StudentDetail.tsx
    bureau/
      Schools.tsx
      SchoolDetail.tsx
  components/
    charts/
      RiskStackBar.tsx
      DomainRadar.tsx
      CompletionGauge.tsx
    ui/
      Layout.tsx
      ProtectedRoute.tsx
      Filters.tsx
  store/
    authStore.ts
  utils/
    normalize.ts
    format.ts
```

### 2.2 路由规划（React Router）

- `/login`
- `/student/assessment`（未测评→生成→答题）
- `/student/result`
- `/teacher/dashboard`
- `/teacher/students`
- `/teacher/student/:id`
- `/bureau/schools`
- `/bureau/schools/:id`

### 2.3 页面关键交互

#### 学生端 AssessmentStart

- 调 `/student/test/generate`
- 生成成功后进入 AssessmentForm

#### 学生端 AssessmentForm

- 150题分页（建议每页 10-15 题）
- 自动保存进度（localStorage 或后端草稿接口可选）
- 提交调用 `/student/test/submit`

#### 学生端 Result

- 总风险等级卡片
- 6维度雷达图（ECharts）
- 建议文案（模板输出）

#### 老师端 Dashboard

- 筛选：年级、班级
- 图表：
  - R0-R3堆叠柱
  - 六维度均值雷达/柱
  - 完成率仪表盘

#### 老师端 Students

- 表格：姓名/年级/班级/是否完成/risk_level
- 点击进入 StudentDetail

#### 教育局 Schools

- 学校列表 + 排名 + R3占比
- 点击进入 SchoolDetail

---

## 3) 心理报告自动生成模板（可直接用于前端渲染或后端生成PDF）

建议生成两套视图：

- 学生版（更温和、建议更偏自助资源）
- 教师版（更偏统计解读、行动建议）

### 3.1 报告数据输入结构（统一）

```json
{
  "student": { "name": "张三", "grade": 7, "class_no": 2 },
  "test": { "finished_at": "2026-03-05 10:21:00", "version": "ISWB-CN-v1" },
  "overall": { "risk_level": "R1", "risk_score": 0.43 },
  "domains": {
    "学习压力": 0.55,
    "焦虑": 0.42,
    "抑郁": 0.31,
    "自尊": 0.62,
    "社交": 0.48,
    "网络行为": 0.37
  },
  "tags": ["academicstress_medium", "anxiety_low", "selfesteem_high"]
}
```

### 3.2 学生版报告模板（纯文本/可渲染）

**标题**
学生心理测评报告

**基本信息**
姓名：{{name}}
年级/班级：{{grade}}年级 {{class_no}}班
测评时间：{{finished_at}}

**总体结果**
风险等级：{{risk_level}}
综合风险分：{{risk_score}}（0-1，越高表示需要更多关注）

**六方面结果**
学习压力：{{学习压力}}
焦虑：{{焦虑}}
抑郁：{{抑郁}}
自尊：{{自尊}}
社交：{{社交}}
网络行为：{{网络行为}}

**解释说明（按 risk_level 分支）**

- R0：当前未见明显风险信号，建议保持规律作息与学习节奏，遇到压力时及时与同学/家人沟通。
- R1：出现轻度关注信号，建议使用自助资源（运动、睡眠、时间管理、放松训练），并关注近两周情绪与压力变化。
- R2：存在中度风险信号，建议尽快与学校心理老师沟通或预约咨询，减少持续高压情境，必要时请监护人知情。
- R3：存在高风险信号，建议立即启动人工评估流程（学校心理老师/专门机构），如出现自伤相关想法请及时寻求紧急帮助。

**建议（按最高的两项 domain 自动生成）**
示例生成逻辑：找 domains 最大的前2项

- 若学习压力最高：建议：作业拆分、番茄钟、与老师沟通作业负荷；每天至少30分钟运动；睡前减少屏幕时间。
- 若焦虑最高：建议：呼吸放松、渐进肌肉放松、减少咖啡因；把担忧写下来并设定“担忧时间”。
- 若抑郁最高：建议：规律作息、每天小目标、保持社交；若持续两周以上情绪低落建议咨询。
- 若社交最高：建议：从小范围联系开始；参加一项社团/活动；如果被排挤/欺凌需及时告知老师。
- 若网络行为最高：建议：设定上网时间窗、睡前1小时不刷手机；把App移出首页；与家长/老师制定计划。
- 若自尊偏低：建议：记录每天3件做得好的事；减少自我贬低语言；尝试掌握一项可见进步的技能。

**免责声明**
本测评用于心理健康筛查与教育支持，不作为医学诊断依据。

---

### 3.3 教师版报告模板（面向老师）

增加：

- 重点关注项（Top2 domains）
- 同年级/班级对比（可选：如果你有统计数据）
- 行动建议：班级层面的干预（睡眠、作业量、同伴支持、网络管理）

---

### 3.4 生成方式建议

- 前端生成：直接用模板字符串渲染（最快上线）
- 后端生成 PDF：Node.js 用 `puppeteer` 把 HTML 渲染成 PDF（如你需要我也能给模板 HTML 版）
