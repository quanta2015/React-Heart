
###  用户表（不建班级表）


## 1) Express 路由清单（总览）

* Auth

  * `POST /api/v1/auth/login`
  * `GET  /api/v1/auth/me`

* Student

  * `POST /api/v1/student/test/generate`
  * `GET  /api/v1/student/test/current`
  * `POST /api/v1/student/test/submit`
  * `GET  /api/v1/student/result`

* Teacher

  * `GET  /api/v1/teacher/stats/overview`
  * `GET  /api/v1/teacher/stats/by-grade`
  * `GET  /api/v1/teacher/stats/by-class?grade=7`
  * `GET  /api/v1/teacher/students?grade=&class_no=&keyword=`
  * `GET  /api/v1/teacher/student/:studentId/result`

* Bureau

  * `GET  /api/v1/bureau/schools`
  * `GET  /api/v1/bureau/schools/:schoolId`

---

## 2) Express + mysql2 代码骨架（可直接用）

### 2.1 db.js

```js
// db.js
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "liyangtom",
  database: process.env.MYSQL_DATABASE || "heart",
  connectionLimit: 10,
  charset: "utf8mb4",
});

module.exports = { pool };
```

### 2.2 auth middleware（示意）

```js
// middleware/auth.js
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "UNAUTHORIZED" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    next();
  } catch {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "UNAUTHORIZED" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "FORBIDDEN" });
    next();
  };
}

module.exports = { requireAuth, requireRole };
```

---

## 3) 核心 SQL：抽题（150题）+ 写入 psych_test_items

### 3.1 抽题SQL（固定76 + EXT5抽74，facet优先分散，domain配额10/11）

> 这段会返回 `item_id` 列表，用于插入 `psych_test_items`，然后再 JOIN 返回题目+options。

```sql
WITH
std AS (
  SELECT i.id
  FROM psych_items i
  WHERE i.type IN ('PHQ9','GAD7','RSES','UCLA','PSS','IAT')
),
ext_facet_one AS (
  SELECT id, domain, facet
  FROM (
    SELECT
      i.id, i.domain, i.facet,
      ROW_NUMBER() OVER (PARTITION BY i.domain, i.facet ORDER BY RAND()) AS rnf
    FROM psych_items i
    WHERE i.type='EXT5'
      AND i.domain IN ('学习压力','家庭关系','抑郁','焦虑','社交','网络行为','自尊')
  ) x
  WHERE x.rnf=1
),
ext_rank AS (
  SELECT
    e.id, e.domain,
    ROW_NUMBER() OVER (PARTITION BY e.domain ORDER BY RAND()) AS rn_dom
  FROM ext_facet_one e
),
ext_stage1 AS (
  SELECT id, domain
  FROM ext_rank
  WHERE
    ((domain IN ('学习压力','焦虑','抑郁','社交') AND rn_dom<=11)
     OR (domain IN ('网络行为','自尊','家庭关系') AND rn_dom<=10))
),
ext_cnt AS (
  SELECT domain, COUNT(*) AS c
  FROM ext_stage1
  GROUP BY domain
),
ext_stage2 AS (
  SELECT id
  FROM (
    SELECT
      i.id, i.domain,
      ROW_NUMBER() OVER (PARTITION BY i.domain ORDER BY RAND()) AS rn_fill
    FROM psych_items i
    LEFT JOIN ext_stage1 s ON s.id=i.id
    WHERE i.type='EXT5'
      AND i.domain IN ('学习压力','家庭关系','抑郁','焦虑','社交','网络行为','自尊')
      AND s.id IS NULL
  ) z
  JOIN ext_cnt c ON c.domain=z.domain
  WHERE z.rn_fill <= (
    CASE
      WHEN z.domain IN ('学习压力','焦虑','抑郁','社交') THEN 11 - c.c
      WHEN z.domain IN ('网络行为','自尊','家庭关系') THEN 10 - c.c
      ELSE 0
    END
  )
),
picked AS (
  SELECT id FROM std
  UNION ALL
  SELECT id FROM ext_stage1
  UNION ALL
  SELECT id FROM ext_stage2
)
SELECT id FROM picked;
```

---

## 4) 学生接口：生成试卷 / 获取当前试卷 / 提交 / 查看结果

### 4.1 `POST /student/test/generate`

**目标**：创建 `psych_tests`（一次性）→ 抽150题 → 写入 `psych_test_items` → 返回题目+选项

**关键 SQL：**

1. 创建测试（一次性约束靠 `uk_user_once`）

```sql
INSERT INTO psych_tests (user_id, version, status)
VALUES (?, 'ISWB-CN-v1', 'in_progress');
```

2. 插入试卷明细（批量）

```sql
INSERT IGNORE INTO psych_test_items (test_id, item_id)
VALUES (?, ?), (?, ?), ...;
```

