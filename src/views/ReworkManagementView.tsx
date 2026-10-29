/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { RotateCcw, Plus, CheckCircle, AlertTriangle, ShieldCheck, ArrowRight, UserCheck } from 'lucide-react';
import { DataService } from '../services/storage';
import { InventoryEngine, formatPKR, formatNumber } from '../services/inventoryEngine';
import { ReworkOrder, Worker, Item, StockBalance, QCInspection } from '../types';

export const ReworkManagementView: React.FC = () => {
  const ds = DataService.getInstance();
  const engine = new InventoryEngine();

  const [reworkOrders, setReworkOrders] = useState<ReworkOrder[]>(ds.getReworkOrders());
  const [workers, setWorkers] = useState<Worker[]>(ds.getWorkers());
  const [items, setItems] = useState<Item[]>(ds.getItems());
  const [balances, setBalances] = useState<StockBalance[]>(ds.getBalances());
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New Rework Order Form
  const [selectedItemId, setSelectedItemId] = useState(items[1]?.id || 'item-trm-001');
  const [qtyToRework, setQtyToRework] = useState<number>(50);
  const [assignedWorkerType, setAssignedWorkerType] = useState<ReworkOrder['assignedWorkerType']>('in_house_vendor');
  const [assignedWorkerId, setAssignedWorkerId] = useState<string>(workers[1]?.id || 'w-ih-02');
  const [paymentEligibility, setPaymentEligibility] = useState<ReworkOrder['paymentEligibility']>('special_approved_rate');
  const [approvedRatePkr, setApprovedRatePkr] = useState<number>(1.5);
  const [originalRef, setOriginalRef] = useState<string>('wo-1');
  const [reworkNotes, setReworkNotes] = useState<string>('Re-trimming excess flash on secondary parting line');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    return ds.subscribe(() => {
      setReworkOrders(ds.getReworkOrders());
      setWorkers(ds.getWorkers());
      setItems(ds.getItems());
      setBalances(ds.getBalances());
    });
  }, [ds]);

  const reworkHoldingTotal = balances
    .filter((b) => b.status === 'rework_holding')
    .reduce((acc, b) => acc + b.quantityOnHand, 0);

  const getItem = (id: string) => items.find((i) => i.id === id);
  const getWorker = (id: string) => workers.find((w) => w.id === id);

  const handleCreateRework = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (qtyToRework <= 0) {
      setErrorMsg('Rework quantity must be greater than zero.');
      return;
    }

    const seq = ds.getReworkOrders().length + 1;
    const rwNum = `RW-2026-${String(seq).padStart(4, '0')}`;

    const newRO: ReworkOrder = {
      id: `rw-${Date.now()}`,
      reworkOrderNumber: rwNum,
      originalReferenceType: 'work_order',
      originalReferenceId: originalRef,
      originalWorkerId: 'w-ih-01',
      qcInspectionId: 'qc-1',
      itemId: selectedItemId,
      quantityToRework: qtyToRework,
      assignedWorkerType,
      assignedWorkerId,
      paymentEligibility,
      approvedRatePkr: paymentEligibility === 'unpaid' ? 0 : approvedRatePkr,
      quantityCompleted: 0,
      cycleNumber: 1,
      status: 'assigned',
      notes: reworkNotes,
      createdAt: new Date().toISOString(),
    };

    const res = engine.createReworkOrder(newRO, 'Shift Supervisor');
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to create Rework Order.');
      return;
    }

    setSuccessMsg(`Successfully generated Rework Order ${rwNum}! Material allocated for re-trimming.`);
    setIsCreateOpen(false);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleCompleteRework = (ro: ReworkOrder) => {
    // Moves reworked pieces from Rework Holding back to QC Inspection Holding
    const res = engine.moveStock({
      itemId: ro.itemId,
      quantity: ro.quantityToRework,
      sourceLocationId: 'loc-rework',
      sourceStatus: 'rework_holding',
      destinationLocationId: 'loc-qc-hold',
      destinationStatus: 'qc_pending',
      transactionType: 'rework_transfer',
      referenceType: 'REWORK',
      referenceId: ro.reworkOrderNumber,
      responsiblePerson: ro.assignedWorkerId,
      notes: `Rework completed by ${ro.assignedWorkerId}; routed to QC re-inspection.`,
      user: 'Supervisor (Farhan)',
    });

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to transfer reworked material to QC.');
      return;
    }

    ro.status = 'completed';
    ro.quantityCompleted = ro.quantityToRework;
    ds.updateReworkOrder(ro);

    // If supervisor approved piece-rate compensation, create earning
    if (ro.paymentEligibility !== 'unpaid' && ro.approvedRatePkr > 0) {
      ds.addVendorEarning({
        id: `earn-rw-${Date.now()}`,
        vendorId: ro.assignedWorkerId,
        vendorType: ro.assignedWorkerType === 'in_house_vendor' ? 'in_house_vendor' : 'outsourced_vendor',
        referenceType: 'rework_order',
        referenceId: ro.id,
        itemId: ro.itemId,
        quantityEligible: ro.quantityToRework,
        ratePerPiece: ro.approvedRatePkr,
        amountPkr: ro.quantityToRework * ro.approvedRatePkr,
        isApproved: true,
        approvedBy: 'Shift Supervisor (Special Rework Approval)',
        approvalDate: new Date().toISOString(),
        isPaid: false,
        createdAt: new Date().toISOString(),
      });
    }

    setSuccessMsg(`Rework Order ${ro.reworkOrderNumber} completed! Material transferred to QC Holding for re-inspection.`);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-600" />
            <span>Closed-Loop Rework &amp; Multi-Cycle Traceability</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Preserves permanent lineage back to original job orders, vendors, and QC rejections. Configurable rework payment rules.
          </p>
        </div>

        <button
          onClick={() => {
            setIsCreateOpen(true);
            setErrorMsg(null);
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Rework Order</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Rework Holding Staging Indicator */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-amber-600 text-white flex items-center justify-center font-bold text-sm">
            RW
          </div>
          <div>
            <div className="text-xs font-semibold text-amber-900 dark:text-amber-300">
              Rework Holding Bay: {formatNumber(reworkHoldingTotal)} pcs Awaiting Re-Trimming
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Material rejected during QC inspections staged for secondary de-flashing or correction
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setIsCreateOpen(true);
            setErrorMsg(null);
          }}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium"
        >
          Assign Rework Batch
        </button>
      </div>

      {/* Rework Orders Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
            Rework Cycle Orders &amp; Lineage Registry
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {reworkOrders.length} Rework Orders
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Rework #</th>
                <th className="py-2.5 px-3 font-semibold">Origin Lineage (WO / QC)</th>
                <th className="py-2.5 px-3 font-semibold">Item</th>
                <th className="py-2.5 px-3 font-semibold text-right">Rework Qty</th>
                <th className="py-2.5 px-3 font-semibold">Assigned Reworker</th>
                <th className="py-2.5 px-3 font-semibold text-right">Approved Rate</th>
                <th className="py-2.5 px-3 font-semibold text-center">Cycle #</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {reworkOrders.map((ro) => {
                const item = getItem(ro.itemId);
                const worker = getWorker(ro.assignedWorkerId);

                return (
                  <tr key={ro.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {ro.reworkOrderNumber}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      <div>Origin WO: {ro.originalReferenceId}</div>
                      <div className="text-[10px] text-slate-400">QC Ref: {ro.qcInspectionId}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-medium">{item?.itemCode || ro.itemId}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-bold text-amber-600 dark:text-amber-400">
                      {formatNumber(ro.quantityToRework)} pcs
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {worker?.name || ro.assignedWorkerId}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {ro.paymentEligibility === 'unpaid' ? (
                        <span className="text-slate-400 font-normal">UNPAID (Error)</span>
                      ) : (
                        formatPKR(ro.approvedRatePkr)
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold">
                      Cycle {ro.cycleNumber}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                        ro.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                      }`}>
                        {ro.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {ro.status !== 'completed' && (
                        <button
                          onClick={() => handleCompleteRework(ro)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium transition-colors"
                        >
                          Complete &amp; Route to QC
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

      {/* Create Rework Order Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Generate Closed-Loop Rework Order
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Link back to original WO and assign re-trimmer</p>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 rounded text-rose-800 dark:text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateRework} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Original Work Order / QC Reference</label>
                  <input
                    type="text"
                    value={originalRef}
                    onChange={(e) => setOriginalRef(e.target.value)}
                    placeholder="e.g. WO-2026-0001"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Rework Item</label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-semibold"
                  >
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.itemCode} - {i.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Quantity to Rework (pcs)</label>
                  <input
                    type="number"
                    min="1"
                    value={qtyToRework}
                    onChange={(e) => setQtyToRework(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Assign To Worker / Vendor</label>
                  <select
                    value={assignedWorkerId}
                    onChange={(e) => {
                      setAssignedWorkerId(e.target.value);
                      const w = getWorker(e.target.value);
                      if (w) setAssignedWorkerType(w.type);
                    }}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  >
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {w.name} ({w.type === 'in_house_vendor' ? 'Piece-Rate Vendor' : 'Employee'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Rework Payment Rules Policy (Confirmed with user: Configurable with supervisor approval) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Rework Payment Policy Gate
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 mb-1">Payment Eligibility</label>
                    <select
                      value={paymentEligibility}
                      onChange={(e) => setPaymentEligibility(e.target.value as any)}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                    >
                      <option value="unpaid">Unpaid Rework (Operator Quality Fault)</option>
                      <option value="special_approved_rate">Supervisor Authorized Rate (Re-assigned / Mould Defect)</option>
                      <option value="standard_rate">Full Standard Piece Rate</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">Approved Rate per Piece (PKR)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      disabled={paymentEligibility === 'unpaid'}
                      value={paymentEligibility === 'unpaid' ? 0 : approvedRatePkr}
                      onChange={(e) => setApprovedRatePkr(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Rework Instructions</label>
                <textarea
                  rows={2}
                  value={reworkNotes}
                  onChange={(e) => setReworkNotes(e.target.value)}
                  placeholder="Instructions for trimming rectification..."
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                >
                  Issue Rework Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
