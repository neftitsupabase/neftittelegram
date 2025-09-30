# 🏆 Leaderboard Simple Fix - Back to Working Version

## 🚨 **Problem:**
The leaderboard was not showing data because I overcomplicated it with real-time functions that may have issues with missing tables.

## ✅ **Solution:**
Reverted to the **working** `leaderboard_functions_with_usernames.sql` functions that were already working before.

## 🚀 **Deployment Instructions:**

### **Step 1: Deploy the Working Functions**
Execute this SQL in your Supabase database:

```sql
-- Run the contents of database/leaderboard_functions_with_usernames.sql
-- This uses the simple, working approach:
-- - NEFT: user_balances + user_referrals
-- - NFT: user_ipfs_mappings (real NFT counts)
-- - Usernames: from users table
```

### **Step 2: Test the Functions**
Test in Supabase SQL editor:

```sql
-- Test NEFT leaderboard
SELECT * FROM get_top_neft_holders_with_usernames(10);

-- Test NFT leaderboard  
SELECT * FROM get_top_nft_holders_with_usernames(10);

-- Test current user rank
SELECT * FROM get_user_neft_rank_with_username('your_wallet_address');
```

## 📊 **What This Will Show:**

### **NEFT Leaderboard:**
- **Campaign rewards** from `user_balances.total_neft_claimed`
- **Referral rewards** from `user_referrals.total_neft_earned`
- **Real usernames** from `users` table
- **Proper rankings** based on total NEFT

### **NFT Leaderboard:**
- **Real NFT counts** from `user_ipfs_mappings` (actual NFTs owned)
- **Real usernames** from `users` table
- **Proper rankings** based on NFT count

## 🎯 **Expected Results:**
- ✅ **NEFT balances** from campaigns + referrals
- ✅ **Real NFT counts** from actual ownership
- ✅ **Proper usernames** instead of wallet addresses
- ✅ **Current user ranking** (top 10 or bottom row)
- ✅ **Low egress** with simple, efficient queries

## 🔧 **Technical Details:**

### **Functions Used:**
1. `get_top_neft_holders_with_usernames()` - Top 10 NEFT holders
2. `get_top_nft_holders_with_usernames()` - Top 10 NFT holders
3. `get_user_neft_rank_with_username()` - Current user NEFT rank
4. `get_user_nft_rank_with_username()` - Current user NFT rank

### **Data Sources:**
- **NEFT**: `user_balances` + `user_referrals` (simple, reliable)
- **NFT**: `user_ipfs_mappings` (real NFT ownership)
- **Usernames**: `users` table with fallback generation

**This is the simple, working approach that should display data immediately!** 🎉
