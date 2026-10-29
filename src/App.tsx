/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { QRScannerModal } from './components/QRScannerModal';
import { DashboardView } from './views/DashboardView';
import { WorkstationsFleetView } from './views/WorkstationsFleetView';
import { PlanningView } from './views/PlanningView';
import { InternalWorkOrdersView } from './views/InternalWorkOrdersView';
import { PTNManagementView } from './views/PTNManagementView';
import { StockLedgerView } from './views/StockLedgerView';
import { OutsourcedVendorView } from './views/OutsourcedVendorView';
import { QCManagementView } from './views/QCManagementView';
import { ReworkManagementView } from './views/ReworkManagementView';
import { VendorSettlementView } from './views/VendorSettlementView';
import { EmployeeCostingView } from './views/EmployeeCostingView';
import { ProductCostingView } from './views/ProductCostingView';
import { StocktakingView } from './views/StocktakingView';
import { ReportsCenterView } from './views/ReportsCenterView';
import { AutomatedTestsView } from './views/AutomatedTestsView';
import { MasterDataView } from './views/MasterDataView';
import { UserRole } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [activeRole, setActiveRole] = useState<UserRole>('admin');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');

  const tabTitles: Record<ActiveTab, string> = {
    dashboard: 'Operations Command Center',
    workstations: '70 Workstations Fleet Matrix',
    planning: 'Production Planning & Scheduling',
    work_orders: 'Internal Shift Work Orders',
    ptn: 'Production Transfer Notes (PTN)',
    inventory: 'Stock Balances & Ledger',
    outsourced_vendors: 'Outsourced Vendors & Gate Passes',
    qc: 'Quality Control & Defect Isolation',
    rework: 'Closed-Loop Multi-Cycle Rework',
    vendor_settlement: 'Vendor Piece-Rate Settlement (PKR)',
    employee_costing: 'Employee Labour Cost Absorption',
    product_costing: 'Product Unit Cost Breakdown',
    stocktaking: 'Monthly Physical Stocktaking',
    reports: '25 Production & Cost Reports',
    automated_tests: 'Automated Test Suite (Scenarios A-I)',
    master_data: 'Master Data & Configurations',
  };

  const handleNavigateToDoc = (type: string, id: string) => {
    if (type === 'ptn') setActiveTab('ptn');
    else if (type === 'ogp' || type === 'igp') setActiveTab('outsourced_vendors');
    else if (type === 'wo') setActiveTab('work_orders');
    else if (type === 'ws') setActiveTab('workstations');
    else if (type === 'item') setActiveTab('inventory');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        onOpenScanner={() => setIsScannerOpen(true)}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <TopBar
          currentTabName={tabTitles[activeTab]}
          activeRole={activeRole}
          onOpenScanner={() => setIsScannerOpen(true)}
          onSearch={setGlobalSearchTerm}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
          {activeTab === 'dashboard' && (
            <DashboardView
              onNavigate={setActiveTab}
              onOpenScanner={() => setIsScannerOpen(true)}
            />
          )}

          {activeTab === 'workstations' && (
            <WorkstationsFleetView
              onOpenWorkOrder={(wsCode) => setActiveTab('work_orders')}
            />
          )}

          {activeTab === 'planning' && (
            <PlanningView
              onPlanCreated={() => setActiveTab('work_orders')}
            />
          )}

          {activeTab === 'work_orders' && <InternalWorkOrdersView />}

          {activeTab === 'ptn' && <PTNManagementView />}

          {activeTab === 'inventory' && <StockLedgerView />}

          {activeTab === 'outsourced_vendors' && <OutsourcedVendorView />}

          {activeTab === 'qc' && <QCManagementView />}

          {activeTab === 'rework' && <ReworkManagementView />}

          {activeTab === 'vendor_settlement' && <VendorSettlementView />}

          {activeTab === 'employee_costing' && <EmployeeCostingView />}

          {activeTab === 'product_costing' && <ProductCostingView />}

          {activeTab === 'stocktaking' && <StocktakingView />}

          {activeTab === 'reports' && <ReportsCenterView />}

          {activeTab === 'automated_tests' && <AutomatedTestsView />}

          {activeTab === 'master_data' && <MasterDataView />}
        </main>
      </div>

      {/* Barcode & QR Code Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onNavigateToDocument={handleNavigateToDoc}
      />
    </div>
  );
}
