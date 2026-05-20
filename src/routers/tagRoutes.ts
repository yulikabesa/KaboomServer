import express from "express";
const router = express.Router();
import { TagController } from "../controllers/tagController";

// POST create tag

router.post("/", TagController.createTag);

// Get tags

router.get("/search", TagController.searchTags);

export default router;
