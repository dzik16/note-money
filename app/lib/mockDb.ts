import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'data', 'mock_db.json');

export interface Transaction {
  no: number;
  tanggal: string;
  tipe: 'Pemasukan' | 'Pengeluaran';
  nominal: number;
  deskripsi: string;
}

interface MockDataSchema {
  transactions: { [username: string]: Transaction[] };
  telegramMapping: { [chatId: string]: string };
}

function initDb(): MockDataSchema {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  if (!fs.existsSync(DB_FILE)) {
    const defaultData: MockDataSchema = {
      transactions: {},
      telegramMapping: {},
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
    return defaultData;
  }

  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading mock DB file, resetting database.', error);
    const defaultData: MockDataSchema = {
      transactions: {},
      telegramMapping: {},
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
    return defaultData;
  }
}

function saveDb(data: MockDataSchema) {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export const mockDb = {
  getTransactions(
    username: string,
    options: { page?: number; limit?: number; startDate?: string; endDate?: string } = {}
  ): { transactions: Transaction[]; total: number } {
    const db = initDb();
    const userSheets = db.transactions[username] || [];

    // Filter by date
    let filtered = [...userSheets];
    if (options.startDate) {
      const start = new Date(options.startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter((t) => {
        const tDate = new Date(t.tanggal);
        return tDate >= start;
      });
    }
    if (options.endDate) {
      const end = new Date(options.endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((t) => {
        const tDate = new Date(t.tanggal);
        return tDate <= end;
      });
    }

    // Sort descending by date, then by no
    filtered.sort((a, b) => {
      const dateDiff = new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
      if (dateDiff !== 0) return dateDiff;
      return b.no - a.no;
    });

    const total = filtered.length;
    
    // Pagination
    const page = options.page || 1;
    const limit = options.limit || 10;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return {
      transactions: paginated,
      total,
    };
  },

  addTransaction(
    username: string,
    tx: { tipe: 'Pemasukan' | 'Pengeluaran'; nominal: number; deskripsi: string; tanggal?: string }
  ): Transaction {
    const db = initDb();
    if (!db.transactions[username]) {
      db.transactions[username] = [];
    }

    const userList = db.transactions[username];
    const newNo = userList.length + 1;
    
    const newTx: Transaction = {
      no: newNo,
      tanggal: tx.tanggal || new Date().toISOString().replace('T', ' ').substring(0, 19),
      tipe: tx.tipe,
      nominal: tx.nominal,
      deskripsi: tx.deskripsi,
    };

    userList.push(newTx);
    saveDb(db);
    return newTx;
  },

  getStats(username: string) {
    const db = initDb();
    const list = db.transactions[username] || [];

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
      .slice(-7); // Keep last 7 active days

    return {
      totalPemasukan,
      totalPengeluaran,
      saldo,
      chartData,
    };
  },

  linkTelegramChat(chatId: string, username: string): void {
    const db = initDb();
    db.telegramMapping[chatId] = username;
    saveDb(db);
  },

  getTelegramUsername(chatId: string): string | null {
    const db = initDb();
    return db.telegramMapping[chatId] || null;
  },
};
