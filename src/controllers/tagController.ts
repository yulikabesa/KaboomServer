import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { TagService } from "../services/tagService.ts";
import tag from "../models/tag.ts";

export class TagController {
  // POST create new tag
  static async createTag(req: Request, res: Response): Promise<void> {
    try {
      const tag = await TagService.createTag(req.body);
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: { tag },
      });
    } catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: "Failed to create a tag",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // GET tags
  static async searchTags(req: Request, res: Response): Promise<void> {
    try {
      const searchTerm = req.query.q;

      if (!searchTerm || typeof searchTerm !== "string") {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: 'Query parameter "q" is required and must be a string.',
        });
        return;
      }

      // Search matching names case-insensitively
      const tags = await tag
        .find({
          name: { $regex: searchTerm, $options: "i" },
        })
        .select("name")
        .limit(10); // to change later

      res.status(StatusCodes.OK).json({
        success: true,
        data: { tags },
      });
    } catch (error) {
      console.error("Database search execution failed:", error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal server error occurred during query processing.",
      });
    }
  }
}
