-- Auto-generated rollback for version 009. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_api_market_subscriptions_status";

DROP INDEX IF EXISTS "idx_api_market_subscriptions_product";

DROP INDEX IF EXISTS "idx_api_market_subscriptions_app";

DROP INDEX IF EXISTS "idx_api_market_keys_status";

DROP INDEX IF EXISTS "idx_api_market_keys_client";

DROP INDEX IF EXISTS "idx_api_market_keys_app";

DROP INDEX IF EXISTS "idx_api_market_keys_tenant";

DROP INDEX IF EXISTS "idx_api_market_apps_developer";

DROP INDEX IF EXISTS "idx_api_market_apps_product";

DROP INDEX IF EXISTS "idx_api_market_apps_tenant";

DROP INDEX IF EXISTS "idx_api_market_products_status";

DROP INDEX IF EXISTS "idx_api_market_products_tenant";

DROP TABLE IF EXISTS "api_market_subscriptions" CASCADE;

DROP TABLE IF EXISTS "api_market_keys" CASCADE;

DROP TABLE IF EXISTS "api_market_apps" CASCADE;
