import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseMessageWithGemini,
  SchemaValidationError,
  ValidationError,
  ConfigurationError
} from './gemini';

const originalEnv = process.env;

describe('Gemini AI NLP Parser Unit Tests', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('AC 1.6: should throw ConfigurationError if GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(parseMessageWithGemini('300rb jajan')).rejects.toThrow(ConfigurationError);
  });

  it('AC 1.4: should throw SchemaValidationError if Gemini returns malformed JSON candidate', async () => {
    process.env.GEMINI_API_KEY = 'mock_key';
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'invalid_json_here' }] } }]
      })
    } as any);

    await expect(parseMessageWithGemini('300rb jajan')).rejects.toThrow(SchemaValidationError);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('AC 1.4: should throw SchemaValidationError if Gemini JSON does not conform to schema', async () => {
    process.env.GEMINI_API_KEY = 'mock_key';
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ nominal: 'not_a_number' }) }] } }]
      })
    } as any);

    await expect(parseMessageWithGemini('300rb jajan')).rejects.toThrow(SchemaValidationError);
  });

  it('AC 1.5: should throw ValidationError if nominal <= 0', async () => {
    process.env.GEMINI_API_KEY = 'mock_key';
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                is_transaction: true,
                nominal: -5000,
                tipe: 'Pengeluaran',
                deskripsi: 'minus transaction'
              })
            }]
          }
        }]
      })
    } as any);

    await expect(parseMessageWithGemini('300rb jajan')).rejects.toThrow(ValidationError);
  });
});

