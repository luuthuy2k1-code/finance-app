import Dexie from 'dexie';

export const db = new Dexie('FinanceAppDB');

// Khai báo schema
import { supabase } from './supabaseClient';

// Upgrade schema to version 8 to add budgets table with cloud sync
db.version(8).stores({
    categories: '++id, name, type, color, icon, isSystem, user_id, supabase_id',
    wallets: '++id, name, type, balance, user_id, supabase_id',
    transactions: '++id, amount, categoryId, walletId, date, note, createdAt, user_id, supabase_id',
    transfers: '++id, amount, fromWalletId, toWalletId, date, note, createdAt, user_id, supabase_id',
    goals: '++id, name, targetAmount, currentAmount, targetDate, isWithdrawn, user_id, supabase_id',
    goal_deposits: '++id, goalId, amount, date, walletId, type, createdAt, user_id, supabase_id',
    debts: '++id, name, totalAmount, remainingAmount, startDate, status, user_id, supabase_id',
    debt_payments: '++id, debtId, amount, date, walletId, createdAt, user_id, supabase_id',
    budgets: '++id, categoryId, limit, period, user_id, supabase_id'
});

// Flag to prevent multiple parallel syncs
let isSyncing = false;

// Helper to get current Supabase user
const getUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
};

// --- MAPPING HELPERS ---

const mapToSupabase = (tableName, data) => {
    const mapped = { ...data };

    // Common mappings
    if (mapped.categoryId) { mapped.category_id = mapped.categoryId; delete mapped.categoryId; }
    if (mapped.walletId) { mapped.wallet_id = mapped.walletId; delete mapped.walletId; }
    if (mapped.fromWalletId) { mapped.from_wallet_id = mapped.fromWalletId; delete mapped.fromWalletId; }
    if (mapped.toWalletId) { mapped.to_wallet_id = mapped.toWalletId; delete mapped.toWalletId; }
    if (mapped.isSystem !== undefined) { mapped.is_system = mapped.isSystem; delete mapped.isSystem; }
    if (mapped.targetAmount) { mapped.target_amount = mapped.targetAmount; delete mapped.targetAmount; }
    if (mapped.currentAmount !== undefined) { mapped.current_amount = mapped.currentAmount; delete mapped.currentAmount; }
    if (mapped.targetDate) { mapped.target_date = mapped.targetDate; delete mapped.targetDate; }
    if (mapped.isWithdrawn !== undefined) { mapped.is_withdrawn = mapped.isWithdrawn; delete mapped.isWithdrawn; }
    if (mapped.goalId) { mapped.goal_id = mapped.goalId; delete mapped.goalId; }
    if (mapped.totalAmount) { mapped.total_amount = mapped.totalAmount; delete mapped.totalAmount; }
    if (mapped.remainingAmount !== undefined) { mapped.remaining_amount = mapped.remainingAmount; delete mapped.remainingAmount; }
    if (mapped.startDate) { mapped.start_date = mapped.startDate; delete mapped.startDate; }
    if (mapped.debtId) { mapped.debt_id = mapped.debtId; delete mapped.debtId; }

    // Handle created_at
    if (mapped.createdAt) {
        mapped.created_at = new Date(mapped.createdAt).toISOString();
        delete mapped.createdAt;
    }

    // Remove internal flags
    delete mapped._from_supabase;
    delete mapped.supabase_id;
    delete mapped.id;

    return mapped;
};

