import { makeFunctionReference } from "convex/server";

export const api = {
  images: {
    list: makeFunctionReference<"query">("images:list"),
    generate: makeFunctionReference<"action">("images:generate"),
  },
};
