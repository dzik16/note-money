import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { mockDb, Transaction } from './mockDb';

const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS
  ? path.join(process.cwd(), process.env.GOOGLE_CREDENTIALS)
  : '';
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '';

// Helper to determine if we should use Google Sheets or fallback to Mock DB
function isSheetsConfigured(): boolean {
  if (process.env.USE_MOCK_DB === 'true') {
    return false;
  }
  if (!SPREADSHEET_ID) {
    return false;
  }
  // Support loading credentials directly from JSON string (e.g. on Vercel env)
  if (process.env.GOOGLE_CREDENTIALS && process.env.GOOGLE_CREDENTIALS.trim().startsWith('{')) {
    return true;
  }
  if (!CREDENTIALS_PATH) {
    return false;
  }
  return fs.existsSync(CREDENTIALS_PATH);
}

// Helper to get Google credentials object
function getCredentials() {
  if (process.env.GOOGLE_CREDENTIALS && process.env.GOOGLE_CREDENTIALS.trim().startsWith('{')) {
    return JSON.parse(process.env.GOOGLE_CREDENTIALS);
  }
  if (!CREDENTIALS_PATH) {
    throw new Error('Google credentials path is empty.');
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

// Get the Google Sheets client
function getSheetsClient() {
  if (!isSheetsConfigured()) {
    throw new Error('Google Sheets is not configured or JSON credentials file not found.');
  }

  const credentials = getCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

// Get service account email for helpful onboarding logs/messages
export function getServiceAccountEmail(): string {
  try {
    if (isSheetsConfigured()) {
      const credentials = getCredentials();
      return credentials.client_email || 'unknown';
    }
  } catch (e) {}
  return 'not-configured';
}

// Ensure a worksheet tab exists; if not, create it with headers
async function ensureSheetExists(sheets: any, spreadsheetId: string, sheetTitle: string, headers: string[]) {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = meta.data.sheets?.some(
      (s: any) => s.properties?.title === sheetTitle
    );

    if (!sheetExists) {
      // Add sheet
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetTitle,
                },
              },
            },
          ],
        },
      });

      // Write headers
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetTitle}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [headers],
        },
      });
      console.log(`Created sheet tab: "${sheetTitle}" with headers.`);
    }
  } catch (error: any) {
    console.error(`Error ensuring sheet "${sheetTitle}" exists:`, error.message);
    if (error.message.includes('caller does not have permission')) {
      throw new Error(
        `Google Sheets Permission Error: Silakan bagikan spreadsheet Anda (Spreadsheet ID: ${spreadsheetId}) ke email Service Account berikut sebagai Editor: ${getServiceAccountEmail()}`
      );
    }
    throw error;
  }
}

const transactionLocks = new Map<string, Promise<any>>();

