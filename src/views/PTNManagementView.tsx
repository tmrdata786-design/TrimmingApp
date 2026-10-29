/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Plus, Printer, CheckCircle, Clock, Trash2, ShieldCheck } from 'lucide-react';
import { DataService } from '../services/storage';
import { InventoryEngine } from '../services/inventoryEngine';
import { PTNDocument, PTNItem, Location, Item } from '../types';
import { PrintableDocumentModal } from '../components/PrintableDocumentModal';

export const PTNManagementView: React.FC = () => {
  const ds = DataService.getInstance();
  const engine = new InventoryEngine();

  const [ptns, setPtns] = useState<PTNDocument[]>(ds.getPTNs());
  const [locations, setLocations] = useState<Location[]>(ds.getLocations());
  const [items, setItems] = useState<Item[]>(ds.getItems());
  const [selectedPtnForPrint, setSelectedPtnForPrint] = useState<PTNDocument | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New PTN form
  const [sourceLoc, setSourceLoc] = useState('loc-raw-store');
  const [destLoc, setDestLoc] = useState('loc-ws-bay');
  const [ptnDate, setPtnDate] = useState(new Date().toISOString().slice(0, 10));
  const [preparedBy, setPreparedBy] = useState('Store Operator');
  const [remarks, setRemarks] = useState('');
  const [ptnItems, setPtnItems] = useState<PTNItem[]>([
    { itemId: items[0]?.id || 'item-mld-001', quantity: 200, stageName: 'Trimming Transfer', reason: 'Routine issuance' },
  ]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    return ds.subscribe(() => {
      setPtns(ds.getPTNs());
      setLocations(ds.getLocations());
      setItems(ds.getItems());
    });
  }, [ds]);

  const handleAddItemRow = () => {
    setPtnItems([
      ...ptnItems,
      { itemId: items[0]?.id || 'item-mld-001', quantity: 100, stageName: 'Floor Movement', reason: 'Batch balance' },
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (ptnItems.length === 1) return;
    setPtnItems(ptnItems.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: keyof PTNItem, val: any) => {
    const updated = [...ptnItems];
    updated[idx] = { ...updated[idx], [field]: val };
    setPtnItems(updated);
  };

  const handleSubmitPTN = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const seq = ds.getPTNs().length + 1;
    const ptnNum = `PTN-2026-${String(seq).padStart(4, '0')}`;

    const newPTN: PTNDocument = {
      id: `ptn-${Date.now()}`,
      ptnNumber: ptnNum,
      date: ptnDate,
      sourceLocationId: sourceLoc,
      destinationLocationId: destLoc,
      items: ptnItems,
      status: 'pending_approval',
      preparedBy,
      remarks,
      qrCodePayload: JSON.stringify({ doc: ptnNum, date: ptnDate, from: sourceLoc, to: destLoc, items: ptnItems.length }),
      createdAt: new Date().toISOString(),
    };

    const res = engine.postPTN(newPTN, preparedBy);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to post PTN.');
      return;
    }

    setSuccessMsg(`Successfully created and executed ${ptnNum}!`);
    setIsCreateOpen(false);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const getLocationName = (id: string) => {
    const l = locations.find((loc) => loc.id === id);
    return l ? `${l.code} - ${l.name}` : id;
  };

  const getItem = (id: string) => items.find((i) => i.id === id);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-blue-600" />
            <span>Production Transfer Notes (PTNs)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Every internal material movement requires an authorized, sequential PTN.
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
          <span>New Transfer Note (PTN)</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* PTNs Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="py-2.5 px-4 font-semibold">PTN Number</th>
                <th className="py-2.5 px-3 font-semibold">Date</th>
                <th className="py-2.5 px-3 font-semibold">Source Location</th>
                <th className="py-2.5 px-3 font-semibold">Destination Location</th>
                <th className="py-2.5 px-3 font-semibold">Lines</th>
                <th className="py-2.5 px-3 font-semibold text-right">Total Quantity</th>
                <th className="py-2.5 px-3 font-semibold">Prepared By</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                <th className="py-2.5 px-4 font-semibold text-right">Print Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {ptns.map((ptn) => {
                const totalQty = ptn.items.reduce((acc, i) => acc + i.quantity, 0);

                return (
                  <tr key={ptn.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {ptn.ptnNumber}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                      {ptn.date}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                      {getLocationName(ptn.sourceLocationId)}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-blue-600 dark:text-blue-400">
                      {getLocationName(ptn.destinationLocationId)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {ptn.items.length} item{ptn.items.length > 1 ? 's' : ''}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {totalQty.toLocaleString()} pcs
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {ptn.preparedBy}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded uppercase font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        {ptn.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedPtnForPrint(ptn)}
                        className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                        title="Print PTN Slip with QR Code"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create PTN Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-2xl w-full p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Create Production Transfer Note (PTN)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Authoritative internal stock transfer document</p>
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

            <form onSubmit={handleSubmitPTN} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Date</label>
                  <input
                    type="date"
                    value={ptnDate}
                    onChange={(e) => setPtnDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Source Location</label>
                  <select
                    value={sourceLoc}
                    onChange={(e) => setSourceLoc(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} - {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Destination Location</label>
                  <select
                    value={destLoc}
                    onChange={(e) => setDestLoc(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-semibold text-blue-600"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} - {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Line Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Material Items to Transfer</span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Item Line</span>
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-[11px]">
                      <tr>
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3 w-28">Quantity</th>
                        <th className="py-2 px-3">Transfer Reason</th>
                        <th className="py-2 px-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {ptnItems.map((line, idx) => (
                        <tr key={idx}>
                          <td className="p-2">
                            <select
                              value={line.itemId}
                              onChange={(e) => handleItemChange(idx, 'itemId', e.target.value)}
                              className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded font-medium"
                            >
                              {items.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.itemCode} - {i.description}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold"
                              required
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={line.reason || ''}
                              onChange={(e) => handleItemChange(idx, 'reason', e.target.value)}
                              placeholder="Reason..."
                              className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded"
                            />
                          </td>
                          <td className="p-2 text-center">
                            {ptnItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                className="text-rose-500 hover:text-rose-700 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Prepared By User</label>
                  <input
                    type="text"
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Remarks</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Floor notes..."
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  />
                </div>
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
                  Post Production Transfer Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable PTN Slip Modal */}
      {selectedPtnForPrint && (
        <PrintableDocumentModal
          isOpen={true}
          onClose={() => setSelectedPtnForPrint(null)}
          documentType="ptn"
          documentData={selectedPtnForPrint}
        />
      )}
    </div>
  );
};
