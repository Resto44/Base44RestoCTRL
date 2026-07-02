# Cash Register Auto-Sync Verification Guide

This document outlines the verification steps to ensure the Cash Register module is correctly synchronized with all business transactions in real-time.

## Overview

The Cash Register module is now fully automated and should never require manual entry. All cash transactions from other modules are automatically posted via Supabase triggers and immediately reflected in the Daily Cash Settlement.

## Verification Checklist

### 1. Cash Sale Auto-Sync

**Test Case**: Create a cash sale and verify it appears in Cash Register

1. Navigate to **Sales** module
2. Create a new sale with:
   - Payment method: **Cash**
   - Amount: **1000** (or any amount)
   - Branch: **Main Branch**
   - Date: **Today**
3. **Approve** the sale
4. Navigate to **Cash Register** → **Dashboard**
5. **Expected Result**: 
   - `Today's Opening` should be visible
   - `Cash Sales` should increase by **1000**
   - `Expected Closing` should recalculate automatically
   - No refresh button required

### 2. Cash Purchase Auto-Sync

**Test Case**: Create a cash purchase and verify it appears in Cash Register

1. Navigate to **Purchases** module
2. Create a new purchase with:
   - Payment method: **Cash**
   - Amount: **500** (or any amount)
   - Branch: **Main Branch**
   - Date: **Today**
3. **Approve** the purchase
4. Navigate to **Cash Register** → **Dashboard**
5. **Expected Result**:
   - `Cash Purchases` should increase by **500**
   - `Expected Closing` should decrease by **500**
   - Calculation: `Expected = Opening + CashSales - CashPurchases`

### 3. Cash Expense Auto-Sync

**Test Case**: Create a cash expense and verify it appears in Cash Register

1. Navigate to **Expenses** module
2. Create a new expense with:
   - Payment method: **Cash**
   - Amount: **200** (or any amount)
   - Branch: **Main Branch**
   - Date: **Today**
3. **Approve** the expense
4. Navigate to **Cash Register** → **Dashboard**
5. **Expected Result**:
   - `Cash Expenses` should increase by **200**
   - `Expected Closing` should decrease by **200**

### 4. Network Transaction Isolation

**Test Case**: Verify that network transactions do NOT affect cash balance

1. Navigate to **Sales** module
2. Create a new sale with:
   - Payment method: **Network** (or any non-cash method)
   - Amount: **1000**
   - Branch: **Main Branch**
   - Date: **Today**
3. **Approve** the sale
4. Navigate to **Cash Register** → **Dashboard**
5. **Expected Result**:
   - `Cash Sales` should NOT increase
   - `Expected Closing` should remain unchanged
   - Only cash transactions affect the register

### 5. Credit Transaction Isolation

**Test Case**: Verify that credit transactions only affect cash after payment collection

1. Navigate to **Sales** module
2. Create a new sale with:
   - Payment method: **Credit**
   - Amount: **1000**
   - Branch: **Main Branch**
   - Date: **Today**
3. **Approve** the sale
4. Navigate to **Cash Register** → **Dashboard**
5. **Expected Result**:
   - `Cash Sales` should NOT increase
   - `Expected Closing` should remain unchanged
6. Now create a **Customer Payment** for the credit debt:
   - Payment method: **Cash**
   - Amount: **1000**
   - Date: **Today**
7. **Approve** the payment
8. Navigate to **Cash Register** → **Dashboard**
9. **Expected Result**:
   - `Customer Debt Collection` should increase by **1000**
   - `Expected Closing` should increase by **1000**

### 6. Owner Cash Injection

**Test Case**: Create an owner cash injection and verify it posts to Cash Register

1. Navigate to **Cash Register** → **Inject** tab
2. Click **New Injection**
3. Fill in:
   - Amount: **2000**
   - Reason: **Operational Funding**
   - Branch: **Main Branch**
   - Date: **Today**
4. Click **Inject Cash**
5. Navigate to **Cash Register** → **Dashboard**
6. **Expected Result**:
   - `Owner Injection Today` should show **2000**
   - `Expected Closing` should increase by **2000**
   - A **Treasury** record should be created (verify in Treasury module)
   - A **Cash Movement** record should be created (audit log)

### 7. Daily Settlement Submission

**Test Case**: Submit a daily settlement and verify shortage detection

1. Navigate to **Cash Register** → **Settle** tab
2. For **Main Branch**:
   - Count the actual cash in the register
   - Enter the amount using the numeric keypad
3. Click **Submit Settlement**
4. **Expected Result**:
   - Settlement status changes to **Submitted**
   - If `Counted ≠ Expected`:
     - A **CashShortage** record is created
     - Shortage appears in **Shortages** tab with badge counter
     - Owner can approve or investigate
   - If `Counted = Expected`:
     - Settlement shows **Balanced**
     - No shortage record created

### 8. Settlement Approval & Next Day Opening

**Test Case**: Approve a settlement and verify next day's opening cash

