import { actionGeneric, makeFunctionReference, mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { fal } from "@fal-ai/client";
import { InferenceClient } from "@huggingface/inference";

const FAL_MODEL_NAME = "fal-ai/nano-banana-pro";
const HUGGINGFACE_MODEL_NAME = "ByteDance/SDXL-Lightning";

const HUGGINGFACE_BASE_SIZE = 1024;

type AspectRatio = "1:1" | "4:3" | "3:2" | "16:9" | "9:16";
type Resolution = "1K" | "2K" | "4K";
type OutputFormat = "png" | "jpeg" | "webp";
type Provider = "fal" | "huggingface";

const aspectRatioValidator = v.union(
  v.literal("1:1"),
  v.literal("4:3"),
  v.literal("3:2"),
  v.literal("16:9"),
  v.literal("9:16")
);
const resolutionValidator = v.union(v.literal("1K"), v.literal("2K"), v.literal("4K"));
const outputFormatValidator = v.union(v.literal("png"), v.literal("jpeg"), v.literal("webp"));
const providerValidator = v.union(v.literal("fal"), v.literal("huggingface"));

const ASPECT_RATIO_MAP: Record<AspectRatio, [number, number]> = {
  "1:1": [1, 1],
  "4:3": [4, 3],
  "3:2": [3, 2],
  "16:9": [16, 9],
  "9:16": [9, 16],
};

const roundToMultiple = (value: number, multiple: number) =>
  Math.max(multiple, Math.round(value / multiple) * multiple);

const normalizeProvider = (provider?: string): Provider =>
  provider === "huggingface" ? "huggingface" : "fal";

const resolveHuggingFaceDimensions = (aspectRatio: AspectRatio) => {
  const [ratioWidth, ratioHeight] = ASPECT_RATIO_MAP[aspectRatio] ?? [1, 1];
  const scale = HUGGINGFACE_BASE_SIZE / Math.max(ratioWidth, ratioHeight);

  const width = roundToMultiple(ratioWidth * scale, 64);
  const height = roundToMultiple(ratioHeight * scale, 64);

  return {
    width,
    height,
  };
};

export const list = queryGeneric({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async ({ db }, { limit }) => {
    const cappedLimit = limit ?? 24;
    return db
      .query("images")
      .withIndex("by_created_at")
      .order("desc")
      .take(cappedLimit);
  },
});

export const create = mutationGeneric({
  args: {
    prompt: v.string(),
    model: v.string(),
    provider: providerValidator,
    aspectRatio: aspectRatioValidator,
    resolution: resolutionValidator,
    outputFormat: outputFormatValidator,
    numImages: v.number(),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async ({ db }, args) => {
    return db.insert("images", args);
  },
});

export const update = mutationGeneric({
  args: {
    id: v.id("images"),
    status: v.optional(v.string()),
    imageUrls: v.optional(v.array(v.string())),
    requestId: v.optional(v.string()),
    error: v.optional(v.string()),
    updatedAt: v.number(),
  },
  handler: async ({ db }, { id, ...fields }) => {
    await db.patch(id, fields);
  },
});

const createImage = makeFunctionReference<"mutation">("images:create");
const updateImage = makeFunctionReference<"mutation">("images:update");

export const generate = actionGeneric({
  args: {
    prompt: v.string(),
    aspectRatio: aspectRatioValidator,
    resolution: resolutionValidator,
    outputFormat: outputFormatValidator,
    numImages: v.optional(v.number()),
    provider: v.optional(providerValidator),
  },
  handler: async (ctx, args) => {
    const requestedAt = Date.now();
    const provider = normalizeProvider(args.provider);
    const numImages = Math.min(4, Math.max(1, args.numImages ?? 1));
    const modelName = provider === "huggingface" ? HUGGINGFACE_MODEL_NAME : FAL_MODEL_NAME;
    const resolvedResolution: Resolution = provider === "huggingface" ? "1K" : args.resolution;
    const resolvedOutputFormat: OutputFormat =
      provider === "huggingface" ? "png" : args.outputFormat;

    const imageId = await ctx.runMutation(createImage, {
      prompt: args.prompt,
      model: modelName,
      provider,
      aspectRatio: args.aspectRatio,
      resolution: resolvedResolution,
      outputFormat: resolvedOutputFormat,
      numImages,
      status: "queued",
      createdAt: requestedAt,
      updatedAt: requestedAt,
    });

    try {
      if (provider === "huggingface") {
        const huggingFaceToken = process.env.HF_TOKEN;
        if (!huggingFaceToken) {
          throw new Error("Missing HF_TOKEN environment variable.");
        }

        const { width, height } = resolveHuggingFaceDimensions(args.aspectRatio);
        const imageUrls: string[] = [];
        const hf = new InferenceClient(huggingFaceToken);

        for (let index = 0; index < numImages; index += 1) {
          const imageBlob = await hf.textToImage(
            {
              model: HUGGINGFACE_MODEL_NAME,
              inputs: args.prompt,
              parameters: {
                width,
                height,
              },
            },
            { outputType: "blob" }
          );

          const storageId = await ctx.storage.store(imageBlob);
          const url = await ctx.storage.getUrl(storageId);

          if (url) {
            imageUrls.push(url);
          }
        }

        if (imageUrls.length === 0) {
          throw new Error("Hugging Face returned no images.");
        }

        await ctx.runMutation(updateImage, {
          id: imageId,
          status: "complete",
          imageUrls,
          updatedAt: Date.now(),
        });

        return { id: imageId, imageUrls };
      }

      const falKey = process.env.FAL_KEY;
      if (!falKey) {
        throw new Error("Missing FAL_KEY environment variable.");
      }

      fal.config({ credentials: falKey });

      const result = await fal.subscribe(FAL_MODEL_NAME, {
        input: {
          prompt: args.prompt,
          aspect_ratio: args.aspectRatio,
          resolution: resolvedResolution,
          output_format: resolvedOutputFormat,
          num_images: numImages,
        },
      });

      const imageUrls = result.data?.images?.map((image) => image.url).filter(Boolean) ?? [];
      const requestId = result.requestId ?? undefined;

      await ctx.runMutation(updateImage, {
        id: imageId,
        status: "complete",
        imageUrls,
        requestId,
        updatedAt: Date.now(),
      });

      return { id: imageId, imageUrls, requestId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected image generation error.";

      await ctx.runMutation(updateImage, {
        id: imageId,
        status: "failed",
        error: message,
        updatedAt: Date.now(),
      });

      throw error;
    }
  },
});
