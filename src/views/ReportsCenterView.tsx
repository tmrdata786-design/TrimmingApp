/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BarChart3, Download, Filter, Search, Calendar, FileSpreadsheet } from 'lucide-react';
import { DataService } from '../services/storage';
import { exportToCSV } from '../services/exportUtils';
import { formatPKR, formatNumber } from '../services/inventoryEngine';

export const ReportsCenterView: React.FC = () => {
  const ds = DataService.getInstance();

  const [selectedReportId, setSelectedReportId] = useState<string>('rep-1');
  const [filterShift, setFilterShift] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');

  const reportGroups = [
    {
      group: 'Inventory & Material Flow',
      reports: [
        { id: 'rep-1', title: 'Current Stock by Item, Location & Processing Status' },
        { id: 'rep-2', title: 'Stock Held by Employees & Workstations' },
        { id: 'rep-3', title: 'Daily Molding Receipts & Raw Transfer History' },
        { id: 'rep-4', title: 'Comprehensive PTN Internal Movement Audit' },
        { id: 'rep-5', title: 'OGP & IGP Gate Pass History' },
        { id: 'rep-6', title: 'Outstanding Outsourced Vendor Stock' },
      ],
    },
    {
      group: 'Production Performance & Efficiency',
      reports: [
        { id: 'rep-7', title: 'Work Orders in Progress & Execution Status' },
        { id: 'rep-8', title: 'Planned vs Actual Production Attainment (%)' },
        { id: 'rep-9', title: 'Workstation Efficiency Matrix (WS-01 to WS-70)' },
        { id: 'rep-10', title: 'Production Output by Employee & Shift' },
        { id: 'rep-11', title: 'In-House Vendor Production Output' },
        { id: 'rep-12', title: 'Outsourced Vendor Performance & Return Rate' },
        { id: 'rep-13', title: 'Hourly Trimming Production Output' },
        { id: 'rep-14', title: 'Downtime Duration & Delay Stoppage Reasons' },
      ],
    },
    {
      group: 'Quality Control & Rework',
      reports: [
        { id: 'rep-15', title: 'QC Acceptance vs Rejection Summary' },
        { id: 'rep-16', title: 'Rework Quantities & Multi-Cycle Outcomes' },
        { id: 'rep-17', title: 'First-Pass Quality Rate (FPQR) by Item' },
        { id: 'rep-18', title: 'Repeated QC Rejections & Defect Classifications' },
      ],
    },
    {
      group: 'Costing, Ledgers & Settlements (PKR)',
      reports: [
        { id: 'rep-19', title: 'Vendor Piece-Rate Earnings & Approvals' },
        { id: 'rep-20', title: 'Outstanding Vendor Payable Balances (PKR)' },
        { id: 'rep-21', title: 'Employee Labour Cost Absorption Breakdown' },
        { id: 'rep-22', title: 'Item-Wise Total Finished Production Cost' },
        { id: 'rep-23', title: 'Historical Product Cost Variations Over Time' },
      ],
    },
    {
      group: 'Auditing & Reconciliation',
      reports: [
        { id: 'rep-24', title: 'Monthly Stocktaking Variances & Discrepancies' },
        { id: 'rep-25', title: 'Audited Inventory Adjustments & Approvals' },
      ],
    },
  ];

  const handleExport = () => {
    const activeReport = reportGroups.flatMap((g) => g.reports).find((r) => r.id === selectedReportId);
    const title = activeReport ? activeReport.title : 'Production_Report';

    let headers: string[] = ['Reference #', 'Date', 'Item / Entity', 'Category / Location', 'Quantity / Value', 'Status / Result', 'Operator / Auditor'];
    let rows: (string | number)[][] = [];

    if (selectedReportId === 'rep-1') {
      headers = ['Location Code', 'Location Name', 'Item Code', 'Status Category', 'Quantity On Hand (pcs)', 'Reserved (pcs)'];
      rows = ds.getBalances().map((b) => {
        const it = ds.getItems().find((i) => i.id === b.itemId);
        const loc = ds.getLocations().find((l) => l.id === b.locationId);
        return [loc?.code || b.locationId, loc?.name || '', it?.itemCode || b.itemId, b.status.toUpperCase(), b.quantityOnHand, b.quantityReserved];
      });
    } else if (selectedReportId === 'rep-8') {
      headers = ['Work Order', 'Workstation', 'Shift', 'Item', 'Planned Target (pcs)', 'Actual Trimmed (pcs)', 'Attainment (%)'];
      rows = ds.getWorkOrders().map((w) => {
        const att = w.plannedQuantity > 0 ? ((w.actualTrimmedQuantity / w.plannedQuantity) * 100).toFixed(1) : '100.0';
        return [w.workOrderNumber, w.workstationId, w.shiftId, w.itemId, w.plannedQuantity, w.actualTrimmedQuantity, `${att}%`];
      });
    } else if (selectedReportId === 'rep-15' || selectedReportId === 'rep-17') {
      headers = ['QC Inspection #', 'Date', 'Item Code', 'Inspected Qty', 'Accepted Qty', 'Rejected Qty', 'Pass Rate (%)', 'Inspector'];
      rows = ds.getQCInspections().map((q) => {
        const rate = q.quantityInspected > 0 ? ((q.quantityAccepted / q.quantityInspected) * 100).toFixed(1) : '100.0';
        return [q.inspectionNumber, q.date.slice(0, 10), q.itemId, q.quantityInspected, q.quantityAccepted, q.quantityRejected, `${rate}%`, q.inspector];
      });
    } else if (selectedReportId === 'rep-19' || selectedReportId === 'rep-20') {
      headers = ['Vendor ID', 'Item Code', 'Operation Reference', 'Eligible Qty (pcs)', 'Rate per Piece (PKR)', 'Total Amount (PKR)', 'Approved State', 'Payment State'];
      rows = ds.getVendorEarnings().map((e) => [
        e.vendorId,
        e.itemId,
        e.referenceId,
        e.quantityEligible,
        `Rs. ${e.ratePerPiece.toFixed(2)}`,
        `Rs. ${e.amountPkr.toFixed(2)}`,
        e.isApproved ? 'APPROVED' : 'PENDING',
        e.isPaid ? 'PAID' : 'UNPAID',
      ]);
    } else {
      headers = ['Document #', 'Date', 'Item Code', 'Quantity', 'Source Location', 'Destination Location', 'User'];
      rows = ds.getTransactions().map((t) => [
        t.transactionNumber,
        t.date.slice(0, 10),
        t.itemId,
        t.quantity,
        t.sourceLocationId,
        t.destinationLocationId,
        t.createdBy,
      ]);
    }

    exportToCSV(title.replace(/\s+/g, '_'), headers, rows);
  };

  const selectedReport = reportGroups.flatMap((g) => g.reports).find((r) => r.id === selectedReportId);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <span>Operational &amp; Financial Reports Center (25 Reports)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full compliance suite covering production attainment, FPQR, vendor ledgers (PKR), labour absorption, and reconciliation.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export to Excel / CSV</span>
        </button>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Reports Directory (1 Col) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
            Report Catalog
          </div>

          {reportGroups.map((group) => (
            <div key={group.group} className="space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                {group.group}
              </span>
              <div className="space-y-0.5">
                {group.reports.map((rep) => (
                  <button
                    key={rep.id}
                    onClick={() => setSelectedReportId(rep.id)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors truncate block ${
                      selectedReportId === rep.id
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {rep.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Active Report View (3 Cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {selectedReport?.title}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Filterable production dimension records</p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <select
                value={filterShift}
                onChange={(e) => setFilterShift(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300"
              >
                <option value="all">All Shifts</option>
                <option value="shift-a">Shift A</option>
                <option value="shift-b">Shift B</option>
                <option value="shift-c">Shift C</option>
              </select>

              <button
                onClick={handleExport}
                className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Dynamic Table Preview */}
          <div className="overflow-x-auto">
            {selectedReportId === 'rep-1' && (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Location</th>
                    <th className="py-2.5 px-3 font-semibold">Item Code</th>
                    <th className="py-2.5 px-3 font-semibold">Status Category</th>
                    <th className="py-2.5 px-3 font-semibold text-right">On Hand Qty</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Reserved Qty</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ds.getBalances().map((b) => {
                    const it = ds.getItems().find((i) => i.id === b.itemId);
                    const loc = ds.getLocations().find((l) => l.id === b.locationId);
                    return (
                      <tr key={b.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">
                          {loc?.name || b.locationId}
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold text-blue-600">
                          {it?.itemCode || b.itemId}
                        </td>
                        <td className="py-2 px-3 uppercase text-[10px] font-mono text-slate-500">
                          {b.status}
                        </td>
                        <td className="py-2 px-3 font-mono text-right tabular-nums font-bold">
                          {formatNumber(b.quantityOnHand)} pcs
                        </td>
                        <td className="py-2 px-3 font-mono text-right tabular-nums text-slate-400">
                          {formatNumber(b.quantityReserved)} pcs
                        </td>
                        <td className="py-2 px-3 font-mono text-right tabular-nums font-bold text-emerald-600">
                          {formatNumber(b.quantityOnHand - b.quantityReserved)} pcs
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {selectedReportId === 'rep-8' && (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Job Order</th>
                    <th className="py-2.5 px-3 font-semibold">Station</th>
                    <th className="py-2.5 px-3 font-semibold">Shift</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Planned (Target)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actual Trimmed</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Attainment (%)</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ds.getWorkOrders().map((w) => {
                    const att = w.plannedQuantity > 0 ? ((w.actualTrimmedQuantity / w.plannedQuantity) * 100).toFixed(1) : '100.0';
                    return (
                      <tr key={w.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">{w.workOrderNumber}</td>
                        <td className="py-2 px-3 font-mono font-semibold text-blue-600">{w.workstationId}</td>
                        <td className="py-2 px-3">{w.shiftId}</td>
                        <td className="py-2 px-3 font-mono text-right tabular-nums">{formatNumber(w.plannedQuantity)} pcs</td>
                        <td className="py-2 px-3 font-mono text-right tabular-nums font-bold text-slate-900">{formatNumber(w.actualTrimmedQuantity)} pcs</td>
                        <td className="py-2 px-3 font-mono text-right tabular-nums font-bold text-emerald-600">{att}%</td>
                        <td className="py-2 px-3 text-center uppercase text-[10px] font-semibold">{w.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {selectedReportId !== 'rep-1' && selectedReportId !== 'rep-8' && (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Txn #</th>
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                    <th className="py-2.5 px-3 font-semibold">Item</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Quantity</th>
                    <th className="py-2.5 px-3 font-semibold">Source ➔ Dest</th>
                    <th className="py-2.5 px-3 font-semibold">Ref Doc</th>
                    <th className="py-2.5 px-3 font-semibold">Authorizer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ds.getTransactions().map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">{t.transactionNumber}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{t.date.slice(0, 10)}</td>
                      <td className="py-2 px-3 font-mono font-medium">{t.itemId}</td>
                      <td className="py-2 px-3 font-mono text-right font-bold text-slate-900">{formatNumber(t.quantity)} pcs</td>
                      <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">{t.sourceLocationId} ➔ {t.destinationLocationId}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{t.referenceType}:{t.referenceId}</td>
                      <td className="py-2 px-3 text-slate-600">{t.createdBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
