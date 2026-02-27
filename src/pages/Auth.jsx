import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { LogIn, UserPlus } from 'lucide-react';

const Auth = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            if (isRegister) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                setMessage({ type: 'success', text: 'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận.' });
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-primary)', padding: '1rem'
        }}>
            <div className="card glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: '64px', height: '64px', background: 'var(--accent-primary)',
                        borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1rem', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)'
                    }}>
                        <LogIn color="white" size={32} />
                    </div>
                    <h1 style={{ margin: 0 }}>{isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Để đồng bộ dữ liệu giữa các thiết bị
                    </p>
                </div>

                {message.text && (
                    <div style={{
                        padding: '1rem', borderRadius: 'var(--border-radius-sm)', marginBottom: '1.5rem',
                        background: message.type === 'error' ? 'var(--status-danger-bg)' : 'var(--status-success-bg)',
                        color: message.type === 'error' ? 'var(--status-danger)' : 'var(--status-success)',
                        fontSize: '0.9rem', textAlign: 'center'
                    }}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Email của bạn</label>
                        <input
                            type="email" className="input-field" placeholder="email@example.com"
                            value={email} onChange={e => setEmail(e.target.value)} required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Mật khẩu</label>
                        <input
                            type="password" className="input-field" placeholder="••••••••"
                            value={password} onChange={e => setPassword(e.target.value)} required
                        />
                    </div>

                    <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }} disabled={loading}>
                        {loading ? 'Đang xử lý...' : (isRegister ? 'Đăng ký ngay' : 'Đăng nhập')}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <button
                        onClick={() => setIsRegister(!isRegister)}
                        style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                        {isRegister ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký ngay'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Auth;
