# Frontend Architecture: AutoCrafERP Mini ERP

This document outlines the frontend architecture of the **AutoCrafERP** Mini ERP and Customer Portal system built for the Odoo-style hackathon. For step-by-step setup and launch instructions, please refer to the [root README.md](file:///c:/Users/Asus/Downloads/odooxkahe74/README.md).

## 1. Technology Stack
- **Core Library**: React (v18)
- **Styling**: Tailwind CSS (class-based dark mode config)
- **Iconography**: Lucide React
- **Charts**: Recharts (fully reactive to light/dark themes)
- **Routing & State Routing**: React Router (v6) + custom view routers
- **State Management**: Zustand (housing the central mock database and reactive inventory/procurement auto-replenishment logic)
- **Build Tool**: Vite

## 2. Directory Structure

```text
frontend/
├── index.html           # Injected theme checker to prevent initial style flash
├── tailwind.config.js   # Custom dark/light colors and variables mapping
└── src/
    ├── main.jsx         # App entry point
    ├── App.jsx          # Fully integrated React Router routing and role guards mapping Page components
    ├── App.css          # Main stylesheet adjustments
    ├── index.css        # Core tailwind layers and CSS custom variables (Light/Dark mode)
    ├── assets/          # Static vector images (e.g. hero.png)
    ├── components/
    │   └── common/
    │       ├── Layout.jsx        # ERP internal sidebar/topbar shell
    │       ├── Skeleton.jsx      # Theme-aware loading placeholders
    │       ├── SlideOver.jsx     # Side sliding panels for detail drawers
    │       ├── ThemeProvider.jsx # Theme context provider (light/dark/system)
    │       └── ThemeToggle.jsx   # Header theme switcher buttons
    ├── pages/
    │   ├── Landing.jsx           # Public portal landing page
    │   ├── Login.jsx             # Role-agnostic authentication page with quick demo logins
    │   ├── Signup.jsx            # Dual-role segmented account registration
    │   ├── Dashboard.jsx         # Internal ERP analytical dashboard and Recharts
    │   ├── Products.jsx          # Material/Product manager with visual stock bar
    │   ├── SalesOrders.jsx       # Order planner with automatic replenishment checks
    │   ├── PurchaseOrders.jsx    # Vendor procurement with receipt stock deltas
    │   ├── BoM.jsx               # Bill of Materials manager and operations lists
    │   ├── Manufacturing.jsx     # Shop floor tracker and Work Order execution
    │   └── CustomerPortal.jsx    # Client portal: Catalog, Cart, Order History, Tracking
    ├── store/
    │   └── erpStore.js           # Zustand store with mock data seed and automation rules
    └── utils/
        ├── orderStatusBreakdown.js  # Pure aggregation function for the Order Status Breakdown donut chart
        └── password.js              # Pure password validation utility evaluating complexity rules
```

## 3. Core Business Logic & UI Features

### A. State Management & Auto-Procurement
All mock tables (Products, Sales Orders, Purchase Orders, BoMs, Manufacturing Orders, Work Orders, Stock Ledger) are stored in `erpStore.js`.
When a **Sales Order** is confirmed:
- If a shortfall occurs (Available stock < Ordered stock), the store automatically triggers:
  - A **Purchase Order** if the product is purchased from a vendor.
  - A **Manufacturing Order** (with associated **Work Orders**) if the product is manufactured in-house.
  - This flow executes recursively through component dependencies of the product's **Bill of Materials (BoM)**.

### B. Dark & Light Mode Theme Support
- Theme selection is stored in `localStorage` and falls back to system preferences.
- Defined variables in `index.css` map to Tailwind custom theme configurations so that colors adapt automatically.
- Recharts graphics in the `Dashboard` dynamically query `document.documentElement` styles to paint theme-correct lines, donut slices, and grid axes. The **Order Status Breakdown** donut chart (`src/utils/orderStatusBreakdown.js`) aggregates statuses across all order types (Sales, Purchase, Manufacturing) into four buckets (Draft, In Progress, Completed, Cancelled) and renders a Recharts `PieChart` with `innerRadius` to display a donut with a center total count label and a themed legend.

### C. Route Guards & Role-Based Access Control (RBAC)
- Guest routes (`/login`, `/signup`) are guarded to redirect already authenticated users to their home base.
- Customer routes (`/portal`) are restricted to users with the `Customer` role.
- Internal ERP routes (`/dashboard`, `/products`, `/sales`, `/purchase`, `/bom`, `/manufacturing`) are restricted to staff roles and wrapped in the ERP sidebar layout.

### D. Password Complexity & Validation Requirements
- **Utility Function**: A pure password strength validation utility is located at [password.js](file:///c:/Users/Asus/Downloads/odooxkahe74/frontend/src/utils/password.js). It evaluates a password string against five complexity rules using regular expressions:
  - Minimum 8 characters (`password.length >= 8`)
  - At least 1 uppercase letter (`/[A-Z]/`)
  - At least 1 lowercase letter (`/[a-z]/`)
  - At least 1 number (`/[0-9]/`)
  - At least 1 special character (`/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;']/`)
- **Return Shape**:
  ```javascript
  {
    length: boolean,
    uppercase: boolean,
    lowercase: boolean,
    number: boolean,
    special: boolean,
    score: number // Range 0 - 5 representing number of satisfied rules
  }
  ```
- **Signup Page Validation**:
  - Displays a real-time checklist updating on every keystroke. Met requirements turn green with checkmarks (`text-success` icon and `--foreground` text contrast).
  - Shows a segmented 5-bar strength meter dynamically colored based on score (0-1: Weak/Red, 2-3: Fair/Yellow, 4: Good/Yellow, 5: Strong/Green).
  - Disables the submit button until the score is 5, password confirmation matches, and terms are checked.
  - Prevents bypass submission (e.g., via Enter key) by displaying a red inline error message (`Password does not meet all requirements`) and focusing the password input.
- **Login Page Validation**:
  - The Login Page only checks that the password field is not empty, leaving credential validation to the backend service.

## 4. Component Reusability

- The `OrderTrackingStepper` component is extracted from the Customer Portal for maximum reuse. It provides a consistent order tracking visualization and is embedded directly into the Landing page hero section as a live preview (replacing static placeholders) to demonstrate the platform's core tracking capabilities immediately to visitors.

## 5. Zustand Mock Database Seed Schema

The store `erpStore.js` implements a client-side relational mock database seeded with realistic data for the following entities:

- **Products**: Supports both `FinishedGood` and `Component` types. Features a `procurement_strategy` segmented control (`MTS` for Make-to-Stock / `MTO` for Make-to-Order) and `procurement_type` (Manufacturing vs. Purchase).
- **Sales Orders**: Tracks order numbers, customer IDs, expectations, actual deliveries, and line items. Statuses map dynamically to customer portal friendly terms.
- **Purchase Orders**: Tracks vendor assignments, reference linkages back to Sales/Manufacturing orders, and received stock deltas.
- **Bill of Materials (BoM)**: Connects a finished good to multiple component lines and operations (cutting, assembly, polishing) mapped to specific shop floor Work Centers.
- **Manufacturing Orders (MO)**: Tracks work orders sequence execution, component reservations (available, shortage, reserved), and progress.
- **Stock Ledger**: Chronological transaction logger recording every stock alteration, referencing order types, users, and resulting balances.
