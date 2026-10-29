/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole =
  | 'admin'
  | 'store_operator'
  | 'production_planner'
  | 'production_supervisor'
  | 'qc_inspector'
  | 'accounts_user'
  | 'manager_approver'
  | 'readonly_management';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  approvalLimitPkr?: number;
}

export type ItemCategory = 'untrimmed_molding' | 'intermediate' | 'trimmed_finished';

export interface Item {
  id: string;
  itemCode: string; // e.g. MLD-001 (untrimmed) or TRM-001 (trimmed)
  description: string;
  unitOfMeasure: string; // 'pcs', 'kg'
  category: ItemCategory;
  parentItemId?: string; // links MLD-001 to TRM-001
  baselineManufacturingCost: number; // PKR before trimming
  expectedCapacityPph: number; // Pieces Per Hour (e.g. 120)
  defaultTrimmingRate: number; // Financial amount per piece in PKR (e.g. Rs. 2.50)
  qcRequired: boolean;
  reworkRule: 'unpaid_original' | 'rate_applicable' | 'supervisor_decision';
  isActive: boolean;
  barcode?: string;
  qrCode?: string;
}

export type LocationType =
  | 'molding_bay'
  | 'raw_store'
  | 'workstation'
  | 'qc_holding'
  | 'qc_rejected'
  | 'rework_holding'
  | 'finished_store'
  | 'packing_bay'
  | 'dispatch_bay'
  | 'vendor_site';

export interface Location {
  id: string;
  code: string; // e.g. 'STORE-RAW', 'RACK-A', 'SHELF-A1', 'QC-HOLD', 'REWORK-BAY', 'WS-01'
  name: string;
  type: LocationType;
  parentLocationId?: string;
  isActive: boolean;
  rackNumber?: string;
  shelfNumber?: string;
  binNumber?: string;
}

export type StockProcessingStatus =
  | 'untrimmed'
  | 'in_trimming'
  | 'qc_pending'
  | 'rework_holding'
  | 'approved_finished'
  | 'scrapped';

export interface StockBalance {
  id: string;
  locationId: string;
  itemId: string;
  status: StockProcessingStatus;
  quantityOnHand: number;
  quantityReserved: number;
  updatedAt: string;
}

export type TransactionType =
  | 'receipt'
  | 'issue'
  | 'internal_transfer'
  | 'consumption'
  | 'production_return'
  | 'qc_transfer'
  | 'rework_transfer'
  | 'approved_stock'
  | 'vendor_return'
  | 'adjustment'
  | 'opening_balance';

export interface InventoryTransaction {
  id: string;
  transactionNumber: string; // TXN-2026-00001
  transactionType: TransactionType;
  date: string;
  itemId: string;
  quantity: number;
  sourceLocationId: string;
  destinationLocationId: string;
  referenceType: 'PTN' | 'OGP' | 'IGP' | 'WO' | 'QC' | 'REWORK' | 'STOCKTAKE' | 'MANUAL';
  referenceId: string;
  responsiblePerson: string;
  notes?: string;
  createdBy: string;
  approvedBy?: string;
  timestamp: string;
}

export interface PTNItem {
  itemId: string;
  quantity: number;
  stageName?: string;
  workOrderId?: string;
  reason?: string;
}

export interface PTNDocument {
  id: string;
  ptnNumber: string; // PTN-2026-0001
  date: string;
  sourceLocationId: string;
  destinationLocationId: string;
  workstationId?: string;
  assignedPersonId?: string;
  items: PTNItem[];
  status: 'draft' | 'pending_approval' | 'approved' | 'completed' | 'cancelled';
  preparedBy: string;
  approvedBy?: string;
  remarks?: string;
  qrCodePayload: string;
  createdAt: string;
}

export interface Workstation {
  id: string;
  code: string; // WS-01 through WS-70
  name: string;
  status: 'active' | 'idle' | 'maintenance' | 'inactive';
  capacityMultiplier: number;
  currentWorkerId?: string;
  currentWorkOrderId?: string;
}

export interface Shift {
  id: string;
  code: 'SHIFT_A' | 'SHIFT_B' | 'SHIFT_C';
  name: string;
  startTime: string; // '07:00'
  endTime: string;   // '15:30'
  breakDurationMinutes: number; // 60
  netWorkingHours: number;      // 7.5
  isOvernight?: boolean;
}

export type WorkerType = 'in_house_vendor' | 'employee';

export interface Worker {
  id: string;
  code: string; // e.g. 'EMP-01' or 'V-IH-01'
  name: string;
  type: WorkerType;
  isActive: boolean;
  phone?: string;
  assignedWorkstationId?: string;
  defaultShiftId?: string;
  monthlySalary?: number; // PKR - for employee cost allocation only
  defaultPieceRate?: number; // PKR - for in-house vendors
}

export interface OutsourcedVendor {
  id: string;
  code: string; // e.g. 'V-OUT-01'
  name: string;
  contactPerson: string;
  phone: string;
  workforceCount: number;
  availableDailyHours: number;
  defaultPieceRate: number; // PKR
  currentOutstandingQty: number; // pieces held outside
  outstandingPayablePkr: number;
  isActive: boolean;
}

export interface WorkOrder {
  id: string;
  workOrderNumber: string; // WO-2026-0001
  date: string;
  shiftId: string;
  workstationId: string;
  assignedWorkerId: string;
  itemId: string; // Untrimmed item
  stageName: string;
  sourcePtnId?: string;
  quantityIssued: number;
  plannedQuantity: number; // Calculated: PPH * Net Shift Hours
  actualTrimmedQuantity: number;
  quantitySentToQc: number;
  quantityReturnedUntrimmed: number;
  closingBalance: number; // Material still at workstation
  downtimeMinutes: number;
  delayReason?: string;
  status: 'scheduled' | 'in_progress' | 'closed' | 'reconciled';
  supervisorNotes?: string;
  verifiedBy?: string;
  createdAt: string;
}

