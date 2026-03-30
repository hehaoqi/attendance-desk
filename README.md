# 工人考勤管理系统（桌面版）

这是一个基于 Electron + Express + SQLite + Vue 3 的本地桌面应用。

## 1. 日志文件在哪里

程序启动后会自动写入日志，默认包含：

- `app.log`：启动信息、环境信息、接口请求、关键业务日志
- `error.log`：异常、未处理错误、接口 4xx/5xx、前端未捕获错误

### Windows 日志目录

默认目录：

```text
%APPDATA%\attendance-system\logs\
```

常见文件：

```text
%APPDATA%\attendance-system\logs\app.log
%APPDATA%\attendance-system\logs\error.log
```

### macOS 开发环境日志目录

如果是在当前开发机直接运行 Electron，日志目录通常是：

```text
~/Library/Application Support/attendance-system/logs/
```

如果只是单独用 Node 启动 `server/index.js` 调试，则日志在项目根目录：

```text
./logs/app.log
./logs/error.log
```

## 2. 已补充的关键日志

当前已记录以下内容，便于排查用户现场问题：

- 应用启动日志：平台、架构、Node/Electron 版本、运行目录、日志目录
- Electron 主进程异常：`uncaughtException`、`unhandledRejection`
- 页面加载失败、渲染进程崩溃、页面无响应
- 前端未捕获异常、Promise 未处理异常
- API 请求日志：方法、路径、状态码、耗时、IP
- 登录成功/失败日志（不记录密码）
- Express 统一错误日志：错误消息、堆栈、请求路径

## 3. 出问题时怎么排查

建议按这个顺序看：

1. 先看 `error.log`
2. 再看同时间段的 `app.log`
3. 重点搜索关键字：`ERROR`、`uncaughtException`、`unhandledRejection`、`did-fail-load`、`render-process-gone`
4. 如果是登录失败，搜索 `Login failed` 或 `POST /api/auth/login`
5. 如果是页面打不开，搜索 `Browser window load failed`

## 4. 本地开发运行

### 安装依赖

```bash
npm install
cd frontend && npm install
```

根目录安装完成后会自动执行 Electron 原生依赖重建。

### 开发模式启动

终端 1：

```bash
cd frontend
npm run dev
```

终端 2：

```bash
cd ..
npx electron . --dev
```

## 5. 如何打包成 exe

### 推荐方式：在 Windows 机器上打包

要求：

- Node.js 20 或 22 LTS
- npm 10+

步骤：

```bash
npm install
cd frontend && npm install && cd ..
npm run build
```

打包完成后，输出目录：

```text
dist-electron/
```

目标文件：

```text
dist-electron/工人考勤管理系统.exe
```

当前配置输出的是 `portable` 版本，特点是：

- 不需要安装
- 可以直接拷贝给用户
- 双击 exe 即可运行
- 数据库和日志会自动保存在用户自己的 AppData 目录中

### 不建议在 macOS 直接打 Windows exe

虽然部分场景可以跨平台构建，但稳定性和依赖要求都更复杂。为了减少失败率，建议直接在 Windows 机器上执行打包。

## 6. 交付给用户时建议说明

- 首次运行时，程序会自动创建本地数据库
- 默认管理员账号：`admin`
- 默认管理员密码：`admin123`
- 如有异常，请把 `logs` 目录下的 `app.log` 和 `error.log` 一起发回

## 7. 常用命令

```bash
npm run rebuild:electron   # 重新编译 Electron 原生依赖
npm run build:frontend     # 仅构建前端
npm run build              # 构建前端并打包 Electron
npx electron .             # 直接启动桌面版
```

## 8. 配套文档

- 简版使用说明：`docs/简版使用说明.md`
- 冒烟测试记录：`docs/冒烟测试记录-2026-03-29.md`
- 原始测试结果 JSON：`smoke-test-result-2026-03-29.json`