/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Item,
  Location,
  StockBalance,
  InventoryTransaction,
  PTNDocument,
  Workstation,
  Shift,
  Worker,
  OutsourcedVendor,
  WorkOrder,
  OGPDocument,
  IGPDocument,
  QCInspection,
  ReworkOrder,
  VendorEarning,
  VendorPayment,
  EmployeeLabourAllocation,
  ProductUnitCost,
  StocktakingSession,
  AuditEvent,
  UserProfile,
} from '../types';

const STORAGE_PREFIX = 'trimming_erp_';

function getStored<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage write error for', key, e);
  }
}

// 70 Workstations generator
function generate70Workstations(): Workstation[] {
  const list: Workstation[] = [];
  for (let i = 1; i <= 70; i++) {
    const code = `WS-${String(i).padStart(2, '0')}`;
    let status: Workstation['status'] = 'idle';
    let workerId: string | undefined = undefined;

    if (i <= 5) {
      status = 'active';
      workerId = 'w-ih-01';
    } else if (i <= 10) {
      status = 'active';
      workerId = 'w-ih-02';
    } else if (i <= 15) {
      status = 'active';
      workerId = 'w-ih-03';
    } else if (i === 16) {
      status = 'active';
      workerId = 'w-emp-01';
    } else if (i === 17) {
      status = 'active';
      workerId = 'w-emp-02';
    } else if (i === 18) {
      status = 'active';
      workerId = 'w-emp-03';
    } else if (i === 25 || i === 42) {
      status = 'maintenance';
    }

    list.push({
      id: `ws-${i}`,
      code,
      name: `Trimming Bench ${String(i).padStart(2, '0')}`,
      status,
      capacityMultiplier: 1.0,
      currentWorkerId: workerId,
    });
  }
  return list;
}

// Default Seed Data
const DEFAULT_ITEMS: Item[] = [
  {
    id: 'item-mld-001',
    itemCode: 'MLD-001',
    description: 'Plastic Housing A - Untrimmed Moulding',
    unitOfMeasure: 'pcs',
    category: 'untrimmed_molding',
    baselineManufacturingCost: 45.0, // PKR
    expectedCapacityPph: 120, // 120 pieces per hour
    defaultTrimmingRate: 2.5, // Rs. 2.50 per piece
    qcRequired: true,
    reworkRule: 'supervisor_decision',
    isActive: true,
    barcode: 'MLD001982',
  },
  {
    id: 'item-trm-001',
    itemCode: 'TRM-001',
    description: 'Plastic Housing A - Trimmed & De-burred Component',
    unitOfMeasure: 'pcs',
    category: 'trimmed_finished',
    parentItemId: 'item-mld-001',
    baselineManufacturingCost: 45.0,
    expectedCapacityPph: 120,
    defaultTrimmingRate: 2.5,
    qcRequired: true,
    reworkRule: 'supervisor_decision',
    isActive: true,
    barcode: 'TRM001421',
  },
  {
    id: 'item-mld-002',
    itemCode: 'MLD-002',
    description: 'Bezel Ring B - Untrimmed Moulding',
    unitOfMeasure: 'pcs',
    category: 'untrimmed_molding',
    baselineManufacturingCost: 28.0,
    expectedCapacityPph: 150,
    defaultTrimmingRate: 1.8,
    qcRequired: true,
    reworkRule: 'supervisor_decision',
    isActive: true,
    barcode: 'MLD002773',
  },
  {
    id: 'item-trm-002',
    itemCode: 'TRM-002',
    description: 'Bezel Ring B - Trimmed Ring',
    unitOfMeasure: 'pcs',
    category: 'trimmed_finished',
    parentItemId: 'item-mld-002',
    baselineManufacturingCost: 28.0,
    expectedCapacityPph: 150,
    defaultTrimmingRate: 1.8,
    qcRequired: true,
    reworkRule: 'supervisor_decision',
    isActive: true,
    barcode: 'TRM002634',
  },
  {
    id: 'item-mld-003',
    itemCode: 'MLD-003',
    description: 'Base Chassis Plate C - Untrimmed Heavy',
    unitOfMeasure: 'pcs',
    category: 'untrimmed_molding',
    baselineManufacturingCost: 65.0,
    expectedCapacityPph: 90,
    defaultTrimmingRate: 3.5,
    qcRequired: true,
    reworkRule: 'supervisor_decision',
    isActive: true,
    barcode: 'MLD003112',
  },
  {
    id: 'item-trm-003',
    itemCode: 'TRM-003',
    description: 'Base Chassis Plate C - Trimmed & Flushed',
    unitOfMeasure: 'pcs',
    category: 'trimmed_finished',
    parentItemId: 'item-mld-003',
    baselineManufacturingCost: 65.0,
    expectedCapacityPph: 90,
    defaultTrimmingRate: 3.5,
    qcRequired: true,
    reworkRule: 'supervisor_decision',
    isActive: true,
    barcode: 'TRM003889',
  },
];

