/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CalendarDays, AlertTriangle, CheckCircle, Plus, Calculator, ArrowRight, ShieldAlert } from 'lucide-react';
import { DataService } from '../services/storage';
import { Workstation, Shift, Worker, Item, WorkOrder, PTNDocument } from '../types';
import { formatNumber } from '../services/inventoryEngine';

interface PlanningViewProps {
  onPlanCreated?: () => void;
}

export const PlanningView: React.FC<PlanningViewProps> = ({ onPlanCreated }) => {
  const ds = DataService.getInstance();

  const [items, setItems] = useState<Item[]>(ds.getItems().filter((i) => i.category === 'untrimmed_molding'));
  const [shifts, setShifts] = useState<Shift[]>(ds.getShifts());
  const [workstations, setWorkstations] = useState<Workstation[]>(ds.getWorkstations());
  const [workers, setWorkers] = useState<Worker[]>(ds.getWorkers());
  const [balances, setBalances] = useState(ds.getBalances());

  // Plan Form State
  const [selectedShiftId, setSelectedShiftId] = useState<string>(shifts[0]?.id || '');
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0]?.id || '');
  const [selectedWsId, setSelectedWsId] = useState<string>('ws-1');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(workers[0]?.id || '');
  const [plannedQty, setPlannedQty] = useState<number>(900);
  const [issueQty, setIssueQty] = useState<number>(400);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [planDate, setPlanDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    return ds.subscribe(() => {
      setItems(ds.getItems().filter((i) => i.category === 'untrimmed_molding'));
      setShifts(ds.getShifts());
      setWorkstations(ds.getWorkstations());
      setWorkers(ds.getWorkers());
      setBalances(ds.getBalances());
    });
  }, [ds]);

  const selectedItem = items.find((i) => i.id === selectedItemId);
  const selectedShift = shifts.find((s) => s.id === selectedShiftId);
  const selectedWs = workstations.find((w) => w.id === selectedWsId);
  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);

  // Available stock calculation across raw store
  const rawStock = balances
    .filter((b) => b.itemId === selectedItemId && b.status === 'untrimmed' && !b.locationId.includes('vend'))
    .reduce((acc, b) => acc + (b.quantityOnHand - b.quantityReserved), 0);

  // Auto-calculated target: PPH * Net Working Hours * Workstation Capacity Multiplier
  const suggestedTarget = selectedItem && selectedShift && selectedWs
    ? Math.round(selectedItem.expectedCapacityPph * selectedShift.netWorkingHours * selectedWs.capacityMultiplier)
    : 0;

  // Auto-update suggested target when shift, item, or workstation changes
  useEffect(() => {
    if (suggestedTarget > 0 && !overrideReason) {
      setPlannedQty(suggestedTarget);
    }
  }, [suggestedTarget, overrideReason]);

  const hasShortage = issueQty > rawStock;

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();

    if (hasShortage) {
      setNotification({
        type: 'error',
        message: `Cannot schedule Work Order: Requested issue quantity (${issueQty} pcs) exceeds available unreserved raw stock (${rawStock} pcs).`,
      });
      return;
    }

    if (issueQty <= 0) {
      setNotification({ type: 'error', message: 'Issue quantity must be greater than zero.' });
      return;
    }

    // 1. Create sequential Work Order Number
    const count = ds.getWorkOrders().length + 1;
    const woNum = `WO-2026-${String(count).padStart(4, '0')}`;
    const ptnNum = `PTN-2026-${String(ds.getPTNs().length + 1).padStart(4, '0')}`;

    // 2. Create PTN for material issuance from raw store to Workstation
    const ptn: PTNDocument = {
      id: `ptn-${Date.now()}`,
      ptnNumber: ptnNum,
      date: planDate,
      sourceLocationId: 'loc-raw-store',
      destinationLocationId: 'loc-ws-bay',
      workstationId: selectedWs?.code,
      assignedPersonId: selectedWorker?.name,
      items: [
        {
          itemId: selectedItemId,
          quantity: issueQty,
          stageName: 'Primary Trimming',
          workOrderId: woNum,
          reason: `Scheduled Shift Plan for ${selectedShift?.name}`,
        },
      ],
      status: 'completed',
      preparedBy: 'Production Planner',
      approvedBy: 'Shift Supervisor',
      remarks: overrideReason ? `Target Override: ${overrideReason}` : 'Standard shift allocation',
      qrCodePayload: JSON.stringify({ doc: ptnNum, wo: woNum, qty: issueQty, item: selectedItem?.itemCode }),
      createdAt: new Date().toISOString(),
    };

    // 3. Move stock & deduct from raw store
    ds.updateBalance('loc-raw-store', selectedItemId, 'untrimmed', -issueQty);
    ds.updateBalance('loc-ws-bay', selectedItemId, 'in_trimming', issueQty);

    // 4. Create Work Order
    const workOrder: WorkOrder = {
      id: `wo-${Date.now()}`,
      workOrderNumber: woNum,
      date: planDate,
      shiftId: selectedShift?.code || 'SHIFT_A',
      workstationId: selectedWs?.code || 'WS-01',
      assignedWorkerId: selectedWorker?.id || 'w-1',
      itemId: selectedItemId,
      stageName: 'Primary Trimming',
      sourcePtnId: ptn.id,
      quantityIssued: issueQty,
      plannedQuantity: plannedQty,
      actualTrimmedQuantity: 0,
      quantitySentToQc: 0,
      quantityReturnedUntrimmed: 0,
      closingBalance: issueQty,
      downtimeMinutes: 0,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };

    ds.addPTN(ptn);
    ds.addWorkOrder(workOrder);

    // Update workstation active status
    if (selectedWs) {
      selectedWs.status = 'active';
      selectedWs.currentWorkerId = selectedWorker?.id;
      selectedWs.currentWorkOrderId = workOrder.id;
      ds.updateWorkstation(selectedWs);
    }

    ds.logAudit(
      'Production Planner',
      'production_planner',
      'CREATE_SHIFT_PLAN',
      'WorkOrder',
      woNum,
      `Scheduled ${selectedWs?.code} for Shift ${selectedShift?.name} with ${issueQty} pcs issued via PTN ${ptnNum}`
    );

    setNotification({
      type: 'success',
      message: `Successfully scheduled Work Order ${woNum} and generated PTN ${ptnNum} for ${selectedWs?.code}!`,
    });

    if (onPlanCreated) onPlanCreated();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-blue-600" />
          <span>Workstation-Wise Production Planning &amp; Scheduling</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Calculate shift targets based on Pieces Per Hour (PPH) × Net Working Hours, inspect raw inventory availability, and prevent over-allocation.
        </p>
      </div>

      {notification && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <ShieldAlert className="w-4 h-4 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs font-bold px-2 py-0.5">
            ✕
          </button>
        </div>
      )}

      {/* Main Planning Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Planning Entry Form (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-4">
            Schedule Workstation Shift Plan
          </h3>

          <form onSubmit={handleCreatePlan} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Production Date</label>
                <input
                  type="date"
                  value={planDate}
                  onChange={(e) => setPlanDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Select Shift</label>
                <select
                  value={selectedShiftId}
                  onChange={(e) => setSelectedShiftId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-medium"
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.netWorkingHours} net hrs)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Target Workstation (WS-01 to WS-70)</label>
                <select
                  value={selectedWsId}
                  onChange={(e) => setSelectedWsId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-mono font-medium"
                >
                  {workstations.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.code} - {ws.name} ({ws.status.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Assigned Worker / In-House Vendor</label>
                <select
                  value={selectedWorkerId}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-medium"
                >
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} - {w.name} ({w.type === 'in_house_vendor' ? 'Piece-Rate Vendor' : 'Employee'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Untrimmed Moulding Item</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-medium"
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.itemCode} - {it.description} ({it.expectedCapacityPph} PPH)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Quantity to Issue to Station via PTN (pcs)</label>
                <input
                  type="number"
                  min="1"
                  value={issueQty}
                  onChange={(e) => setIssueQty(parseInt(e.target.value) || 0)}
                  className={`w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded font-mono font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 ${
                    hasShortage ? 'border-rose-500 focus:ring-rose-500 text-rose-600' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
                  }`}
                  required
                />
              </div>
            </div>

            {/* Target Calculation Box */}
            <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-blue-900 dark:text-blue-300">
                  <Calculator className="w-4 h-4" />
                  <span>Target Formula: Capacity ({selectedItem?.expectedCapacityPph} PPH) × Net Shift ({selectedShift?.netWorkingHours}h)</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">SUGGESTED TARGET:</span>
                  <span className="font-mono font-bold text-sm text-blue-700 dark:text-blue-400">
                    {formatNumber(suggestedTarget)} pcs
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-blue-100 dark:border-blue-900/40">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                    Planned Target Quantity (pcs)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={plannedQty}
                    onChange={(e) => setPlannedQty(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded font-mono font-semibold text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                    Override Reason (if overriding suggested target)
                  </label>
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="e.g. New operator training, complex parting line..."
                    className="w-full px-3 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Shortage Warning */}
            {hasShortage && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 rounded-lg text-rose-800 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">INSUFFICIENT UNTRIMMED INVENTORY! </span>
                  <span>
                    You requested to issue {formatNumber(issueQty)} pcs, but only {formatNumber(rawStock)} pcs are available in the raw store. System prevents negative physical stock.
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={hasShortage}
                className={`px-5 py-2 rounded text-xs font-medium text-white flex items-center gap-1.5 transition-colors ${
                  hasShortage ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Confirm Plan &amp; Issue PTN to Station</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right: Real-Time Availability & Stock Check (1 Col) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Live Stock Availability Check
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Physical store stock vs reservations</p>

            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                {selectedItem?.itemCode}
              </div>
              <div className="text-slate-500 text-[11px]">
                {selectedItem?.description}
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Unreserved Raw Stock:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatNumber(rawStock)} pcs
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Scheduled Issue Request:</span>
                  <span className={`font-mono font-bold ${hasShortage ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'}`}>
                    {formatNumber(issueQty)} pcs
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Remaining After Issue:</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                    {formatNumber(Math.max(0, rawStock - issueQty))} pcs
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <div className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
                Planning Rules Enforced
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-500 text-[11px]">
                <li>One primary item per workstation per shift.</li>
                <li>Over-allocation of physical material is rejected.</li>
                <li>Target calculation utilizes Pieces Per Hour (PPH).</li>
                <li>Automated sequential PTN generated for transfer.</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
            Trimming Operations Engine v1.0 · Transaction Safe
          </div>
        </div>
      </div>
    </div>
  );
};
