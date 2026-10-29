/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Cpu, Plus, Filter, Edit2, Play, AlertCircle, Wrench, CheckCircle } from 'lucide-react';
import { Workstation, Worker } from '../types';
import { DataService } from '../services/storage';

interface WorkstationsFleetViewProps {
  onOpenWorkOrder?: (wsCode: string) => void;
}

export const WorkstationsFleetView: React.FC<WorkstationsFleetViewProps> = ({ onOpenWorkOrder }) => {
  const ds = DataService.getInstance();
  const [workstations, setWorkstations] = useState<Workstation[]>(ds.getWorkstations());
  const [workers, setWorkers] = useState<Worker[]>(ds.getWorkers());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedWs, setSelectedWs] = useState<Workstation | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New workstation form
  const [newCode, setNewCode] = useState(`WS-${String(workstations.length + 1).padStart(2, '0')}`);
  const [newName, setNewName] = useState(`Trimming Bench ${String(workstations.length + 1).padStart(2, '0')}`);
  const [newStatus, setNewStatus] = useState<Workstation['status']>('idle');

  useEffect(() => {
    return ds.subscribe(() => {
      setWorkstations(ds.getWorkstations());
      setWorkers(ds.getWorkers());
    });
  }, [ds]);

  const filtered = workstations.filter((w) => {
    if (filterStatus !== 'all' && w.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return w.code.toLowerCase().includes(q) || w.name.toLowerCase().includes(q) || (w.currentWorkerId && w.currentWorkerId.toLowerCase().includes(q));
    }
    return true;
  });

  const getWorker = (id?: string) => workers.find((w) => w.id === id);

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWs) return;
    ds.updateWorkstation(selectedWs);
    setIsEditModalOpen(false);
  };

  const handleAddWorkstation = (e: React.FormEvent) => {
    e.preventDefault();
    const created: Workstation = {
      id: `ws-${Date.now()}`,
      code: newCode.toUpperCase(),
      name: newName,
      status: newStatus,
      capacityMultiplier: 1.0,
    };
    ds.updateWorkstation(created);
    setIsAddModalOpen(false);
    setNewCode(`WS-${String(workstations.length + 2).padStart(2, '0')}`);
    setNewName(`Trimming Bench ${String(workstations.length + 2).padStart(2, '0')}`);
  };

  const activeCount = workstations.filter((w) => w.status === 'active').length;
  const idleCount = workstations.filter((w) => w.status === 'idle').length;
  const maintCount = workstations.filter((w) => w.status === 'maintenance').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            <span>Workstation Fleet Management (WS-01 to WS-70)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full floor matrix of all 70 dedicated manual and motorized plastic trimming stations
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Workstation</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Filter buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded transition-colors ${
              filterStatus === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            All Stations ({workstations.length})
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 rounded transition-colors ${
              filterStatus === 'active'
                ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setFilterStatus('idle')}
            className={`px-3 py-1.5 rounded transition-colors ${
              filterStatus === 'idle'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Idle ({idleCount})
          </button>
          <button
            onClick={() => setFilterStatus('maintenance')}
            className={`px-3 py-1.5 rounded transition-colors ${
              filterStatus === 'maintenance'
                ? 'bg-amber-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Maintenance ({maintCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code or station..."
            className="w-full md:w-64 pl-3 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 70 Workstations Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
        {filtered.map((ws) => {
          const worker = getWorker(ws.currentWorkerId);

          let statusBadge = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
          let borderStyle = 'border-slate-200 dark:border-slate-800';

          if (ws.status === 'active') {
            statusBadge = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900';
            borderStyle = 'border-emerald-200 dark:border-emerald-800/60 shadow-xs';
          } else if (ws.status === 'maintenance') {
            statusBadge = 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900';
            borderStyle = 'border-amber-300 dark:border-amber-800';
          }

          return (
            <div
              key={ws.id}
              className={`bg-white dark:bg-slate-900 border ${borderStyle} rounded-lg p-3 flex flex-col justify-between hover:shadow-md transition-shadow relative group`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                    {ws.code}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold ${statusBadge}`}>
                    {ws.status}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 truncate mt-1">
                  {ws.name}
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  <span className="text-slate-400 block text-[10px]">OPERATOR:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                    {worker ? worker.name : '— Unassigned —'}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1">
                <button
                  onClick={() => {
                    setSelectedWs(ws);
                    setIsEditModalOpen(true);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Configure Workstation"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                {onOpenWorkOrder && ws.status === 'active' && (
                  <button
                    onClick={() => onOpenWorkOrder(ws.code)}
                    className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Play className="w-3 h-3" />
                    <span>Job Order</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Workstation Modal */}
      {isEditModalOpen && selectedWs && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Configure Workstation: {selectedWs.code}
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Workstation Name / Description</label>
                <input
                  type="text"
                  value={selectedWs.name}
                  onChange={(e) => setSelectedWs({ ...selectedWs, name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Floor Status</label>
                <select
                  value={selectedWs.status}
                  onChange={(e) => setSelectedWs({ ...selectedWs, status: e.target.value as any })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                >
                  <option value="active">Active (Operational)</option>
                  <option value="idle">Idle (Unmanned)</option>
                  <option value="maintenance">Maintenance / Tool Repair</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Assigned In-House Vendor / Employee</label>
                <select
                  value={selectedWs.currentWorkerId || ''}
                  onChange={(e) => setSelectedWs({ ...selectedWs, currentWorkerId: e.target.value || undefined })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                >
                  <option value="">— Unassigned —</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} - {w.name} ({w.type === 'in_house_vendor' ? 'Piece-Rate Vendor' : 'Salaried Employee'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Capacity Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="3.0"
                  value={selectedWs.capacityMultiplier}
                  onChange={(e) => setSelectedWs({ ...selectedWs, capacityMultiplier: parseFloat(e.target.value) || 1.0 })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">1.0 = standard speed; 1.2 = high-speed motorized cutter.</span>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Workstation Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Add New Trimming Workstation
            </h3>

            <form onSubmit={handleAddWorkstation} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Station Code (e.g. WS-71)</label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 uppercase font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Workstation Description</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Initial Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                >
                  <option value="idle">Idle</option>
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                >
                  Add Workstation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
