import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes.ts';
import docRoutes from './routes/documents.ts';

dotenv.config();

// Validate required environment variables
if (!process.env.GEMINI_API_KEY) {
    console.error('FATAL: GEMINI_API_KEY is not set in environment variables');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 6300;

app.use(cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-type", "Authorization"],
    credentials: true
}));
app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/documents', docRoutes);

app.listen(PORT, () => {
    console.log(`VibeScribe Server running on http://localhost:${PORT}`);
});