下面是一份 **完整合并版《学校心理测评系统项目设计文档》**，把你前面两次讨论的内容统一整理为一份 **可直接用于项目立项 / 技术设计 / 开发说明的文档**。
技术栈：**React + Node.js + MySQL + ECharts**

---

# 一、项目概述

## 1.1 项目背景

为学校学生开展心理健康测评，通过心理量表与扩展题库综合评估学生心理状态。系统支持：

- 学生心理测评
- 学校教师统计分析
- 教育局宏观监管

系统输出心理风险等级（R0-R3）及六大心理维度分析。

---

# 二、系统角色设计

系统共有 **三类用户**

| 角色   | 功能                           |
| ------ | ------------------------------ |
| 学生   | 进行心理测评、查看结果         |
| 老师   | 查看学校统计、查看学生心理报告 |
| 教育局 | 查看各学校统计情况             |

---

# 三、系统总体架构

系统采用 **前后端分离架构**

```
React (前端)
      │
REST API
      │
Node.js (业务逻辑)
      │
MySQL (数据存储)
```

数据可视化：

```
ECharts
```

---

# 四、系统功能设计

# 4.1 学生端功能

学生登录后流程：

```
登录
  ↓
进入心理测评
  ↓
判断是否已测评
   ├─ 已测评 → 查看结果
   └─ 未测评 → 生成试卷
```

生成试卷：

```
标准量表题 76题
+
扩展题库 EXT5 74题
------------------
共150题
```

学生完成测评后：

- 自动计算心理评分
- 生成心理报告
- 显示六大心理维度

```
学习压力
焦虑
抑郁
自尊
社交
网络行为
```

同时生成风险等级：

```
R0 无风险
R1 轻度
R2 中度
R3 高风险
```

学生只能测评 **一次**

数据库约束：

```
UNIQUE(user_id)
```

---

# 五、老师端功能

老师进入系统可查看：

### 1 全校心理统计

统计指标：

- 完成率
- R0-R3分布
- 六维度平均分

可视化：

```
ECharts 柱状图
ECharts 折线图
```

---

### 2 年级统计

```
按年级统计
```

例如：

| 年级 | R0  | R1  | R2  | R3  |
| ---- | --- | --- | --- | --- |

---

### 3 班级统计

老师可选择：

```
年级 → 班级
```

查看班级心理状态。

---

### 4 学生详情

老师可点击某个学生查看：

学生心理报告：

```
风险等级
风险评分
六维度分析
```

示例：

```
学习压力 0.65
焦虑     0.54
抑郁     0.32
社交     0.41
网络行为 0.22
自尊     0.61
```

---

# 六、教育局功能

教育局用户可以查看：

```
各学校心理统计
```

统计指标：

- 各学校R3比例
- 各学校平均风险
- 各学校测评人数

示例：

| 学校 | 测评人数 | R3比例 | 平均风险 |
| ---- | -------- | ------ | -------- |

支持排序：

```
R3率
风险平均值
```

---

# 七、心理测评模型设计

系统采用：

```
国际标准量表 + 扩展题库
```

---

# 7.1 标准量表

| 量表          | 题数 |
| ------------- | ---- |
| PHQ9 抑郁     | 9    |
| GAD7 焦虑     | 7    |
| RSES 自尊     | 10   |
| UCLA 社交孤独 | 20   |
| PSS 压力      | 10   |
| IAT 网络行为  | 20   |

合计：

```
76题
```

---

# 7.2 扩展题库

类型：

```
EXT5
```

选项：

```
0 从不
1 很少
2 有时
3 经常
4 总是
```

抽题规则：

```
共74题
```

按domain抽取：

| domain   | 数量 |
| -------- | ---- |
| 学习压力 | 11   |
| 焦虑     | 11   |
| 抑郁     | 11   |
| 社交     | 11   |
| 网络行为 | 10   |
| 自尊     | 10   |
| 家庭关系 | 10   |

总计：

```
74
```

---

# 八、风险评分模型

每个维度计算：

```
domain_score = AVG(score) / max_score
```

总风险评分：

```
risk_score =
0.30 × 抑郁
0.25 × 焦虑
0.20 × 学习压力
0.15 × 社交
0.10 × 网络行为
```

---

# 风险等级

| 风险等级 | 条件      |
| -------- | --------- |
| R0       | <0.30     |
| R1       | 0.30-0.50 |
| R2       | 0.50-0.70 |
| R3       | ≥0.70     |

特殊规则：

如果

```
PHQ9-09 ≥3
```

则直接：

```
R3
```

---

# 九、数据库设计

系统核心表：

