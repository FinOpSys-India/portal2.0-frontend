import { z } from "zod";

/**
 * Auth form schemas. One file so the same rule is never written twice with
 * two different messages — which is how 1.0 ended up rejecting input on the
 * server that the client had already accepted.
 */

// Deliberately permissive. Address validity is the mail server's job; this
// only catches obvious typos before a pointless round trip.
//
// Trimmed first: addresses arrive pasted, often with a trailing space, and
// without this a stray space is reported as "invalid email" — which sends the
// user hunting for a typo that is not there.
const email = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .email("Enter a valid email address.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

/**
 * Identity is part of this form now, not just the password.
 *
 * `POST /auth/signup` requires email, firstName and lastName alongside the
 * password, and the invitation email the backend sends carries only the token
 * (`invitationService.deliver`). When the link supplies the rest they are shown
 * read-only; when it does not, they have to be typed, so they are validated
 * either way rather than submitted blank.
 */
export const signupSchema = z
  .object({
    email,
    firstName: z.string().trim().min(1, "Enter your first name."),
    lastName: z.string().trim().min(1, "Enter your last name."),
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string().min(1, "Re-enter your password."),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });

export const forgotPasswordSchema = z.object({ email });

/**
 * Onboarding step 1. Only phone and country are enterable — name, email and
 * job title arrive with the invite and are shown read-only, exactly as in 1.0.
 */
export const userInfoSchema = z.object({
  // Deliberately loose: international formats vary far more than any regex
  // worth maintaining. Rejecting a real number is worse than accepting a typo.
  phone: z
    .string()
    .min(1, "Enter your phone number.")
    .refine((v) => v.replace(/\D/g, "").length >= 7, {
      message: "Enter a valid phone number.",
    }),
  // Not a country: `PUT /onboarding/profile` takes firstName, lastName, phone
  // and jobTitle, and rejects anything else. The address is the company form's
  // job, one screen later.
  jobTitle: z.string().min(1, "Enter your job title."),
});

/**
 * Onboarding step 2.
 *
 * The company email must differ from the account email. 1.0 enforces this too
 * — but silently: the form simply refuses to advance with no message anywhere,
 * which is what made it look broken. Here it says so.
 */
export function companySchema(accountEmail: string) {
  return z.object({
    name: z.string().min(1, "Enter your company name."),
    type: z.string().min(1, "Select your company type."),
    addressLine1: z.string().min(1, "Enter your address."),
    city: z.string().min(1, "Enter your city."),
    zip: z.string().min(1, "Enter your ZIP code."),
    state: z.string().min(1, "Enter your state."),
    country: z.string().min(1, "Select your country."),
    email: email.refine(
      (v) => v.trim().toLowerCase() !== accountEmail.trim().toLowerCase(),
      { message: "Use a different address from your personal login email." },
    ),
    phone: z
      .string()
      .min(1, "Enter your company phone number.")
      .refine((v) => v.replace(/\D/g, "").length >= 7, {
        message: "Enter a valid phone number.",
      }),
    employees: z
      .string()
      .min(1, "Enter your number of employees.")
      .refine((v) => Number(v) >= 0, { message: "Enter a valid number." }),
    revenue: z.string().min(1, "Select your last year's revenue."),
  });
}

export type CompanyValues = z.infer<ReturnType<typeof companySchema>>;

/**
 * New project. The deadline must be strictly in the future — 1.0 disables
 * today as well as the past in its date picker, without ever saying why.
 */
export const newProjectSchema = z.object({
  name: z.string().min(1, "Enter a project name."),
  service: z.string().min(1, "Select a service."),
  deadline: z
    .string()
    .min(1, "Pick a deadline.")
    .refine((value) => value > new Date().toISOString().slice(0, 10), {
      message: "Pick a date after today.",
    }),
});

export type NewProjectValues = z.infer<typeof newProjectSchema>;

/**
 * The manager's version of the same form, plus the company.
 *
 * A customer opens a project inside one workspace and the URL already names it.
 * A manager holds several, so which account the project lands on is a decision
 * the form has to collect — and getting it wrong files a client's work under
 * somebody else's company.
 */
export const managerProjectSchema = newProjectSchema.extend({
  companyId: z.string().min(1, "Pick a company."),
});

export type ManagerProjectValues = z.infer<typeof managerProjectSchema>;

/**
 * Add New Task, on the manager's project detail.
 *
 * All three fields are required in 1.0. No assignee — 1.0's modal has no such
 * field, so a task cannot be routed to anyone from here.
 */
export const newTaskSchema = z.object({
  name: z.string().min(1, "Enter a task name."),
  description: z.string().min(1, "Describe the task."),
  // Unlike a project deadline, a task may legitimately be due today.
  deadline: z.string().min(1, "Pick a deadline."),
  // Fixed on a project page, chosen on the specialist's, so it is always part
  // of the form rather than a second shape for the second caller.
  projectId: z.string().min(1, "Pick a project."),
});

export type NewTaskValues = z.infer<typeof newTaskSchema>;

/*
 * No schema for the specialist-assignment dialog. Which services it must fill
 * and who is eligible for each are the server's to state — see
 * `managerApi.staffing` — so there is no fixed shape here to validate.
 */

/**
 * The Connect email, shared by the manager and the specialist. 1.0 keeps Send
 * disabled until all three are filled and shows no error when they are not; the
 * messages here are the port's addition.
 */
export const connectEmailSchema = z.object({
  to: z.string().min(1, "Pick a recipient."),
  subject: z.string().min(1, "Enter a subject."),
  message: z.string().min(1, "Write a message."),
});

export type ConnectEmailValues = z.infer<typeof connectEmailSchema>;

/** Invite for a teammate on the customer side. */
export const inviteTeammateSchema = z.object({
  email,
  firstName: z.string().min(1, "Enter a first name."),
  lastName: z.string().min(1, "Enter a last name."),
  jobTitle: z.string().min(1, "Enter a job title."),
});

export type InviteTeammateValues = z.infer<typeof inviteTeammateSchema>;

/** Profile: name and email are set at signup and shown read-only. */
export const profileSchema = z.object({
  phone: z
    .string()
    .min(1, "Enter your phone number.")
    .refine((v) => v.replace(/\D/g, "").length >= 7, {
      message: "Enter a valid phone number.",
    }),
  addressLine1: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  country: z.string().min(1, "Select your country."),
});

export type ProfileValues = z.infer<typeof profileSchema>;

/**
 * The new password, at the end of a reset.
 *
 * Same eight-character floor and same confirmation as signup — a reset that
 * accepted a weaker password than the account was created with would be the way
 * around the rule rather than a recovery from it.
 */
export const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string().min(1, "Re-enter your password."),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });

export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

export const otpSchema = z.object({
  code: z
    .string()
    .min(1, "Enter the code from your email.")
    .regex(/^\d{6}$/, "The code is 6 digits."),
});

export type UserInfoValues = z.infer<typeof userInfoSchema>;
export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type OtpValues = z.infer<typeof otpSchema>;
