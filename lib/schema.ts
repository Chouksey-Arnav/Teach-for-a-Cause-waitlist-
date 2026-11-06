import { z } from "zod";
import { INSTRUMENTS } from "./instruments";
import { COUNTIES } from "./counties";

const role = z.enum(["parent", "tutor"], { errorMap: () => ({ message: "Choose parent or musician" }) });
const email = z
  .string({ required_error: "Enter an email address" })
  .trim()
  .toLowerCase()
  .min(1, "Enter an email address")
  .max(254, "That email is too long")
  .email("Enter a full email address, like name@example.com");
const instrument = z.enum(INSTRUMENTS, { errorMap: () => ({ message: "Pick an instrument from the list" }) });

export const signupSchema = z
  .object({
    role,
    email,
    grade: z.coerce.number({ invalid_type_error: "Choose a grade" }).int("Choose a grade"),
    instrument,
    county: z.union([z.enum(COUNTIES), z.literal("")]).optional().transform((v) => v || null),
  })
  .superRefine((d, ctx) => {
    const ok = d.role === "parent" ? d.grade >= 6 && d.grade <= 8 : d.grade >= 9 && d.grade <= 12;
    if (!ok)
      ctx.addIssue({
        code: "custom",
        path: ["grade"],
        message: d.role === "parent" ? "Choose grade 6, 7 or 8" : "Choose grade 9, 10, 11 or 12",
      });
  });

export const verifySchema = z.object({
  role,
  email,
  instrument,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6 digit code from the email"),
});

export type SignupInput = z.infer<typeof signupSchema>;
