import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import CurrencyInput from './CurrencyInput';

const BudgetModal = ({ isOpen, onClose, editingId = null, initialData = null }) => {
    const categories = useLiveQuery(() => db.categories.where('type').equals('expense').toArray());

    const [formData, setFormData] = useState({
        categoryId: '',
        limit: '',
        period: 'month'
    });

    useEffect(() => {
        if (isOpen) {
            if (editingId && initialData) {
                setFormData({
                    categoryId: initialData.categoryId.toString(),
                    limit: initialData.limit.toString(),
                    period: initialData.period
                });
            } else {
                setFormData({
                    categoryId: '',
                    limit: '',
                    period: 'month'
                });
            }
        }
    }, [isOpen, editingId, initialData]);

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

        onClose();
    };

    if (!isOpen) return null;

    return (
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
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Hạn mức (₫)</label>
                            <CurrencyInput
                                className="input-field"
                                placeholder="5,000,000"
                                value={formData.limit}
                                onChange={(val) => setFormData({ ...formData, limit: val })}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="input-field" style={{ flex: 1, textAlign: 'center' }} onClick={onClose}>Hủy</button>
                        <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                            {editingId ? 'Lưu Thay Đổi' : 'Lưu Ngân sách'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BudgetModal;
