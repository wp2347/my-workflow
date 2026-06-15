# 环境搭建指南

## 1. 安装 Docker 运行时（三选一）

### 方案 A：Docker Desktop（推荐，有 GUI）
从官网下载：https://www.docker.com/products/docker-desktop/
安装后打开 Docker Desktop，等待状态栏图标变绿。

### 方案 B：OrbStack（轻量、速度快）
下载：https://orbstack.dev/
```bash
brew install orbstack
```

### 方案 C：Colima（纯命令行）
已安装在 `/opt/homebrew/opt/colima/bin/colima`
```bash
# 启动（如遇到 GitHub 下载超时，需配置代理）
colima start --cpu 2 --memory 4

# 如失败，使用国内镜像：
colima start --cpu 2 --memory 4 \
  --mirror 'https://mirror.ccs.tencentyun.com'
```

## 2. 启动数据库服务

```bash
# 确认 Docker 运行中
docker ps

# 启动 PostgreSQL + Redis
cd /Users/apple/Desktop/my-workflow
docker compose up -d

# 验证
docker compose ps
# 应显示 workflow-postgres 和 workflow-redis 两个容器
```

## 3. 初始化数据库

```bash
cd /Users/apple/Desktop/my-workflow

# 生成 Prisma Client
npx prisma generate

# 创建数据库表（开发环境）
npx prisma db push
```

## 4. 配置 API Key

编辑 `.env`，填入真实的 OpenAI API Key：
```
OPENAI_API_KEY="sk-..."
```

## 5. 启动开发服务

```bash
npm run dev:webpack
```

访问 http://localhost:3000

## 快速验证

```bash
# 1. 创建工作流
curl -X POST http://localhost:3000/api/workflow \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Workflow","nodes":[],"edges":[]}'

# 2. 获取工作流列表
curl http://localhost:3000/api/workflow
```
