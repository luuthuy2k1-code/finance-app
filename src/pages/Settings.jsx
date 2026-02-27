import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import DynamicIcon from '../components/DynamicIcon';

const Settings = () => {
    const categories = useLiveQuery(() => db.categories.toArray());
    const [activeTab, setActiveTab] = useState('expense');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        type: 'expense',
        color: '#6366F1',
        icon: 'star',
        isSystem: false
    });

    const [errorMsg, setErrorMsg] = useState('');

    const filteredCategories = categories?.filter(c => c.type === activeTab) || [];

    const handleOpenModal = (cat = null) => {
        setErrorMsg('');
        if (cat) {
            setEditingId(cat.id);
            setFormData({
                name: cat.name,
                type: cat.type,
                color: cat.color,
                icon: cat.icon,
                isSystem: cat.isSystem
            });
        } else {
            setEditingId(null);
            setFormData({
                name: '',
                type: activeTab,
                color: '#6366F1',
                icon: 'star',
                isSystem: false
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!formData.name.trim()) return;

        // Kiem tra trung ten
        const existing = categories.find(c => c.name.toLowerCase() === formData.name.toLowerCase() && c.type === formData.type && c.id !== editingId);
        if (existing) {
            setErrorMsg('Tên hạng mục đã tồn tại trong loại này!');
            return;
        }

        if (editingId) {
            await db.categories.update(editingId, {
                name: formData.name,
                color: formData.color,
                icon: formData.icon
            });
        } else {
            await db.categories.add(formData);
        }

        setIsModalOpen(false);
    };

    const handleDelete = async (id, isSystem) => {
        if (isSystem) {
            alert('Không thể xóa hạng mục mặc định của hệ thống!');
            return;
        }
        if (window.confirm('Bạn có chắc chắn muốn xóa hạng mục này? Các giao dịch liên quan sẽ bị mồ côi.')) {
            await db.categories.delete(id);
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Cài đặt</h1>
                    <p className="page-subtitle">Quản lý hạng mục thu chi và cấu hình ứng dụng.</p>
                </div>
                <button className="btn-primary" onClick={() => handleOpenModal()}>
                    <Plus size={20} />
                    Thêm Hạng mục
                </button>
            </div>

            <div className="card glass-panel" style={{ padding: '0' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)' }}>
                    <button
                        style={{
                            flex: 1, padding: '1rem',
                            color: activeTab === 'expense' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            borderBottom: activeTab === 'expense' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            fontWeight: activeTab === 'expense' ? '600' : '400'
                        }}
                        onClick={() => setActiveTab('expense')}
                    >
                        Chi phí
                    </button>
                    <button
                        style={{
                            flex: 1, padding: '1rem',
                            color: activeTab === 'income' ? 'var(--status-success)' : 'var(--text-secondary)',
                            borderBottom: activeTab === 'income' ? '2px solid var(--status-success)' : '2px solid transparent',
                            fontWeight: activeTab === 'income' ? '600' : '400'
                        }}
                        onClick={() => setActiveTab('income')}
                    >
                        Thu nhập
                    </button>
                </div>

                <div style={{ padding: '1.5rem' }}>
                    {filteredCategories.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có hạng mục nào.</p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                            {filteredCategories.map(cat => (
                                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div className="btn-icon" style={{ backgroundColor: `${cat.color}22`, color: cat.color }}>
                                            <DynamicIcon name={cat.icon || 'circle'} size={20} />
                                        </div>
                                        <div>
                                            <h4 style={{ margin: 0 }}>{cat.name}</h4>
                                            {cat.isSystem && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mặc định</span>}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {!cat.isSystem && (
                                            <button onClick={() => handleOpenModal(cat)} style={{ color: 'var(--text-secondary)' }}><Edit2 size={16} /></button>
                                        )}
                                        {!cat.isSystem && (
                                            <button onClick={() => handleDelete(cat.id, cat.isSystem)} style={{ color: 'var(--status-danger)' }}><Trash2 size={16} /></button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <div className="card glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
                        <h2>{editingId ? 'Sửa Hạng mục' : 'Thêm Hạng mục'}</h2>

                        {errorMsg && <div style={{ color: 'var(--status-danger)', padding: '0.75rem', background: 'var(--status-danger-bg)', borderRadius: '4px', marginTop: '1rem', fontSize: '0.9rem' }}>{errorMsg}</div>}

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Loại</label>
                                <select
                                    className="input-field"
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    disabled={editingId && formData.isSystem} // Prevent change type for system categories just in case
                                >
                                    <option value="expense">Chi phí</option>
                                    <option value="income">Thu nhập</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Tên Hạng Mục</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Vd: Lương, Ăn uống..."
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Mã Màu</label>
                                    <input
                                        type="color"
                                        className="input-field"
                                        style={{ padding: '0.25rem', height: '45px', cursor: 'pointer' }}
                                        value={formData.color}
                                        onChange={e => setFormData({ ...formData, color: e.target.value })}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Biểu tượng (Tên)</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="star"
                                        value={formData.icon}
                                        onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="input-field" style={{ flex: 1, textAlign: 'center' }} onClick={() => setIsModalOpen(false)}>Hủy</button>
                                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Lưu</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div style={{ marginTop: '3rem', borderTop: '1px solid var(--glass-border)', paddingTop: '2rem' }}>
                <h3 style={{ color: 'var(--status-danger)' }}>Vùng Nguy Hiểm</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    Xóa toàn bộ dữ liệu ứng dụng. Hành động này không thể hoàn tác.
                </p>
                <button
                    onClick={async () => {
                        if (window.confirm('CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu? Tất cả ví, giao dịch, mục tiêu và nợ sẽ bị xóa vĩnh viễn.')) {
                            if (window.confirm('Xác nhận lần cuối: Bạn thực sự muốn xóa hết chứ?')) {
                                await db.delete();
                                window.location.reload();
                            }
                        }
                    }}
                    className="btn-primary"
                    style={{ background: 'var(--status-danger)', border: 'none' }}
                >
                    <Trash2 size={18} style={{ marginRight: '0.5rem' }} /> Xóa Tất Cả Dữ Liệu
                </button>
            </div>

        </div>
    );
};

export default Settings;
