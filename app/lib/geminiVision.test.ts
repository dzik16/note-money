import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseImageWithGemini,
  SchemaValidationError,
  ValidationError,
  ConfigurationError
} from './geminiVision';

const originalEnv = process.env;
const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const samplePngBuffer = Buffer.from(samplePngBase64, 'base64');

describe('Gemini Vision NLP Parser Unit Tests', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('AC 1.3: should throw ConfigurationError if GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(parseImageWithGemini(samplePngBuffer, 'image/png')).rejects.toThrow(ConfigurationError);
  });

  it('AC 1.2: should throw SchemaValidationError if Gemini returns malformed JSON candidate', async () => {
    process.env.GEMINI_API_KEY = 'mock_key';
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'invalid_json_here' }] } }]
      })
    } as any);

    await expect(parseImageWithGemini(samplePngBuffer, 'image/png')).rejects.toThrow(SchemaValidationError);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('AC 1.2: should throw SchemaValidationError if Gemini JSON does not conform to schema', async () => {
    process.env.GEMINI_API_KEY = 'mock_key';
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ nominal: 'not_a_number' }) }] } }]
      })
    } as any);

    await expect(parseImageWithGemini(samplePngBuffer, 'image/png')).rejects.toThrow(SchemaValidationError);
  });

  it('AC 1.2: should throw ValidationError if nominal <= 0', async () => {
    process.env.GEMINI_API_KEY = 'mock_key';
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                is_transaction: true,
                nominal: -1000,
                tipe: 'Pengeluaran',
                deskripsi: 'minus transaction'
              })
            }]
          }
        }]
      })
    } as any);

    await expect(parseImageWithGemini(samplePngBuffer, 'image/png')).rejects.toThrow(ValidationError);
  });

  it('should include captionContext in prompt text payload if provided', async () => {
    process.env.GEMINI_API_KEY = 'mock_key';
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                is_transaction: true,
                nominal: 25000,
                tipe: 'Pengeluaran',
                deskripsi: 'jajan bakso'
              })
            }]
          }
        }]
      })
    } as any);

    const result = await parseImageWithGemini(samplePngBuffer, 'image/png', 'jajan bakso');
    expect(result).toEqual({
      nominal: 25000,
      tipe: 'Pengeluaran',
      deskripsi: 'Jajan bakso'
    });

    const lastCallBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    const promptText = lastCallBody.contents[0].parts[0].text;
    expect(promptText).toContain('Additional user context/caption: "jajan bakso"');
  });
});

describe('Gemini Vision Live Evaluation Suite', () => {
  const hasApiKey = !!process.env.GEMINI_API_KEY;

  it('should run live tests and return null for non-transaction 1x1 image', async () => {
    if (!hasApiKey) {
      console.log('Skipping live Gemini Vision test: GEMINI_API_KEY not set.');
      return;
    }

    try {
      // Call live Gemini Vision with 1x1 solid red pixel
      const parsed = await parseImageWithGemini(samplePngBuffer, 'image/png', undefined, 15000);
      
      // Since it's a 1x1 solid red image, it should be recognized as non-transaction (return null)
      expect(parsed).toBeNull();
      console.log('Live Gemini Vision test completed: successfully returned null for 1x1 image.');
    } catch (err: any) {
      if (err.message && (err.message.includes('HTTP 429') || err.message.includes('HTTP 503') || err.message.includes('HTTP 500'))) {
        console.log('⚠️ Live Gemini Vision hit rate limit or service unavailable. Skipping assertion.');
        return;
      }
      throw err;
    }
  }, 30000);
});
