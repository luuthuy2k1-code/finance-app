import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
    Home,
    CreditCard,
    Wallet,
    PieChart,
    Target,
    FileText,
    Settings as SettingsIcon,
    TrendingDown,
    LogOut,
    RefreshCw
} from 'lucide-react';
import './Layout.css';
import { supabase } from '../supabaseClient';
import { syncFromCloud } from '../db';

const Layout = ({ user }) => {
    const [isSyncing, setIsSyncing] = React.useState(false);

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const summary = await syncFromCloud();
            const errors = Object.entries(summary).filter(([, v]) => v.error).map(([k, v]) => `${k}: ${v.error}`);
            const added = Object.values(summary).reduce((s, v) => s + (v.added || 0), 0);
            const deleted = Object.values(summary).reduce((s, v) => s + (v.deleted || 0), 0);
            const pushed = Object.values(summary).reduce((s, v) => s + (v.pushed || 0), 0);
            if (errors.length > 0) {
                alert(`Đồng bộ xong nhưng có lỗi:\n${errors.join('\n')}`);
            } else {
                alert(`Đồng bộ thành công!\n+${added} bản ghi mới, -${deleted} đã xóa, ^${pushed} đã đẩy lên cloud`);
            }
        } catch (error) {
            console.error(error);
            alert('Đồng bộ thất bại: ' + error.message);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="app-container">
            <aside className="sidebar glass-panel">
                <div className="logo-container">
                    <div className="logo-icon">
                        <Wallet size={24} color="var(--accent-primary)" />
                    </div>
                    <h1 className="logo-text gradient-text">FinFlow</h1>
                </div>

                <div style={{ padding: '0 1.5rem 1rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem'
                        }}>
                            {user?.email?.[0].toUpperCase()}
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {user?.email}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cloud Synced</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={handleSync} disabled={isSyncing} className="btn-icon" style={{ width: '100%', borderRadius: '4px', height: '32px', fontSize: '0.75rem', gap: '0.25rem' }}>
                            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'Đang bộ...' : 'Đồng bộ'}
                        </button>
                        <button onClick={handleLogout} className="btn-icon" style={{ borderRadius: '4px', height: '32px', color: 'var(--status-danger)' }}>
                            <LogOut size={14} />
                        </button>
                    </div>
                </div>

                <nav className="nav-menu">
                    <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
                        <Home size={20} />
                        <span>Dashboard</span>
                    </NavLink>
                    <NavLink to="/transactions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <CreditCard size={20} />
                        <span>Giao dịch</span>
                    </NavLink>
                    <NavLink to="/wallets" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Wallet size={20} />
                        <span>Tài khoản/Ví</span>
                    </NavLink>
                    <NavLink to="/budgets" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <PieChart size={20} />
                        <span>Ngân sách</span>
                    </NavLink>
                    <NavLink to="/goals" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Target size={20} />
                        <span>Mục tiêu</span>
                    </NavLink>
                    <NavLink to="/debts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <TrendingDown size={20} />
                        <span>Quản lý Nợ</span>
                    </NavLink>
                    <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <FileText size={20} />
                        <span>Báo cáo</span>
                    </NavLink>
                </nav>

                <div className="sidebar-footer">
                    <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <SettingsIcon size={20} />
                        <span>Cài đặt</span>
                    </NavLink>
                </div>
            </aside>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
