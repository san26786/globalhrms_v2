import bcrypt from 'bcryptjs';
import type { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { verifyPassword } from '@/lib/auth/password';
import { validateUsernameRules } from '@/lib/auth/credentialPolicy';
import { assertPasswordAllowed, setUserPassword } from '@/lib/auth/passwordService';
import { getMasterOptionsByTypeCode } from '@/lib/masters/masterService';
import type {
  changePasswordSchema,
  changeUsernameSchema,
  profileSchema,
  securityQuestionsSchema,
} from '@/validations/account.schema';

/**
 * Self-service account operations — CI user/changepassword, changeusername, security_questions,
 * profile. Every operation acts on the logged-in user only (CI's mobile variants trusted a posted
 * user_id — not reproduced).
 */

const SECURITY_QUESTION_TYPE = 'USQ';

async function loadSelf(subject: RequestSubject) {
  const user = await prisma.user_mst.findFirst({
    where: { USER_ID: subject.userId, OR: [{ IS_DELETED: false }, { IS_DELETED: null }] },
    select: {
      USER_ID: true,
      USER_NAME: true,
      PASSWORD: true,
      OA_BRAND_ID: true,
      QUESTION_ONE: true,
      QUESTION_TWO: true,
      QUESTION_THREE: true,
      QUESTION_FOUR: true,
      FIRST_NAME: true,
      LAST_NAME: true,
      REG_EMAIL_ID: true,
      TPIN: true,
      MEMORABLE_WORD: true,
      LOCAL_TIME: true,
    },
  });
  if (!user) throw new NotFoundError('Your account could not be found.');
  return user;
}

/** Security answers are stored hashed (CI stored them in plain text); comparison is case-insensitive. */
function normaliseAnswer(answer: string) {
  return answer.trim().toLowerCase();
}

export const accountService = {
  async changePassword(subject: RequestSubject, input: z.infer<typeof changePasswordSchema>) {
    const user = await loadSelf(subject);
    if (!(await verifyPassword(input.oldPassword, user.PASSWORD)).valid) {
      throw new ValidationError('Old Password does not matches', { oldPassword: ['Old Password does not matches'] });
    }
    await assertPasswordAllowed(input.newPassword, { userId: user.USER_ID, oaBrandId: user.OA_BRAND_ID }, 'newPassword');
    await setUserPassword(user.USER_ID, input.newPassword, { actorId: subject.userId });
    // CI: after the first password change the user is sent to set security questions.
    return {
      message: 'Password Updated Successfully',
      redirectTo: user.QUESTION_ONE ? '/dashboard' : '/user/security_questions',
    };
  },

  async changeUsername(subject: RequestSubject, input: z.infer<typeof changeUsernameSchema>) {
    const user = await loadSelf(subject);
    if (input.currentUsername !== user.USER_NAME) {
      throw new ValidationError('Username entered is incorrect', { currentUsername: ['Username entered is incorrect'] });
    }
    if (!(await verifyPassword(input.currentPassword, user.PASSWORD)).valid) {
      throw new ValidationError('Password entered is incorrect', { currentPassword: ['Password entered is incorrect'] });
    }
    const errors = await validateUsernameRules(input.newUsername, user.OA_BRAND_ID, { exceptUserId: user.USER_ID });
    if (errors.length) throw new ValidationError(errors[0], { newUsername: errors });

    await prisma.user_mst.updateMany({
      where: { USER_ID: user.USER_ID },
      data: { USER_NAME: input.newUsername, UPDATED_BY: subject.userId, UPDATED_ON: new Date() },
    });
    return { message: 'Username updated successfully', username: input.newUsername };
  },

  async getSecurityQuestions(subject: RequestSubject) {
    const [user, options] = await Promise.all([loadSelf(subject), getMasterOptionsByTypeCode(SECURITY_QUESTION_TYPE)]);
    return {
      options,
      selected: {
        question1: user.QUESTION_ONE || null,
        question2: user.QUESTION_TWO || null,
        question3: user.QUESTION_THREE || null,
        question4: user.QUESTION_FOUR || null,
      },
    };
  },

  async saveSecurityQuestions(subject: RequestSubject, input: z.infer<typeof securityQuestionsSchema>) {
    const options = await getMasterOptionsByTypeCode(SECURITY_QUESTION_TYPE);
    const valid = new Set(options.map((o) => o.value));
    const invalid = (['question1', 'question2', 'question3', 'question4'] as const).filter((k) => !valid.has(input[k]));
    if (invalid.length) {
      throw new ValidationError('Validation failed.', Object.fromEntries(invalid.map((k) => [k, ['Select a valid question.']])));
    }
    const [a1, a2, a3, a4] = await Promise.all(
      [input.answer1, input.answer2, input.answer3, input.answer4].map((a) => bcrypt.hash(normaliseAnswer(a), 10)),
    );
    await prisma.user_mst.updateMany({
      where: { USER_ID: subject.userId },
      data: {
        QUESTION_ONE: input.question1,
        QUESTION_TWO: input.question2,
        QUESTION_THREE: input.question3,
        QUESTION_FOUR: input.question4,
        ANSWER_ONE: a1,
        ANSWER_TWO: a2,
        ANSWER_THREE: a3,
        ANSWER_FOUR: a4,
        UPDATED_BY: subject.userId,
        UPDATED_ON: new Date(),
      },
    });
    return { message: 'Security Questions updated successfully' };
  },

  async getProfile(subject: RequestSubject) {
    const user = await loadSelf(subject);
    return {
      username: user.USER_NAME,
      firstName: user.FIRST_NAME ?? '',
      lastName: user.LAST_NAME ?? '',
      email: user.REG_EMAIL_ID,
      tPin: user.TPIN !== null ? String(user.TPIN).padStart(6, '0') : '',
      memorableWord: user.MEMORABLE_WORD ?? '',
      localTime: !!user.LOCAL_TIME,
    };
  },

  async updateProfile(subject: RequestSubject, input: z.infer<typeof profileSchema>) {
    const clash = await prisma.user_mst.findFirst({
      where: {
        REG_EMAIL_ID: { equals: input.email, mode: 'insensitive' },
        NOT: { USER_ID: subject.userId },
        OR: [{ IS_DELETED: false }, { IS_DELETED: null }],
      },
      select: { USER_ID: true },
    });
    if (clash) throw new ConflictError('Email Id should contain unique value.', { email: ['Email Id should contain unique value.'] });

    await prisma.user_mst.updateMany({
      where: { USER_ID: subject.userId },
      data: {
        FIRST_NAME: input.firstName,
        LAST_NAME: input.lastName,
        REG_EMAIL_ID: input.email,
        TPIN: Number(input.tPin),
        MEMORABLE_WORD: input.memorableWord.toUpperCase(),
        LOCAL_TIME: input.localTime,
        UPDATED_BY: subject.userId,
        UPDATED_ON: new Date(),
      },
    });
    return { message: 'Profile updated successfully' };
  },
};
