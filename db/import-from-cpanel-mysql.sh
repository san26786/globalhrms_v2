#!/usr/bin/env bash
# Copies every row from the cPanel MySQL database (mydevportals_db) into the
# server's PostgreSQL database (globalhr) that the app uses.
#
# Run on the server as root, with repair_sequences.sql and legacy-views.sql in
# the same folder as this script:
#   bash /root/import-from-cpanel-mysql.sh
#
# Steps:
#   1. Checks MySQL, PostgreSQL and pgloader (installs pgloader if missing),
#      and test-connects pgloader to both databases.
#   2. Backs up globalhr with pg_dump.
#   3. Asks for YES.
#   4. pgloader copies MySQL into a separate staging schema (mysql_import), creating
#      its own tables there. The app's tables in "public" are not touched by this step.
#   5. In ONE transaction: empties the matching "public" tables and fills them from the
#      staging copy, using only the columns both sides have and converting types to the
#      app's column types. A table that fails is reported and left empty; others go on.
#   6. Moves ID sequences past the imported ids and recreates the legacy views.
#   7. Compares row counts table by table, then drops the staging schema.
# mydevportals_db is only read, never modified. Safe to re-run.
# Everything printed is also saved to import-<date-time>.log next to this script.
# Other databases: MYSQL_DB=<source> PG_DB=<target> bash import-from-cpanel-mysql.sh
# (load-live-dump.sh uses this to fill globalhr_live from an uploaded dump).
set -euo pipefail

MYSQL_DB="${MYSQL_DB:-mydevportals_db}"
PG_DB="${PG_DB:-globalhr}"
STAGING=mysql_import
HERE="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$HERE/${PG_DB}_backup_${STAMP}.dump"
TMP_MYSQL_USER=pgl_import_tmp
exec > >(tee -a "$HERE/import-${STAMP}.log") 2>&1

# Leftovers from an earlier run that crashed or lost its connection.
pkill -f 'pgloader.*/tmp/globalhr-import\.' 2>/dev/null || true
rm -rf /tmp/globalhr-import.*
WORK="$(mktemp -d /tmp/globalhr-import.XXXXXX)"
cd /tmp

as_postgres() { runuser -u postgres -- env HOME=/tmp "$@"; }
pg() { as_postgres psql -X -q -v ON_ERROR_STOP=1 -d "$PG_DB" "$@"; }
my() { mysql -N -B "$@"; }

