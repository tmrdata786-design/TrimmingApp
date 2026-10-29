/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { X, Printer, QrCode } from 'lucide-react';
import { generateQRCodeDataUrl, triggerPrint } from '../services/exportUtils';
import { PTNDocument, OGPDocument, IGPDocument, WorkOrder, Item } from '../types';
import { DataService } from '../services/storage';
import { formatPKR } from '../services/inventoryEngine';

interface PrintableDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'ptn' | 'ogp' | 'igp' | 'shift_sheet';
  documentData: any;
}

export const PrintableDocumentModal: React.FC<PrintableDocumentModalProps> = ({
  isOpen,
  onClose,
  documentType,
  documentData,
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const ds = DataService.getInstance();

  useEffect(() => {
    if (!isOpen || !documentData) return;
    const payload =
      documentData.qrCodePayload ||
      JSON.stringify({
        doc: documentData.ptnNumber || documentData.ogpNumber || documentData.workOrderNumber,
        date: documentData.date || documentData.issueDate,
      });

    generateQRCodeDataUrl(payload).then((url) => setQrUrl(url));
  }, [isOpen, documentData]);

  if (!isOpen || !documentData) return null;

  const items = ds.getItems();
  const getItem = (id: string) => items.find((i) => i.id === id);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-lg max-w-2xl w-full my-8 shadow-2xl overflow-hidden border border-slate-300">
        {/* Print Action Bar (hidden in real print) */}
        <div className="bg-slate-100 border-b border-slate-300 p-3 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wide">
            <Printer className="w-4 h-4 text-blue-600" />
            <span>Manufacturing Print Slip Preview</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={triggerPrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Document (Ctrl+P)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* The Printable Page Canvas */}
        <div className="p-8 space-y-6 text-slate-800 bg-white">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div>
              <div className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                Trimming Operations Plant Ltd.
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Plot 42-B, Industrial Estate, Sector 15 · Production &amp; Material Control
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-1">
                Ref ISO 9001:2015 Manufacturing Standard Form
              </div>
            </div>

            <div className="text-right">
              {qrUrl ? (
                <img src={qrUrl} alt="Document QR Code" className="w-20 h-20 border border-slate-300 p-0.5" />
              ) : (
                <div className="w-20 h-20 bg-slate-100 flex items-center justify-center border border-slate-300">
                  <QrCode className="w-8 h-8 text-slate-400" />
                </div>
              )}
              <div className="text-[10px] font-mono text-slate-500 mt-1">SCAN FOR AUDIT</div>
            </div>
          </div>

          {/* Title Ribbon */}
          <div className="bg-slate-900 text-white text-center py-1.5 font-bold text-sm tracking-wider uppercase">
            {documentType === 'ptn' && 'Production Transfer Note (PTN)'}
            {documentType === 'ogp' && 'Outward Gate Pass (OGP) - Outsourced Trimming'}
            {documentType === 'igp' && 'Inward Gate Pass (IGP) - Vendor Return'}
            {documentType === 'shift_sheet' && 'Daily Trimming Shift Job Sheet'}
          </div>

          {/* Meta Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              {documentType === 'ptn' && (
                <>
                  <div><span className="font-semibold text-slate-500">PTN No: </span><span className="font-mono font-bold">{documentData.ptnNumber}</span></div>
                  <div><span className="font-semibold text-slate-500">Date: </span><span>{documentData.date}</span></div>
                  <div><span className="font-semibold text-slate-500">Source Location: </span><span>{documentData.sourceLocationId}</span></div>
                  <div><span className="font-semibold text-slate-500">Destination: </span><span className="font-semibold">{documentData.destinationLocationId}</span></div>
                </>
              )}
              {documentType === 'ogp' && (
                <>
                  <div><span className="font-semibold text-slate-500">OGP No: </span><span className="font-mono font-bold">{documentData.ogpNumber}</span></div>
                  <div><span className="font-semibold text-slate-500">Issue Date: </span><span>{documentData.issueDate}</span></div>
                  <div><span className="font-semibold text-slate-500">Vendor ID: </span><span className="font-semibold">{documentData.vendorId}</span></div>
                  <div><span className="font-semibold text-slate-500">Expected Return: </span><span>{documentData.expectedReturnDate}</span></div>
                </>
              )}
              {documentType === 'shift_sheet' && (
                <>
                  <div><span className="font-semibold text-slate-500">Work Order: </span><span className="font-mono font-bold">{documentData.workOrderNumber}</span></div>
                  <div><span className="font-semibold text-slate-500">Workstation: </span><span className="font-bold text-blue-700">{documentData.workstationId}</span></div>
                  <div><span className="font-semibold text-slate-500">Shift: </span><span>{documentData.shiftId}</span></div>
                  <div><span className="font-semibold text-slate-500">Assigned Operator: </span><span className="font-semibold">{documentData.assignedWorkerId}</span></div>
                </>
              )}
            </div>

            <div className="space-y-1 text-right">
              <div><span className="font-semibold text-slate-500">Plant Status: </span><span className="font-medium">AUTHORIZED</span></div>
              <div><span className="font-semibold text-slate-500">Currency: </span><span className="font-mono">PKR (Rs.)</span></div>
              <div><span className="font-semibold text-slate-500">Generated: </span><span className="font-mono">{new Date().toLocaleString()}</span></div>
              {documentData.preparedBy && (
                <div><span className="font-semibold text-slate-500">Prepared By: </span><span>{documentData.preparedBy}</span></div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-300 rounded overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 border-b border-slate-300 text-slate-700">
                <tr>
                  <th className="py-2 px-3 font-semibold">Sr #</th>
                  <th className="py-2 px-3 font-semibold">Item Code &amp; Description</th>
                  <th className="py-2 px-3 font-semibold text-right">Qty Issued</th>
                  {documentType === 'ogp' && <th className="py-2 px-3 font-semibold text-right">Rate (PKR)</th>}
                  {documentType === 'shift_sheet' && <th className="py-2 px-3 font-semibold text-right">Target Output</th>}
                  <th className="py-2 px-3 font-semibold text-right">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {documentType === 'ptn' &&
                  (documentData.items || []).map((line: any, idx: number) => {
                    const it = getItem(line.itemId);
                    return (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-mono">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <span className="font-mono font-semibold">{it?.itemCode || line.itemId}</span>
                          <span className="block text-[11px] text-slate-500">{it?.description}</span>
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold text-right">{line.quantity} pcs</td>
                        <td className="py-2 px-3 text-right text-slate-500">{line.reason || 'Floor transfer'}</td>
                      </tr>
                    );
                  })}

                {documentType === 'ogp' &&
                  (documentData.items || []).map((line: any, idx: number) => {
                    const it = getItem(line.itemId);
                    return (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-mono">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <span className="font-mono font-semibold">{it?.itemCode || line.itemId}</span>
                          <span className="block text-[11px] text-slate-500">{it?.description}</span>
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold text-right">{line.quantity} pcs</td>
                        <td className="py-2 px-3 font-mono text-right">{formatPKR(line.ratePerPiece)}</td>
                        <td className="py-2 px-3 text-right text-slate-500">Piece-rate outsource</td>
                      </tr>
                    );
                  })}

                {documentType === 'shift_sheet' && (
                  <tr>
                    <td className="py-2 px-3 font-mono">1</td>
                    <td className="py-2 px-3">
                      <span className="font-mono font-semibold">{documentData.itemId}</span>
                      <span className="block text-[11px] text-slate-500">Operation: {documentData.stageName}</span>
                    </td>
                    <td className="py-2 px-3 font-mono font-semibold text-right">{documentData.quantityIssued} pcs</td>
                    <td className="py-2 px-3 font-mono font-semibold text-right text-blue-700">{documentData.plannedQuantity} pcs</td>
                    <td className="py-2 px-3 text-right text-slate-500">Shift Target</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Shift Sheet Hourly Breakdown Form for Operator Logging */}
          {documentType === 'shift_sheet' && (
            <div className="border border-slate-300 rounded p-3 space-y-2">
              <div className="font-semibold text-xs text-slate-700 uppercase">Hourly Physical Output Log (Operator to Fill)</div>
              <div className="grid grid-cols-4 gap-2 text-[11px]">
                {['Hour 1 (08:00)', 'Hour 2 (09:00)', 'Hour 3 (10:00)', 'Hour 4 (11:00)', 'Hour 5 (12:00)', 'Hour 6 (13:00)', 'Hour 7 (14:00)', 'Hour 8 (15:00)'].map((h, i) => (
                  <div key={i} className="border border-slate-200 p-1.5 rounded bg-slate-50">
                    <span className="text-slate-500 block text-[10px]">{h}</span>
                    <div className="h-6 border-b border-dashed border-slate-400 mt-1"></div>
                  </div>
                ))}
              </div>
              <div className="pt-2 flex justify-between text-xs text-slate-600">
                <span>Downtime Log: ________________ mins</span>
                <span>Reason: _____________________________</span>
              </div>
            </div>
          )}

          {/* Signatures & Approvals Section */}
          <div className="pt-8 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs">
            <div>
              <div className="h-10 border-b border-slate-400 mb-1"></div>
              <span className="font-semibold text-slate-700">Prepared By</span>
              <span className="block text-[10px] text-slate-500">Store / Planning Operator</span>
            </div>
            <div>
              <div className="h-10 border-b border-slate-400 mb-1"></div>
              <span className="font-semibold text-slate-700">Floor Supervisor</span>
              <span className="block text-[10px] text-slate-500">Verification &amp; Material Check</span>
            </div>
            <div>
              <div className="h-10 border-b border-slate-400 mb-1"></div>
              <span className="font-semibold text-slate-700">Security Gate / QC Officer</span>
              <span className="block text-[10px] text-slate-500">Final Release Stamp</span>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 text-center font-mono pt-4">
            *** Internal Transaction Authoritative Document · Reproduction without authorization is prohibited ***
          </div>
        </div>
      </div>
    </div>
  );
};