const DEFAULT_LOCATIONS: Location[] = [
  { id: 'loc-mld', code: 'LOC-MOLD', name: 'Molding Bay Staging Area', type: 'molding_bay', isActive: true },
  { id: 'loc-raw-store', code: 'STORE-RAW', name: 'Main Trimming Raw Store', type: 'raw_store', isActive: true },
  { id: 'loc-rack-a', code: 'RACK-A', name: 'Raw Store - Rack A (Housings)', type: 'raw_store', parentLocationId: 'loc-raw-store', isActive: true, rackNumber: 'A' },
  { id: 'loc-shelf-a1', code: 'SHELF-A01', name: 'Rack A - Shelf 01', type: 'raw_store', parentLocationId: 'loc-rack-a', isActive: true, shelfNumber: '01' },
  { id: 'loc-shelf-a2', code: 'SHELF-A02', name: 'Rack A - Shelf 02', type: 'raw_store', parentLocationId: 'loc-rack-a', isActive: true, shelfNumber: '02' },
  { id: 'loc-rack-b', code: 'RACK-B', name: 'Raw Store - Rack B (Bezel Rings)', type: 'raw_store', parentLocationId: 'loc-raw-store', isActive: true, rackNumber: 'B' },
  { id: 'loc-rack-c', code: 'RACK-C', name: 'Raw Store - Rack C (Plates)', type: 'raw_store', parentLocationId: 'loc-raw-store', isActive: true, rackNumber: 'C' },
  { id: 'loc-ws-bay', code: 'WS-BAY', name: 'Trimming Workstations Floor (WS-01..70)', type: 'workstation', isActive: true },
  { id: 'loc-qc-hold', code: 'QC-HOLD', name: 'QC Inspection Holding Area', type: 'qc_holding', isActive: true },
  { id: 'loc-qc-rej', code: 'QC-REJ', name: 'QC Rejected Quarantine', type: 'qc_rejected', isActive: true },
  { id: 'loc-rework', code: 'REWORK-HOLD', name: 'Rework Staging & Repair Bay', type: 'rework_holding', isActive: true },
  { id: 'loc-fin-store', code: 'STORE-FIN', name: 'Main Trimmed Finished Store', type: 'finished_store', isActive: true },
  { id: 'loc-packing', code: 'PACKING-BAY', name: 'Carton Packing & Assembly', type: 'packing_bay', isActive: true },
  { id: 'loc-dispatch', code: 'DISPATCH', name: 'Finished Goods Dispatch Bay', type: 'dispatch_bay', isActive: true },
  { id: 'loc-vend-apex', code: 'VEND-APEX', name: 'Vendor Site - Apex Polymers', type: 'vendor_site', isActive: true },
  { id: 'loc-vend-falcon', code: 'VEND-FALCON', name: 'Vendor Site - Falcon Trimming', type: 'vendor_site', isActive: true },
];

const DEFAULT_SHIFTS: Shift[] = [
  { id: 'shift-a', code: 'SHIFT_A', name: 'Shift A - Morning (07:00 - 15:30)', startTime: '07:00', endTime: '15:30', breakDurationMinutes: 60, netWorkingHours: 7.5 },
  { id: 'shift-b', code: 'SHIFT_B', name: 'Shift B - Evening (15:30 - 23:30)', startTime: '15:30', endTime: '23:30', breakDurationMinutes: 30, netWorkingHours: 7.5 },
  { id: 'shift-c', code: 'SHIFT_C', name: 'Shift C - Night (23:30 - 07:00)', startTime: '23:30', endTime: '07:00', breakDurationMinutes: 30, netWorkingHours: 7.0, isOvernight: true },
];

