import { prisma } from '@/lib/prisma'; // aapka existing prisma import

/** CI common_c::getTitleByCode(): independent_mst.MSTR_NM for a MSTR_CD, or null. */
export async function getTitleByCode(code: string): Promise<string | null> {
  const row = await prisma.independent_mst.findFirst({
    where: { MSTR_CD: code },
    select: { MSTR_NM: true },
  });
  return row?.MSTR_NM ?? null;
}