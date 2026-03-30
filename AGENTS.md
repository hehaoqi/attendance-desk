# AGENTS.md - 工人考勤管理系统

Electron 桌面应用：Vue 3 前端 + Express 后端 + SQLite 数据库。面向建筑/蓝领工人的考勤与工资管理。

## Project Structure

```
/electron/          # Electron 主进程 (main.js, preload.js)
/server/            # Express 后端 (routes, database, logger)
/frontend/          # Vue 3 + TypeScript + Vite 前端
/docs/              # 使用说明、测试记录
/scripts/           # 测试脚本
```

---

## Quick Start

```bash
# 安装依赖
npm install
cd frontend && npm install && cd ..

# 开发模式（Vite dev server + Electron）
npm run dev

# 构建生产版本
npm run build          # 构建前端 + 打包 Electron
```

- 开发模式：Vite 端口 5173，Express 端口 38080，Vite 代理 /api → Express
- 生产模式：Express 直接 serve frontend/dist/

---

## Tech Stack

### Frontend
- **Vue 3.4+** (Composition API `<script setup>`)
- **TypeScript** + **Vite**
- **Ant Design Vue 4.x**
- **Pinia** (状态管理), **Vue Router 4**
- **ECharts 6** + vue-echarts
- **Axios**, **Day.js**

### Backend
- **Express 4** (server/index.js)
- **better-sqlite3** (server/database.js)
- **uuid** (ID 生成)

### Desktop
- **Electron 33** (electron/main.js)
- **electron-builder** (打包 Windows .exe)

---

## Frontend Structure

```
frontend/src/
├── api/              # Axios API 模块
├── assets/           # CSS
├── components/       # 公用组件
├── router/           # 路由配置
├── stores/           # Pinia stores
├── views/            # 页面组件
├── App.vue
└── main.ts
```

### Code Style
- Vue SFC 使用 `<script setup lang="ts">`
- 组件命名 PascalCase (`HomeView.vue`)
- 变量 camelCase，常量 UPPER_SNAKE_CASE
- 导入顺序：Vue core → 第三方库 → 内部模块
- 使用 Ant Design Vue 组件
- 中文用于 UI 和注释

---

## Backend Structure

```
server/
├── index.js          # Express 应用、中间件、路由挂载
├── database.js       # SQLite 初始化、表结构
├── logger.js         # 文件日志
├── utils.js          # snake_case → camelCase 转换
└── routes/
    ├── workers.js    # 工人管理
    ├── attendance.js # 考勤管理
    ├── salary.js     # 工资核算
    ├── salaryPayment.js # 发薪记录
    ├── dashboard.js  # 首页统计
    ├── auth.js       # 登录认证
    ├── users.js      # 用户管理
    ├── roles.js      # 角色管理
    └── settings.js   # 系统设置
```

### Key Points
- DB 响应自动从 snake_case 转 camelCase（中间件）
- SQLite WAL 模式
- DB 路径：生产环境 `%APPDATA%/attendance-system/`，开发环境 `server/`
- 日志保存：`%APPDATA%/attendance-system/logs/`

---

## API Endpoints

所有接口前缀 `/api`：

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 工人 | GET | /api/workers | 列表 |
| | GET | /api/workers/:id | 详情 |
| | POST | /api/workers | 创建 |
| | PUT | /api/workers/:id | 更新 |
| | DELETE | /api/workers/:id | 删除 |
| 考勤 | GET | /api/attendance | 列表 |
| | GET | /api/attendance/today-stats | 今日统计 |
| | GET | /api/attendance/date/:date | 按日期查 |
| | GET | /api/attendance/worker/:workerId | 按工人查 |
| | GET | /api/attendance/range | 范围查询 |
| | GET | /api/attendance/trend | 趋势 |
| | POST | /api/attendance | 打卡 |
| | PUT | /api/attendance/:id | 更新 |
| | DELETE | /api/attendance/:id | 删除 |
| 工资 | GET | /api/salary/stats | 统计 |
| | GET | /api/salary/calculate | 核算 |
| | GET | /api/salary/yearly | 年度工资 |
| | GET | /api/salary/annual-summary-with-payments | 年度汇总含发薪 |
| 发薪 | GET | /api/salary/payments | 列表 |
| | GET | /api/salary/payments/:id | 详情 |
| | GET | /api/salary/payments/worker/:workerId | 按工人查 |
| | POST | /api/salary/payments | 创建 |
| | PUT | /api/salary/payments/:id | 更新 |
| | PUT | /api/salary/payments/:id/remarks | 更新备注 |
| | DELETE | /api/salary/payments/:id | 删除 |
| 统计 | GET | /api/dashboard/today | 今日概览 |
| | GET | /api/dashboard/month | 本月概览 |
| | GET | /api/dashboard/year | 本年概览 |
| 认证 | POST | /api/auth/login | 登录 |
| | GET | /api/auth/check | 检查登录状态 |
| 用户 | GET/POST/PUT/DELETE | /api/users | 用户 CRUD |
| 角色 | GET/POST/PUT/DELETE | /api/roles | 角色 CRUD |
| 设置 | GET/PUT | /api/settings | 系统设置 |

---

## Business Logic

- 业务主线：工人档案 → 每日考勤 → 月度工资核算 → 发薪登记 → 年度汇总
- 考勤状态：present(出勤), half_day(半天), leave(请假), absent(缺勤)
- 工资计算：normalSalary = dailyWage × (normalDays + halfDays × 0.5), overtimeSalary = overtimeHours × overtimeWage
- 默认管理员：admin / admin123

---

## Common Issues

- **native 模块版本不匹配**：运行 `npm run rebuild:electron`
- **前端无法连接后端**：检查 `vite.config.ts` 代理配置（/api → localhost:38080）
- **数据库锁定**：确保没有多个进程同时访问 SQLite 文件
