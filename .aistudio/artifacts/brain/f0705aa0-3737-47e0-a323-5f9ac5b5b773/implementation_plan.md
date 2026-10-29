# Trimming Production, Inventory, Quality Control & Cost Management System

An enterprise-grade, transaction-based manufacturing execution and inventory management web application for plastic moulded parts and multi-stage trimming operations.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following key decisions were confirmed during the interactive clarification phase and are incorporated directly into this architectural blueprint:
>
> - **Database Strategy**: Firebase Firestore & Firebase Authentication for secure multi-device synchronization, real-time reactive stock updates, and field-level security rules, paired with an Express full-stack engine capable of running standalone in Docker and LAN environments with JSON/SQL backup export.
> - **Primary Currency & Localization**: Pakistani Rupee (**PKR / Rs.**), formatted with tabular numerals (`₨ #,##0.00`).
> - **Rework Payment Policy Default**: Configurable per job order with supervisor approval required (allowing zero-rate default for operator error rework while permitting authorized piece-rate compensation when reassigned or when caused by raw molding defects).
> - **Workstation Range**: Native support for **WS-01 through WS-70** out of the box, with dynamic configuration to add, rename, or deactivate workstations.

---

## 1. Overview & Core Concept

### What It Does
The system is a real-time, transaction-authoritative manufacturing operations platform specifically engineered for plastic moulding trimming plants. It eliminates physical untracked material loss, automates piece-rate vendor settlements, isolates quality defects, and calculates true per-part finished costs by unifying:
1. **Material Traceability**: From raw moulding receipt through multi-stage trimming, inspection, rework, and finished packing.
2. **Accountability via Documents**: Strict requirement of sequential **Production Transfer Notes (PTNs)** for all internal moves, **Outward Gate Passes (OGPs)** for outsourced issues, and **Inward Gate Passes (IGPs)** for vendor returns.
3. **Capacity & Target Planning**: Shift-wise workstation scheduling (WS-01 to WS-70) calculating targets from pieces-per-hour (PPH) × productive hours, with clear visual shortage indicators.
4. **Closed-Loop QC & Rework**: Multi-cycle rework tracking preserving genealogy back to original work orders and vendors without overwriting historical records.
5. **Dual Labor Accounting**: Separate vendor piece-rate payables (PKR) and employee salary cost allocation without generating false employee payable liabilities.
6. **Monthly Physical Stock Reconciliation**: Snapshot-based blind stocktaking with auditable discrepancy investigation and variance adjustment journals.

### Target Audience & Personas
- **Store Operator / Warehouse Clerk**: Records moulding receipts, issues materials to workstations via PTNs, prepares OGPs, accepts IGPs, and performs physical stock counts.
- **Production Planner**: Formulates shift schedules, checks untrimmed stock availability, assigns items and workers to workstations WS-01..WS-70, and generates job orders.
- **Production Supervisor**: Verifies workstation output, enters physical shift report sheets, logs downtime and delay reasons, and submits closing shift reconciliations.
- **QC Inspector**: Inspects incoming trimmed batches (both in-house and vendor returns), logs defect classifications, accepts good pieces into finished stock, and routes rejects to rework.
- **Accounts & Cost Accountant**: Audits vendor piece-rate earnings, approves payment batches, inputs employee monthly salaries for overhead absorption, and reviews cost-per-unit variances.
- **Plant Manager / Executive**: Monitors real-time plant KPIs (Production Attainment, First-Pass Quality Rate, Good-Output Efficiency, Workstation OEE, Vendor balances) and exports operational audit packs.

---

## 2. System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PRESENTATION LAYER (React 19)                            │
│  ┌───────────────────────┐  ┌─────────────────────────┐  ┌────────────────────────────┐ │
│  │   Operational Views   │  │   Physical Floor Tools  │  │   Reporting & Auditing     │ │
│  │ · Planning & WS Matrix│  │ · QR/Barcode Scanner    │  │ · 25+ Filtered Reports     │ │
│  │ · Work Orders & Shifts│  │ · Printable PTN / OGP   │  │ · Excel / CSV Exporters    │ │
│  │ · QC & Rework Cycles  │  │ · Paper Sheet Digitizer │  │ · Cost Breakdown Engine    │ │
│  │ · Vendor Ledger (PKR) │  │ · Stocktaking Audit UI  │  │ · Executive KPI Dashboards │ │
│  └───────────┬───────────┘  └────────────┬────────────┘  └─────────────┬──────────────┘ │
└──────────────┼───────────────────────────┼─────────────────────────────┼────────────────┘
               ▼                           ▼                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                APPLICATION CORE & STATE                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Inventory Transaction Engine                                                     │  │