const mapFromSupabase = (tableName, data) => {
    const mapped = { ...data };

    if (mapped.category_id) { mapped.categoryId = mapped.category_id; delete mapped.category_id; }
    if (mapped.wallet_id) { mapped.walletId = mapped.wallet_id; delete mapped.wallet_id; }
    if (mapped.from_wallet_id) { mapped.fromWalletId = mapped.from_wallet_id; delete mapped.from_wallet_id; }
    if (mapped.to_wallet_id) { mapped.toWalletId = mapped.to_wallet_id; delete mapped.to_wallet_id; }
    if (mapped.is_system !== undefined) { mapped.isSystem = mapped.is_system; delete mapped.is_system; }
    if (mapped.target_amount) { mapped.targetAmount = mapped.target_amount; delete mapped.target_amount; }
    if (mapped.current_amount !== undefined) { mapped.currentAmount = mapped.current_amount; delete mapped.current_amount; }
    if (mapped.target_date) { mapped.targetDate = mapped.target_date; delete mapped.target_date; }
    if (mapped.is_withdrawn !== undefined) { mapped.isWithdrawn = mapped.is_withdrawn; delete mapped.is_withdrawn; }
    if (mapped.goal_id) { mapped.goalId = mapped.goal_id; delete mapped.goal_id; }
    if (mapped.total_amount) { mapped.totalAmount = mapped.total_amount; delete mapped.total_amount; }
    if (mapped.remaining_amount !== undefined) { mapped.remainingAmount = mapped.remaining_amount; delete mapped.remaining_amount; }
    if (mapped.start_date) { mapped.startDate = mapped.start_date; delete mapped.start_date; }
    if (mapped.debt_id) { mapped.debtId = mapped.debt_id; delete mapped.debt_id; }

    if (mapped.created_at) {
        mapped.createdAt = new Date(mapped.created_at).getTime();
        delete mapped.created_at;
    }

    return mapped;
};

// --- SYNC LOGIC ---

// Helper to resolve local IDs to Supabase UUIDs
const resolveForeignKeys = async (tableName, obj) => {
    const resolved = { ...obj };

    if (resolved.categoryId) {
        const cat = await db.categories.get(Number(resolved.categoryId));
        if (cat?.supabase_id) resolved.categoryId = cat.supabase_id;
    }
    if (resolved.walletId) {
        const w = await db.wallets.get(Number(resolved.walletId));
        if (w?.supabase_id) resolved.walletId = w.supabase_id;
    }
    if (resolved.fromWalletId) {
        const w = await db.wallets.get(Number(resolved.fromWalletId));
        if (w?.supabase_id) resolved.fromWalletId = w.supabase_id;
    }
    if (resolved.toWalletId) {
        const w = await db.wallets.get(Number(resolved.toWalletId));
        if (w?.supabase_id) resolved.toWalletId = w.supabase_id;
    }
    if (resolved.goalId) {
        const g = await db.goals.get(Number(resolved.goalId));
        if (g?.supabase_id) resolved.goalId = g.supabase_id;
    }
    if (resolved.debtId) {
        const d = await db.debts.get(Number(resolved.debtId));
        if (d?.supabase_id) resolved.debtId = d.supabase_id;
    }

    return resolved;
};

// Mirror Dexie changes to Supabase
const tablesToSync = ['categories', 'wallets', 'goals', 'debts', 'transactions', 'transfers', 'goal_deposits', 'debt_payments', 'budgets'];

tablesToSync.forEach(tableName => {
    db[tableName].hook('creating', function (primKey, obj, transaction) {
        this.onsuccess = (actualPrimKey) => {
            const syncToCloud = async () => {
                try {
                    const userId = await getUserId();
                    if (!userId) return;
                    if (obj._from_supabase) return;

                    const resolvedObj = await resolveForeignKeys(tableName, obj);
                    const supabaseData = mapToSupabase(tableName, { ...resolvedObj, user_id: userId });

                    const { data, error } = await supabase.from(tableName).insert(supabaseData).select().single();
                    if (error) {
                        console.error(`Sync insert error (${tableName}):`, error);
                    } else if (data) {
                        // Use modify so we don't trigger the 'updating' hook recursively
                        await db[tableName].where('id').equals(actualPrimKey).modify({
                            supabase_id: data.id,
                            user_id: userId,
                            _from_supabase: Date.now()
                        });
                    }
                } catch (err) {
                    console.error(`Unexpected sync insert error (${tableName}):`, err);
                }
            };
            transaction.on('complete', syncToCloud);
        };
    });

    db[tableName].hook('updating', function (mods, primKey, obj, transaction) {
        if (mods._from_supabase) {
            delete mods._from_supabase;
            return;
        }

        const syncUpdate = async () => {
            try {
                const supabaseId = obj.supabase_id;
                if (!supabaseId) return;

                const resolvedMods = await resolveForeignKeys(tableName, mods);
                const supabaseMods = mapToSupabase(tableName, resolvedMods);
                const { error } = await supabase.from(tableName).update(supabaseMods).eq('id', supabaseId);
                if (error) console.error(`Sync update error (${tableName}):`, error);
            } catch (err) {
                console.error(`Unexpected sync update error (${tableName}):`, err);
            }
        };

        transaction.on('complete', syncUpdate);
    });

    db[tableName].hook('deleting', function (primKey, obj, transaction) {
        if (obj._from_supabase_delete) return;

        const syncDelete = async () => {
            try {
                const supabaseId = obj.supabase_id;
                if (!supabaseId) return;

                const { error } = await supabase.from(tableName).delete().eq('id', supabaseId);
                if (error) console.error(`Sync delete error (${tableName}):`, error);
            } catch (err) {
                console.error(`Unexpected sync delete error (${tableName}):`, err);
            }
        };

        transaction.on('complete', syncDelete);
    });
});

