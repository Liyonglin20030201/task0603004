# 学习计划管理平台 (Study Platform)

个人学习计划管理平台，支持课程管理、学习计划制定、每日打卡、错题/笔记管理、AI 复习建议、日历视图和进度统计。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite + Ant Design 5 + TypeScript + Zustand |
| 后端 | Node.js + Express + Prisma ORM + TypeScript |
| 数据库 | PostgreSQL 15 |
| 缓存 | Redis 7 |
| AI | Claude API (Anthropic SDK) |
| 部署 | Docker Compose |

## 项目结构

```
├── packages/
│   ├── client/          # React 前端
│   ├── server/          # Express 后端
│   └── shared/          # 共享类型定义
├── docs/
│   └── api.yaml         # OpenAPI 3.0 接口文档
├── docker/
│   ├── nginx/           # Nginx 配置
│   ├── server.Dockerfile
│   └── client.Dockerfile
└── docker-compose.yml
```

## 核心功能

- **用户模块** - 注册/登录/JWT 鉴权/角色管理
- **课程模块** - CRUD、分类、归档（保留历史数据）
- **学习计划** - 创建带日程的计划、延期处理、自动调整
- **每日打卡** - 防重复打卡（数据库唯一约束）、连续打卡统计
- **错题本** - 记录错题、标签分类、艾宾浩斯间隔复习
- **笔记** - Markdown 笔记、关联课程/计划项
- **AI 复习建议** - 调用 Claude API 生成个性化 7 天复习计划
- **日历视图** - 按月展示学习计划和打卡记录
- **进度统计** - 每日趋势图、课程进度对比、周报
- **通知系统** - 逾期提醒、每日任务提醒、成就通知
- **后台管理** - 用户管理、系统配置

## 快速开始

### 前置条件

- Node.js >= 18
- Docker & Docker Compose (或本地 PostgreSQL + Redis)
- Anthropic API Key (AI 功能需要)

### 方式一：Docker Compose 部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/Liyonglin20030201/task0603004.git
cd task0603004

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 JWT_SECRET 和 ANTHROPIC_API_KEY

# 3. 启动所有服务
docker-compose up -d

# 4. 运行数据库迁移
docker-compose exec server npx prisma migrate deploy

# 5. (可选) 填充示例数据
docker-compose exec server npx tsx src/prisma/seed.ts
```

访问 http://localhost 即可使用。

### 方式二：本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置后端环境变量
cp packages/server/.env.example packages/server/.env
# 编辑 .env:
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/study_platform
#   REDIS_URL=redis://localhost:6379
#   JWT_SECRET=your-secret
#   ANTHROPIC_API_KEY=your-key

# 3. 启动 PostgreSQL 和 Redis (使用 Docker)
docker-compose up -d postgres redis

# 4. 运行数据库迁移
cd packages/server
npx prisma migrate dev --name init
npx prisma generate

# 5. (可选) 填充示例数据
npx tsx src/prisma/seed.ts

# 6. 启动开发服务器 (回到项目根目录)
cd ../..
npm run dev
```

- 前端: http://localhost:5173
- 后端: http://localhost:3000
- API 文档: 参见 docs/api.yaml

### 示例账号

运行 seed 后可用：
- 管理员: `admin@study-platform.com` / `admin123`
- 普通用户: `demo@study-platform.com` / `user123`

## 关键业务逻辑

### 计划延期处理

当用户错过学习日期时：
1. 调用 `POST /api/plans/:id/delay`
2. 所有逾期未完成项标记为「已跳过」
3. 后续待办项自动顺延相应天数
4. 保留原始日期记录用于统计
5. 每日定时任务自动检测并发送通知提醒

### 防重复打卡

- 数据库层: `UNIQUE(user_id, plan_item_id, check_in_date)` 约束
- 接口层: 捕获 Prisma P2002 错误 → 返回 409 Conflict
- 前端层: 打卡成功后禁用按钮，加载页面时预先获取今日打卡状态

### 课程切换历史保留

- 课程只做「归档」(status='archived')，永不硬删除
- 所有关联数据（计划、打卡、错题、笔记）保持链接
- 统计页面支持切换「是否包含已归档课程」

### 统计准确性

- 完成率按「每个计划」独立计算，不会跨计划混合
- 所有日期存储为 UTC，查询时按用户时区转换
- 使用数据库聚合查询，避免应用层计算误差

## 运行测试

```bash
# 确保数据库已启动
npm test
```

测试覆盖：
- Auth API（注册/登录/token 刷新）
- 打卡重复检测（409 响应）
- 计划延期逻辑（日期偏移验证）

## API 文档

完整 OpenAPI 规范见 `docs/api.yaml`，可导入 Swagger UI 或 Postman 查看。

主要端点：

| 模块 | 端点 | 说明 |
|------|------|------|
| Auth | POST /api/auth/register | 注册 |
| Auth | POST /api/auth/login | 登录 |
| Courses | GET/POST /api/courses | 课程列表/创建 |
| Plans | POST /api/plans/:id/delay | 处理延期 |
| Check-ins | POST /api/checkins | 打卡 (409=重复) |
| AI | POST /api/ai/generate-review | AI 复习建议 |
| Stats | GET /api/stats/overview | 仪表盘统计 |
| Calendar | GET /api/calendar?month= | 日历事件 |

## 生产部署

1. 修改 `.env` 中的 `JWT_SECRET` 为强随机字符串
2. 配置 `ANTHROPIC_API_KEY`
3. 修改 `docker-compose.yml` 中 PostgreSQL 密码
4. (可选) 在 Nginx 配置中添加 SSL/TLS
5. `docker-compose -f docker-compose.yml up -d --build`

## License

MIT
