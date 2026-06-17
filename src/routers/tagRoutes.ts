import express from "express";
import { auth } from "../middleware/auth.ts";
import { TagController } from "../controllers/tagController";

const router = express.Router();

// POST create tag

router.post("/", auth, TagController.createTag);

// Get tags

router.get("/search", auth, TagController.searchTags);

export default router;
