// Vitest 全局 setup
// 确保 process.env 有默认值,避免测试时因缺少环境变量崩溃
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key"
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "test-encryption-key-32chars!!"
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://workflow:workflow@localhost:5432/workflow"
