import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Plus, Search, Calendar, Tag, CreditCard, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import DynamicIcon from '../components/DynamicIcon';
import TransactionModal from '../components/TransactionModal';

const Transactions = () => {
    const transactions = useLiveQuery(() => db.transactions.toArray());
    const transfers = useLiveQuery(() => db.transfers.toArray());
    const goalDeposits = useLiveQuery(() => db.goal_deposits.toArray());
    const debtPayments = useLiveQuery(() => db.debt_payments.toArray());

    const categories = useLiveQuery(() => db.categories.toArray());
    const wallets = useLiveQuery(() => db.wallets.toArray());
    const goals = useLiveQuery(() => db.goals.toArray());

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeMenu, setActiveMenu] = useState(null);
    const [transactionType, setTransactionType] = useState('expense');

    // Filters
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [activeDateTag, setActiveDateTag] = useState('');

    const [selectedTransaction, setSelectedTransaction] = useState(null);

    const handleOpenModal = (t = null) => {
        if (t) {
            setSelectedTransaction(t);
        } else {
            setSelectedTransaction(null);
        }
        setIsModalOpen(true);
        setActiveMenu(null);
    };

    // Note: Transaction Modal has been refactored to its own component `TransactionModal` but Transactions.jsx contains an old inline modal block at the bottom
    // Which isn't being fully replaced but simplified here since handleOpenModal opens the old inline modal

    const applyDatePreset = (preset) => {
        setActiveDateTag(preset);
        const today = new Date();
        const yyyyMmDd = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        setToDate(yyyyMmDd(today));

        let start = new Date(today);
        if (preset === 'today') {
            setFromDate(yyyyMmDd(today));
        } else if (preset === '3days') {
            start.setDate(today.getDate() - 3);
            setFromDate(yyyyMmDd(start));
        } else if (preset === '7days') {
            start.setDate(today.getDate() - 7);
            setFromDate(yyyyMmDd(start));
        } else if (preset === '30days') {
            start.setDate(today.getDate() - 30);
            setFromDate(yyyyMmDd(start));
        } else {
            setFromDate('');
            setToDate('');
            setActiveDateTag('');
        }
    };

    // Combine all history
    const allHistory = [
        ...(transactions || []).map(t => ({ ...t, type: 'transaction' })),
        ...(transfers || []).map(t => ({ ...t, type: 'transfer' })),
        ...(goalDeposits || []).map(t => ({ ...t, type: 'goal_deposit' })),
        ...(debtPayments || []).map(t => ({ ...t, type: 'debt_payment' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date) || (b.createdAt || 0) - (a.createdAt || 0));

    const displayTransactions = allHistory.filter(t => {
        if (!fromDate && !toDate) return true;
        const tDate = t.date;
        if (fromDate && tDate < fromDate) return false;
        if (toDate && tDate > toDate) return false;
        return true;
    });

    const handleDelete = async (t) => {
        if (!window.confirm('Bạn có chắc muốn xóa giao dịch này?')) return;

        try {
            if (t.type === 'transaction') {
                await db.transaction('rw', db.transactions, db.wallets, async () => {
                    const cat = categories.find(c => c.id === t.categoryId);
                    const isExpense = cat?.type === 'expense';
                    const wallet = await db.wallets.get(t.walletId);
                    if (wallet) {
                        const newBalance = isExpense ? wallet.balance + t.amount : wallet.balance - t.amount;
                        await db.wallets.update(wallet.id, { balance: newBalance });
                    }
                    await db.transactions.delete(t.id);
                });
            } else if (t.type === 'transfer') {
                await db.transaction('rw', db.transfers, db.wallets, async () => {
                    const fromW = t.fromWalletId ? await db.wallets.get(t.fromWalletId) : null;
                    const toW = t.toWalletId ? await db.wallets.get(t.toWalletId) : null;
                    if (fromW) await db.wallets.update(fromW.id, { balance: fromW.balance + t.amount });
                    if (toW) await db.wallets.update(toW.id, { balance: toW.balance - t.amount });
                    await db.transfers.delete(t.id);
                });
            } else if (t.type === 'goal_deposit') {
                await db.transaction('rw', db.goal_deposits, db.goals, db.wallets, async () => {
                    const wallet = await db.wallets.get(t.walletId);
                    const goal = await db.goals.get(t.goalId);
                    if (wallet) await db.wallets.update(wallet.id, { balance: wallet.balance + t.amount });
                    if (goal) await db.goals.update(goal.id, { currentAmount: Math.max(0, goal.currentAmount - t.amount) });
                    await db.goal_deposits.delete(t.id);
                });
            } else if (t.type === 'debt_payment') {
                await db.transaction('rw', db.debt_payments, db.debts, db.wallets, async () => {
                    const wallet = await db.wallets.get(t.walletId);
                    const debt = await db.debts.get(t.debtId);
                    if (wallet) await db.wallets.update(wallet.id, { balance: wallet.balance + t.amount });
                    if (debt) await db.debts.update(debt.id, { remainingAmount: debt.remainingAmount + t.amount });
                    await db.debt_payments.delete(t.id);
                });
            }
            setActiveMenu(null);
        } catch (error) {
            console.error(error);
            alert('Có lỗi xảy ra khi xóa.');
        }
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const getCategory = (id) => categories?.find(c => c.id === id);
    const getWallet = (id) => wallets?.find(w => w.id === id);

    return (
        <div className="animate-fade-in" onClick={() => setActiveMenu(null)}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Giao dịch</h1>
                    <p className="page-subtitle">Theo dõi luồng tiền thu chi của bạn</p>
                </div>
                <button className="btn-primary" onClick={() => handleOpenModal()}>
                    <Plus size={20} />
                    Thêm Giao dịch
                </button>
            </div>

            <div className="card glass-panel" style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 200px' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Từ Ngày</label>
                    <input
                        type="date"
                        className="input-field"
                        value={fromDate}
                        onChange={(e) => { setFromDate(e.target.value); setActiveDateTag(''); }}
                    />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Đến Ngày</label>
                    <input
                        type="date"
                        className="input-field"
                        value={toDate}
                        onChange={(e) => { setToDate(e.target.value); setActiveDateTag(''); }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', height: '100%', paddingBottom: '0.5rem' }}>
                    <button
                        onClick={() => applyDatePreset('')}
                        style={{ padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.85rem', background: activeDateTag === '' && !fromDate && !toDate ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: activeDateTag === '' && !fromDate && !toDate ? 'white' : 'var(--text-primary)' }}
                    >Tất cả</button>
                    <button
                        onClick={() => applyDatePreset('today')}
                        style={{ padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.85rem', background: activeDateTag === 'today' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: activeDateTag === 'today' ? 'white' : 'var(--text-primary)' }}
                    >Hôm nay</button>
                    <button
                        onClick={() => applyDatePreset('3days')}
                        style={{ padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.85rem', background: activeDateTag === '3days' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: activeDateTag === '3days' ? 'white' : 'var(--text-primary)' }}
                    >3 Ngày qua</button>
                    <button
                        onClick={() => applyDatePreset('7days')}
                        style={{ padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.85rem', background: activeDateTag === '7days' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: activeDateTag === '7days' ? 'white' : 'var(--text-primary)' }}
                    >7 Ngày qua</button>
                    <button
                        onClick={() => applyDatePreset('30days')}
                        style={{ padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.85rem', background: activeDateTag === '30days' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: activeDateTag === '30days' ? 'white' : 'var(--text-primary)' }}
                    >30 Ngày qua</button>
                </div>
            </div>

            <div className="card glass-panel" style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--glass-border)' }}>
                {(!displayTransactions || displayTransactions.length === 0) ? (
                    <div style={{ background: 'var(--bg-secondary)', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Chưa có giao dịch nào thỏa mãn lọc.
                    </div>
                ) : (
                    displayTransactions.map((t, index) => {
                        let cat = null;
                        let wallet = null;
                        let title = '';
                        let subtitle = '';
                        let amountColor = '';
                        let iconName = 'receipt';
                        let iconColor = '#999';

                        if (t.type === 'transaction') {
                            cat = categories?.find(c => c.id === t.categoryId);
                            wallet = wallets?.find(w => w.id === t.walletId);
                            title = cat?.name || 'Giao dịch';
                            const isExpense = cat?.type === 'expense';
                            amountColor = isExpense ? 'var(--status-danger)' : 'var(--status-success)';
                            iconName = cat?.icon || 'receipt';
                            iconColor = cat?.color || '#999';
                            subtitle = wallet?.name || 'Không rõ';
                        } else if (t.type === 'transfer') {
                            const fromW = wallets?.find(w => w.id === t.fromWalletId);
                            const toW = wallets?.find(w => w.id === t.toWalletId);
                            title = 'Chuyển tiền';
                            subtitle = `${fromW?.name || 'Bên ngoài'} ➜ ${toW?.name || 'Bên ngoài'}`;
                            amountColor = 'var(--accent-primary)';
                            iconName = 'repeat';
                            iconColor = 'var(--accent-primary)';
                        } else if (t.type === 'goal_deposit') {
                            const goal = goals?.find(g => g.id === t.goalId);
                            const w = wallets?.find(w => w.id === t.walletId);
                            title = `Tiết kiệm: ${goal?.name || 'Mục tiêu'}`;
                            subtitle = `Từ ${w?.name || 'ví'}`;
                            amountColor = 'var(--status-danger)'; // Spending into savings
                            iconName = 'piggy-bank';
                            iconColor = 'var(--status-success)';
                        } else if (t.type === 'debt_payment') {
                            title = 'Trả nợ';
                            const w = wallets?.find(w => w.id === t.walletId);
                            subtitle = `Từ ${w?.name || 'ví'}`;
                            amountColor = 'var(--status-danger)';
                            iconName = 'credit-card';
                            iconColor = 'var(--status-warning)';
                        }

                        // Add date header if it's the first transaction of the day
                        const prevT = index > 0 ? displayTransactions[index - 1] : null;
                        const showDateHeader = !prevT || prevT.date !== t.date;

                        return (
                            <React.Fragment key={`${t.type}-${t.id}`}>
                                {showDateHeader && (
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem 1.5rem', fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-secondary)' }}>
                                        {new Date(t.date).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </div>
                                )}
                                <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div className="btn-icon" style={{ backgroundColor: `${iconColor}22`, color: iconColor }}>
                                            <DynamicIcon name={iconName} size={20} />
                                        </div>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h4>
                                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CreditCard size={12} /> {subtitle}</span>
                                                {t.note && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Tag size={12} /> {t.note}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <h3 style={{ margin: 0, color: amountColor }}>
                                            {t.type === 'transaction' && (categories?.find(c => c.id === t.categoryId)?.type === 'expense' ? '-' : '+')}
                                            {t.type === 'transfer' ? '' : (t.type === 'transaction' ? '' : '-')}
                                            {formatMoney(t.amount)}
                                        </h3>
                                        <div style={{ position: 'relative' }}>
                                            <button
                                                style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0.25rem' }}
                                                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === `${t.type}-${t.id}` ? null : `${t.type}-${t.id}`); }}
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                            {activeMenu === `${t.type}-${t.id}` && (
                                                <div style={{
                                                    position: 'absolute', right: 0, top: '100%',
                                                    background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
                                                    borderRadius: 'var(--border-radius-sm)', padding: '0.5rem',
                                                    zIndex: 10, minWidth: '120px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                                }}>
                                                    <button
                                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem', color: 'var(--text-primary)', textAlign: 'left' }}
                                                        onClick={() => handleOpenModal(t)}
                                                    >
                                                        <Edit2 size={14} /> Sửa
                                                    </button>
                                                    <button
                                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem', color: 'var(--status-danger)', textAlign: 'left' }}
                                                        onClick={() => handleDelete(t)}
                                                    >
                                                        <Trash2 size={14} /> Xóa
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })
                )}
            </div>

            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                editingId={selectedTransaction?.id}
                initialData={selectedTransaction}
            />
        </div>
    );
};

export default Transactions;