export const googleSheets = {
  isConfigured(): boolean {
    return isSheetsConfigured();
  },

  async getTransactions(
    username: string,
    options: { page?: number; limit?: number; startDate?: string; endDate?: string } = {}
  ): Promise<{ transactions: Transaction[]; total: number; isFallback: boolean }> {
    if (!isSheetsConfigured()) {
      console.log('Google Sheets not configured. Falling back to Mock DB.');
      const res = mockDb.getTransactions(username, options);
      return { ...res, isFallback: true };
    }

    try {
      const sheets = getSheetsClient();
      await ensureSheetExists(sheets, SPREADSHEET_ID, username, [
        'NO',
        'Tanggal',
        'Tipe',
        'Nominal',
        'Deskripsi',
      ]);

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${username}!A2:E`,
      });

      const rows = response.data.values || [];
      const list: Transaction[] = rows.map((row, idx) => ({
        no: parseInt(row[0]) || idx + 1,
        tanggal: row[1] || '',
        tipe: row[2] === 'Pemasukan' ? 'Pemasukan' : 'Pengeluaran',
        nominal: parseFloat(row[3]) || 0,
        deskripsi: row[4] || '',
      }));

      // Filter by date range if provided
      let filtered = list;
      if (options.startDate || options.endDate) {
        const start = options.startDate ? new Date(options.startDate) : new Date(0);
        const end = options.endDate ? new Date(options.endDate) : new Date(8640000000000000);
        // Set end of day for end date
        if (options.endDate) {
          end.setHours(23, 59, 59, 999);
        }

        filtered = list.filter((item) => {
          const itemDate = new Date(item.tanggal);
          return itemDate >= start && itemDate <= end;
        });
      }

      // Sort by newest first (highest NO/index first)
      filtered.sort((a, b) => b.no - a.no);

      // Pagination
      const page = options.page || 1;
      const limit = options.limit || 10;
      const startIndex = (page - 1) * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);

      return {
        transactions: paginated,
        total: filtered.length,
        isFallback: false,
      };
    } catch (error: any) {
      console.error('Google Sheets getTransactions error, falling back:', error.message);
      const res = mockDb.getTransactions(username, options);
      return { ...res, isFallback: true };
    }
  },

  async addTransaction(
    username: string,
    tx: { tipe: 'Pemasukan' | 'Pengeluaran'; nominal: number; deskripsi: string; tanggal?: string }
  ): Promise<Transaction & { isFallback: boolean }> {
    const currentLock = transactionLocks.get(username) || Promise.resolve();

    const execution = async () => {
      if (!isSheetsConfigured()) {
        console.log('Google Sheets not configured. Appending to Mock DB.');
        const res = mockDb.addTransaction(username, tx);
        return { ...res, isFallback: true };
      }

      try {
        const sheets = getSheetsClient();
        await ensureSheetExists(sheets, SPREADSHEET_ID, username, [
          'NO',
          'Tanggal',
          'Tipe',
          'Nominal',
          'Deskripsi',
        ]);

        // Read current rows to determine next NO
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${username}!A:A`,
        });
        const currentRowsCount = response.data.values ? response.data.values.length : 1;
        const nextNo = currentRowsCount; // row index 1 is header, so next row index will match row count

        const dateStr = tx.tanggal || new Date().toISOString().replace('T', ' ').substring(0, 19);
        const newRow = [nextNo, dateStr, tx.tipe, tx.nominal, tx.deskripsi];

        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${username}!A:E`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [newRow],
          },
        });

        return {
          no: nextNo,
          tanggal: dateStr,
          tipe: tx.tipe,
          nominal: tx.nominal,
          deskripsi: tx.deskripsi,
          isFallback: false,
        };
      } catch (error: any) {
        console.error('Google Sheets addTransaction error, falling back:', error.message);
        const res = mockDb.addTransaction(username, tx);
        return { ...res, isFallback: true };
      }
    };

    const nextLock = currentLock.then(execution);
    transactionLocks.set(username, nextLock.catch(() => {}));
    return nextLock;
  },

  async getStats(
    username: string
  ): Promise<{ totalPemasukan: number; totalPengeluaran: number; saldo: number; chartData: any[]; isFallback: boolean }> {
    if (!isSheetsConfigured()) {
      const res = mockDb.getStats(username);
      return { ...res, isFallback: true };
    }

    try {
      const sheets = getSheetsClient();
      await ensureSheetExists(sheets, SPREADSHEET_ID, username, [
        'NO',
        'Tanggal',
        'Tipe',
        'Nominal',
        'Deskripsi',
      ]);

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${username}!A2:E`,
      });

      const rows = response.data.values || [];
      const list: Transaction[] = rows.map((row, idx) => ({
        no: parseInt(row[0]) || idx + 1,
        tanggal: row[1] || '',
        tipe: row[2] === 'Pemasukan' ? 'Pemasukan' : 'Pengeluaran',
        nominal: parseFloat(row[3]) || 0,
        deskripsi: row[4] || '',
      }));

      let totalPemasukan = 0;
      let totalPengeluaran = 0;

      for (const t of list) {
        if (t.tipe === 'Pemasukan') {
          totalPemasukan += t.nominal;
        } else {
          totalPengeluaran += t.nominal;
        }
      }

      const saldo = totalPemasukan - totalPengeluaran;

      // Grouping by date for chart (last 7 days containing transactions)
      const dailyMap: { [date: string]: { pemasukan: number; pengeluaran: number } } = {};
      for (const t of list) {
        if (!t.tanggal) continue;
        const dateOnly = t.tanggal.split(' ')[0]; // YYYY-MM-DD
        if (!dailyMap[dateOnly]) {
          dailyMap[dateOnly] = { pemasukan: 0, pengeluaran: 0 };
        }
        if (t.tipe === 'Pemasukan') {
          dailyMap[dateOnly].pemasukan += t.nominal;
        } else {
          dailyMap[dateOnly].pengeluaran += t.nominal;
        }
      }

      const chartData = Object.keys(dailyMap)
        .sort()
        .map((date) => ({
          date,
          pemasukan: dailyMap[date].pemasukan,
          pengeluaran: dailyMap[date].pengeluaran,
        }))
        .slice(-7);

      return {
        totalPemasukan,
        totalPengeluaran,
        saldo,
        chartData,
        isFallback: false,
      };
    } catch (error: any) {
      console.error('Google Sheets getStats error, falling back:', error.message);
      const res = mockDb.getStats(username);
      return { ...res, isFallback: true };
    }
  },

  async linkTelegramChat(chatId: string, username: string): Promise<boolean> {
    if (!isSheetsConfigured()) {
      mockDb.linkTelegramChat(chatId, username);
      return true;
    }

    try {
      const sheets = getSheetsClient();
      const sheetTitle = '_telegram_users';
      await ensureSheetExists(sheets, SPREADSHEET_ID, sheetTitle, ['ChatID', 'Username']);

      // Check if ChatID already exists
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetTitle}!A:B`,
      });

      const rows = response.data.values || [];
      let foundIndex = -1;

      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === chatId) {
          foundIndex = i + 1; // 1-indexed row number
          break;
        }
      }

      if (foundIndex !== -1) {
        // Update existing row
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetTitle}!B${foundIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[username]],
          },
        });
      } else {
        // Append new row
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetTitle}!A:B`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[chatId, username]],
          },
        });
      }
      return true;
    } catch (error: any) {
      console.error('Google Sheets linkTelegramChat error, falling back:', error.message);
      mockDb.linkTelegramChat(chatId, username);
      return true;
    }
  },

  async getTelegramUsername(chatId: string): Promise<string | null> {
    if (!isSheetsConfigured()) {
      return mockDb.getTelegramUsername(chatId);
    }

    try {
      const sheets = getSheetsClient();
      const sheetTitle = '_telegram_users';
      await ensureSheetExists(sheets, SPREADSHEET_ID, sheetTitle, ['ChatID', 'Username']);

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetTitle}!A:B`,
      });

      const rows = response.data.values || [];
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === chatId) {
          return rows[i][1];
        }
      }
      return null;
    } catch (error: any) {
      console.error('Google Sheets getTelegramUsername error, falling back:', error.message);
      return mockDb.getTelegramUsername(chatId);
    }
  },
};
