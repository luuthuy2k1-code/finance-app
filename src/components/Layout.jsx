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
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Menu
} from 'lucide-react';
import './Layout.css';
import { supabase } from '../supabaseClient';
import { syncFromCloud } from '../db';
import TransactionModal from './TransactionModal';

const Layout = ({ user }) => {
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [isTransModalOpen, setIsTransModalOpen] = React.useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
    const closeMobileMenu = () => setIsMobileMenuOpen(false);

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
            {/* Mobile Header */}
            <div className="mobile-header">
                <button onClick={toggleMobileMenu} className="btn-icon">
                    <Menu size={24} />
                </button>
                <NavLink to="/" className="mobile-logo" onClick={closeMobileMenu}>
                    <Wallet size={24} color="var(--accent-primary)" />
                    <span className="logo-text gradient-text">FinFlow v2</span>
                </NavLink>
                <div style={{ width: '40px' }}></div> {/* Spacer */}
            </div>

            {/* Backdrop Overlay */}
            {isMobileMenuOpen && <div className="mobile-overlay" onClick={closeMobileMenu}></div>}

            <aside className={`sidebar glass-panel ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
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
                    <NavLink to="/" onClick={closeMobileMenu} title="Dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
                        <Home size={20} />
                        <span>Dashboard</span>
                    </NavLink>
                    <NavLink to="/transactions" onClick={closeMobileMenu} title="Giao dịch" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <CreditCard size={20} />
                        <span>Giao dịch</span>
                    </NavLink>
                    <NavLink to="/wallets" onClick={closeMobileMenu} title="Tài khoản/Ví" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Wallet size={20} />
                        <span>Tài khoản/Ví</span>
                    </NavLink>
                    <NavLink to="/budgets" onClick={closeMobileMenu} title="Ngân sách" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <PieChart size={20} />
                        <span>Ngân sách</span>
                    </NavLink>
                    <NavLink to="/goals" onClick={closeMobileMenu} title="Mục tiêu" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Target size={20} />
                        <span>Mục tiêu</span>
                    </NavLink>
                    <NavLink to="/debts" onClick={closeMobileMenu} title="Quản lý Nợ" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <TrendingDown size={20} />
                        <span>Quản lý Nợ</span>
                    </NavLink>
                    <NavLink to="/reports" onClick={closeMobileMenu} title="Báo cáo" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <FileText size={20} />
                        <span>Báo cáo</span>
                    </NavLink>
                </nav>

                <div className="sidebar-footer">
                    <NavLink to="/settings" onClick={closeMobileMenu} title="Cài đặt" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <SettingsIcon size={20} />
                        <span>Cài đặt</span>
                    </NavLink>
                </div>
            </aside>

            <main className="main-content">
                <Outlet />
            </main>

            {/* Mobile Navigation Bar */}
            <nav className="mobile-nav">
                <div className="mobile-nav-content">
                    <NavLink to="/" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`} end>
                        <Home size={24} />
                        <span>Tổng quan</span>
                    </NavLink>
                    <NavLink to="/transactions" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                        <CreditCard size={24} />
                        <span>Giao dịch</span>
                    </NavLink>
                    <div style={{ width: '60px' }}></div> {/* Spacer for FAB */}
                    <NavLink to="/wallets" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                        <Wallet size={24} />
                        <span>Ví</span>
                    </NavLink>
                    <NavLink to="/reports" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                        <FileText size={24} />
                        <span>Báo cáo</span>
                    </NavLink>
                </div>
            </nav>

            {/* Global Floating Action Button */}
            <button className="fab" onClick={() => setIsTransModalOpen(true)}>
                <RefreshCw size={32} style={{ transform: 'rotate(45deg)' }} />
            </button>

            {/* Global Transaction Modal */}
            {isTransModalOpen && (
                <TransactionModal
                    isOpen={isTransModalOpen}
                    onClose={() => setIsTransModalOpen(false)}
                    onSuccess={() => {
                        setIsTransModalOpen(false);
                        // Optional: trigger a refresh if needed, but db hooks usually handle it
                        window.location.reload();
                    }}
                />
            )}
        </div>
    );
};

export default Layout;
