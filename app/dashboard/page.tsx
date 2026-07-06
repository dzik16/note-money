'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Coins,
  LogOut,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  Send,
  MessageSquare,
  Plus,
  RefreshCw,
  Info,
  ChevronLeft,
  ChevronRight,
  Database
} from 'lucide-react';

interface Transaction {
  no: number;
  tanggal: string;
  tipe: 'Pemasukan' | 'Pengeluaran';
  nominal: number;
  deskripsi: string;
}

interface ChartItem {
  date: string;
  pemasukan: number;
  pengeluaran: number;
}

interface StatsData {
  totalPemasukan: number;
  totalPengeluaran: number;
  saldo: number;
  chartData: ChartItem[];
  isFallback: boolean;
}

export default function DashboardPage() {
  const router = useRouter();

  // User State
  const [username, setUsername] = useState('Pengguna');
  const [isFallback, setIsFallback] = useState(false);

  // Transactions State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loadingList, setLoadingList] = useState(false);

  // Stats State
  const [stats, setStats] = useState<StatsData>({
    totalPemasukan: 0,
    totalPengeluaran: 0,
    saldo: 0,
    chartData: [],
    isFallback: false,
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // Filters State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [chartFilter, setChartFilter] = useState<'harian' | 'bulanan' | 'tahunan'>('bulanan');
  const [activeTooltipIndex, setActiveTooltipIndex] = useState<number | null>(null);

  // Form State
  const [tipe, setTipe] = useState<'Pemasukan' | 'Pengeluaran'>('Pengeluaran');
  const [nominal, setNominal] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [addingTransaction, setAddingTransaction] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  // Simulator State
  const [simulatorText, setSimulatorText] = useState('');
  const [simulatorChatId, setSimulatorChatId] = useState('123456');
  const [simulatorLoading, setSimulatorLoading] = useState(false);
  const [chatLogs, setChatLogs] = useState<{ sender: 'user' | 'bot'; text: string; time: string }[]>([
    {
      sender: 'bot',
      text: 'Halo! Saya bot pencatat uang. 🤖\n\nUntuk menyambungkan akun Anda, silakan ketik:\n`/start <username>` (contoh: `/start budi`)\n\nSetelah terhubung, Anda bisa mencatat uang dengan mengetik nominal dan keterangan, contoh:\n• `300rb jajan`\n• `nabung 1jt`\n• `Cash 50rb`',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Fetch Stats
  const fetchStats = useCallback(async (filterOverride?: 'harian' | 'bulanan' | 'tahunan') => {
    setLoadingStats(true);
    const filterToUse = filterOverride || chartFilter;
    try {
      const response = await fetch(`/api/stats?filter=${filterToUse}`);
      const data = await response.json();
      if (response.ok) {
        setStats({
          totalPemasukan: data.totalPemasukan,
          totalPengeluaran: data.totalPengeluaran,
          saldo: data.saldo,
          chartData: data.chartData || [],
          isFallback: data.isFallback,
        });
        setIsFallback(data.isFallback);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoadingStats(false);
    }
  }, [chartFilter]);

  // Fetch Transactions List
  const fetchTransactions = useCallback(async (targetPage = 1) => {
    setLoadingList(true);
    try {
      let url = `/api/transactions?page=${targetPage}&limit=${limit}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const response = await fetch(url);
      const data = await response.json();
      if (response.ok) {
        setTransactions(data.transactions || []);
        setTotalTransactions(data.total || 0);
        setPage(data.page || 1);
        if (data.username) {
          // Capitalize username
          const name = data.username.charAt(0).toUpperCase() + data.username.slice(1);
          setUsername(name);
        }
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoadingList(false);
    }
  }, [limit, startDate, endDate]);

  // Handle Initial Load
  useEffect(() => {
    fetchStats();
    fetchTransactions(1);
  }, [fetchStats, fetchTransactions]);

  // Refresh Dashboard
  const refreshData = () => {
    fetchStats();
    fetchTransactions(page);
  };

  // Handle Chart Filter Change
  const handleFilterChange = (newFilter: 'harian' | 'bulanan' | 'tahunan') => {
    setChartFilter(newFilter);
    fetchStats(newFilter);
  };

  // Handle Add Transaction Form Submit
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nominal || parseFloat(nominal) <= 0) {
      setFormError('Nominal harus lebih dari 0');
      return;
    }
    if (!deskripsi.trim()) {
      setFormError('Deskripsi wajib diisi');
      return;
    }

    setAddingTransaction(true);
    setFormError('');
    setFormSuccess(false);

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipe,
          nominal: parseFloat(nominal),
          deskripsi: deskripsi.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal menyimpan transaksi');
      }

      setFormSuccess(true);
      setNominal('');
      setDeskripsi('');
      refreshData();
      
      // Auto clear success alert
      setTimeout(() => setFormSuccess(false), 3000);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan');
    } finally {
      setAddingTransaction(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth', { method: 'DELETE' });
      if (res.ok) {
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Handle Telegram Chat Simulation
  const handleSimulateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatorText.trim()) return;

    const userMsg = simulatorText.trim();
    setSimulatorText('');
    setSimulatorLoading(true);

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatLogs((prev) => [...prev, { sender: 'user', text: userMsg, time: nowStr }]);

    try {
      const response = await fetch('/api/webhook/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: Math.floor(Math.random() * 10000),
            chat: {
              id: parseInt(simulatorChatId) || 123456,
              first_name: 'Tester',
            },
            from: {
              id: parseInt(simulatorChatId) || 123456,
            },
            text: userMsg,
            date: Math.floor(Date.now() / 1000),
          },
        }),
      });

      const data = await response.json();
      
      setChatLogs((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: data.reply || 'Tidak ada respon dari bot.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      if (response.ok && data.success) {
        refreshData();
      }
    } catch (err) {
      setChatLogs((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'Error: Gagal menghubungi webhook webhook bot.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setSimulatorLoading(false);
    }
  };

  // Format currency
  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  // Pagination totals
  const totalPages = Math.ceil(totalTransactions / limit) || 1;

  // Custom Chart dimensions and rendering math
  const maxChartVal = stats.chartData.reduce(
    (max, item) => Math.max(max, item.pemasukan, item.pengeluaran),
    100000 // default min height scale
  );

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 font-sans flex flex-col relative overflow-hidden pb-12">
      {/* Background ambient light */}
      <div className="absolute top-[-30%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-600/5 blur-[120px] pointer-events-none" />

      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 bg-gray-950/70 backdrop-blur-md border-b border-gray-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/10">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
              Note<span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Money</span>
            </h1>
            <span className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">Dashboard Keuangan</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Storage status badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900 border border-gray-800 text-xs">
            <Database className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-400 font-medium">Penyimpanan:</span>
            {isFallback ? (
              <span className="text-amber-400 flex items-center gap-1 font-semibold">
                ● Mode Lokal (Mock)
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                ● Google Sheets
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold">
              {username}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-850 hover:text-white transition-all text-gray-400"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* WARNING FALLBACK NOTE FOR USER */}
      {isFallback && (
        <div className="mx-6 mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300/90 leading-relaxed shadow-sm">
          <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <strong>Mode Penyimpanan Lokal Aktif:</strong> File kredensial Google Sheets tidak ditemukan atau spreadsheet ID belum tervalidasi. Data Anda disimpan sementara secara lokal di <code className="bg-amber-950/40 px-1 py-0.5 rounded text-amber-200">data/mock_db.json</code>. Anda tetap bisa menguji seluruh fitur pencatatan, grafik, dan integrasi Telegram Bot.
          </div>
        </div>
      )}

      {/* DASHBOARD CONTENT GRID */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: STATS OVERVIEW & CHARTS (2/3 width on wide screens) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* STATS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Saldo / Balance */}
            <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-5 backdrop-blur-sm relative overflow-hidden flex flex-col justify-between h-[120px] shadow-sm">
              <div>
                <span className="text-xs text-gray-400 font-medium">Total Saldo</span>
                <h3 className={`text-2xl font-bold mt-1 tracking-tight ${stats.saldo >= 0 ? 'text-white' : 'text-rose-400'}`}>
                  {loadingStats ? '...' : formatIDR(stats.saldo)}
                </h3>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 border-t border-gray-800/60 pt-2.5 mt-2">
                <span>Bersih saat ini</span>
                <Wallet className="w-3.5 h-3.5 text-indigo-400" />
              </div>
            </div>

            {/* Pemasukan / Income */}
            <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-5 backdrop-blur-sm relative overflow-hidden flex flex-col justify-between h-[120px] shadow-sm">
              <div>
                <span className="text-xs text-gray-400 font-medium text-emerald-400/90 flex items-center gap-1">
                  Pemasukan <TrendingUp className="w-3 h-3 text-emerald-400" />
                </span>
                <h3 className="text-2xl font-bold mt-1 tracking-tight text-white">
                  {loadingStats ? '...' : formatIDR(stats.totalPemasukan)}
                </h3>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 border-t border-gray-800/60 pt-2.5 mt-2">
                <span>Uang masuk</span>
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                </div>
              </div>
            </div>

            {/* Pengeluaran / Expense */}
            <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-5 backdrop-blur-sm relative overflow-hidden flex flex-col justify-between h-[120px] shadow-sm">
              <div>
                <span className="text-xs text-gray-400 font-medium text-rose-400/90 flex items-center gap-1">
                  Pengeluaran <TrendingDown className="w-3 h-3 text-rose-400" />
                </span>
                <h3 className="text-2xl font-bold mt-1 tracking-tight text-white">
                  {loadingStats ? '...' : formatIDR(stats.totalPengeluaran)}
                </h3>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 border-t border-gray-800/60 pt-2.5 mt-2">
                <span>Uang keluar</span>
                <div className="w-5 h-5 rounded-full bg-rose-500/10 flex items-center justify-center">
                  <TrendingDown className="w-3 h-3 text-rose-400" />
                </div>
              </div>
            </div>

          </div>

          {/* CUSTOM SVG GRAPH / CHART */}
          <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-6 backdrop-blur-sm shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-white">Grafik Tren Transaksi</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {chartFilter === 'harian' && 'Perbandingan pemasukan & pengeluaran 7 hari terakhir'}
                  {chartFilter === 'bulanan' && 'Perbandingan pemasukan & pengeluaran bulanan'}
                  {chartFilter === 'tahunan' && 'Perbandingan pemasukan & pengeluaran tahunan'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-850">
                  {(['harian', 'bulanan', 'tahunan'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => handleFilterChange(filter)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize cursor-pointer ${
                        chartFilter === filter
                          ? 'bg-emerald-500 text-gray-950 shadow-sm'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                <button
                  onClick={refreshData}
                  className="p-2.5 rounded-xl bg-gray-950 border border-gray-850 hover:bg-gray-900 hover:text-white transition-all text-gray-400 text-xs flex items-center justify-center cursor-pointer"
                  title="Refresh Grafik"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {loadingStats ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-gray-500">
                Memuat grafik...
              </div>
            ) : stats.chartData.length === 0 ? (
              <div className="h-[200px] flex flex-col items-center justify-center text-xs text-gray-500 border border-dashed border-gray-800 rounded-xl">
                <span>Belum ada riwayat aktivitas keuangan untuk ditampilkan grafiknya.</span>
                <span className="mt-1">Kirimkan catatan pemasukan atau pengeluaran terlebih dahulu.</span>
              </div>
            ) : (
              <div className="w-full relative">
                {/* SVG Visual Chart */}
                <svg
                  viewBox="0 0 500 200"
                  className="w-full h-[220px] overflow-visible"
                  onMouseLeave={() => setActiveTooltipIndex(null)}
                >
                  {/* Grid Lines */}
                  <line x1="40" y1="20" x2="480" y2="20" stroke="#1f2937" strokeDasharray="3,3" />
                  <line x1="40" y1="65" x2="480" y2="65" stroke="#1f2937" strokeDasharray="3,3" />
                  <line x1="40" y1="110" x2="480" y2="110" stroke="#1f2937" strokeDasharray="3,3" />
                  <line x1="40" y1="155" x2="480" y2="155" stroke="#1f2937" />

                  {/* Render Columns */}
                  {stats.chartData.map((item, index) => {
                    const totalDays = stats.chartData.length;
                    const xSpacing = 440 / totalDays;
                    const x = 50 + index * xSpacing;
                    
                    // Height computations
                    const maxBarHeight = 135;
                    const incomeHeight = (item.pemasukan / maxChartVal) * maxBarHeight;
                    const expenseHeight = (item.pengeluaran / maxChartVal) * maxBarHeight;

                    // Bar starting Y values
                    const incomeY = 155 - incomeHeight;
                    const expenseY = 155 - expenseHeight;

                    // Day, Month, or Year formatting
                    let displayDate = item.date;
                    const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                    try {
                      const parts = item.date.split('-');
                      if (parts.length === 3) {
                        displayDate = `${parts[2]}/${parts[1]}`;
                      } else if (parts.length === 2) {
                        const yearShort = parts[0].substring(2);
                        const monthIdx = parseInt(parts[1]) - 1;
                        displayDate = `${MONTHS_SHORT[monthIdx]} '${yearShort}`;
                      }
                    } catch (e) {}

                    // Hide tooltip if both income and expense are 0
                    const hasData = item.pemasukan > 0 || item.pengeluaran > 0;

                    return (
                      <g
                        key={item.date}
                        className="group"
                        onMouseEnter={() => hasData && setActiveTooltipIndex(index)}
                        onMouseLeave={() => setActiveTooltipIndex(null)}
                        onTouchStart={() => hasData && setActiveTooltipIndex(index)}
                      >
                        {/* Income Bar (Green) */}
                        <rect
                          x={x}
                          y={incomeY}
                          width={xSpacing * 0.3}
                          height={Math.max(incomeHeight, 2)} // min height 2px to be visible
                          rx="3"
                          className="fill-emerald-500/80 hover:fill-emerald-400 transition-all cursor-pointer"
                        />
                        
                        {/* Expense Bar (Red) */}
                        <rect
                          x={x + xSpacing * 0.35}
                          y={expenseY}
                          width={xSpacing * 0.3}
                          height={Math.max(expenseHeight, 2)}
                          rx="3"
                          className="fill-rose-500/80 hover:fill-rose-400 transition-all cursor-pointer"
                        />

                        {/* Date labels at bottom */}
                        <text
                          x={x + xSpacing * 0.3}
                          y="175"
                          textAnchor="middle"
                          className="text-[10px] fill-gray-500 font-medium"
                        >
                          {displayDate}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Floating Interactive HTML Tooltip Overlay */}
                {activeTooltipIndex !== null && stats.chartData[activeTooltipIndex] && (
                  (() => {
                    const item = stats.chartData[activeTooltipIndex];
                    const totalDays = stats.chartData.length;
                    const xSpacing = 440 / totalDays;
                    const barCenter = 50 + activeTooltipIndex * xSpacing + (xSpacing * 0.65) / 2;
                    const leftPercent = (barCenter / 500) * 100;

                    // Edge boundary shift prevention
                    let translateX = '-translate-x-1/2';
                    let tooltipLeft: string | undefined = `${leftPercent}%`;
                    let tooltipRight: string | undefined = undefined;

                    if (activeTooltipIndex === 0) {
                      tooltipLeft = '10px';
                      translateX = 'translate-x-0';
                    } else if (activeTooltipIndex === totalDays - 1) {
                      tooltipLeft = 'auto';
                      tooltipRight = '10px';
                      translateX = 'translate-x-0';
                    }

                    return (
                      <div
                        className={`absolute bottom-[200px] z-50 bg-gray-950/95 border border-gray-800 p-3 rounded-xl shadow-xl backdrop-blur-md text-[11px] min-w-[140px] pointer-events-none transition-all duration-150 ease-out opacity-100 ${translateX}`}
                        style={{
                          left: tooltipLeft,
                          right: tooltipRight,
                        }}
                      >
                        <div className="text-gray-400 font-semibold mb-1.5 border-b border-gray-800/80 pb-1 text-center">
                          {chartFilter === 'harian' && `Tanggal: ${item.date}`}
                          {chartFilter === 'tahunan' && `Tahun: ${item.date}`}
                          {chartFilter === 'bulanan' && (() => {
                            try {
                              const parts = item.date.split('-');
                              const monthIdx = parseInt(parts[1]) - 1;
                              const fullMonths = [
                                'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                                'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                              ];
                              return `${fullMonths[monthIdx]} ${parts[0]}`;
                            } catch (e) {
                              return item.date;
                            }
                          })()}
                        </div>
                        <div className="flex items-center justify-between gap-3 text-emerald-400 mb-0.5">
                          <span>Uang Masuk:</span>
                          <span className="font-bold">{formatIDR(item.pemasukan)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-rose-400">
                          <span>Uang Keluar:</span>
                          <span className="font-bold">{formatIDR(item.pengeluaran)}</span>
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* Legend */}
                <div className="flex justify-center gap-6 mt-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-emerald-500/80" />
                    <span className="text-gray-400">Pemasukan</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-rose-500/80" />
                    <span className="text-gray-400">Pengeluaran</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* TRANSACTION TABLE LIST */}
          <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-6 backdrop-blur-sm shadow-md">
            
            {/* Header & Date Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-white">Riwayat Transaksi</h3>
                <p className="text-xs text-gray-400 mt-0.5">Daftar transaksi Anda secara lengkap</p>
              </div>

              {/* Date Filter Inputs */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="flex items-center gap-1 bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-gray-300 focus:outline-none w-[110px]"
                    title="Mulai Tanggal"
                  />
                  <span className="text-gray-600 px-1">s/d</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-gray-300 focus:outline-none w-[110px]"
                    title="Sampai Tanggal"
                  />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => fetchTransactions(1)}
                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all font-medium"
                  >
                    Filter
                  </button>
                  {(startDate || endDate) && (
                    <button
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                        // Clear inputs and fetch
                        setTimeout(() => {
                          setPage(1);
                          fetchTransactions(1);
                        }, 50);
                      }}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-all"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="text-xs text-gray-400 uppercase bg-gray-950/60 border-b border-gray-850">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-center w-[50px]">NO</th>
                    <th scope="col" className="px-4 py-3">Tanggal & Waktu</th>
                    <th scope="col" className="px-4 py-3">Tipe</th>
                    <th scope="col" className="px-4 py-3 text-right">Nominal</th>
                    <th scope="col" className="px-4 py-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-850">
                  {loadingList ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-xs text-gray-500">
                        Memuat data transaksi...
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-xs text-gray-500">
                        Belum ada catatan transaksi.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={`${tx.no}-${tx.tanggal}`} className="hover:bg-gray-850/20 transition-colors">
                        <td className="px-4 py-3.5 text-center font-mono text-xs">{tx.no}</td>
                        <td className="px-4 py-3.5 text-xs text-gray-300 whitespace-nowrap">
                          {tx.tanggal}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                              tx.tipe === 'Pemasukan'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {tx.tipe}
                          </span>
                        </td>
                        <td className={`px-4 py-3.5 text-right font-mono text-xs font-semibold ${
                          tx.tipe === 'Pemasukan' ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {tx.tipe === 'Pemasukan' ? '+' : '-'} {formatIDR(tx.nominal)}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-300 truncate max-w-[200px]">
                          {tx.deskripsi}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-850 mt-4 pt-4">
                <span className="text-xs text-gray-500">
                  Menampilkan halaman <strong className="text-gray-400 font-semibold">{page}</strong> dari <strong className="text-gray-400 font-semibold">{totalPages}</strong> ({totalTransactions} transaksi)
                </span>
                <div className="flex items-center gap-1 text-xs">
                  <button
                    onClick={() => {
                      if (page > 1) {
                        const newPage = page - 1;
                        setPage(newPage);
                        fetchTransactions(newPage);
                      }
                    }}
                    disabled={page === 1}
                    className="p-2 rounded-lg bg-gray-950 border border-gray-800 hover:bg-gray-900 disabled:opacity-40 disabled:hover:bg-gray-950 hover:text-white transition-all text-gray-400 flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Kembali
                  </button>
                  <button
                    onClick={() => {
                      if (page < totalPages) {
                        const newPage = page + 1;
                        setPage(newPage);
                        fetchTransactions(newPage);
                      }
                    }}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg bg-gray-950 border border-gray-800 hover:bg-gray-900 disabled:opacity-40 disabled:hover:bg-gray-950 hover:text-white transition-all text-gray-400 flex items-center gap-1"
                  >
                    Lanjut
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* RIGHT COLUMN: ADD FORM & TELEGRAM BOT SIMULATOR */}
        <div className="space-y-6">

          {/* ADD RECORD FORM */}
          <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-6 backdrop-blur-sm shadow-md">
            <h3 className="text-base font-bold text-white mb-1.5 flex items-center gap-2">
              <Plus className="w-4 h-4 text-violet-400" />
              Tambah Catatan Baru
            </h3>
            <p className="text-xs text-gray-400 mb-5">Input manual pemasukan atau pengeluaran Anda</p>

            <form onSubmit={handleAddTransaction} className="space-y-4">
              
              {/* Type Switcher */}
              <div>
                <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Tipe Transaksi
                </label>
                <div className="grid grid-cols-2 gap-2 bg-gray-950 p-1 rounded-xl border border-gray-850">
                  <button
                    type="button"
                    onClick={() => setTipe('Pengeluaran')}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                      tipe === 'Pengeluaran'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : 'text-gray-400 hover:text-gray-255 hover:bg-gray-900 border border-transparent'
                    }`}
                  >
                    Pengeluaran
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipe('Pemasukan')}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                      tipe === 'Pemasukan'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'text-gray-400 hover:text-gray-255 hover:bg-gray-900 border border-transparent'
                    }`}
                  >
                    Pemasukan
                  </button>
                </div>
              </div>

              {/* Nominal Amount */}
              <div>
                <label htmlFor="nominal" className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Nominal (Rupiah)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-semibold text-gray-500">
                    Rp
                  </span>
                  <input
                    type="number"
                    id="nominal"
                    value={nominal}
                    onChange={(e) => setNominal(e.target.value)}
                    placeholder="Contoh: 50000"
                    className="block w-full pl-9 pr-4 py-2.5 bg-gray-950/80 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 text-xs"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="deskripsi" className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Deskripsi / Keterangan
                </label>
                <input
                  type="text"
                  id="deskripsi"
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  placeholder="Contoh: Makan bakso, Gaji bulanan"
                  className="block w-full px-4 py-2.5 bg-gray-950/80 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 text-xs"
                  required
                />
              </div>

              {formError && (
                <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/25 p-2 rounded-lg">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 p-2 rounded-lg">
                  Catatan transaksi berhasil disimpan!
                </div>
              )}

              <button
                type="submit"
                disabled={addingTransaction}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-xs transition-all active:scale-[0.98] shadow-md shadow-indigo-600/10"
              >
                {addingTransaction ? 'Menyimpan...' : 'Simpan Catatan'}
              </button>

            </form>
          </div>

          {/* TELEGRAM WEBHOOK SIMULATOR */}
          <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-6 backdrop-blur-sm shadow-md flex flex-col h-[400px]">
            <div className="mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                Simulator Chat Bot Telegram
              </h3>
              <p className="text-[10px] text-gray-500 leading-normal mt-0.5">Simulasikan pengiriman pesan NLP dari Telegram</p>
            </div>

            {/* Chat Messages Display Box */}
            <div className="flex-1 bg-gray-950/80 border border-gray-850 rounded-xl p-3 overflow-y-auto space-y-3 font-sans text-xs scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
              {chatLogs.map((log, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${log.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap ${
                      log.sender === 'user'
                        ? 'bg-violet-600 text-white rounded-tr-none'
                        : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700/50'
                    }`}
                  >
                    {log.text}
                  </div>
                  <span className="text-[9px] text-gray-600 mt-1 px-1">{log.time}</span>
                </div>
              ))}
              {simulatorLoading && (
                <div className="flex justify-start items-center gap-1 text-gray-600 px-1 py-1">
                  <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              )}
            </div>

            {/* Simulator Input Bar */}
            <form onSubmit={handleSimulateChat} className="flex gap-1.5 mt-3 shrink-0">
              <input
                type="text"
                value={simulatorText}
                onChange={(e) => setSimulatorText(e.target.value)}
                placeholder="Ketik, misal: 25rb jajan es teh..."
                disabled={simulatorLoading}
                className="flex-1 px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs"
              />
              <button
                type="submit"
                disabled={simulatorLoading || !simulatorText.trim()}
                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-all text-white flex items-center justify-center shrink-0 w-9 h-9"
                title="Kirim ke Bot Webhook"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            
            {/* Setting Chat ID for simulation link */}
            <div className="flex items-center justify-between mt-3 text-[10px] text-gray-600 border-t border-gray-850/60 pt-2 shrink-0">
              <span>Simulated Telegram ChatID:</span>
              <input
                type="text"
                value={simulatorChatId}
                onChange={(e) => setSimulatorChatId(e.target.value.replace(/\D/g, ''))}
                className="bg-transparent border-b border-gray-800 w-[60px] text-right text-gray-500 font-mono focus:outline-none focus:border-violet-500"
                title="Mock Chat ID"
              />
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
