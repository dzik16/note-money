'use client';

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] text-[#ededed] px-6 py-12">
      <div className="flex flex-col items-center max-w-md text-center space-y-6">
        {/* Glowing Wifi-Off icon wrapper */}
        <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-emerald-500/10 text-emerald-500 animate-pulse border border-emerald-500/20">
          <WifiOff className="w-12 h-12" />
          <div className="absolute inset-0 rounded-full bg-emerald-500/5 blur-xl"></div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-emerald-400">
            Koneksi Terputus
          </h1>
          <p className="text-sm text-gray-400">
            NoteMoney tidak dapat terhubung ke jaringan. Mohon periksa koneksi internet ponsel Anda.
          </p>
        </div>

        <button
          onClick={handleReload}
          className="flex items-center justify-center gap-2 w-full max-w-xs px-5 py-3 text-sm font-semibold text-[#0a0a0a] bg-emerald-500 hover:bg-emerald-400 rounded-xl transition-all duration-200 active:scale-95 shadow-lg shadow-emerald-500/10 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Coba Kembali
        </button>
      </div>
    </div>
  );
}
