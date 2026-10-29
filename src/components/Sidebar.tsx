/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  Cpu,
  CalendarDays,
  ClipboardList,
  ArrowLeftRight,
  Boxes,
  Truck,
  CheckCircle2,
  RotateCcw,
  Receipt,
  Users,
  Coins,
  FileCheck2,
  BarChart3,
  FlaskConical,
  Database,
  QrCode,
  ShieldAlert,
} from 'lucide-react';
import { UserRole } from '../types';

export type ActiveTab =
  | 'dashboard'
  | 'workstations'
  | 'planning'
  | 'work_orders'
  | 'ptn'
  | 'inventory'
  | 'outsourced_vendors'
  | 'qc'
  | 'rework'
  | 'vendor_settlement'
  | 'employee_costing'
  | 'product_costing'
  | 'stocktaking'
  | 'reports'
  | 'automated_tests'
  | 'master_data';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  activeRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onOpenScanner: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  activeRole,
  onRoleChange,
  onOpenScanner,
}) => {
  const navSections = [
    {
      title: 'Operations & Floor',
      items: [
        { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
        { id: 'workstations', label: '70 Workstations Fleet', icon: Cpu, badge: '70 Stations' },
        { id: 'planning', label: 'Production Planning', icon: CalendarDays },
        { id: 'work_orders', label: 'Shift Work Orders', icon: ClipboardList },
      ],
    },
    {
      title: 'Material Movements',
      items: [
        { id: 'ptn', label: 'Transfer Notes (PTN)', icon: ArrowLeftRight },
        { id: 'inventory', label: 'Stock Ledger & Balances', icon: Boxes },
        { id: 'outsourced_vendors', label: 'Outsourced (OGP / IGP)', icon: Truck },
      ],
    },
    {
      title: 'Quality & Rework',
      items: [
        { id: 'qc', label: 'QC Inspections', icon: CheckCircle2 },
        { id: 'rework', label: 'Closed-Loop Rework', icon: RotateCcw },
      ],
    },
    {
      title: 'Costing & Settlement',
      items: [
        { id: 'vendor_settlement', label: 'Vendor Ledgers (PKR)', icon: Receipt },
        { id: 'employee_costing', label: 'Employee Labour Cost', icon: Users },
        { id: 'product_costing', label: 'Product Unit Costing', icon: Coins },
      ],
    },
    {
      title: 'Audit & Analytics',
      items: [
        { id: 'stocktaking', label: 'Monthly Stocktaking', icon: FileCheck2 },
        { id: 'reports', label: '25 Production Reports', icon: BarChart3 },
        { id: 'automated_tests', label: 'Automated Test Suite', icon: FlaskConical },
        { id: 'master_data', label: 'Master Data & Settings', icon: Database },
      ],
    },
  ];

  const roles: { id: UserRole; label: string }[] = [
    { id: 'admin', label: 'System Admin' },
    { id: 'store_operator', label: 'Store Operator' },
    { id: 'production_planner', label: 'Production Planner' },
    { id: 'production_supervisor', label: 'Shift Supervisor' },
    { id: 'qc_inspector', label: 'QC Inspector' },
    { id: 'accounts_user', label: 'Accounts & Costing' },
    { id: 'manager_approver', label: 'Plant Manager' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col h-screen shrink-0 border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center font-bold text-white text-sm">
              TP
            </div>
            <h1 className="font-bold text-white tracking-tight text-sm">TRIMMING OPERATIONS</h1>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
            <span>Plastic Moulding</span>
            <span aria-hidden="true">·</span>
            <span>ERP &amp; QC</span>
          </div>
        </div>
      </div>

      {/* Role Switcher */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-800">
        <label className="block text-[11px] font-medium text-slate-400 mb-1">
          OPERATIONAL ROLE
        </label>
        <select
          value={activeRole}
          onChange={(e) => onRoleChange(e.target.value as UserRole)}
          className="w-full bg-slate-800 text-white border border-slate-700 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Quick QR Scanner Action */}
      <div className="p-3 border-b border-slate-800">
        <button
          onClick={onOpenScanner}
          className="w-full flex items-center justify-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-3 py-2 rounded text-xs font-medium transition-colors"
        >
          <QrCode className="w-4 h-4" />
          <span>Scan Floor Barcode / QR</span>
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {navSections.map((section) => (
          <div key={section.title}>
            <div className="px-2 text-[10px] font-semibold text-slate-500 tracking-wider uppercase mb-1">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id as ActiveTab)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white font-medium shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[10px] tabular-nums font-mono px-1.5 py-0.2 rounded ${
                        isActive ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Status Footer */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Online (LAN / Cloud)</span>
        </div>
        <span className="font-mono text-[10px] text-slate-500">PKR Mode</span>
      </div>
    </aside>
  );
};
