import express, {type Application } from 'express';
import cors from 'cors';
import authRoutes from './routes/userRoutes.ts';

const app: Application = express();

app.use(cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-type", "Authorization"],
    credentials: true
}));
app.use(express.json());

// Mount Routes
app.use('/api/users', authRoutes);

export default app;