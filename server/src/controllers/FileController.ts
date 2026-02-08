import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import prisma from "../config/prismaClient";
import { GoogleGenAI } from "@google/genai";

export const processScan = async (req: AuthRequest, res: Response) => {
    const { imageUrl } = req.body;
    const { uid, email } = req.user!;

    if (!imageUrl) return res.status(400).json({ error: "Image URL is required" });

    try {
        // 1. Ensure user exists in Database (Onboarding check)
        const user = await prisma.user.upsert({
            where: { firebaseId: uid },
            update: {},
            create: {
                id: uid,
                firebaseId: uid,
                email: email!,
                name: req.user?.name || "User",
            },
        });

        // 2. Fetch image for Gemini
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
        const imgResponse = await fetch(imageUrl);
        const imageArrayBuffer = await imgResponse.arrayBuffer();
        const base64ImageData = Buffer.from(imageArrayBuffer).toString('base64');

        // 3. Process with Gemini (OCR + Cleaning + Formatting)
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
                {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: base64ImageData,
                    },
                },
                {
                    text: `You will receive the contents of an uploaded image (notes, documents, screenshots, or handwriting). Your job is to convert what you see into a faithful, polished, well-structured Markdown document.

CRITICAL REQUIREMENTS
- Preserve meaning exactly. Do not invent, infer, or add information that is not clearly present.
- If any text/symbol is unclear, mark it as: [unclear] and keep surrounding context.
- Correct obvious spelling, punctuation, and grammar mistakes, but do NOT change technical meaning, names, numbers, units, formulas, or code.
- Keep the original language of the content. Do not translate unless the content itself is mixed-language.

MARKDOWN OUTPUT RULES
- Output Markdown only. No preamble, no explanations, no code fences around the entire output.
- Use clear headings (#, ##, ###) that match the document’s structure (or create a sensible structure if none is explicit).
- Use bullet points and numbered lists where appropriate.
- Use tables only when the source is clearly tabular.
- Preserve line breaks when they convey structure (addresses, poems, step-by-step work).

MATH & SCIENCE FORMATTING
- Convert math into LaTeX:
  - Inline math: $...$
  - Display math (standalone equations): $$...$$
- Keep standard notation, subscripts, superscripts, fractions, roots, integrals, summations, limits, vectors, matrices, and Greek letters correct.
- If the image shows multi-step derivations, preserve the steps in order. Prefer aligned display math where helpful:
  $$\\begin{aligned}
  ... \\\\
  ...
  \\end{aligned}$$
- Preserve units and scientific formatting (e.g., m/s, N·m, kΩ).

CODE (IF PRESENT)
- If the image contains code, keep it verbatim except for fixing clearly accidental typos that do not change behavior (when uncertain, do not change it).
- Put code in fenced blocks with the correct language tag if obvious (e.g., \`\`\`js, \`\`\`ts, \`\`\`python). Otherwise use \`\`\`text.

QUALITY BAR
- Aim for a clean, publication-ready result: consistent capitalization, spacing, punctuation, and list formatting.
- Maintain the author’s intent and hierarchy. Do not over-summarize.

Return the final Markdown document.`
                }

            ],
        });

        const extractedText = result.text || "No text could be extracted.";

        // 4. Save the document record to Prisma/Supabase
        const document = await prisma.document.create({
            data: {
                userId: user.id,
                imageUrl: imageUrl,
                markdownContent: extractedText,
            }
        });

        return res.status(201).json(document);

    } catch (error) {
        console.error("Scanning Error:", error);
        return res.status(500).json({ error: "Failed to process scan" });
    }
};


//
// export const getDocumentById = async (req: AuthRequest, res: Response) => {
//     const { uid } = req.user!;
//     const { id } = req.params;
//
//     try {
//         const user = await prisma.user.findUnique({
//             where: { firebaseId: uid },
//         });
//
//         if (!user) return res.status(403).json({ error: "No such user" });
//
//         const document = await prisma.document.findFirst({
//             where: {
//                 id: id
//             }
//         });
//
//         if (!document) {
//             return res.status(404).json({ error: "Document not found" });
//         }
//
//         return res.status(200).json(document);
//     } catch (error) {
//         console.error("Error fetching document:", error);
//         return res.status(500).json({ error: "Internal server error" });
//     }
// };