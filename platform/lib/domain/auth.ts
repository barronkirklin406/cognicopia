import { z } from "zod";
import { FacilityNameSchema } from "./facility";

/**
 * What people type into the sign-in, sign-up and set-up forms, and what is
 * acceptable. The same rules run on the server (every form is a server action),
 * so nothing depends on the browser having checked.
 *
 * The password rules are for choosing one: at least 12 characters, and at most 72
 * because that is as much of a password as Supabase's hashing reads. Sign-in only
 * asks that something was typed, so a person is never locked out by a rule that
 * changed after they chose theirs. Set the same minimum in Supabase's own settings
 * (Authentication, Password strength), because someone can call its sign-up
 * address directly without using these forms.
 */

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 72;

export const EmailSchema = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address.")
  .max(254, "That email address is too long.")
  .regex(/^[^@\s]+@[^@\s]+$/, "Enter a valid email address.");

/** For choosing a password (sign-up, reset). */
export const NewPasswordSchema = z
  .string({ error: "Choose a password." })
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(MAX_PASSWORD_LENGTH, `Use ${MAX_PASSWORD_LENGTH} characters or fewer.`);

export const SignInSchema = z.object({
  email: EmailSchema,
  password: z.string({ error: "Enter your password." }).min(1, "Enter your password.").max(256, "That password is too long."),
});

export const SignUpSchema = z.object({ email: EmailSchema, password: NewPasswordSchema });

export const ForgotPasswordSchema = z.object({ email: EmailSchema });

export const ResetPasswordSchema = z
  .object({ password: NewPasswordSchema, confirm: z.string() })
  .refine((value) => value.password === value.confirm, { path: ["confirm"], message: "The two passwords do not match." });

export const OnboardingSchema = z.object({ facility_name: FacilityNameSchema });
