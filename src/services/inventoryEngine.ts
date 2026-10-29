/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataService } from './storage';
import {
  InventoryTransaction,
  PTNDocument,
  OGPDocument,
  IGPDocument,
  QCInspection,
  ReworkOrder,
  VendorEarning,
  StockProcessingStatus,
  WorkOrder,
  StockCountLine,
} from '../types';

export function formatPKR(val: number): string {
  return `₨ ${val.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumber(val: number): string {
  return val.toLocaleString('en-US');
}

export class InventoryEngine {
  private ds = DataService.getInstance();

  /**
   * Universal Double-Entry Stock Movement
   */
  public moveStock(params: {
    itemId: string;
    quantity: number;
    sourceLocationId: string;
    sourceStatus: StockProcessingStatus;
    destinationLocationId: string;
    destinationStatus: StockProcessingStatus;
    transactionType: InventoryTransaction['transactionType'];
    referenceType: InventoryTransaction['referenceType'];
    referenceId: string;
    responsiblePerson: string;
    notes?: string;
    user: string;
    allowNegative?: boolean;
  }): { success: boolean; error?: string; transaction?: InventoryTransaction } {
    const {
      itemId,
      quantity,
      sourceLocationId,
      sourceStatus,
      destinationLocationId,
      destinationStatus,
      transactionType,
      referenceType,
      referenceId,
      responsiblePerson,
      notes,
      user,
      allowNegative = false,
    } = params;

    if (quantity <= 0) {
      return { success: false, error: 'Movement quantity must be greater than zero.' };
    }

    // Check source balance
    const sourceBal = this.ds.getStockBalance(sourceLocationId, itemId, sourceStatus);
    const available = sourceBal ? sourceBal.quantityOnHand - sourceBal.quantityReserved : 0;

    if (!allowNegative && available < quantity) {
      return {
        success: false,
        error: `Insufficient stock at source location. Available: ${available}, Requested: ${quantity}`,
      };
    }

    // Execute atomic balance updates
    this.ds.updateBalance(sourceLocationId, itemId, sourceStatus, -quantity);
    this.ds.updateBalance(destinationLocationId, itemId, destinationStatus, quantity);

    const txnNumber = `TXN-2026-${String(this.ds.getTransactions().length + 1).padStart(5, '0')}`;
    const txn: InventoryTransaction = {
      id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      transactionNumber: txnNumber,
      transactionType,
      date: new Date().toISOString(),
      itemId,
      quantity,
      sourceLocationId,
      destinationLocationId,
      referenceType,
      referenceId,
      responsiblePerson,
      notes,
      createdBy: user,
      timestamp: new Date().toISOString(),
    };

    this.ds.addTransaction(txn);
    this.ds.logAudit(
      user,
      'store_operator',
      'STOCK_MOVE',
      'InventoryTransaction',
      txn.transactionNumber,
      `Moved ${quantity} pcs of item ${itemId} from ${sourceLocationId} to ${destinationLocationId} via ${referenceType}:${referenceId}`
    );

    return { success: true, transaction: txn };
  }

  /**
   * Production Transfer Note (PTN) Execution
   */
  public postPTN(ptn: PTNDocument, user: string): { success: boolean; error?: string } {
    for (const item of ptn.items) {
      const res = this.moveStock({
        itemId: item.itemId,
        quantity: item.quantity,
        sourceLocationId: ptn.sourceLocationId,
        sourceStatus: 'untrimmed',
        destinationLocationId: ptn.destinationLocationId,
        destinationStatus: ptn.destinationLocationId.includes('ws') || ptn.destinationLocationId === 'loc-ws-bay' ? 'in_trimming' : 'untrimmed',
        transactionType: 'internal_transfer',
        referenceType: 'PTN',
        referenceId: ptn.ptnNumber,
        responsiblePerson: ptn.assignedPersonId || 'Workstation Operator',
        notes: `PTN ${ptn.ptnNumber} transfer: ${item.reason || 'Floor movement'}`,
        user,
      });

      if (!res.success) {
        return res;
      }
    }

    ptn.status = 'completed';
    this.ds.addPTN(ptn);
    this.ds.logAudit(user, 'production_supervisor', 'POST_PTN', 'PTNDocument', ptn.ptnNumber, `Posted PTN with ${ptn.items.length} lines`);
    return { success: true };
  }

  /**
   * Outward Gate Pass (OGP) Execution for Outsourced Trimming
   */
  public issueOGP(ogp: OGPDocument, user: string): { success: boolean; error?: string } {
    const vendor = this.ds.getOutsourcedVendors().find((v) => v.id === ogp.vendorId);
    if (!vendor) return { success: false, error: 'Vendor not found' };

    // Move each item from raw store to vendor site
    for (const item of ogp.items) {
      const res = this.moveStock({
        itemId: item.itemId,
        quantity: item.quantity,
        sourceLocationId: 'loc-raw-store',
        sourceStatus: 'untrimmed',
        destinationLocationId: 'loc-vend-apex', // Assigned vendor site location
        destinationStatus: 'untrimmed',
        transactionType: 'issue',
        referenceType: 'OGP',
        referenceId: ogp.ogpNumber,
        responsiblePerson: vendor.contactPerson || vendor.name,
        notes: `OGP Issue to ${vendor.name}`,
        user,
      });

      if (!res.success) {
        return res;
      }
    }

    vendor.currentOutstandingQty += ogp.totalIssuedQuantity;
    this.ds.addOGP(ogp);
    this.ds.logAudit(user, 'store_operator', 'ISSUE_OGP', 'OGPDocument', ogp.ogpNumber, `Issued ${ogp.totalIssuedQuantity} pcs to vendor ${vendor.name}`);
    return { success: true };
  }

  /**
   * Inward Gate Pass (IGP) Return Execution
   */
  public receiveIGP(igp: IGPDocument, user: string): { success: boolean; error?: string } {
    const ogp = this.ds.getOGPs().find((o) => o.id === igp.ogpId);
    if (!ogp) return { success: false, error: 'Associated OGP not found.' };

    const vendor = this.ds.getOutsourcedVendors().find((v) => v.id === igp.vendorId);
    if (!vendor) return { success: false, error: 'Vendor not found.' };

    // Move returned parts from vendor site to QC Holding
    for (const item of igp.items) {
      // Find matching item in OGP
      const ogpItem = ogp.items.find((oi) => oi.itemId === item.itemId);
      if (ogpItem) {
        ogpItem.returnedQuantity += item.quantityReturned;
      }

      const res = this.moveStock({
        itemId: item.itemId,
        quantity: item.quantityReturned,
        sourceLocationId: 'loc-vend-apex',
        sourceStatus: 'untrimmed',
        destinationLocationId: igp.receivingLocationId || 'loc-qc-hold',
        destinationStatus: 'qc_pending',
        transactionType: 'vendor_return',
        referenceType: 'IGP',
        referenceId: igp.igpNumber,
        responsiblePerson: igp.receivedBy,
        notes: `Returned from vendor ${vendor.name} via IGP ${igp.igpNumber}`,
        user,
      });

      if (!res.success) return res;
    }

    vendor.currentOutstandingQty = Math.max(0, vendor.currentOutstandingQty - igp.totalReturnedQuantity);
    this.ds.updateOGP(ogp);
    this.ds.addIGP(igp);
    this.ds.logAudit(user, 'store_operator', 'RECEIVE_IGP', 'IGPDocument', igp.igpNumber, `Received ${igp.totalReturnedQuantity} pcs return from ${vendor.name}`);
    return { success: true };
  }

  /**
   * Quality Control Inspection Execution
   * Rule: inspected = accepted + rejected
   */
  public executeQCInspection(qc: QCInspection, user: string): { success: boolean; error?: string } {
    if (qc.quantityAccepted + qc.quantityRejected !== qc.quantityInspected) {
      return {
        success: false,
        error: `QC Rule Violation: Inspected quantity (${qc.quantityInspected}) must equal Accepted (${qc.quantityAccepted}) + Rejected (${qc.quantityRejected}).`,
      };
    }

    // 1. Accepted pieces move to Finished Store
    if (qc.quantityAccepted > 0) {
      const resAccepted = this.moveStock({
        itemId: qc.itemId,
        quantity: qc.quantityAccepted,
        sourceLocationId: 'loc-qc-hold',
        sourceStatus: 'qc_pending',
        destinationLocationId: qc.destinationLocationId || 'loc-fin-store',
        destinationStatus: 'approved_finished',
        transactionType: 'approved_stock',
        referenceType: 'QC',
        referenceId: qc.inspectionNumber,
        responsiblePerson: qc.inspector,
        notes: `QC Accepted: ${qc.quantityAccepted} units passed standard inspection`,
        user,
      });
      if (!resAccepted.success) return resAccepted;
    }

    // 2. Rejected pieces move to Rework Holding
    if (qc.quantityRejected > 0) {
      const resRejected = this.moveStock({
        itemId: qc.itemId,
        quantity: qc.quantityRejected,
        sourceLocationId: 'loc-qc-hold',
        sourceStatus: 'qc_pending',
        destinationLocationId: 'loc-rework',
        destinationStatus: 'rework_holding',
        transactionType: 'rework_transfer',
        referenceType: 'QC',
        referenceId: qc.inspectionNumber,
        responsiblePerson: qc.inspector,
        notes: `QC Rejected: ${qc.quantityRejected} units routed to Rework Holding`,
        user,
      });
      if (!resRejected.success) return resRejected;
    }

    // 3. Auto-generate Vendor Piece-Rate Earning for Accepted Quantity
    if (qc.referenceType === 'work_order') {
      const wo = this.ds.getWorkOrders().find((w) => w.id === qc.referenceId);
      if (wo) {
        const worker = this.ds.getWorkers().find((w) => w.id === wo.assignedWorkerId);
        if (worker && worker.type === 'in_house_vendor') {
          const item = this.ds.getItems().find((i) => i.id === qc.itemId);
          const rate = worker.defaultPieceRate || (item ? item.defaultTrimmingRate : 2.5);
          const earnedPkr = qc.quantityAccepted * rate;

          const earning: VendorEarning = {
            id: `earn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            vendorId: worker.id,
            vendorType: 'in_house_vendor',
            referenceType: 'work_order',
            referenceId: wo.id,
            itemId: qc.itemId,
            quantityEligible: qc.quantityAccepted,
            ratePerPiece: rate,
            amountPkr: earnedPkr,
            isApproved: false,
            isPaid: false,
            createdAt: new Date().toISOString(),
          };
          this.ds.addVendorEarning(earning);
        }
      }
    }

    this.ds.addQCInspection(qc);
    this.ds.logAudit(
      user,
      'qc_inspector',
      'QC_INSPECTION',
      'QCInspection',
      qc.inspectionNumber,
      `Inspected ${qc.quantityInspected} pcs (Accepted: ${qc.quantityAccepted}, Rejected: ${qc.quantityRejected})`
    );

    return { success: true };
  }

  /**
   * Rework Order Creation & Closed-Loop Lineage
   */
  public createReworkOrder(ro: ReworkOrder, user: string): { success: boolean; error?: string } {
    this.ds.addReworkOrder(ro);
    this.ds.logAudit(
      user,
      'production_supervisor',
      'CREATE_REWORK',
      'ReworkOrder',
      ro.reworkOrderNumber,
      `Created Rework Order for ${ro.quantityToRework} pcs linked to QC ${ro.qcInspectionId} (Cycle #${ro.cycleNumber})`
    );
    return { success: true };
  }

  /**
   * Shift Work Order Closing & Material Reconciliation
   * Invariant: Issued = Trimmed + Untrimmed Returned + Workstation Closing Balance
   */
  public closeShiftWorkOrder(params: {
    workOrder: WorkOrder;
    actualTrimmed: number;
    returnedUntrimmed: number;
    closingBalanceAtWs: number;
    downtimeMinutes: number;
    delayReason?: string;
    notes?: string;
    user: string;
  }): { success: boolean; error?: string } {
    const { workOrder, actualTrimmed, returnedUntrimmed, closingBalanceAtWs, downtimeMinutes, delayReason, notes, user } = params;

    const totalAccounted = actualTrimmed + returnedUntrimmed + closingBalanceAtWs;
    if (totalAccounted !== workOrder.quantityIssued) {
      return {
        success: false,
        error: `Shift Material Imbalance! Quantity Issued (${workOrder.quantityIssued}) != Trimmed (${actualTrimmed}) + Returned (${returnedUntrimmed}) + Closing Balance (${closingBalanceAtWs}) [Sum = ${totalAccounted}]. Discrepancy: ${workOrder.quantityIssued - totalAccounted} pcs.`,
      };
    }

    // 1. Move trimmed parts from WS to QC Holding
    if (actualTrimmed > 0) {
      this.moveStock({
        itemId: workOrder.itemId,
        quantity: actualTrimmed,
        sourceLocationId: 'loc-ws-bay',
        sourceStatus: 'in_trimming',
        destinationLocationId: 'loc-qc-hold',
        destinationStatus: 'qc_pending',
        transactionType: 'qc_transfer',
        referenceType: 'WO',
        referenceId: workOrder.workOrderNumber,
        responsiblePerson: workOrder.assignedWorkerId,
        notes: `Shift closing transfer to QC Holding`,
        user,
      });
    }

    // 2. Return untrimmed material back to raw store
    if (returnedUntrimmed > 0) {
      this.moveStock({
        itemId: workOrder.itemId,
        quantity: returnedUntrimmed,
        sourceLocationId: 'loc-ws-bay',
        sourceStatus: 'in_trimming',
        destinationLocationId: 'loc-raw-store',
        destinationStatus: 'untrimmed',
        transactionType: 'production_return',
        referenceType: 'WO',
        referenceId: workOrder.workOrderNumber,
        responsiblePerson: workOrder.assignedWorkerId,
        notes: `Shift end return of unworked material`,
        user,
      });
    }

    workOrder.actualTrimmedQuantity = actualTrimmed;
    workOrder.quantitySentToQc = actualTrimmed;
    workOrder.quantityReturnedUntrimmed = returnedUntrimmed;
    workOrder.closingBalance = closingBalanceAtWs;
    workOrder.downtimeMinutes = downtimeMinutes;
    workOrder.delayReason = delayReason;
    workOrder.status = 'closed';
    workOrder.supervisorNotes = notes;
    workOrder.verifiedBy = user;

    this.ds.updateWorkOrder(workOrder);
    this.ds.logAudit(
      user,
      'production_supervisor',
      'CLOSE_WORK_ORDER',
      'WorkOrder',
      workOrder.workOrderNumber,
      `Closed shift job order. Trimmed: ${actualTrimmed}, Returned: ${returnedUntrimmed}, WS Closing: ${closingBalanceAtWs}`
    );

    return { success: true };
  }

  /**
   * Monthly Stocktaking Variance Adjustment
   */
  public postStockAdjustment(line: StockCountLine, investigator: string, approver: string, user: string): { success: boolean; error?: string } {
    if (line.varianceQuantity === 0) {
      return { success: false, error: 'Variance is zero; no adjustment needed.' };
    }

    const absQty = Math.abs(line.varianceQuantity);
    const txnType = 'adjustment';

    if (line.varianceQuantity > 0) {
      // Physical > Book: Credit inventory
      this.ds.updateBalance(line.locationId, line.itemId, line.status, absQty);
    } else {
      // Physical < Book: Debit inventory
      this.ds.updateBalance(line.locationId, line.itemId, line.status, -absQty);
    }

    const txnNumber = `TXN-2026-${String(this.ds.getTransactions().length + 1).padStart(5, '0')}`;
    const txn: InventoryTransaction = {
      id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      transactionNumber: txnNumber,
      transactionType: txnType,
      date: new Date().toISOString(),
      itemId: line.itemId,
      quantity: absQty,
      sourceLocationId: line.varianceQuantity > 0 ? 'loc-mld' : line.locationId,
      destinationLocationId: line.varianceQuantity > 0 ? line.locationId : 'loc-qc-rej',
      referenceType: 'STOCKTAKE',
      referenceId: line.id,
      responsiblePerson: investigator,
      approvedBy: approver,
      notes: `Audited physical count adjustment. Variance: ${line.varianceQuantity > 0 ? '+' : ''}${line.varianceQuantity} pcs (${formatPKR(line.varianceValuePkr)}). Notes: ${line.investigationNotes || 'Routine reconciliation'}`,
      createdBy: user,
      timestamp: new Date().toISOString(),
    };

    this.ds.addTransaction(txn);
    line.adjustmentPosted = true;

    this.ds.logAudit(
      user,
      'manager_approver',
      'STOCK_ADJUSTMENT',
      'StockCountLine',
      line.id,
      `Approved variance adjustment of ${line.varianceQuantity} pcs for item ${line.itemCode} at location ${line.locationName}`
    );

    return { success: true };
  }
}
