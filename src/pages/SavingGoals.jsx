import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Plus, Target, CheckCircle2, MoreVertical, Edit2, History, MinusCircle, Trash2 } from 'lucide-react';
import CurrencyInput from '../components/CurrencyInput';
import DynamicIcon from '../components/DynamicIcon';

const SavingGoals = () => {
    const goals = useLiveQuery(() => db.goals.toArray());
    const wallets = useLiveQuery(() => db.wallets.toArray());

    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [activeMenu, setActiveMenu] = useState(null);
    const [selectedGoal, setSelectedGoal] = useState(null);
    const [editingId, setEditingId] = useState(null);

    const depositHistory = useLiveQuery(() =>
        selectedGoal ? db.goal_deposits.where('goalId').equals(selectedGoal.id).reverse().toArray() : []
        , [selectedGoal]);

    const totalSavings = goals?.reduce((sum, g) => sum + (g.currentAmount || 0), 0) || 0;

    const [goalData, setGoalData] = useState({
        name: '', targetAmount: '', targetDate: new Date().toISOString().split('T')[0]
    });

    const [depositData, setDepositData] = useState({
        walletId: '', amount: '', date: new Date().toISOString().split('T')[0]
    });

    const handleSaveGoal = async (e) => {
        e.preventDefault();
        if (!goalData.name || !goalData.targetAmount) return;

        if (editingId) {
            await db.goals.update(editingId, {
                name: goalData.name,
                targetAmount: Number(goalData.targetAmount),
                targetDate: goalData.targetDate
            });
        } else {
            await db.goals.add({
                name: goalData.name,
                targetAmount: Number(goalData.targetAmount),
                currentAmount: 0,
                targetDate: goalData.targetDate,
                isWithdrawn: false
            });
        }

        setIsGoalModalOpen(false);
        setEditingId(null);
        setGoalData({ name: '', targetAmount: '', targetDate: new Date().toISOString().split('T')[0] });
    };

    const handleDeleteGoal = async (id) => {
        if (window.confirm('Bạn có chắc muốn xóa mục tiêu này? Dữ liệu lịch sử nạp cũng sẽ bị xóa.')) {
            await db.transaction('rw', db.goals, db.goal_deposits, async () => {
                await db.goals.delete(id);
                await db.goal_deposits.where('goalId').equals(id).delete();
            });
            setActiveMenu(null);
        }
    };

    const handleOpenEditGoal = (g) => {
        setEditingId(g.id);
        setGoalData({
            name: g.name,
            targetAmount: g.targetAmount.toString(),
            targetDate: g.targetDate
        });
        setIsGoalModalOpen(true);
        setActiveMenu(null);
    };

    const handleDeposit = async (e) => {
        e.preventDefault();
        if (!depositData.walletId || !depositData.amount || !selectedGoal) return;

        const amountNum = Number(depositData.amount);

        try {
            await db.transaction('rw', db.goals, db.wallets, db.goal_deposits, async () => {
                const goal = await db.goals.get(selectedGoal.id);
                const wallet = await db.wallets.get(Number(depositData.walletId));

                if (wallet.balance < amountNum) {
                    throw new Error('Số dư ví không đủ để nạp tiền!');
                }

                const maxCanDeposit = goal.targetAmount - goal.currentAmount;
                const actualDeposit = Math.min(amountNum, maxCanDeposit);

                // Deduct from wallet
                await db.wallets.update(wallet.id, { balance: wallet.balance - actualDeposit });
                // Add to goal
                await db.goals.update(goal.id, { currentAmount: goal.currentAmount + actualDeposit });
                // Log deposit history
                await db.goal_deposits.add({
                    goalId: goal.id,
                    amount: actualDeposit,
                    date: depositData.date || new Date().toISOString().split('T')[0],
                    walletId: wallet.id,
                    type: 'deposit',
                    createdAt: Date.now()
                });
            });

            setIsDepositModalOpen(false);
            setDepositData({ walletId: '', amount: '', date: new Date().toISOString().split('T')[0] });
            setSelectedGoal(null);
        } catch (error) {
            alert(error.message);
        }
    };

    const handleWithdraw = async (e) => {
        e.preventDefault();
        if (!depositData.walletId || !depositData.amount || !selectedGoal) return;

        const amountNum = Number(depositData.amount);

        if (amountNum > selectedGoal.currentAmount) {
            alert('Số tiền rút không được vượt quá số tiền hiện có!');
            return;
        }

        try {
            await db.transaction('rw', db.goals, db.wallets, db.goal_deposits, async () => {
                const goal = await db.goals.get(selectedGoal.id);
                const wallet = await db.wallets.get(Number(depositData.walletId));

                const newCurrentAmount = goal.currentAmount - amountNum;

                // Handle the "Đã rút tiền" status based on isWithdrawn flag.

                await db.wallets.update(wallet.id, { balance: wallet.balance + amountNum });
                await db.goals.update(goal.id, {
                    currentAmount: newCurrentAmount,
                    isWithdrawn: goal.currentAmount >= goal.targetAmount && newCurrentAmount === 0 ? true : goal.isWithdrawn
                });

                await db.goal_deposits.add({
                    goalId: goal.id,
                    amount: amountNum,
                    date: depositData.date || new Date().toISOString().split('T')[0],
                    walletId: wallet.id,
                    type: 'withdraw',
                    createdAt: Date.now()
                });
            });

            setIsWithdrawModalOpen(false);
            setDepositData({ walletId: '', amount: '', date: new Date().toISOString().split('T')[0] });
            setSelectedGoal(null);
        } catch (error) {
            alert(error.message);
        }
    };

    const getWalletName = (id) => wallets?.find(w => w.id === id)?.name || 'Không rõ';

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Mục tiêu Tiết kiệm</h1>
                    <p className="page-subtitle">Tích lũy cho tương lai • <strong>Tổng tích lũy: {formatMoney(totalSavings)}</strong></p>
                </div>
                <button className="btn-primary" onClick={() => { setEditingId(null); setGoalData({ name: '', targetAmount: '', targetDate: new Date().toISOString().split('T')[0] }); setIsGoalModalOpen(true); }}>
                    <Plus size={20} />
                    Tạo Mục tiêu
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                {(!goals || goals.length === 0) ? (
                    <div className="card glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        Chưa có mục tiêu tiết kiệm nào.
                    </div>
                ) : (
                    (() => {
                        const sortedGoals = [...goals].sort((a, b) => {
                            const pA = (a.currentAmount / a.targetAmount);
                            const pB = (b.currentAmount / b.targetAmount);
                            const doneA = pA >= 1 && !a.isWithdrawn;
                            const doneB = pB >= 1 && !b.isWithdrawn;
                            const withdrawnA = a.isWithdrawn;
                            const withdrawnB = b.isWithdrawn;

                            // Rank 1: Done but not withdrawn
                            if (doneA && !doneB) return -1;
                            if (!doneA && doneB) return 1;

                            // Rank 3: Withdrawn
                            if (!withdrawnA && withdrawnB) return -1;
                            if (withdrawnA && !withdrawnB) return 1;

                            // Rank 2: Progress (descending)
                            return pB - pA;
                        });

                        return sortedGoals.map(g => {
                            const percent = Math.min((g.currentAmount / g.targetAmount) * 100, 100);
                            const isCompleted = percent >= 100;
                            const isWithdrawn = g.isWithdrawn;

                            let themeColor = 'var(--accent-primary)';
                            let themeBg = 'rgba(99, 102, 241, 0.1)';
                            let themeBorder = isCompleted ? 'var(--status-success)' : '';
                            let statusColor = isCompleted ? 'var(--status-success)' : 'var(--text-primary)';

                            if (isWithdrawn) {
                                themeColor = '#f59e0b'; // Amber/Yellow
                                themeBg = 'rgba(245, 158, 11, 0.1)';
                                themeBorder = '1px solid rgba(245, 158, 11, 0.3)';
                                statusColor = '#f59e0b';
                            } else if (isCompleted) {
                                themeColor = 'var(--status-success)';
                                themeBg = 'var(--status-success-bg)';
                            }

                            return (
                                <div key={g.id} className="card glass-panel" style={{ border: themeBorder, position: 'relative', background: isWithdrawn ? 'rgba(245, 158, 11, 0.03)' : '' }} onClick={() => setActiveMenu(null)}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div className="btn-icon" style={{ backgroundColor: themeBg, color: themeColor }}>
                                                {isCompleted ? <CheckCircle2 size={24} /> : <Target size={24} />}
                                            </div>
                                            <div>
                                                <h3 style={{ margin: 0, color: statusColor }}>{g.name}</h3>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Mục tiêu: {new Date(g.targetDate).toLocaleDateString('vi-VN')}</p>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            {isWithdrawn ? (
                                                <span style={{ fontSize: '0.85rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '0.4rem 0.8rem', borderRadius: 'var(--border-radius-sm)', fontWeight: '600' }}>
                                                    Đã rút tiền
                                                </span>
                                            ) : (
                                                <>
                                                    {!isCompleted ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setSelectedGoal(g); setIsDepositModalOpen(true); }}
                                                            className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                                        >
                                                            Nạp tiền
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setSelectedGoal(g); setIsWithdrawModalOpen(true); }}
                                                            className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: 'var(--status-info)' }}
                                                        >
                                                            Rút tiền
                                                        </button>
                                                    )}
                                                </>
                                            )}

                                            <div style={{ position: 'relative' }}>
                                                <button
                                                    className="btn-icon"
                                                    style={{ width: '32px', height: '32px' }}
                                                    onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === g.id ? null : g.id); }}
                                                >
                                                    <MoreVertical size={16} />
                                                </button>

                                                {activeMenu === g.id && (
                                                    <div style={{
                                                        position: 'absolute', right: 0, top: '100%',
                                                        background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
                                                        borderRadius: 'var(--border-radius-sm)', padding: '0.5rem',
                                                        zIndex: 10, minWidth: '150px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                                    }}>
                                                        <button
                                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem', color: 'var(--text-primary)', textAlign: 'left' }}
                                                            onClick={() => { setSelectedGoal(g); setIsHistoryModalOpen(true); setActiveMenu(null); }}
                                                        >
                                                            <History size={14} /> Lịch sử
                                                        </button>
                                                        <button
                                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem', color: 'var(--text-primary)', textAlign: 'left' }}
                                                            onClick={() => handleOpenEditGoal(g)}
                                                        >
                                                            <Edit2 size={14} /> Chỉnh sửa
                                                        </button>
                                                        {!isCompleted && g.currentAmount > 0 && !isWithdrawn && (
                                                            <button
                                                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem', color: 'var(--text-primary)', textAlign: 'left' }}
                                                                onClick={() => { setSelectedGoal(g); setIsWithdrawModalOpen(true); setActiveMenu(null); }}
                                                            >
                                                                <MinusCircle size={14} /> Rút tiền mặt
                                                            </button>
                                                        )}
                                                        <button
                                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem', color: 'var(--status-danger)', textAlign: 'left' }}
                                                            onClick={() => handleDeleteGoal(g.id)}
                                                        >
                                                            <Trash2 size={14} /> Xóa
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ padding: '0.5rem 0' }}>
                                        <div className="flex-between" style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                            <span style={{ color: isWithdrawn ? '#f59e0b' : 'var(--accent-primary)', fontWeight: '600' }}>{formatMoney(g.currentAmount)}</span>
                                            <span style={{ color: 'var(--text-secondary)' }}>/ {formatMoney(g.targetAmount)}</span>
                                        </div>

                                        <div style={{ width: '100%', height: '10px', background: 'var(--bg-tertiary)', borderRadius: '5px', overflow: 'hidden' }}>
                                            <div
                                                style={{
                                                    width: `${percent}%`,
                                                    height: '100%',
                                                    background: isWithdrawn ? '#f59e0b' : isCompleted ? 'var(--status-success)' : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                                                    borderRadius: '5px',
                                                    transition: 'width 0.5s ease-out'
                                                }}
                                            />
                                        </div>

                                        <div className="flex-between" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>{percent.toFixed(1)}% Hoàn thành</span>
                                            {!isCompleted && <span style={{ color: 'var(--text-muted)' }}>Cần thêm {formatMoney(g.targetAmount - g.currentAmount)}</span>}
                                            {isCompleted && !isWithdrawn && <span style={{ color: 'var(--status-success)' }}>Đã đạt mục tiêu! 🎉</span>}
                                            {isWithdrawn && <span style={{ color: '#f59e0b', fontWeight: '500' }}>Đã rút toàn bộ số tiền</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        });
                    })()
                )}
            </div>

            {/* Goal Creation Modal */}
            {isGoalModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <div className="card glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
                        <h2>{editingId ? 'Chỉnh Sửa Mục Tiêu' : 'Tạo Mục Tiêu Tiết Kiệm'}</h2>
                        <form onSubmit={handleSaveGoal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Tên Mục Tiêu</label>
                                <input
                                    type="text" className="input-field" placeholder="Vd: Mua xe, Du lịch..."
                                    value={goalData.name} onChange={e => setGoalData({ ...goalData, name: e.target.value })} required
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Số tiền mục tiêu (₫)</label>
                                <input
                                    type="number" className="input-field" placeholder="50000000"
                                    value={goalData.targetAmount} onChange={e => setGoalData({ ...goalData, targetAmount: e.target.value })} required
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Ngày hoàn thành dự kiến</label>
                                <input
                                    type="date" className="input-field"
                                    value={goalData.targetDate} onChange={e => setGoalData({ ...goalData, targetDate: e.target.value })} required
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="input-field" style={{ flex: 1, textAlign: 'center' }} onClick={() => { setIsGoalModalOpen(false); setEditingId(null); }}>Hủy</button>
                                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>{editingId ? 'Cập Nhật' : 'Lưu Mục Tiêu'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Deposit Modal */}
            {isDepositModalOpen && selectedGoal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <div className="card glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
                        <h2>Nạp tiền: {selectedGoal.name}</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            Cần thêm: {formatMoney(selectedGoal.targetAmount - selectedGoal.currentAmount)}
                        </p>
                        <form onSubmit={handleDeposit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Nạp từ Ví</label>
                                <select
                                    className="input-field"
                                    value={depositData.walletId} onChange={e => setDepositData({ ...depositData, walletId: e.target.value })} required
                                >
                                    <option value="" disabled>Chọn ví nguồn</option>
                                    {wallets?.map(w => <option key={w.id} value={w.id}>{w.name} (Số dư: {formatMoney(w.balance)})</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Số tiền nạp (₫)</label>
                                <CurrencyInput
                                    className="input-field" placeholder="1,000,000"
                                    value={depositData.amount} onChange={val => setDepositData({ ...depositData, amount: val })} required
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Ngày nạp</label>
                                <input
                                    type="date" className="input-field"
                                    value={depositData.date} onChange={e => setDepositData({ ...depositData, date: e.target.value })} required
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="input-field" style={{ flex: 1, textAlign: 'center' }} onClick={() => { setIsDepositModalOpen(false); setSelectedGoal(null); }}>Hủy</button>
                                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Xác nhận nạp</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Withdraw Modal */}
            {isWithdrawModalOpen && selectedGoal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <div className="card glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
                        <h2>Rút tiền: {selectedGoal.name}</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            Số tiền khả dụng: {formatMoney(selectedGoal.currentAmount)}
                        </p>
                        <form onSubmit={handleWithdraw} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Rút về Ví</label>
                                <select
                                    className="input-field"
                                    value={depositData.walletId} onChange={e => setDepositData({ ...depositData, walletId: e.target.value })} required
                                >
                                    <option value="" disabled>Chọn ví nhận</option>
                                    {wallets?.map(w => <option key={w.id} value={w.id}>{w.name} (Số dư: {formatMoney(w.balance)})</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Số tiền rút (₫)</label>
                                <CurrencyInput
                                    className="input-field" placeholder="1,000,000"
                                    value={depositData.amount} onChange={val => setDepositData({ ...depositData, amount: val })} required
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Ngày rút</label>
                                <input
                                    type="date" className="input-field"
                                    value={depositData.date} onChange={e => setDepositData({ ...depositData, date: e.target.value })} required
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="input-field" style={{ flex: 1, textAlign: 'center' }} onClick={() => { setIsWithdrawModalOpen(false); setSelectedGoal(null); }}>Hủy</button>
                                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center', background: 'var(--status-info)' }}>Xác nhận rút</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {isHistoryModalOpen && selectedGoal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <div className="card glass-panel" style={{ width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0 }}>Lịch sử: {selectedGoal.name}</h2>
                            <button onClick={() => { setIsHistoryModalOpen(false); setSelectedGoal(null); }} style={{ color: 'var(--text-muted)' }}>Đóng</button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {(!depositHistory || depositHistory.length === 0) ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Chưa có lịch sử giao dịch nào.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--glass-border)' }}>
                                    {depositHistory.map(h => (
                                        <div key={h.id} className="flex-between" style={{ background: 'var(--bg-secondary)', padding: '1rem' }}>
                                            <div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{h.type === 'withdraw' ? 'Rút tiền' : 'Nạp tiền'}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(h.date).toLocaleDateString('vi-VN')} • {getWalletName(h.walletId)}</div>
                                            </div>
                                            <div style={{ fontWeight: '600', color: h.type === 'withdraw' ? 'var(--status-danger)' : 'var(--status-success)' }}>
                                                {h.type === 'withdraw' ? '-' : '+'}{formatMoney(h.amount)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SavingGoals;