3. 返回题目+选项（options_json 优先取 psych_items.options_json，否则取 scale_options）

```sql
SELECT
  i.id, i.type, i.question, i.domain, i.facet, i.reverse_scored,
  COALESCE(i.options_json, so.options_json) AS options_json
FROM psych_test_items ti
JOIN psych_items i ON i.id = ti.item_id
LEFT JOIN scale_options so ON so.type = i.type
WHERE ti.test_id = ?
ORDER BY FIELD(i.type,'PHQ9','GAD7','RSES','UCLA','PSS','IAT','EXT5'), i.domain, i.id;
```

**Express 示例：**

```js
// routes/student.js
const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/test/generate", requireAuth, requireRole("student"), async (req, res) => {
  const userId = req.user.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) 创建 psych_tests（学生只能一次：靠 uk_user_once）
    let testId;
    try {
      const [r] = await conn.query(
        "INSERT INTO psych_tests (user_id, version, status) VALUES (?, 'ISWB-CN-v1', 'in_progress')",
        [userId]
      );
      testId = r.insertId;
    } catch (e) {
      // 已经有测评（或已经生成过）
      if (String(e.code) === "ER_DUP_ENTRY") {
        await conn.rollback();
        return res.status(409).json({ error: "ALREADY_TESTED" });
      }
      throw e;
    }

    // 2) 抽150题（返回 item_id 列表）
    const [pickedRows] = await conn.query(`
      WITH
      std AS (SELECT i.id FROM psych_items i WHERE i.type IN ('PHQ9','GAD7','RSES','UCLA','PSS','IAT')),
      ext_facet_one AS (
        SELECT id, domain, facet
        FROM (
          SELECT i.id, i.domain, i.facet,
                 ROW_NUMBER() OVER (PARTITION BY i.domain, i.facet ORDER BY RAND()) AS rnf
          FROM psych_items i
          WHERE i.type='EXT5'
            AND i.domain IN ('学习压力','家庭关系','抑郁','焦虑','社交','网络行为','自尊')
        ) x
        WHERE x.rnf=1
      ),
      ext_rank AS (
        SELECT e.id, e.domain,
               ROW_NUMBER() OVER (PARTITION BY e.domain ORDER BY RAND()) AS rn_dom
        FROM ext_facet_one e
      ),
      ext_stage1 AS (
        SELECT id, domain
        FROM ext_rank
        WHERE ((domain IN ('学习压力','焦虑','抑郁','社交') AND rn_dom<=11)
            OR (domain IN ('网络行为','自尊','家庭关系') AND rn_dom<=10))
      ),
      ext_cnt AS (SELECT domain, COUNT(*) AS c FROM ext_stage1 GROUP BY domain),
      ext_stage2 AS (
        SELECT id
        FROM (
          SELECT i.id, i.domain,
                 ROW_NUMBER() OVER (PARTITION BY i.domain ORDER BY RAND()) AS rn_fill
          FROM psych_items i
          LEFT JOIN ext_stage1 s ON s.id=i.id
          WHERE i.type='EXT5'
            AND i.domain IN ('学习压力','家庭关系','抑郁','焦虑','社交','网络行为','自尊')
            AND s.id IS NULL
        ) z
        JOIN ext_cnt c ON c.domain=z.domain
        WHERE z.rn_fill <= (
          CASE
            WHEN z.domain IN ('学习压力','焦虑','抑郁','社交') THEN 11 - c.c
            WHEN z.domain IN ('网络行为','自尊','家庭关系') THEN 10 - c.c
            ELSE 0
          END
        )
      ),
      picked AS (
        SELECT id FROM std
        UNION ALL SELECT id FROM ext_stage1
        UNION ALL SELECT id FROM ext_stage2
      )
      SELECT id FROM picked;
    `);

    if (pickedRows.length !== 150) {
      throw new Error(`PICK_COUNT_NOT_150: ${pickedRows.length}`);
    }

    // 3) 写入 psych_test_items
    const values = pickedRows.map(r => [testId, r.id]);
    // 批量插入
    await conn.query(
      "INSERT IGNORE INTO psych_test_items (test_id, item_id) VALUES ?",
      [values]
    );

    // 4) 回传题目 + options
    const [items] = await conn.query(
      `
      SELECT
        i.id, i.type, i.question, i.domain, i.facet, i.reverse_scored,
        COALESCE(i.options_json, so.options_json) AS options_json
      FROM psych_test_items ti
      JOIN psych_items i ON i.id=ti.item_id
      LEFT JOIN scale_options so ON so.type=i.type
      WHERE ti.test_id=?
      ORDER BY FIELD(i.type,'PHQ9','GAD7','RSES','UCLA','PSS','IAT','EXT5'), i.domain, i.id
      `,
      [testId]
    );

    await conn.commit();
    res.json({ test_id: testId, items });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
```

