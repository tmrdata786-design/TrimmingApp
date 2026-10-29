/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Truck, Plus, Printer, ArrowDownLeft, ArrowUpRight, CheckCircle, AlertTriangle, Users, Clock } from 'lucide-react';
import { DataService } from '../services/storage';
import { InventoryEngine, formatPKR, formatNumber } from '../services/inventoryEngine';
import { OutsourcedVendor, OGPDocument, IGPDocument, Item, Location } from '../types';
import { PrintableDocumentModal } from '../components/PrintableDocumentModal';

export const OutsourcedVendorView: React.FC = () => {
  const ds = DataService.getInstance();
  const engine = new InventoryEngine();

  const [vendors, setVendors] = useState<OutsourcedVendor[]>(ds.getOutsourcedVendors());
  const [ogps, setOgps] = useState<OGPDocument[]>(ds.getOGPs());
  const [igps, setIgps] = useState<IGPDocument[]>(ds.getIGPs());
  const [items, setItems] = useState<Item[]>(ds.getItems());
  const [locations, setLocations] = useState<Location[]>(ds.getLocations());

  // Modal states
  const [isOgpModalOpen, setIsOgpModalOpen] = useState(false);
  const [isIgpModalOpen, setIsIgpModalOpen] = useState(false);
  const [selectedOgpForIgp, setSelectedOgpForIgp] = useState<OGPDocument | null>(null);
  const [printDoc, setPrintDoc] = useState<{ type: 'ogp' | 'igp'; data: any } | null>(null);

  // New OGP Form
  const [ogpVendorId, setOgpVendorId] = useState(vendors[0]?.id || '');
  const [ogpDate, setOgpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedReturn, setExpectedReturn] = useState(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
  const [ogpItemId, setOgpItemId] = useState(items[0]?.id || '');
  const [ogpQty, setOgpQty] = useState(500);
  const [ogpRate, setOgpRate] = useState(3.0);
  const [ogpRemarks, setOgpRemarks] = useState('');
  const [opError, setOpError] = useState<string | null>(null);
  const [opSuccess, setOpSuccess] = useState<string | null>(null);

  // New IGP Form (Partial returns against OGP)
  const [igpReturnQty, setIgpReturnQty] = useState(250);
  const [igpReturnDate, setIgpReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [igpReceiver, setIgpReceiver] = useState('Store Receiving Clerk');

  useEffect(() => {
    return ds.subscribe(() => {
      setVendors(ds.getOutsourcedVendors());
      setOgps(ds.getOGPs());
      setIgps(ds.getIGPs());
      setItems(ds.getItems());
      setLocations(ds.getLocations());
    });
  }, [ds]);

  const getItem = (id: string) => items.find((i) => i.id === id);
  const getVendor = (id: string) => vendors.find((v) => v.id === id);

  // Handle OGP Submit
  const handleOgpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOpError(null);

    const seq = ds.getOGPs().length + 1;
    const ogpNum = `OGP-2026-${String(seq).padStart(4, '0')}`;

    const newOgp: OGPDocument = {
      id: `ogp-${Date.now()}`,
      ogpNumber: ogpNum,
      issueDate: ogpDate,
      vendorId: ogpVendorId,
      items: [
        {
          itemId: ogpItemId,
          quantity: ogpQty,
          ratePerPiece: ogpRate,
          returnedQuantity: 0,
          qcApprovedQuantity: 0,
          rejectedQuantity: 0,
          reworkQuantity: 0,
        },
      ],
      totalIssuedQuantity: ogpQty,
      expectedReturnDate: expectedReturn,
      status: 'issued',
      preparedBy: 'Store Supervisor',
      remarks: ogpRemarks,
      qrCodePayload: JSON.stringify({ doc: ogpNum, vendor: ogpVendorId, qty: ogpQty, item: ogpItemId }),
    };

    const res = engine.issueOGP(newOgp, 'Store Supervisor');
    if (!res.success) {
      setOpError(res.error || 'Failed to issue OGP.');
      return;
    }

    setOpSuccess(`Successfully issued ${ogpNum} for ${ogpQty} pieces!`);
    setIsOgpModalOpen(false);
    setTimeout(() => setOpSuccess(null), 3000);
  };

  // Open IGP Return Dialog
  const openIgpDialog = (ogp: OGPDocument) => {
    setSelectedOgpForIgp(ogp);
    const item = ogp.items[0];
    const outstanding = item ? item.quantity - item.returnedQuantity : 0;
    setIgpReturnQty(outstanding > 0 ? Math.min(outstanding, 300) : 0);
    setIsIgpModalOpen(true);
    setOpError(null);
  };

  // Handle IGP Submit (Partial or Full Return)
  const handleIgpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOgpForIgp) return;
    setOpError(null);

    const item = selectedOgpForIgp.items[0];
    const maxAllowed = item.quantity - item.returnedQuantity;

    if (igpReturnQty > maxAllowed) {
      setOpError(`Return quantity (${igpReturnQty} pcs) exceeds outstanding issued quantity (${maxAllowed} pcs).`);
      return;
    }

    if (igpReturnQty <= 0) {
      setOpError('Return quantity must be greater than zero.');
      return;
    }

    const seq = ds.getIGPs().length + 1;
    const igpNum = `IGP-2026-${String(seq).padStart(4, '0')}`;

    const newIgp: IGPDocument = {
      id: `igp-${Date.now()}`,
      igpNumber: igpNum,
      ogpId: selectedOgpForIgp.id,
      vendorId: selectedOgpForIgp.vendorId,
      returnDate: igpReturnDate,
      items: [
        {
          itemId: item.itemId,
          quantityReturned: igpReturnQty,
          qcStatus: 'pending',
        },
      ],
      totalReturnedQuantity: igpReturnQty,
      receivingLocationId: 'loc-qc-hold',
      status: 'received',
      receivedBy: igpReceiver,
      qrCodePayload: JSON.stringify({ doc: igpNum, ogp: selectedOgpForIgp.ogpNumber, returned: igpReturnQty }),
    };

    const res = engine.receiveIGP(newIgp, igpReceiver);
    if (!res.success) {
      setOpError(res.error || 'Failed to record IGP return.');
      return;
    }

    setOpSuccess(`Successfully recorded ${igpNum} with ${igpReturnQty} pieces moved to QC Holding!`);
    setIsIgpModalOpen(false);
    setTimeout(() => setOpSuccess(null), 3000);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <span>Outsourced Vendor Management (OGP / IGP Gate Passes)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage off-site trimming contractors, issue material via Outward Gate Passes, and receive multi-date partial returns via Inward Gate Passes.
          </p>
        </div>

        <button
          onClick={() => {
            setIsOgpModalOpen(true);
            setOpError(null);
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>Issue Outward Gate Pass (OGP)</span>
        </button>
      </div>

      {opSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{opSuccess}</span>
        </div>
      )}

      {/* Vendor Profile Cards & Capacity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vendors.map((v) => {
          const dailyCapacity = v.workforceCount * v.availableDailyHours * 100; // estimated output capacity
          return (
            <div
              key={v.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">{v.code}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">· {v.name}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Contact: {v.contactPerson} ({v.phone})
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase">OUTSTANDING MATERIAL</span>
                  <span className="text-base font-bold font-mono text-amber-600 dark:text-amber-400">
                    {formatNumber(v.currentOutstandingQty)} pcs
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] flex items-center gap-1">
                    <Users className="w-3 h-3" /> Workforce:
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{v.workforceCount} workers</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Available Daily:
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{v.availableDailyHours} hrs/day</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Est. Capacity:</span>
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                    ~{formatNumber(dailyCapacity)} pcs/day
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* OGPs Active List Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
            Outward Gate Passes (OGPs) &amp; Partial Returns Reconciliation
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {ogps.length} Gate Pass Documents
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="py-2.5 px-4 font-semibold">OGP Number</th>
                <th className="py-2.5 px-3 font-semibold">Issue Date</th>
                <th className="py-2.5 px-3 font-semibold">Vendor</th>
                <th className="py-2.5 px-3 font-semibold">Item</th>
                <th className="py-2.5 px-3 font-semibold text-right">Issued Qty</th>
                <th className="py-2.5 px-3 font-semibold text-right">Returned Qty</th>
                <th className="py-2.5 px-3 font-semibold text-right">Outstanding</th>
                <th className="py-2.5 px-3 font-semibold text-right">Trimming Rate</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {ogps.map((ogp) => {
                const v = getVendor(ogp.vendorId);
                const itemLine = ogp.items[0];
                const item = itemLine ? getItem(itemLine.itemId) : null;
                const outstanding = itemLine ? itemLine.quantity - itemLine.returnedQuantity : 0;

                return (
                  <tr key={ogp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {ogp.ogpNumber}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                      {ogp.issueDate}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {v?.name || ogp.vendorId}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-medium">{item?.itemCode || itemLine?.itemId}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                      {formatNumber(ogp.totalIssuedQuantity)} pcs
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatNumber(itemLine?.returnedQuantity || 0)} pcs
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-bold text-amber-600 dark:text-amber-400">
                      {formatNumber(outstanding)} pcs
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {formatPKR(itemLine?.ratePerPiece || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                        outstanding === 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40' : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40'
                      }`}>
                        {outstanding === 0 ? 'COMPLETED' : 'IN OUTSOURCE'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-1">
                      <button
                        onClick={() => setPrintDoc({ type: 'ogp', data: ogp })}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100"
                        title="Print OGP Gate Pass"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      {outstanding > 0 && (
                        <button
                          onClick={() => openIgpDialog(ogp)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium transition-colors"
                        >
                          Receive IGP
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

      {/* New OGP Modal */}
      {isOgpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Issue Outward Gate Pass (OGP)
            </h3>

            {opError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 rounded text-rose-800 dark:text-rose-300 text-xs">
                {opError}
              </div>
            )}

            <form onSubmit={handleOgpSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Outsourced Vendor</label>
                <select
                  value={ogpVendorId}
                  onChange={(e) => setOgpVendorId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-semibold"
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} - {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={ogpDate}
                    onChange={(e) => setOgpDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Expected Return Date</label>
                  <input
                    type="date"
                    value={expectedReturn}
                    onChange={(e) => setExpectedReturn(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Untrimmed Raw Item</label>
                <select
                  value={ogpItemId}
                  onChange={(e) => setOgpItemId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                >
                  {items.filter((i) => i.category === 'untrimmed_molding').map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.itemCode} - {i.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Quantity to Issue (pcs)</label>
                  <input
                    type="number"
                    min="1"
                    value={ogpQty}
                    onChange={(e) => setOgpQty(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Agreed Rate per Piece (PKR)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={ogpRate}
                    onChange={(e) => setOgpRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Remarks / Carrier Vehicle</label>
                <input
                  type="text"
                  value={ogpRemarks}
                  onChange={(e) => setOgpRemarks(e.target.value)}
                  placeholder="e.g. Carrier Suzuki pickup..."
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOgpModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                >
                  Issue Gate Pass (OGP)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive IGP Modal (Partial returns against OGP) */}
      {isIgpModalOpen && selectedOgpForIgp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Receive Inward Gate Pass (IGP)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Returning material against {selectedOgpForIgp.ogpNumber}
              </p>
            </div>

            {opError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 rounded text-rose-800 dark:text-rose-300 text-xs">
                {opError}
              </div>
            )}

            <form onSubmit={handleIgpSubmit} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Issued Quantity:</span>
                  <span className="font-mono font-bold">{selectedOgpForIgp.totalIssuedQuantity} pcs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Previously Returned:</span>
                  <span className="font-mono font-bold text-emerald-600">{selectedOgpForIgp.items[0]?.returnedQuantity || 0} pcs</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-bold">
                  <span className="text-slate-700 dark:text-slate-300">Outstanding with Vendor:</span>
                  <span className="font-mono text-amber-600">
                    {selectedOgpForIgp.items[0]?.quantity - (selectedOgpForIgp.items[0]?.returnedQuantity || 0)} pcs
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Return Quantity Now (pcs)</label>
                <input
                  type="number"
                  min="1"
                  max={selectedOgpForIgp.items[0]?.quantity - (selectedOgpForIgp.items[0]?.returnedQuantity || 0)}
                  value={igpReturnQty}
                  onChange={(e) => setIgpReturnQty(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold text-slate-900 dark:text-slate-100"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Material will route automatically to QC Holding for inspection.
                </span>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Return Date</label>
                <input
                  type="date"
                  value={igpReturnDate}
                  onChange={(e) => setIgpReturnDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Received By</label>
                <input
                  type="text"
                  value={igpReceiver}
                  onChange={(e) => setIgpReceiver(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsIgpModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium"
                >
                  Accept Return via IGP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Slip */}
      {printDoc && (
        <PrintableDocumentModal
          isOpen={true}
          onClose={() => setPrintDoc(null)}
          documentType={printDoc.type}
          documentData={printDoc.data}
        />
      )}
    </div>
  );
};
