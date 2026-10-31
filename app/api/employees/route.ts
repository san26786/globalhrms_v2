import { readQuery, withApi } from '@/lib/http/withApi';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Employee picker search (Bank Manager forms): GET ?search= → { EMP_ID, EMP_NBR, EMP_NAME, EMPLST_NM }[].
 * Logged-in users only, limited to the caller's active brand (super admin: every brand) — it used to
 * answer anyone with every brand's employees.
 */
export const GET = withApi(async ({ req, subject }) => {
  const search = (readQuery(req).search ?? '').trim().slice(0, 100);
  return prisma.emp_mst.findMany({
    where: {
      IS_DELETED: 0,
      ...(subject.adminLevel === 2 ? {} : { OA_BRAND_ID: subject.oaBrandId ?? -1 }),
      ...(search
        ? {
            OR: [
              { EMP_NAME: { contains: search, mode: 'insensitive' } },
              { EMPLST_NM: { contains: search, mode: 'insensitive' } },
              { EMP_NBR: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: { EMP_ID: true, EMP_NBR: true, EMP_NAME: true, EMPLST_NM: true },
    orderBy: [{ EMP_NAME: 'asc' }, { EMP_ID: 'asc' }],
    take: 300,
  });
});
