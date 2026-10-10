import {
  findUserForLogin,
  markLoginSuccess,
  markLoginFailure,
  updatePasswordHash,
} from "./auth-repository";

import { verifyPassword, isLegacyHash, hashPassword } from "./password";

export interface AuthenticatedUser {
  id: string;
  userId: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
  isSysAdmin: boolean;
  userStatusId: number;
  dmnId: number | null;
  oaId: number | null;
  oaBrandId: number | null;
}

export async function authenticateUser(
  usernameOrEmail: string,
  password: string
): Promise<AuthenticatedUser | null> {
  const user = await findUserForLogin(usernameOrEmail);

  if (!user) {
    return null;
  }

  if (user.IS_DELETED === true) {
    return null;
  }

  const passwordValid = await verifyPassword(password, user.PASSWORD);

  if (!passwordValid) {
    await markLoginFailure(user.USER_ID);
    return null;
  }

  // Transparently upgrade a legacy MD5 hash to bcrypt now that we have the
  // plaintext. Never let a failure here block an otherwise valid login.
  if (isLegacyHash(user.PASSWORD)) {
    try {
      await updatePasswordHash(user.USER_ID, await hashPassword(password));
    } catch (error) {
      console.error("Password hash upgrade failed for user", user.USER_ID, error);
    }
  }

  await markLoginSuccess(user.USER_ID);

  return {
    id: String(user.USER_ID),
    userId: user.USER_ID,
    username: user.USER_NAME,
    email: user.REG_EMAIL_ID,
    firstName: user.FIRST_NAME,
    lastName: user.LAST_NAME,
    isAdmin: user.IS_ADMIN,
    isSysAdmin: user.IS_SYSADMIN,
    userStatusId: user.USER_STATUS_ID,
    dmnId: user.DMN_ID,
    oaId: user.OA_ID,
    oaBrandId: user.OA_BRAND_ID,
  };
}
