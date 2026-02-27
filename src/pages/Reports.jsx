import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

const Reports = () => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    const transactions = useLiveQuery(() =>
        db.transactions.filter(t => t.date.startsWith(currentMonthStr)).toArray(), [currentMonthStr]
    );
    const categories = useLiveQuery(() => db.categories.toArray());
    const wallets = useLiveQuery(() => db.wallets.toArray());
    const debtPayments = useLiveQuery(() => db.debt_payments.filter(dp => dp.date.startsWith(currentMonthStr)).toArray(), [currentMonthStr]);
    const goalDeposits = useLiveQuery(() => db.goal_deposits.filter(gd => gd.date.startsWith(currentMonthStr)).toArray(), [currentMonthStr]);

    // Pie Chart & Wallet Data
    const expensesByCategory = {};
    const expensesByWallet = {};
    let totalIncome = 0;
    let totalExpense = 0;

    if (transactions && categories && wallets) {
        transactions.forEach(t => {
            const cat = categories.find(c => c.id === t.categoryId);
            const wallet = wallets.find(w => w.id === t.walletId);

            if (cat) {
                if (cat.type === 'expense') {
                    totalExpense += t.amount;

                    // Group by category
                    if (expensesByCategory[cat.name]) {
                        expensesByCategory[cat.name].value += t.amount;
                    } else {
                        expensesByCategory[cat.name] = {
                            name: cat.name,
                            value: t.amount,
                            color: cat.color
                        };
                    }

                    // Group by wallet
                    if (wallet) {
                        if (expensesByWallet[wallet.name]) {
                            expensesByWallet[wallet.name].value += t.amount;
                        } else {
                            expensesByWallet[wallet.name] = {
                                name: wallet.name,
                                value: t.amount
                            };
                        }
                    }

                } else if (cat.type === 'income') {
                    totalIncome += t.amount;
                }
            }
        });

        // Add Debt Payments to chart & summary
        debtPayments?.forEach(dp => {
            totalExpense += dp.amount;
            const wallet = wallets.find(w => w.id === dp.walletId);

            // Pie Chart Category for Debt
            if (expensesByCategory['Trả nợ']) {
                expensesByCategory['Trả nợ'].value += dp.amount;
            } else {
                expensesByCategory['Trả nợ'] = { name: 'Trả nợ', value: dp.amount, color: 'var(--status-warning)' };
            }

            // Wallet grouping
            if (wallet) {
                if (expensesByWallet[wallet.name]) expensesByWallet[wallet.name].value += dp.amount;
                else expensesByWallet[wallet.name] = { name: wallet.name, value: dp.amount };
            }
        });

        // Add Goal Deposits to chart & summary
        goalDeposits?.forEach(gd => {
            totalExpense += gd.amount;
            const wallet = wallets.find(w => w.id === gd.walletId);

            // Pie Chart Category for Savings
            if (expensesByCategory['Tiết kiệm']) {
                expensesByCategory['Tiết kiệm'].value += gd.amount;
            } else {
                expensesByCategory['Tiết kiệm'] = { name: 'Tiết kiệm', value: gd.amount, color: 'var(--status-success)' };
            }

            // Wallet grouping
            if (wallet) {
                if (expensesByWallet[wallet.name]) expensesByWallet[wallet.name].value += gd.amount;
                else expensesByWallet[wallet.name] = { name: wallet.name, value: gd.amount };
            }
        });
    }

    const CHART_COLORS = ['#FF6B6B', '#4D96FF', '#6BCB77', '#FFD93D', '#917FB3', '#FF9F29', '#00D7FF', '#F24C4C'];

    const pieData = Object.values(expensesByCategory).map((item, index) => ({
        ...item,
        // Dùng màu của danh mục, nếu trùng hoặc muốn rực rỡ hơn thì có thể fallback sang bảng màu chart
        displayColor: CHART_COLORS[index % CHART_COLORS.length]
    }));
    const walletData = Object.values(expensesByWallet);
    const RADIAN = Math.PI / 180;

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="card glass-panel" style={{ padding: '0.5rem 1rem', background: 'rgba(28,28,31,0.9)' }}>
                    <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: '600' }}>{payload[0].name}</p>
                    <p style={{ margin: 0, color: payload[0].payload.displayColor }}>
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(payload[0].value)}
                    </p>
                </div>
            );
        }
        return null;
    };

    const formatMoneyShort = (amount) => {
        if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'Tr';
        if (amount >= 1000) return (amount / 1000).toFixed(0) + 'K';
        return amount;
    };

    const netIncome = totalIncome - totalExpense;

    // Calendar Logic
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(); // 0 is Sunday

    // Adjust so Monday is 0, Sunday is 6
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                <div>
                    <h1 className="page-title" style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Báo cáo & Phân tích</h1>
                    <p className="page-subtitle" style={{ fontSize: '0.85rem' }}>Tổng quan tài chính tháng này</p>
                </div>

                <div className="card glass-panel" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={handlePrevMonth} className="btn-icon" style={{ padding: '0.25rem' }}><ChevronLeft size={18} /></button>
                    <span style={{ fontWeight: '600', minWidth: '120px', textAlign: 'center' }}>
                        Tháng {currentDate.getMonth() + 1}, {currentDate.getFullYear()}
                    </span>
                    <button onClick={handleNextMonth} className="btn-icon" style={{ padding: '0.25rem' }}><ChevronRight size={18} /></button>
                </div>
            </div>

            {/* Compact Summary Bar */}
            <div className="card glass-panel" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                gap: '1rem',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderRight: '1px solid var(--glass-border)' }}>
                    <div className="btn-icon" style={{ background: 'rgba(85, 239, 196, 0.1)', color: 'var(--status-success)' }}>
                        <TrendingUp size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tổng Thu</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--status-success)' }}>{formatMoneyShort(totalIncome)} ₫</div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderRight: '1px solid var(--glass-border)', paddingLeft: '1rem' }}>
                    <div className="btn-icon" style={{ background: 'rgba(255, 118, 117, 0.1)', color: 'var(--status-danger)' }}>
                        <TrendingDown size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tổng Chi</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--status-danger)' }}>{formatMoneyShort(totalExpense)} ₫</div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: '1rem' }}>
                    <div className="btn-icon" style={{ background: netIncome >= 0 ? 'rgba(116, 185, 255, 0.1)' : 'rgba(255, 118, 117, 0.1)', color: netIncome >= 0 ? 'var(--accent-primary)' : 'var(--status-danger)' }}>
                        <Wallet size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Số dư ròng</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: netIncome >= 0 ? 'var(--text-primary)' : 'var(--status-danger)' }}>
                            {formatMoneyShort(Math.abs(netIncome))} ₫
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                {/* Calendar Section - Making it larger and more prominent */}
                <div className="card glass-panel" style={{ padding: '1.25rem' }}>
                    <div className="flex-between" style={{ marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>Lịch giao dịch</h3>
                        <CalendarIcon size={18} color="var(--text-muted)" />
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7, 1fr)',
                        gap: '4px',
                        background: 'transparent'
                    }}>
                        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
                            <div key={day} style={{ padding: '0.5rem 0', textAlign: 'center', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                {day}
                            </div>
                        ))}

                        {Array.from({ length: startOffset }).map((_, i) => (
                            <div key={`empty-${i}`} style={{ aspectRatio: '1/1', borderRadius: '4px' }} />
                        ))}

                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const dateStr = `${currentMonthStr}-${String(i + 1).padStart(2, '0')}`;
                            let dayIncome = 0;
                            let dayExpense = 0;

                            if (transactions && categories) {
                                transactions.filter(t => t.date === dateStr).forEach(t => {
                                    const cat = categories.find(c => c.id === t.categoryId);
                                    if (cat) {
                                        if (cat.type === 'income') dayIncome += t.amount;
                                        if (cat.type === 'expense') dayExpense += t.amount;
                                    }
                                });
                            }

                            const hasActivity = dayIncome > 0 || dayExpense > 0;
                            const intensity = Math.min(dayExpense / (totalExpense / daysInMonth || 1), 2); // Intensity based on average

                            return (
                                <div key={`day-${i}`} style={{
                                    aspectRatio: '1/1',
                                    padding: '4px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '4px',
                                    background: hasActivity ? `rgba(116, 185, 255, ${0.05 + intensity * 0.1})` : 'rgba(255,255,255,0.02)',
                                    border: hasActivity ? '1px solid rgba(116, 185, 255, 0.2)' : '1px solid transparent',
                                    position: 'relative'
                                }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: hasActivity ? 'var(--text-primary)' : 'var(--text-muted)', marginBottom: 'auto' }}>{i + 1}</span>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', width: '100%', alignItems: 'center' }}>
                                        {dayIncome > 0 && (
                                            <div style={{ fontSize: '1.0rem', color: 'var(--status-success)', fontWeight: '800', lineHeight: 1.1 }}>
                                                {formatMoneyShort(dayIncome)}
                                            </div>
                                        )}
                                        {dayExpense > 0 && (
                                            <div style={{ fontSize: '1.0rem', color: 'var(--status-danger)', fontWeight: '800', lineHeight: 1.1 }}>
                                                {formatMoneyShort(dayExpense)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Column: Pie + Wallet */}
                <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: '1.5rem' }}>
                    {/* Compact Pie Chart */}
                    <div className="card glass-panel" style={{ padding: '1.25rem' }}>
                        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Phân bổ chi tiêu</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ height: '140px', width: '140px' }}>
                                {console.log('PieData:', pieData)}
                                <PieChart width={140} height={140}>
                                    <Pie
                                        data={pieData}
                                        cx={70}
                                        cy={70}
                                        innerRadius={35}
                                        outerRadius={55}
                                        paddingAngle={4}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.displayColor} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </div>
                            {pieData.length === 0 ? (
                                <div style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                    Chưa có dữ liệu chi tiêu
                                </div>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '140px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                    {pieData.sort((a, b) => b.value - a.value).slice(0, 5).map((entry, idx) => (
                                        <div key={idx} className="flex-between" style={{ fontSize: '0.8rem', gap: '0.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.displayColor, flexShrink: 0 }} />
                                                <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name}</span>
                                            </div>
                                            <span style={{ fontWeight: '600', whiteSpace: 'nowrap' }}>
                                                {formatMoneyShort(entry.value)} ({Math.round((entry.value / totalExpense) * 100)}%)
                                            </span>
                                        </div>
                                    ))}
                                    {pieData.length > 5 && (
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.2rem' }}>
                                            + {pieData.length - 5} hạng mục khác
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Compact Wallet Spending */}
                    <div className="card glass-panel" style={{ padding: '1.25rem' }}>
                        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Chi tiêu theo ví</h3>
                        {walletData.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                Chưa có dữ liệu chi tiêu
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {walletData.sort((a, b) => b.value - a.value).map((w, idx) => {
                                    const percent = Math.round((w.value / totalExpense) * 100);
                                    return (
                                        <div key={idx}>
                                            <div className="flex-between" style={{ marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>{w.name}</span>
                                                <span style={{ fontWeight: '600' }}>{new Intl.NumberFormat('vi-VN').format(w.value)} ₫</span>
                                            </div>
                                            <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                                                <div style={{ width: `${percent}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '2px' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
};

export default Reports;
