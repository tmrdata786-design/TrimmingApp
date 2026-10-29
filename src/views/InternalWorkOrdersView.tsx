/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ClipboardList, Printer, CheckCircle, Clock, AlertTriangle, ArrowRight, PlayCircle, ShieldCheck } from 'lucide-react';
import { DataService } from '../services/storage';
import { InventoryEngine, formatNumber } from '../services/inventoryEngine';
import { WorkOrder, Worker, Item, Workstation } from '../types';
import { PrintableDocumentModal } from '../components/PrintableDocumentModal';

export const InternalWorkOrdersView: React.FC = () => {
  const ds = DataService.getInstance();
  const engine = new InventoryEngine();

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(ds.getWorkOrders());
  const [workers, setWorkers] = useState<Worker[]>(ds.getWorkers());
  const [items, setItems] = useState<Item[]>(ds.getItems());
  const [workstations, setWorkstations] = useState<Workstation[]>(ds.getWorkstations());

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedWOForPrint, setSelectedWOForPrint] = useState<WorkOrder | null>(null);

  // Shift Digitizer Modal State
  const [digitizerWO, setDigitizerWO] = useState<WorkOrder | null>(null);
  const [actualTrimmed, setActualTrimmed] = useState<number>(0);
  const [returnedUntrimmed, setReturnedUntrimmed] = useState<number>(0);
  const [closingBalanceAtWs, setClosingBalanceAtWs] = useState<number>(0);
  const [downtimeMinutes, setDowntimeMinutes] = useState<number>(0);
  const [delayReason, setDelayReason] = useState<string>('');
  const [supervisorNotes, setSupervisorNotes] = useState<string>('');
  const [digitizerError, setDigitizerError] = useState<string | null>(null);
  const [digitizerSuccess, setDigitizerSuccess] = useState<string | null>(null);

  useEffect(() => {
    return ds.subscribe(() => {
      setWorkOrders(ds.getWorkOrders());
      setWorkers(ds.getWorkers());
      setItems(ds.getItems());
      setWorkstations(ds.getWorkstations());
    });
  }, [ds]);

  const filtered = workOrders.filter((wo) => {
    if (statusFilter !== 'all' && wo.status !== statusFilter) return false;
    return true;
  });

  const getWorker = (id: string) => workers.find((w) => w.id === id);
  const getItem = (id: string) => items.find((i) => i.id === id);

  const openDigitizer = (wo: WorkOrder) => {
    setDigitizerWO(wo);
    setActualTrimmed(wo.actualTrimmedQuantity || Math.round(wo.plannedQuantity * 0.95));
    setReturnedUntrimmed(wo.quantityReturnedUntrimmed || 0);
    setClosingBalanceAtWs(wo.closingBalance || 0);
    setDowntimeMinutes(wo.downtimeMinutes || 0);
    setDelayReason(wo.delayReason || '');
    setSupervisorNotes(wo.supervisorNotes || '');
    setDigitizerError(null);
    setDigitizerSuccess(null);
  };

  const handleDigitizeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!digitizerWO) return;

    const res = engine.closeShiftWorkOrder({
      workOrder: digitizerWO,
      actualTrimmed,
      returnedUntrimmed,
      closingBalanceAtWs,
      downtimeMinutes,
      delayReason,
      notes: supervisorNotes,
      user: 'Supervisor (Farhan)',
    });

    if (!res.success) {
      setDigitizerError(res.error || 'Shift material reconciliation failed.');
      return;
    }

    setDigitizerSuccess(`Successfully closed shift work order ${digitizerWO.workOrderNumber} and reconciled all materials!`);
    setTimeout(() => {
      setDigitizerWO(null);
      setDigitizerSuccess(null);
    }, 1500);
  };

  const totalIssued = digitizerWO ? digitizerWO.quantityIssued : 0;
  const currentSum = actualTrimmed + returnedUntrimmed + closingBalanceAtWs;
  const isBalanced = currentSum === totalIssued;
  const discrepancy = totalIssued - currentSum;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            <span>Internal Shift Work Orders &amp; Shift Reconciliation</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Workstation job orders, printed physical shift sheets, and digitizer entry verifying material balance.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
          {['all', 'scheduled', 'in_progress', 'closed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded transition-colors uppercase text-[11px] ${
                statusFilter === st
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Work Orders Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="py-2.5 px-4 font-semibold">WO Number</th>
                <th className="py-2.5 px-3 font-semibold">Workstation</th>
                <th className="py-2.5 px-3 font-semibold">Shift &amp; Date</th>
                <th className="py-2.5 px-3 font-semibold">Assigned Operator</th>
                <th className="py-2.5 px-3 font-semibold">Item &amp; Stage</th>
                <th className="py-2.5 px-3 font-semibold text-right">Issued</th>
                <th className="py-2.5 px-3 font-semibold text-right">Target</th>
                <th className="py-2.5 px-3 font-semibold text-right">Actual Trimmed</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((wo) => {
                const worker = getWorker(wo.assignedWorkerId);
                const item = getItem(wo.itemId);

                let statusBadge = 'bg-slate-100 text-slate-600';
                if (wo.status === 'in_progress') statusBadge = 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 font-semibold';
                if (wo.status === 'closed') statusBadge = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold';
                if (wo.status === 'scheduled') statusBadge = 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';

                return (
                  <tr key={wo.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {wo.workOrderNumber}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {wo.workstationId}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      <div>{wo.shiftId.replace('shift-', 'Shift ')}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{wo.date}</div>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {worker?.name || wo.assignedWorkerId}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-medium text-slate-900 dark:text-slate-100">{item?.itemCode || wo.itemId}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-xs">{wo.stageName}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                      {formatNumber(wo.quantityIssued)} pcs
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums text-blue-600 dark:text-blue-400 font-semibold">
                      {formatNumber(wo.plannedQuantity)} pcs
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-bold text-slate-900 dark:text-slate-100">
                      {formatNumber(wo.actualTrimmedQuantity)} pcs
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded uppercase ${statusBadge}`}>
                        {wo.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-1">
                      <button
                        onClick={() => setSelectedWOForPrint(wo)}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Print Physical Shift Sheet"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      {wo.status !== 'closed' && (
                        <button
                          onClick={() => openDigitizer(wo)}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-medium transition-colors"
                        >
                          Digitize Shift
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

      {/* Shift Digitizer Modal */}
      {digitizerWO && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Supervisor Shift Digitizer: {digitizerWO.workOrderNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Station {digitizerWO.workstationId} · Issued Material: {digitizerWO.quantityIssued} pcs
                </p>
              </div>
              <button onClick={() => setDigitizerWO(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">
                ✕
              </button>
            </div>

            {digitizerError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 rounded text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{digitizerError}</span>
              </div>
            )}

            {digitizerSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-900 rounded text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{digitizerSuccess}</span>
              </div>
            )}

            <form onSubmit={handleDigitizeSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Actual Trimmed (pcs)</label>
                  <input
                    type="number"
                    min="0"
                    value={actualTrimmed}
                    onChange={(e) => setActualTrimmed(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold text-slate-900 dark:text-slate-100"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Sent to QC</span>
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Untrimmed Returned</label>
                  <input
                    type="number"
                    min="0"
                    value={returnedUntrimmed}
                    onChange={(e) => setReturnedUntrimmed(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold text-slate-900 dark:text-slate-100"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Returned to store</span>
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Closing at Station</label>
                  <input
                    type="number"
                    min="0"
                    value={closingBalanceAtWs}
                    onChange={(e) => setClosingBalanceAtWs(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold text-slate-900 dark:text-slate-100"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Unworked balance</span>
                </div>
              </div>

              {/* Material Balance Gauge */}
              <div
                className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                  isBalanced
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                }`}
              >
                <div>
                  <div className="font-semibold flex items-center gap-1.5">
                    {isBalanced ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    <span>{isBalanced ? 'MATERIAL RECONCILED (100% BALANCED)' : 'MATERIAL IMBALANCE DETECTED!'}</span>
                  </div>
                  <div className="text-[11px] mt-0.5">
                    Issued: {totalIssued} pcs ── Sum of Trimmed + Returned + Closing: {currentSum} pcs
                  </div>
                </div>
                <div className="text-right font-mono font-bold text-sm">
                  {isBalanced ? 'Δ = 0' : `Δ = ${discrepancy > 0 ? '+' : ''}${discrepancy}`}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Downtime Minutes</label>
                  <input
                    type="number"
                    min="0"
                    value={downtimeMinutes}
                    onChange={(e) => setDowntimeMinutes(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Delay / Stoppage Reason</label>
                  <input
                    type="text"
                    value={delayReason}
                    onChange={(e) => setDelayReason(e.target.value)}
                    placeholder="e.g. Cutter blade dull, air pressure drop..."
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Supervisor Verification Remarks</label>
                <textarea
                  rows={2}
                  value={supervisorNotes}
                  onChange={(e) => setSupervisorNotes(e.target.value)}
                  placeholder="Physical counts verified on floor..."
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDigitizerWO(null)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isBalanced}
                  className={`px-4 py-1.5 rounded font-medium text-white transition-colors ${
                    isBalanced ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-400 cursor-not-allowed'
                  }`}
                >
                  Confirm &amp; Reconcile Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Shift Sheet Modal */}
      {selectedWOForPrint && (
        <PrintableDocumentModal
          isOpen={true}
          onClose={() => setSelectedWOForPrint(null)}
          documentType="shift_sheet"
          documentData={selectedWOForPrint}
        />
      )}
    </div>
  );
};
