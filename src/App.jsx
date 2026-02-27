import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Wallets from './pages/Wallets';
import Budgets from './pages/Budgets';
import SavingGoals from './pages/SavingGoals';
import Debts from './pages/Debts';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

import { db, syncFromCloud, setupRealtimeSync } from './db';

import { supabase } from './supabaseClient';
import Auth from './pages/Auth';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const realtimeCleanupRef = useRef(null);

  const startRealtime = (userId) => {
    // Clean up any existing subscription first
    if (realtimeCleanupRef.current) {
      realtimeCleanupRef.current();
    }
    realtimeCleanupRef.current = setupRealtimeSync(userId);
  };

  const stopRealtime = () => {
    if (realtimeCleanupRef.current) {
      realtimeCleanupRef.current();
      realtimeCleanupRef.current = null;
    }
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        syncFromCloud();
        startRealtime(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_IN' && session) {
        syncFromCloud();
        startRealtime(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        stopRealtime();
      }
    });

    return () => {
      subscription.unsubscribe();
      stopRealtime();
    };
  }, []);

  if (loading) return null;
  if (!session) return <Auth />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout user={session.user} />}>
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="wallets" element={<Wallets />} />
          <Route path="budgets" element={<Budgets />} />
          <Route path="goals" element={<SavingGoals />} />
          <Route path="debts" element={<Debts />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
