import "dotenv/config"
import express, { type NextFunction, type Request, type Response } from "express"
import { userSignInSchema, userSignUpSchema } from "./types";
import { prisma } from "./db/prisma";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken"
import { authMiddleware } from "./middleware/authMiddleware";
import multer from "multer";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import axios from "axios";
import FormData from "form-data";

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
const uploadDir = "uploadedDocs/";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const attachDocumentId = (req: any, res: Response, next: NextFunction) => {
    req.documentId = randomUUID();
    next();
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req: any, file, cb) => {
        const ext = path.extname(file.originalname)
        cb(null, `${req.documentId}${ext}`);
    }
})
const upload = multer({ storage: storage, limits: { fileSize: 100 * 1024 * 1024 } });    // Doc size Limited to 100mb

app.post("/upload", authMiddleware, attachDocumentId, upload.single('file'), async (req: any, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" })
    }
    // Should handle this in a better way
    if (!process.env.AI_SERVICE_URL) {
        throw Error("AI_SERVICE_URL not found")
    }

    try {
        // Send req.file.path + req.documentId to fastapi
        const formData = new FormData();
        formData.append("document_id", req.documentId);
        formData.append("file", fs.createReadStream(req.file.path), req.file.filename); //streams the file instead of loading it fully into memory

        const aiResponse = await axios.post(`${process.env.AI_SERVICE_URL}/upload`,
            formData,
            { headers: formData.getHeaders() }
        )

        if (aiResponse.status !== 200) {
            fs.unlinkSync(req.file.path);
            return res.status(502).json({ message: "AI sevice failed to process document" });
        }

        await prisma.document.create({
            data: {
                id: req.document_id,
                filename: req.file.originalname,
                userId: req.user.userId
            }
        })

        fs.unlinkSync(req.file.path)

        return res.status(201).json({ message: "Document uploaded", documentId: req.documentId })
    }
    catch (err) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        console.log(`Error during upload: ${err}`);
        return res.status(500).json({ message: "Internal server error" })
    }
})

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ message: "File too large. Max size is 100MB" })
        }
        return res.status(400).json({ message: err.message })
    }
    console.log(err)
    return res.status(500).json({ message: "Internal server error coming from global one" })
})

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

