/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Receipt, CheckCircle, CreditCard, Plus, Filter, ShieldCheck, DollarSign } from 'lucide-react';
import { DataService } from '../services/storage';
import { formatPKR, formatNumber } from '../services/inventoryEngine';
import { VendorEarning, VendorPayment, Worker, OutsourcedVendor, Item } from '../types';

export const VendorSettlementView: React.FC = () => {
  const ds = DataService.getInstance();

  const [earnings, setEarnings] = useState<VendorEarning[]>(ds.getVendorEarnings());
  const [payments, setPayments] = useState<VendorPayment[]>(ds.getVendorPayments());
  const [workers, setWorkers] = useState<Worker[]>(ds.getWorkers());
  const [vendors, setVendors] = useState<OutsourcedVendor[]>(ds.getOutsourcedVendors());
  const [items, setItems] = useState<Item[]>(ds.getItems());

  const [activeTab, setActiveTab] = useState<'earnings' | 'payments'>('earnings');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState(workers[0]?.id || '');
  const [paymentAmount, setPaymentAmount] = useState(750);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'cheque'>('bank_transfer');
  const [paymentRef, setPaymentRef] = useState('FT-2026-9812');
  const [paymentNotes, setPaymentNotes] = useState('Fortnightly piece-rate clearance');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    return ds.subscribe(() => {
      setEarnings(ds.getVendorEarnings());
      setPayments(ds.getVendorPayments());
      setWorkers(ds.getWorkers());
      setVendors(ds.getOutsourcedVendors());
      setItems(ds.getItems());
    });
  }, [ds]);

  const getItem = (id: string) => items.find((i) => i.id === id);

  const getVendorName = (id: string) => {
    const w = workers.find((w) => w.id === id);
    if (w) return `${w.code} - ${w.name}`;
    const v = vendors.find((v) => v.id === id);
    if (v) return `${v.code} - ${v.name}`;
    return id;
  };

  // Financial totals
  const totalEarnedPkr = earnings.reduce((acc, e) => acc + e.amountPkr, 0);
  const totalApprovedPkr = earnings.filter((e) => e.isApproved).reduce((acc, e) => acc + e.amountPkr, 0);
  const totalPaidPkr = payments.reduce((acc, p) => acc + p.amountPaidPkr, 0);
  const outstandingPayablePkr = Math.max(0, totalApprovedPkr - totalPaidPkr);

  const handleApproveEarning = (id: string) => {
    ds.approveVendorEarning(id, 'Accounts Manager (Suleman)');
    setSuccessMsg('Earning line approved for payment disbursement!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleCreatePayment = (e: React.FormEvent) => {
    e.preventDefault();

    const seq = ds.getVendorPayments().length + 1;
    const batchNum = `PAY-2026-${String(seq).padStart(4, '0')}`;

    // Find unpaid approved earnings for this vendor
    const eligibleEarnings = earnings.filter(
      (earn) => earn.vendorId === selectedVendorId && earn.isApproved && !earn.isPaid
    );
    const earningIds = eligibleEarnings.map((earn) => earn.id);

    const newPayment: VendorPayment = {
      id: `pay-${Date.now()}`,
      batchNumber: batchNum,
      vendorId: selectedVendorId,
      vendorType: 'in_house_vendor',
      paymentDate: new Date().toISOString().slice(0, 10),
      amountPaidPkr: paymentAmount,
      paymentMethod,
      referenceNumber: paymentRef,
      notes: paymentNotes,
      approvedBy: 'Director of Finance',
      earningIds,
      createdAt: new Date().toISOString(),
    };

    ds.addVendorPayment(newPayment);
    ds.logAudit(
      'Accounts Manager',
      'accounts_user',
      'DISBURSE_PAYMENT',
      'VendorPayment',
      batchNum,
      `Paid ${formatPKR(paymentAmount)} to vendor ${selectedVendorId} via ${paymentMethod} ref: ${paymentRef}`
    );

    setSuccessMsg(`Successfully disbursed payment voucher ${batchNum} of ${formatPKR(paymentAmount)}!`);
    setIsPaymentModalOpen(false);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <span>Vendor Piece-Rate Settlement &amp; Payable Ledgers (PKR)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatic calculation of piece-rate credits from QC-approved quantities, approval gates, and anti-duplicate disbursement tracking.
          </p>
        </div>

        <button
          onClick={() => setIsPaymentModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors"
        >
          <CreditCard className="w-4 h-4" />
          <span>Record Vendor Payment</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Financial Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <span className="text-xs text-slate-500">Gross Earned (QC Passed)</span>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {formatPKR(totalEarnedPkr)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{earnings.length} piece-rate operations</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <span className="text-xs text-slate-500">Supervisor Approved</span>
          <div className="text-xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {formatPKR(totalApprovedPkr)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Cleared for disbursement</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <span className="text-xs text-slate-500">Disbursed Payments</span>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {formatPKR(totalPaidPkr)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{payments.length} payment batches</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <span className="text-xs text-slate-500">Outstanding Payable Balance</span>
          <div className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {formatPKR(outstandingPayablePkr)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Net vendor liability in PKR</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium w-fit">
        <button
          onClick={() => setActiveTab('earnings')}
          className={`px-4 py-1.5 rounded transition-colors ${
            activeTab === 'earnings'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Piece-Rate Earnings Ledger ({earnings.length})
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-1.5 rounded transition-colors ${
            activeTab === 'payments'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Payment Disbursement Batches ({payments.length})
        </button>
      </div>

      {/* Earnings Table */}
      {activeTab === 'earnings' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Vendor / Worker</th>
                  <th className="py-2.5 px-3 font-semibold">Origin Job Order</th>
                  <th className="py-2.5 px-3 font-semibold">Item Trimmed</th>
                  <th className="py-2.5 px-3 font-semibold text-right">QC Passed Quantity</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Piece Rate (PKR)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Earned Amount</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Approval Status</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Payment State</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {earnings.map((e) => {
                  const item = getItem(e.itemId);

                  return (
                    <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {getVendorName(e.vendorId)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {e.referenceId}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-medium">{item?.itemCode || e.itemId}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums font-bold text-slate-800 dark:text-slate-200">
                        {formatNumber(e.quantityEligible)} pcs
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-600 dark:text-slate-400">
                        {formatPKR(e.ratePerPiece)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                        {formatPKR(e.amountPkr)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                          e.isApproved ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40'
                        }`}>
                          {e.isApproved ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                          e.isPaid ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {e.isPaid ? 'PAID' : 'UNPAID'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {!e.isApproved && (
                          <button
                            onClick={() => handleApproveEarning(e.id)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-medium transition-colors"
                          >
                            Approve
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
      )}

      {/* Payments Table */}
      {activeTab === 'payments' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Voucher #</th>
                  <th className="py-2.5 px-3 font-semibold">Payment Date</th>
                  <th className="py-2.5 px-3 font-semibold">Vendor Paid</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Amount Disbursed</th>
                  <th className="py-2.5 px-3 font-semibold">Method</th>
                  <th className="py-2.5 px-3 font-semibold">Bank Reference #</th>
                  <th className="py-2.5 px-3 font-semibold">Authorized By</th>
                  <th className="py-2.5 px-3 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {p.batchNumber}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{p.paymentDate}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                      {getVendorName(p.vendorId)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                      {formatPKR(p.amountPaidPkr)}
                    </td>
                    <td className="py-2.5 px-3 uppercase text-slate-600 dark:text-slate-400">
                      {p.paymentMethod.replace('_', ' ')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{p.referenceNumber}</td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">
                      {p.approvedBy}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{p.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Disburse Vendor Payment Voucher (PKR)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Financial settlement of approved piece-rate obligations</p>
            </div>

            <form onSubmit={handleCreatePayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Payee Vendor</label>
                <select
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-medium"
                >
                  {workers
                    .filter((w) => w.type === 'in_house_vendor')
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {w.name}
                      </option>
                    ))}
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} - {v.name} (Outsourced)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Payment Amount (PKR)</label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold text-emerald-600 dark:text-emerald-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Disbursement Mode</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  >
                    <option value="bank_transfer">Bank Fund Transfer</option>
                    <option value="cash">Cash Voucher</option>
                    <option value="cheque">Bank Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Reference / Cheque #</label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Remarks</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium"
                >
                  Disburse &amp; Clear Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
