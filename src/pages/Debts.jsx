import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Plus, TrendingDown, CheckCircle, Clock } from 'lucide-react';
import CurrencyInput from '../components/CurrencyInput';

const Debts = () => {
    const debts = useLiveQuery(() => db.debts.toArray());
    const wallets = useLiveQuery(() => db.wallets.toArray());

    const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedDebt, setSelectedDebt] = useState(null);
    const [debtHistory, setDebtHistory] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [activeMenu, setActiveMenu] = useState(null);

    const [debtData, setDebtData] = useState({
        name: '', totalAmount: '', startDate: new Date().toISOString().split('T')[0]
    });

    const [paymentData, setPaymentData] = useState({
        walletId: '', amount: '', date: new Date().toISOString().split('T')[0]
    });

    const handleSaveDebt = async (e) => {
        e.preventDefault();
        if (!debtData.name || !debtData.totalAmount) return;

        if (isEditing && selectedDebt) {
            const diff = Number(debtData.totalAmount) - selectedDebt.totalAmount;
            await db.debts.update(selectedDebt.id, {
                name: debtData.name,
                totalAmount: Number(debtData.totalAmount),
                remainingAmount: selectedDebt.remainingAmount + diff,
                startDate: debtData.startDate
            });
        } else {
            await db.debts.add({
                name: debtData.name,
                totalAmount: Number(debtData.totalAmount),
                remainingAmount: Number(debtData.totalAmount),
                startDate: debtData.startDate,
                status: 'pending'
            });
        }

        setIsDebtModalOpen(false);
        setIsEditing(false);
        setSelectedDebt(null);
        setDebtData({ name: '', totalAmount: '', startDate: new Date().toISOString().split('T')[0] });
    };

    const handleEditDebt = (debt) => {
        setSelectedDebt(debt);
        setDebtData({
            name: debt.name,
            totalAmount: debt.totalAmount.toString(),
            startDate: debt.startDate
        });
        setIsEditing(true);
        setIsDebtModalOpen(true);
        setActiveMenu(null);
    };

    const handleDeleteDebt = async (debt) => {
        if (!window.confirm(`Bạn có chắc muốn xóa khoản nợ "${debt.name}"? Hành động này sẽ xóa cả lịch sử trả nợ liên quan.`)) return;

        try {
            await db.transaction('rw', db.debts, db.debt_payments, db.wallets, async () => {
                const payments = await db.debt_payments.where('debtId').equals(debt.id).toArray();

                // Hoàn tiền lại ví từ lịch sử trả nợ
                for (const p of payments) {
                    const wallet = await db.wallets.get(p.walletId);
                    if (wallet) {
                        await db.wallets.update(wallet.id, { balance: wallet.balance + p.amount });
                    }
                }

                // Xóa lịch sử và khoản nợ
                await db.debt_payments.where('debtId').equals(debt.id).delete();
                await db.debts.delete(debt.id);
            });
            setActiveMenu(null);
        } catch (error) {
            console.error(error);
            alert('Lỗi khi xóa khoản nợ.');
        }
    };

    const handlePayment = async (e) => {
        e.preventDefault();
        if (!paymentData.walletId || !paymentData.amount || !selectedDebt) return;

        const amountNum = Number(paymentData.amount);

        try {
            await db.transaction('rw', db.debts, db.wallets, db.debt_payments, async () => {
                const debt = await db.debts.get(selectedDebt.id);
                const wallet = await db.wallets.get(Number(paymentData.walletId));

                if (wallet.balance < amountNum) {
                    throw new Error('Số dư ví không đủ để thanh toán!');
                }

                const actualPayment = Math.min(amountNum, debt.remainingAmount);
                const newRemaining = debt.remainingAmount - actualPayment;

                // Deduct from wallet
                await db.wallets.update(wallet.id, { balance: wallet.balance - actualPayment });

                // Add to payment history
                await db.debt_payments.add({
                    debtId: debt.id,
                    amount: actualPayment,
                    date: paymentData.date,
                    walletId: wallet.id,
                    createdAt: Date.now()
                });

                // Update debt
                await db.debts.update(debt.id, {
                    remainingAmount: newRemaining,
                    status: newRemaining <= 0 ? 'completed' : 'pending'
                });
            });

            setIsPaymentModalOpen(false);
            setPaymentData({ walletId: '', amount: '', date: new Date().toISOString().split('T')[0] });
            setSelectedDebt(null);
        } catch (error) {
            alert(error.message);
        }
    };

    const handleViewHistory = async (debt) => {
        const history = await db.debt_payments.where('debtId').equals(debt.id).reverse().toArray();
        setDebtHistory(history);
        setSelectedDebt(debt);
        setIsHistoryModalOpen(true);
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Quản lý Nợ</h1>
                    <p className="page-subtitle">Theo dõi các khoản vay của bạn</p>
                </div>
                <button className="btn-primary" onClick={() => setIsDebtModalOpen(true)}>
                    <Plus size={20} />
                    Thêm Khoản nợ
                </button>
            </div>

            <div onClick={() => setActiveMenu(null)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                {(!debts || debts.length === 0) ? (
                    <div className="card glass-panel" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        Bạn không có khoản nợ nào. Tuyệt vời!
                    </div>
                ) : (
                    debts.map(d => {
                        const isCompleted = d.status === 'completed';
                        const percent = isCompleted ? 100 : ((d.totalAmount - d.remainingAmount) / d.totalAmount) * 100;

                        return (
                            <div key={d.id} className="card glass-panel" style={{ opacity: isCompleted ? 0.7 : 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div className="btn-icon" style={{ backgroundColor: isCompleted ? 'var(--status-success-bg)' : 'rgba(239, 68, 68, 0.1)', color: isCompleted ? 'var(--status-success)' : 'var(--status-danger)' }}>
                                            {isCompleted ? <CheckCircle size={24} /> : <TrendingDown size={24} />}
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0 }}>{d.name}</h3>
                                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: isCompleted ? 'var(--status-success-bg)' : 'var(--status-danger-bg)', color: isCompleted ? 'var(--status-success)' : 'var(--status-danger)' }}>
                                                {isCompleted ? 'Đã thanh toán' : 'Đang nợ'}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            className="btn-icon" style={{ width: '30px', height: '30px' }}
                                            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === d.id ? null : d.id); }}
                                        >
                                            <Plus size={16} style={{ transform: 'rotate(45deg)' }} />
                                        </button>
                                        {activeMenu === d.id && (
                                            <div className="glass-panel" style={{
                                                position: 'absolute', right: 0, top: '40px', zIndex: 10,
                                                padding: '0.5rem', minWidth: '120px', display: 'flex', flexDirection: 'column', gap: '0.25rem',
                                                background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)'
                                            }}>
                                                <button onClick={() => handleEditDebt(d)} style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>Sửa</button>
                                                <button onClick={() => handleDeleteDebt(d)} style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.85rem', color: 'var(--status-danger)' }}>Xóa</button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--border-radius-sm)', marginBottom: '1rem' }}>
                                    <div className="flex-between" style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Tổng Nợ:</span>
                                        <span style={{ fontWeight: '600' }}>{formatMoney(d.totalAmount)}</span>
                                    </div>
                                    <div className="flex-between" style={{ fontSize: '0.9rem' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Còn lại:</span>
                                        <span style={{ color: isCompleted ? 'var(--status-success)' : 'var(--status-danger)', fontWeight: '600' }}>
                                            {formatMoney(d.remainingAmount)}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleViewHistory(d)}
                                        className="btn-icon" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                                        title="Lịch sử trả nợ"
                                    >
                                        <Clock size={18} />
                                    </button>
                                    {!isCompleted && (
                                        <button
                                            onClick={() => { setSelectedDebt(d); setIsPaymentModalOpen(true); }}
                                            className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                                        >
                                            Thanh toán
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Debt Creation Modal */}
            {isDebtModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <div className="card glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
                        <h2>{isEditing ? 'Sửa Khoản Nợ' : 'Ghi nhận Khoản Nợ'}</h2>
                        <form onSubmit={handleSaveDebt} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Tên Khoản Nợ</label>
                                <input
                                    type="text" className="input-field" placeholder="Vd: Vay ngân hàng, Vay bạn bè..."
                                    value={debtData.name} onChange={e => setDebtData({ ...debtData, name: e.target.value })} required
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Tổng số tiền (₫)</label>
                                <CurrencyInput
                                    className="input-field" placeholder="5,000,000"
                                    value={debtData.totalAmount} onChange={val => setDebtData({ ...debtData, totalAmount: val })} required
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Ngày vay</label>
                                <input
                                    type="date" className="input-field"
                                    value={debtData.startDate} onChange={e => setDebtData({ ...debtData, startDate: e.target.value })} required
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="input-field" style={{ flex: 1, textAlign: 'center' }} onClick={() => { setIsDebtModalOpen(false); setIsEditing(false); setSelectedDebt(null); }}>Hủy</button>
                                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>{isEditing ? 'Cập nhật' : 'Lưu Khoản Nợ'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {isPaymentModalOpen && selectedDebt && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <div className="card glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
                        <h2>Thanh toán nợ: {selectedDebt.name}</h2>
                        <p style={{ color: 'var(--status-danger)', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
                            Còn phải trả: {formatMoney(selectedDebt.remainingAmount)}
                        </p>
                        <form onSubmit={handlePayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Trích từ Ví</label>
                                <select
                                    className="input-field"
                                    value={paymentData.walletId} onChange={e => setPaymentData({ ...paymentData, walletId: e.target.value })} required
                                >
                                    <option value="" disabled>Chọn ví nguồn</option>
                                    {wallets?.map(w => <option key={w.id} value={w.id}>{w.name} (Số dư: {formatMoney(w.balance)})</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Số tiền trả (₫)</label>
                                <CurrencyInput
                                    className="input-field" placeholder="1,000,000"
                                    value={paymentData.amount} onChange={val => {
                                        // Ensure amount doesn't exceed remaining
                                        const numVal = Number(val);
                                        if (numVal > selectedDebt.remainingAmount) {
                                            setPaymentData({ ...paymentData, amount: selectedDebt.remainingAmount.toString() });
                                        } else {
                                            setPaymentData({ ...paymentData, amount: val });
                                        }
                                    }} required
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Ngày thanh toán</label>
                                <input
                                    type="date" className="input-field"
                                    value={paymentData.date} onChange={e => setPaymentData({ ...paymentData, date: e.target.value })} required
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="input-field" style={{ flex: 1, textAlign: 'center' }} onClick={() => { setIsPaymentModalOpen(false); setSelectedDebt(null); }}>Hủy</button>
                                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Xác nhận trả nợ</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {isHistoryModalOpen && selectedDebt && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <div className="card glass-panel" style={{ width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0 }}>Lịch sử trả: {selectedDebt.name}</h2>
                            <button className="btn-icon" onClick={() => { setIsHistoryModalOpen(false); setSelectedDebt(null); }}>✕</button>
                        </div>

                        <div style={{ overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {(!debtHistory || debtHistory.length === 0) ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Chưa có lịch sử thanh toán.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {debtHistory.map(h => {
                                        const wallet = wallets?.find(w => w.id === h.walletId);
                                        return (
                                            <div key={h.id} style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--border-radius-sm)',
                                                borderLeft: '4px solid var(--status-success)'
                                            }}>
                                                <div>
                                                    <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{formatMoney(h.amount)}</div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{wallet?.name || 'Ví không xác định'}</div>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                                                    {new Date(h.date).toLocaleDateString('vi-VN')}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <button
                            className="btn-primary"
                            style={{ marginTop: '1.5rem', justifyContent: 'center' }}
                            onClick={() => { setIsHistoryModalOpen(false); setSelectedDebt(null); }}
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Debts;
