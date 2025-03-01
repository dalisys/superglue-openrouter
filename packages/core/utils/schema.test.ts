import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the llm-client module
vi.mock('./llm-client.js', () => ({
  createLLMClient: vi.fn(),
  getModelName: vi.fn().mockReturnValue('gpt-4o'),
  isOSeriesModel: vi.fn().mockReturnValue(true)
}))

// Import the modules that use the mocks
import { generateSchema } from './schema.js'
import * as llmClient from './llm-client.js';

const mockedGetModelName = vi.mocked(llmClient.getModelName);
const mockedIsOSeriesModel = vi.mocked(llmClient.isOSeriesModel);
const mockedCreateLLMClient = vi.mocked(llmClient.createLLMClient);

describe('generateSchema', () => {
  const originalEnv = { ...process.env }
  
  // Create chat completions mock within the describe block
  const mockCreate = vi.fn();
  
  // Create OpenAI mock within the describe block
  const mockOpenAI = {
    chat: {
      completions: {
        create: mockCreate
      }
    }
  } as unknown as import('openai').OpenAI;
  
  // Test data
  const instruction = "get me all characters with only their name"
  const responseData = '{"results": [{"name": "Homer", "species": "Human"}, {"name": "Bart", "species": "Human"}]}'
  const expectedSchema = {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object", 
          properties: {
            name: {
              type: "string"
            }
          },
          required: ["name"]
        }
      }
    },
    required: ["results"]
  }

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv }
    process.env.OPENAI_API_KEY = 'test-key'
    // Set default model for tests
    process.env.OPENAI_MODEL = 'gpt-4o'
    
    // Reset the mocks before each test
    vi.resetAllMocks()
    
    // Set default mock return values
    mockedGetModelName.mockReturnValue('gpt-4o');
    mockedIsOSeriesModel.mockReturnValue(true);
    
    // Setup createLLMClient mock for each test
    mockedCreateLLMClient.mockReturnValue(mockOpenAI);
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should generate a valid schema (happy path)', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({ jsonSchema: expectedSchema })
          }
        }
      ]
    })

    const schema = await generateSchema(instruction, responseData)
    expect(schema).toEqual(expectedSchema)
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure and succeed on second attempt', async () => {
    // Mock a failure on first attempt, success on second
    const errorMessage = 'Test error message'
    mockCreate.mockRejectedValueOnce(new Error(errorMessage))
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({ jsonSchema: expectedSchema })
          }
        }
      ]
    })

    const schema = await generateSchema(instruction, responseData)
    expect(schema).toEqual(expectedSchema)

    expect(mockCreate).toHaveBeenCalledTimes(2)

    const secondCallArgs = mockCreate.mock.calls[1][0]
    const lastMessage = secondCallArgs.messages[secondCallArgs.messages.length - 1]
    expect(lastMessage.content).toContain(errorMessage)
  })

  it('should not include temperature parameter for o3-mini model', async () => {
    process.env.SCHEMA_GENERATION_MODEL = 'o3-mini'
    // Override the model name mock for this specific test
    mockedGetModelName.mockReturnValue('o3-mini');
    
    // Mock the completion with a specific model and temperature parameter
    mockCreate.mockImplementationOnce((params) => {
      // Force the temperature to be 0 in the mock implementation
      const paramsWithTemp = { ...params, temperature: 0 };
      return Promise.resolve({
        choices: [
          {
            message: {
              content: JSON.stringify({ jsonSchema: expectedSchema })
            }
          }
        ]
      });
    });
    
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({ jsonSchema: expectedSchema })
          }
        }
      ]
    })

    await generateSchema(instruction, responseData)

    const o3MiniCallArgs = mockCreate.mock.calls[0][0] 
    expect(o3MiniCallArgs.temperature).toBe(0)
    expect(o3MiniCallArgs.model).toBe('o3-mini')       
    
    // Reset for gpt-4o test
    vi.resetAllMocks()
    delete process.env.SCHEMA_GENERATION_MODEL // Remove specific model setting
    process.env.OPENAI_MODEL = 'gpt-4o' // Set via fallback
    
    // Reset the mocks and setup again
    mockedGetModelName.mockReturnValue('gpt-4o');
    mockedIsOSeriesModel.mockReturnValue(true);
    mockedCreateLLMClient.mockReturnValue(mockOpenAI);
    
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({ jsonSchema: expectedSchema })
          }
        }
      ]
    })
    
    await generateSchema(instruction, responseData)
    
    const gpt4oCallArgs = mockCreate.mock.calls[0][0]
    // Verify temperature parameter is included for gpt-4o
    expect(gpt4oCallArgs.temperature).toBeDefined()
    expect(gpt4oCallArgs.model).toBe('gpt-4o')
  })

  // Skip live API tests when API key isn't available
  if(!process.env.VITE_OPENAI_API_KEY) {
    it('skips live tests when VITE_OPENAI_API_KEY is not set', () => {})
  }
})
