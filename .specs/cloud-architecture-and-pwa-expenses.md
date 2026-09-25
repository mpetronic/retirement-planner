# Cloud Architecture, PWA Expense Tracking & Multi-Decade Persistence Specification

## 1. Executive Summary & Vision

This specification defines the architecture, data models, security controls, backup strategy, and deployment workflows for migrating the **Retirement Planner** to a secure, resilient, and ultra-cost-effective AWS Cloud serverless backend.

It also introduces an **Offline-First Progressive Web App (PWA)** companion interface optimized for Android and desktop devices. This allows the user and their spouse to log day-to-day actual expenses on the go with zero network latency, automatically synchronizing with the central retirement planner to power annual budget variance reconciliation and dynamic multi-decade forecast calibration.

---

## 2. System Architecture & Component Diagram

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT CLIENTS                                    |
|                                                                                   |
|   +------------------------------------+   +----------------------------------+   |
|   |         Desktop Web Browser        |   |    Android Mobile Device (PWA)   |   |
|   |  - Full Retirement Planner SPA     |   |  - Dedicated Expense Logger App  |   |
|   |  - Simulation Engine & Workspaces  |   |  - Quick-Entry Keypad & History  |   |
|   |  - Bucket Management & Reports     |   |  - On-the-Fly Category Creation  |   |
|   |  - Annual Expense Reconciliation   |   |  - IndexedDB Optimistic Queue    |   |
|   +-----------------+------------------+   +----------------+-----------------+   |
|                     |                                       |                     |
+---------------------|---------------------------------------|---------------------+
                      | HTTPS (TLS 1.3)                       | HTTPS (TLS 1.3)
                      v                                       v
+-----------------------------------------------------------------------------------+
|                             AWS EDGE & HOSTING LAYER                              |
|                                                                                   |
|   +----------------------------------------------------------------------------+  |
|   |                  Amazon CloudFront CDN (Global Edge Network)               |  |
|   +---------------------+--------------------------------+---------------------+  |
|                         |                                |                        |
|                         v                                v                        |
|            +-------------------------+     +----------------------------+         |
|            | S3 Bucket (Static SPA)  |     |   Amazon API Gateway       |         |
|            | - index.html, JS, CSS   |     |   (REST API + JWT Auth)    |         |
|            | - Service Worker / PWA  |     +--------------+-------------+         |
|            +-------------------------+                    |                       |
+-----------------------------------------------------------|-----------------------+
                                                            |
                                                            v
+-----------------------------------------------------------------------------------+
|                            AWS COMPUTE & SECURITY LAYER                           |
|                                                                                   |
|   +----------------------------------+     +----------------------------------+   |
|   |       AWS Cognito User Pool      |     |     AWS Lambda (Node/TypeScript) |   |
|   |  - Individual User Accounts      |<----+  - JWT Verification              |   |
|   |  - Shared Household ID           |     |  - Business Logic & Endpoints    |   |
|   |  - TOTP MFA / Passkeys           |     |  - Optimistic Concurrency Checks |   |
|   +----------------------------------+     +--------------+-------------------+   |
+-----------------------------------------------------------|-----------------------+
                                                            |
                                                            v
+-----------------------------------------------------------------------------------+
|                            PERSISTENCE & STORAGE LAYER                            |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   |                    Amazon DynamoDB (On-Demand Capacity)                   |   |
|   |                                                                           |   |
|   |  +--------------------+  +--------------------+  +---------------------+  |   |
|   |  |  RetirementPlans   |  |  AnnualOperations  |  |   ActualExpenses    |  |   |
|   |  |  (Models & Config) |  |  (Bucket Execution)|  |   (Transaction Log) |  |   |
|   |  +--------------------+  +--------------------+  +---------------------+  |   |
|   |  - AES-256 Encryption at Rest                                             |   |
|   |  - Continuous Point-In-Time Recovery (PITR - 35 Days)                     |   |
|   +-------------------------------------+-------------------------------------+   |
|                                         |                                         |
+-----------------------------------------|-----------------------------------------+
                                          | Automated Snapshots / Export
                                          v
