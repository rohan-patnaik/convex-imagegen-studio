import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  images: defineTable({
    prompt: v.string(),
    model: v.string(),
    provider: v.string(),
    aspectRatio: v.string(),
    resolution: v.string(),
    outputFormat: v.string(),
    numImages: v.number(),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    imageUrls: v.optional(v.array(v.string())),
    requestId: v.optional(v.string()),
    error: v.optional(v.string()),
  }).index("by_created_at", ["createdAt"]),
});
