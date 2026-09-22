import { prisma } from '@/lib/prisma';

/**
 * Port of login/login/updateUserLastActive (called every 8 minutes by the header).
 *
 * user_mst has no "last active" column; the only one in the schema is
 * concurrent_login_details.LAST_ACTIVE, so that is what gets touched.
 * NOTE: the Next login route does not create a concurrent_login_details row, so for
 * sessions that started in Next this updates 0 rows. Decide (from login.php) whether
 * login should insert one — see README.
 */
export async function touchLastActive(userId: number): Promise<number> {
  const now = new Date();
  const result = await prisma.concurrent_login_details.updateMany({
    where: {
      USER_ID: userId,
      IS_ONLINE: true,
      OR: [{ IS_DELETED: false }, { IS_DELETED: null }],
    },
    data: { LAST_ACTIVE: now, UPDATED_ON: now },
  });
  return result.count;
}