│  │  · Double-entry movement ledger (Source (-) ──► Destination (+))                  │  │
│  │  · Atomicity validation (Pre-check non-negative balances & lock reservations)     │  │
│  │  · Status distinction (Untrimmed, Trimmed, QC-Pending, Rework, Approved, Packing) │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────┐ ┌───────────────────────────┐ ┌─────────────────────────┐ │
│  │  Planning & Target Logic │ │   QC & Lineage Tracker    │ │   Cost & Ledger Engine  │ │
│  │  · PPH × Shift Net Hours │ │   · Inspected = Pass+Fail │ │   · Piece-rate (PKR)    │ │
│  │  · Stock reservation     │ │   · Multi-cycle Rework PTN│ │   · Labor absorption    │ │
│  │  · Shortage detection    │ │   · Original link memory  │ │   · Baseline + Trimming │ │
│  └──────────────────────────┘ └───────────────────────────┘ └─────────────────────────┘ │
└──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                             PERSISTENCE & SECURITY LAYER                                │
│  ┌───────────────────────────────────────────────┐ ┌──────────────────────────────────┐  │
│  │           Firebase Firestore Database         │ │      Firebase Authentication     │  │
│  │  · /inventory_transactions (Immutable)        │ │  · Multi-role RBAC authorization │  │
│  │  · /stock_balances (Location + Item balance)  │ │  · Approval limit gates          │  │
│  │  · /ptn_documents, /ogp_documents, /igp_docs  │ │  · Strict session management     │  │
│  │  · /work_orders, /rework_orders, /qc_records  │ └──────────────────────────────────┘  │
│  │  · /vendor_ledgers, /stocktaking_sessions     │ ┌──────────────────────────────────┐  │
│  │  · /audit_logs (Immutable user event history) │ │    Express Backup & Docker Sync  │  │
│  └───────────────────────────────────────────────┘ │  · JSON/PostgreSQL export dumps   │  │
│                                                    │  · Offline cache synchronization │  │
│                                                    └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema & Firestore Data Model

The data architecture uses normalized documents and transaction collections to enforce referential integrity and prevent data anomalies.

### Core Collections
1. **`companies` & `config`**: Plant parameters, fiscal years, currency (`PKR`), barcode standards, and approval thresholds.
2. **`users` & `user_roles`**: User IDs, names, emails, assigned roles (`admin`, `store_operator`, `production_planner`, `production_supervisor`, `qc_inspector`, `accounts_user`, `manager_approver`, `readonly_management`), and approval limits.
3. **`items`**:
   - `id`: Unique key.
   - `item_code`: e.g. `MLD-001` (untrimmed) vs `TRM-001` (trimmed).
   - `description`: Name and plastic resin specification.
   - `unit_of_measure`: `pcs`, `kg`, etc.
   - `category`: `untrimmed_molding`, `intermediate`, `trimmed_finished`.
   - `parent_item_id`: Reference to preceding moulding item for stage transitions.
   - `baseline_manufacturing_cost`: Unit cost before trimming (PKR).
   - `expected_capacity_pph`: Standard pieces per hour (e.g. 120 pcs/hr).
   - `default_trimming_rate`: Financial amount per accepted piece (e.g. Rs. 2.50).
   - `qc_required`: Boolean.
   - `rework_rule`: Configurable policy (`unpaid_original`, `rate_applicable`, `supervisor_decision`).
4. **`locations` & `sublocations`**:
   - Hierarchical structure: Main Trimming Store, Molding Dept, Racks (Rack A..Z), Shelves (A-01, A-02), Bins, QC Holding, QC Rejected, Rework Holding, Packing, Dispatch, and Accountable Workstations (WS-01 to WS-70) and Vendor Accounts.