// Helper to resolve UUID foreign keys from cloud data to local numeric IDs
const resolveCloudForeignKeys = async (dexieData) => {
    if (dexieData.categoryId) {
        const parent = await db.categories.where('supabase_id').equals(dexieData.categoryId).first();
        if (parent) dexieData.categoryId = parent.id;
    }
    if (dexieData.walletId) {
        const parent = await db.wallets.where('supabase_id').equals(dexieData.walletId).first();
        if (parent) dexieData.walletId = parent.id;
    }
    if (dexieData.fromWalletId) {
        const parent = await db.wallets.where('supabase_id').equals(dexieData.fromWalletId).first();
        if (parent) dexieData.fromWalletId = parent.id;
    }
    if (dexieData.toWalletId) {
        const parent = await db.wallets.where('supabase_id').equals(dexieData.toWalletId).first();
        if (parent) dexieData.toWalletId = parent.id;
    }
    if (dexieData.goalId) {
        const parent = await db.goals.where('supabase_id').equals(dexieData.goalId).first();
        if (parent) dexieData.goalId = parent.id;
    }
    if (dexieData.debtId) {
        const parent = await db.debts.where('supabase_id').equals(dexieData.debtId).first();
        if (parent) dexieData.debtId = parent.id;
    }
    return dexieData;
};

// Apply a single cloud record to local DB (used by both syncFromCloud and Realtime)
const applyCloudRecord = async (tableName, item) => {
    let local = await db[tableName].where('supabase_id').equals(item.id).first();

    // Fallback: match by name for categories and wallets to prevent duplicates
    if (!local && (tableName === 'categories' || tableName === 'wallets')) {
        local = await db[tableName].where('name').equals(item.name).first();
    }

    let dexieData = mapFromSupabase(tableName, item);
    dexieData = await resolveCloudForeignKeys(dexieData);

    const supabaseId = item.id;
    delete dexieData.id;
    dexieData.supabase_id = supabaseId;
    dexieData._from_supabase = Date.now(); // Always use a new timestamp to trigger the hook check

    if (!local) {
        await db[tableName].add(dexieData);
    } else {
        await db[tableName].update(local.id, dexieData);
    }
};

// Delete a local record that was deleted from cloud
const deleteLocalRecord = async (tableName, supabaseId) => {
    const local = await db[tableName].where('supabase_id').equals(supabaseId).first();
    if (local) {
        await db[tableName].delete(local.id);
    }
};

