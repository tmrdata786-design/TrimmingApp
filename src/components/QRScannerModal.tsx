/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, QrCode, Search, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { DataService } from '../services/storage';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDocument?: (type: string, id: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onNavigateToDocument,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [scannedResult, setScannedResult] = useState<{
    type: 'ptn' | 'ogp' | 'igp' | 'wo' | 'item' | 'ws' | 'unknown';
    title: string;
    description: string;
    details: Record<string, any>;
  } | null>(null);

  if (!isOpen) return null;

  const ds = DataService.getInstance();

  const handleLookup = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;

    // 1. PTN match
    const ptn = ds.getPTNs().find((p) => p.ptnNumber.toUpperCase() === clean || p.id.toUpperCase() === clean);
    if (ptn) {
      setScannedResult({
        type: 'ptn',
        title: `Production Transfer Note: ${ptn.ptnNumber}`,
        description: `Source: ${ptn.sourceLocationId} ➔ Destination: ${ptn.destinationLocationId}`,
        details: {
          Status: ptn.status,
          Date: ptn.date,
          'Items Count': ptn.items.length,
          'Total Quantity': ptn.items.reduce((acc, i) => acc + i.quantity, 0),
          'Prepared By': ptn.preparedBy,
        },
      });
      return;
    }

    // 2. OGP match
    const ogp = ds.getOGPs().find((o) => o.ogpNumber.toUpperCase() === clean);
    if (ogp) {
      const vendor = ds.getOutsourcedVendors().find((v) => v.id === ogp.vendorId);
      setScannedResult({
        type: 'ogp',
        title: `Outward Gate Pass: ${ogp.ogpNumber}`,
        description: `Issued to Outsourced Vendor: ${vendor ? vendor.name : ogp.vendorId}`,
        details: {
          Status: ogp.status,
          'Issued Quantity': ogp.totalIssuedQuantity,
          'Issue Date': ogp.issueDate,
          'Expected Return': ogp.expectedReturnDate,
        },
      });
      return;
    }

    // 3. Work Order match
    const wo = ds.getWorkOrders().find((w) => w.workOrderNumber.toUpperCase() === clean);
    if (wo) {
      setScannedResult({
        type: 'wo',
        title: `Internal Shift Work Order: ${wo.workOrderNumber}`,
        description: `Station: ${wo.workstationId} | Shift: ${wo.shiftId}`,
        details: {
          Status: wo.status,
          'Planned Quantity': wo.plannedQuantity,
          'Actual Trimmed': wo.actualTrimmedQuantity,
          'Closing Balance': wo.closingBalance,
          Downtime: `${wo.downtimeMinutes} mins`,
        },
      });
      return;
    }

    // 4. Workstation match (e.g. WS-01)
    const ws = ds.getWorkstations().find((w) => w.code.toUpperCase() === clean);
    if (ws) {
      setScannedResult({
        type: 'ws',
        title: `Workstation: ${ws.code} - ${ws.name}`,
        description: `Status: ${ws.status.toUpperCase()}`,
        details: {
          Code: ws.code,
          Status: ws.status,
          'Capacity Multiplier': `${ws.capacityMultiplier}x`,
          'Assigned Worker': ws.currentWorkerId || 'Unassigned',
        },
      });
      return;
    }

    // 5. Item match
    const item = ds.getItems().find((i) => i.itemCode.toUpperCase() === clean || i.barcode?.toUpperCase() === clean);
    if (item) {
      const balances = ds.getBalances().filter((b) => b.itemId === item.id);
      const totalStock = balances.reduce((acc, b) => acc + b.quantityOnHand, 0);
      setScannedResult({
        type: 'item',
        title: `Item Master: ${item.itemCode}`,
        description: item.description,
        details: {
          Category: item.category,
          'Total On Hand': `${totalStock} ${item.unitOfMeasure}`,
          'Standard PPH': `${item.expectedCapacityPph} pcs/hr`,
          'Trimming Rate': `₨ ${item.defaultTrimmingRate.toFixed(2)}`,
          'Baseline Cost': `₨ ${item.baselineManufacturingCost.toFixed(2)}`,
        },
      });
      return;
    }

    // Unknown code
    setScannedResult({
      type: 'unknown',
      title: 'Unrecognized Code',
      description: `Scanned code "${code}" was not found in active operational records.`,
      details: {},
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLookup(manualCode);
  };

  const quickSamples = ['PTN-2026-0001', 'OGP-2026-0001', 'WO-2026-0001', 'WS-01', 'MLD-001', 'TRM-001'];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-lg w-full overflow-hidden shadow-xl">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
              Barcode &amp; QR Floor Scanner
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scanner Simulation Window */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-950 rounded-lg p-6 flex flex-col items-center justify-center border border-slate-800 text-center relative overflow-hidden">
            <div className="w-48 h-48 border-2 border-dashed border-blue-500/60 rounded-lg flex flex-col items-center justify-center p-4 relative">
              <QrCode className="w-16 h-16 text-blue-400/40 animate-pulse" />
              <div className="w-full h-0.5 bg-blue-500 absolute top-1/2 left-0 animate-bounce shadow-lg shadow-blue-500/50"></div>
              <p className="text-[11px] text-slate-400 mt-2 font-mono">Camera / USB Reader Ready</p>
            </div>
            <p className="text-xs text-slate-400 mt-3 max-w-xs">
              Position physical document QR code or barcode under camera or scan with USB handheld scanner.
            </p>
          </div>

          {/* Manual Input or USB Scanner keyboard wedge */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Or type/paste Barcode (e.g. PTN-2026-0001, WS-01)..."
              className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
            >
              Scan
            </button>
          </form>

          {/* Quick Test Samples */}
          <div>
            <span className="text-[11px] text-slate-400 mr-2">Quick Floor Tags:</span>
            <div className="inline-flex flex-wrap gap-1 mt-1">
              {quickSamples.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    setManualCode(sample);
                    handleLookup(sample);
                  }}
                  className="px-2 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          {/* Scanned Result Card */}
          {scannedResult && (
            <div
              className={`p-4 rounded-lg border text-xs ${
                scannedResult.type !== 'unknown'
                  ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50'
                  : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {scannedResult.type !== 'unknown' ? (
                  <CheckCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    {scannedResult.title}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                    {scannedResult.description}
                  </div>

                  {Object.keys(scannedResult.details).length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-[11px]">
                      {Object.entries(scannedResult.details).map(([key, value]) => (
                        <div key={key}>
                          <span className="text-slate-400 font-medium">{key}: </span>
                          <span className="font-mono text-slate-800 dark:text-slate-200">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {scannedResult.type !== 'unknown' && onNavigateToDocument && (
                    <button
                      onClick={() => {
                        onNavigateToDocument(scannedResult.type, manualCode);
                        onClose();
                      }}
                      className="mt-3 flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium hover:underline text-xs"
                    >
                      <span>Open Document in System</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-xs font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