5. **`stock_balances`** (Material State Register):
   - Compound Key: `location_id` + `item_id` + `status` (`untrimmed`, `in_trimming`, `qc_pending`, `rework_holding`, `approved_finished`).
   - `quantity_on_hand`: Current physical count.
   - `quantity_reserved`: Reserved for active scheduled work orders.
   - `last_transaction_id`: Reference to latest mutating ledger record.
6. **`inventory_transactions`** (The Immutable Ledger):
   - `transaction_id`: Sequential system ID (`TXN-2026-00001`).
   - `transaction_type`: `receipt`, `issue`, `internal_transfer`, `consumption`, `production_return`, `qc_transfer`, `rework_transfer`, `approved_stock`, `vendor_return`, `adjustment`, `opening_balance`.
   - `item_id`, `quantity`, `source_location_id`, `destination_location_id`.
   - `reference_document_type` (`PTN`, `OGP`, `IGP`, `WO`, `QC`, `STOCKTAKE`).
   - `reference_document_id`, `responsible_person_id`, `created_by`, `approved_by`, `timestamp`.
7. **`ptn_documents`** (Production Transfer Notes):
   - `ptn_number`: Sequential format (`PTN-2026-0001`).
   - `transfer_date`, `source_location_id`, `destination_location_id`, `workstation_id`, `assigned_worker_id`.
   - `items`: Array of `{ item_id, quantity, stage, work_order_id, reason }`.
   - `status`: `draft`, `pending_approval`, `approved`, `completed`, `cancelled`.
   - `qr_code_payload`: Encoded JSON string for fast scanner retrieval.
8. **`workstations`**:
   - `code`: `WS-01` to `WS-70`.
   - `name`, `status` (`active`, `maintenance`, `inactive`), `current_operator_id`.
9. **`shifts`**:
   - `code`: Shift A (Morning), Shift B (Evening), Shift C (Night/Overnight).
   - `start_time`, `end_time`, `break_duration_minutes`, `net_productive_hours`.
10. **`workers`** (In-House Vendors & Employees):
    - `worker_code`, `full_name`, `type` (`in_house_vendor` vs `employee`).
    - `monthly_salary`: Recorded for employees solely for cost allocation (PKR).
    - `default_piece_rate`: For in-house vendors.
11. **`outsourced_vendors`**:
    - `vendor_code`, `vendor_name`, `workforce_count`, `daily_working_hours`, `contact_details`.
    - `current_outstanding_qty`: Calculated running balance of parts held.
12. **`work_orders`** (Internal Shift Job Orders):
    - `work_order_number`: `WO-2026-0001`.
    - `workstation_id`, `shift_id`, `assigned_worker_id`, `item_id`, `stage_id`.
    - `planned_quantity`: Calculated target (`PPH × Net Hours`).
    - `quantity_issued` (via PTN), `actual_trimmed_quantity`, `quantity_sent_to_qc`, `quantity_rejected`, `quantity_returned_untrimmed`, `closing_balance`.
    - `downtime_minutes`, `delay_reasons`, `status` (`scheduled`, `in_progress`, `closed`, `reconciled`).
13. **`vendor_job_orders`**, **`ogp_documents`**, **`igp_documents`**:
    - Complete multi-item issue and partial return tracking.
    - OGP issued quantity, IGP partial returns, running balance held by vendor.
14. **`qc_inspections`** & **`rejection_records`**:
    - `inspection_number`: `QC-2026-0001`.
    - `reference_type` (`internal_wo` or `vendor_igp`), `reference_id`.
    - `quantity_inspected`, `quantity_accepted`, `quantity_rejected` (Strict invariant: `accepted + rejected == inspected`).
    - `defect_breakdown`: `[{ defect_type: 'flash_overtrim', count: 12 }, ...]`.
    - `inspector_id`, `approval_id`, `photo_urls`.
15. **`rework_orders`**:
    - `rework_order_number`: `RW-2026-0001`.
    - `parent_qc_id`, `parent_work_order_id`, `original_worker_id`.
    - `assigned_to_id`, `assigned_to_type` (`employee`, `in_house_vendor`, `outsourced_vendor`).
    - `quantity_to_rework`, `rework_completed_qty`, `payment_eligibility` (`unpaid`, `standard_rate`, `special_approved_rate`).
    - `subsequent_qc_id`, `cycle_iteration_number` (supports 1st rework, 2nd rework).
