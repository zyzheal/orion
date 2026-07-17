-- Auto-generated rollback for version 061. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_problem_change_links_change";

DROP INDEX IF EXISTS "idx_problem_change_links_problem";

DROP INDEX IF EXISTS "idx_problem_incident_links_incident";

DROP INDEX IF EXISTS "idx_problem_incident_links_problem";

DROP INDEX IF EXISTS "idx_problem_known_errors_problem";

DROP INDEX IF EXISTS "idx_problem_problems_priority";

DROP INDEX IF EXISTS "idx_problem_problems_status";

DROP INDEX IF EXISTS "idx_problem_problems_tenant";

DROP TABLE IF EXISTS "problem_change_links" CASCADE;

DROP TABLE IF EXISTS "problem_incident_links" CASCADE;

DROP TABLE IF EXISTS "problem_known_errors" CASCADE;
