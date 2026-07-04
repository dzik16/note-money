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

export interface GeminiVisionJSONResponse {
  is_transaction: boolean;
  nominal: number;
  tipe: 'Pemasukan' | 'Pengeluaran';
  deskripsi: string;
}

export async function parseImageWithGemini(
  imageBuffer: Buffer,
  mimeType: string,
  captionContext?: string,
  timeoutMs: number = 10000
): Promise<ParsedMessage | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ConfigurationError('GEMINI_API_KEY is not configured');
  }

  const base64Data = imageBuffer.toString('base64');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let promptText = "Identify if this image is a transaction receipt (bank/e-wallet transfer receipt, e.g. BCA, Mandiri, GoPay, OVO, ShopeePay, Dana, LinkAja) from Indonesia. If it is not a transaction receipt, set is_transaction to false. If it is, set is_transaction to true and extract: nominal, tipe ('Pemasukan' or 'Pengeluaran'), and deskripsi (e.g. transfer source, destination, purpose, or bank/e-wallet name).";
  
  if (captionContext) {
    promptText += `\n\nAdditional user context/caption: "${captionContext}". Use this context to help determine description and purpose of the transaction.`;
  }

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
                  text: promptText
                },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data,
                  },
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

    let parsedJson: GeminiVisionJSONResponse;
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
    const capitalizedDesc = formattedDesc ? formattedDesc.charAt(0).toUpperCase() + formattedDesc.slice(1) : 'Transaksi OCR';

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
