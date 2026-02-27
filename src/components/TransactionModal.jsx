import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import CurrencyInput from './CurrencyInput';
import DynamicIcon from './DynamicIcon';

const TransactionModal = ({ isOpen, onClose, editingId = null, initialData = null }) => {
    const categories = useLiveQuery(() => db.categories.toArray());
    const wallets = useLiveQuery(() => db.wallets.toArray());

    const [transactionType, setTransactionType] = useState('expense');
    const [isManagingCategory, setIsManagingCategory] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [newCategoryName, setNewCategoryName] = useState('');

    const [formData, setFormData] = useState({
        amount: '',
        categoryId: '',
        walletId: '',
        toWalletId: '',
        date: new Date().toISOString().split('T')[0],
        note: ''
    });

    // Clear category selection when switching between expense/income
    useEffect(() => {
        if (!editingId) {
            setFormData(prev => ({ ...prev, categoryId: '' }));
        }
    }, [transactionType, editingId]);

    // Use a ref to track what we've initialized to avoid resetting on categories/live query updates
    const lastInitializedId = useRef(undefined);

    useEffect(() => {
        if (isOpen) {
            // Only initialize if the ID changed or we haven't initialized this session
            if (lastInitializedId.current !== editingId) {
                if (editingId && initialData) {
                    if (initialData.type === 'transfer') {
                        setTransactionType('transfer');
                        setFormData({
                            amount: initialData.amount.toString(),
                            categoryId: '',
                            walletId: initialData.fromWalletId ? initialData.fromWalletId.toString() : '',
                            toWalletId: initialData.toWalletId ? initialData.toWalletId.toString() : '',
                            date: initialData.date,
                            note: initialData.note || ''
                        });
                    } else {
                        const cat = categories?.find(c => c.id === initialData.categoryId);
                        if (cat) setTransactionType(cat.type);

                        setFormData({
                            amount: initialData.amount.toString(),
                            categoryId: initialData.categoryId.toString(),
                            walletId: initialData.walletId.toString(),
                            toWalletId: '',
                            date: initialData.date,
                            note: initialData.note || ''
                        });
                    }
                } else {
                    setTransactionType('expense');
                    setFormData({
                        amount: '',
                        categoryId: '',
                        walletId: '',
                        toWalletId: '',
                        date: new Date().toISOString().split('T')[0],
                        note: ''
                    });
                }
                lastInitializedId.current = editingId;
            }
        } else {
            // Reset when modal closes
            lastInitializedId.current = null;
        }
    }, [isOpen, editingId, initialData, categories]); // Keep dependencies but guard with ref

    const filteredCategories = categories?.filter(c => c.type === transactionType) || [];

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!newCategoryName.trim()) return;

        if (editingCategory) {
            await db.categories.update(editingCategory.id, { name: newCategoryName.trim() });
        } else {
            const newCatId = await db.categories.add({
                name: newCategoryName.trim(),
                type: transactionType,
                color: transactionType === 'expense' ? '#ff7675' : '#55efc4',
                icon: 'tag',
                isSystem: false
            });
            setFormData({ ...formData, categoryId: newCatId.toString() });
        }

        setNewCategoryName('');
        setEditingCategory(null);
        setIsManagingCategory(false);
    };

    const handleDeleteCategory = async (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm('Bạn có chắc muốn xóa hạng mục này?')) {
            await db.categories.delete(id);
            if (formData.categoryId === id.toString()) {
                setFormData({ ...formData, categoryId: '' });
            }
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();

        const amountNum = Number(formData.amount);
        if (amountNum <= 0) {
            alert('Số tiền phải lớn hơn 0');
            return;
        }

        if (transactionType === 'transfer') {
            // Transfer logic - At least one wallet must be selected
            if (!formData.walletId && !formData.toWalletId) {
                alert('Vui lòng chọn ít nhất một ví (gửi hoặc nhận)');
                return;
            }

            if (formData.walletId && formData.toWalletId && formData.walletId === formData.toWalletId) {
                alert('Ví gửi và ví nhận phải khác nhau');
                return;
            }

            try {
                await db.transaction('rw', db.transfers, db.transactions, db.wallets, db.categories, async () => {
                    let fromWallet = formData.walletId ? await db.wallets.get(Number(formData.walletId)) : null;
                    let toWallet = formData.toWalletId ? await db.wallets.get(Number(formData.toWalletId)) : null;

                    // REVERT LOGIC
                    if (editingId && initialData) {
                        if (initialData.type === 'transfer') {
                            // Revert old transfer
                            const oldFrom = initialData.fromWalletId ? await db.wallets.get(initialData.fromWalletId) : null;
                            const oldTo = initialData.toWalletId ? await db.wallets.get(initialData.toWalletId) : null;
                            const oldAmt = Number(initialData.amount);

                            if (oldFrom) await db.wallets.update(oldFrom.id, { balance: Number(oldFrom.balance) + oldAmt });
                            if (oldTo) await db.wallets.update(oldTo.id, { balance: Number(oldTo.balance) - oldAmt });

                            // Delete old record from transfers table (we will add/update later)
                            await db.transfers.delete(editingId);
                        } else if (initialData.type === 'transaction') {
                            // Revert old transaction
                            const oldW = initialData.walletId ? await db.wallets.get(initialData.walletId) : null;
                            const oldCat = await db.categories.get(initialData.categoryId);
                            const oldAmt = Number(initialData.amount);
                            const wasExpense = oldCat?.type === 'expense';

                            if (oldW) {
                                const revertedBalance = wasExpense ? Number(oldW.balance) + oldAmt : Number(oldW.balance) - oldAmt;
                                await db.wallets.update(oldW.id, { balance: revertedBalance });
                            }

                            // Delete from transactions table since we are moving to transfers
                            await db.transactions.delete(editingId);
                        }
                    }

                    // Refetch current wallets after any revert
                    fromWallet = formData.walletId ? await db.wallets.get(Number(formData.walletId)) : null;
                    toWallet = formData.toWalletId ? await db.wallets.get(Number(formData.toWalletId)) : null;

                    // SAVE NEW TRANSFER
                    await db.transfers.add({
                        amount: amountNum,
                        fromWalletId: formData.walletId ? Number(formData.walletId) : null,
                        toWalletId: formData.toWalletId ? Number(formData.toWalletId) : null,
                        date: formData.date,
                        note: formData.note,
                        createdAt: Date.now()
                    });

                    // APPLY NEW BALANCES
                    if (fromWallet) await db.wallets.update(fromWallet.id, { balance: Number(fromWallet.balance) - amountNum });
                    if (toWallet) await db.wallets.update(toWallet.id, { balance: Number(toWallet.balance) + amountNum });
                });
                onClose();
            } catch (error) {
                console.error(error);
                alert('Có lỗi xảy ra khi lưu chuyển tiền.');
            }
            return;
        }

        // Standard transaction logic (expense/income)
        if (!formData.categoryId || !formData.walletId) {
            alert('Vui lòng điền đủ thông tin');
            return;
        }

        try {
            await db.transaction('rw', db.transactions, db.transfers, db.wallets, db.categories, async () => {
                const isExpense = transactionType === 'expense';
                let wallet = await db.wallets.get(Number(formData.walletId));

                // REVERT LOGIC
                if (editingId && initialData) {
                    if (initialData.type === 'transaction') {
                        // Revert old transaction
                        const oldW = await db.wallets.get(initialData.walletId);
                        const oldCat = await db.categories.get(initialData.categoryId);
                        const oldAmt = Number(initialData.amount);
                        const wasExpense = oldCat?.type === 'expense';

                        if (oldW) {
                            const revertedBalance = wasExpense ? Number(oldW.balance) + oldAmt : Number(oldW.balance) - oldAmt;
                            await db.wallets.update(oldW.id, { balance: revertedBalance });
                        }

                        await db.transactions.delete(editingId);
                    } else if (initialData.type === 'transfer') {
                        // Revert old transfer
                        const oldFrom = initialData.fromWalletId ? await db.wallets.get(initialData.fromWalletId) : null;
                        const oldTo = initialData.toWalletId ? await db.wallets.get(initialData.toWalletId) : null;
                        const oldAmt = Number(initialData.amount);

                        if (oldFrom) await db.wallets.update(oldFrom.id, { balance: Number(oldFrom.balance) + oldAmt });
                        if (oldTo) await db.wallets.update(oldTo.id, { balance: Number(oldTo.balance) - oldAmt });

                        await db.transfers.delete(editingId);
                    }
                }

                // Refetch wallet
                wallet = await db.wallets.get(Number(formData.walletId));

                // SAVE NEW TRANSACTION
                await db.transactions.add({
                    amount: amountNum,
                    categoryId: Number(formData.categoryId),
                    walletId: Number(formData.walletId),
                    date: formData.date,
                    note: formData.note,
                    createdAt: Date.now()
                });

                // APPLY NEW BALANCE
                if (wallet) {
                    const newBalance = isExpense ? Number(wallet.balance) - amountNum : Number(wallet.balance) + amountNum;
                    await db.wallets.update(wallet.id, { balance: newBalance });
                }
            });

            onClose();
        } catch (error) {
            console.error(error);
            alert('Có lỗi xảy ra khi lưu giao dịch.');
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
            <div className="card glass-panel" style={{ width: '100%', maxWidth: '450px' }}>
                <h2>{editingId ? 'Sửa Giao Dịch' : 'Thêm Giao Dịch'}</h2>

                <div style={{ display: 'flex', marginTop: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--border-radius-sm)', padding: '0.25rem' }}>
                    <button
                        style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', background: transactionType === 'expense' ? 'var(--status-danger)' : 'transparent', color: transactionType === 'expense' ? 'white' : 'var(--text-secondary)' }}
                        onClick={() => setTransactionType('expense')}
                        type="button"
                    >
                        Chi phí
                    </button>
                    <button
                        style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', background: transactionType === 'income' ? 'var(--status-success)' : 'transparent', color: transactionType === 'income' ? 'white' : 'var(--text-secondary)' }}
                        onClick={() => setTransactionType('income')}
                        type="button"
                    >
                        Thu nhập
                    </button>
                    <button
                        style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', background: transactionType === 'transfer' ? 'var(--accent-primary)' : 'transparent', color: transactionType === 'transfer' ? 'white' : 'var(--text-secondary)' }}
                        onClick={() => setTransactionType('transfer')}
                        type="button"
                    >
                        Chuyển tiền
                    </button>
                </div>

                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Số tiền (₫)</label>
                        <CurrencyInput
                            className="input-field"
                            placeholder="50,000"
                            value={formData.amount}
                            onChange={(val) => setFormData({ ...formData, amount: val })}
                            required
                            autoFocus
                        />
                    </div>

                    {transactionType !== 'transfer' ? (
                        <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                            <div style={{ flex: 1, position: 'relative' }}>
                                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                                    <label style={{ fontSize: '0.9rem', margin: 0 }}>Hạng mục</label>
                                    <button
                                        type="button"
                                        onClick={() => setIsManagingCategory(!isManagingCategory)}
                                        style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                    >
                                        <DynamicIcon name="edit-2" size={14} /> Quản lý
                                    </button>
                                </div>

                                {isManagingCategory ? (
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', border: '1px solid var(--glass-border)', borderRadius: 'var(--border-radius-sm)', marginBottom: '0.5rem' }}>
                                        <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {filteredCategories.map(c => (
                                                <div key={c.id} className="flex-between" style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
                                                    <span>{c.name} {c.isSystem && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Mặc định)</span>}</span>
                                                    {!c.isSystem && (
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <button type="button" onClick={() => { setEditingCategory(c); setNewCategoryName(c.name); }} style={{ color: 'var(--accent-primary)' }}>
                                                                <DynamicIcon name="edit-2" size={14} />
                                                            </button>
                                                            <button type="button" onClick={(e) => handleDeleteCategory(e, c.id)} style={{ color: 'var(--status-danger)' }}>
                                                                <DynamicIcon name="trash-2" size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input
                                                type="text"
                                                className="input-field"
                                                placeholder="Tên hạng mục..."
                                                value={newCategoryName}
                                                onChange={(e) => setNewCategoryName(e.target.value)}
                                                style={{ padding: '0.5rem' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleSaveCategory}
                                                className="btn-primary"
                                                style={{ padding: '0.5rem 1rem' }}
                                            >
                                                Lưu
                                            </button>
                                        </div>
                                        {editingCategory && (
                                            <button
                                                type="button"
                                                onClick={() => { setEditingCategory(null); setNewCategoryName(''); }}
                                                style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', width: '100%', textAlign: 'center' }}
                                            >
                                                Hủy sửa
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <select
                                        className="input-field"
                                        value={formData.categoryId}
                                        onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                                        required={transactionType !== 'transfer'}
                                    >
                                        <option value="" disabled>Chọn hạng mục</option>
                                        {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Ví / Tài khoản</label>
                                <select
                                    className="input-field"
                                    value={formData.walletId}
                                    onChange={e => setFormData({ ...formData, walletId: e.target.value })}
                                    required={transactionType !== 'transfer'}
                                >
                                    <option value="" disabled>Chọn ví</option>
                                    {wallets?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Từ Ví (Tùy chọn)</label>
                                <select
                                    className="input-field"
                                    value={formData.walletId}
                                    onChange={e => setFormData({ ...formData, walletId: e.target.value })}
                                >
                                    <option value="">-- Chọn ví --</option>
                                    {wallets?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Đến Ví (Tùy chọn)</label>
                                <select
                                    className="input-field"
                                    value={formData.toWalletId}
                                    onChange={e => setFormData({ ...formData, toWalletId: e.target.value })}
                                >
                                    <option value="">-- Chọn ví --</option>
                                    {wallets?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Ngày giao dịch</label>
                        <input
                            type="date"
                            className="input-field"
                            value={formData.date}
                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Ghi chú</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Ví dụ: Ăn trưa với đồng nghiệp..."
                            value={formData.note}
                            onChange={e => setFormData({ ...formData, note: e.target.value })}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="input-field" style={{ flex: 1, textAlign: 'center' }} onClick={onClose}>Hủy</button>
                        <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>{editingId ? 'Lưu Thay đổi' : 'Lưu Giao dịch'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TransactionModal;
