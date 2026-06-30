# Dual Business Mode ERP Architecture Design

## 1. Overview
This document outlines the architecture for the Base44 RestoCTRL ERP system, transitioning it from a restaurant-only application to a dual-mode (Restaurant & Retail) ERP. The system will operate as a single codebase with shared components, using a configurable Business Mode engine to dictate behavior.

## 2. Core Principles
* **Single Codebase**: All code for both Restaurant and Retail modes lives in the same repository.
* **Shared Components**: UI components, authentication, and common business logic are shared.
* **Configuration-Driven**: The active `business_mode` (Restaurant or Retail) determines UI visibility and specific backend behaviors (e.g., inventory consumption).
* **Single Source of Truth**: The Inventory Service remains the central authority for stock levels, regardless of how they are consumed.
* **Responsive Design**: All UIs must be mobile-first and optimized for tablet/desktop.

## 3. Database Schema Changes
To support the dual mode, the database schema must be updated to track the business mode at the tenant and branch levels.

* **`restaurants` table**: Add `business_mode` column (ENUM: 'restaurant', 'retail').
* **`branches` table**: Add `business_mode` column (ENUM: 'restaurant', 'retail'). Inherits from `restaurants` by default but allows branch-specific overrides if needed in the future.
* **`products` table**: Add Retail-specific columns: `barcode`, `sku`, `is_variant`, `parent_product_id`, `batch_tracked`, `expiry_tracked`, `serial_tracked`.
* **`inventory` table**: Add tracking columns for Retail: `batch_number`, `expiry_date`, `serial_number`.

## 4. Business Mode Engine
The Business Mode Engine is implemented as a React Context (`BusinessModeContext`) that wraps the application.

### 4.1. BusinessModeContext
* **State**: `activeMode` ('restaurant' | 'retail'), `isRestaurant`, `isRetail`.
* **Provider**: Reads the `business_mode` from the currently active restaurant/branch via `TenantContext` and provides it to the component tree.

### 4.2. Mode-Aware Components
Components will use the `useBusinessMode` hook to conditionally render UI elements or execute specific logic.

```jsx
const { isRetail, isRestaurant } = useBusinessMode();

return (
  <div>
    {isRestaurant && <RestaurantSpecificWidget />}
    {isRetail && <RetailSpecificWidget />}
    <SharedWidget />
  </div>
);
```

## 5. Module Registry
The application features are categorized into Shared, Restaurant-Exclusive, and Retail-Exclusive modules.

### 5.1. Shared Modules
* Authentication
* Owner Dashboard Framework
* Branch Management
* Employee Management
* Customer Management
* Supplier Management
* Product Management (Base)
* Inventory Service
* Purchase
* Sales
* Treasury
* Cash Register
* Network Settlement
* Expenses
* Accounting
* Reports
* Notifications
* AI Analytics
* Multi-Branch, Multi-Currency, Multi-Language

### 5.2. Restaurant Mode Modules
* Menu Management
* Recipe (BOM)
* Ingredient Inventory
* Kitchen Display System (KDS)
* Table Service / Dine-In
* Takeaway / Delivery
* Waste Management
* Production
* Food Cost Analytics
* Ingredient Consumption Engine

### 5.3. Retail Mode Modules
* Barcode Scanning & Generation
* SKU Management
* Product Variants
* Batch/Lot Tracking
* Expiry Tracking
* Serial Numbers (Optional)
* Direct Product Inventory Engine

## 6. Inventory Engine
The Inventory Engine handles stock adjustments based on the active business mode.

### 6.1. Restaurant Mode Consumption
When a sale occurs in Restaurant mode:
1. Identify the sold menu item.
2. Look up the associated Recipe (BOM).
3. Calculate required ingredients.
4. Deduct ingredients from `inventory`.

### 6.2. Retail Mode Consumption
When a sale occurs in Retail mode:
1. Identify the sold product (via SKU/Barcode).
2. Deduct the sold product directly from `inventory`.
3. Handle batch/lot/serial tracking if applicable.

## 7. Dashboard Framework
The Owner Dashboard uses a single framework. Widgets are registered with mode requirements.

* **Shared Widgets**: Sales Revenue, Cash Flow, Operating Result.
* **Restaurant Widgets**: Food Cost %, Kitchen Ticket Times.
* **Retail Widgets**: Top Selling SKUs, Expiring Inventory Alerts.

The dashboard dynamically loads widgets based on the active `business_mode`.

## 8. UI/UX Strategy
* **Mobile-First**: Base styles target mobile devices.
* **Tailwind Breakpoints**: Use `md:`, `lg:`, `xl:` for tablet and desktop optimizations.
* **Consistent Design Language**: Utilize Radix UI primitives and Tailwind CSS for a unified look across all modes and devices.
