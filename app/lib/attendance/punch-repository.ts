import { prisma } from '@/lib/prisma';

type Db = Pick<typeof prisma, 'emp_attendance_record'>;

/** CI: employee_records_m->getAttndEmpID($USER_ID)  (0 when there is none) */
export async function findAttendanceEmployeeId(userId: number): Promise<number | null> {
  const row = await prisma.attendance_employee.findFirst({
    where: { REF_EMP_ID: userId, IS_DELETED: 0 },
    orderBy: { ATTND_EMP_ID: 'asc' },
    select: { ATTND_EMP_ID: true },
  });
  return row?.ATTND_EMP_ID ?? null;
}

/** CI: indp_mst_data_m->getMasterIDFromCode('ASPIN' | 'ASPOUT') */
let statusIdCache: { punchIn: number; punchOut: number } | null = null;
export async function getPunchStatusIds(): Promise<{ punchIn: number; punchOut: number } | null> {
  if (statusIdCache) return statusIdCache;
  const rows = await prisma.independent_mst.findMany({
    where: { MSTR_CD: { in: ['ASPIN', 'ASPOUT'] } },
    orderBy: { MSTR_ID: 'asc' },
    select: { MSTR_ID: true, MSTR_CD: true },
  });
  const punchIn = rows.find((r) => r.MSTR_CD === 'ASPIN')?.MSTR_ID;
  const punchOut = rows.find((r) => r.MSTR_CD === 'ASPOUT')?.MSTR_ID;
  if (punchIn === undefined || punchOut === undefined) return null;
  statusIdCache = { punchIn, punchOut };
  return statusIdCache;
}

/** CI: getPunchStatusOfDay — status of the latest record whose PUNCH_IN_USER_TIME falls on the given day. */
export async function getLatestStatusOfDay(
  attndEmpId: number,
  dayStart: Date,
  dayEnd: Date,
  db: Db = prisma
): Promise<number | null> {
  const row = await db.emp_attendance_record.findFirst({
    where: { ATTND_EMP_ID: attndEmpId, PUNCH_IN_USER_TIME: { gte: dayStart, lt: dayEnd } },
    orderBy: { PUNCH_IN_USER_TIME: 'desc' },
    select: { ATTND_STATUS_ID: true },
  });
  return row?.ATTND_STATUS_ID ?? null;
}

/** CI: getLastPunchInTime — newest record that has no punch-out yet. */
export async function findOpenRecord(attndEmpId: number, db: Db = prisma) {
  return db.emp_attendance_record.findFirst({
    where: { ATTND_EMP_ID: attndEmpId, PUNCH_OUT_USER_TIME: null },
    orderBy: { PUNCH_IN_USER_TIME: 'desc' },
    select: { ATTND_ID: true, PUNCH_IN_USER_TIME: true },
  });
}

export interface PunchInRow {
  attndEmpId: number;
  statusId: number;
  userTime: Date;
  utcTime: Date;
  offsetSeconds: number;
  device: string;
  oaId: number | null;
  oaBrandId: number;
  userId: number;
}

export async function insertPunchIn(row: PunchInRow, db: Db = prisma) {
  return db.emp_attendance_record.create({
    data: {
      ATTND_EMP_ID: row.attndEmpId,
      ATTND_STATUS_ID: row.statusId,
      PUNCH_IN_USER_TIME: row.userTime,
      PUNCH_IN_NOTE: '',
      PUNCH_IN_UTC_TIME: row.utcTime,
      PUNCH_IN_TIME_OFFSET: String(row.offsetSeconds),
      DEVICE: row.device,
      OA_ID: row.oaId,
      OA_BRAND_ID: row.oaBrandId,
      USER_ID: row.userId,
      RECORD_TYPE: 'AUTO', // the schema default is the literal string "'AUTO'" (quotes included)
      CREATED_BY: row.userId,
      CREATEDON: row.utcTime,
    },
    select: { ATTND_ID: true },
  });
}

export interface PunchOutRow {
  attndId: number;
  statusId: number;
  userTime: Date;
  utcTime: Date;
  offsetSeconds: number;
  oaId: number | null;
  oaBrandId: number;
  userId: number;
}

export async function updatePunchOut(row: PunchOutRow, db: Db = prisma) {
  return db.emp_attendance_record.update({
    where: { ATTND_ID: row.attndId },
    data: {
      ATTND_STATUS_ID: row.statusId,
      PUNCH_OUT_USER_TIME: row.userTime,
      PUNCH_OUT_NOTE: '',
      PUNCH_OUT_UTC_TIME: row.utcTime,
      PUNCH_OUT_TIME_OFFSET: String(row.offsetSeconds),
      OA_ID: row.oaId,
      OA_BRAND_ID: row.oaBrandId,
      USER_ID: row.userId,
      UPDATED_BY: row.userId,
      UPDATEDON: row.utcTime,
    },
    select: { ATTND_ID: true },
  });
}
