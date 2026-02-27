import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Plus, Target, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import DynamicIcon from '../components/DynamicIcon';

const Budgets = () => {
    const budgets = useLiveQuery(() => db.budgets.toArray());
    const categories = useLiveQuery(() => db.categories.where('type').equals('expense').toArray());
    const transactions = useLiveQuery(() => db.transactions.toArray());

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        categoryId: '',
        limit: '',
        period: 'month'
    });

    const currentMonth = new Date().toISOString().substring(0, 7);

    const calculateSpent = (categoryId) => {
        if (!transactions) return 0;
        return transactions
            .filter(t => t.categoryId === categoryId && t.date.startsWith(currentMonth))
            .reduce((sum, t) => sum + Number(t.amount), 0);
    };

    const handleOpenModal = (budget = null) => {
        if (budget) {
            setEditingId(budget.id);
            setFormData({
                categoryId: budget.categoryId.toString(),
                limit: budget.limit.toString(),
                period: budget.period
            });
        } else {
            setEditingId(null);
            setFormData({
                categoryId: '',
                limit: '',
                period: 'month'
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.categoryId || !formData.limit) return;

        if (editingId) {
            const existing = await db.budgets.where({ categoryId: Number(formData.categoryId) }).first();
            if (existing && existing.id !== editingId) {
                alert('Danh mục này đã có mục tiêu ngân sách. Vui lòng chọn danh mục khác.');
                return;
            }

            await db.budgets.update(editingId, {
                categoryId: Number(formData.categoryId),
                limit: Number(formData.limit),
                period: formData.period
            });
        } else {
            const existing = await db.budgets.where({ categoryId: Number(formData.categoryId) }).first();
            if (existing) {
                alert('Danh mục này đã có mục tiêu ngân sách. Hãy xóa hoặc sửa mục tiêu cũ.');
                return;
            }

            await db.budgets.add({
                categoryId: Number(formData.categoryId),
                limit: Number(formData.limit),
                period: formData.period
            });
        }

        setIsModalOpen(false);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa ngân sách này?')) {
            await db.budgets.delete(id);
        }
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const getCategory = (id) => categories?.find(c => c.id === id);

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Ngân sách</h1>
                    <p className="page-subtitle">Kiểm soát chi tiêu hàng tháng của bạn</p>
                </div>
                <button className="btn-primary" onClick={() => handleOpenModal()}>
                    <Plus size={20} />
                    Tạo Ngân sách
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                {(!budgets || budgets.length === 0) ? (
                    <div className="card glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        Chưa có ngân sách nào được thiết lập.
                    </div>
                ) : (
                    budgets.map(b => {
                        const cat = getCategory(b.categoryId);
                        if (!cat) return null;

                        const spent = calculateSpent(b.categoryId);
                        const limit = b.limit;
                        const percent = Math.min((spent / limit) * 100, 100);

                        let barColor = 'var(--status-success)';
                        let statusText = 'Trong tầm kiểm soát';

                        if (percent >= 100) {
                            barColor = 'var(--status-danger)';
                            statusText = 'Vượt ngân sách!';
                        } else if (percent >= 80) {
                            barColor = 'var(--status-warning)';
                            statusText = 'Sắp đạt giới hạn';
                        }

                        return (
                            <div key={b.id} className="card glass-panel">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div className="btn-icon" style={{ backgroundColor: `${cat.color}22`, color: cat.color }}>
                                            <DynamicIcon name={cat.icon || 'star'} size={20} />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0 }}>{cat.name}</h3>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>1 - {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()} tháng {new Date().getMonth() + 1}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button onClick={() => handleOpenModal(b)} style={{ color: 'var(--text-secondary)', padding: '0.5rem' }}>
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(b.id)} style={{ color: 'var(--status-danger)', padding: '0.5rem' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div style={{ padding: '0.5rem 0' }}>
                                    <div className="flex-between" style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Đã chi <strong>{formatMoney(spent)}</strong></span>
                                        <span style={{ color: 'var(--text-primary)' }}>/ {formatMoney(limit)}</span>
                                    </div>

                                    <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div
                                            style={{
                                                width: `${percent}%`,
                                                height: '100%',
                                                background: barColor,
                                                borderRadius: '4px',
                                                transition: 'width 0.5s ease-out'
                                            }}
                                        />
                                    </div>

                                    <div className="flex-between" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: barColor }}>
                                            {percent >= 80 && <AlertCircle size={14} />} {statusText}
                                        </span>
                                        <span style={{ color: 'var(--text-muted)' }}>{percent >= 100 ? 0 : formatMoney(limit - spent)} còn lại</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {isModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <div className="card glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
                        <h2>{editingId ? 'Sửa Ngân Sách' : 'Tạo Ngân Sách Mới'}</h2>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Cho Giai đoạn</label>
                                <select className="input-field" disabled value="month">
                                    <option value="month">Tháng {new Date().getMonth() + 1}</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Hạng mục chi phí</label>
                                <select
                                    className="input-field"
                                    value={formData.categoryId}
                                    onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                                    required
                                >
                                    <option value="" disabled>Chọn hạng mục</option>
                                    {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Hạn mức (₫)</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    placeholder="5000000"
                                    value={formData.limit}
                                    onChange={e => setFormData({ ...formData, limit: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="input-field" style={{ flex: 1, textAlign: 'center' }} onClick={() => setIsModalOpen(false)}>Hủy</button>
                                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                                    {editingId ? 'Lưu Thay Đổi' : 'Lưu Ngân sách'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Budgets;