const DEFAULT_WORKERS: Worker[] = [
  { id: 'w-ih-01', code: 'V-IH-01', name: 'Rasheed Trimming Works', type: 'in_house_vendor', isActive: true, defaultPieceRate: 2.5, assignedWorkstationId: 'ws-1' },
  { id: 'w-ih-02', code: 'V-IH-02', name: 'Farooq Finishing Co.', type: 'in_house_vendor', isActive: true, defaultPieceRate: 2.5, assignedWorkstationId: 'ws-6' },
  { id: 'w-ih-03', code: 'V-IH-03', name: 'Qasim & Sons Trimmers', type: 'in_house_vendor', isActive: true, defaultPieceRate: 2.5, assignedWorkstationId: 'ws-11' },
  { id: 'w-emp-01', code: 'EMP-01', name: 'Ali Khan', type: 'employee', isActive: true, monthlySalary: 42000, assignedWorkstationId: 'ws-16' },
  { id: 'w-emp-02', code: 'EMP-02', name: 'Tariq Mehmood', type: 'employee', isActive: true, monthlySalary: 40000, assignedWorkstationId: 'ws-17' },
  { id: 'w-emp-03', code: 'EMP-03', name: 'Usman Bashir', type: 'employee', isActive: true, monthlySalary: 45000, assignedWorkstationId: 'ws-18' },
  { id: 'w-emp-04', code: 'EMP-04', name: 'Bilal Ahmed', type: 'employee', isActive: true, monthlySalary: 38000, assignedWorkstationId: 'ws-19' },
];

const DEFAULT_OUTSOURCED_VENDORS: OutsourcedVendor[] = [
  {
    id: 'v-out-01',
    code: 'V-OUT-01',
    name: 'Apex Polymers Ltd',
    contactPerson: 'Malik Imran',
    phone: '0300-5551234',
    workforceCount: 15,
    availableDailyHours: 8,
    defaultPieceRate: 3.0,
    currentOutstandingQty: 600,
    outstandingPayablePkr: 4500,
    isActive: true,
  },
  {
    id: 'v-out-02',
    code: 'V-OUT-02',
    name: 'Falcon Trimming Works',
    contactPerson: 'Shahid Riaz',
    phone: '0321-7778901',
    workforceCount: 20,
    availableDailyHours: 8,
    defaultPieceRate: 2.8,
    currentOutstandingQty: 0,
    outstandingPayablePkr: 0,
    isActive: true,
  },
];

const DEFAULT_BALANCES: StockBalance[] = [
  { id: 'bal-1', locationId: 'loc-shelf-a1', itemId: 'item-mld-001', status: 'untrimmed', quantityOnHand: 4500, quantityReserved: 400, updatedAt: '2026-10-28T10:00:00Z' },
  { id: 'bal-2', locationId: 'loc-rack-b', itemId: 'item-mld-002', status: 'untrimmed', quantityOnHand: 3200, quantityReserved: 0, updatedAt: '2026-10-28T10:00:00Z' },
  { id: 'bal-3', locationId: 'loc-rack-c', itemId: 'item-mld-003', status: 'untrimmed', quantityOnHand: 2800, quantityReserved: 0, updatedAt: '2026-10-28T10:00:00Z' },
  { id: 'bal-4', locationId: 'loc-fin-store', itemId: 'item-trm-001', status: 'approved_finished', quantityOnHand: 1850, quantityReserved: 0, updatedAt: '2026-10-28T10:00:00Z' },
  { id: 'bal-5', locationId: 'loc-fin-store', itemId: 'item-trm-002', status: 'approved_finished', quantityOnHand: 1200, quantityReserved: 0, updatedAt: '2026-10-28T10:00:00Z' },
  { id: 'bal-6', locationId: 'loc-qc-hold', itemId: 'item-trm-001', status: 'qc_pending', quantityOnHand: 350, quantityReserved: 0, updatedAt: '2026-10-28T10:00:00Z' },
  { id: 'bal-7', locationId: 'loc-rework', itemId: 'item-trm-001', status: 'rework_holding', quantityOnHand: 80, quantityReserved: 0, updatedAt: '2026-10-28T10:00:00Z' },
  { id: 'bal-8', locationId: 'loc-vend-apex', itemId: 'item-mld-001', status: 'untrimmed', quantityOnHand: 600, quantityReserved: 0, updatedAt: '2026-10-28T10:00:00Z' },
  { id: 'bal-9', locationId: 'loc-ws-bay', itemId: 'item-mld-001', status: 'in_trimming', quantityOnHand: 400, quantityReserved: 0, updatedAt: '2026-10-28T10:00:00Z' },
];