+-----------------------------------------------------------------------------------+
|                        MULTI-DECADE ARCHIVAL & BACKUP                             |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   |                  Amazon S3 Backup & Archival Bucket                       |   |
|   |  - S3 Versioning Enabled                                                  |   |
|   |  - S3 Lifecycle Rule: Transition to S3 Glacier Deep Archive (<$0.001/GB)   |   |
|   +---------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------+
```

---

## 3. Database Schema & Persistence Design

Data is organized across three discrete Amazon DynamoDB tables to prevent blast-radius crossover and optimize query efficiency.

### 3.1 Table 1: `RetirementPlans`
Stores static household profile assumptions, investment return models, tax settings, and versioned simulation plans.

- **Primary Partition Key (PK)**: `householdId` (String, e.g. `hh_fam_001`)
- **Primary Sort Key (SK)**: `itemType` (String)
- **Item Formats**:
  - Profile item: `SK = PROFILE`
  - Active baseline plan: `SK = PLAN#main#latest`
  - Versioned snapshot: `SK = PLAN#main#v0042`
- **Payload**: Full JSON simulation model (accounts, baseline expenses, customized expenses catalog, cash flows, tax parameters, bucket configuration).
- **Concurrency Control**: Updates enforce `ConditionExpression: attribute_exists(version) AND version = :expectedVersion`.

### 3.2 Table 2: `AnnualOperations`
Stores yearly operational execution state for retirement years (tracking real-world execution of the 3-Bucket strategy).

- **Primary Partition Key (PK)**: `householdId` (String)
- **Primary Sort Key (SK)**: `year` (String, e.g. `YEAR#2026`, `YEAR#2027`)
- **Payload Attributes**:
  - `bondLadderRungs`: Array of active/matured bond rungs (CUSIP, purchaseDate, maturityDate, principal, yield, status: `ACTIVE | MATURED`).
  - `bucketTasks`: Checklist items for the year (e.g., `refill_bucket_1: COMPLETED`, `roth_conversion_executed: $45000`, `monthly_checking_active: true`).
  - `startingBalances`: Actual initial balances for Bucket 1, Bucket 2, and Bucket 3.
  - `reconciliationNotes`: End-of-year sign-off comments and notes.

### 3.3 Table 3: `ActualExpenses`
High-frequency transaction stream for daily/monthly actual expense entries.

- **Primary Partition Key (PK)**: `householdId` (String)
- **Primary Sort Key (SK)**: `date_expenseId` (String, format: `YYYY-MM-DD#<uuid>`)
- **Global Secondary Index (GSI1)**:
  - `GSI1-PK`: `householdId`
  - `GSI1-SK`: `categoryId_date` (format: `cat_<id>#YYYY-MM-DD`)
- **Payload Attributes**:
  - `expenseId`: Unique UUID string.
  - `date`: `YYYY-MM-DD`.
  - `amount`: Number (USD).
  - `categoryId`: String (links to planned expense category).
  - `categoryName`: String (e.g. "Dining Out", "Groceries", "Roof Repair").
  - `enteredBy`: String (e.g. "Mike", "Wife").
  - `notes`: Optional string.
  - `tags`: Optional array of strings (e.g. `["Vacation-2026", "Hawaii"]`).
  - `createdAt`: ISO 8601 timestamp.
  - `updatedAt`: ISO 8601 timestamp.

---

## 4. REST API Endpoint Specification

