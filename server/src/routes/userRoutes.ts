import { Router } from 'express';
import { gemini, onboard } from '../controllers/UserController';
import { processScan } from "../controllers/FileController.ts";
import { verifyToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/onboard', verifyToken, onboard);

router.post('/gemini', gemini);

router.post('/scan', verifyToken, processScan);


export default router;