# Supabase Egress Analysis & Optimization Strategy

## 🔍 **Current Implementation Analysis**

### **High Egress Issues Identified** ❌

#### 1. **Excessive SELECT * Queries** 
```typescript
// ❌ BAD: Fetching all columns unnecessarily
const { data: userData, error } = await supabase
  .from('users')
  .select('*')  // Fetches ALL columns
  .eq('wallet_address', walletAddress)
  .single();

// ❌ BAD: Multiple full table scans
const { data: projectRow, error: projectError } = await supabase
  .from("projects")
  .select("*")  // Fetches ALL columns
  .eq("id", id)
  .single();
```

#### 2. **Redundant Database Calls**
```typescript
// ❌ BAD: Multiple separate queries for same data
useEffect(() => {
  // Query 1: Get user profile
  supabase.from('users').select('*').eq('wallet_address', walletAddress);
  
  // Query 2: Get user connections  
  supabase.rpc('get_user_connections', { user_wallet_address: walletAddress });
  
  // Query 3: Get user balance
  userBalanceService.getUserBalance(walletAddress);
}, [walletAddress]);
```

#### 3. **Inefficient Real-time Subscriptions**
```typescript
// ❌ BAD: Multiple subscriptions without cleanup
useEffect(() => {
  // Subscription 1: Balance updates
  const unsubscribe1 = userBalanceService.subscribeToBalanceUpdates();
  
  // Subscription 2: Real-time data
  const unsubscribe2 = supabase.channel('custom-all-channel');
  
  // Subscription 3: User data changes
  const unsubscribe3 = supabase.from('users').on('*', callback);
}, []);
```

#### 4. **Missing Query Optimization**
```typescript
// ❌ BAD: No pagination, fetching all records
const { data: projects } = await supabase
  .from("projects")
  .select("*")  // Could be thousands of records
  .eq("is_active", true);

// ❌ BAD: No indexing consideration
const { data: tasks } = await supabase
  .from("project_tasks")
  .select("*")
  .eq("project_id", id)  // No index on project_id
  .eq("is_active", true);
```

---

## ✅ **Low Egress Optimization Strategy**

### **1. Selective Column Fetching**
```typescript
// ✅ GOOD: Only fetch needed columns
const { data: userData, error } = await supabase
  .from('users')
  .select('id, wallet_address, username, avatar_url, level, xp')  // Specific columns
  .eq('wallet_address', walletAddress)
  .single();

// ✅ GOOD: Use count queries instead of fetching data
const { count, error } = await supabase
  .from('projects')
  .select('*', { count: 'exact', head: true })  // Only count, no data
  .eq('is_active', true);
```

### **2. Batch Queries with RPC Functions**
```typescript
// ✅ GOOD: Single RPC call for multiple data points
const { data: userDashboard, error } = await supabase.rpc('get_user_dashboard_data', {
  user_wallet_address: walletAddress
});

// Returns: { profile, balance, achievements, recent_activity }
```

### **3. Implement Smart Caching**
```typescript
// ✅ GOOD: Cache frequently accessed data
class OptimizedUserService {
  private cache = new Map<string, { data: any, timestamp: number }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getUserProfile(walletAddress: string) {
    const cached = this.cache.get(walletAddress);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data; // Return cached data
    }

    // Fetch fresh data only when needed
    const { data, error } = await supabase
      .from('users')
      .select('id, wallet_address, username, avatar_url')
      .eq('wallet_address', walletAddress)
      .single();

    if (!error && data) {
      this.cache.set(walletAddress, { data, timestamp: Date.now() });
    }
    return data;
  }
}
```

### **4. Optimize Real-time Subscriptions**
```typescript
// ✅ GOOD: Single optimized subscription
useEffect(() => {
  if (!walletAddress) return;

  const channel = supabase
    .channel(`user-${walletAddress}`)
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'user_balances',
        filter: `wallet_address=eq.${walletAddress}`
      }, 
      handleBalanceUpdate
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [walletAddress]);
```

### **5. Implement Pagination & Limits**
```typescript
// ✅ GOOD: Paginated queries
const { data: projects, error } = await supabase
  .from('projects')
  .select('id, title, description, banner_url')
  .eq('is_active', true)
  .range(0, 19)  // First 20 items
  .order('created_at', { ascending: false });

// ✅ GOOD: Use cursors for large datasets
const { data: nfts, error } = await supabase
  .from('user_nfts')
  .select('id, name, image_url')
  .eq('wallet_address', walletAddress)
  .order('created_at', { ascending: false })
  .limit(50);  // Reasonable limit
```

---

## 🚀 **Implementation Plan**

### **Phase 1: Immediate Fixes (Week 1)**
1. **Replace SELECT * with specific columns**
2. **Add query limits and pagination**
3. **Implement basic caching for user profiles**

### **Phase 2: Advanced Optimization (Week 2)**
1. **Create RPC functions for batch queries**
2. **Optimize real-time subscriptions**
3. **Add database indexes**

### **Phase 3: Monitoring & Tuning (Week 3)**
1. **Monitor egress usage**
2. **Implement query analytics**
3. **Fine-tune cache TTLs**

---

## 📊 **Expected Egress Reduction**

| Current Issue | Egress Impact | Optimization | Reduction |
|---------------|---------------|--------------|-----------|
| SELECT * queries | High | Specific columns | 60-80% |
| Multiple separate calls | Medium | Batch RPC functions | 70-90% |
| No caching | High | Smart caching | 50-70% |
| Unlimited queries | High | Pagination/limits | 40-60% |
| Inefficient subscriptions | Medium | Optimized channels | 30-50% |

**Total Expected Reduction: 60-75%**

---

## 🔧 **Database Indexes to Add**

```sql
-- Performance indexes for low egress
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_projects_active_category ON projects(is_active, category);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_active ON project_tasks(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_wallet_project ON user_task_completions(wallet_address, project_id);
CREATE INDEX IF NOT EXISTS idx_user_balances_wallet ON user_balances(wallet_address);
```

---

## 📈 **Monitoring Queries**

```sql
-- Monitor egress usage
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY n_distinct DESC;

-- Check query performance
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
WHERE query LIKE '%users%' OR query LIKE '%projects%'
ORDER BY total_time DESC;
```

This optimization strategy will significantly reduce your Supabase egress while maintaining performance and user experience.
