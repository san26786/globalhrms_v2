-- ============================================================================
-- GlobalHRMS — repair ID sequences after the MySQL → PostgreSQL migration
-- ----------------------------------------------------------------------------
-- WHY: the migration left almost every serial sequence at its start value while
-- the tables already contain rows, so the next INSERT reuses an existing id.
-- The application refuses such inserts (app/lib/db/sequenceGuard.ts) until this
-- script has been run.
--
-- WHAT: for every column in schema "public" whose default is nextval(...), move
-- its sequence so that the next generated value is MAX(column) + 1.
-- It only changes sequence positions — no table data is modified.
--
-- HOW: review, take a backup, then run once as the database owner, e.g.
--   psql "$DATABASE_URL" -f prisma/sql/repair_sequences.sql
-- Safe to re-run (idempotent).
-- ============================================================================

DO $$
DECLARE
  r   record;
  mx  bigint;
BEGIN
  FOR r IN
    SELECT c.table_schema,
           c.table_name,
           c.column_name,
           pg_get_serial_sequence(format('%I.%I', c.table_schema, c.table_name), c.column_name) AS seq
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_default LIKE 'nextval(%'
  LOOP
    IF r.seq IS NOT NULL THEN
      EXECUTE format('SELECT COALESCE(MAX(%I)::bigint, 0) FROM %I.%I', r.column_name, r.table_schema, r.table_name)
        INTO mx;
      -- mx > 0 : next value = mx + 1 ; empty table : next value = 1
      PERFORM setval(r.seq, GREATEST(mx, 1), mx > 0);
    END IF;
  END LOOP;
END $$;
