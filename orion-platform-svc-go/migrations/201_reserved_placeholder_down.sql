-- Migration number: 201
-- Reverse of 201_reserved_placeholder.sql.
--
-- The up migration is a no-op placeholder (SELECT 1) reserved for historical
-- compatibility after the original migration was removed/renamed during
-- migration framework unification. Its reverse is therefore also a no-op.
--
-- DO NOT delete this file -- it maintains forward compatibility and lets
-- RunMigrationsDown roll back past 201 without aborting.
SELECT 1;
