import "dotenv/config"
import express, { type NextFunction, type Request, type Response } from "express"
import { userSignInSchema, userSignUpSchema } from "./types";
import { prisma } from "./db/prisma";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken"
import { authMiddleware } from "./middleware/authMiddleware";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto, { randomUUID } from "crypto";
import axios from "axios";
import FormData from "form-data";
class InvalidFileTypeError extends Error { };

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
const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== "application/pdf") {
            return cb(new InvalidFileTypeError("Only PDF files are allowed"));
        }
        cb(null, true);
    }
});    // Doc size Limited to 100mb

app.post("/upload", authMiddleware, attachDocumentId, upload.single('file'), async (req: any, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" })
    }
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex")

    const existing = await prisma.document.findUnique({
        where: { userId_fileHash: { userId: req.user.userId, fileHash } }
    });

    if (existing) {
        fs.unlinkSync(req.file.path);
        return res.status(200).json({ message: "Document already uploaded", documentId: existing.id })
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
        console.log(process.env.INTERNAL_API_KEY, typeof process.env.INTERNAL_API_KEY)
        const aiResponse = await axios.post(`${process.env.AI_SERVICE_URL}/upload`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    "x-internal-key": process.env.INTERNAL_API_KEY
                }
            }
        )

        if (aiResponse.status !== 200) {
            fs.unlinkSync(req.file.path);
            return res.status(502).json({ message: "AI sevice failed to process document" });
        }

        await prisma.document.create({
            data: {
                id: req.documentId,
                filename: req.file.originalname,
                userId: req.user.userId,
                fileHash
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
    if (err instanceof InvalidFileTypeError) {
        return res.status(400).json({ message: err.message })
    }
    console.log("Unhandled error: ", err)
    return res.status(500).json({ message: "Internal server error" })
})

app.post("/ask", authMiddleware, async (req: any, res: Response) => {
    //  ownership check
    if (!req.body.documentId) {
        return res.status(400).json({ message: "Bad request" });
    }
    if (!req.body.question) {                                           // Add input validation
        return res.status(400).json({ message: "Bad request" });
    }
    const question: string = req.body.question;
    try {
        const owner = await prisma.document.findFirst({ where: { userId: req.user.userId, id: req.body.documentId } }); //TODO: handle error
        if (!owner) {
            return res.status(400).json({ message: "Bad request" })
        }

        const answer = await axios.post(`${process.env.AI_SERVICE_URL}/ask`, {
            question,
            document_id: req.body.documentId
        })

        if (answer.status !== 200) {
            return res.status(502).json({ message: "AI service failed to answer" })
        }

        const chat = await prisma.chat.create({
            data: {
                userId: req.user.userId,
                documentId: req.body.documentId,
                question,
                answer: answer.data.answer
            }
        })
        return res.status(200).json({ message: "Answer recieved", answer: answer.data.answer })

    }
    catch (err:any) {
        if(err.response){
            console.log("Response: ",err.response)
            console.log("\n DATA:",err.response.data)
            return res.status(err.response.status).json({
                message: err.response.data?.detail || "AI service error"
            })
        }
        console.log(`Error while asking question: ${err}`);
        return res.status(500).json({ message: "Internal server error" })
    }
})

app.get("/chat/document/:documentId", authMiddleware, async (req: any, res: Response) => {
    const documentId = req.params.documentId;
    try {
        const document = await prisma.document.findFirst({ where: { userId: req.user.userId, id: documentId } });
        if (!document) {
            return res.status(404).json({ message: "Document not found" })
        }

        const chats = await prisma.chat.findMany({
            where: { documentId },
            orderBy: { createdAt: "asc" },
            select: { id: true, question: true, answer: true, createdAt: true }
        });

        return res.status(200).json({ message: "Chat history retrieved", chats });
    }
    catch (err) {
        console.log(`Error while fetching chat: ${err}`);
        return res.status(500).json({ message: "Internal server error" })
    }
})

app.get("/documents", authMiddleware, async (req: any, res: Response) => {
    try {
        const documents = await prisma.document.findMany({
            where: { userId: req.user.userId },
            orderBy: { createdAt: "desc" },
            select: { id: true, filename: true, createdAt: true }
        });
        return res.status(200).json({ documents })
    }
    catch (err) {
        console.log(`Error while fetching documents: ${err}`);
        return res.status(500).json({ message: "Internal server error" })
    }
})
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
