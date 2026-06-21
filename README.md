# AutoCrafERP — Mini ERP & Customer Portal

A modern, minimal, flat grayscale SaaS Mini ERP system and Customer-facing portal built for the Odoo-style hackathon. 

This application provides real-time tracking of manufacturing and procurement operations, featuring reactive inventory replenishment. If a sales order exceeds free-to-use stock, the system automatically triggers a Purchase Order (for purchased components) or a Manufacturing Order (for in-house manufactured goods) recursively through its Bill of Materials (BoM).

---

## 🚀 Key Features

### 🏢 Internal Store Admin ERP
- **Analytical Dashboard**: Features KPI status cards, reactive line charts showing stock movements, and real-time operations alerts.
- **Product Registry**: Tabbed interface (General, Inventory, Procurement) with visual stock indicators (On-hand vs. Reserved) and MTS/MTO settings.
- **Sales Order Flow**: Automatically calculates stock shortfall upon confirmation and generates procurement triggers (PO/MO).
- **Purchase Order Flow**: Vendor assignment and reception tracking with live inventory delta updates.
- **Bill of Materials (BoM)**: Component lines and sequenced shop-floor operations mapped to specific Work Centers.
- **Manufacturing Tracking**: Progression of shop floor Work Orders (Pending, In Progress, Completed) with automatic ingredient reservation.

### 🛍️ Client/Customer Portal
- **Interactive Catalog**: A modern product catalog with visual cards, availability status, and smooth detail view.
- **Order Cart & Checkout**: Interactive line item cart with shipping forms.
- **Order History & Tracking**: Real-time customer-friendly status labels (Order Placed, Preparing, Out for Delivery, Delivered) and delivery progress.

### 🌗 Global Theme Toggle
- Class-based Light/Dark theme selector synced with system settings and saved in `localStorage` to avoid wrong-theme flashes.

---

## 🛠️ Tech Stack
- **Frontend Framework**: React 18 + Vite
- **Styling**: Tailwind CSS + custom grayscale theme tokens
- **Icons**: Lucide React
- **Charts**: Recharts
- **State Management**: Zustand (housing the client-side relational mock database and auto-procurement rules)
- **Routing**: React Router v6 (providing guards for guest vs. customer vs. staff viewports)

---

## 🖥️ Screen Overview

1. **Landing Page**: Public hero section, value propositions, and featured items linking to auth actions.
2. **Signup Page**: Card segment control for Customer vs. Store Admin roles rendering dynamic forms.
3. **Login Page**: Role-agnostic login form equipped with quick-access demo credentials.
4. **ERP Sidebar Layout**: Houses the internal pages for staff managing inventory, purchase, and manufacturing.
5. **Customer Portal Header Layout**: Seamless header design for customers managing carts, orders, and timelines.

---

## 🏁 Getting Started & Setup

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation & Launch
1. Clone the repository and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Access the web interface at `http://localhost:5173`