// Function to fetch all data from Supabase and sync with Dexie
// Also removes local records that no longer exist in cloud
export const syncFromCloud = async () => {
    if (isSyncing) {
        console.warn('[Sync] Sync already in progress, skipping...');
        return {};
    }
    isSyncing = true;
    const summary = {};
    try {
        const userId = await getUserId();
        if (!userId) {
            console.warn('[Sync] No user logged in, aborting sync.');
            return summary;
        }
        console.log('[Sync] Starting sync for user:', userId);

        // Sync parents before children
        const syncOrder = ['categories', 'wallets', 'goals', 'debts', 'budgets', 'transactions', 'transfers', 'goal_deposits', 'debt_payments'];

        for (const tableName of syncOrder) {
            let added = 0, updated = 0, deleted = 0, pushed = 0;

            // Step 1: Push local-only records (missing supabase_id) to cloud
            const localOnly = await db[tableName].filter(r => !r.supabase_id).toArray();
            if (localOnly.length > 0) {
                console.log(`[Sync] Found ${localOnly.length} local-only records in ${tableName}. Pushing...`);
                for (const record of localOnly) {
                    try {
                        const resolvedObj = await resolveForeignKeys(tableName, record);
                        const supabaseData = mapToSupabase(tableName, { ...resolvedObj, user_id: userId });
                        const { data, error } = await supabase.from(tableName).insert(supabaseData).select().single();
                        if (!error && data) {
                            await db[tableName].update(record.id, { supabase_id: data.id });
                            pushed++;
                        } else {
                            console.error(`[Sync] Failed to push local record (${tableName}):`, error);
                        }
                    } catch (err) {
                        console.error(`[Sync] Error pushing local record (${tableName}):`, err);
                    }
                }
            }

            // Step 2: Fetch cloud records
            const { data: cloudData, error } = await supabase.from(tableName).select('*').eq('user_id', userId);
            if (error) {
                console.error(`[Sync] Fetch error (${tableName}):`, error);
                summary[tableName] = { error: error.message };
                continue;
            }

            console.log(`[Sync] ${tableName}: ${cloudData.length} records found in cloud`);

            // Build a set of cloud supabase IDs for quick lookup
            const cloudIds = new Set(cloudData.map(item => item.id));

            // Step 3: Upsert cloud records locally
            for (const item of cloudData) {
                const existed = await db[tableName].where('supabase_id').equals(item.id).first();
                await applyCloudRecord(tableName, item);
                if (existed) updated++; else added++;
            }

            // Step 4: Delete local records that no longer exist in cloud
            const allLocal = await db[tableName].toArray();
            for (const localRecord of allLocal) {
                // Nếu bản ghi có supabase_id nhưng ID đó không nằm trong danh sách vừa lấy từ cloud -> Xóa
                if (localRecord.supabase_id && !cloudIds.has(localRecord.supabase_id)) {
                    console.log(`[Sync] Deleting ghost ${tableName} record (id=${localRecord.id}, supabase_id=${localRecord.supabase_id}) - not in cloud`);
                    await db[tableName].delete(localRecord.id);
                    deleted++;
                }
            }

            summary[tableName] = { added, updated, deleted, pushed };
            console.log(`[Sync] ${tableName}: +${added} added, ~${updated} updated, -${deleted} deleted, ^${pushed} pushed`);
        }

        console.log('[Sync] Complete!', summary);
    } catch (err) {
        console.error('[Sync] Core sync error:', err);
    } finally {
        isSyncing = false;
    }
    return summary;
};

// Setup Supabase Realtime subscriptions to auto-sync cloud changes
// Returns a cleanup function to unsubscribe
export const setupRealtimeSync = (userId) => {
    const channels = [];
    const syncTables = ['categories', 'wallets', 'goals', 'debts', 'transactions', 'transfers', 'goal_deposits', 'debt_payments', 'budgets'];

    syncTables.forEach(tableName => {
        const channel = supabase
            .channel(`realtime:${tableName}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: tableName,
                    filter: `user_id=eq.${userId}`
                },
                async (payload) => {
                    try {
                        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                            await applyCloudRecord(tableName, payload.new);
                        } else if (payload.eventType === 'DELETE') {
                            const deletedId = payload.old?.id;
                            if (deletedId) {
                                await deleteLocalRecord(tableName, deletedId);
                            }
                        }
                    } catch (err) {
                        console.error(`Realtime sync error (${tableName}):`, err);
                    }
                }
            )
            .subscribe();

        channels.push(channel);
    });

    // Return cleanup function
    return () => {
        channels.forEach(channel => supabase.removeChannel(channel));
    };
};

// Khởi tạo dữ liệu mặc định ban đầu
db.on('populate', async () => {
    await db.categories.bulkAdd([
        { name: 'Ăn uống', type: 'expense', color: '#ff7675', icon: 'utensils', isSystem: true },
        { name: 'Nhà ở', type: 'expense', color: '#74b9ff', icon: 'home', isSystem: true },
        { name: 'Di chuyển', type: 'expense', color: '#ffeaa7', icon: 'car', isSystem: true },
        { name: 'Giải trí', type: 'expense', color: '#a29bfe', icon: 'gamepad-2', isSystem: true },
        { name: 'Lương', type: 'income', color: '#55efc4', icon: 'briefcase', isSystem: true },
        { name: 'Khác', type: 'expense', color: '#dfe6e9', icon: 'help-circle', isSystem: true },
        { name: 'Lãi gửi', type: 'income', color: '#81ecec', icon: 'piggy-bank', isSystem: true },
    ]);

    await db.wallets.add({
        name: 'Tiền mặt',
        type: 'cash',
        balance: 0
    });
});

