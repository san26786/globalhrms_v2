/**
 * Seeds the `common_type` lookup table from db_local.json.
 *
 * The JSON emulator in db.ts calls this data "type_mst", but the real table in
 * schema.prisma is `common_type` — same 24 columns, uppercased.
 *
 *   node scripts/seed-common-type.mjs
 *
 * Reads DATABASE_URL from .env, so it writes to whichever database that points
 * at. Safe to re-run: existing TYP_IDs are left alone.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

// --- Values the seed data does not supply, but common_type declares NOT NULL.
// Change these if your system expects different values.
const FALLBACK_ORIGINATING_SYSTEM = "GlobalHRMS";
const FALLBACK_APP_CD = "GHR";
const FALLBACK_APP_ID = 0;

const COLUMNS = [
  ["TYP_ID", "typ_id", toInt],
  ["TYP_CD", "typ_cd", toText],
  ["TYP_NM", "typ_nm", toText],
  ["VIEW_NM", "view_nm", toText],
  ["PARENT_TYP_ID", "parent_typ_id", toInt],
  ["IS_EDITABLE", "is_editable", toBool],
  ["IS_PREDEFINED", "is_predefined", toBool],
  ["TABLE_TYPE", "table_type", toText],
  ["VISIBLE_TO_USER_FLAG", "visible_to_user_flag", toInt],
  ["USER_CAN_CREATE_DATA", "user_can_create_data", (v) => toInt(v) ?? 0],
  ["ORIGINATING_MODULE", "originating_module", toText],
  ["MODULE_SEQ", "module_seq", toInt],
  ["ORIGINATING_SYSTEM", "originating_system", (v, row) =>
    toText(v) ?? toText(row.originating_module) ?? FALLBACK_ORIGINATING_SYSTEM],
  ["IS_DELETED", "is_deleted", toBool],
  ["OA_ID", "oa_id", toInt],
  ["OA_BRAND_ID", "oa_brand_id", toInt],
  ["USER_ID", "user_id", toInt],
  ["CREATED_BY", "created_by", toInt],
  ["UPDATED_BY", "updated_by", toInt],
  ["CREATED_ON", "created_on", toDate],
  ["UPDATED_ON", "updated_on", toDate],
  ["REPLICATE_DATA_FOR_ALL_BRANDS", "replicate_data_for_all_brands", toInt],
  ["APP_ID", "app_id", (v) => toInt(v) ?? FALLBACK_APP_ID],
  ["APP_CD", "app_cd", (v) => toText(v) ?? FALLBACK_APP_CD],
];

function toText(v) {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

function toInt(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toBool(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v;
  return v === "1" || v === 1 || String(v).toLowerCase() === "true";
}

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Check your .env file.");
  }

  const jsonPath = path.join(process.cwd(), "db_local.json");

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Could not find ${jsonPath} — run this from the project root.`);
  }

  const rows = JSON.parse(fs.readFileSync(jsonPath, "utf-8"))?.tables?.type_mst ?? [];

  if (rows.length === 0) {
    console.log("No rows found under tables.type_mst in db_local.json. Nothing to do.");
    return;
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  const target = new URL(process.env.DATABASE_URL);
  console.log(`Seeding common_type at ${target.host}${target.pathname} — ${rows.length} rows to consider.`);

  const columnList = COLUMNS.map(([col]) => `"${col}"`).join(", ");
  const placeholders = COLUMNS.map((_, i) => `$${i + 1}`).join(", ");
  const sql =
    `INSERT INTO common_type (${columnList}) VALUES (${placeholders}) ` +
    `ON CONFLICT ("TYP_ID") DO NOTHING`;

  let inserted = 0;
  let skipped = 0;

  try {
    await client.query("BEGIN");

    for (const row of rows) {
      const values = COLUMNS.map(([, key, coerce]) => coerce(row[key], row));
      const result = await client.query(sql, values);

      if (result.rowCount === 1) {
        inserted += 1;
      } else {
        skipped += 1;
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "42P01") {
      throw new Error(
        "Table common_type does not exist. Run `npx prisma db push` against this database first."
      );
    }
    throw error;
  } finally {
    client.release();
  }

  const { rows: [{ count }] } = await pool.query("SELECT count(*)::int AS count FROM common_type");
  console.log(`Inserted ${inserted}, skipped ${skipped} already present. common_type now holds ${count} rows.`);

  await pool.end();
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
