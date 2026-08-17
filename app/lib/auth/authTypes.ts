export interface AuthUser {
    USER_ID: number;
    USER_NAME: string;
    REG_EMAIL_ID: string;
    FIRST_NAME: string | null;
    LAST_NAME: string | null;
    IS_ADMIN: boolean;
    IS_SYSADMIN: boolean;
  }
  
  export interface LoginInput {
    email: string;
    password: string;
  }
  
  export interface LoginResult {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }