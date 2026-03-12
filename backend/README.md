# 心理健康测评系统 - 后端登录模块

## 文件结构

```
backend/
├── server.js              # 服务器入口文件
├── db.js                  # MySQL 数据库连接池
├── package.json           # 项目依赖配置
├── middleware/
│   └── auth.js            # JWT 认证中间件
└── routes/
    └── auth.js            # 认证相关路由
```

## 安装依赖

```bash
cd backend
npm install
```

## 环境变量配置

可选的环境变量（在 `.env` 文件中配置）：

```env
# MySQL 数据库配置
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=liyangtom
MYSQL_DATABASE=heart

# JWT 密钥
JWT_SECRET=your_secret_key_here

# 服务器端口
PORT=3000
```

## API 接口

### 1. 用户登录

**POST** `/api/auth/login`

请求体：

```json
{
  "username": "student001",
  "password": "password123"
}
```

响应：

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "student001",
      "role": "student",
      "school_id": 101,
      "real_name": "张三",
      "grade": 7,
      "class_no": 2
    }
  }
}
```

### 2. 获取当前用户信息

**GET** `/api/auth/me`

请求头：

```
Authorization: Bearer <token>
```

响应：

```json
{
  "code": 200,
  "data": {
    "user": {
      "id": 1,
      "role": "student",
      "school_id": 101,
      ...
    }
  }
}
```

### 3. 开发环境创建测试用户

**POST** `/api/auth/dev-create-user`

请求体：

```json
{
  "username": "test_student",
  "password": "123456",
  "role": "student",
  "school_id": 101,
  "real_name": "测试学生",
  "grade": 7,
  "class_no": 1
}
```

## 启动服务器

```bash
# 生产环境
npm start

# 开发环境（自动重启）
npm run dev
```

## 创建测试数据

在 MySQL 中执行以下 SQL 创建测试用户：

```sql
-- 学生用户 (密码：123456)
INSERT INTO psych_users (username, password, role, school_id, real_name, grade, class_no)
VALUES ('student001', '123456', 'student', 101, '张三', 7, 1);

-- 管理员用户 (密码：123456)
INSERT INTO psych_users (username, password, role, school_id, real_name)
VALUES ('manager001', '123456', 'manager', 101, '李管理员');

-- 教育局用户 (密码：123456)
INSERT INTO psych_users (username, password, role, school_id)
VALUES ('bureau001', '123456', 'bureau', 101);
```

## 说明

1. **JWT Token**: 登录后返回的 token 有效期为 7 天
2. **密码存储**: 明文存储（仅用于开发/测试环境）
3. **角色权限**: 支持 student、manager、bureau 三种角色
4. **生产环境**: 请修改 `JWT_SECRET` 为强随机字符串，并考虑使用密码加密