---

### 4.2 `GET /student/test/current`

**目标**：返回当前 in_progress 的试卷题目（如果不存在→提示先 generate）

SQL：

```sql
SELECT test_id
FROM psych_tests
WHERE user_id=? AND status='in_progress'
ORDER BY test_id DESC
LIMIT 1;
```

取题：

```sql
SELECT i.id,i.type,i.question,i.domain,i.facet,i.reverse_scored,
       COALESCE(i.options_json, so.options_json) options_json
FROM psych_test_items ti
JOIN psych_items i ON i.id=ti.item_id
LEFT JOIN scale_options so ON so.type=i.type
WHERE ti.test_id=?;
```

---

### 4.3 `POST /student/test/submit`

**目标**：批量写入 answers（自动算 score）→ 计算 results → 结束 test

#### 4.3.1 提交校验（题目必须属于该试卷）

SQL（验证提交 item_id 是否都在 psych_test_items）：

```sql
SELECT COUNT(*) AS cnt
FROM psych_test_items
WHERE test_id=? AND item_id IN (?,?,...);
```

#### 4.3.2 批量写入 psych_answers（score计算靠 max_score + reverse_scored）

推荐：先把提交的 answers 放到临时表（或 JSON_TABLE），再 INSERT SELECT。这里给你 MySQL 8 的 `JSON_TABLE` 方案：

请求 body 里 answers 作为 JSON 字符串传入参数 `?`。

```sql
INSERT INTO psych_answers (test_id, item_id, answer, score)
SELECT
  ? AS test_id,
  jt.item_id,
  jt.answer,
  CASE
    WHEN i.reverse_scored=1 THEN (so.max_score - jt.answer)
    ELSE jt.answer
  END AS score
FROM JSON_TABLE(
  ?, '$[*]' COLUMNS(
    item_id VARCHAR(16) PATH '$.item_id',
    answer INT PATH '$.answer'
  )
) jt
JOIN psych_items i ON i.id = jt.item_id
LEFT JOIN scale_options so ON so.type = i.type
JOIN psych_test_items ti ON ti.test_id=? AND ti.item_id=jt.item_id;
```

#### 4.3.3 写入 psych_results（risk + tags + domains_json）

直接用你之前那条 REPLACE（我给你一份精简但对齐你表的版本）：

```sql
REPLACE INTO psych_results (test_id, risk_level, risk_score, domains_json, tags_json, created_at)
WITH
ds AS (
  SELECT
    a.test_id,
    i.domain,
    AVG(a.score) / MAX(so.max_score) AS v
  FROM psych_answers a
  JOIN psych_items i ON i.id=a.item_id
  LEFT JOIN scale_options so ON so.type=i.type
  WHERE a.test_id = ?
    AND i.domain IN ('学习压力','焦虑','抑郁','自尊','社交','网络行为')
  GROUP BY a.test_id, i.domain
),
risk AS (
  SELECT
    test_id,
    (
      COALESCE(MAX(CASE WHEN domain='抑郁' THEN v END),0) * 0.30 +
      COALESCE(MAX(CASE WHEN domain='焦虑' THEN v END),0) * 0.25 +
      COALESCE(MAX(CASE WHEN domain='学习压力' THEN v END),0) * 0.20 +
      COALESCE(MAX(CASE WHEN domain='社交' THEN v END),0) * 0.15 +
      COALESCE(MAX(CASE WHEN domain='网络行为' THEN v END),0) * 0.10
    ) AS risk_score
  FROM ds
  GROUP BY test_id
),
safety AS (
  SELECT EXISTS(
    SELECT 1 FROM psych_answers
    WHERE test_id=? AND item_id='PHQ9-09' AND answer>=3
  ) AS hit
),
domains_json AS (
  SELECT test_id, JSON_OBJECTAGG(domain, v) AS domains_json
  FROM ds
  GROUP BY test_id
),
tags_json AS (
  SELECT test_id, JSON_ARRAYAGG(tag) AS tags_json
  FROM (
    SELECT test_id,
      CASE
        WHEN domain='自尊' THEN
          CASE WHEN v<0.50 THEN 'selfesteem_low' WHEN v<0.70 THEN 'selfesteem_medium' ELSE 'selfesteem_high' END
        WHEN domain='学习压力' THEN
          CASE WHEN v<0.50 THEN 'academicstress_low' WHEN v<0.70 THEN 'academicstress_medium' ELSE 'academicstress_high' END
        WHEN domain='焦虑' THEN
          CASE WHEN v<0.50 THEN 'anxiety_low' WHEN v<0.70 THEN 'anxiety_medium' ELSE 'anxiety_high' END
        WHEN domain='抑郁' THEN
          CASE WHEN v<0.50 THEN 'depression_low' WHEN v<0.70 THEN 'depression_medium' ELSE 'depression_high' END
        WHEN domain='社交' THEN
          CASE WHEN v<0.50 THEN 'social_low' WHEN v<0.70 THEN 'social_medium' ELSE 'social_high' END
        WHEN domain='网络行为' THEN
          CASE WHEN v<0.50 THEN 'internet_low' WHEN v<0.70 THEN 'internet_medium' ELSE 'internet_high' END
        ELSE NULL
      END AS tag
    FROM ds
  ) t
  WHERE tag IS NOT NULL
  GROUP BY test_id
)
SELECT
  r.test_id,
  CASE
    WHEN (SELECT hit FROM safety)=1 THEN 'R3'
    WHEN r.risk_score < 0.30 THEN 'R0'
    WHEN r.risk_score < 0.50 THEN 'R1'
    WHEN r.risk_score < 0.70 THEN 'R2'
    ELSE 'R3'
  END AS risk_level,
  r.risk_score,
  dj.domains_json,
  tj.tags_json,
  NOW()
FROM risk r
JOIN domains_json dj ON dj.test_id=r.test_id
JOIN tags_json tj ON tj.test_id=r.test_id;
```

