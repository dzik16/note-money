import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'data', 'mock_db.json');

test.describe('NoteMoney App End-to-End Tests', () => {
  
  test.beforeEach(() => {
    // Reset/Backup the mock database if it exists to ensure a clean state
    if (fs.existsSync(DB_FILE)) {
      try {
        fs.writeFileSync(
          DB_FILE, 
          JSON.stringify({ transactions: {}, telegramMapping: {} }, null, 2), 
          'utf-8'
        );
      } catch (e) {
        console.error('Failed to clear mock db:', e);
      }
    }
  });

  test('should complete the entire user flow: Login -> Add Tx -> Simulate Bot -> Filter -> Logout', async ({ page }) => {
    
    // 1. Visit Login Page
    await page.goto('/');
    await expect(page).toHaveTitle(/NoteMoney/i);
    await expect(page.locator('h1')).toContainText('NoteMoney');
    
    // Try to submit empty username
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Username wajib diisi')).toBeVisible();

    // Fill username and login
    const testUser = 'budi_e2e';
    await page.fill('input[type="text"]', testUser);
    await page.click('button[type="submit"]');

    // Helper to parse currency text like "Rp 1.925.000" or "-Rp 75.000" into a number
    const parseCurrency = (text: string): number => {
      const clean = text.replace(/Rp/g, '').replace(/\./g, '').replace(/\s/g, '').replace(/,/g, '');
      const normalized = clean.replace(/−/g, '-').replace(/–/g, '-');
      return parseFloat(normalized) || 0;
    };

    // 2. Redirected to Dashboard
    await page.waitForURL('/dashboard');
    await expect(page.locator('text=Budi_e2e')).toBeVisible();
    await expect(page.locator('text=Total Saldo')).toBeVisible();

    // Get current balance before adding transaction (wait for stats to load first)
    const balanceLocator = page.locator('h3').first();
    await expect(balanceLocator).not.toContainText('...');
    const initialBalanceText = await balanceLocator.innerText();
    const initialBalance = parseCurrency(initialBalanceText);

    // 3. Add Transaction via Web Form (Pengeluaran)
    await page.fill('input[id="nominal"]', '75000');
    await page.fill('input[id="deskripsi"]', 'Makan Siang E2E');
    await page.click('button:has-text("Simpan Catatan")');

    // Verify success alert
    await expect(page.locator('text=Catatan transaksi berhasil disimpan!')).toBeVisible();
    
    // Verify transaction added to table
    const tableBody = page.locator('tbody');
    await expect(tableBody).toContainText('Makan Siang E2E');
    await expect(tableBody).toContainText('Rp 75.000');

    // Verify balance updated by -75k
    await expect(async () => {
      const currentBalanceText = await balanceLocator.innerText();
      const currentBalance = parseCurrency(currentBalanceText);
      expect(currentBalance).toBe(initialBalance - 75000);
    }).toPass({ timeout: 5000 });

    const balanceAfterExpense = initialBalance - 75000;

    // 4. Simulate Telegram Bot Message (Pemasukan)
    // First register chat ID to username budi_e2e
    const simulatorInput = page.locator('input[placeholder="Ketik, misal: 25rb jajan es teh..."]');
    await simulatorInput.fill(`/start ${testUser}`);
    await page.click('button[title="Kirim ke Bot Webhook"]');

    // Wait for bot reply
    await page.waitForSelector('text=Registrasi berhasil!');
    
    // Now simulate transaction chat entry: "nabung 2jt"
    await simulatorInput.fill('nabung 2jt');
    await page.click('button[title="Kirim ke Bot Webhook"]');

    // Wait for bot transaction success reply
    await page.waitForSelector('text=Catatan berhasil disimpan!');
    await expect(page.locator('.bg-gray-800').last()).toContainText('Rp 2.000.000');

    // Verify table updated with new transaction
    await expect(tableBody).toContainText('Nabung');
    await expect(tableBody).toContainText('Rp 2.000.000');

    // Verify stats updated (Balance should increase by 2,000,000)
    await expect(async () => {
      const currentBalanceText = await balanceLocator.innerText();
      const currentBalance = parseCurrency(currentBalanceText);
      expect(currentBalance).toBe(balanceAfterExpense + 2000000);
    }).toPass({ timeout: 5000 });

    const balanceAfterBotNabung = balanceAfterExpense + 2000000;

    // 4b. Test Dynamic Username Prefix Routing via Bot Simulator
    // Chat input: "dzikri 300rb jajan" -> Should route to worksheet "dzikri"
    await simulatorInput.fill('dzikri 300rb jajan');
    await page.click('button[title="Kirim ke Bot Webhook"]');
    await page.waitForSelector('text=Catatan berhasil disimpan!');
    await expect(page.locator('.bg-gray-800').last()).toContainText('*Username:* dzikri');
    await expect(page.locator('.bg-gray-800').last()).toContainText('Rp 300.000');
    await expect(page.locator('.bg-gray-800').last()).toContainText('Jajan');

    // Chat input: "Dzikri nabung 1jt" -> Case-insensitive, should route to worksheet "dzikri"
    await simulatorInput.fill('Dzikri nabung 1jt');
    await page.click('button[title="Kirim ke Bot Webhook"]');
    await page.waitForSelector('text=Catatan berhasil disimpan!');
    await expect(page.locator('.bg-gray-800').last()).toContainText('*Username:* dzikri');
    await expect(page.locator('.bg-gray-800').last()).toContainText('Rp 1.000.000');
    await expect(page.locator('.bg-gray-800').last()).toContainText('Nabung');

    // 4c. Test Non-Transaction greeting via Bot Simulator (if GEMINI_API_KEY is configured)
    if (process.env.GEMINI_API_KEY) {
      await simulatorInput.fill('halo bot');
      await page.click('button[title="Kirim ke Bot Webhook"]');
      await page.waitForSelector('text=Saya adalah bot pencatat uang personal NoteMoney');
      await expect(page.locator('.bg-gray-800').last()).toContainText('Saya adalah bot pencatat uang personal NoteMoney');
    }

    // Verify that budi_e2e stats remain unchanged (dynamic routing didn't write to budi_e2e's sheet)
    const currentBudiBalanceText = await balanceLocator.innerText();
    const currentBudiBalance = parseCurrency(currentBudiBalanceText);
    expect(currentBudiBalance).toBe(balanceAfterBotNabung);

    // 5. Test Date Filter (Set start and end date to today)
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = page.locator('input[type="date"]');
    
    // Set start date
    await dateInputs.nth(0).fill(today);
    // Set end date
    await dateInputs.nth(1).fill(today);
    await page.click('button:has-text("Filter")');

    // Verify table still displays current records (since they are created today)
    await expect(tableBody).toContainText('Nabung');

    // Set filter to past date range where no records exist
    await dateInputs.nth(0).fill('2020-01-01');
    await dateInputs.nth(1).fill('2020-01-02');
    await page.click('button:has-text("Filter")');

    // Verify table is empty
    await expect(tableBody).toContainText('Belum ada catatan transaksi');

    // Click Reset
    await page.click('button:has-text("Reset")');
    await expect(tableBody).toContainText('Nabung'); // records restored

    // 6. Logout Flow
    await page.click('button[title="Keluar"]');
    await page.waitForURL('/');
    await expect(page.locator('h1')).toContainText('NoteMoney');
  });

});