const DEFAULT_TRANSACTIONS: InventoryTransaction[] = [
  {
    id: 'txn-1',
    transactionNumber: 'TXN-2026-00001',
    transactionType: 'opening_balance',
    date: '2026-10-26T08:00:00Z',
    itemId: 'item-mld-001',
    quantity: 5000,
    sourceLocationId: 'loc-mld',
    destinationLocationId: 'loc-shelf-a1',
    referenceType: 'MANUAL',
    referenceId: 'OB-INIT',
    responsiblePerson: 'Store Supervisor',
    notes: 'Initial monthly opening stock verified',
    createdBy: 'Admin',
    timestamp: '2026-10-26T08:00:00Z',
  },
  {
    id: 'txn-2',
    transactionNumber: 'TXN-2026-00002',
    transactionType: 'issue',
    date: '2026-10-27T09:00:00Z',
    itemId: 'item-mld-001',
    quantity: 600,
    sourceLocationId: 'loc-shelf-a1',
    destinationLocationId: 'loc-vend-apex',
    referenceType: 'OGP',
    referenceId: 'OGP-2026-0001',
    responsiblePerson: 'Malik Imran',
    notes: 'Outsourced to Apex Polymers',
    createdBy: 'Store Operator',
    timestamp: '2026-10-27T09:00:00Z',
  },
  {
    id: 'txn-3',
    transactionNumber: 'TXN-2026-00003',
    transactionType: 'internal_transfer',
    date: '2026-10-28T07:15:00Z',
    itemId: 'item-mld-001',
    quantity: 400,
    sourceLocationId: 'loc-shelf-a1',
    destinationLocationId: 'loc-ws-bay',
    referenceType: 'PTN',
    referenceId: 'PTN-2026-0001',
    responsiblePerson: 'Rasheed Trimmer',
    notes: 'Material issued for Shift A production at WS-01',
    createdBy: 'Production Planner',
    timestamp: '2026-10-28T07:15:00Z',
  },
];

const DEFAULT_PTNS: PTNDocument[] = [
  {
    id: 'ptn-1',
    ptnNumber: 'PTN-2026-0001',
    date: '2026-10-28',
    sourceLocationId: 'loc-shelf-a1',
    destinationLocationId: 'loc-ws-bay',
    workstationId: 'ws-1',
    assignedPersonId: 'w-ih-01',
    items: [{ itemId: 'item-mld-001', quantity: 400, stageName: 'Primary Trimming', workOrderId: 'wo-1', reason: 'Shift A scheduled batch' }],
    status: 'completed',
    preparedBy: 'Store Operator (Aslam)',
    approvedBy: 'Shift Supervisor (Farhan)',
    remarks: 'High priority dispatch scheduled',
    qrCodePayload: JSON.stringify({ doc: 'PTN-2026-0001', qty: 400, item: 'MLD-001', to: 'WS-01' }),
    createdAt: '2026-10-28T07:10:00Z',
  },
];

