import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

declare global {
    namespace Express {
        interface Request {
            user: { userId: string }
        }
    }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET not found")

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ message: "Unauthorized" })

    const token = authHeader.split(' ')[1];
    if (!token) return;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded as { userId: string };
        next();
    } catch (err) {
        return res.status(401).json({ message: "Unauthorized" })
    }
}