#### 4.3.4 结束 psych_tests

```sql
UPDATE psych_tests
SET status='finished', finished_at=NOW()
WHERE test_id=? AND user_id=?;
```

---

### 4.4 `GET /student/result`

SQL：

```sql
SELECT r.*
FROM psych_results r
JOIN psych_tests t ON t.test_id=r.test_id
WHERE t.user_id=? 
ORDER BY r.created_at DESC
LIMIT 1;
```

---

## 5) 老师接口：统计/学生列表/学生结果（含 SQL）

> 老师需要 school_id。teacher 登录后 JWT 中带 `school_id`。

### 5.1 `GET /teacher/stats/overview?grade=&class_no=`

完成率（总学生数 vs finished 数）：

```sql
SELECT
  SUM(CASE WHEN t.status='finished' THEN 1 ELSE 0 END) AS finished_cnt,
  COUNT(*) AS total_students
FROM psych_users u
LEFT JOIN psych_tests t ON t.user_id=u.id
WHERE u.role='student'
  AND u.school_id=?
  AND (? IS NULL OR u.grade=?)
  AND (? IS NULL OR u.class_no=?);
```

风险分布：

```sql
SELECT r.risk_level, COUNT(*) AS cnt
FROM psych_results r
JOIN psych_tests t ON t.test_id=r.test_id
JOIN psych_users u ON u.id=t.user_id
WHERE u.school_id=? AND u.role='student'
  AND (? IS NULL OR u.grade=?)
  AND (? IS NULL OR u.class_no=?)
GROUP BY r.risk_level;
```

六方面均值（从 domains_json 抽取）：

```sql
SELECT
  ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.学习压力')),4) AS 学习压力,
  ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.焦虑')),4) AS 焦虑,
  ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.抑郁')),4) AS 抑郁,
  ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.自尊')),4) AS 自尊,
  ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.社交')),4) AS 社交,
  ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.网络行为')),4) AS 网络行为
FROM psych_results r
JOIN psych_tests t ON t.test_id=r.test_id
JOIN psych_users u ON u.id=t.user_id
WHERE u.school_id=? AND u.role='student'
  AND (? IS NULL OR u.grade=?)
  AND (? IS NULL OR u.class_no=?);
```

---

### 5.2 `GET /teacher/stats/by-grade`

```sql
SELECT
  u.grade,
  r.risk_level,
  COUNT(*) AS cnt
FROM psych_results r
JOIN psych_tests t ON t.test_id=r.test_id
JOIN psych_users u ON u.id=t.user_id
WHERE u.school_id=? AND u.role='student'
GROUP BY u.grade, r.risk_level
ORDER BY u.grade;
```

---

### 5.3 `GET /teacher/stats/by-class?grade=7`

```sql
SELECT
  u.class_no,
  r.risk_level,
  COUNT(*) AS cnt
FROM psych_results r
JOIN psych_tests t ON t.test_id=r.test_id
JOIN psych_users u ON u.id=t.user_id
WHERE u.school_id=? AND u.role='student' AND u.grade=?
GROUP BY u.class_no, r.risk_level
ORDER BY u.class_no;
```

---

### 5.4 `GET /teacher/students?grade=&class_no=&keyword=`

```sql
SELECT
  u.id,
  u.real_name,
  u.grade,
  u.class_no,
  t.status,
  r.risk_level,
  r.risk_score,
  t.finished_at
FROM psych_users u
LEFT JOIN psych_tests t ON t.user_id=u.id
LEFT JOIN psych_results r ON r.test_id=t.test_id
WHERE u.school_id=? AND u.role='student'
  AND (? IS NULL OR u.grade=?)
  AND (? IS NULL OR u.class_no=?)
  AND (? IS NULL OR u.real_name LIKE CONCAT('%',?,'%') OR u.username LIKE CONCAT('%',?,'%'))
ORDER BY u.grade, u.class_no, u.real_name;
```

