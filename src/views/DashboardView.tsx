/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Boxes,
  Truck,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { DataService } from '../services/storage';
import { formatPKR, formatNumber } from '../services/inventoryEngine';
import { ActiveTab } from '../components/Sidebar';

interface DashboardViewProps {
  onNavigate: (tab: ActiveTab) => void;
  onOpenScanner: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onOpenScanner }) => {
  const ds = DataService.getInstance();

  const workstations = ds.getWorkstations();
  const workOrders = ds.getWorkOrders();
  const qcInspections = ds.getQCInspections();
  const balances = ds.getBalances();
  const vendors = ds.getOutsourcedVendors();
  const ptns = ds.getPTNs();

  // Metrics Calculations
  const activeStationsCount = workstations.filter((w) => w.status === 'active').length;
  const maintenanceCount = workstations.filter((w) => w.status === 'maintenance').length;
  const idleCount = workstations.filter((w) => w.status === 'idle').length;

  const totalPlanned = workOrders.reduce((acc, w) => acc + w.plannedQuantity, 0);
  const totalActual = workOrders.reduce((acc, w) => acc + w.actualTrimmedQuantity, 0);
  const attainment = totalPlanned > 0 ? ((totalActual / totalPlanned) * 100).toFixed(1) : '100.0';

  const totalInspected = qcInspections.reduce((acc, q) => acc + q.quantityInspected, 0);
  const totalAccepted = qcInspections.reduce((acc, q) => acc + q.quantityAccepted, 0);
  const totalRejected = qcInspections.reduce((acc, q) => acc + q.quantityRejected, 0);
  const fpqr = totalInspected > 0 ? ((totalAccepted / totalInspected) * 100).toFixed(1) : '100.0';
  const goodOutputEff = totalPlanned > 0 ? ((totalAccepted / totalPlanned) * 100).toFixed(1) : '95.0';

  const totalUntrimmed = balances
    .filter((b) => b.status === 'untrimmed' && !b.locationId.includes('vend'))
    .reduce((acc, b) => acc + b.quantityOnHand, 0);

  const totalTrimmedFinished = balances
    .filter((b) => b.status === 'approved_finished')
    .reduce((acc, b) => acc + b.quantityOnHand, 0);

  const totalQcPending = balances
    .filter((b) => b.status === 'qc_pending')
    .reduce((acc, b) => acc + b.quantityOnHand, 0);

  const totalReworkHolding = balances
    .filter((b) => b.status === 'rework_holding')
    .reduce((acc, b) => acc + b.quantityOnHand, 0);

  const totalVendorHeld = vendors.reduce((acc, v) => acc + v.currentOutstandingQty, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-lg p-5 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">
              Shift A Active · Floor Operating at 85% Utilization
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-1">
            Plant Command Center &amp; Production Telemetry
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time material traceability, 70-workstation scheduling, QC acceptance, and piece-rate ledger in PKR.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('planning')}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
          >
            Open Shift Planner
          </button>
          <button
            onClick={onOpenScanner}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded transition-colors"
          >
            Scan Tag / QR
          </button>
        </div>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Attainment */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Attainment</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {attainment}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {formatNumber(totalActual)} / {formatNumber(totalPlanned)} pcs
          </div>
        </div>

        {/* First Pass Quality */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>First-Pass Quality</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {fpqr}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {formatNumber(totalAccepted)} accepted / {formatNumber(totalRejected)} rej
          </div>
        </div>

        {/* Good-Output Efficiency */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Good-Output Eff.</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {goodOutputEff}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">QC Passed vs Planned</div>
        </div>

        {/* Active Workstations */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Active WS Fleet</span>
            <Cpu className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">
            {activeStationsCount} <span className="text-xs text-slate-400 font-normal">/ 70</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {idleCount} idle · {maintenanceCount} down
          </div>
        </div>

        {/* Material in QC & Rework */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Material in QC / RW</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
            {formatNumber(totalQcPending + totalReworkHolding)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {totalQcPending} QC hold · {totalReworkHolding} rework
          </div>
        </div>

        {/* Vendor Outstanding */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Vendor Held Parts</span>
            <Truck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {formatNumber(totalVendorHeld)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Across outsourced sites</div>
        </div>
      </div>

      {/* Middle Grid: Active Workstations Quick Matrix & Recent PTNs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workstations Status Summary (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                Workstation Fleet Availability (WS-01 through WS-70)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time status across all 70 dedicated trimming benches
              </p>
            </div>
            <button
              onClick={() => onNavigate('workstations')}
              className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1"
            >
              <span>View 70 Matrix</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mini 70-Grid Indicator */}
          <div className="grid grid-cols-10 sm:grid-cols-14 gap-1.5 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
            {workstations.map((ws) => {
              let bg = 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
              if (ws.status === 'active') bg = 'bg-emerald-500 text-white font-bold';
              if (ws.status === 'maintenance') bg = 'bg-amber-500 text-white';

              return (
                <div
                  key={ws.id}
                  title={`${ws.code}: ${ws.name} (${ws.status.toUpperCase()})`}
                  className={`text-[9px] font-mono h-6 rounded flex items-center justify-center cursor-pointer transition-transform hover:scale-110 ${bg}`}
                  onClick={() => onNavigate('workstations')}
                >
                  {ws.code.replace('WS-', '')}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
              <span>Active ({activeStationsCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-slate-200 dark:bg-slate-800"></span>
              <span>Idle ({idleCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-amber-500"></span>
              <span>Maintenance ({maintenanceCount})</span>
            </div>
          </div>
        </div>

        {/* Live Material Stock Overview (1 Col) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Plant Material Distribution
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Current verifiable ledger stock</p>

            <div className="space-y-3 mt-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Untrimmed Raw Store</span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatNumber(totalUntrimmed)} pcs
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Approved Finished Store</span>
                <span className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatNumber(totalTrimmedFinished)} pcs
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">QC Inspection Holding</span>
                <span className="font-mono font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                  {formatNumber(totalQcPending)} pcs
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Rework Staging Bay</span>
                <span className="font-mono font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                  {formatNumber(totalReworkHolding)} pcs
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Vendor Outside Sites</span>
                <span className="font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                  {formatNumber(totalVendorHeld)} pcs
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('inventory')}
            className="w-full mt-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded transition-colors text-center"
          >
            Open Stock Ledger &amp; Balances
          </button>
        </div>
      </div>

      {/* Bottom Grid: Recent PTNs & Work Order In-Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent PTNs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Recent Production Transfer Notes (PTNs)
            </h3>
            <button
              onClick={() => onNavigate('ptn')}
              className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {ptns.slice(0, 3).map((ptn) => (
              <div key={ptn.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {ptn.ptnNumber}
                  </div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    {ptn.sourceLocationId} ➔ {ptn.destinationLocationId}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-medium text-slate-800 dark:text-slate-200">
                    {ptn.items.reduce((acc, i) => acc + i.quantity, 0)} pcs
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold">
                    {ptn.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Work Orders */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Active Shift Work Orders
            </h3>
            <button
              onClick={() => onNavigate('work_orders')}
              className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              View Work Orders
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {workOrders.slice(0, 3).map((wo) => (
              <div key={wo.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {wo.workOrderNumber} · {wo.workstationId}
                  </div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Item: {wo.itemId} · Operator: {wo.assignedWorkerId}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {wo.actualTrimmedQuantity} / {wo.plannedQuantity} pcs
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Downtime: {wo.downtimeMinutes}m
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