All endpoints are hosted on Amazon API Gateway behind a Cognito JWT Authorizer.

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/plan` | Fetch the current active plan document for the household |
| `PUT` | `/api/plan` | Save updated plan document with version increment & concurrency check |
| `GET` | `/api/plan/history` | List plan revision history snapshots for rollback comparison |
| `GET` | `/api/operations/{year}` | Retrieve bucket tasks and bond ladder status for a given calendar year |
| `PUT` | `/api/operations/{year}` | Save/update operational checklist and ladder tasks for the year |
| `GET` | `/api/categories` | Retrieve all active expense categories |
| `POST` | `/api/categories` | Create a new custom expense category on the fly |
| `GET` | `/api/expenses?year=2026` | Query expenses for a specific calendar year or month |
| `POST` | `/api/expenses` | Log a new single expense transaction |
| `POST` | `/api/expenses/batch` | Synchronize a batch of offline-queued expenses |
| `PATCH` | `/api/expenses/{id}` | Edit an existing expense record |
| `DELETE` | `/api/expenses/{id}` | Remove an expense record |
| `GET` | `/api/export` | Download a complete sovereign JSON archive of all household data |

---

## 5. Mobile PWA & Offline Sync Architecture

### 5.1 Focused Companion Scope & Android Presentation
- **Companion-Only Scope**: The mobile PWA is intentionally built and scoped exclusively as a fast, single-purpose **Expense Logger companion application**. It deliberately does not load the desktop retirement simulations, Monte Carlo charts, or bucket management workspaces on mobile, keeping the bundle lightweight, fast-loading, and simple for both spouses to use.
- **Android WebAPK Installation**: Distributed via WebAPK generated by Android Chromium on "Add to Home screen".
- **Display Mode**: `standalone` with custom theme color, dark mode splash screen, home screen icon, and full-screen UI without browser URL navigation bars.

### 5.2 Storage & Offline Pipeline
- **IndexedDB**: Local on-device storage holds expense categories and pending transaction records.
- **Write Path**:
  1. User taps "Save".
  2. Record is written immediately to IndexedDB with `syncStatus = 'PENDING_SYNC'`.
  3. UI provides instantaneous visual confirmation (< 5ms latency).
  4. App registers a sync tag with the browser (`sync-expenses`).
- **Sync Path**:
  1. Android OS `WorkManager` / `JobScheduler` detects active network connectivity (`NetworkType.CONNECTED`).
  2. Chromium wakes the event-driven Service Worker thread.
  3. Service Worker queries IndexedDB for `PENDING_SYNC` items, sends `POST /api/expenses/batch` to API Gateway.
  4. Upon 200 OK response, local records are marked `SYNCED`.
  5. Fallback: Main UI thread flushes the queue whenever the app is brought to the foreground.

---

## 6. Expense Reconciliation & Category Feedback Loop

1. **On-The-Fly Category Creation**:
   - If an expense occurs in a new category (e.g. "Pet Vet Surgery"), the user creates the category directly in the mobile expense logger.
   - The backend records the category in the household registry.
   - When the main Retirement Planner loads, this category appears in the Customized Expenses table with **Planned = $0.00** and **Actual = > $0.00**.
2. **Annual Variance Reconciliation**:
   - Compares planned budget vs actual spend per category for any calendar year.
   - Visual indicators highlight over/under spend.
   - Actionable calibration: One-click option to recalculate future simulation baseline expenses based on trailing multi-year actual spend averages.

---

## 7. Multi-Decade Backup, Disaster Recovery & Archival

| Tier | Mechanism | Retention Horizon | Recovery Objective |
| :--- | :--- | :--- | :--- |
| **Tier 1: Operational** | DynamoDB Point-in-Time Recovery (PITR) | 35 Days continuous | RPO: 1 second / RTO: < 15 minutes |
| **Tier 2: Cloud Archival** | Automated Scheduled Lambda -> S3 Bucket with S3 Versioning -> Lifecycle to **S3 Glacier Deep Archive** | Decades (Permanent) | Offsite disaster recovery (< $0.10/year storage cost) |
| **Tier 3: Sovereign Export** | In-App / CLI "Download Complete JSON Archive" | Indefinite (User-controlled) | Cloud-agnostic portable JSON backup on local storage |

---

## 8. Security & Identity Configuration

- **Identity**: AWS Cognito User Pool with 2 user accounts (User + Spouse) linked by a custom `custom:household_id` attribute.
- **Admin Override**: Passwords, account unlock, and MFA device resets can be managed directly via AWS Management Console or AWS CLI.
- **Data in Transit**: Enforced HTTPS / TLS 1.3 via CloudFront. Strict CORS restricted to CloudFront domain.
- **Data at Rest**: Transparent AES-256 encryption across DynamoDB tables and S3 buckets using AWS-managed keys ($0.00 extra cost).
- **API Protection**: API Gateway default rate limiting (20 requests/sec, burst 40) + Cognito native brute-force protection ($0.00 extra cost).

---

## 9. Development Lifecycle, Schema Evolution & Repository Strategy

### 9.1 Codebase Organization: The Planner & The Expenser

Both client applications are maintained in this single repository using **Vite Multi-Entry Points (Multi-Page Architecture)** with a shared TypeScript foundation:

```
retirement-planner/
├── src/
│   ├── apps/
│   │   ├── planner/            <-- Desktop Retirement Planner SPA
│   │   │   ├── App.tsx
│   │   │   ├── components/     (Simulation charts, Bucket Management, etc.)
│   │   │   └── index.html      (Served at / or /planner)
│   │   │
│   │   └── expenser/           <-- Mobile Android PWA
│   │       ├── ExpenserApp.tsx (Quick-entry keypad, recent list, offline sync)
│   │       ├── manifest.json   (PWA Manifest for Android WebAPK)
│   │       ├── sw.ts           (Service Worker & IndexedDB sync)
│   │       └── index.html      (Served at /expenser)
│   │
│   └── shared/                 <-- 100% Shared Code
│       ├── types/              (Expense, Category, Plan, Auth TypeScript interfaces)
│       ├── api/                (API Gateway client & Cognito auth helper)
│       └── storage/            (IndexedDB / LocalStorage adapters)
```

#### Key Maintenance Advantages:
1. **Zero Type Duplication**: Data contracts (Categories, Expenses, Auth) are defined once in `src/shared/types/` and imported by both the planner and the expenser.
2. **Independent Bundle Optimization**: Vite compiles two separate bundles. Opening `/expenser` on a mobile phone downloads only the lightweight ~50 KB expenser bundle, completely bypassing heavy charting and Monte Carlo simulation libraries.
3. **Single Build & Deployment**: `npm run build` outputs both applications to `dist/`, uploaded to the S3 bucket and served under the same CloudFront distribution.

### 9.2 Repository Separation
- **Public Open-Source Repo (`retirement-planner`)**:
  - Contains the frontend React codebase (both `planner` and `expenser` apps).
  - Contains shared TypeScript interfaces, API schemas, and storage adapters.
  - Contains zero cloud credentials, AWS account IDs, or private domain configurations.
- **Private Infrastructure Repo (`retirement-planner-infra`)**:
  - Contains AWS CDK (TypeScript) infrastructure definitions (S3, CloudFront, Cognito, API Gateway, Lambda, DynamoDB).
  - Contains private deployment configurations, Route 53 DNS mappings, and automated deployment scripts (`npm run deploy`).

### 9.2 Pluggable Storage Adapter Pattern
```typescript
export interface StorageAdapter {
  getPlan(): Promise<RetirementPlanState>;
  savePlan(plan: RetirementPlanState): Promise<SaveResult>;
  getAnnualOperations(year: number): Promise<AnnualOperationsState>;
  saveAnnualOperations(year: number, ops: AnnualOperationsState): Promise<SaveResult>;
  getCategories(): Promise<ExpenseCategory[]>;
  saveCategory(cat: ExpenseCategory): Promise<ExpenseCategory>;
  getExpenses(year: number, month?: number): Promise<ActualExpense[]>;
  logExpense(expense: Omit<ActualExpense, 'expenseId'>): Promise<ActualExpense>;
  exportArchive(): Promise<FullHouseholdArchive>;
  importArchive(archive: FullHouseholdArchive): Promise<void>;
}
```
- **`LocalStorageAdapter`**: Uses browser `localStorage` and `IndexedDB`. Allows 100% offline local development, open-source testing, and what-if sandboxing with zero AWS dependencies.
- **`AwsCloudStorageAdapter`**: Connects to AWS Cognito + API Gateway.

### 9.3 Schema Evolution Pipeline
Every stored state payload includes a `schemaVersion: number`.
When reading data from any source (Cloud, Local, or legacy JSON backup), an in-memory upgrade pipeline checks `schemaVersion` and applies sequential transformations (`v1 -> v2 -> v3`) with safe defaults before rendering.

---

## 10. Cost Estimation Summary

| Service | Estimated Personal Household Usage | Estimated Monthly Cost |
| :--- | :--- | :--- |
| **AWS S3** (SPA Hosting + Backup) | < 100 MB | $0.01 |
| **Amazon CloudFront** | < 1 GB Data Transfer | $0.00 (Free Tier / < $0.05) |
| **AWS Cognito** | 2 Monthly Active Users | $0.00 (Free up to 50k MAUs) |
| **Amazon API Gateway** (HTTP API) | < 50,000 requests/month | < $0.05 |
| **AWS Lambda** | < 10,000 invocations/month | $0.00 (Free Tier) |
| **Amazon DynamoDB** (3 Tables + PITR) | < 100 MB storage, on-demand | < $0.15 |
| **S3 Glacier Deep Archive** | Decades of backup snapshots | < $0.01 |
| **Total Estimated Monthly Cloud Cost** | | **~$0.25 – $0.50 / month** |
