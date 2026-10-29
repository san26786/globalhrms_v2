#!/usr/bin/env bash
# Loads a MariaDB/MySQL dump (.sql.gz) of the live GlobalHR database into a NEW PostgreSQL
# database for the app (globalhr_live). The team's shared globalhr database is only read
# (for its table structure) and never changed.
#
# Run on the server as root, with import-from-cpanel-mysql.sh, repair_sequences.sql and
# legacy-views.sql in the same folder as this script:
#   bash /root/load-live-dump.sh /root/<dump>.sql.gz
#
# Steps:
#   1. Checks: root, the dump is a complete gzip, MySQL and PostgreSQL reachable, disk space.
#   2. Creates the MySQL database ghr_live_import and loads the dump into it.
#      Stops if it already exists, unless --reuse-mysql (use it as it is) or --fresh-mysql
#      (drop and reload it; only this script's own database is ever dropped).
#   3. Creates the PostgreSQL database globalhr_live with the same tables, views and owners
#      as globalhr (structure only, no rows). Stops if it already exists, unless --reuse-pg.
#   4. Runs import-from-cpanel-mysql.sh with MYSQL_DB=ghr_live_import PG_DB=globalhr_live:
#      it backs up globalhr_live, asks for YES, copies the rows and compares counts.
# Everything printed is also saved to load-live-<date-time>.log next to this script.
set -euo pipefail

DUMP="${1:?Usage: bash load-live-dump.sh /root/<dump>.sql.gz [--reuse-mysql|--fresh-mysql] [--reuse-pg]}"
shift
REUSE_MYSQL=0
FRESH_MYSQL=0
REUSE_PG=0
for arg in "$@"; do
  case "$arg" in
    --reuse-mysql) REUSE_MYSQL=1 ;;
    --fresh-mysql) FRESH_MYSQL=1 ;;
    --reuse-pg) REUSE_PG=1 ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

MYSQL_DB=ghr_live_import
SRC_PG_DB=globalhr
PG_DB=globalhr_live
HERE="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
exec > >(tee -a "$HERE/load-live-${STAMP}.log") 2>&1
cd /tmp

as_postgres() { runuser -u postgres -- env HOME=/tmp "$@"; }
psql_on() { local db="$1"; shift; as_postgres psql -X -q -v ON_ERROR_STOP=1 -d "$db" "$@"; }
my() { mysql -N -B "$@"; }

echo "== 1. Checks"
[ "$(id -u)" -eq 0 ] || { echo "Run this as root."; exit 1; }
[ -f "$DUMP" ] || { echo "Dump not found: $DUMP"; exit 1; }
for f in import-from-cpanel-mysql.sh repair_sequences.sql legacy-views.sql; do
  [ -f "$HERE/$f" ] || { echo "Missing $HERE/$f - copy it next to this script. Nothing was changed."; exit 1; }
done
echo "Testing the dump file..."
gzip -t "$DUMP" || { echo "The dump is incomplete or damaged (gzip test failed). Upload it again. Nothing was changed."; exit 1; }
echo "Dump: $(du -h "$DUMP" | cut -f1) compressed, $(( $(gzip -dc "$DUMP" | wc -c) / 1048576 )) MB of SQL"
my -e "SELECT 1" >/dev/null || { echo "Cannot connect to MySQL as root (check /root/.my.cnf). Nothing was changed."; exit 1; }
echo "MySQL server: $(my -e 'SELECT VERSION()')"
psql_on "$SRC_PG_DB" -Atc "SELECT 1" >/dev/null || { echo "Cannot read PostgreSQL database $SRC_PG_DB. Nothing was changed."; exit 1; }
echo "PostgreSQL: $(psql_on postgres -Atc 'SHOW server_version')"
if [ "$(my -e "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='globalin_latest'")" -gt 0 ]; then
  echo "Note: a MySQL database named globalin_latest also exists on this server. It is not touched."
fi
echo "Free disk space:"
df -h "$HERE" "$(my -e 'SELECT @@datadir')" "$(psql_on postgres -Atc 'SHOW data_directory')" | sed 's/^/  /'

echo "== 2. MySQL database $MYSQL_DB"
mysql_exists="$(my -e "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='$MYSQL_DB'")"
if [ "$mysql_exists" -gt 0 ] && [ "$FRESH_MYSQL" -eq 1 ]; then
  echo "Dropping the previous $MYSQL_DB (--fresh-mysql)..."
  my -e "DROP DATABASE \`$MYSQL_DB\`"
  mysql_exists=0
fi
if [ "$mysql_exists" -gt 0 ] && [ "$REUSE_MYSQL" -eq 0 ]; then
  echo "MySQL database $MYSQL_DB already exists. Re-run with --reuse-mysql to import from it as it is,"
  echo "or with --fresh-mysql to drop it and load the dump again. Nothing was changed."
  exit 1
