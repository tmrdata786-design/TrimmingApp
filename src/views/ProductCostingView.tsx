/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Coins, TrendingDown, Layers, BarChart, Info, ArrowUpRight } from 'lucide-react';
import { DataService } from '../services/storage';
import { formatPKR, formatNumber } from '../services/inventoryEngine';
import { Item, ProductUnitCost } from '../types';

export const ProductCostingView: React.FC = () => {
  const ds = DataService.getInstance();

  const [items, setItems] = useState<Item[]>(ds.getItems());
  const [selectedPeriod, setSelectedPeriod] = useState('2026-10');

  useEffect(() => {
    return ds.subscribe(() => {
      setItems(ds.getItems());
    });
  }, [ds]);

  const trimmedItems = items.filter((i) => i.category === 'trimmed_finished');

  // Compute live product unit costs
  const unitCosts: ProductUnitCost[] = trimmedItems.map((trimmed) => {
    const parent = items.find((i) => i.id === trimmed.parentItemId);
    const baseline = parent ? parent.baselineManufacturingCost : trimmed.baselineManufacturingCost;

    const inHouseTrimming = trimmed.defaultTrimmingRate; // Rs. 2.50
    const outsourcedTrimming = 3.0; // Benchmark outsourced rate
    const allocatedLabour = 1.85; // Absorbed employee salary per piece
    const reworkCost = 0.35; // Absorbed rework & scrap rate

    const totalFinished = baseline + inHouseTrimming + allocatedLabour + reworkCost;

    return {
      itemId: trimmed.id,
      itemCode: trimmed.itemCode,
      description: trimmed.description,
      baselineManufacturingCostPkr: baseline,
      inHouseTrimmingCostPkr: inHouseTrimming,
      outsourcedTrimmingCostPkr: outsourcedTrimming,
      allocatedEmployeeLabourCostPkr: allocatedLabour,
      reworkScrapCostPkr: reworkCost,
      totalFinishedCostPkr: totalFinished,
      effectiveDate: '2026-10-28',
    };
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Coins className="w-5 h-5 text-blue-600" />
            <span>Product Finished Unit Costing &amp; Breakdown Engine (PKR)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent per-unit manufacturing cost breakdown: Baseline raw moulding + trimming labour + absorbed salary + rework.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Costing Period:</span>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="2026-10">October 2026 (Current Active)</option>
            <option value="2026-09">September 2026 (Audited Final)</option>
            <option value="2026-08">August 2026 (Historical)</option>
          </select>
        </div>
      </div>

      {/* Anti Double-Counting Principle Callout */}
      <div className="p-4 bg-slate-900 text-white rounded-lg border border-slate-800 flex items-start gap-3 text-xs">
        <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-emerald-400">FINANCIAL INTEGRITY &amp; ANTI-DOUBLE COUNTING INVARIANT:</span>
          <p className="text-slate-300 mt-0.5 leading-relaxed">
            Trimming operation costs are recognized at the time of verified production entry and QC acceptance.
            Disbursements from the vendor payment ledger are pure financial balance settlements and are strictly prevented from creating duplicate production expense lines.
          </p>
        </div>
      </div>

      {/* Unit Cost Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {unitCosts.map((cost) => (
          <div
            key={cost.itemId}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4 hover:shadow-md transition-shadow"
          >
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="font-mono font-bold text-base text-blue-600 dark:text-blue-400">
                {cost.itemCode}
              </span>
              <div className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate mt-0.5">
                {cost.description}
              </div>
            </div>

            {/* Cost Layers Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>1. Baseline Raw Moulding:</span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatPKR(cost.baselineManufacturingCostPkr)}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>2. In-House Trimming Rate:</span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatPKR(cost.inHouseTrimmingCostPkr)}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>3. Absorbed Employee Labour:</span>
                <span className="font-mono font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                  {formatPKR(cost.allocatedEmployeeLabourCostPkr)}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>4. Rework &amp; Scrap Absorption:</span>
                <span className="font-mono font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                  {formatPKR(cost.reworkScrapCostPkr)}
                </span>
              </div>
            </div>

            {/* Total Box */}
            <div className="pt-3 border-t-2 border-slate-900 dark:border-slate-700 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">TOTAL FINISHED COST</span>
                <span className="text-xs text-slate-500 font-medium">Per Accepted Unit</span>
              </div>
              <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatPKR(cost.totalFinishedCostPkr)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Analysis Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
            Item-Wise Manufacturing Cost Summary Matrix
          </h3>
          <span className="text-xs text-slate-400 font-mono">Currency: PKR</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Trimmed Item Code</th>
                <th className="py-2.5 px-3 font-semibold">Description</th>
                <th className="py-2.5 px-3 font-semibold text-right">Baseline Raw</th>
                <th className="py-2.5 px-3 font-semibold text-right">In-House Rate</th>
                <th className="py-2.5 px-3 font-semibold text-right">Outsourced Rate</th>
                <th className="py-2.5 px-3 font-semibold text-right">Absorbed Labour</th>
                <th className="py-2.5 px-3 font-semibold text-right">Rework Burden</th>
                <th className="py-2.5 px-4 font-semibold text-right">Total Unit Cost (PKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {unitCosts.map((c) => (
                <tr key={c.itemId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                    {c.itemCode}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                    {c.description}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-800 dark:text-slate-200">
                    {formatPKR(c.baselineManufacturingCostPkr)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-800 dark:text-slate-200">
                    {formatPKR(c.inHouseTrimmingCostPkr)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-500">
                    {formatPKR(c.outsourcedTrimmingCostPkr)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right tabular-nums text-blue-600 dark:text-blue-400 font-medium">
                    {formatPKR(c.allocatedEmployeeLabourCostPkr)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right tabular-nums text-amber-600 dark:text-amber-400 font-medium">
                    {formatPKR(c.reworkScrapCostPkr)}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {formatPKR(c.totalFinishedCostPkr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
