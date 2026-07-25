-- Migration: 002_add_latency_fields
-- Add latency-based strategy fields to circuit_breaker_configs.

ALTER TABLE circuit_breaker_configs
ADD COLUMN IF NOT EXISTS latency_percentile DOUBLE PRECISION NOT NULL DEFAULT 95.0;

ALTER TABLE circuit_breaker_configs
ADD COLUMN IF NOT EXISTS latency_threshold_ms INT NOT NULL DEFAULT 1000;