export interface OGPItem {
  itemId: string;
  quantity: number;
  ratePerPiece: number; // PKR
  returnedQuantity: number;
  qcApprovedQuantity: number;
  rejectedQuantity: number;
  reworkQuantity: number;
}

export interface OGPDocument {
  id: string;
  ogpNumber: string; // OGP-2026-0001
  customNumber?: string;
  issueDate: string;
  vendorId: string;
  items: OGPItem[];
  totalIssuedQuantity: number;
  expectedReturnDate: string;
  status: 'issued' | 'partially_returned' | 'completed' | 'cancelled';
  preparedBy: string;
  approvedBy?: string;
  remarks?: string;
  qrCodePayload: string;
}

export interface IGPItem {
  itemId: string;
  quantityReturned: number;
  qcStatus: 'pending' | 'inspected';
  acceptedQuantity?: number;
  rejectedQuantity?: number;
}

export interface IGPDocument {
  id: string;
  igpNumber: string; // IGP-2026-0001
  customNumber?: string;
  ogpId: string;
  vendorId: string;
  returnDate: string;
  items: IGPItem[];
  totalReturnedQuantity: number;
  receivingLocationId: string;
  status: 'received' | 'qc_in_progress' | 'closed';
  receivedBy: string;
  remarks?: string;
  qrCodePayload: string;
}

export interface DefectClassification {
  defectType: 'flash_excess' | 'over_trim_gouge' | 'short_mould' | 'sink_mark' | 'parting_line' | 'other';
  count: number;
}

export interface QCInspection {
  id: string;
  inspectionNumber: string; // QC-2026-0001
  date: string;
  referenceType: 'work_order' | 'igp' | 'rework_order';
  referenceId: string;
  itemId: string;
  quantityInspected: number;
  quantityAccepted: number;
  quantityRejected: number; // Must equal inspected - accepted
  defects: DefectClassification[];
  inspector: string;
  approvedBy?: string;
  notes?: string;
  photoUrls?: string[];
  destinationLocationId: string;
  createdAt: string;
}

export interface ReworkOrder {
  id: string;
  reworkOrderNumber: string; // RW-2026-0001
  originalReferenceType: 'work_order' | 'igp';
  originalReferenceId: string;
  originalWorkerId?: string;
  qcInspectionId: string;
  itemId: string;
  quantityToRework: number;
  assignedWorkerType: 'employee' | 'in_house_vendor' | 'outsourced_vendor';
  assignedWorkerId: string;
  paymentEligibility: 'unpaid' | 'standard_rate' | 'special_approved_rate';
  approvedRatePkr: number;
  quantityCompleted: number;
  subsequentQcId?: string;
  cycleNumber: number; // 1 = 1st rework, 2 = 2nd rework
  status: 'assigned' | 'in_rework' | 'completed' | 'scrapped';
  notes?: string;
  createdAt: string;
}

export interface VendorEarning {
  id: string;
  vendorId: string;
  vendorType: 'in_house_vendor' | 'outsourced_vendor';
  referenceType: 'work_order' | 'igp' | 'rework_order';
  referenceId: string;
  itemId: string;
  quantityEligible: number;
  ratePerPiece: number; // PKR
  amountPkr: number;    // Quantity * Rate
  isApproved: boolean;
  approvedBy?: string;
  approvalDate?: string;
  paymentBatchId?: string;
  isPaid: boolean;
  createdAt: string;
}

export interface VendorPayment {
  id: string;
  batchNumber: string; // PAY-2026-0001
  vendorId: string;
  vendorType: 'in_house_vendor' | 'outsourced_vendor';
  paymentDate: string;
  amountPaidPkr: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'cheque';
  referenceNumber: string;
  notes?: string;
  approvedBy: string;
  earningIds: string[];
  createdAt: string;
}

export interface EmployeeLabourAllocation {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  monthlySalaryPkr: number;
  allocationMethod: 'hour_based' | 'production_based' | 'hybrid';
  totalShiftHours: number;
  productiveHours: number;
  downtimeHours: number;
  allocatedCostPkr: number;
  acceptedPiecesProduced: number;
  effectiveCostPerPiecePkr: number;
}

export interface ProductUnitCost {
  itemId: string;
  itemCode: string;
  description: string;
  baselineManufacturingCostPkr: number;
  inHouseTrimmingCostPkr: number;
  outsourcedTrimmingCostPkr: number;
  allocatedEmployeeLabourCostPkr: number;
  reworkScrapCostPkr: number;
  totalFinishedCostPkr: number;
  effectiveDate: string;
}

export interface StockCountLine {
  id: string;
  locationId: string;
  locationName: string;
  itemId: string;
  itemCode: string;
  status: StockProcessingStatus;
  bookQuantity: number;
  physicalCount: number;
  varianceQuantity: number; // physical - book
  unitCostPkr: number;
  varianceValuePkr: number;
  investigationNotes?: string;
  adjustmentPosted: boolean;
}

export interface StocktakingSession {
  id: string;
  sessionCode: string; // ST-2026-10
  countDate: string;
  status: 'draft' | 'frozen' | 'counting' | 'reconciled' | 'closed';
  isBlindCount: boolean;
  totalItemsCounted: number;
  totalVarianceQuantity: number;
  totalVarianceValuePkr: number;
  lines: StockCountLine[];
  conductedBy: string;
  approvedBy?: string;
  notes?: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
}
