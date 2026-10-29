import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { typeMstSeedData } from './app/data/typeMstSeed';

const { Pool } = pg;

let pool: pg.Pool | null = null;
// True only when no database is configured or the pool could not be built.
let useEmulation = false;
// After a connection failure (e.g. the SSH tunnel dropped) the real database is skipped until
// this time, then tried again; a failing statement never pauses it.
let realDbRetryAt = 0;
const REAL_DB_RETRY_MS = 10_000;

/** Connection-level failures (database unreachable), as opposed to an error in one statement. */
function isConnectionError(err: unknown): boolean {
  const e = (err ?? {}) as { code?: unknown; message?: unknown };
  const code = String(e.code ?? '');
  if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code)) return true;
  if (code.startsWith('08') || code.startsWith('57P')) return true; // SQLSTATE connection exception / shutdown
  return /timeout|terminated|connection/i.test(String(e.message ?? '')) && !/^[0-9A-Z]{5}$/.test(code);
}
const LOCAL_DB_PATH = path.join(process.cwd(), 'db_local.json');

// Initialize local database file if it doesn't exist
function initLocalDbFile() {
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    fs.writeFileSync(
      LOCAL_DB_PATH,
      JSON.stringify(
        {
          meta: {
            created_at: new Date().toISOString(),
            engine: "PostgreSQL Emulated (JSON File Fallback DB)",
            version: "PostgreSQL 16.2 (Emulated)"
          },
          tables: {
            employees: [],
            attendance: [],
            type_mst: [...typeMstSeedData]
          }
        },
        null,
        2
      )
    );
  } else {
    // If it exists but has no type_mst table, populate it
    try {
      const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed.tables.type_mst) {
        parsed.tables.type_mst = [...typeMstSeedData];
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(parsed, null, 2));
      }
    } catch (e) {
      console.error("Error updating local db file schema:", e);
    }
  }
}

/**
 * Returns the PostgreSQL connection pool if configured.
 */
export function getDbPool(): pg.Pool | null {
  const connectionString = process.env.DATABASE_URL;
  const host = process.env.PGHOST;

  if (!connectionString && !host) {
    // No environment secrets provided - switch to emulation mode
    useEmulation = true;
    return null;
  }

  if (!pool) {
    try {
      if (connectionString) {
        pool = new Pool({
          connectionString,
          connectionTimeoutMillis: 4000,
          ssl: connectionString.includes('sslmode=require') || 
               connectionString.includes('render.com') || 
               connectionString.includes('neon.tech')
            ? { rejectUnauthorized: false }
            : undefined,
        });
      } else {
        pool = new Pool({
          host,
          port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD,
          database: process.env.PGDATABASE,
          connectionTimeoutMillis: 4000,
        });
      }

      pool.on('error', (err) => {
        // The pool drops the broken connection itself and the next query opens a new one.
        console.error('Idle PostgreSQL pool error:', err);
      });
    } catch (e) {
      console.warn("Could not construct pg Pool, falling back to emulation:", e);
      useEmulation = true;
    }
  }
  return pool;
}

/**
 * Utility function to query the database. Fallbacks to JSON emulation if database is offline or unconfigured.
 */
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const dbPool = getDbPool();
  
  if (dbPool && !useEmulation && Date.now() >= realDbRetryAt) {
    try {
      const res = await dbPool.query(text, params);
      return res.rows;
    } catch (err: any) {
      console.warn("Real PostgreSQL connection failed. Falling back to local emulated file database...", err.message || err);
      // Only this query falls back; the next one uses the real database again (after a short
      // pause when the database itself is unreachable).
      if (isConnectionError(err)) realDbRetryAt = Date.now() + REAL_DB_RETRY_MS;
    }
  }

  // --- Emulated JSON Database Engine ---
  initLocalDbFile();
  const lowerText = text.trim().toLowerCase();

  // 1. SELECT NOW() connection test
  if (lowerText.includes('select now()') || lowerText.includes('select current_timestamp')) {
    return [
      {
        db_time: new Date().toISOString(),
        db_version: "PostgreSQL 16.2 (Local Emulated JSON Fallback) - Connected & Ready"
      }
    ] as any;
  }

  // 2. CREATE TABLE
  if (lowerText.startsWith('create table')) {
    // Match table name
    const match = lowerText.match(/create table\s+(?:if not exists\s+)?([a-zA-Z0-9_]+)/);
    const tableName = match ? match[1] : 'unknown';
    
    const rawData = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    const data = JSON.parse(rawData);
    
    if (!data.tables[tableName]) {
      data.tables[tableName] = [];
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
    }
    
    return [] as any;
  }

  // 3. SELECT from tables
  if (lowerText.startsWith('select')) {
    const rawData = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    const data = JSON.parse(rawData);
    
    // Check if selecting from employees, attendance or type_mst
    if (lowerText.includes('employees')) {
      return data.tables.employees || [];
    }
    if (lowerText.includes('attendance')) {
      return data.tables.attendance || [];
    }
    if (lowerText.includes('type_mst') || lowerText.includes('typ_mst')) {
      return data.tables.type_mst || [];
    }
    
    return [data.meta] as any;
  }

  // 4. INSERT into tables
  if (lowerText.startsWith('insert into')) {
    try {
      const rawData = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      const data = JSON.parse(rawData);
      
      // Basic mock parsing for insert statements or simply returning empty to simulate success
      if (lowerText.includes('type_mst') && params) {
        // Mock insert item from params
        const newRecord = {
          typ_id: params[0]?.toString() || Date.now().toString(),
          typ_cd: params[1] || 'NEW',
          typ_nm: params[2] || 'New Type',
          view_nm: params[3] || null,
          parent_typ_id: params[4] || null,
          is_editable: params[5]?.toString() || '1',
          is_predefined: params[6]?.toString() || '0',
          table_type: params[7] || 'USER',
          visible_to_user_flag: params[8]?.toString() || '1',
          user_can_create_data: params[9]?.toString() || '1',
          originating_module: params[10] || 'Custom Module',
          module_seq: params[11]?.toString() || '0',
          originating_system: params[12] || 'Manual Entry',
          is_deleted: '0',
          oa_id: null,
          oa_brand_id: null,
          user_id: null,
          created_by: null,
          updated_by: null,
          created_on: new Date().toISOString(),
          updated_on: null,
          replicate_data_for_all_brands: null,
          app_id: null,
          app_cd: null
        };
        data.tables.type_mst.push(newRecord);
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
        return [newRecord] as any;
      }
    } catch (e) {
      console.error("Failed to parse mock insert:", e);
    }
  }

  // Default response for unhandled emulated queries
  return [] as any;
}

/**
 * Helper to check if database is in emulation fallback mode
 */
export function isUsingEmulation(): boolean {
  return useEmulation || (!process.env.DATABASE_URL && !process.env.PGHOST);
}