16. **`vendor_earnings`** & **`vendor_payment_batches`**:
    - Line-item earned credits from approved QC quantities.
    - `calculated_amount_pkr = approved_qty × piece_rate`.
    - Payment batches: `batch_number`, `vendor_id`, `total_paid_pkr`, `payment_date`, `bank_reference`, `deductions`.
17. **`stocktaking_sessions`** & **`stock_count_lines`**:
    - Session header: `session_id`, `count_date`, `status` (`in_progress`, `frozen`, `reconciled`).
    - Lines: `location_id`, `item_id`, `book_quantity`, `physical_count`, `variance_qty`, `variance_value_pkr`, `investigation_notes`, `adjustment_posted`.
18. **`audit_events`**:
    - Immutable log of every security check, status transition, document generation, and approval action.

---

## 4. Proposed Modules & User Interface Specifications

### Module 1: Operations Command Center & KPI Dashboard
- **Header**: Live shift indicator, active plant date, quick document lookup via search/scanner.
- **KPI Metrics Strip** (using tabular numerals):
  - *Production Attainment*: `(Actual Trimmed / Planned Target) × 100`.
  - *First-Pass Quality Rate (FPQR)*: `(1st-Pass Accepted / Total Inspected) × 100`.
  - *Good-Output Efficiency*: `(QC Accepted / Planned Target) × 100`.
  - *Active Workstations*: Operational count out of 70 stations.
  - *Material at Risk*: Total stock in QC Pending and Rework Holding.
  - *Vendor Outstanding Material*: Total pieces currently outside plant with vendors.
- **Floor Activity Feeds**: Recent PTNs, pending supervisor sign-offs, and active shift progress bars.

### Module 2: Master Data Management
- **Item Master**: Setup untrimmed raw items (`MLD-xxx`) and trimmed finished items (`TRM-xxx`), baseline costs, capacity PPH, default piece rates, and multi-stage routing.
- **Plant Layout & Racks**: Racks (Rack A..Z), Shelves, Bins, and dedicated QC/Rework storage areas.
- **Workstation Fleet (WS-01 to WS-70)**: Interactive 70-station grid showing workstation status, current worker, assigned shift, and real-time output.
- **Workers & Vendors**: In-house piece-rate vendors, outsourced vendors (with workforce counts and daily capacities), and salaried employees.

### Module 3: Inventory Transaction Engine & Opening Balances
- **Opening Balance Setup**: Formal opening balance wizard with verification, supporting opening balances for untrimmed stock, trimmed stock, vendor-held material, and rework holding.
- **Material Movement Ledger**: Full searchable history of all movements with before/after balances, user stamps, and filterable dimensions.
- **Stock Balance Explorer**: Real-time tree view of stock across all locations and statuses.

### Module 4: Production Transfer Notes (PTNs)
- **PTN Creator**: Multi-item internal transfer wizard (Molding ➔ Store, Store ➔ Workstation, Workstation ➔ QC, QC ➔ Rework, Approved ➔ Packing).
- **Approval Gate**: Routine transfers auto-postable; large transfers or cross-department adjustments require supervisor approval.
- **Printable PTN**: Formatted 80mm / A4 printable document with barcode and QR code for floor scanning.

### Module 5: Production Planning & Scheduling
- **Shift Matrix (WS-01..WS-70)**: Shift-wise visual planner for Shifts A, B, and C.
- **Target Calculator**: Auto-computes suggested targets from `PPH × Net Working Hours`.
- **Shortage Warning Banner**: Flags insufficient untrimmed inventory and prevents over-reserving physical stock.

### Module 6: Internal Work Orders & Paper Shift Sheet Entry
- **Printable Shift Sheet**: Standardized printable paper job order for workstation operators to log hourly counts, downtime, and material returns.
- **Shift Digitizer UI**: Quick-entry modal for supervisors to transcribe paper shift sheets into the system at shift closing, with automatic balance reconciliation (`Issued = Trimmed + Untrimmed Returned + Workstation Closing Balance`).

### Module 7: Outsourced Vendor Management, OGP & IGP
- **Vendor Workload & Capacity**: Real-time monitor of vendor workforce, capacity, and outstanding parts.
- **Outward Gate Pass (OGP)**: Material issue documentation with assigned piece rates, expected return dates, and QR codes.
- **Inward Gate Pass (IGP)**: Partial return receipt module linked to OGPs, updating outstanding vendor balances immediately upon receipt.

