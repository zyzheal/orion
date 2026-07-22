-- Auto-generated rollback for version 015. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_billing_subscriptions_tenant";

DROP INDEX IF EXISTS "idx_billing_line_items_invoice";

DROP INDEX IF EXISTS "idx_billing_invoices_account";

DROP INDEX IF EXISTS "idx_billing_invoices_tenant";

DROP INDEX IF EXISTS "idx_billing_accounts_tenant";

DROP TABLE IF EXISTS "billing_subscriptions" CASCADE;

DROP TABLE IF EXISTS "billing_line_items" CASCADE;

DROP TABLE IF EXISTS "billing_invoices" CASCADE;