1. Navigate to **Cash Register** → **Settle** tab
2. Submit a settlement with `Expected Closing = 5000`
3. As **Owner**, navigate to **Shortages** tab or settlement details
4. Click **Approve**
5. Settlement status changes to **Approved**
6. **Expected Result**:
   - Next day's settlement is created automatically
   - Next day's `Opening Cash = 5000` (today's expected closing)
   - No manual entry required

### 9. Historical Data Backfill

**Test Case**: Verify that historical transactions are correctly backfilled

1. Run the backfill script:
   ```bash
   node src/scripts/backfill_cash_register.js
   ```
2. Script processes all transactions from the past 1 year
3. **Expected Result**:
   - For each day/branch combination with transactions:
     - A `DailyCashSettlement` record is created
     - `CashMovement` records are created for each transaction
     - `cash_sales`, `cash_purchases`, `cash_expenses` are populated
     - `expected_closing_cash` is calculated
   - No duplicate records created
   - Historical data is accurate

### 10. Real-Time Recalculation

**Test Case**: Verify that changes to transactions instantly recalculate settlement

1. Navigate to **Cash Register** → **Dashboard**
2. Note the current `Expected Closing` value
3. Navigate to **Sales** module
4. Find today's cash sale and **edit** it:
   - Change amount from **1000** to **1500**
5. **Approve** the change
6. Navigate back to **Cash Register** → **Dashboard**
7. **Expected Result**:
   - `Cash Sales` increases by **500** (the difference)
   - `Expected Closing` recalculates instantly
   - No refresh button required
   - Changes are immediate (within seconds)

### 11. Transaction Reversal

**Test Case**: Verify that reversing a transaction updates the Cash Register

1. Navigate to **Sales** module
2. Find today's cash sale
3. Click **Reverse** or **Delete**
4. Navigate to **Cash Register** → **Dashboard**
5. **Expected Result**:
   - `Cash Sales` decreases by the reversed amount
   - `Expected Closing` recalculates
   - `CashMovement` record is marked as `is_reversed = true`
   - Original movement is not deleted (audit trail preserved)

### 12. Bottom Navigation Update

**Test Case**: Verify that Cash Register is in the primary navigation

1. Open the app as **Owner** in **Restaurant Mode**
2. Look at the bottom navigation bar
3. **Expected Result**:
   - Bottom nav shows: **Dashboard** | **Sales** | **Menu** | **Cash Register** | **More**
   - **Kitchen** is now in the **More** menu under **Restaurant** section
   - Clicking **Cash Register** navigates to `/cash-register`

4. Open the app as **Manager** in **Restaurant Mode**
5. Look at the bottom navigation bar
6. **Expected Result**:
   - Bottom nav shows: **Dashboard** | **Sales** | **Cash Register** | **Employees** | **More**
   - **Kitchen** is now in the **More** menu under **Restaurant** section

### 13. No Manual Data Entry

**Test Case**: Verify that Cash Register never requires manual posting

1. Create multiple transactions across different modules:
   - Cash Sale
   - Cash Purchase
   - Cash Expense
   - Customer Payment (cash)
   - Supplier Payment (cash)
   - Owner Injection
2. Navigate to **Cash Register** → **Dashboard**
3. **Expected Result**:
   - All transactions are automatically reflected
   - No "Post to Cash Register" button anywhere
   - No manual entry fields for transaction amounts
   - All values are calculated from source transactions

## Troubleshooting

### Issue: Cash Register not updating after transaction

1. Check that the transaction is **Approved** (not Draft)
2. Verify the transaction has a **Cash** payment method
3. Check the browser console for errors
4. Refresh the page (though it should update automatically)
5. Check the database directly:
   ```sql
   SELECT * FROM public.cash_movements 
   WHERE source_record_id = '<transaction_id>' 
   ORDER BY posted_at DESC LIMIT 1;
   ```

### Issue: Duplicate cash movements

1. Check if the transaction was posted multiple times
2. Verify that `is_reversed` flag is set correctly for old movements
3. Check the trigger logs in Supabase for errors
4. Contact support if duplicates persist

### Issue: Expected Closing is incorrect

1. Verify all component amounts are correct:
   - `Opening Cash`
   - `Cash Sales`
   - `Cash Purchases`
   - `Cash Expenses`
   - `Customer Debt Collection`
   - `Supplier Payments`
   - `Owner Injection`
2. Check the formula: `Expected = Opening + In - Out`
3. Verify no network or credit transactions are included
4. Run `SELECT * FROM public.recompute_settlement('<settlement_id>')` to force recalculation

## Performance Notes

- The Cash Register Dashboard should load within 2-3 seconds
- Real-time updates should appear within 1-2 seconds of transaction approval
- Historical backfill for 1 year of data should complete within 5-10 minutes
- Indexes are in place for optimal query performance

## Support

For issues or questions, contact the development team or refer to the Cash Register documentation.