cleanup() {
  my -e "DROP USER IF EXISTS '${TMP_MYSQL_USER}'@'127.0.0.1';" 2>/dev/null || true
  [ -d "$WORK/pgloader" ] && cp -r "$WORK/pgloader" "$HERE/pgloader-logs-${STAMP}" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "== 1. Checks"
[ "$(id -u)" -eq 0 ] || { echo "Run this as root."; exit 1; }
for f in repair_sequences.sql legacy-views.sql; do
  [ -f "$HERE/$f" ] || { echo "Missing $HERE/$f - copy it next to this script."; exit 1; }
done
my -e "SELECT 1" >/dev/null || { echo "Cannot connect to MySQL as root (check /root/.my.cnf)."; exit 1; }
pg -Atc "SELECT 1" >/dev/null || { echo "Cannot connect to PostgreSQL database $PG_DB as postgres."; exit 1; }
echo "PostgreSQL: $(pg -Atc 'SHOW server_version')"

if ! command -v pgloader >/dev/null; then
  echo "Installing pgloader..."
  if command -v dnf >/dev/null; then dnf install -y pgloader || true
  elif command -v yum >/dev/null; then yum install -y pgloader || true
  elif command -v apt-get >/dev/null; then apt-get install -y pgloader || true
  fi
  command -v pgloader >/dev/null || { echo "pgloader could not be installed. Nothing was changed. Send this output to Claude."; exit 1; }
fi
pgloader --version | head -1

my -e "SELECT table_name FROM information_schema.tables WHERE table_schema='${MYSQL_DB}' AND table_type='BASE TABLE'" | LC_ALL=C sort > "$WORK/mysql.txt"
pg -Atc "SELECT tablename FROM pg_tables WHERE schemaname='public'" | LC_ALL=C sort > "$WORK/pg.txt"
LC_ALL=C comm -12 "$WORK/mysql.txt" "$WORK/pg.txt" > "$WORK/both.txt"
[ -s "$WORK/both.txt" ] || { echo "No table names match between the two databases. Nothing was changed."; exit 1; }

echo "MySQL tables: $(wc -l < "$WORK/mysql.txt") | PostgreSQL tables: $(wc -l < "$WORK/pg.txt") | in both (will be copied): $(wc -l < "$WORK/both.txt")"
echo "Only in MySQL (skipped, first 20):"
LC_ALL=C comm -23 "$WORK/mysql.txt" "$WORK/pg.txt" | head -20 | sed 's/^/  /' || true
echo "MySQL data size: $(my -e "SELECT ROUND(SUM(data_length+index_length)/1024/1024) FROM information_schema.tables WHERE table_schema='${MYSQL_DB}'") MB"
echo "Rows in $PG_DB now: user_mst=$(pg -Atc 'SELECT count(*) FROM user_mst' 2>/dev/null || echo '?')"
df -h "$HERE" "$(pg -Atc 'SHOW data_directory')" | sed 's/^/  /'
free -m | sed 's/^/  /'
echo "Largest MySQL tables (table, rows, MB, average row bytes):"
my -e "SELECT table_name, table_rows, ROUND(data_length/1024/1024), avg_row_length FROM information_schema.tables
       WHERE table_schema='${MYSQL_DB}' AND table_type='BASE TABLE' ORDER BY data_length DESC LIMIT 8" | sed 's/^/  /'

# pgloader's Lisp heap defaults to 1 GB. Use up to 60% of RAM (max 8 GB) when this
# pgloader build accepts the runtime option.
HEAP_MB=$(( $(free -m | awk '/^Mem:/ {print $2}') * 60 / 100 ))
[ "$HEAP_MB" -gt 8192 ] && HEAP_MB=8192
PGL=(pgloader)
if [ "$HEAP_MB" -gt 1024 ] && as_postgres pgloader --dynamic-space-size "$HEAP_MB" --version >/dev/null 2>&1; then
  PGL=(pgloader --dynamic-space-size "$HEAP_MB")
  echo "pgloader memory limit: ${HEAP_MB} MB"
else
  echo "pgloader memory limit: 1024 MB (this build cannot be raised)"
fi

TMP_PW="$(openssl rand -hex 16)"
my -e "DROP USER IF EXISTS '${TMP_MYSQL_USER}'@'127.0.0.1';
       CREATE USER '${TMP_MYSQL_USER}'@'127.0.0.1' IDENTIFIED BY '${TMP_PW}';
       GRANT SELECT, SHOW VIEW ON \`${MYSQL_DB}\`.* TO '${TMP_MYSQL_USER}'@'127.0.0.1';"

# Datetimes are kept as "timestamp" (no time zone) so wall-clock values are never shifted.
# DATE columns are staged as text because MySQL holds dates PostgreSQL rejects
# (0000-00-00, 0000-01-01); step 5 turns those into NULL.
SOCK="$(pg -Atc 'SHOW unix_socket_directories' | cut -d, -f1 | xargs)"
PORT="$(pg -Atc 'SHOW port')"
write_load() { # <load file> <file listing the tables to copy>
  cat > "$1" <<EOF
LOAD DATABASE
  FROM mysql://${TMP_MYSQL_USER}:${TMP_PW}@127.0.0.1:3306/${MYSQL_DB}
  INTO postgresql://postgres@unix:${SOCK}:${PORT}/${PG_DB}
WITH include drop, create tables, create no indexes, no foreign keys, reset no sequences,
     quote identifiers, workers = 2, concurrency = 1, prefetch rows = 5000, batch rows = 2000
CAST type enum to text drop typemod,
     type set to text drop typemod,
     type date to text drop default drop not null drop typemod,
     type datetime to timestamp drop default drop not null using zero-dates-to-null,
     type timestamp to timestamp drop default drop not null using zero-dates-to-null
INCLUDING ONLY TABLE NAMES MATCHING $(sed "s/.*/'&'/" "$2" | paste -sd, -)
ALTER SCHEMA '${MYSQL_DB}' RENAME TO '${STAGING}'
;
EOF
  chown -R postgres "$WORK"
  chmod 700 "$WORK"
}
mysql_counts() { # exact row count of every table in both.txt -> $WORK/mysql_counts.txt
  [ -s "$WORK/mysql_counts.txt" ] && return
  local q="" t
  while read -r t; do q+="${q:+ UNION ALL }SELECT '$t', COUNT(*) FROM \`${MYSQL_DB}\`.\`$t\`"; done < "$WORK/both.txt"
  my -e "$q" | LC_ALL=C sort > "$WORK/mysql_counts.txt"
}
write_load "$WORK/import.load" "$WORK/both.txt"

as_postgres "${PGL[@]}" --dry-run --root-dir "$WORK/pgloader" "$WORK/import.load" \
  || { echo "pgloader cannot connect to both databases. Nothing was changed. Send this output to Claude."; exit 1; }

echo "== 2. Backup"
as_postgres pg_dump -Fc "$PG_DB" > "$BACKUP"
echo "Saved $BACKUP ($(du -h "$BACKUP" | cut -f1))"

echo "== 3. Confirm"
echo "This REPLACES the data in up to $(wc -l < "$WORK/both.txt") tables in PostgreSQL '$PG_DB' with the data from MySQL '$MYSQL_DB'."
echo "The copy runs unattended after this (roughly 20-40 minutes)."
read -r -p "Type YES to continue: " answer
[ "$answer" = "YES" ] || { echo "Stopped. Nothing was changed (backup kept at $BACKUP)."; exit 1; }

echo "== 4. Copy MySQL into staging schema '$STAGING' (app tables untouched)"
if [ "${1:-}" = "--reuse-staging" ] && [ "$(pg -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='$STAGING'")" -gt 0 ]; then
  echo "Reusing the staging copy from the previous run (--reuse-staging); re-copying only incomplete tables."
  mysql_counts
  pg -Atc "SELECT tablename FROM pg_tables WHERE schemaname='$STAGING'" | LC_ALL=C sort > "$WORK/staged.txt"
  LC_ALL=C comm -12 "$WORK/both.txt" "$WORK/staged.txt" > "$WORK/staged_both.txt"
  q=""
  while read -r t; do q+="${q:+ UNION ALL }SELECT '$t', COUNT(*) FROM \"$STAGING\".\"$t\""; done < "$WORK/staged_both.txt"
  pg -At -F $'\t' -c "$q" | LC_ALL=C sort > "$WORK/staged_counts.txt"
  LC_ALL=C join -t $'\t' -a 1 -e MISSING -o 0,1.2,2.2 "$WORK/mysql_counts.txt" "$WORK/staged_counts.txt" \
    | awk -F'\t' '$2!=$3 {print $1}' > "$WORK/reload.txt"
  echo "Tables to re-copy from MySQL: $(wc -l < "$WORK/reload.txt")"
  if [ -s "$WORK/reload.txt" ]; then
    write_load "$WORK/reload.load" "$WORK/reload.txt"
    if ! as_postgres "${PGL[@]}" --root-dir "$WORK/pgloader" "$WORK/reload.load"; then
      echo "pgloader stopped with an error. The app's tables were NOT changed. Send this output to Claude."
      exit 1
    fi
  fi
else
  pg -c "DROP SCHEMA IF EXISTS \"$STAGING\" CASCADE;"
  if ! as_postgres "${PGL[@]}" --root-dir "$WORK/pgloader" "$WORK/import.load"; then
    echo "pgloader stopped with an error. The app's tables were NOT changed. Send this output to Claude."
    exit 1
  fi
fi
STAGED="$(pg -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='$STAGING'")"
echo "Staging tables created: $STAGED"
[ "$STAGED" -gt 0 ] || { echo "pgloader created no staging tables. The app's tables were NOT changed. Send this output to Claude."; exit 1; }

echo "== 5. Move staging data into the app's tables (one transaction)"
rm -f /tmp/globalhr-import-failed.txt
if ! pg -v staging="$STAGING" <<'SQL'
BEGIN;
SELECT set_config('session_replication_role', 'replica', true) \g /dev/null
CREATE TEMP TABLE import_result (table_name text, rows bigint, error text, note text) ON COMMIT PRESERVE ROWS;
SELECT set_config('import.staging', :'staging', true) \g /dev/null

DO $$
DECLARE
  staging   text := current_setting('import.staging');
  t         text;
  cols      text;
  exprs     text;
  n         bigint;
  total     bigint;
  num_types oid[] := ARRAY['smallint','integer','bigint','numeric','real','double precision']::regtype[]::oid[];
  str_types oid[] := ARRAY['text','character varying','character']::regtype[]::oid[];
  date_types oid[] := ARRAY['timestamp without time zone','timestamp with time zone','date']::regtype[]::oid[];
BEGIN
  -- Empty every app table that has a staging copy, all at once (CASCADE covers tables
  -- with foreign keys to them, e.g. login sessions).
  SELECT string_agg(format('public.%I', s.relname), ', ')
    INTO cols
    FROM pg_class s
    JOIN pg_namespace sn ON sn.oid = s.relnamespace AND sn.nspname = staging
    JOIN pg_class p ON p.relname = s.relname AND p.relkind = 'r'
    JOIN pg_namespace pn ON pn.oid = p.relnamespace AND pn.nspname = 'public'
   WHERE s.relkind = 'r';
  EXECUTE 'TRUNCATE ' || cols || ' CASCADE';

  FOR t IN
    SELECT s.relname
      FROM pg_class s
      JOIN pg_namespace sn ON sn.oid = s.relnamespace AND sn.nspname = staging
      JOIN pg_class p ON p.relname = s.relname AND p.relkind = 'r'
      JOIN pg_namespace pn ON pn.oid = p.relnamespace AND pn.nspname = 'public'
     WHERE s.relkind = 'r'
     ORDER BY s.relname
  LOOP
    -- Columns present on both sides, converted to the app's column type. Casting to the
    -- base type (no length) lets an over-long value fail loudly instead of being cut.
    -- MySQL zero dates arrive as NULL; a NOT NULL date column gets 1970-01-01 instead,
    -- which the app already reads as "never" (see findLastLoginAt).
    SELECT string_agg(format('%I', tc.attname), ', ' ORDER BY tc.attnum),
           string_agg(CASE
             WHEN tc.attnotnull AND tc.atttypid = ANY (date_types)
               THEN format('COALESCE(%s, %L::%s)', x.e, '1970-01-01 00:00:00', format_type(tc.atttypid, NULL))
             ELSE x.e
           END, ', ' ORDER BY tc.attnum)
      INTO cols, exprs
      FROM pg_attribute tc
      JOIN pg_attribute sc
        ON sc.attrelid = format('%I.%I', staging, t)::regclass
       AND sc.attname = tc.attname AND sc.attnum > 0 AND NOT sc.attisdropped
      CROSS JOIN LATERAL (SELECT CASE
             WHEN sc.atttypid = tc.atttypid THEN format('%I', sc.attname)
             WHEN tc.atttypid = 'boolean'::regtype AND sc.atttypid = ANY (num_types)
               THEN format('(%I <> 0)', sc.attname)
             WHEN sc.atttypid = 'boolean'::regtype AND tc.atttypid = ANY (str_types)
               THEN format('(%I::int)::text', sc.attname)
             WHEN sc.atttypid = 'boolean'::regtype
               THEN format('%I::int', sc.attname)
             WHEN tc.atttypid = ANY (date_types) AND sc.atttypid = ANY (str_types)
               THEN format('CASE WHEN %1$I ~ %2$L THEN NULL ELSE %1$I::%3$s END',
                           sc.attname, '^(0000|$)|-00(-|$|[ T])', format_type(tc.atttypid, NULL))
             ELSE format('%I::%s', sc.attname, format_type(tc.atttypid, NULL))
           END AS e) x
     WHERE tc.attrelid = format('public.%I', t)::regclass
       AND tc.attnum > 0 AND NOT tc.attisdropped;

    IF cols IS NULL THEN
      INSERT INTO import_result VALUES (t, 0, 'no columns in common', NULL);
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM %I.%I', t, cols, exprs, staging, t);
      GET DIAGNOSTICS n = ROW_COUNT;
      INSERT INTO import_result VALUES (t, n, NULL, NULL);
    EXCEPTION
      -- MySQL kept duplicate ids where the app's table has a unique key: keep the first row per key.
      WHEN unique_violation THEN
        BEGIN
          EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM %I.%I ON CONFLICT DO NOTHING', t, cols, exprs, staging, t);
          GET DIAGNOSTICS n = ROW_COUNT;
          EXECUTE format('SELECT count(*) FROM %I.%I', staging, t) INTO total;
          INSERT INTO import_result VALUES (t, n, NULL, format('%s duplicate rows skipped', total - n));
        EXCEPTION WHEN OTHERS THEN
          INSERT INTO import_result VALUES (t, 0, SQLERRM, NULL);
        END;
      WHEN OTHERS THEN
        INSERT INTO import_result VALUES (t, 0, SQLERRM, NULL);
    END;
  END LOOP;
END $$;

COMMIT;

\echo Tables filled / failed / rows copied:
SELECT count(*) FILTER (WHERE error IS NULL), count(*) FILTER (WHERE error IS NOT NULL), sum(rows) FROM import_result;
\echo Tables with skipped duplicate rows:
SELECT table_name, note FROM import_result WHERE note IS NOT NULL ORDER BY table_name;
\echo Failed tables (first 40):
SELECT table_name, left(error, 200) FROM import_result WHERE error IS NOT NULL ORDER BY table_name LIMIT 40;
\t on
\a
\o /tmp/globalhr-import-failed.txt
SELECT table_name FROM import_result WHERE error IS NOT NULL;
\o
SQL
then
  echo "Moving the data failed and was rolled back. The app's tables were NOT changed. Send this output to Claude."
  exit 1
fi

echo "== 6. Fix ID sequences and views"
pg < "$HERE/repair_sequences.sql"
pg < "$HERE/legacy-views.sql"

echo "== 7. Compare row counts (MySQL vs app tables)"
mysql_counts
q=""
while read -r t; do q+="${q:+ UNION ALL }SELECT '$t', COUNT(*) FROM public.\"$t\""; done < "$WORK/both.txt"
pg -At -F $'\t' -c "$q" | LC_ALL=C sort > "$WORK/pg_counts.txt"
LC_ALL=C join -t $'\t' "$WORK/mysql_counts.txt" "$WORK/pg_counts.txt" > "$WORK/counts.txt"
awk -F'\t' '$2!=$3' "$WORK/counts.txt" > "$WORK/mismatch.txt" || true
echo "Tables with identical row counts: $(awk -F'\t' '$2==$3' "$WORK/counts.txt" | wc -l) of $(wc -l < "$WORK/counts.txt")"
echo "Rows in app tables: $(awk -F'\t' '{s+=$3} END {print s+0}' "$WORK/counts.txt") of $(awk -F'\t' '{s+=$2} END {print s+0}' "$WORK/counts.txt") in MySQL"
if [ -s "$WORK/mismatch.txt" ]; then
  echo "Tables that differ (table, MySQL rows, PostgreSQL rows), first 30:"
  head -30 "$WORK/mismatch.txt" | sed 's/^/  /'
fi
echo "user_mst rows: $(pg -Atc 'SELECT count(*) FROM user_mst')"

if [ -s /tmp/globalhr-import-failed.txt ]; then
  echo "Some tables failed, so the staging schema '$STAGING' is kept for fixing them."
  echo "Remove it later with: runuser -u postgres -- psql -d $PG_DB -c 'DROP SCHEMA \"$STAGING\" CASCADE'"
else
  pg -c "DROP SCHEMA \"$STAGING\" CASCADE;"
  echo "Staging schema '$STAGING' removed."
fi
rm -f /tmp/globalhr-import-failed.txt
echo "Backup of the old data: $BACKUP"
echo "Full output saved to: $HERE/import-${STAMP}.log"
echo "Done."