### Module 8: Quality Control (QC) & Inspection
- **Inspection Terminal**: Touch/desktop friendly inspection screen enforcing the rule: `inspected = accepted + rejected`.
- **Defect Classification**: Categorized rejection tagging (flash, short mould, sink mark, over-trim gouge, parting line defect).
- **Disposition Routing**: Accepted parts automatically transfer to `Approved Finished Stock`; rejected parts route directly to `Rework Holding`.

### Module 9: Closed-Loop Rework Management
- **Rework Job Order**: Generates rework orders assigned to original worker, substitute in-house vendor, or outsourced vendor.
- **Lineage Chain**: Permanent audit link connecting `Original WO ➔ QC Rejection ➔ Rework PTN ➔ Rework WO ➔ Re-inspection ➔ Final Output`.
- **Rework Payment Approval**: Supervisor authorization toggle for piece-rate eligibility on rework operations.

### Module 10: Vendor Settlement & Payment Ledgers (PKR)
- **In-House Vendor Ledger**: Automatically calculates earned piece-rate amounts from QC-accepted production.
- **Outsourced Vendor Ledger**: Tracks OGP piece rates, IGP accepted counts, approved earnings, payment advances, and outstanding payable balances in PKR.
- **Payment Batch Processing**: Accounts module to create payment vouchers, record transaction references, and prevent double-payments.

### Module 11: Employee Labour Cost Allocation
- **Salary Register**: Secure storage of monthly employee salary figures (used strictly for costing; no payment transactions created).
- **Cost Allocation Wizard**: Configurable allocation modes:
  - *Hour-Based*: Monthly salary divided by available hours, applied to workstation run time.
  - *Production-Based*: Salary distributed proportionally across accepted piece count.
  - *Hybrid*: Distinguishes productive hours, idle downtime, and rework time.

### Module 12: Product Costing Engine
- **Unit Cost Breakdown**:
  - Baseline Manufacturing Cost (PKR)
  - + In-House Trimming Cost (PKR)
  - + Outsourced Trimming Cost (PKR)
  - + Allocated Employee Labour Cost (PKR)
  - + Scrap / Unrecoverable Rework Cost (PKR)
  - = **Total Finished Product Cost per Unit (PKR)**
- **Cost Trend Analytics**: Item-wise cost variation over time across different shifts, workstations, and vendor allocations.

### Module 13: Monthly Physical Stocktaking & Reconciliation
- **Session Initiation & Snapshot**: Freezes book stock quantities at count start.
- **Blind Count Entry**: Floor teams record counts without seeing system quantities (preventing bias).
- **Variance Audit & Adjustment**: Computes quantity and monetary variance (`Variance Qty × Unit Cost in PKR`), requires investigation comments, and generates approved adjustment transactions.

### Module 14: Barcode & QR Code Engine
- **Integrated Scanner**: Uses device camera or USB barcode scanner (keyboard wedge) to scan PTNs, OGPs, IGPs, Job Orders, Racks, and Items.
- **Label Generator**: Instant generation of printable labels with standard 2D QR codes and Code-128 barcodes.

### Module 15: Reporting, Analytics & Export Center
- **25 Comprehensive Production & Financial Reports** with multi-dimension filters (Date, Shift, Item, Workstation, Worker, Location, QC status).
- **One-Click Export**: Direct export to Microsoft Excel (`.xlsx`) and CSV.

### Module 16: User Roles, Permissions & Security Audit
- Role-based UI gating and server-side authorization.
- Approval limits for high-value stock adjustments and payments.
- Detailed audit timeline for all system events.

---

## 5. UI/UX & Visual Design System

Following the Universal Frontend Design Constitution and Enterprise SaaS/Dashboard guidelines:
- **Design Aesthetic**: Utilitarian, high-precision industrial operations console. Clean light/dark surfaces with high density and zero visual fluff.
- **Anti-Slop Discipline**:
  - **Zero-Pill Metadata**: Statuses and metadata displayed as clean unboxed text with typographic separators (`·` or `/`) and subtle text color distinctions, reserving pills/buttons solely for interactive segmented controls.
  - **Single Elevation Depth**: Flat, clean surfaces with subtle 1px hairline borders (`border-slate-200 dark:border-slate-800`). No nested cards within cards.
  - **No Decorative Pseudo-Tech**: No fake compiler tags, no pulsing status dots on static labels, no artificial scorecards, and no decorative bullet emoji.