const DEFAULT_WORK_ORDERS: WorkOrder[] = [
  {
    id: 'wo-1',
    workOrderNumber: 'WO-2026-0001',
    date: '2026-10-28',
    shiftId: 'shift-a',
    workstationId: 'ws-1',
    assignedWorkerId: 'w-ih-01',
    itemId: 'item-mld-001',
    stageName: 'Primary Trimming',
    sourcePtnId: 'ptn-1',
    quantityIssued: 400,
    plannedQuantity: 900, // 120 PPH * 7.5 hrs = 900 target
    actualTrimmedQuantity: 350,
    quantitySentToQc: 350,
    quantityReturnedUntrimmed: 0,
    closingBalance: 50,
    downtimeMinutes: 25,
    delayReason: 'Blade edge replacement and blade alignment',
    status: 'in_progress',
    createdAt: '2026-10-28T07:15:00Z',
  },
];

const DEFAULT_OGPS: OGPDocument[] = [
  {
    id: 'ogp-1',
    ogpNumber: 'OGP-2026-0001',
    issueDate: '2026-10-27',
    vendorId: 'v-out-01',
    items: [
      {
        itemId: 'item-mld-001',
        quantity: 600,
        ratePerPiece: 3.0,
        returnedQuantity: 0,
        qcApprovedQuantity: 0,
        rejectedQuantity: 0,
        reworkQuantity: 0,
      },
    ],
    totalIssuedQuantity: 600,
    expectedReturnDate: '2026-10-30',
    status: 'issued',
    preparedBy: 'Store Supervisor',
    approvedBy: 'Operations Manager',
    remarks: 'Gate Pass for commercial plastic carrier vehicle',
    qrCodePayload: JSON.stringify({ doc: 'OGP-2026-0001', vendor: 'V-OUT-01', qty: 600, item: 'MLD-001' }),
  },
];

const DEFAULT_QC: QCInspection[] = [
  {
    id: 'qc-1',
    inspectionNumber: 'QC-2026-0001',
    date: '2026-10-28T14:30:00Z',
    referenceType: 'work_order',
    referenceId: 'wo-1',
    itemId: 'item-trm-001',
    quantityInspected: 350,
    quantityAccepted: 300,
    quantityRejected: 50,
    defects: [
      { defectType: 'over_trim_gouge', count: 35 },
      { defectType: 'flash_excess', count: 15 },
    ],
    inspector: 'Khurram QC',
    approvedBy: 'QC Lead',
    destinationLocationId: 'loc-fin-store',
    notes: '300 passed to finished store. 50 routed to Rework Bay for re-finishing.',
    createdAt: '2026-10-28T14:35:00Z',
  },
];

const DEFAULT_REWORK: ReworkOrder[] = [
  {
    id: 'rw-1',
    reworkOrderNumber: 'RW-2026-0001',
    originalReferenceType: 'work_order',
    originalReferenceId: 'wo-1',
    originalWorkerId: 'w-ih-01',
    qcInspectionId: 'qc-1',
    itemId: 'item-trm-001',
    quantityToRework: 50,
    assignedWorkerType: 'in_house_vendor',
    assignedWorkerId: 'w-ih-02',
    paymentEligibility: 'standard_rate',
    approvedRatePkr: 1.5,
    quantityCompleted: 0,
    cycleNumber: 1,
    status: 'assigned',
    notes: 'Remove excess flash on parting line. Supervisor approved secondary rework rate.',
    createdAt: '2026-10-28T15:00:00Z',
  },
];

const DEFAULT_EARNINGS: VendorEarning[] = [
  {
    id: 'earn-1',
    vendorId: 'w-ih-01',
    vendorType: 'in_house_vendor',
    referenceType: 'work_order',
    referenceId: 'wo-1',
    itemId: 'item-trm-001',
    quantityEligible: 300, // strictly QC approved pieces!
    ratePerPiece: 2.5,
    amountPkr: 750.0, // 300 * 2.50 = Rs. 750
    isApproved: true,
    approvedBy: 'Shift Supervisor',
    approvalDate: '2026-10-28',
    isPaid: false,
    createdAt: '2026-10-28T15:10:00Z',
  },
];

const DEFAULT_AUDIT: AuditEvent[] = [
  {
    id: 'aud-1',
    timestamp: '2026-10-26T08:00:00Z',
    user: 'Admin',
    role: 'admin',
    action: 'INITIALIZE_SYSTEM',
    entityType: 'System',
    entityId: 'ROOT',
    details: 'System initialized with 70 Workstations, master items, and opening ledger',
  },
];

