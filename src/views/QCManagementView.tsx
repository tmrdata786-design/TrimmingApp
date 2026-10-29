/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, ShieldCheck, Plus, Filter, Camera, ArrowRight, Eye } from 'lucide-react';
import { DataService } from '../services/storage';
import { InventoryEngine, formatNumber } from '../services/inventoryEngine';
import { QCInspection, Item, StockBalance, DefectClassification } from '../types';

export const QCManagementView: React.FC = () => {
  const ds = DataService.getInstance();
  const engine = new InventoryEngine();

  const [inspections, setInspections] = useState<QCInspection[]>(ds.getQCInspections());
  const [items, setItems] = useState<Item[]>(ds.getItems());
  const [balances, setBalances] = useState<StockBalance[]>(ds.getBalances());
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Inspection Form
  const [itemId, setItemId] = useState(items[1]?.id || 'item-trm-001'); // default to trimmed item
  const [referenceType, setReferenceType] = useState<'work_order' | 'igp' | 'rework_order'>('work_order');
  const [referenceId, setReferenceId] = useState('wo-1');
  const [qtyInspected, setQtyInspected] = useState<number>(300);
  const [qtyAccepted, setQtyAccepted] = useState<number>(280);
  const [qtyRejected, setQtyRejected] = useState<number>(20);
  const [inspector, setInspector] = useState('Khurram QC');
  const [qcNotes, setQcNotes] = useState('');
  const [defects, setDefects] = useState<DefectClassification[]>([
    { defectType: 'flash_excess', count: 12 },
    { defectType: 'over_trim_gouge', count: 8 },
  ]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    return ds.subscribe(() => {
      setInspections(ds.getQCInspections());
      setItems(ds.getItems());
      setBalances(ds.getBalances());
    });
  }, [ds]);

  const pendingQcStock = balances
    .filter((b) => b.status === 'qc_pending')
    .reduce((acc, b) => acc + b.quantityOnHand, 0);

  const getItem = (id: string) => items.find((i) => i.id === id);

  // Auto-sync rejected when accepted or inspected changes
  const handleAcceptedChange = (val: number) => {
    setQtyAccepted(val);
    setQtyRejected(Math.max(0, qtyInspected - val));
  };

  const handleInspectedChange = (val: number) => {
    setQtyInspected(val);
    setQtyAccepted(val);
    setQtyRejected(0);
  };

  const isBalanced = qtyAccepted + qtyRejected === qtyInspected;

  const handleSubmitQC = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isBalanced) {
      setErrorMsg(`QC Rule Violation: Inspected quantity (${qtyInspected}) must equal Accepted (${qtyAccepted}) + Rejected (${qtyRejected}).`);
      return;
    }

    if (qtyInspected <= 0) {
      setErrorMsg('Inspected quantity must be greater than zero.');
      return;
    }

    const seq = ds.getQCInspections().length + 1;
    const qcNum = `QC-2026-${String(seq).padStart(4, '0')}`;

    const newQC: QCInspection = {
      id: `qc-${Date.now()}`,
      inspectionNumber: qcNum,
      date: new Date().toISOString(),
      referenceType,
      referenceId,
      itemId,
      quantityInspected: qtyInspected,
      quantityAccepted: qtyAccepted,
      quantityRejected: qtyRejected,
      defects: defects.filter((d) => d.count > 0),
      inspector,
      notes: qcNotes,
      destinationLocationId: 'loc-fin-store',
      createdAt: new Date().toISOString(),
    };

    const res = engine.executeQCInspection(newQC, inspector);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to post QC Inspection.');
      return;
    }

    setSuccessMsg(`Successfully executed ${qcNum}! ${qtyAccepted} pcs moved to Finished Store, ${qtyRejected} pcs moved to Rework Holding.`);
    setIsModalOpen(false);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>Quality Control (QC) &amp; Rejection Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict verification: Inspected = Accepted + Rejected. Material only enters approved stock upon QC authorization.
          </p>
        </div>

        <button
          onClick={() => {
            setIsModalOpen(true);
            setErrorMsg(null);
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New QC Inspection</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* QC Holding Queue Alert */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-blue-600 text-white flex items-center justify-center font-mono font-bold text-sm">
            QC
          </div>
          <div>
            <div className="text-xs font-semibold text-blue-900 dark:text-blue-300">
              QC Holding Staging Queue: {formatNumber(pendingQcStock)} pcs Pending Inspection
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Material received from shift closings and vendor IGPs waiting for final quality release
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setIsModalOpen(true);
            setErrorMsg(null);
          }}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
        >
          Inspect Batch Now
        </button>
      </div>

      {/* QC Inspections Log Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
            Completed Quality Inspection Records
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {inspections.length} Inspections Logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Inspection #</th>
                <th className="py-2.5 px-3 font-semibold">Date &amp; Time</th>
                <th className="py-2.5 px-3 font-semibold">Reference Source</th>
                <th className="py-2.5 px-3 font-semibold">Item Inspected</th>
                <th className="py-2.5 px-3 font-semibold text-right">Inspected Qty</th>
                <th className="py-2.5 px-3 font-semibold text-right">Accepted (Passed)</th>
                <th className="py-2.5 px-3 font-semibold text-right">Rejected (Rework)</th>
                <th className="py-2.5 px-3 font-semibold text-right">Pass Rate (%)</th>
                <th className="py-2.5 px-3 font-semibold">Inspector</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {inspections.map((qc) => {
                const item = getItem(qc.itemId);
                const passRate = ((qc.quantityAccepted / qc.quantityInspected) * 100).toFixed(1);

                return (
                  <tr key={qc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {qc.inspectionNumber}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">
                      {qc.date.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                      {qc.referenceType.toUpperCase()}: {qc.referenceId}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-medium">{item?.itemCode || qc.itemId}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                      {formatNumber(qc.quantityInspected)} pcs
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                      {formatNumber(qc.quantityAccepted)} pcs
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-bold text-rose-600 dark:text-rose-400">
                      {formatNumber(qc.quantityRejected)} pcs
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                      {passRate}%
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-medium">
                      {qc.inspector}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New QC Inspection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Execute Quality Control Inspection
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Authoritative acceptance into finished goods</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 rounded text-rose-800 dark:text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmitQC} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Source Batch Type</label>
                  <select
                    value={referenceType}
                    onChange={(e) => setReferenceType(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  >
                    <option value="work_order">Internal Shift Work Order</option>
                    <option value="igp">Outsourced Inward Gate Pass (IGP)</option>
                    <option value="rework_order">Rework Job Order</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Batch Reference ID</label>
                  <input
                    type="text"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    placeholder="e.g. WO-2026-0001 or IGP-001"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Trimmed Component Inspected</label>
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-semibold"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.itemCode} - {i.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Inspected, Accepted, Rejected Fields with Invariant Checker */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Inspected Total</label>
                    <input
                      type="number"
                      min="1"
                      value={qtyInspected}
                      onChange={(e) => handleInspectedChange(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded font-mono font-bold text-slate-900 dark:text-slate-100"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-emerald-700 dark:text-emerald-400 font-medium mb-1">Accepted (Pass)</label>
                    <input
                      type="number"
                      min="0"
                      max={qtyInspected}
                      value={qtyAccepted}
                      onChange={(e) => handleAcceptedChange(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-emerald-400 dark:border-emerald-700 rounded font-mono font-bold text-emerald-600 dark:text-emerald-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-rose-700 dark:text-rose-400 font-medium mb-1">Rejected (Rework)</label>
                    <input
                      type="number"
                      min="0"
                      value={qtyRejected}
                      onChange={(e) => setQtyRejected(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-rose-400 dark:border-rose-700 rounded font-mono font-bold text-rose-600 dark:text-rose-400"
                      required
                    />
                  </div>
                </div>

                <div className={`p-2 rounded text-[11px] font-medium flex items-center justify-between ${
                  isBalanced ? 'bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-100/70 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                }`}>
                  <span>Invariant Check: {qtyAccepted} Accepted + {qtyRejected} Rejected == {qtyInspected} Inspected</span>
                  <span className="font-bold">{isBalanced ? '✓ SATISFIED' : '✗ IMBALANCE'}</span>
                </div>
              </div>

              {/* Defect Reasons */}
              <div>
                <label className="block text-slate-500 font-medium mb-1">Defect Classification Breakdown (For Rejects)</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {defects.map((d, idx) => (
                    <div key={d.defectType} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                      <span className="capitalize">{d.defectType.replace('_', ' ')}</span>
                      <input
                        type="number"
                        min="0"
                        value={d.count}
                        onChange={(e) => {
                          const updated = [...defects];
                          updated[idx].count = parseInt(e.target.value) || 0;
                          setDefects(updated);
                        }}
                        className="w-16 px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-300 rounded font-mono text-right"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">QC Inspector</label>
                  <input
                    type="text"
                    value={inspector}
                    onChange={(e) => setInspector(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Notes / Observations</label>
                  <input
                    type="text"
                    value={qcNotes}
                    onChange={(e) => setQcNotes(e.target.value)}
                    placeholder="Surface finish check..."
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
                  Post QC Inspection &amp; Release
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