---

### 5.5 `GET /teacher/student/:studentId/result`

```sql
SELECT
  u.id AS student_id,
  u.real_name,
  u.grade,
  u.class_no,
  r.risk_level,
  r.risk_score,
  r.domains_json,
  r.tags_json,
  r.created_at
FROM psych_users u
JOIN psych_tests t ON t.user_id=u.id
JOIN psych_results r ON r.test_id=t.test_id
WHERE u.id=? AND u.school_id=? AND u.role='student'
ORDER BY r.created_at DESC
LIMIT 1;
```

---

## 6) 教育局接口：按学校统计（含 SQL）

> 假设教育局能看所有学校：只按 `psych_users.school_id` 聚合。若需要“辖区”权限，可在用户表加 `region_code` 再过滤。

### 6.1 `GET /bureau/schools`

```sql
SELECT
  u.school_id,
  COUNT(*) AS finished_cnt,
  SUM(CASE WHEN r.risk_level='R3' THEN 1 ELSE 0 END) AS r3_cnt,
  ROUND(SUM(CASE WHEN r.risk_level='R3' THEN 1 ELSE 0 END)/COUNT(*), 4) AS r3_rate,
  ROUND(AVG(r.risk_score),4) AS avg_risk
FROM psych_results r
JOIN psych_tests t ON t.test_id=r.test_id
JOIN psych_users u ON u.id=t.user_id
WHERE u.role='student'
GROUP BY u.school_id
ORDER BY r3_rate DESC;
```

### 6.2 `GET /bureau/schools/:schoolId`

```sql
SELECT
  u.grade,
  r.risk_level,
  COUNT(*) AS cnt
FROM psych_results r
JOIN psych_tests t ON t.test_id=r.test_id
JOIN psych_users u ON u.id=t.user_id
WHERE u.role='student' AND u.school_id=?
GROUP BY u.grade, r.risk_level
ORDER BY u.grade;
```

---

## 7) app.js 路由挂载示例

```js
const express = require("express");
const cors = require("cors");

const studentRoutes = require("./routes/student");
const teacherRoutes = require("./routes/teacher");
const bureauRoutes  = require("./routes/bureau");
dconst authRoutes    = require("./routes/auth");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use("/api/v1/student", studentRoutes);
app.use("/api/v1/teacher", teacherRoutes);
app.use("/api/v1/bureau", bureauRoutes);
app.use("/api/v1/auth", authRoutes);

app.listen(3000, () => console.log("API running on :3000"));
```




```
src/
  db.js
  middleware/auth.js
  routes/
    auth.js
    student.js
    teacher.js
    bureau.js
  app.js
```

并且你已经有：

* `db.js`（mysql2 pool）
* `middleware/auth.js`（requireAuth / requireRole，前面我给过）

环境变量：

* `JWT_SECRET`
* MySQL连接：`MYSQL_HOST/PORT/USER/PASSWORD/DATABASE`

---

## 1) routes/auth.js

```js
// routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function signToken(user) {
  const payload = {
    id: user.id,
    role: user.role,
    school_id: user.school_id ?? null,
    grade: user.grade ?? null,
    class_no: user.class_no ?? null,
    real_name: user.real_name ?? null,
    username: user.username,
  };
  return jwt.sign(payload, process.env.JWT_SECRET || "dev_secret", { expiresIn: "7d" });
}

// POST /api/v1/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(422).json({ error: "INVALID_PARAMS" });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `
      SELECT id, username, password_hash, role, school_id, real_name, grade, class_no
      FROM psych_users
      WHERE username=?
      LIMIT 1
      `,
      [username]
    );

    if (rows.length === 0) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        school_id: user.school_id,
        real_name: user.real_name,
        grade: user.grade,
        class_no: user.class_no,
      },
    });
  } catch (e) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  } finally {
    conn.release();
  }
});

// GET /api/v1/auth/me
router.get("/me", requireAuth, async (req, res) => {
  // 直接返回 JWT payload（也可以读库刷新）
  res.json({ user: req.user });
});

/**
 * 可选：注册接口（仅测试环境使用，线上一般由学校导入账号）
 * POST /api/v1/auth/dev-create-user
 */
router.post("/dev-create-user", async (req, res) => {
  const {
    username,
    password,
    role,
    school_id,
    real_name = null,
    grade = null,
    class_no = null,
  } = req.body || {};

  if (!username || !password || !role || !school_id) return res.status(422).json({ error: "INVALID_PARAMS" });
  if (!["student", "teacher", "bureau"].includes(role)) return res.status(422).json({ error: "INVALID_ROLE" });

  const conn = await pool.getConnection();
  try {
    const hash = await bcrypt.hash(password, 10);
    const [r] = await conn.query(
      `
      INSERT INTO psych_users (username, password_hash, role, school_id, real_name, grade, class_no)
      VALUES (?,?,?,?,?,?,?)
      `,
      [username, hash, role, school_id, real_name, grade, class_no]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    if (String(e.code) === "ER_DUP_ENTRY") return res.status(409).json({ error: "USERNAME_EXISTS" });
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
```

