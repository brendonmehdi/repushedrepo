import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { Request, Response, NextFunction } from 'express';

// Read the ServiceAccount (ESM-compatible path resolution)
// Read the ServiceAccount (ESM-compatible path resolution)
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (error) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable');
        throw error;
    }
} else {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const serviceAccountPath = resolve(__dirname, '../config/serviceAccount.json');
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

// Defining an interface for the Request structure
export interface AuthRequest extends Request {
    user?: admin.auth.DecodedIdToken;
}

// This method gets the authorization header, gets the token, and verifies the user identity before protected routes
export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : authHeader;

    if (!token) {
        return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    try {
        req.user = await admin.auth().verifyIdToken(token);
        next();
    } catch (error) {
        console.error("Firebase Admin Error:", error);
        res.status(403).json({ error: "Forbidden: Token validation failed" });
    }
};