// In-Memory & Local Storage Repository Singleton
export class DataService {
  private static instance: DataService;

  private items: Item[];
  private locations: Location[];
  private workstations: Workstation[];
  private shifts: Shift[];
  private workers: Worker[];
  private outsourcedVendors: OutsourcedVendor[];
  private balances: StockBalance[];
  private transactions: InventoryTransaction[];
  private ptns: PTNDocument[];
  private workOrders: WorkOrder[];
  private ogps: OGPDocument[];
  private igps: IGPDocument[];
  private qcInspections: QCInspection[];
  private reworkOrders: ReworkOrder[];
  private vendorEarnings: VendorEarning[];
  private vendorPayments: VendorPayment[];
  private stocktakingSessions: StocktakingSession[];
  private auditEvents: AuditEvent[];
  private listeners: (() => void)[] = [];

  private constructor() {
    this.items = getStored('items', DEFAULT_ITEMS);
    this.locations = getStored('locations', DEFAULT_LOCATIONS);
    this.workstations = getStored('workstations', generate70Workstations());
    this.shifts = getStored('shifts', DEFAULT_SHIFTS);
    this.workers = getStored('workers', DEFAULT_WORKERS);
    this.outsourcedVendors = getStored('outsourced_vendors', DEFAULT_OUTSOURCED_VENDORS);
    this.balances = getStored('balances', DEFAULT_BALANCES);
    this.transactions = getStored('transactions', DEFAULT_TRANSACTIONS);
    this.ptns = getStored('ptns', DEFAULT_PTNS);
    this.workOrders = getStored('work_orders', DEFAULT_WORK_ORDERS);
    this.ogps = getStored('ogps', DEFAULT_OGPS);
    this.igps = getStored('igps', []);
    this.qcInspections = getStored('qc_inspections', DEFAULT_QC);
    this.reworkOrders = getStored('rework_orders', DEFAULT_REWORK);
    this.vendorEarnings = getStored('vendor_earnings', DEFAULT_EARNINGS);
    this.vendorPayments = getStored('vendor_payments', []);
    this.stocktakingSessions = getStored('stocktaking_sessions', []);
    this.auditEvents = getStored('audit_events', DEFAULT_AUDIT);
  }

  public static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  // Getters
  public getItems(): Item[] { return [...this.items]; }
  public getLocations(): Location[] { return [...this.locations]; }
  public getWorkstations(): Workstation[] { return [...this.workstations]; }
  public getShifts(): Shift[] { return [...this.shifts]; }
  public getWorkers(): Worker[] { return [...this.workers]; }
  public getOutsourcedVendors(): OutsourcedVendor[] { return [...this.outsourcedVendors]; }
  public getBalances(): StockBalance[] { return [...this.balances]; }
  public getTransactions(): InventoryTransaction[] { return [...this.transactions]; }
  public getPTNs(): PTNDocument[] { return [...this.ptns]; }
  public getWorkOrders(): WorkOrder[] { return [...this.workOrders]; }
  public getOGPs(): OGPDocument[] { return [...this.ogps]; }
  public getIGPs(): IGPDocument[] { return [...this.igps]; }
  public getQCInspections(): QCInspection[] { return [...this.qcInspections]; }
  public getReworkOrders(): ReworkOrder[] { return [...this.reworkOrders]; }
  public getVendorEarnings(): VendorEarning[] { return [...this.vendorEarnings]; }
  public getVendorPayments(): VendorPayment[] { return [...this.vendorPayments]; }
  public getStocktakingSessions(): StocktakingSession[] { return [...this.stocktakingSessions]; }
  public getAuditEvents(): AuditEvent[] { return [...this.auditEvents]; }

