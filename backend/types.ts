import z from "zod"

export const userSignUpSchema = z.object({
    name: z.string(),
    email: z.email(),
    password: z.string()
})

export const userSignInSchema = z.object({
    email: z.email(),
    password: z.string()
})