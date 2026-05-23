# Technical Stack & Implementation Specification: Retirement Scenario Optimizer

## 1. High-Level Architecture & Principles
- **Deployment Model:** Single Page Application (SPA). All processing must run client-side to maintain zero-knowledge user privacy over highly sensitive financial and tax datasets. No external database or backend API dependencies.
- **State Management Model:** Unidirectional data flow. Component states must remain strictly isolated from calculation mechanisms. A pure-function simulation utility must consume inputs, compute the multi-decade projection arrays, and emit an immutable output matrix block for rendering.
- **Performance Threshold:** The simulation loop must execute in under 15 milliseconds across a 35-year data projection matrix to support fluid 60FPS UI rendering while dragging conversion sliders.

## 2. Framework & Layout Libraries
- **Core Framework:** React 18+ leveraging TypeScript for strict compilation safety on data schemas.
- **Build Tooling:** Vite for near-instant local HMR (Hot Module Replacement) and optimized production bundles.
- **Styling Architecture:** Tailwind CSS using a clean utility-first approach. 
  - Interface Design Theme: High-contrast, clean professional dashboard using slate-900 backdrops, emerald-500 highlighting for growth assets, and amber-500/rose-500 for tax and surcharge warnings.
- **Component Icons:** Lucide React for consistent, lightweight vector iconography (sliders, charts, warnings, alerts).

## 3. Data Visualization & Charting Engine
- **Engine Selection:** Chart.js paired with the native `react-chartjs-2` integration wrapper. (Alternatively, Chartkick or lightweight SVG primitives can be used if preferred by the sub-agents for absolute dependency minimalism).
- **Chart 1 (Tax Map Requirements):** 
  - Chart Type: Multi-dataset Stacked Bar Chart.
  - Performance Rules: Disable animation loops during manual slider dragging to prevent thread blocking.
  - Interaction: Custom tooltips that read data coordinates out of the computed matrix row to display current marginal tax brackets and IRMAA tiers on hover.
- **Chart 2 (Estate Lifespan Requirements):**
  - Chart Type: Dual-dataset Smooth Line Chart (`cubicInterpolationMode: 'monotone'`).
  - Layout: Tracks total portfolio depletion or growth paths out to age 90, with vertical markers indicating major milestone years like the onset of individual RMDs.

## 4. Frontend Application File Directory Structure
The Antigravity system should scaffold the project using this clean folder structure:

```
src/
├── assets/
├── components/
│   ├── DashboardLayout.tsx      # Main application frame and layout structure
│   ├── BracketMapChart.tsx      # Workspace 1: Chart.js stacked bar view
│   ├── LookbackLedgerTable.tsx  # Workspace 2: Lookback data view and safety alerts
│   ├── ClaimingMatrixGrid.tsx   # Workspace 3: Interactive 8x8 button grid selection
│   └── InputControlSidebar.tsx  # Primary input parameters (balances, variables, growth)
├── engine/
│   ├── simulationEngine.ts      # Pure-function processing pipeline loop script
│   └── taxRates2026.ts          # Static lookups for Federal, MD, FL, and IRMAA tiers
├── types/
│   └── index.ts                 # Centralized type definitions and schema block mappings
├── App.tsx                      # Root state wrapper orchestration point
└── main.tsx                     # Vite entry bootstrap point
```

## 5. State Synchronization & Event Loop Logic
- **Throttle Rule:** When a user modifies the custom annual conversion slider in Workspace 1, the tracking state update must be throttled or debounced by 8ms. This allows the render loop to buffer calculations without micro-stuttering.
- **LocalStorage Memoization:** Include a lightweight configuration hook (`useLocalStorage`) that seamlessly backs up client-side state parameters. This allows users to refresh their browser or close the tab without wiping out their carefully configured portfolio balances or scenario inputs.