  // Audit Logging
  public logAudit(user: string, role: string, action: string, entityType: string, entityId: string, details: string) {
    const entry: AuditEvent = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      user,
      role,
      action,
      entityType,
      entityId,
      details,
    };
    this.auditEvents.unshift(entry);
    setStored('audit_events', this.auditEvents);
    this.notify();
  }

  // Stock Balance Queries & Updaters
  public getStockBalance(locationId: string, itemId: string, status: StockBalance['status']): StockBalance | undefined {
    return this.balances.find((b) => b.locationId === locationId && b.itemId === itemId && b.status === status);
  }

  public updateBalance(locationId: string, itemId: string, status: StockBalance['status'], delta: number): void {
    let existing = this.balances.find((b) => b.locationId === locationId && b.itemId === itemId && b.status === status);
    if (!existing) {
      existing = {
        id: `bal-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        locationId,
        itemId,
        status,
        quantityOnHand: 0,
        quantityReserved: 0,
        updatedAt: new Date().toISOString(),
      };
      this.balances.push(existing);
    }
    existing.quantityOnHand += delta;
    if (existing.quantityOnHand < 0) {
      console.warn(`Negative balance detected at location ${locationId} for item ${itemId}: ${existing.quantityOnHand}`);
    }
    existing.updatedAt = new Date().toISOString();
    setStored('balances', this.balances);
    this.notify();
  }

  public setReservedBalance(locationId: string, itemId: string, status: StockBalance['status'], delta: number): void {
    const existing = this.balances.find((b) => b.locationId === locationId && b.itemId === itemId && b.status === status);
    if (existing) {
      existing.quantityReserved = Math.max(0, existing.quantityReserved + delta);
      existing.updatedAt = new Date().toISOString();
      setStored('balances', this.balances);
      this.notify();
    }
  }

  // Direct Mutators with Persistence
  public addTransaction(txn: InventoryTransaction): void {
    this.transactions.unshift(txn);
    setStored('transactions', this.transactions);
    this.notify();
  }

  public addPTN(ptn: PTNDocument): void {
    this.ptns.unshift(ptn);
    setStored('ptns', this.ptns);
    this.notify();
  }

  public updatePTNStatus(id: string, status: PTNDocument['status'], approvedBy?: string): void {
    const ptn = this.ptns.find((p) => p.id === id);
    if (ptn) {
      ptn.status = status;
      if (approvedBy) ptn.approvedBy = approvedBy;
      setStored('ptns', this.ptns);
      this.notify();
    }
  }

  public addWorkOrder(wo: WorkOrder): void {
    this.workOrders.unshift(wo);
    setStored('work_orders', this.workOrders);
    this.notify();
  }

  public updateWorkOrder(wo: WorkOrder): void {
    const idx = this.workOrders.findIndex((w) => w.id === wo.id);
    if (idx !== -1) {
      this.workOrders[idx] = wo;
      setStored('work_orders', this.workOrders);
      this.notify();
    }
  }

  public addOGP(ogp: OGPDocument): void {
    this.ogps.unshift(ogp);
    setStored('ogps', this.ogps);
    this.notify();
  }

  public updateOGP(ogp: OGPDocument): void {
    const idx = this.ogps.findIndex((o) => o.id === ogp.id);
    if (idx !== -1) {
      this.ogps[idx] = ogp;
      setStored('ogps', this.ogps);
      this.notify();
    }
  }

  public addIGP(igp: IGPDocument): void {
    this.igps.unshift(igp);
    setStored('igps', this.igps);
    this.notify();
  }

  public addQCInspection(qc: QCInspection): void {
    this.qcInspections.unshift(qc);
    setStored('qc_inspections', this.qcInspections);
    this.notify();
  }

  public addReworkOrder(ro: ReworkOrder): void {
    this.reworkOrders.unshift(ro);
    setStored('rework_orders', this.reworkOrders);
    this.notify();
  }

  public updateReworkOrder(ro: ReworkOrder): void {
    const idx = this.reworkOrders.findIndex((r) => r.id === ro.id);
    if (idx !== -1) {
      this.reworkOrders[idx] = ro;
      setStored('rework_orders', this.reworkOrders);
      this.notify();
    }
  }

  public addVendorEarning(ve: VendorEarning): void {
    this.vendorEarnings.unshift(ve);
    setStored('vendor_earnings', this.vendorEarnings);
    this.notify();
  }

  public approveVendorEarning(id: string, approver: string): void {
    const earning = this.vendorEarnings.find((e) => e.id === id);
    if (earning) {
      earning.isApproved = true;
      earning.approvedBy = approver;
      earning.approvalDate = new Date().toISOString();
      setStored('vendor_earnings', this.vendorEarnings);
      this.notify();
    }
  }

  public addVendorPayment(vp: VendorPayment): void {
    this.vendorPayments.unshift(vp);
    // Mark associated earnings as paid
    vp.earningIds.forEach((eid) => {
      const e = this.vendorEarnings.find((earning) => earning.id === eid);
      if (e) {
        e.isPaid = true;
        e.paymentBatchId = vp.id;
      }
    });
    setStored('vendor_earnings', this.vendorEarnings);
    setStored('vendor_payments', this.vendorPayments);
    this.notify();
  }

  public addStocktakingSession(session: StocktakingSession): void {
    this.stocktakingSessions.unshift(session);
    setStored('stocktaking_sessions', this.stocktakingSessions);
    this.notify();
  }

  public updateStocktakingSession(session: StocktakingSession): void {
    const idx = this.stocktakingSessions.findIndex((s) => s.id === session.id);
    if (idx !== -1) {
      this.stocktakingSessions[idx] = session;
      setStored('stocktaking_sessions', this.stocktakingSessions);
      this.notify();
    }
  }

  public updateWorkstation(ws: Workstation): void {
    const idx = this.workstations.findIndex((w) => w.id === ws.id);
    if (idx !== -1) {
      this.workstations[idx] = ws;
      setStored('workstations', this.workstations);
      this.notify();
    }
  }

  public updateWorker(worker: Worker): void {
    const idx = this.workers.findIndex((w) => w.id === worker.id);
    if (idx !== -1) {
      this.workers[idx] = worker;
      setStored('workers', this.workers);
      this.notify();
    }
  }

  public addItem(item: Item): void {
    this.items.push(item);
    setStored('items', this.items);
    this.notify();
  }

  public updateItem(item: Item): void {
    const idx = this.items.findIndex((i) => i.id === item.id);
    if (idx !== -1) {
      this.items[idx] = item;
      setStored('items', this.items);
      this.notify();
    }
  }

  public addLocation(loc: Location): void {
    this.locations.push(loc);
    setStored('locations', this.locations);
    this.notify();
  }

  public resetToFactoryDefaults(): void {
    localStorage.clear();
    this.items = DEFAULT_ITEMS;
    this.locations = DEFAULT_LOCATIONS;
    this.workstations = generate70Workstations();
    this.shifts = DEFAULT_SHIFTS;
    this.workers = DEFAULT_WORKERS;
    this.outsourcedVendors = DEFAULT_OUTSOURCED_VENDORS;
    this.balances = DEFAULT_BALANCES;
    this.transactions = DEFAULT_TRANSACTIONS;
    this.ptns = DEFAULT_PTNS;
    this.workOrders = DEFAULT_WORK_ORDERS;
    this.ogps = DEFAULT_OGPS;
    this.igps = [];
    this.qcInspections = DEFAULT_QC;
    this.reworkOrders = DEFAULT_REWORK;
    this.vendorEarnings = DEFAULT_EARNINGS;
    this.vendorPayments = [];
    this.stocktakingSessions = [];
    this.auditEvents = DEFAULT_AUDIT;

    setStored('items', this.items);
    setStored('locations', this.locations);
    setStored('workstations', this.workstations);
    setStored('shifts', this.shifts);
    setStored('workers', this.workers);
    setStored('outsourced_vendors', this.outsourcedVendors);
    setStored('balances', this.balances);
    setStored('transactions', this.transactions);
    setStored('ptns', this.ptns);
    setStored('work_orders', this.workOrders);
    setStored('ogps', this.ogps);
    setStored('igps', this.igps);
    setStored('qc_inspections', this.qcInspections);
    setStored('rework_orders', this.reworkOrders);
    setStored('vendor_earnings', this.vendorEarnings);
    setStored('vendor_payments', this.vendorPayments);
    setStored('stocktaking_sessions', this.stocktakingSessions);
    setStored('audit_events', this.auditEvents);
    this.notify();
  }
}
