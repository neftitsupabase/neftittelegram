# User Balance Display Issue Analysis

## Root Cause Identified

The UI is not showing user balance because **UserBalanceService is using the wrong RPC function** that doesn't properly aggregate from all reward sources.

## Current Flow Analysis

### 1. MainNav Component (Lines 364-369, 378-380)
```typescript
// Displays balance correctly from userBalance state
{userBalance?.total_neft_claimed ? 
  (userBalance.total_neft_claimed % 1 === 0 ? 
    userBalance.total_neft_claimed.toFixed(0) : 
    userBalance.total_neft_claimed.toFixed(2)
  ) : '0'} NEFT

{userBalance?.total_xp_earned || '0'} XP
```

### 2. UserBalanceService (Line 52)
```typescript
// WRONG FUNCTION - Only reads from user_balances table
const { data, error } = await client.rpc('get_direct_user_balance', {
  user_wallet: walletAddress
});
```

### 3. Database Function Issue
`get_direct_user_balance()` only reads from `user_balances` table but **daily claims may not be properly synced** to this table.

## Critical Problems

1. **Wrong RPC Function**: Should use `get_user_complete_balance()` for proper aggregation
2. **Field Mapping Issue**: Function returns different field names than expected
3. **Daily Claim Integration**: Daily claims not properly updating `user_balances` table

## Solutions Required

### Fix 1: Update UserBalanceService RPC Call
```typescript
// Change line 52 in UserBalanceService.ts
// FROM:
const { data, error } = await client.rpc('get_direct_user_balance', {
  user_wallet: walletAddress
});

// TO:
const { data, error } = await client.rpc('get_user_complete_balance', {
  user_wallet: walletAddress
});
```

### Fix 2: Update Field Mapping
```typescript
// Update parsing in UserBalanceService (lines 78-91)
return {
  total_neft_claimed: parseFloat(result?.total_neft || '0'), // Changed field name
  total_xp_earned: parseFloat(result?.total_xp_earned || '0'),
  // ... rest of fields
};
```

### Fix 3: Deploy Database Fix
Deploy `COMPLETE_DAILY_CLAIM_TRIGGER_FIX.sql` to ensure daily claims properly update `user_balances` table.

## Expected Result
- UI will show correct NEFT/XP balances from all sources
- Daily claim rewards will be immediately visible
- Real-time balance updates will work properly
