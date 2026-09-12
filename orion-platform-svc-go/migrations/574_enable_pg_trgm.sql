-- Migration 574: enable pg_trgm for trigram text similarity.
--
-- knowledge.Repository.Retrieve orders RAG results by
-- similarity(content, $N) and ai/knowledge.Repository ranks documents by
-- similarity(title, $N) + similarity(content, $N). Both are on live paths:
-- the knowledge retrieve handler, pandawiki retrieval, the RAG pipeline,
-- eval-set scoring and the cicd wiring all call Retrieve, so every one of
-- them failed with "function similarity(character varying, character varying)
-- does not exist" -- Postgres only ships similarity(text, text) once pg_trgm
-- is installed, and no migration created it.
--
-- Idempotent, and the precedent is set by 048/064/274 for uuid-ossp. When the
-- extension is already installed, IF NOT EXISTS short-circuits to a NOTICE and
-- no privilege is required.

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Rollback: 574_enable_pg_trgm_down.sql
