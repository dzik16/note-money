export interface ParsedMessage {
  nominal: number;
  tipe: 'Pemasukan' | 'Pengeluaran';
  deskripsi: string;
}

export function parseMessage(text: string): ParsedMessage | null {
  if (!text) return null;

  const cleanText = text.trim();
  
  // Regex to match amount: optionally prepended with rp/rp. and followed by an optional multiplier suffix (rb, ribu, k, jt, juta)
  // Matches "300rb", "300 rb", "300.000", "1.5jt", "rp 50.000", "50k", etc.
  const amountRegex = /(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta)?\b/i;
  const match = cleanText.match(amountRegex);

  if (!match) return null;

  const matchedString = match[0];
  let numStr = match[1];
  const suffix = (match[2] || '').toLowerCase();

  // Count occurrences of dots and commas
  const dotCount = (numStr.match(/\./g) || []).length;
  const commaCount = (numStr.match(/,/g) || []).length;

  if (dotCount + commaCount === 1) {
    const separator = dotCount === 1 ? '.' : ',';
    const parts = numStr.split(separator);
    const decimals = parts[1];
    if (suffix) {
      // With suffix, a single separator is always a decimal (e.g. 1.5jt, 1,5jt)
      numStr = parts[0] + '.' + decimals;
    } else {
      // Without suffix, check if it is a thousands separator (exactly 3 digits at the end)
      if (decimals.length === 3) {
        numStr = parts[0] + decimals; // Remove separator
      } else {
        numStr = parts[0] + '.' + decimals; // Treat as decimal point
      }
    }
  } else {
    // Multiple separators, e.g. 1.500.000 or 1,500,000. Remove all of them.
    numStr = numStr.replace(/[,.]/g, '');
  }

  let val = parseFloat(numStr);
  if (isNaN(val)) return null;

  if (suffix === 'rb' || suffix === 'ribu' || suffix === 'k') {
    val *= 1000;
  } else if (suffix === 'jt' || suffix === 'juta') {
    val *= 1000000;
  }

  // Extract description: remove the matched amount string and tidy up
  let desc = cleanText.replace(matchedString, '').trim();
  
  // Clean up any remaining leading/trailing punctuation or connectors (like "untuk", "buat", "untuk bayar", etc.)
  desc = desc.replace(/^[-: ]+/, '').trim();
  
  if (!desc) {
    desc = 'Transaksi Bot';
  }

  // Capitalize first letter of description
  desc = desc.charAt(0).toUpperCase() + desc.slice(1);

  // Determine type based on Indonesian/English keywords for income
  const incomeKeywords = [
    'gaji', 'nabung', 'pemasukan', 'masuk', 'dapat', 'cuan', 
    'transfer', 'saving', 'income', 'bonus', 'dapet', 'refund'
  ];
  
  const textLower = cleanText.toLowerCase();
  const isPemasukan = incomeKeywords.some(keyword => textLower.includes(keyword));
  const tipe = isPemasukan ? 'Pemasukan' : 'Pengeluaran';

  return {
    nominal: val,
    tipe,
    deskripsi: desc
  };
}