fi
if [ "$mysql_exists" -eq 0 ]; then
  my -e "CREATE DATABASE \`$MYSQL_DB\` CHARACTER SET utf8mb4"
  # MariaDB 10.11 dumps carry "sandbox mode" markers (one per section) that MySQL and older
  # MariaDB reject, and name utf8 "utf8mb3", which servers before MariaDB 10.6 / MySQL 8.0.30 don't know.
  FILTER='/^\/\*M!999999.*sandbox mode \*\/[[:space:]]*$/d'
  if [ "$(my -e "SELECT COUNT(*) FROM information_schema.collations WHERE collation_name='utf8mb3_general_ci'")" -eq 0 ]; then
    echo "This server does not know utf8mb3; the dump's utf8mb3 names are read as utf8."
    FILTER="$FILTER;s/utf8mb3/utf8/g"
  fi
  echo "Loading the dump into $MYSQL_DB (several minutes; the server stays usable)..."
  if ! gzip -dc "$DUMP" | sed -e "$FILTER" | mysql --default-character-set=utf8mb4 "$MYSQL_DB"; then
    echo "Loading the dump failed (see the MySQL error above). $MYSQL_DB is left as it is;"
    echo "after fixing, re-run with --fresh-mysql. PostgreSQL was not changed."
    exit 1
  fi
else
  echo "Reusing the existing $MYSQL_DB (--reuse-mysql)."
fi
echo "In $MYSQL_DB: $(my -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$MYSQL_DB' AND table_type='BASE TABLE'") tables, $(my -e "SELECT COUNT(*) FROM information_schema.views WHERE table_schema='$MYSQL_DB'") views, $(my -e "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema='$MYSQL_DB'") triggers"
echo "Users in the dump: $(my -e "SELECT COUNT(*) FROM \`$MYSQL_DB\`.user_mst" 2>/dev/null || echo '?')"

echo "== 3. PostgreSQL database $PG_DB (structure copied from $SRC_PG_DB)"
pg_exists="$(psql_on postgres -Atc "SELECT COUNT(*) FROM pg_database WHERE datname='$PG_DB'")"
if [ "$pg_exists" -gt 0 ] && [ "$REUSE_PG" -eq 0 ]; then
  echo "PostgreSQL database $PG_DB already exists. Re-run with --reuse-pg to fill it again"
  echo "(its rows are replaced; a backup is taken first). Nothing was changed in PostgreSQL."
  exit 1
fi
if [ "$pg_exists" -eq 0 ]; then
  read -r owner enc coll ctype < <(psql_on postgres -AtF ' ' -c "SELECT pg_get_userbyid(datdba), pg_encoding_to_char(encoding), datcollate, datctype FROM pg_database WHERE datname='$SRC_PG_DB'")
  echo "Creating $PG_DB (owner $owner, $enc)..."
  as_postgres createdb -O "$owner" -T template0 -E "$enc" --lc-collate="$coll" --lc-ctype="$ctype" "$PG_DB"
  echo "Copying the table structure of $SRC_PG_DB (no rows)..."
  SCHEMA_SQL="/tmp/${PG_DB}-schema-${STAMP}.sql"
  as_postgres pg_dump -s "$SRC_PG_DB" > "$SCHEMA_SQL"
  # If globalhr's "public" schema was re-created at some point, the dump creates it itself.
  if grep -q '^CREATE SCHEMA public;' "$SCHEMA_SQL"; then psql_on "$PG_DB" -c 'DROP SCHEMA public CASCADE;'; fi
  if ! psql_on "$PG_DB" < "$SCHEMA_SQL" >/dev/null; then
    echo "Copying the structure failed; dropping the half-made $PG_DB. $SRC_PG_DB was not changed."
    as_postgres dropdb "$PG_DB"
    rm -f "$SCHEMA_SQL"
    exit 1
  fi
  rm -f "$SCHEMA_SQL"
  # Same database-level rights as globalhr (CONNECT/CREATE/TEMP for the app's role).
  psql_on postgres -Atc "SELECT 'GRANT ' || privilege_type || ' ON DATABASE \"$PG_DB\" TO \"' || pg_get_userbyid(grantee) || '\";'
    FROM pg_database d, aclexplode(d.datacl) a WHERE d.datname='$SRC_PG_DB' AND a.grantee <> 0" | psql_on postgres
fi
echo "Tables in $PG_DB: $(psql_on "$PG_DB" -Atc "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public'")"

echo "== 4. Copy the rows: $MYSQL_DB -> $PG_DB"
MYSQL_DB="$MYSQL_DB" PG_DB="$PG_DB" bash "$HERE/import-from-cpanel-mysql.sh"

echo
echo "Done. The app can now use PostgreSQL database $PG_DB (only the database name in DATABASE_URL changes)."
echo "$SRC_PG_DB was not changed."
