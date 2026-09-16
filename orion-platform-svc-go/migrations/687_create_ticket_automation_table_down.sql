-- Reverse of migration 687.
--
-- Nothing else owns ticket_automation, so CASCADE is not destructive beyond
-- this table. The repository is the only writer.

DROP TABLE IF EXISTS ticket_automation CASCADE;