- **Typography**:
  - Display & Headings: `Plus Jakarta Sans` for crisp industrial hierarchy.
  - Data, Timestamps & Currency: Monospace tabular numerals (`JetBrains Mono`, `tabular-nums`) across all inventory quantities, PKR amounts, and workstation metrics.
- **Color Palette (60-30-10 Rule)**:
  - 60% Canvas: Slate/Neutral light background (`#F8FAFC` light / `#0B0F19` dark).
  - 30% Structural: Crisp white/dark slate table surfaces, sidebars, and hairline borders.
  - 10% Accent & Semantic States: Precision industrial steel blue (`#2563EB`), muted emerald for accepted QC (`#16A34A`), amber for pending/rework (`#D97706`), and crimson for rejection (`#DC2626`).
- **Layout Math**: Desktop baseline optimized for 1440px wide screens with collapsible 260px operations sidebar, breadcrumb top-bar contract, and high-density 38px table rows with right-aligned numeric columns.

---

## 6. Mathematical Formulas & Business Invariants

1. **Inventory Conservation Law**:
   $$\sum \text{Stock across all locations} = \text{Opening Balances} + \text{Receipts} - \text{Dispatched Goods} \pm \text{Audited Adjustments}$$
2. **Work Order Shift Balance Reconciliation**:
   $$\text{Issued Qty} = \text{Trimmed Qty} + \text{Untrimmed Returned Qty} + \text{Workstation In-Process Closing Balance}$$
3. **QC Inspection Completeness**:
   $$\text{Quantity Inspected} \equiv \text{Quantity Accepted} + \text{Quantity Rejected}$$
4. **Production Attainment (%)**:
   $$\text{Attainment} = \left( \frac{\text{Actual Quantity Trimmed}}{\text{Planned Production Quantity}} \right) \times 100$$
5. **First-Pass Quality Rate (FPQR %)**:
   $$\text{FPQR} = \left( \frac{\text{Quantity Accepted on 1st Inspection}}{\text{Total Quantity Inspected}} \right) \times 100$$
6. **Good-Output Efficiency (%)**:
   $$\text{Efficiency} = \left( \frac{\text{Quantity Accepted by QC}}{\text{Planned Production Quantity}} \right) \times 100$$
7. **Production Target Calculation**:
   $$\text{Suggested Target} = \text{Standard Capacity (PPH)} \times \left( \text{Shift Hours} - \frac{\text{Break Minutes}}{60} \right)$$
8. **Vendor Earned Amount (PKR)**:
   $$\text{Earned PKR} = \sum (\text{QC-Approved Quantity} \times \text{Applicable Piece Rate})$$
9. **Total Finished Product Cost (PKR/Unit)**:
   $$\text{Finished Cost} = \text{Baseline Cost} + \text{Trimming Rate} + \left( \frac{\text{Allocated Employee Monthly Salary}}{\text{Period Accepted Production}} \right) + \text{Rework Allocation}$$

---

## 7. Phased Implementation Roadmap

### Phase 1: Foundation, RBAC, Firebase Integration & Core Transaction Engine
- Configure Firebase Authentication, Firestore database blueprint, and strict security rules.
- Set up Express backend with local file caching and export capability.
- Implement User & Role management (8 roles) and immutable audit log framework.
- Build the core **Inventory Transaction Engine** guaranteeing atomic double-entry stock updates and negative-stock prevention.

### Phase 2: Master Data & Location Hierarchy
- Implement Item Master (`MLD-xxx` untrimmed, intermediate, and `TRM-xxx` trimmed items).
- Configure Location, Rack, Shelf, and Bin hierarchy.
- Build the Workstation Fleet manager (**WS-01 through WS-70**), Shifts (A, B, C), and Worker/Vendor master registries.
- Implement the auditable Opening Balance initialization wizard.

### Phase 3: Production Transfer Notes (PTNs)
- Build the PTN document generation and approval workflow.
- Cover all internal movements (Molding ➔ Store, Store ➔ WS, WS ➔ QC, QC ➔ Rework, Approved ➔ Packing).
- Implement standard 2D QR code rendering and barcode label printing.

