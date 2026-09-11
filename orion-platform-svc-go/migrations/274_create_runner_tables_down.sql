-- Rollback: Migration 253 — Runner CI Task Execution Tables
-- Remove runner_heartbeats, runner_jobs, and runner_agents tables.

DROP TABLE IF EXISTS runner_heartbeats;
DROP TABLE IF EXISTS runner_jobs;
DROP TABLE IF EXISTS runner_agents;
