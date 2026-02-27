import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Link } from 'react-router-dom';
import { Wallet, TrendingUp, TrendingDown, ArrowRight, AlertCircle, MoreVertical, Edit2, Trash2, CreditCard, Tag } from 'lucide-react';
import DynamicIcon from '../components/DynamicIcon';
import TransactionModal from '../components/TransactionModal';
import BudgetModal from '../components/BudgetModal';

const Dashboard = () => {
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
    const [activeMenu, setActiveMenu] = useState(null);
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    const wallets = useLiveQuery(() => db.wallets.toArray());
    const transactions = useLiveQuery(() => db.transactions.toArray());
    const categories = useLiveQuery(() => db.categories.toArray());
    const budgets = useLiveQuery(() => db.budgets.toArray());
    const debts = useLiveQuery(() => db.debts.toArray());
    const debtPayments = useLiveQuery(() => db.debt_payments.toArray());
    const goalDeposits = useLiveQuery(() => db.goal_deposits.toArray());
    const transfers = useLiveQuery(() => db.transfers.toArray());
    const goals = useLiveQuery(() => db.goals.toArray());

    const totalBalance = wallets?.reduce((sum, w) => sum + Number(w.balance), 0) || 0;

    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

    let incomeThisMonth = 0;
    let expenseThisMonth = 0;

    let expensesByWalletType = {
        cash: 0,
        bank: 0,
        credit: 0
    };

    if (transactions && categories && wallets) {
        transactions.forEach(t => {
            if (t.date.startsWith(currentMonth)) {
                const cat = categories.find(c => c.id === t.categoryId);
                if (cat) {
                    if (cat.type === 'income') incomeThisMonth += Number(t.amount);
                    if (cat.type === 'expense') {
                        expenseThisMonth += Number(t.amount);
                        const wallet = wallets.find(w => w.id === t.walletId);
                        if (wallet) {
                            expensesByWalletType[wallet.type] = (expensesByWalletType[wallet.type] || 0) + Number(t.amount);
                        }
                    }
                }
            }
        });
    }

    // Include debt payments and goal deposits in expenses
    if (debtPayments && wallets) {
        debtPayments.forEach(dp => {
            if (dp.date.startsWith(currentMonth)) {
                expenseThisMonth += Number(dp.amount);
                const wallet = wallets.find(w => w.id === dp.walletId);
                if (wallet) {
                    expensesByWalletType[wallet.type] = (expensesByWalletType[wallet.type] || 0) + Number(dp.amount);
                }
            }
        });
    }
    if (goalDeposits && wallets) {
        goalDeposits.forEach(gd => {
            if (gd.date.startsWith(currentMonth)) {
                expenseThisMonth += Number(gd.amount);
                const wallet = wallets.find(w => w.id === gd.walletId);
                if (wallet) {
                    expensesByWalletType[wallet.type] = (expensesByWalletType[wallet.type] || 0) + Number(gd.amount);
                }
            }
        });
    }

    // Combine all history for recent transactions
    let allHistory = [];
    if (transactions) {
        allHistory = [...transactions.map(t => ({ ...t, type: 'transaction' }))];
    }
    if (debtPayments) {
        allHistory = [...allHistory, ...debtPayments.map(dp => ({ ...dp, type: 'debt_payment' }))];
    }
    if (goalDeposits) {
        allHistory = [...allHistory, ...goalDeposits.map(gd => ({ ...gd, type: 'goal_deposit' }))];
    }
    if (transfers) {
        allHistory = [...allHistory, ...transfers.map(tr => ({ ...tr, type: 'transfer' }))];
    }

    // Sort by date descending and then by creation time for same-day transactions
    allHistory.sort((a, b) => new Date(b.date) - new Date(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
    const recentActivity = allHistory.slice(0, 5);

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const getCategory = (id) => categories?.find(c => c.id === id);

    const handleOpenEdit = (t) => {
        setSelectedTransaction(t);
        setIsTxModalOpen(true);
        setActiveMenu(null);
    };

    const handleDelete = async (t) => {
        if (!window.confirm('Bạn có chắc muốn xóa giao dịch này?')) return;
        try {
            if (t.type === 'transaction') {
                await db.transaction('rw', db.transactions, db.wallets, async () => {
                    const cat = categories.find(c => c.id === t.categoryId);
                    const isExpense = cat?.type === 'expense';
                    const wallet = await db.wallets.get(t.walletId);
                    if (wallet) await db.wallets.update(wallet.id, { balance: isExpense ? wallet.balance + t.amount : wallet.balance - t.amount });
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
        } catch (err) {
            console.error(err);
            alert('Có lỗi xảy ra khi xóa.');
        }
    };

    const calculateSpent = (categoryId) => {
        if (!transactions) return 0;
        return transactions
            .filter(t => t.categoryId === categoryId && t.date.startsWith(currentMonth))
            .reduce((sum, t) => sum + Number(t.amount), 0);
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Tổng quan Tài chính</h1>
                    <p className="page-subtitle">Chào mừng quay trở lại. Đây là tình hình tài chính của bạn.</p>
                </div>
                <button onClick={() => setIsTxModalOpen(true)} className="btn-primary" style={{ display: 'inline-flex' }}>
                    + Thêm Giao dịch
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card glass-panel" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05))', position: 'relative' }}>
                    <div className="flex-between">
                        <div>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Tổng Số Dư</p>
                            <h2 style={{ fontSize: '2rem', color: 'var(--text-primary)', margin: 0 }}>{formatMoney(totalBalance)}</h2>
                        </div>
                        <div className="btn-icon" style={{ width: '48px', height: '48px', background: 'var(--accent-primary)', color: 'white' }}>
                            <Wallet size={24} />
                        </div>
                    </div>
                    {wallets && wallets.length > 0 && (
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)', fontSize: '0.85rem' }}>
                            {wallets.map(w => (
                                <div key={w.id} className="flex-between" style={{ marginBottom: '0.25rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>- {w.name} ({w.type === 'cash' ? 'Tiền mặt' : w.type === 'bank' ? 'Ngân hàng' : 'Tín dụng'}):</span>
                                    <span style={{ fontWeight: '500' }}>{formatMoney(w.balance)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card glass-panel flex-between">
                    <div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Thu Nhập Tháng Này</p>
                        <h2 style={{ fontSize: '2rem', color: 'var(--status-success)', margin: 0 }}>{formatMoney(incomeThisMonth)}</h2>
                    </div>
                    <div className="btn-icon" style={{ width: '48px', height: '48px', background: 'var(--status-success-bg)', color: 'var(--status-success)' }}>
                        <TrendingUp size={24} />
                    </div>
                </div>

                <div className="card glass-panel hover-card" style={{ position: 'relative' }}>
                    <div className="flex-between">
                        <div>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Chi Tiêu Tháng Này</p>
                            <h2 style={{ fontSize: '2rem', color: 'var(--status-danger)', margin: 0 }}>{formatMoney(expenseThisMonth)}</h2>
                        </div>
                        <div className="btn-icon" style={{ width: '48px', height: '48px', background: 'var(--status-danger-bg)', color: 'var(--status-danger)' }}>
                            <TrendingDown size={24} />
                        </div>
                    </div>
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)', fontSize: '0.85rem' }}>
                        <div className="flex-between" style={{ marginBottom: '0.25rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>- Từ Tiền mặt:</span>
                            <span style={{ fontWeight: '500' }}>{formatMoney(expensesByWalletType.cash)}</span>
                        </div>
                        <div className="flex-between" style={{ marginBottom: '0.25rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>- Từ Ngân hàng:</span>
                            <span style={{ fontWeight: '500' }}>{formatMoney(expensesByWalletType.bank)}</span>
                        </div>
                        <div className="flex-between" style={{ marginBottom: '0.25rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>- Từ Thẻ tín dụng:</span>
                            <span style={{ fontWeight: '500' }}>{formatMoney(expensesByWalletType.credit)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                <div className="card glass-panel" style={{ minHeight: '350px' }}>
                    <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0 }}>Giao dịch gần đây</h3>
                        <Link to="/transactions" style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                            Xem tất cả <ArrowRight size={16} />
                        </Link>
                    </div>

                    <div onClick={() => setActiveMenu(null)} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        {(!recentActivity || recentActivity.length === 0) ? (
                            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                                Chưa có hoạt động nào gần đây.
                            </div>
                        ) : (
                            recentActivity.map(item => {
                                let cat = null;
                                let title = '';
                                let subtitle = '';
                                let amountColor = '';
                                let prefix = '';
                                let iconName = 'receipt';
                                let iconColor = '#999';

                                if (item.type === 'transaction') {
                                    cat = getCategory(item.categoryId);
                                    const wallet = wallets?.find(w => w.id === item.walletId);
                                    const isExpense = cat?.type === 'expense';
                                    title = cat?.name || 'Giao dịch';
                                    subtitle = wallet?.name || '';
                                    amountColor = isExpense ? 'var(--status-danger)' : 'var(--status-success)';
                                    prefix = isExpense ? '-' : '+';
                                    iconName = cat?.icon || 'receipt';
                                    iconColor = cat?.color || '#999';
                                } else if (item.type === 'transfer') {
                                    const fromW = wallets?.find(w => w.id === item.fromWalletId);
                                    const toW = wallets?.find(w => w.id === item.toWalletId);
                                    title = 'Chuyển tiền';
                                    subtitle = `${fromW?.name || 'Bên ngoài'} ➜ ${toW?.name || 'Bên ngoài'}`;
                                    amountColor = 'var(--accent-primary)';
                                    prefix = '';
                                    iconName = 'repeat';
                                    iconColor = 'var(--accent-primary)';
                                } else if (item.type === 'goal_deposit') {
                                    const goal = goals?.find(g => g.id === item.goalId);
                                    const w = wallets?.find(w => w.id === item.walletId);
                                    title = `Tiết kiệm: ${goal?.name || 'Mục tiêu'}`;
                                    subtitle = `Từ ${w?.name || 'ví'}`;
                                    amountColor = 'var(--status-danger)';
                                    prefix = '-';
                                    iconName = 'piggy-bank';
                                    iconColor = 'var(--status-success)';
                                } else if (item.type === 'debt_payment') {
                                    const w = wallets?.find(w => w.id === item.walletId);
                                    title = 'Trả nợ';
                                    subtitle = `Từ ${w?.name || 'ví'}`;
                                    amountColor = 'var(--status-danger)';
                                    prefix = '-';
                                    iconName = 'credit-card';
                                    iconColor = 'var(--status-warning)';
                                }

                                const menuKey = `${item.type}-${item.id}`;

                                return (
                                    <div key={menuKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 0', borderBottom: '1px solid var(--glass-border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div className="btn-icon" style={{ backgroundColor: `${iconColor}22`, color: iconColor, width: '38px', height: '38px', flexShrink: 0 }}>
                                                <DynamicIcon name={iconName} size={18} />
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '1rem' }}>{title}</h4>
                                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.2rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                                    {subtitle && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CreditCard size={11} /> {subtitle}</span>}
                                                    {item.note && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Tag size={11} /> {item.note}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ fontWeight: '600', color: amountColor, fontSize: '1rem' }}>
                                                {prefix}{formatMoney(item.amount)}
                                            </span>
                                            <div style={{ position: 'relative' }}>
                                                <button
                                                    style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0.25rem' }}
                                                    onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === menuKey ? null : menuKey); }}
                                                >
                                                    <MoreVertical size={16} />
                                                </button>
                                                {activeMenu === menuKey && (
                                                    <div style={{
                                                        position: 'absolute', right: 0, top: '100%',
                                                        background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
                                                        borderRadius: 'var(--border-radius-sm)', padding: '0.5rem',
                                                        zIndex: 10, minWidth: '120px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                                    }}>
                                                        {item.type !== 'goal_deposit' && item.type !== 'debt_payment' && (
                                                            <button
                                                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem', color: 'var(--text-primary)', textAlign: 'left' }}
                                                                onClick={() => handleOpenEdit(item)}
                                                            >
                                                                <Edit2 size={14} /> Sửa
                                                            </button>
                                                        )}
                                                        <button
                                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem', color: 'var(--status-danger)', textAlign: 'left' }}
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                                                        >
                                                            <Trash2 size={14} /> Xóa
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="card glass-panel" style={{ minHeight: '350px' }}>
                    <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0 }}>Ngân sách tháng này</h3>
                        <button onClick={() => setIsBudgetModalOpen(true)} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: 'none', cursor: 'pointer' }}>
                            Thiết lập
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {(!budgets || budgets.length === 0) ? (
                            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                                <p style={{ marginBottom: '1rem' }}>Chưa thiết lập mục tiêu ngân sách nào.</p>
                            </div>
                        ) : (
                            budgets.map(b => {
                                const cat = getCategory(b.categoryId);
                                if (!cat) return null;

                                const spent = calculateSpent(b.categoryId);
                                const limit = b.limit;
                                const percent = Math.min((spent / limit) * 100, 100);

                                let barColor = 'var(--status-success)';
                                if (percent >= 100) barColor = 'var(--status-danger)';
                                else if (percent >= 80) barColor = 'var(--status-warning)';

                                return (
                                    <div key={b.id}>
                                        <div className="flex-between" style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <DynamicIcon name={cat.icon} size={16} color={cat.color} />
                                                {cat.name}
                                            </span>
                                            <span style={{ color: 'var(--text-secondary)' }}>{formatMoney(spent)} / {formatMoney(limit)}</span>
                                        </div>
                                        <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div
                                                style={{ width: `${percent}%`, height: '100%', background: barColor, borderRadius: '3px' }}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            <TransactionModal
                isOpen={isTxModalOpen}
                onClose={() => { setIsTxModalOpen(false); setSelectedTransaction(null); }}
                editingId={selectedTransaction?.id || null}
                initialData={selectedTransaction}
            />
            <BudgetModal isOpen={isBudgetModalOpen} onClose={() => setIsBudgetModalOpen(false)} />
        </div>
    );
};

export default Dashboard;
