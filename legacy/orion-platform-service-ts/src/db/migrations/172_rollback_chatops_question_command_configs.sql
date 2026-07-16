-- Rollback Migration 172: Drop ChatOps Question & Command Configs tables

DROP TABLE IF EXISTS chatops_command_configs;
DROP TABLE IF EXISTS chatops_question_configs;
