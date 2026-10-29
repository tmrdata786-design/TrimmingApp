/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Users, Calculator, ShieldAlert, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { DataService } from '../services/storage';
import { formatPKR, formatNumber } from '../services/inventoryEngine';
import { Worker, WorkOrder } from '../types';

export const EmployeeCostingView: React.FC = () => {
  const ds = DataService.getInstance();

  const [employees, setEmployees] = useState<Worker[]>(
    ds.getWorkers().filter((w) => w.type === 'employee')
  );
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(ds.getWorkOrders());

  const [allocationMethod, setAllocationMethod] = useState<'hour_based' | 'production_based' | 'hybrid'>('hybrid');
  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  const [editingEmployee, setEditingEmployee] = useState<Worker | null>(null);
  const [editSalary, setEditSalary] = useState<number>(40000);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    return ds.subscribe(() => {
      setEmployees(ds.getWorkers().filter((w) => w.type === 'employee'));
      setWorkOrders(ds.getWorkOrders());
    });
  }, [ds]);

  // Standard month working baseline: 26 working days * 7.5 hrs = 195 hrs
  const standardMonthlyHours = 195;

  const handleUpdateSalary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    editingEmployee.monthlySalary = editSalary;
    ds.updateWorker(editingEmployee);
    ds.logAudit(
      'Cost Accountant',
      'accounts_user',
      'UPDATE_EMPLOYEE_SALARY',
      'Worker',
      editingEmployee.code,
      `Updated monthly salary parameter to ${formatPKR(editSalary)} for cost absorption`
    );

    setSuccessMsg(`Updated salary parameter for ${editingEmployee.name} to ${formatPKR(editSalary)}.`);
    setEditingEmployee(null);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Employee Labour Cost Allocation Engine (PKR)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict isolation: Configures salary solely for product costing absorption. Never generates employee payment liability transactions.
          </p>
        </div>

        {/* Method selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Absorption Method:</span>
          <select
            value={allocationMethod}
            onChange={(e) => setAllocationMethod(e.target.value as any)}
            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-semibold text-blue-600 focus:outline-none"
          >
            <option value="hybrid">Hybrid (Productive + Downtime Separation)</option>
            <option value="hour_based">Hour-Based Standard Run Time</option>
            <option value="production_based">Volume Output Proportional</option>
          </select>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Policy Guarantee Banner */}
      <div className="p-4 bg-slate-900 text-white rounded-lg border border-slate-800 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs">
          <div className="font-semibold text-blue-400">
            SYSTEM BOUNDARY: EMPLOYEE SALARY DISBURSEMENT OUTSIDE APP SCOPE
          </div>
          <div className="text-slate-300 mt-0.5 leading-relaxed">
            As mandated by manufacturing governance, actual monthly payroll is handled by corporate HR/payroll systems.
            The figures recorded below represent cost absorption rates required to accurately evaluate total per-unit finished manufacturing cost.
          </div>
        </div>
      </div>

      {/* Employees Labour Cost Allocation Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
            Salaried Trimming Employees &amp; Overhead Absorption ({selectedMonth})
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {employees.length} Active Floor Employees
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Employee</th>
                <th className="py-2.5 px-3 font-semibold text-right">Monthly Cost Base (PKR)</th>
                <th className="py-2.5 px-3 font-semibold text-right">Standard Hourly Rate</th>
                <th className="py-2.5 px-3 font-semibold text-right">Shift Hours Worked</th>
                <th className="py-2.5 px-3 font-semibold text-right">Downtime / Idle Cost</th>
                <th className="py-2.5 px-3 font-semibold text-right">Productive Labour Cost</th>
                <th className="py-2.5 px-3 font-semibold text-right">Output Trimmed</th>
                <th className="py-2.5 px-3 font-semibold text-right">Labour Cost / Piece</th>
                <th className="py-2.5 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {employees.map((emp) => {
                const salary = emp.monthlySalary || 40000;
                const hourlyRate = salary / standardMonthlyHours;

                // Find work orders for this employee
                const empWos = workOrders.filter((w) => w.assignedWorkerId === emp.id);
                const totalOutput = empWos.reduce((acc, w) => acc + w.actualTrimmedQuantity, 0);
                const totalDowntimeMins = empWos.reduce((acc, w) => acc + w.downtimeMinutes, 0);
                const downtimeHours = totalDowntimeMins / 60;
                const shiftHoursLogged = empWos.length > 0 ? empWos.length * 7.5 : 7.5;
                const productiveHours = Math.max(0, shiftHoursLogged - downtimeHours);

                const downtimeCost = downtimeHours * hourlyRate;
                const productiveCost = productiveHours * hourlyRate;
                const costPerPiece = totalOutput > 0 ? productiveCost / totalOutput : hourlyRate / 120;

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{emp.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{emp.code} · Assigned: {emp.assignedWorkstationId || 'WS-16'}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-bold text-slate-900 dark:text-slate-100">
                      {formatPKR(salary)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-600 dark:text-slate-400">
                      {formatPKR(hourlyRate)}/hr
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {shiftHoursLogged.toFixed(1)} hrs
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums text-rose-600 dark:text-rose-400 font-medium">
                      {formatPKR(downtimeCost)} ({totalDowntimeMins}m)
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-bold text-blue-600 dark:text-blue-400">
                      {formatPKR(productiveCost)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-bold text-slate-800 dark:text-slate-200">
                      {formatNumber(totalOutput > 0 ? totalOutput : 350)} pcs
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                      {formatPKR(costPerPiece)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setEditingEmployee(emp);
                          setEditSalary(emp.monthlySalary || 40000);
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-[11px] font-medium"
                      >
                        Adjust Salary
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Salary Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Adjust Monthly Costing Base: {editingEmployee.name}
            </h3>

            <form onSubmit={handleUpdateSalary} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Monthly Salary Figure (PKR)</label>
                <input
                  type="number"
                  min="1000"
                  step="500"
                  value={editSalary}
                  onChange={(e) => setEditSalary(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold text-slate-900 dark:text-slate-100"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Used strictly for product cost absorption per hour.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                >
                  Save Salary Parameter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
