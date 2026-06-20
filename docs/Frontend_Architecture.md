# Frontend Architecture: Mini ERP

## 1. Technology Stack
- **Library**: React (v18+)
- **Styling**: Tailwind CSS for utility-first styling.
- **UI Components**: `shadcn/ui` (built on Radix UI) for accessible, pre-designed, and highly customizable ERP components (Data Tables, Modals, Dropdowns).
- **Routing**: React Router (v6) for client-side routing.
- **Form Handling & Validation**: React Hook Form paired with Zod (for type-safe schema validation).
- **Server State & Data Fetching**: React Query (`@tanstack/react-query`) for API caching, background fetching, pagination, and optimistic updates.
- **Global Client State**: Zustand (for lightweight global state like Auth tokens and User Roles).
- **API Client**: Axios (configured with interceptors for JWT auth and error handling).
- **Build Tool**: Vite (for fast HMR and optimized builds).

## 2. Directory Structure

```text
src/
├── assets/          # Static assets (images, icons)
├── components/      # Reusable UI components
│   ├── ui/          # shadcn/ui base components (Button, Input, Dialog, etc.)
│   ├── common/      # Shared custom components (e.g., AppSidebar, Layout)
│   └── forms/       # Form wrappers utilizing React Hook Form + Zod
├── hooks/           # Custom React hooks (e.g., useAuth, usePermissions)
├── lib/             # Utility libraries (e.g., axios instance, cn/clsx utility)
├── pages/           # Page components (routed views)
│   ├── Dashboard/
│   ├── Inventory/
│   ├── Sales/
│   ├── Purchase/
│   └── Manufacturing/
├── services/        # React Query hooks (e.g., useGetProducts, useCreateOrder)
├── store/           # Zustand global state stores (e.g., authStore)
├── types/           # TypeScript/Zod definitions (if using TS)
├── App.jsx          # Root component
└── main.jsx         # Application entry point
```

## 3. Core Principles
1. **Component-Based UI**: Utilize `shadcn/ui` to quickly assemble complex, premium-feeling ERP interfaces without writing boilerplate CSS.
2. **Robust Forms**: ERPs are form-heavy. Every form must use React Hook Form for performance (prevents re-renders) and Zod for strict frontend validation.
3. **Server State Mastery**: Use React Query for all server interactions to ensure the UI is snappy, data is cached locally, and loading/error states are handled gracefully.
4. **Role-Based Access Control (RBAC)**: Use Zustand to store the user's role and implement a `usePermissions` hook to guard routes and hide/disable sensitive UI actions.
