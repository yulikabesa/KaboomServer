import Tag from "../models/tag.ts";
import type { ITag } from "../models/tag.ts";

export class TagService {
  // Create new tag
  static async createTag(body: ITag): Promise<ITag> {
    const tag = new Tag(body);
    await tag.save();
    return tag;
  }
}
