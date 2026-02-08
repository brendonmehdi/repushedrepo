import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import prisma from "../config/prismaClient";
import { GoogleGenAI } from "@google/genai";

export const onboard = async (req: AuthRequest, res: Response) => {
    console.log('Onboard endpoint hit');
    const { uid, email, name, picture } = req.user!;
    console.log('User info:', { uid, email, name });

    try {
        console.log('Attempting database upsert...');
        const user = await prisma.user.upsert({
            where: { firebaseId: uid },
            update: {
                name: name || "N/A",
                photo: picture ?? null,
            },
            create: {
                id: uid,
                firebaseId: uid,
                email: email!,
                name: name || "N/A",
                photo: picture ?? null,
            },
        });
        console.log('Database upsert successful:', user);
        return res.status(200).json(user);
    } catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({
            error: "Unable to login",
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const gemini = async (req: AuthRequest, res: Response) => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const image_path = "https://farm4.staticflickr.com/3789/10177514664_0ff9a53cf8_z.jpg"

    const response = await fetch(image_path);
    const imageArrayBuffer = await response.arrayBuffer();
    const base64ImageData = Buffer.from(imageArrayBuffer).toString('base64');

    const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
            {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64ImageData,
                },
            },
            { text: "Extract the text from this image" }
        ],
    });
    console.log(result.text);

    return res.status(200).json(result);
}

export const getDocuments = async (req: AuthRequest, res: Response) => {
    const { uid } = req.user!;

    if (!uid) {
        return res.status(403).json({
            error: "No such uid",
        })
    }

    try {
        const user = await prisma.user.findUnique({
            where: { firebaseId: uid },
        });

        if (!user) {
            return res.status(403).json({
                error: "No such user",
            })
        }

        const documents = await prisma.document.findMany({
            where: {
                userId: user.id,

            },
            orderBy: {
                createdAt: 'desc',
            }
        })

        return res.status(200).json(documents);
    } catch (e) {
        return res.status(500).json({ e })
    }
}

export const createDocument = async (req: AuthRequest, res: Response) => {
    const { uid } = req.user!;
    const { markdownContent, imageUrl } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { firebaseId: uid } });
        if (!user) return res.status(404).json({ error: "User not found" });

        const doc = await prisma.document.create({
            data: {
                userId: user.id,
                markdownContent: markdownContent || "",
                imageUrl: imageUrl || "",
            }
        });
        return res.status(201).json(doc);
    } catch (e) {
        console.error("Create error:", e);
        return res.status(500).json({ error: "Failed to create document" });
    }
}

export const updateDocument = async (req: AuthRequest, res: Response) => {
    const { uid } = req.user!;
    const { id } = req.params;
    const { markdownContent } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { firebaseId: uid } });
        if (!user) return res.status(403).json({ error: "User not found" });

        const doc = await prisma.document.findUnique({ where: { id } });
        if (!doc) return res.status(404).json({ error: "Document not found" });

        if (doc.userId !== user.id) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        const updated = await prisma.document.update({
            where: { id },
            data: { markdownContent }
        });
        return res.json(updated);
    } catch (e) {
        console.error("Update error:", e);
        return res.status(500).json({ error: "Failed to update document" });
    }
}

export const deleteDocument = async (req: AuthRequest, res: Response) => {
    const { uid } = req.user!;
    const { id } = req.params;

    try {
        const user = await prisma.user.findUnique({ where: { firebaseId: uid } });
        if (!user) return res.status(403).json({ error: "User not found" });

        const doc = await prisma.document.findUnique({ where: { id } });
        if (!doc) return res.status(404).json({ error: "Document not found" });

        if (doc.userId !== user.id) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        await prisma.document.delete({ where: { id } });
        return res.json({ message: "Document deleted" });
    } catch (e) {
        console.error("Delete error:", e);
        return res.status(500).json({ error: "Failed to delete document" });
    }
}