---

## 2) routes/teacher.js

实现：

* 统计概览：完成率 + 风险分布 + 六方面均值
* 按年级：风险分布
* 按班级：某年级各班风险分布
* 学生列表：筛选 + 分页 + 是否完成 + 风险
* 学生详情：总结果 + 6方面（domains_json）+ tags_json

```js
// routes/teacher.js
const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

function toIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toPage(v, def = 1) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

function toPageSize(v, def = 20) {
  const n = Number(v);
  const size = Number.isFinite(n) ? Math.floor(n) : def;
  return Math.max(1, Math.min(size, 100));
}

// GET /api/v1/teacher/stats/overview?grade=&class_no=
router.get("/stats/overview", requireAuth, requireRole("teacher"), async (req, res) => {
  const schoolId = req.user.school_id;
  const grade = toIntOrNull(req.query.grade);
  const classNo = toIntOrNull(req.query.class_no);

  const conn = await pool.getConnection();
  try {
    // 1) 完成率：总学生数、finished测试数（每人只能一次时等价）
    const [completionRows] = await conn.query(
      `
      SELECT
        SUM(CASE WHEN t.status='finished' THEN 1 ELSE 0 END) AS finished_cnt,
        COUNT(*) AS total_students
      FROM psych_users u
      LEFT JOIN psych_tests t ON t.user_id=u.id
      WHERE u.role='student'
        AND u.school_id=?
        AND (? IS NULL OR u.grade=?)
        AND (? IS NULL OR u.class_no=?)
      `,
      [schoolId, grade, grade, classNo, classNo]
    );

    const finishedCnt = Number(completionRows[0]?.finished_cnt || 0);
    const totalStudents = Number(completionRows[0]?.total_students || 0);
    const rate = totalStudents > 0 ? finishedCnt / totalStudents : 0;

    // 2) 风险分布
    const [riskRows] = await conn.query(
      `
      SELECT r.risk_level, COUNT(*) AS cnt
      FROM psych_results r
      JOIN psych_tests t ON t.test_id=r.test_id
      JOIN psych_users u ON u.id=t.user_id
      WHERE u.school_id=? AND u.role='student'
        AND (? IS NULL OR u.grade=?)
        AND (? IS NULL OR u.class_no=?)
      GROUP BY r.risk_level
      `,
      [schoolId, grade, grade, classNo, classNo]
    );

    const riskDist = { R0: 0, R1: 0, R2: 0, R3: 0 };
    for (const row of riskRows) riskDist[row.risk_level] = Number(row.cnt);

    // 3) 六方面均值（domains_json）
    const [avgRows] = await conn.query(
      `
      SELECT
        ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.学习压力')),4) AS 学习压力,
        ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.焦虑')),4) AS 焦虑,
        ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.抑郁')),4) AS 抑郁,
        ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.自尊')),4) AS 自尊,
        ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.社交')),4) AS 社交,
        ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.网络行为')),4) AS 网络行为
      FROM psych_results r
      JOIN psych_tests t ON t.test_id=r.test_id
      JOIN psych_users u ON u.id=t.user_id
      WHERE u.school_id=? AND u.role='student'
        AND (? IS NULL OR u.grade=?)
        AND (? IS NULL OR u.class_no=?)
      `,
      [schoolId, grade, grade, classNo, classNo]
    );

    const domainAvg = avgRows[0] || {};
    res.json({
      completion: { finished: finishedCnt, total_students: totalStudents, rate: Number(rate.toFixed(4)) },
      risk_dist: riskDist,
      domain_avg: domainAvg,
    });
  } catch (e) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  } finally {
    conn.release();
  }
});

// GET /api/v1/teacher/stats/by-grade
router.get("/stats/by-grade", requireAuth, requireRole("teacher"), async (req, res) => {
  const schoolId = req.user.school_id;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `
      SELECT u.grade, r.risk_level, COUNT(*) AS cnt
      FROM psych_results r
      JOIN psych_tests t ON t.test_id=r.test_id
      JOIN psych_users u ON u.id=t.user_id
      WHERE u.school_id=? AND u.role='student'
      GROUP BY u.grade, r.risk_level
      ORDER BY u.grade
      `,
      [schoolId]
    );
    res.json({ rows });
  } catch (e) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  } finally {
    conn.release();
  }
});

// GET /api/v1/teacher/stats/by-class?grade=7
router.get("/stats/by-class", requireAuth, requireRole("teacher"), async (req, res) => {
  const schoolId = req.user.school_id;
  const grade = toIntOrNull(req.query.grade);
  if (grade === null) return res.status(422).json({ error: "INVALID_PARAMS", message: "grade required" });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `
      SELECT u.class_no, r.risk_level, COUNT(*) AS cnt
      FROM psych_results r
      JOIN psych_tests t ON t.test_id=r.test_id
      JOIN psych_users u ON u.id=t.user_id
      WHERE u.school_id=? AND u.role='student' AND u.grade=?
      GROUP BY u.class_no, r.risk_level
      ORDER BY u.class_no
      `,
      [schoolId, grade]
    );
    res.json({ rows });
  } catch (e) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  } finally {
    conn.release();
  }
});

// GET /api/v1/teacher/students?grade=&class_no=&keyword=&page=&page_size=
router.get("/students", requireAuth, requireRole("teacher"), async (req, res) => {
  const schoolId = req.user.school_id;
  const grade = toIntOrNull(req.query.grade);
  const classNo = toIntOrNull(req.query.class_no);
  const keyword = (req.query.keyword || "").trim() || null;

  const page = toPage(req.query.page, 1);
  const pageSize = toPageSize(req.query.page_size, 20);
  const offset = (page - 1) * pageSize;

  const conn = await pool.getConnection();
  try {
    // 总数（分页）
    const [countRows] = await conn.query(
      `
      SELECT COUNT(*) AS total
      FROM psych_users u
      WHERE u.school_id=? AND u.role='student'
        AND (? IS NULL OR u.grade=?)
        AND (? IS NULL OR u.class_no=?)
        AND (? IS NULL OR u.real_name LIKE CONCAT('%',?,'%') OR u.username LIKE CONCAT('%',?,'%'))
      `,
      [schoolId, grade, grade, classNo, classNo, keyword, keyword, keyword]
    );
    const total = Number(countRows[0]?.total || 0);

    // 列表：LEFT JOIN tests/results（每人一次的前提下很简洁）
    const [rows] = await conn.query(
      `
      SELECT
        u.id,
        u.username,
        u.real_name,
        u.grade,
        u.class_no,
        t.test_id,
        t.status,
        t.finished_at,
        r.risk_level,
        r.risk_score
      FROM psych_users u
      LEFT JOIN psych_tests t ON t.user_id=u.id
      LEFT JOIN psych_results r ON r.test_id=t.test_id
      WHERE u.school_id=? AND u.role='student'
        AND (? IS NULL OR u.grade=?)
        AND (? IS NULL OR u.class_no=?)
        AND (? IS NULL OR u.real_name LIKE CONCAT('%',?,'%') OR u.username LIKE CONCAT('%',?,'%'))
      ORDER BY u.grade, u.class_no, u.real_name, u.username
      LIMIT ? OFFSET ?
      `,
      [schoolId, grade, grade, classNo, classNo, keyword, keyword, keyword, pageSize, offset]
    );

    res.json({ page, page_size: pageSize, total, rows });
  } catch (e) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  } finally {
    conn.release();
  }
});

// GET /api/v1/teacher/student/:studentId/result
router.get("/student/:studentId/result", requireAuth, requireRole("teacher"), async (req, res) => {
  const schoolId = req.user.school_id;
  const studentId = Number(req.params.studentId);
  if (!Number.isFinite(studentId)) return res.status(422).json({ error: "INVALID_PARAMS" });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `
      SELECT
        u.id AS student_id,
        u.username,
        u.real_name,
        u.grade,
        u.class_no,
        t.test_id,
        t.status,
        t.finished_at,
        r.risk_level,
        r.risk_score,
        r.domains_json,
        r.tags_json,
        r.created_at
      FROM psych_users u
      LEFT JOIN psych_tests t ON t.user_id=u.id
      LEFT JOIN psych_results r ON r.test_id=t.test_id
      WHERE u.id=? AND u.school_id=? AND u.role='student'
      ORDER BY r.created_at DESC
      LIMIT 1
      `,
      [studentId, schoolId]
    );

    if (rows.length === 0) return res.status(404).json({ error: "NOT_FOUND" });
    const row = rows[0];
    if (!row.test_id) return res.json({ student: row, result: null }); // 未测评

    res.json({ student: { ...row }, result: { ...row } });
  } catch (e) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
```

