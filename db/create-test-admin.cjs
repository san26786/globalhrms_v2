#!/usr/bin/env node
// Creates a test admin login in a working copy of the live data (globalhr_live), so the app can be
// checked without anyone's real account.
//
//   node db/create-test-admin.cjs [username] [brand code]      (defaults: devtest.gcon GCON)
//   add --dry-run to only check (no password asked, nothing written; the inserts are EXPLAINed).
//
// - Copies the settings and permission-class links of an existing active admin of the brand, but
//   none of their personal details: name, e-mail, password, security answers, passcode, tokens and
//   login counters are replaced or cleared, and no employee record is linked.
// - The password is typed here (hidden) and stored only as a bcrypt hash, like the app does.
// - Refuses any database other than globalhr_live (DATABASE_URL in .env). One transaction.
const path = require('path');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env'), quiet: true });
const { Client } = require(path.join(ROOT, 'node_modules/pg'));
const bcrypt = require(path.join(ROOT, 'node_modules/bcryptjs'));

const DRY_RUN = process.argv.includes('--dry-run');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const USERNAME = args[0] || 'devtest.gcon';
const BRAND = (args[1] || 'GCON').toUpperCase();
const EMAIL = `${USERNAME}@example.invalid`; // .invalid can never receive mail
const ALLOWED_DB = 'globalhr_live';
const REF_TYPE_USER_TO_CLASS = 65; // permission_dtl: user -> permission class (lib/menu/PermissionClass.ts)

