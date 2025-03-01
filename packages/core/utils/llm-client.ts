import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/index.mjs";
import "dotenv/config";

/**
 * Creates an OpenAI-compatible client for LLM operations
 * Will use OpenRouter if USE_OPENROUTER is set to true in environment variables
 * @returns OpenAI client instance configured for either OpenAI or OpenRouter
 */
export function createLLMClient(): OpenAI {
  // Check if OpenRouter is enabled
  const useOpenRouter = process.env.USE_OPENROUTER === "true";

  if (useOpenRouter) {
    console.log("Using OpenRouter for LLM operations");
    return new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL:
        process.env.OPENROUTER_API_BASE_URL || "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://superglue.ai", // Replace with your site URL
        "X-Title": "Superglue App",
      },
    });
  } else {
    console.log("Using OpenAI for LLM operations");
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_BASE_URL,
    });
  }
}

/**
 * Gets the appropriate model name based on configuration
 * @param schemaGeneration Whether this is for schema generation
 * @returns The model name to use
 */
export function getModelName(schemaGeneration = false): string {
  const useOpenRouter = process.env.USE_OPENROUTER === "true";

  if (useOpenRouter) {
    if (schemaGeneration) {
      return (
        process.env.OPENROUTER_SCHEMA_MODEL ||
        process.env.OPENROUTER_MODEL ||
        "openai/gpt-4o"
      );
    } else {
      return process.env.OPENROUTER_MODEL || "openai/gpt-4o";
    }
  } else {
    if (schemaGeneration) {
      return process.env.SCHEMA_GENERATION_MODEL || process.env.OPENAI_MODEL;
    } else {
      return process.env.OPENAI_MODEL;
    }
  }
}

/**
 * Determines if o-series model features should be used based on model name
 * @param modelName The model name
 * @returns True if o-series features should be used
 */
export function isOSeriesModel(modelName: string): boolean {
  return (
    String(modelName).includes("gpt-4o") || String(modelName).includes("o3")
  );
}
