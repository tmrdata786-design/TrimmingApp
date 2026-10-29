/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Clock, Search, RotateCcw, QrCode, Shield } from 'lucide-react';
import { UserRole } from '../types';
import { DataService } from '../services/storage';

interface TopBarProps {
  currentTabName: string;
  activeRole: UserRole;
  onOpenScanner: () => void;
  onSearch: (term: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTabName,
  activeRole,
  onOpenScanner,
  onSearch,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleReset = () => {
    if (window.confirm('Reset all operational data back to standard factory seed data?')) {
      DataService.getInstance().resetToFactoryDefaults();
      window.location.reload();
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    onSearch(e.target.value);
  };

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between gap-6 shrink-0">
      {/* Breadcrumb Section */}
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
          {currentTabName}
        </h2>
        <span className="text-slate-300 dark:text-slate-700">/</span>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Shield className="w-3.5 h-3.5 text-blue-500" />
          <span className="capitalize">{activeRole.replace('_', ' ')}</span>
        </div>
      </div>

      {/* Center Search Bar */}
      <div className="flex-1 max-w-md relative hidden md:block">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search items, PTNs, OGPs, job orders, workstations..."
          className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Right Controls: Shift Indicator & Live Clock */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">Shift A</span>
          <span className="text-slate-400 font-mono text-[11px]">(07:00 - 15:30)</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{currentTime || '08:00:00'}</span>
        </div>

        <button
          onClick={onOpenScanner}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
          title="Scan document or item"
        >
          <QrCode className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Scan QR</span>
        </button>

        <button
          onClick={handleReset}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
          title="Reset factory seed data"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
