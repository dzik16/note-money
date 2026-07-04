import { ParsedMessage } from './parser';

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export interface GeminiJSONResponse {
  is_transaction: boolean;
  nominal: number;
  tipe: 'Pemasukan' | 'Pengeluaran';
  deskripsi: string;
}

export async function parseMessageWithGemini(text: string, timeoutMs: number = 2000): Promise<ParsedMessage | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ConfigurationError('GEMINI_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Extract transaction details from this Indonesian message: "${text}".\n\nIf it is not a transaction (e.g. general greeting, chit-chat, hello, question), set is_transaction to false. Otherwise set it to true.`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                is_transaction: { type: 'BOOLEAN' },
                nominal: { type: 'INTEGER' },
                tipe: { type: 'STRING', enum: ['Pemasukan', 'Pengeluaran'] },
                deskripsi: { type: 'STRING' },
              },
              required: ['is_transaction', 'nominal', 'tipe', 'deskripsi'],
            },
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API Error: HTTP ${response.status}`);
    }

    const result = await response.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new SchemaValidationError('Failed to parse Gemini API response structure');
    }

    let parsedJson: GeminiJSONResponse;
    try {
      parsedJson = JSON.parse(rawText.trim());
    } catch (e) {
      throw new SchemaValidationError('Gemini API returned invalid JSON');
    }

    if (
      typeof parsedJson.is_transaction !== 'boolean' ||
      typeof parsedJson.nominal !== 'number' ||
      typeof parsedJson.tipe !== 'string' ||
      typeof parsedJson.deskripsi !== 'string'
    ) {
      throw new SchemaValidationError('Gemini API JSON response does not conform to schema');
    }

    if (!parsedJson.is_transaction) {
      return null;
    }

    if (parsedJson.nominal <= 0) {
      throw new ValidationError('Nominal must be greater than 0');
    }

    const formattedDesc = parsedJson.deskripsi.trim();
    const capitalizedDesc = formattedDesc ? formattedDesc.charAt(0).toUpperCase() + formattedDesc.slice(1) : 'Transaksi Bot';

    return {
      nominal: parsedJson.nominal,
      tipe: parsedJson.tipe,
      deskripsi: capitalizedDesc,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Gemini API call timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