describe('Gemini NLP Live Evaluation Suite', () => {
  const hasApiKey = !!process.env.GEMINI_API_KEY;

  it('should run live tests and evaluate accuracy if API Key is configured', async () => {
    if (!hasApiKey) {
      console.log('Skipping live Gemini tests: GEMINI_API_KEY not set.');
      return;
    }

    // 50 test cases of colloquial Indonesian transaction text
    const dataset = [
      { text: 'kemarin abis jajan bensin 50rb', nominal: 50000, tipe: 'Pengeluaran' },
      { text: 'dapet bonus kerjaan 2.5jt', nominal: 2500000, tipe: 'Pemasukan' },
      { text: 'bayar makan bakso tadi siang 15 ribu', nominal: 15000, tipe: 'Pengeluaran' },
      { text: 'beli kopi starbucks 65 rebu', nominal: 65000, tipe: 'Pengeluaran' },
      { text: 'gajian masuk 7 juta rupiah', nominal: 7000000, tipe: 'Pemasukan' },
      { text: 'sisa parkir motor dapet kembalian 2 rebu', nominal: 2000, tipe: 'Pemasukan' },
      { text: 'bayar kosan bulanan 1.5 juta', nominal: 1500000, tipe: 'Pengeluaran' },
      { text: 'beli kuota internet telkomsel 120rb', nominal: 120000, tipe: 'Pengeluaran' },
      { text: 'dikasih uang saku sama mama 500 rebu', nominal: 500000, tipe: 'Pemasukan' },
      { text: 'beli tiket bioskop berdua 90k', nominal: 90000, tipe: 'Pengeluaran' },
      { text: 'jual kaos bekas laku 75 ribu', nominal: 75000, tipe: 'Pemasukan' },
      { text: 'topup saldo gopay 100 rebu', nominal: 100000, tipe: 'Pengeluaran' },
      { text: 'bayar tagihan listrik 350 ribu', nominal: 350000, tipe: 'Pengeluaran' },
      { text: 'beli token air 50k', nominal: 50000, tipe: 'Pengeluaran' },
      { text: 'nemu duit di jalan 20 rebu', nominal: 20000, tipe: 'Pemasukan' },
      { text: 'beli sabun mandi dan odol 25 ribu', nominal: 25000, tipe: 'Pengeluaran' },
      { text: 'dapet angpao lebaran 1.2jt', nominal: 1200000, tipe: 'Pemasukan' },
      { text: 'beli sepatu futsal baru 450rb', nominal: 450000, tipe: 'Pengeluaran' },
      { text: 'bayar makan malam bebek goreng 35k', nominal: 35000, tipe: 'Pengeluaran' },
      { text: 'beli jas hujan axio 150 ribu', nominal: 150000, tipe: 'Pengeluaran' },
      { text: 'dapet kembalian belanja 5 rebu', nominal: 5000, tipe: 'Pemasukan' },
      { text: 'beli roti tawar gandum 18k', nominal: 18000, tipe: 'Pengeluaran' },
      { text: 'beli susu anak 120 rebu', nominal: 120000, tipe: 'Pengeluaran' },
      { text: 'bayar iuran kebersihan RT 30 ribu', nominal: 30000, tipe: 'Pengeluaran' },
      { text: 'beli obat flu di apotek 15k', nominal: 15000, tipe: 'Pengeluaran' },
      { text: 'beli nasi uduk mpok kokom 12 rebu', nominal: 12000, tipe: 'Pengeluaran' },
      { text: 'investasi saham 500 ribu rupiah', nominal: 500000, tipe: 'Pengeluaran' },
      { text: 'beli coin crypto 300rb', nominal: 300000, tipe: 'Pengeluaran' },
      { text: 'gaji tambahan freelance coding 3.5jt', nominal: 3500000, tipe: 'Pemasukan' },
      { text: 'jual hp android jadul laku 600 rebu', nominal: 600000, tipe: 'Pemasukan' },
      { text: 'beli kacamata baru 250k', nominal: 250000, tipe: 'Pengeluaran' },
      { text: 'beli kado nikahan temen 150 ribu', nominal: 150000, tipe: 'Pengeluaran' },
      { text: 'bayar parkir mobil bandara 45 rebu', nominal: 45000, tipe: 'Pengeluaran' },
      { text: 'beli bensin pertamax 100 ribu', nominal: 100000, tipe: 'Pengeluaran' },
      { text: 'dapet hadiah undian 1jt rupiah', nominal: 1000000, tipe: 'Pemasukan' },
      { text: 'beli baju kaos polos 85k', nominal: 85000, tipe: 'Pengeluaran' },
      { text: 'topup e-money buat e-toll 150 rebu', nominal: 150000, tipe: 'Pengeluaran' },
      { text: 'beli jas hujan plastik tipis 10 rebu', nominal: 10000, tipe: 'Pengeluaran' },
      { text: 'beli martabak manis keju 45 ribu', nominal: 45000, tipe: 'Pengeluaran' },
      { text: 'beli sate padang depan gang 22k', nominal: 22000, tipe: 'Pengeluaran' },
      { text: 'dapet cash back ojol 3 rebu', nominal: 3000, tipe: 'Pemasukan' },
      { text: 'bayar arisan bulanan 200rb', nominal: 200000, tipe: 'Pengeluaran' },
      { text: 'beli sendok garpu baru 15 ribu', nominal: 15000, tipe: 'Pengeluaran' },
      { text: 'beli charger hp type c 45 rebu', nominal: 45000, tipe: 'Pengeluaran' },
      { text: 'jual jam tangan lama laku 200k', nominal: 200000, tipe: 'Pemasukan' },
      { text: 'beli pewangi ruangan glade 25k', nominal: 25000, tipe: 'Pengeluaran' },
      { text: 'beli sapu lidi 12 rebu', nominal: 12000, tipe: 'Pengeluaran' },
      { text: 'dapat kiriman uang bulanan 2 juta rupiah', nominal: 2000000, tipe: 'Pemasukan' },
      { text: 'beli buah jeruk 1 kg 30 ribu', nominal: 30000, tipe: 'Pengeluaran' },
      { text: 'jual buku pelajaran bekas laku 40k', nominal: 40000, tipe: 'Pemasukan' }
    ];

    const runAll = process.env.RUN_ALL_TESTS === 'true';
    // Slice to 5 cases by default to avoid 15 RPM rate limits on Google Gemini free tier.
    // If RUN_ALL_TESTS is true, run all 50 cases with a 4.5s delay between requests.
    const testCases = runAll ? dataset : dataset.slice(0, 5);
    const delayMs = runAll ? 4500 : 1000;

    let passed = 0;
    let rateLimited = false;
    const failures: Array<{ text: string; expected: any; got: any }> = [];

    for (const testCase of testCases) {
      try {
        const parsed = await parseMessageWithGemini(testCase.text, 15000);
        if (
          parsed &&
          parsed.nominal === testCase.nominal &&
          parsed.tipe === testCase.tipe
        ) {
          passed++;
        } else {
          failures.push({
            text: testCase.text,
            expected: { nominal: testCase.nominal, tipe: testCase.tipe },
            got: parsed
          });
        }
      } catch (err: any) {
        if (err.message && err.message.includes('HTTP 429')) {
          rateLimited = true;
        }
        failures.push({
          text: testCase.text,
          expected: { nominal: testCase.nominal, tipe: testCase.tipe },
          got: { error: err.message }
        });
      }
      await new Promise(r => setTimeout(r, delayMs));
    }

    const accuracy = (passed / testCases.length) * 100;
    console.log(`\n=== GEMINI NLP ACCURACY REPORT ===`);
    console.log(`Total Test Cases: ${testCases.length}`);
    console.log(`Passed (Correct parse): ${passed}`);
    console.log(`Failed: ${failures.length}`);
    console.log(`Accuracy Rate: ${accuracy}%`);
    if (failures.length > 0) {
      console.log('Failed details (showing up to 5):');
      failures.slice(0, 5).forEach(f => {
        console.log(` - Text: "${f.text}"\n   Expected: ${JSON.stringify(f.expected)}\n   Got: ${JSON.stringify(f.got)}`);
      });
    }
    console.log(`==================================\n`);

    if (rateLimited) {
      console.log('⚠️ Live evaluation hit Gemini 429 rate limit. Skipping accuracy threshold check.');
      return;
    }

    expect(accuracy).toBeGreaterThanOrEqual(95);
  }, 45000);
});
