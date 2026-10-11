-- 700_backfill_user_role_from_capability_down.sql
--
-- 反向：删除从 capability 双写来的记录。
-- 保留手工授权的行（source != 'import:capability'）。

DELETE FROM user_role
 WHERE source = 'import:capability';
