-- 699_create_user_role_down.sql
--
-- 反向迁移：删除 user_role 表。
--
-- 注意：若已在生产环境双写运行，需先停止双写任务并确认无活跃读路径
-- 依赖 user_role 后再执行本 down 迁移。

DROP TABLE IF EXISTS user_role;
