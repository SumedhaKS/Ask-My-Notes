import express, { type Request, type Response } from "express"
import { userSignInSchema, userSignUpSchema } from "./types";
import { prisma } from "./db/prisma";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken"

const PORT = process.env.PORT || 3000;
const app = express()

app.use(express.json())
app.use(cors())

app.get("/health-check", (req: Request, res: Response) => {
    return res.json({ message: "Good" })
})

app.post("/signup", async (req: Request, res: Response) => {
    const parsed = userSignUpSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Bad request" })
    }
    try {

        const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } })
        if (existingUser) {
            return res.status(409).json({ message: "User exists" })
        }
        const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
        const user = await prisma.user.create({
            data: {
                name: parsed.data.name,
                email: parsed.data.email,
                password: hashedPassword
            }
        })

        return res.status(201).json({ message: "User created successfully" })
    }
    catch (err) {
        console.log(`Error during signup: ${err}`);
        return res.status(500).json({ message: "Internal server error" })
    }
})

app.post("/signin", async (req: Request, res: Response) => {
    if (!process.env.JWT_SECRET) {
        throw Error("JWT_SECRET not found")
    }

    const parsed = userSignInSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Bad request" })
    }
    try {
        const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } })
        if (!existingUser) {
            return res.status(401).json({ message: "Invalid credentials" })
        }
        const validUser = await bcrypt.compare(parsed.data.password, existingUser.password);
        if (!validUser) {
            return res.status(401).json({ message: "Invalid credentials" })
        }

        const token = jwt.sign(
            { userId: existingUser.id, email: existingUser.email },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        )
        return res.status(200).json({ message: "User signin successfull", token })
    }
    catch (err) {
        console.log(`Error during signin: ${err}`);
        return res.status(500).json({ message: "Internal server error" })
    }
})



app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