---

## 3) routes/bureau.js

实现：

* 学校列表汇总（按 school_id 聚合）
* 单个学校详情（按年级风险分布）
  -（可选）单校班级分布（如果教育局允许下钻）

> 注意：你当前没有 `schools` 表也没关系，先返回 `school_id` 数字即可；若有学校表，可 LEFT JOIN 显示名称。

```js
// routes/bureau.js
const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

function toIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// GET /api/v1/bureau/schools
router.get("/schools", requireAuth, requireRole("bureau"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `
      SELECT
        u.school_id,
        COUNT(*) AS finished_cnt,
        SUM(CASE WHEN r.risk_level='R3' THEN 1 ELSE 0 END) AS r3_cnt,
        ROUND(SUM(CASE WHEN r.risk_level='R3' THEN 1 ELSE 0 END)/COUNT(*), 4) AS r3_rate,
        ROUND(AVG(r.risk_score),4) AS avg_risk
      FROM psych_results r
      JOIN psych_tests t ON t.test_id=r.test_id
      JOIN psych_users u ON u.id=t.user_id
      WHERE u.role='student'
      GROUP BY u.school_id
      ORDER BY r3_rate DESC, avg_risk DESC
      `
    );
    res.json({ rows });
  } catch (e) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  } finally {
    conn.release();
  }
});

// GET /api/v1/bureau/schools/:schoolId
router.get("/schools/:schoolId", requireAuth, requireRole("bureau"), async (req, res) => {
  const schoolId = Number(req.params.schoolId);
  if (!Number.isFinite(schoolId)) return res.status(422).json({ error: "INVALID_PARAMS" });

  const conn = await pool.getConnection();
  try {
    // 1) 学校总体风险分布
    const [riskRows] = await conn.query(
      `
      SELECT r.risk_level, COUNT(*) AS cnt
      FROM psych_results r
      JOIN psych_tests t ON t.test_id=r.test_id
      JOIN psych_users u ON u.id=t.user_id
      WHERE u.role='student' AND u.school_id=?
      GROUP BY r.risk_level
      `,
      [schoolId]
    );

    const riskDist = { R0: 0, R1: 0, R2: 0, R3: 0 };
    for (const row of riskRows) riskDist[row.risk_level] = Number(row.cnt);

    // 2) 按年级风险分布
    const [byGrade] = await conn.query(
      `
      SELECT u.grade, r.risk_level, COUNT(*) AS cnt
      FROM psych_results r
      JOIN psych_tests t ON t.test_id=r.test_id
      JOIN psych_users u ON u.id=t.user_id
      WHERE u.role='student' AND u.school_id=?
      GROUP BY u.grade, r.risk_level
      ORDER BY u.grade
      `,
      [schoolId]
    );

    // 3) 六方面均值
    const [avgRows] = await conn.query(
      `
      SELECT
        ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.学习压力')),4) AS 学习压力,
        ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.焦虑')),4) AS 焦虑,
        ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.抑郁')),4) AS 抑郁,
        ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.自尊')),4) AS 自尊,
        ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.社交')),4) AS 社交,
        ROUND(AVG(JSON_EXTRACT(r.domains_json,'$.网络行为')),4) AS 网络行为
      FROM psych_results r
      JOIN psych_tests t ON t.test_id=r.test_id
      JOIN psych_users u ON u.id=t.user_id
      WHERE u.role='student' AND u.school_id=?
      `,
      [schoolId]
    );

    res.json({
      school_id: schoolId,
      risk_dist: riskDist,
      by_grade: byGrade,
      domain_avg: avgRows[0] || {},
    });
  } catch (e) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  } finally {
    conn.release();
  }
});

/**
 * 可选：教育局查看某校某年级各班（如果允许下钻）
 * GET /api/v1/bureau/schools/:schoolId/classes?grade=7
 */
router.get("/schools/:schoolId/classes", requireAuth, requireRole("bureau"), async (req, res) => {
  const schoolId = Number(req.params.schoolId);
  const grade = toIntOrNull(req.query.grade);
  if (!Number.isFinite(schoolId) || grade === null) return res.status(422).json({ error: "INVALID_PARAMS" });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `
      SELECT u.class_no, r.risk_level, COUNT(*) AS cnt
      FROM psych_results r
      JOIN psych_tests t ON t.test_id=r.test_id
      JOIN psych_users u ON u.id=t.user_id
      WHERE u.role='student' AND u.school_id=? AND u.grade=?
      GROUP BY u.class_no, r.risk_level
      ORDER BY u.class_no
      `,
      [schoolId, grade]
    );
    res.json({ school_id: schoolId, grade, rows });
  } catch (e) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
```

---

## 4) app.js 挂载（示例）

```js
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/student");
const teacherRoutes = require("./routes/teacher");
const bureauRoutes = require("./routes/bureau");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/student", studentRoutes);
app.use("/api/v1/teacher", teacherRoutes);
app.use("/api/v1/bureau", bureauRoutes);

app.listen(3000, () => console.log("API running on :3000"));
```
