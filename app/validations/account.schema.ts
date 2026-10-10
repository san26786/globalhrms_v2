import { z } from 'zod';

/** Self-service account forms — CI user/changepassword, changeusername, security_questions, profile. */

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Old password is required.'),
    newPassword: z.string().min(1, 'New password is required.'),
    confirmPassword: z.string().min(1, 'Confirm password is required.'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The Confirm Password field does not match the New Password field.',
  });

export const changeUsernameSchema = z.object({
  currentUsername: z.string().trim().min(1, 'Current username is required.'),
  currentPassword: z.string().min(1, 'Current password is required.'),
  newUsername: z.string().trim().min(1, 'New username is required.'),
});

const questionId = z.coerce.number({ message: 'Select a question.' }).int().positive('Select a question.');
const answer = z.string().trim().min(1, 'Answer is required.').max(100, 'Answer must be at most 100 characters.');

/** CI: four required questions, all different ("select another value"), four required answers. */
export const securityQuestionsSchema = z
  .object({
    question1: questionId,
    question2: questionId,
    question3: questionId,
    question4: questionId,
    answer1: answer,
    answer2: answer,
    answer3: answer,
    answer4: answer,
  })
  .superRefine((v, ctx) => {
    const qs = [v.question1, v.question2, v.question3, v.question4];
    qs.forEach((q, i) => {
      if (qs.slice(0, i).includes(q)) {
        ctx.addIssue({ code: 'custom', path: [`question${i + 1}`], message: 'select another value' });
      }
    });
  });

/** CI profile: first/last name required, TPIN exactly 6 digits, memorable word required, unique email. */
export const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(100),
  lastName: z.string().trim().min(1, 'Last name is required.').max(100),
  email: z.string().trim().min(1, 'Email is required.').max(100).pipe(z.email('Enter a valid email address.')),
  tPin: z.string().trim().regex(/^\d{6}$/, 'Passcode must be exactly 6 digits.'),
  memorableWord: z.string().trim().min(1, 'Memorable word is required.').max(250),
  localTime: z.boolean().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.').pipe(z.email('Enter a valid email address.')),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(20, 'This reset link is invalid.'),
    password: z.string().min(1, 'Password is required.'),
    confirmPassword: z.string().min(1, 'Confirm password is required.'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The Confirm Password field does not match the Password field.',
  });

export const forgotUsernameSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.').pipe(z.email('Enter a valid email address.')),
  memorableWord: z.string().trim().min(1, 'Memorable word or passcode is required.'),
});
