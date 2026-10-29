/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Database, Plus, Edit2, Layers, MapPin, Clock, Users, CheckCircle, Info } from 'lucide-react';
import { DataService } from '../services/storage';
import { formatPKR, formatNumber } from '../services/inventoryEngine';
import { Item, Location, Shift, Worker } from '../types';

export const MasterDataView: React.FC = () => {
  const ds = DataService.getInstance();

  const [items, setItems] = useState<Item[]>(ds.getItems());
  const [locations, setLocations] = useState<Location[]>(ds.getLocations());
  const [shifts, setShifts] = useState<Shift[]>(ds.getShifts());
  const [workers, setWorkers] = useState<Worker[]>(ds.getWorkers());

  const [activeTab, setActiveTab] = useState<'items' | 'locations' | 'shifts' | 'workers'>('items');
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // New Item Form State
  const [itemCode, setItemCode] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Item['category']>('untrimmed_molding');
  const [unitOfMeasure, setUnitOfMeasure] = useState('pcs');
  const [baselineCost, setBaselineCost] = useState(35.0);
  const [expectedPph, setExpectedPph] = useState(120);
  const [defaultRate, setDefaultRate] = useState(2.5);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    return ds.subscribe(() => {
      setItems(ds.getItems());
      setLocations(ds.getLocations());
      setShifts(ds.getShifts());
      setWorkers(ds.getWorkers());
    });
  }, [ds]);

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingItem) {
      const updated: Item = {
        ...editingItem,
        itemCode,
        description,
        category,
        unitOfMeasure,
        baselineManufacturingCost: baselineCost,
        expectedCapacityPph: expectedPph,
        defaultTrimmingRate: defaultRate,
      };
      ds.updateItem(updated);
      setSuccessMsg(`Updated item ${itemCode} successfully!`);
    } else {
      const newItem: Item = {
        id: `item-${Date.now()}`,
        itemCode: itemCode.toUpperCase(),
        description,
        category,
        unitOfMeasure,
        baselineManufacturingCost: baselineCost,
        expectedCapacityPph: expectedPph,
        defaultTrimmingRate: defaultRate,
        qcRequired: true,
        reworkRule: 'supervisor_decision',
        isActive: true,
      };
      ds.addItem(newItem);
      setSuccessMsg(`Added new item ${newItem.itemCode} successfully!`);
    }

    setIsItemModalOpen(false);
    setEditingItem(null);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const openEditItem = (item: Item) => {
    setEditingItem(item);
    setItemCode(item.itemCode);
    setDescription(item.description);
    setCategory(item.category);
    setUnitOfMeasure(item.unitOfMeasure);
    setBaselineCost(item.baselineManufacturingCost);
    setExpectedPph(item.expectedCapacityPph);
    setDefaultRate(item.defaultTrimmingRate);
    setIsItemModalOpen(true);
  };

  const openNewItem = () => {
    setEditingItem(null);
    setItemCode('');
    setDescription('');
    setCategory('untrimmed_molding');
    setUnitOfMeasure('pcs');
    setBaselineCost(35.0);
    setExpectedPph(120);
    setDefaultRate(2.5);
    setIsItemModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            <span>Master Data Management &amp; Plant Configuration</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Maintain item codes, separate untrimmed (MLD-xxx) and trimmed (TRM-xxx) stages, capacity PPH vs piece rates, racks, and shifts.
          </p>
        </div>

        {activeTab === 'items' && (
          <button
            onClick={openNewItem}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item Master</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium w-fit">
        <button
          onClick={() => setActiveTab('items')}
          className={`px-3.5 py-1.5 rounded transition-colors ${
            activeTab === 'items'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Items Master ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('locations')}
          className={`px-3.5 py-1.5 rounded transition-colors ${
            activeTab === 'locations'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Racks &amp; Locations ({locations.length})
        </button>
        <button
          onClick={() => setActiveTab('shifts')}
          className={`px-3.5 py-1.5 rounded transition-colors ${
            activeTab === 'shifts'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Working Shifts ({shifts.length})
        </button>
        <button
          onClick={() => setActiveTab('workers')}
          className={`px-3.5 py-1.5 rounded transition-colors ${
            activeTab === 'workers'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Workers &amp; Vendors ({workers.length})
        </button>
      </div>

      {/* Items Master Table */}
      {activeTab === 'items' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Item Code</th>
                  <th className="py-2.5 px-3 font-semibold">Description</th>
                  <th className="py-2.5 px-3 font-semibold">Stage Category</th>
                  <th className="py-2.5 px-3 font-semibold">UOM</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Baseline Cost (PKR)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Capacity (PPH)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Trimming Rate (PKR)</th>
                  <th className="py-2.5 px-3 font-semibold text-center">QC Required</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {it.itemCode}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {it.description}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                        it.category === 'untrimmed_molding'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      }`}>
                        {it.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono uppercase text-slate-500">{it.unitOfMeasure}</td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                      {formatPKR(it.baselineManufacturingCost)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums text-blue-600 dark:text-blue-400 font-bold">
                      {it.expectedCapacityPph} pcs/hr
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                      {formatPKR(it.defaultTrimmingRate)}/pc
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[10px] text-emerald-600 font-bold">YES</span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => openEditItem(it)}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100"
                        title="Edit Item Master"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Locations & Racks Table */}
      {activeTab === 'locations' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Location Code</th>
                  <th className="py-2.5 px-3 font-semibold">Name / Area</th>
                  <th className="py-2.5 px-3 font-semibold">Location Type</th>
                  <th className="py-2.5 px-3 font-semibold">Rack / Shelf</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Active Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {locations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {loc.code}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {loc.name}
                    </td>
                    <td className="py-2.5 px-3 uppercase text-[10px] font-mono text-slate-500">
                      {loc.type.replace('_', ' ')}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {loc.rackNumber ? `Rack ${loc.rackNumber} ${loc.shelfNumber ? `/ Shelf ${loc.shelfNumber}` : ''}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded uppercase font-semibold bg-emerald-50 text-emerald-700">
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shifts Table */}
      {activeTab === 'shifts' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Shift Name</th>
                  <th className="py-2.5 px-3 font-semibold">Start Time</th>
                  <th className="py-2.5 px-3 font-semibold">End Time</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Break Duration</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Net Working Hours</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Overnight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {shifts.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                      {s.name}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{s.startTime}</td>
                    <td className="py-2.5 px-3 font-mono">{s.endTime}</td>
                    <td className="py-2.5 px-3 font-mono text-right text-slate-500">{s.breakDurationMinutes} mins</td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-bold text-blue-600 dark:text-blue-400">
                      {s.netWorkingHours} hrs
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {s.isOvernight ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold uppercase">
                          YES (Crosses 00:00)
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">NO</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Workers Table */}
      {activeTab === 'workers' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Worker Code</th>
                  <th className="py-2.5 px-3 font-semibold">Name</th>
                  <th className="py-2.5 px-3 font-semibold">Contract Category</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Compensation Parameter</th>
                  <th className="py-2.5 px-3 font-semibold">Assigned Station</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {workers.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {w.code}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {w.name}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                        w.type === 'in_house_vendor'
                          ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400'
                          : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                      }`}>
                        {w.type === 'in_house_vendor' ? 'In-House Piece Vendor' : 'Salaried Employee'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-semibold">
                      {w.type === 'in_house_vendor' ? (
                        <span className="text-emerald-600">{formatPKR(w.defaultPieceRate || 2.5)} / piece</span>
                      ) : (
                        <span className="text-blue-600">{formatPKR(w.monthlySalary || 40000)} / month (costing base)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                      {w.assignedWorkstationId ? w.assignedWorkstationId.toUpperCase() : 'Floating'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Item Master Add/Edit Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              {editingItem ? `Edit Item Master: ${editingItem.itemCode}` : 'Create New Item Master'}
            </h3>

            <form onSubmit={handleSaveItem} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Unique Item Code (e.g. MLD-004 or TRM-004)</label>
                <input
                  type="text"
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-mono font-bold uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Item Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Production Stage</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  >
                    <option value="untrimmed_molding">Untrimmed Raw Moulding (MLD)</option>
                    <option value="trimmed_finished">Trimmed Finished Good (TRM)</option>
                    <option value="intermediate">Intermediate Stage</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Unit of Measure (UOM)</label>
                  <input
                    type="text"
                    value={unitOfMeasure}
                    onChange={(e) => setUnitOfMeasure(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-mono uppercase"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Baseline Cost (PKR)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={baselineCost}
                    onChange={(e) => setBaselineCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Capacity (PPH)</label>
                  <input
                    type="number"
                    min="1"
                    value={expectedPph}
                    onChange={(e) => setExpectedPph(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Trimming Rate</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={defaultRate}
                    onChange={(e) => setDefaultRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                >
                  Save Item Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
