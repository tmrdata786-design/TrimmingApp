/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { FileCheck2, Plus, CheckCircle, AlertTriangle, Search, Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { DataService } from '../services/storage';
import { InventoryEngine, formatPKR, formatNumber } from '../services/inventoryEngine';
import { StocktakingSession, StockCountLine, Location, Item } from '../types';

export const StocktakingView: React.FC = () => {
  const ds = DataService.getInstance();
  const engine = new InventoryEngine();

  const [sessions, setSessions] = useState<StocktakingSession[]>(ds.getStocktakingSessions());
  const [locations, setLocations] = useState<Location[]>(ds.getLocations());
  const [items, setItems] = useState<Item[]>(ds.getItems());
  const [balances, setBalances] = useState(ds.getBalances());

  const [activeSession, setActiveSession] = useState<StocktakingSession | null>(sessions[0] || null);
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [isBlindCount, setIsBlindCount] = useState(false);
  const [investigationLine, setInvestigationLine] = useState<StockCountLine | null>(null);
  const [investigationNotes, setInvestigationNotes] = useState('');
  const [approverName, setApproverName] = useState('Plant Manager (Arif)');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    return ds.subscribe(() => {
      setSessions(ds.getStocktakingSessions());
      setLocations(ds.getLocations());
      setItems(ds.getItems());
      setBalances(ds.getBalances());
    });
  }, [ds]);

  const getLocation = (id: string) => locations.find((l) => l.id === id);
  const getItem = (id: string) => items.find((i) => i.id === id);

  // Initialize a new monthly stocktaking session snapshotting book balances
  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    const sessionCode = `ST-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Snapshot all non-zero or active balances
    const lines: StockCountLine[] = balances.map((bal, idx) => {
      const it = getItem(bal.itemId);
      const loc = getLocation(bal.locationId);
      const unitCost = it ? it.baselineManufacturingCost : 30;

      return {
        id: `line-${Date.now()}-${idx}`,
        locationId: bal.locationId,
        locationName: loc ? `${loc.code} - ${loc.name}` : bal.locationId,
        itemId: bal.itemId,
        itemCode: it ? it.itemCode : bal.itemId,
        status: bal.status,
        bookQuantity: bal.quantityOnHand,
        physicalCount: bal.quantityOnHand, // Default match, to be counted
        varianceQuantity: 0,
        unitCostPkr: unitCost,
        varianceValuePkr: 0,
        adjustmentPosted: false,
      };
    });

    const newSession: StocktakingSession = {
      id: `st-${Date.now()}`,
      sessionCode,
      countDate: now.toISOString().slice(0, 10),
      status: 'counting',
      isBlindCount,
      totalItemsCounted: lines.length,
      totalVarianceQuantity: 0,
      totalVarianceValuePkr: 0,
      lines,
      conductedBy: 'Audit Team Lead',
      createdAt: now.toISOString(),
    };

    ds.addStocktakingSession(newSession);
    setActiveSession(newSession);
    setIsNewSessionModalOpen(false);
    ds.logAudit(
      'Audit Team',
      'manager_approver',
      'START_STOCKTAKE',
      'StocktakingSession',
      sessionCode,
      `Initiated monthly physical inventory count session for ${newSession.countDate}`
    );

    setSuccessMsg(`Initiated Monthly Stocktaking Session ${sessionCode} with ${lines.length} count locations frozen.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Update physical count for a line
  const handlePhysicalCountChange = (lineId: string, countVal: number) => {
    if (!activeSession) return;
    const updatedLines = activeSession.lines.map((l) => {
      if (l.id === lineId) {
        const diff = countVal - l.bookQuantity;
        return {
          ...l,
          physicalCount: countVal,
          varianceQuantity: diff,
          varianceValuePkr: diff * l.unitCostPkr,
        };
      }
      return l;
    });

    const totalVarQty = updatedLines.reduce((acc, l) => acc + l.varianceQuantity, 0);
    const totalVarVal = updatedLines.reduce((acc, l) => acc + l.varianceValuePkr, 0);

    const updatedSession = {
      ...activeSession,
      lines: updatedLines,
      totalVarianceQuantity: totalVarQty,
      totalVarianceValuePkr: totalVarVal,
    };

    ds.updateStocktakingSession(updatedSession);
    setActiveSession(updatedSession);
  };

  // Submit approved adjustment
  const handleApproveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!investigationLine || !activeSession) return;

    investigationLine.investigationNotes = investigationNotes;

    const res = engine.postStockAdjustment(
      investigationLine,
      'Internal Auditor',
      approverName,
      'Manager (Arif)'
    );

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to post adjustment.');
      return;
    }

    // Refresh active session line state
    const updatedLines = activeSession.lines.map((l) =>
      l.id === investigationLine.id ? { ...investigationLine, adjustmentPosted: true } : l
    );
    const updatedSession = { ...activeSession, lines: updatedLines };
    ds.updateStocktakingSession(updatedSession);
    setActiveSession(updatedSession);

    setSuccessMsg(
      `Approved variance adjustment of ${investigationLine.varianceQuantity} pcs for ${investigationLine.itemCode} at ${investigationLine.locationName}!`
    );
    setInvestigationLine(null);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-blue-600" />
            <span>Monthly Physical Stocktaking &amp; Variance Reconciliation</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Snapshot-based stock count sessions, optional blind counts, discrepancy investigation, and auditable adjustment posting.
          </p>
        </div>

        <button
          onClick={() => setIsNewSessionModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Monthly Stocktake</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 rounded text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Active Session Ribbon */}
      {activeSession ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4 shadow-xs">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-base text-blue-600 dark:text-blue-400">
                  {activeSession.sessionCode}
                </span>
                <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 font-semibold rounded uppercase">
                  {activeSession.status}
                </span>
                {activeSession.isBlindCount && (
                  <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 font-semibold rounded flex items-center gap-1">
                    <EyeOff className="w-3 h-3" /> Blind Count
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Effective Count Date: {activeSession.countDate} · Lead Auditor: {activeSession.conductedBy}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">NET VARIANCE (PCS)</span>
                <span
                  className={`font-mono font-bold text-sm tabular-nums ${
                    activeSession.totalVarianceQuantity === 0
                      ? 'text-emerald-600'
                      : activeSession.totalVarianceQuantity > 0
                      ? 'text-blue-600'
                      : 'text-rose-600'
                  }`}
                >
                  {activeSession.totalVarianceQuantity > 0 ? '+' : ''}
                  {formatNumber(activeSession.totalVarianceQuantity)} pcs
                </span>
              </div>

              <div className="text-right border-l border-slate-200 dark:border-slate-700 pl-4">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">NET VARIANCE VALUE</span>
                <span
                  className={`font-mono font-bold text-sm tabular-nums ${
                    activeSession.totalVarianceValuePkr === 0
                      ? 'text-emerald-600'
                      : activeSession.totalVarianceValuePkr > 0
                      ? 'text-blue-600'
                      : 'text-rose-600'
                  }`}
                >
                  {activeSession.totalVarianceValuePkr > 0 ? '+' : ''}
                  {formatPKR(activeSession.totalVarianceValuePkr)}
                </span>
              </div>
            </div>
          </div>

          {/* Lines Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Location / Rack / Bin</th>
                  <th className="py-2.5 px-3 font-semibold">Item Code</th>
                  <th className="py-2.5 px-3 font-semibold">Status Category</th>
                  <th className="py-2.5 px-3 font-semibold text-right">System Book Qty</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Physical Count</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Variance Qty</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Variance Value (PKR)</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Adjustment</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeSession.lines.map((line) => {
                  const hasDiscrepancy = line.varianceQuantity !== 0;

                  return (
                    <tr
                      key={line.id}
                      className={
                        hasDiscrepancy
                          ? 'bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-50/50'
                          : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                      }
                    >
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {line.locationName}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {line.itemCode}
                      </td>
                      <td className="py-2.5 px-3 uppercase text-[10px] font-mono text-slate-500">
                        {line.status}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {activeSession.isBlindCount ? '••••' : `${formatNumber(line.bookQuantity)} pcs`}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          value={line.physicalCount}
                          onChange={(e) => handlePhysicalCountChange(line.id, parseInt(e.target.value) || 0)}
                          className="w-24 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono font-bold text-right text-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums font-bold">
                        <span
                          className={
                            line.varianceQuantity === 0
                              ? 'text-slate-400'
                              : line.varianceQuantity > 0
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                          }
                        >
                          {line.varianceQuantity > 0 ? '+' : ''}
                          {formatNumber(line.varianceQuantity)} pcs
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                        {line.varianceQuantity !== 0 ? formatPKR(line.varianceValuePkr) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {line.adjustmentPosted ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold uppercase">
                            POSTED
                          </span>
                        ) : hasDiscrepancy ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold uppercase animate-pulse">
                            UNRECONCILED
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">BALANCED</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {hasDiscrepancy && !line.adjustmentPosted && (
                          <button
                            onClick={() => {
                              setInvestigationLine(line);
                              setInvestigationNotes(line.investigationNotes || '');
                            }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-medium transition-colors"
                          >
                            Investigate &amp; Adjust
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-12 text-center text-slate-500">
          <FileCheck2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">
            No Active Monthly Stocktaking Session
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Initiate a new physical count session to snapshot expected balances across all raw racks, WS holding, and vendor stores.
          </p>
          <button
            onClick={() => setIsNewSessionModalOpen(true)}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
          >
            Start Monthly Count Session
          </button>
        </div>
      )}

      {/* Discrepancy Investigation & Adjustment Modal */}
      {investigationLine && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Audit Variance Investigation &amp; Approval
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Item {investigationLine.itemCode} at {investigationLine.locationName}
              </p>
            </div>

            <form onSubmit={handleApproveAdjustment} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Book System Quantity:</span>
                  <span className="font-mono font-bold">{investigationLine.bookQuantity} pcs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Physically Counted:</span>
                  <span className="font-mono font-bold">{investigationLine.physicalCount} pcs</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-bold">
                  <span className="text-slate-700 dark:text-slate-300">Net Variance Discrepancy:</span>
                  <span
                    className={`font-mono ${
                      investigationLine.varianceQuantity > 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {investigationLine.varianceQuantity > 0 ? '+' : ''}
                    {investigationLine.varianceQuantity} pcs ({formatPKR(investigationLine.varianceValuePkr)})
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">
                  Root Cause Investigation Notes
                </label>
                <textarea
                  rows={2}
                  value={investigationNotes}
                  onChange={(e) => setInvestigationNotes(e.target.value)}
                  placeholder="e.g. Parts misplaced during shift transfer, counted and verified..."
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Authorizing Plant Manager</label>
                <input
                  type="text"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInvestigationLine(null)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                >
                  Authorize Ledger Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Session Creation Modal */}
      {isNewSessionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Start Monthly Physical Stocktaking Session
            </h3>

            <form onSubmit={handleCreateSession} className="space-y-3 text-xs">
              <p className="text-slate-500">
                This will create a frozen snapshot of book stock across all raw racks, workstation holding bays, and vendor accounts.
              </p>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="blind"
                  checked={isBlindCount}
                  onChange={(e) => setIsBlindCount(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <label htmlFor="blind" className="font-medium text-slate-700 dark:text-slate-300">
                  Blind Count Mode (Hide book counts from floor counters)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewSessionModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                >
                  Snapshot &amp; Begin Count
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
