import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLLMClient, getModelName, isOSeriesModel } from './llm-client.js';
import OpenAI from 'openai';

vi.mock('openai');

describe('LLM Client Utilities', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables before each test
    process.env = { ...originalEnv };
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.OPENAI_MODEL = 'gpt-4-turbo';
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    process.env.OPENROUTER_MODEL = 'anthropic/claude-3.5-sonnet';
  });

  afterEach(() => {
    // Restore original environment after tests
    process.env = { ...originalEnv };
  });

  describe('createLLMClient', () => {
    it('should create an OpenAI client when USE_OPENROUTER is not true', () => {
      process.env.USE_OPENROUTER = 'false';
      
      createLLMClient();
      
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'test-openai-key',
        baseURL: undefined,
      });
    });

    it('should create an OpenRouter client when USE_OPENROUTER is true', () => {
      process.env.USE_OPENROUTER = 'true';
      process.env.OPENROUTER_API_BASE_URL = 'https://openrouter.ai/api/v1';
      
      createLLMClient();
      
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'test-openrouter-key',
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://superglue.ai',
          'X-Title': 'Superglue App',
        },
      });
    });

    it('should use default OpenRouter URL if not specified', () => {
      process.env.USE_OPENROUTER = 'true';
      process.env.OPENROUTER_API_BASE_URL = '';
      
      createLLMClient();
      
      expect(OpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://openrouter.ai/api/v1',
        })
      );
    });
  });

  describe('getModelName', () => {
    it('should return OpenAI model when USE_OPENROUTER is not true', () => {
      process.env.USE_OPENROUTER = 'false';
      
      const model = getModelName();
      
      expect(model).toBe('gpt-4-turbo');
    });

    it('should return OpenRouter model when USE_OPENROUTER is true', () => {
      process.env.USE_OPENROUTER = 'true';
      
      const model = getModelName();
      
      expect(model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('should return schema generation model when specified and schemaGeneration is true', () => {
      process.env.USE_OPENROUTER = 'false';
      process.env.SCHEMA_GENERATION_MODEL = 'gpt-4';
      
      const model = getModelName(true);
      
      expect(model).toBe('gpt-4');
    });

    it('should return OpenRouter schema model when specified and schemaGeneration is true', () => {
      process.env.USE_OPENROUTER = 'true';
      process.env.OPENROUTER_SCHEMA_MODEL = 'openai/gpt-4o';
      
      const model = getModelName(true);
      
      expect(model).toBe('openai/gpt-4o');
    });

    it('should fallback to standard model when schema model is not specified', () => {
      process.env.USE_OPENROUTER = 'true';
      process.env.OPENROUTER_SCHEMA_MODEL = '';
      
      const model = getModelName(true);
      
      expect(model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('should use default OpenRouter model if none specified', () => {
      process.env.USE_OPENROUTER = 'true';
      process.env.OPENROUTER_MODEL = '';
      
      const model = getModelName();
      
      expect(model).toBe('openai/gpt-4o');
    });
  });

  describe('isOSeriesModel', () => {
    it('should identify OpenAI o-series models', () => {
      expect(isOSeriesModel('gpt-4o')).toBe(true);
      expect(isOSeriesModel('gpt-4o-mini')).toBe(true);
      expect(isOSeriesModel('openai/gpt-4o')).toBe(true);
    });

    it('should identify Anthropic o3 models', () => {
      expect(isOSeriesModel('claude-3-o3')).toBe(true);
      expect(isOSeriesModel('anthropic/claude-3-o3')).toBe(true);
    });

    it('should return false for non-o-series models', () => {
      expect(isOSeriesModel('gpt-4')).toBe(false);
      expect(isOSeriesModel('gpt-3.5-turbo')).toBe(false);
      expect(isOSeriesModel('claude-3-sonnet')).toBe(false);
      expect(isOSeriesModel('anthropic/claude-3-haiku')).toBe(false);
    });
  });
}); 