import {
    findUserForLogin,
    markLoginSuccess,
    markLoginFailure,
  } from "./auth-repository";
  
  import {
    verifyLegacyPassword,
  } from "./password";
  
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
    const user =
      await findUserForLogin(usernameOrEmail);  
       console.log("User:", user);  
  
    if (!user) {
      return null;
    }
  
    if (user.IS_DELETED === true) {
      return null;
    }
  
    const passwordValid =
      verifyLegacyPassword(
        password,
        user.PASSWORD
      );
  
    if (!passwordValid) {
      await markLoginFailure(
        user.USER_ID
      );
  
      return null;
    }
  
    await markLoginSuccess(
      user.USER_ID
    );
  
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