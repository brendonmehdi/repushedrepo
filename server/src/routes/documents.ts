import { getDocuments, createDocument, updateDocument, deleteDocument } from "../controllers/UserController.ts";
import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware.ts";

const router = Router();

router.get('/', verifyToken, getDocuments);
router.post('/', verifyToken, createDocument);
router.put('/:id', verifyToken, updateDocument);
router.delete('/:id', verifyToken, deleteDocument);

export default router;