```
psych_users
psych_items
psych_tests
psych_answers
psych_results
scale_options
```

---

# 9.1 用户表

```
psych_users
```

学生信息直接包含：

```
grade
class_no
```

不建立班级表。

```sql
CREATE TABLE psych_users (
id BIGINT PRIMARY KEY AUTO_INCREMENT,
username VARCHAR(64) UNIQUE,
password_hash VARCHAR(255),
role ENUM('student','teacher','bureau'),
school_id BIGINT,
real_name VARCHAR(64),
grade INT,
class_no INT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

# 9.2 题库表

```
psych_items
```

```sql
CREATE TABLE psych_items (
id varchar(16) PRIMARY KEY,
type varchar(10),
question text,
domain varchar(32),
facet varchar(64),
reverse_scored tinyint(1),
options_json json
);
```

---

# 9.3 测评表

```
psych_tests
```

```sql
CREATE TABLE psych_tests (
test_id bigint AUTO_INCREMENT PRIMARY KEY,
user_id bigint,
version varchar(64),
started_at timestamp,
finished_at timestamp,
status enum('in_progress','finished'),
UNIQUE(user_id)
);
```

保证：

```
学生只能测一次
```

---

# 9.4 答案表

```
psych_answers
```

```sql
CREATE TABLE psych_answers (
test_id bigint,
item_id varchar(16),
answer tinyint,
score tinyint,
answered_at timestamp,
PRIMARY KEY(test_id,item_id)
);
```

---

# 9.5 结果表

```
psych_results
```

```sql
CREATE TABLE psych_results (
test_id bigint PRIMARY KEY,
risk_level enum('R0','R1','R2','R3'),
risk_score decimal(6,4),
domains_json json,
tags_json json,
created_at timestamp
);
```

---

# 9.6 量表选项表

```
scale_options
```

```sql
CREATE TABLE scale_options (
type varchar(10) PRIMARY KEY,
scale_name varchar(64),
time_window varchar(32),
min_score int,
max_score int,
options_json json
);
```

---

# 十、试卷生成算法

生成试卷流程：

```
1 生成 psych_tests
2 抽取标准量表 76题
3 EXT5抽取74题
4 返回150题
```

抽题 SQL 使用：

```
ROW_NUMBER()
RAND()
PARTITION BY domain
```

保证：

```
每个domain约10-11题
facet尽量分散
```

---

# 十一、结果计算流程

学生提交答案：

```
写入 psych_answers
```

然后：

```
计算 domain score
计算 risk_score
生成 risk_level
生成 tags
写入 psych_results
```

---

# 十二、统计分析 SQL

### 学校风险分布

```sql
SELECT risk_level, COUNT(*)
FROM psych_results
GROUP BY risk_level;
```

---

### 年级统计

```sql
SELECT grade, risk_level, COUNT(*)
FROM psych_results r
JOIN psych_tests t ON r.test_id=t.test_id
JOIN psych_users u ON u.id=t.user_id
GROUP BY grade,risk_level;
```

---

### 班级统计

```sql
SELECT class_no,risk_level,COUNT(*)
FROM psych_results r
JOIN psych_tests t ON r.test_id=t.test_id
JOIN psych_users u ON u.id=t.user_id
GROUP BY class_no,risk_level;
```

---

# 十三、前端页面设计

学生端：

```
登录
心理测评
心理报告
```

老师端：

```
统计看板
学生列表
学生详情
```

教育局：

```
学校统计
风险排行
```

---

# 十四、数据可视化设计

ECharts 图表：

### 学校统计

```
R0-R3堆叠柱状图
```

### 年级趋势

```
折线图
```

### 班级对比

```
热力图
```

### 学生报告

```
六维度雷达图
```

---

# 十五、安全与数据保护

措施：

- JWT认证
- 角色权限控制
- 学生仅能访问自己的结果
- 老师只能查看本校
- 教育局查看全区

---

# 十六、系统性能

预计规模：

```
学生 5000+
题库 3000+
答案 750000+
```

MySQL完全可支持。

---

# 十七、项目优势

本系统具备：

```
国际心理量表
扩展心理题库
风险预测模型
学校统计系统
教育局监管系统
```

适用于：

```
中学
大学
教育局
心理健康中心
```

---

如果需要，我可以再给你 **三部分非常关键的补充（真正上线级）**：

1️⃣ **完整 Node.js API 设计（30+接口）**
2️⃣ **React 页面结构 + ECharts 图表代码**
3️⃣ **心理报告自动生成模板（学生报告PDF）**

这三部分可以让你的系统 **直接上线运行**。