/** Reads a line without echoing it. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (s) => {
      if (!muted || s.includes('\n')) rl.output.write(muted ? '\n' : s);
    };
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
    muted = true;
  });
}

/** Columns of a public table: name, nullability and whether it has a default. */
async function columnsOf(c, table) {
  const r = await c.query(
    `SELECT column_name, is_nullable = 'YES' AS nullable, column_default IS NOT NULL AS has_default, data_type
       FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table],
  );
  return r.rows;
}

async function primaryKeyOf(c, table) {
  const r = await c.query(
    `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = ('public.' || quote_ident($1))::regclass AND i.indisprimary`,
    [table],
  );
  return r.rows.map((x) => x.attname);
}

/** A value for a column that must be "empty" but may be NOT NULL. */
function emptyFor(col) {
  if (col.nullable) return 'NULL';
  if (/int|numeric|double|real/.test(col.data_type)) return '0';
  if (col.data_type === 'boolean') return 'false';
  if (/timestamp|date/.test(col.data_type)) return "TIMESTAMP '1970-01-01 00:00:00'";
  return "''";
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  await c.connect();
  const db = (await c.query('SELECT current_database() AS db')).rows[0].db;
  if (db !== ALLOWED_DB) throw new Error(`DATABASE_URL points at "${db}". This script only runs on ${ALLOWED_DB}.`);

  const brand = (await c.query('SELECT "OA_BRAND_ID", "OA_ID" FROM oa_brands WHERE upper("OA_BRAND_CD") = $1 LIMIT 1', [BRAND])).rows[0];
  if (!brand) throw new Error(`Brand ${BRAND} not found.`);

  const taken = await c.query('SELECT 1 FROM user_mst WHERE lower("USER_NAME") = lower($1) OR lower("REG_EMAIL_ID") = lower($2)', [USERNAME, EMAIL]);
  if (taken.rowCount) throw new Error(`A user named ${USERNAME} (or e-mail ${EMAIL}) already exists. Pick another name.`);

  // A non-deleted admin of the brand who has a permission class (active ones first): only their
  // settings and menus are copied; the new account itself is always set to Active below.
  const template = (
    await c.query(
      `SELECT u."USER_ID", u."USER_STATUS_ID",
              (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = u."USER_STATUS_ID" LIMIT 1) AS status
         FROM user_mst u
        WHERE u."OA_BRAND_ID" = $1 AND u."IS_ADMIN" = true AND COALESCE(u."IS_SYSADMIN", false) = false
          AND COALESCE(u."IS_DELETED", false) = false
          AND u."REG_EMAIL_ID" NOT LIKE '%@example.invalid' -- never copy another test account
          AND EXISTS (SELECT 1 FROM permission_dtl p WHERE p."PERMISSIONS_REF_TYPE_ID" = $2 AND p."PERMISSIONS_REF_ID" = u."USER_ID" AND p."OA_BRAND_ID" = $1)
        ORDER BY ((SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = u."USER_STATUS_ID" LIMIT 1) = 'USA') DESC,
                 u."LAST_LOGIN_AT" DESC NULLS LAST
        LIMIT 1`,
      [brand.OA_BRAND_ID, REF_TYPE_USER_TO_CLASS],
    )
  ).rows[0];
  if (!template) throw new Error(`No ${BRAND} admin with a permission class found to copy settings from.`);
  // "Active" (USA) within the user-status type: MSTR_CD alone is not unique (USS, USD are reused).
  const active = (
    await c.query(
      `SELECT a."MSTR_ID" FROM independent_mst a
        WHERE a."MSTR_CD" = 'USA' AND a."TYP_ID" = (SELECT im."TYP_ID" FROM independent_mst im WHERE im."MSTR_ID" = $1 LIMIT 1)
        LIMIT 1`,
      [template.USER_STATUS_ID],
    )
  ).rows[0];
  if (!active) throw new Error('The Active user status (USA) is not configured.');
  // Link exactly one permission class. With several and no role to break the tie, the app just takes
  // the first link (lib/menu/PermissionClass.ts), so pick deliberately: the template's class with
  // the most enabled functions.
  const klass = (
    await c.query(
      `SELECT l."PERMISSIONS_CLASS_ID" AS id,
              (SELECT count(*) FROM permission_dtl f WHERE f."PERMISSIONS_REF_TYPE_ID" = 1614 AND f."PERMISSIONS_CLASS_ID" = l."PERMISSIONS_CLASS_ID"
                  AND f."OA_BRAND_ID" = $2 AND f."PERMISSION_ENABLED" = 1 AND COALESCE(f."IS_DELETED", 0) = 0)::int AS functions,
              (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = l."PERMISSIONS_CLASS_ID" LIMIT 1) AS name
         FROM permission_dtl l
        WHERE l."PERMISSIONS_REF_TYPE_ID" = $3 AND l."PERMISSIONS_REF_ID" = $1 AND l."OA_BRAND_ID" = $2
        ORDER BY 2 DESC, 1 LIMIT 1`,
      [template.USER_ID, brand.OA_BRAND_ID, REF_TYPE_USER_TO_CLASS],
    )
  ).rows[0];
  const orgActive = (
    await c.query(
      `SELECT (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = o."OA_STATUS_ID" LIMIT 1) = 'OASA' AS ok FROM org_accounts o WHERE o."OA_ID" = $1`,
      [brand.OA_ID],
    )
  ).rows[0];
  console.log(`Brand ${BRAND}: settings copied from admin user #${template.USER_ID} (status ${template.status}); permission class "${klass.name}" (${klass.functions} functions); the new account is set to Active.`);
  if (!orgActive?.ok) console.log('Warning: the brand\'s organisation is not active, so sign-in will be refused until it is.');

  const password = DRY_RUN ? 'dry-run-password' : await askHidden(`Password for ${USERNAME} (min 8 characters, hidden): `);
  if (password.length < 8) throw new Error('Password too short. Nothing was created.');
  const again = DRY_RUN ? password : await askHidden('Type it again: ');
  if (again !== password) throw new Error('The two passwords differ. Nothing was created.');
  const hash = await bcrypt.hash(password, 12);

  // Copy the template row; replace or clear everything personal.
  const userCols = await columnsOf(c, 'user_mst');
  const userPk = await primaryKeyOf(c, 'user_mst');
  const set = {
    USER_NAME: '$1',
    REG_EMAIL_ID: '$2',
    PASSWORD: '$3',
    FIRST_NAME: "'Dev'",
    LAST_NAME: `'Test (${BRAND})'`,
    USER_STATUS_ID: String(active.MSTR_ID),
    IS_ADMIN: 'true',
    IS_SYSADMIN: 'false',
    IS_ONLINE: 'false',
    IS_PREDEFINED: 'false',
    IS_DELETED: 'false',
    CREATED_ON: 'now()',
    UPDATED_ON: 'now()',
    PASSWORD_CHANGED_TIME: 'now()',
  };
  const clear = [
    'EXT_REF_NBR', 'LAST_LOGIN_AT', 'ACTIVATION', 'PWD_RESET_CD', 'CONCURRENT_LOGIN_COUNT', 'SUSPENSION_FAILED_LOGIN_ATTEMPTS',
    'FAILED_LOGIN_ATTEMPTS', 'LAST_FAILED_ATTEMPT_ON', 'QUESTION_ONE', 'QUESTION_TWO', 'QUESTION_THREE', 'QUESTION_FOUR',
    'ANSWER_ONE', 'ANSWER_TWO', 'ANSWER_THREE', 'ANSWER_FOUR', 'TPIN', 'MEMORABLE_WORD', 'NOTIFY_COUNT', 'BATCH_ID',
    'REGISTER_TOKEN', 'PASS_RESET_TOKEN', 'PASS_TOKEN_EXPIRY',
  ];
  const insertCols = userCols.filter((col) => !userPk.includes(col.column_name));
  const exprs = insertCols.map((col) => {
    const name = col.column_name;
    if (name in set) return set[name];
    if (clear.includes(name)) return emptyFor(col);
    return `t."${name}"`;
  });

  if (DRY_RUN) {
    // EXPLAIN plans the statements (checking tables, columns and types) without running them.
    await c.query(
      `EXPLAIN INSERT INTO user_mst (${insertCols.map((col) => `"${col.column_name}"`).join(', ')})
       SELECT ${exprs.join(', ')} FROM user_mst t WHERE t."USER_ID" = $4`,
      [USERNAME, EMAIL, hash, template.USER_ID],
    );
    console.log(`Dry run OK: the user insert is valid (${insertCols.length} columns) and the account would get permission class "${klass.name}". Nothing was written.`);
    await c.end();
    return;
  }

  await c.query('BEGIN');
  try {
    const created = await c.query(
      `INSERT INTO user_mst (${insertCols.map((col) => `"${col.column_name}"`).join(', ')})
       SELECT ${exprs.join(', ')} FROM user_mst t WHERE t."USER_ID" = $4
       RETURNING "USER_ID"`,
      [USERNAME, EMAIL, hash, template.USER_ID],
    );
    const newId = created.rows[0].USER_ID;

    // One link to the chosen permission class, copied from the template admin's link to it.
    const permCols = await columnsOf(c, 'permission_dtl');
    const permPk = await primaryKeyOf(c, 'permission_dtl');
    const pCols = permCols.filter((col) => !permPk.includes(col.column_name));
    const pExprs = pCols.map((col) => {
      if (col.column_name === 'PERMISSIONS_REF_ID') return '$1';
      if (col.column_name === 'CREATED_ON' || col.column_name === 'UPDATED_ON') return 'now()';
      return `p."${col.column_name}"`;
    });
    const perms = await c.query(
      `INSERT INTO permission_dtl (${pCols.map((col) => `"${col.column_name}"`).join(', ')})
       SELECT ${pExprs.join(', ')} FROM permission_dtl p
        WHERE p."PERMISSIONS_REF_TYPE_ID" = $2 AND p."PERMISSIONS_REF_ID" = $3 AND p."OA_BRAND_ID" = $4 AND p."PERMISSIONS_CLASS_ID" = $5
        ORDER BY p."PERMISSIONS_DTL_ID" LIMIT 1`,
      [newId, REF_TYPE_USER_TO_CLASS, template.USER_ID, brand.OA_BRAND_ID, klass.id],
    );
    await c.query('COMMIT');
    console.log(`\nCreated test admin "${USERNAME}" (user #${newId}, brand ${BRAND}) with permission class "${klass.name}".`);
    console.log(`Sign in at http://localhost:3000/login with username ${USERNAME} and the password you just typed.`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error(`\nNot created: ${e.message}`);
  process.exit(1);
});
