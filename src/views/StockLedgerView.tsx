/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Boxes, Filter, Search, ArrowUpRight, ArrowDownLeft, ShieldCheck, Download, Plus } from 'lucide-react';
import { DataService } from '../services/storage';
import { formatNumber } from '../services/inventoryEngine';
import { InventoryTransaction, StockBalance, Location, Item } from '../types';
import { exportToCSV } from '../services/exportUtils';

export const StockLedgerView: React.FC = () => {
  const ds = DataService.getInstance();

  const [balances, setBalances] = useState<StockBalance[]>(ds.getBalances());
  const [transactions, setTransactions] = useState<InventoryTransaction[]>(ds.getTransactions());
  const [locations, setLocations] = useState<Location[]>(ds.getLocations());
  const [items, setItems] = useState<Item[]>(ds.getItems());

  const [viewMode, setViewMode] = useState<'balances' | 'ledger'>('balances');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    return ds.subscribe(() => {
      setBalances(ds.getBalances());
      setTransactions(ds.getTransactions());
      setLocations(ds.getLocations());
      setItems(ds.getItems());
    });
  }, [ds]);

  const getLocation = (id: string) => locations.find((l) => l.id === id);
  const getItem = (id: string) => items.find((i) => i.id === id);

  const filteredBalances = balances.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const it = getItem(b.itemId);
      const loc = getLocation(b.locationId);
      return (
        b.locationId.toLowerCase().includes(q) ||
        (loc && loc.name.toLowerCase().includes(q)) ||
        (it && it.itemCode.toLowerCase().includes(q)) ||
        (it && it.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const filteredTransactions = transactions.filter((t) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.transactionNumber.toLowerCase().includes(q) ||
        t.itemId.toLowerCase().includes(q) ||
        t.referenceId.toLowerCase().includes(q) ||
        t.responsiblePerson.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExportLedger = () => {
    const headers = ['Txn #', 'Date', 'Type', 'Item Code', 'Quantity', 'Source Location', 'Destination Location', 'Ref Doc', 'Responsible Person', 'Created By'];
    const rows = filteredTransactions.map((t) => [
      t.transactionNumber,
      t.date,
      t.transactionType,
      t.itemId,
      t.quantity,
      t.sourceLocationId,
      t.destinationLocationId,
      `${t.referenceType}:${t.referenceId}`,
      t.responsiblePerson,
      t.createdBy,
    ]);
    exportToCSV('Inventory_Transaction_Ledger', headers, rows);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600" />
            <span>Immutable Stock Balances &amp; Movement Ledger</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time material registers across racks, bins, workstations, and vendor sites. Transaction-safe double-entry movements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'ledger' && (
            <button
              onClick={handleExportLedger}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Ledger</span>
            </button>
          )}

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
            <button
              onClick={() => setViewMode('balances')}
              className={`px-3 py-1.5 rounded transition-colors ${
                viewMode === 'balances'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Stock Balances ({balances.length})
            </button>
            <button
              onClick={() => setViewMode('ledger')}
              className={`px-3 py-1.5 rounded transition-colors ${
                viewMode === 'ledger'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Movement Ledger ({transactions.length})
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {viewMode === 'balances' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">All Processing Statuses</option>
              <option value="untrimmed">Untrimmed Raw</option>
              <option value="in_trimming">In Trimming (Workstations)</option>
              <option value="qc_pending">QC Holding</option>
              <option value="rework_holding">Rework Staging</option>
              <option value="approved_finished">Approved Finished Goods</option>
            </select>
          )}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items, locations, racks..."
            className="w-full sm:w-64 pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* View Mode: Balances Table */}
      {viewMode === 'balances' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Location / Rack / Bin</th>
                  <th className="py-2.5 px-3 font-semibold">Item Code</th>
                  <th className="py-2.5 px-3 font-semibold">Description</th>
                  <th className="py-2.5 px-3 font-semibold">Processing Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Physical On Hand</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Reserved (Shift Orders)</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Available to Issue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredBalances.map((b) => {
                  const loc = getLocation(b.locationId);
                  const it = getItem(b.itemId);
                  const available = b.quantityOnHand - b.quantityReserved;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                        <div>{loc?.name || b.locationId}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {loc?.code} {loc?.rackNumber ? `(Rack ${loc.rackNumber})` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {it?.itemCode || b.itemId}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {it?.description || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                          b.status === 'approved_finished'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : b.status === 'qc_pending'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                            : b.status === 'rework_holding'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {b.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums font-bold text-slate-900 dark:text-slate-100">
                        {formatNumber(b.quantityOnHand)} pcs
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-400">
                        {formatNumber(b.quantityReserved)} pcs
                      </td>
                      <td className="py-2.5 px-4 font-mono text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                        {formatNumber(available)} pcs
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Mode: Immutable Transaction Ledger */}
      {viewMode === 'ledger' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Txn #</th>
                  <th className="py-2.5 px-3 font-semibold">Date &amp; Time</th>
                  <th className="py-2.5 px-3 font-semibold">Type</th>
                  <th className="py-2.5 px-3 font-semibold">Item</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Quantity</th>
                  <th className="py-2.5 px-3 font-semibold">Source ➔ Destination</th>
                  <th className="py-2.5 px-3 font-semibold">Reference</th>
                  <th className="py-2.5 px-3 font-semibold">Responsible</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Created By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTransactions.map((t) => {
                  const it = getItem(t.itemId);

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {t.transactionNumber}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {t.date.slice(0, 16).replace('T', ' ')}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] px-2 py-0.5 rounded uppercase font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {t.transactionType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium">
                        {it?.itemCode || t.itemId}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums font-bold text-slate-900 dark:text-slate-100">
                        {formatNumber(t.quantity)} pcs
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {t.sourceLocationId} ➔ {t.destinationLocationId}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {t.referenceType}:{t.referenceId}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        {t.responsiblePerson}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-500">
                        {t.createdBy}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
