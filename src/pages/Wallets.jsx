import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Plus, Wallet as WalletIcon, MoreVertical, Edit2, Trash2, Home, CreditCard } from 'lucide-react';
import CurrencyInput from '../components/CurrencyInput';

const Wallets = () => {
    const wallets = useLiveQuery(() => db.wallets.toArray());
    const transactions = useLiveQuery(() => db.transactions.toArray());

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [newWallet, setNewWallet] = useState({ name: '', type: 'cash', balance: 0 });
    const [activeMenu, setActiveMenu] = useState(null);

    const totalBalance = wallets?.reduce((sum, w) => sum + (Number(w.balance) || 0), 0) || 0;

    const handleOpenModal = (wallet = null) => {
        if (wallet) {
            setEditingId(wallet.id);
            setNewWallet({ name: wallet.name, type: wallet.type, balance: wallet.balance });
        } else {
            setEditingId(null);
            setNewWallet({ name: '', type: 'cash', balance: 0 });
        }
        setIsModalOpen(true);
        setActiveMenu(null);
    };

    const handleSaveWallet = async (e) => {
        e.preventDefault();
        if (!newWallet.name) return;

        if (editingId) {
            // Calculate balance difference if we want to support manual balance adjustment
            // For now, just update the wallet data
            await db.wallets.update(editingId, {
                name: newWallet.name,
                type: newWallet.type,
                balance: Number(newWallet.balance)
            });
        } else {
            await db.wallets.add({
                name: newWallet.name,
                type: newWallet.type,
                balance: Number(newWallet.balance)
            });
        }

        setIsModalOpen(false);
    };

    const handleDeleteWallet = async (id) => {
        const hasTransactions = transactions?.some(t => t.walletId === id);
        if (hasTransactions) {
            alert('Không thể xóa ví này vì đã có giao dịch liên quan. Vui lòng xóa các giao dịch trước.');
            return;
        }

        if (window.confirm('Bạn có chắc chắn muốn xóa ví này?')) {
            await db.wallets.delete(id);
            setActiveMenu(null);
        }
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    return (
        <div className="animate-fade-in" onClick={() => setActiveMenu(null)}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Tài khoản/Ví</h1>
                    <p className="page-subtitle">Quản lý các nguồn tiền của bạn</p>
                </div>
                <button className="btn-primary" onClick={() => handleOpenModal()}>
                    <Plus size={20} />
                    Thêm Ví mới
                </button>
            </div>

            <div className="card glass-panel" style={{ marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Tổng tài sản</p>
                <h2 style={{ fontSize: '2.5rem', color: 'var(--text-primary)', margin: '0.5rem 0' }}>
                    {formatMoney(totalBalance)}
                </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {wallets?.map(wallet => (
                    <div key={wallet.id} className="card glass-panel flex-between" style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div className="btn-icon" style={{ background: 'var(--bg-tertiary)', color: 'var(--accent-primary)' }}>
                                <WalletIcon size={20} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{wallet.name}</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    {wallet.type === 'cash' ? 'Tiền mặt' : wallet.type === 'bank' ? 'Ngân hàng' : 'Thẻ tín dụng'}
                                </p>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h3 style={{ margin: 0 }}>{formatMoney(wallet.balance)}</h3>
                            <div style={{ position: 'relative' }}>
                                <button
                                    style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0.5rem' }}
                                    onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === wallet.id ? null : wallet.id); }}
                                >
                                    <MoreVertical size={16} />
                                </button>
                                {activeMenu === wallet.id && (
                                    <div style={{
                                        position: 'absolute', right: 0, top: '100%',
                                        background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
                                        borderRadius: 'var(--border-radius-sm)', padding: '0.5rem',
                                        zIndex: 10, minWidth: '120px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                    }}>
                                        <button
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem', color: 'var(--text-primary)', textAlign: 'left' }}
                                            onClick={() => handleOpenModal(wallet)}
                                        >
                                            <Edit2 size={14} /> Sửa
                                        </button>
                                        <button
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem', color: 'var(--status-danger)', textAlign: 'left' }}
                                            onClick={() => handleDeleteWallet(wallet.id)}
                                        >
                                            <Trash2 size={14} /> Xóa
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <div className="card glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
                        <h2>{editingId ? 'Sửa Ví' : 'Thêm Ví Mới'}</h2>
                        <form onSubmit={handleSaveWallet} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Tên Ví</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Vd: Ví điện tử Momo, thẻ VCB..."
                                    value={newWallet.name}
                                    onChange={e => setNewWallet({ ...newWallet, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Loại Ví</label>
                                <select
                                    className="input-field"
                                    value={newWallet.type}
                                    onChange={e => setNewWallet({ ...newWallet, type: e.target.value })}
                                >
                                    <option value="cash">Tiền mặt</option>
                                    <option value="bank">Ngân hàng</option>
                                    <option value="credit">Thẻ tín dụng</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Số dư ban đầu (₫)</label>
                                <CurrencyInput
                                    className="input-field"
                                    placeholder="1,000,000"
                                    value={newWallet.balance}
                                    onChange={val => setNewWallet({ ...newWallet, balance: val })}
                                    required
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="input-field" style={{ flex: 1, textAlign: 'center' }} onClick={() => setIsModalOpen(false)}>Hủy</button>
                                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>{editingId ? 'Lưu Thay đổi' : 'Lưu Ví'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Wallets;