### Phase 4: Production Planning, Work Orders & Shift Sheets
- Build the Shift Scheduling Matrix for WS-01..WS-70 with automated `PPH × Net Hours` target calculation and stock reservation.
- Implement printable paper shift report sheets with operator signature zones.
- Build the Shift Digitizer UI with real-time material balance reconciliation.

### Phase 5: Outsourced Vendors, OGP & IGP
- Implement Outward Gate Pass (OGP) issuing and vendor capacity monitoring.
- Build Inward Gate Pass (IGP) multi-date partial return tracking with real-time outstanding vendor stock reconciliation.

### Phase 6: Quality Control (QC) & Multi-Cycle Rework Management
- Build the QC Inspection interface enforcing `accepted + rejected == inspected`.
- Implement categorized defect logging with photo upload capability.
- Implement the complete Rework Loop: `QC Rejection ➔ Rework Holding ➔ Rework PTN ➔ Rework WO ➔ Re-inspection ➔ Approved Stock` while retaining original job order lineage.

### Phase 7: Vendor Payment Ledgers & Employee Labour Costing
- Build In-House and Outsourced Vendor Payment Ledgers in PKR.
- Automated earnings calculation from QC-passed production with supervisor approval gates.
- Implement Employee Monthly Salary recording and configurable labour allocation modes (Hour, Production, Hybrid).

### Phase 8: Product Costing Engine
- Build the dynamic unit costing calculator combining baseline costs, vendor piece-rates, allocated employee salaries, and rework costs.
- Provide date-wise and item-wise cost trend comparisons.

### Phase 9: Monthly Physical Stocktaking & Reconciliation
- Snapshot-based physical count sessions with blind counting option.
- Automated variance calculations in units and PKR.
- Supervisory investigation notes and automated adjustment transaction creation.

### Phase 10: Floor Scanning, Printable Packs & 25 Reports
- Web camera and USB keyboard wedge barcode/QR scanner integration.
- Printer-friendly document formats for PTN, OGP, IGP, and Work Orders.
- Build all 25 operational and management reports with Excel/CSV export.

### Phase 11: End-to-End Automated Testing & Deployment Packaging
- Automated execution of all 9 test scenarios (Scenarios A through I from specification).
- Docker deployment configuration, environment setup, and automated JSON/PostgreSQL database backup/restore procedures.

---

## 8. Automated Testing Strategy (Scenarios A through I)

The system will include built-in test runners validating all critical business scenarios:
- **Scenario A (Internal Trimming)**: Receive 1,000 raw parts ➔ Rack A ➔ Issue 400 via PTN to WS-01 ➔ Trim 350 ➔ QC inspect (300 pass, 50 reject) ➔ Verify exact balance reconciliation (50 unworked, 50 rejected, 300 approved).
- **Scenario B (Outsourced Partial Returns)**: OGP 500 pcs ➔ Return 300 (IGP 1) ➔ Return 200 (IGP 2) ➔ Verify outstanding vendor balance is zero and job order completes only after QC.
- **Scenario C (Rework & Lineage)**: Reject 50 pcs ➔ Rework PTN ➔ Re-assign to WS-05 ➔ Complete rework ➔ Re-inspect (48 pass, 2 scrap) ➔ Verify unbroken audit trail to original order.
- **Scenario D (Payment Integrity)**: Verify QC-passed pieces generate approved earnings in PKR; confirm duplicate payment posting is rejected.
- **Scenario E (Planning & Double Reservation)**: Attempt to allocate 500 pcs when only 400 are unreserved ➔ Verify system rejects over-allocation and highlights shortage.
- **Scenario F (Stocktaking Reconciliation)**: Snapshot book stock ➔ Enter physical discrepancy ➔ Verify variance report in PKR ➔ Post adjustment ➔ Confirm ledger transaction created.
- **Scenario G (Concurrent Transactions)**: Verify that race conditions on inventory reservations are safely handled without negative stock.
- **Scenario H (Authorization & Permissions)**: Verify unauthorized users cannot approve payments, alter QC decisions, or post stock adjustments.
- **Scenario I (Backup & Recovery)**: Verify database snapshot exports and restores maintain complete transaction integrity.
