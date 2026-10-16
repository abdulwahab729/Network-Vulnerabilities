import React, { useState, useEffect, useCallback } from 'react';
import {
  BrowserRouter as Router, Routes, Route, Navigate,
  Link, useLocation, useNavigate, useParams
} from 'react-router-dom';
import {
  Shield, Activity, List, LogOut, Search, AlertTriangle,
  ShieldCheck, Plus, RefreshCw, Download,
  CheckCircle, XCircle, Eye, EyeOff, Network, Bell,
  Lock, User, Globe, Terminal, Copy, Check, ExternalLink,
  Server, Zap, Sparkles, Filter
} from 'lucide-react';
import './index.css';
import './App.css';

// ── API base ──────────────────────────────────────────────────────────────────
const API = 'http://localhost:8000';

// ── Auth service ──────────────────────────────────────────────────────────────
const auth = {
  login: (token, role, username) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    localStorage.setItem('username', username);
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
  },
  getToken: () => localStorage.getItem('token'),
  getRole: () => localStorage.getItem('role') || 'analyst',
  getUsername: () => localStorage.getItem('username') || 'analyst',
  isAuthenticated: () => !!localStorage.getItem('token'),
};

// ── Fetch helper with auto-logout on 401 ──────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.getToken()}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    auth.logout();
    window.location.href = '/login';
  }
  return res;
}

// ── Severity helpers ──────────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
  Critical: { bg: 'rgba(244,63,94,0.14)',  border: 'rgba(244,63,94,0.35)',  text: '#f43f5e', glow: 'rgba(244,63,94,0.3)' },
  High:     { bg: 'rgba(249,115,22,0.14)', border: 'rgba(249,115,22,0.35)', text: '#f97316', glow: 'rgba(249,115,22,0.3)' },
  Medium:   { bg: 'rgba(234,179,8,0.14)',  border: 'rgba(234,179,8,0.35)',  text: '#eab308', glow: 'rgba(234,179,8,0.3)' },
  Low:      { bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.35)', text: '#10b981', glow: 'rgba(16,185,129,0.3)' },
  Unknown:  { bg: 'rgba(148,163,184,0.14)',border: 'rgba(148,163,184,0.35)',text: '#94a3b8', glow: 'rgba(148,163,184,0.2)' },
};

const STATUS_CONFIG = {
  open:             { bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.3)',  text: '#f43f5e', label: 'Open Issue' },
  in_progress:      { bg: 'rgba(234,179,8,0.12)',  border: 'rgba(234,179,8,0.3)',  text: '#eab308', label: 'In Progress' },
  resolved:         { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', text: '#10b981', label: 'Resolved' },
  verified:         { bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.4)', text: '#818cf8', label: 'Verified Fixed' },
  completed:        { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', text: '#10b981', label: 'Completed' },
  failed:           { bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.3)',  text: '#f43f5e', label: 'Failed' },
  pending:          { bg: 'rgba(148,163,184,0.12)',border: 'rgba(148,163,184,0.3)',text: '#94a3b8', label: 'Pending' },
};

const Badge = ({ label, type = 'severity' }) => {
  if (type === 'status') {
    const cfg = STATUS_CONFIG[label] || { bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)', text: '#94a3b8', label };
    return (
      <span style={{
        padding: '3px 10px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 700,
        background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text,
        letterSpacing: '0.04em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '5px'
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.text }} />
        {cfg.label}
      </span>
    );
  }

  const cfg = SEVERITY_CONFIG[label] || SEVERITY_CONFIG.Unknown;
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 700,
      background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text,
      letterSpacing: '0.04em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '5px',
      boxShadow: `0 0 8px ${cfg.glow}`
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.text }} />
      {label?.toUpperCase()}
    </span>
  );
};

// ── Toast notification hook ───────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
  }, []);
  const hide = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(hide, 4000);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  const ToastEl = toast ? (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
      background: 'rgba(14, 18, 28, 0.96)',
      border: `1px solid ${toast.type === 'error' ? '#f43f5e' : toast.type === 'success' ? '#10b981' : '#6366f1'}`,
      borderLeft: `4px solid ${toast.type === 'error' ? '#f43f5e' : toast.type === 'success' ? '#10b981' : '#6366f1'}`,
      borderRadius: '12px', padding: '14px 20px', maxWidth: '380px',
      backdropFilter: 'blur(16px)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      color: '#f8fafc', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px',
      animation: 'fadeInScale 0.25s ease'
    }}>
      {toast.type === 'error' ? <AlertTriangle size={18} color="#f43f5e" /> :
       toast.type === 'success' ? <CheckCircle size={18} color="#10b981" /> :
       <Sparkles size={18} color="#6366f1" />}
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button onClick={hide} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}>
        <XCircle size={15} />
      </button>
    </div>
  ) : null;

  return { show, ToastEl };
}

// ── Alerts Drawer / Modal ─────────────────────────────────────────────────────
const AlertsModal = ({ isOpen, onClose, onRefreshStats }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await apiFetch('/api/alerts');
      if (res.ok) setAlerts(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen, fetchAlerts]);

  const markRead = async (id) => {
    await apiFetch(`/api/alerts/${id}/read`, { method: 'POST' });
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: 1 } : a));
    if (onRefreshStats) onRefreshStats();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content-panel" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(244,63,94,0.15)', color: '#f43f5e' }}>
              <Bell size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>Security Alerts & Telemetry</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Automated Critical Threat Notifications</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <XCircle size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : alerts.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <ShieldCheck size={40} color="#10b981" style={{ marginBottom: '12px' }} />
            <p>No critical security alerts at this time.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
            {alerts.map(a => (
              <div key={a.id} style={{
                padding: '14px 16px', borderRadius: '10px',
                background: a.is_read ? 'rgba(255,255,255,0.02)' : 'rgba(244,63,94,0.08)',
                border: `1px solid ${a.is_read ? 'var(--border)' : 'rgba(244,63,94,0.25)'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: a.is_read ? '#64748b' : '#f43f5e'
                    }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: a.is_read ? 'var(--text-muted)' : '#ffffff' }}>
                      {a.message}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', paddingLeft: '16px' }}>
                    {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
                  </div>
                </div>
                {!a.is_read && (
                  <button onClick={() => markRead(a.id)} className="btn-cyber-outline" style={{ padding: '5px 10px', fontSize: '0.75rem' }}>
                    Mark Read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Top Navigation Bar ────────────────────────────────────────────────────────
const TopNavbar = ({ onOpenAlerts, unreadCount }) => {
  const navigate = useNavigate();
  const username = auth.getUsername();
  const role = auth.getRole();

  return (
    <header className="top-navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="engine-status-pill">
          <span className="beacon-dot" />
          <span>ENGINE ONLINE · NMAP 7.99 ACTIVE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
          <Server size={14} />
          <span>PORT 8000</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          onClick={() => navigate('/scan/new')}
          className="btn-cyber-primary"
          style={{ padding: '8px 16px', fontSize: '0.84rem' }}
        >
          <Zap size={14} /> Quick Launch
        </button>

        <button
          onClick={onOpenAlerts}
          title="Security Alerts"
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
            borderRadius: '10px', width: '38px', height: '38px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: unreadCount > 0 ? '#f43f5e' : 'var(--text-muted)',
            cursor: 'pointer', position: 'relative', transition: 'all 0.2s'
          }}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              background: '#f43f5e', color: '#fff', fontSize: '0.68rem',
              fontWeight: 800, minWidth: '18px', height: '18px', borderRadius: '9px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 8px rgba(244,63,94,0.6)'
            }}>
              {unreadCount}
            </span>
          )}
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 12px',
          borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)'
        }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.82rem', fontWeight: 700, color: '#fff'
          }}>
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff', lineHeight: 1.1 }}>{username}</div>
            <div style={{ fontSize: '0.68rem', color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{role}</div>
          </div>
        </div>
      </div>
    </header>
  );
};

// ── Sidebar Navigation ────────────────────────────────────────────────────────
const Sidebar = ({ onLogout }) => {
  const location = useLocation();

  const navSections = [
    {
      title: 'Operations',
      items: [
        { path: '/',         icon: <Activity size={18} />,  label: 'Threat Dashboard' },
        { path: '/scan/new', icon: <Search   size={18} />,  label: 'Launch Scan'      },
        { path: '/scans',    icon: <List     size={18} />,  label: 'Scan History'     },
      ]
    },
    {
      title: 'Target Management',
      items: [
        { path: '/networks', icon: <Network  size={18} />,  label: 'Saved Networks'   },
      ]
    }
  ];

  const isActive = (p) => p === '/' ? location.pathname === '/' : location.pathname.startsWith(p);

  return (
    <aside className="sidebar-container">
      {/* Brand header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px', padding: '4px 8px' }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(6,182,212,0.2))',
          border: '1px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', boxShadow: '0 0 20px rgba(99,102,241,0.3)'
        }}>
          <Shield size={24} color="#818cf8" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em' }} className="text-gradient">
            V-SCANNER
          </div>
          <div style={{ fontSize: '0.7rem', color: '#06b6d4', fontWeight: 600, letterSpacing: '0.05em' }}>
            ENTERPRISE SOC v2.4
          </div>
        </div>
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navSections.map(section => (
          <div key={section.title}>
            <div className="sidebar-category-header">{section.title}</div>
            {section.items.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-nav-link ${isActive(item.path) ? 'active' : ''}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer telemetry */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
        <div style={{
          padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border)', marginBottom: '14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Threat Engine</span>
            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>READY</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>CVE Sync</span>
            <span style={{ fontSize: '0.72rem', color: '#06b6d4', fontWeight: 600 }}>NVD 2.0</span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="btn-cyber-outline"
          style={{ width: '100%', justifyContent: 'center', color: '#fda4af', borderColor: 'rgba(244,63,94,0.2)' }}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </aside>
  );
};

// ── Layout Wrapper ────────────────────────────────────────────────────────────
const Layout = ({ children }) => {
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadAlerts = useCallback(async () => {
    try {
      const res = await apiFetch('/api/alerts');
      if (res.ok) {
        const list = await res.json();
        setUnreadCount(list.filter(a => !a.is_read).length);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (auth.isAuthenticated()) {
      fetchUnreadAlerts();
      const timer = setInterval(fetchUnreadAlerts, 15000);
      return () => clearInterval(timer);
    }
  }, [fetchUnreadAlerts]);

  if (!auth.isAuthenticated()) return <Navigate to="/login" replace />;

  const handleLogout = () => {
    auth.logout();
    window.location.href = '/login';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-darker)' }}>
      <Sidebar onLogout={handleLogout} />
      <div style={{ marginLeft: '250px', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopNavbar onOpenAlerts={() => setAlertsModalOpen(true)} unreadCount={unreadCount} />
        <main style={{ flex: 1, padding: '36px 40px', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>

      <AlertsModal
        isOpen={alertsModalOpen}
        onClose={() => setAlertsModalOpen(false)}
        onRefreshStats={fetchUnreadAlerts}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: Login & Registration (Elevated Cybersecurity Terminal)
// ─────────────────────────────────────────────────────────────────────────────
const LoginPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    const endpoint = isRegister ? '/api/register' : '/api/login';
    const payload = isRegister ? { username, password, role: 'admin' } : { username, password };

    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        if (isRegister) {
          setSuccess('Account created! You can now sign in.');
          setIsRegister(false);
          setPassword('');
        } else {
          auth.login(data.token, data.role, data.username);
          window.location.href = '/';
        }
      } else {
        setError(data.message || 'Invalid username or password.');
      }
    } catch {
      setError('Cannot connect to the server (port 8000).');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-simple-wrapper">
      <div className="login-simple-card">
        {/* Simple Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '14px'
          }}>
            <Shield size={24} color="var(--primary)" />
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 700, marginBottom: '6px' }}>
            {isRegister ? 'Create an account' : 'Welcome back'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>
            {isRegister ? 'Enter your details to create an account' : 'Sign in to access your vulnerability scanner'}
          </p>
        </div>

        {error && (
          <div className="alert-box alert-error" style={{ marginBottom: '18px', padding: '10px 14px', fontSize: '0.84rem' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert-box alert-success" style={{ marginBottom: '18px', padding: '10px 14px', fontSize: '0.84rem' }}>
            <CheckCircle size={16} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Username Input */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Username</label>
            <div className="input-container">
              <div className="input-icon-left"><User size={16} /></div>
              <input
                type="text"
                className="input-cyber has-icon-left"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="form-group" style={{ marginBottom: '22px' }}>
            <label className="form-label">Password</label>
            <div className="input-container">
              <div className="input-icon-left"><Lock size={16} /></div>
              <input
                type={showPwd ? 'text' : 'password'}
                className="input-cyber has-icon-left has-icon-right"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="input-icon-right"
                onClick={() => setShowPwd(!showPwd)}
                title={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-cyber-primary"
            style={{ width: '100%', padding: '12px', fontSize: '0.92rem' }}
            disabled={loading}
          >
            {loading ? <><span className="spinner-sm" /> Please wait...</> : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Simple Bottom Toggle */}
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess(''); }}
            style={{
              background: 'transparent', border: 'none', color: 'var(--primary)',
              fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline'
            }}
          >
            {isRegister ? 'Sign in' : 'Create one'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: Threat Dashboard
// ─────────────────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch('/api/dashboard/stats');
      if (res.ok) setStats(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const statCards = stats ? [
    { label: 'Total Scans Executed',  value: stats.scans.total,       icon: <Activity size={24} />,    color: '#6366f1', glow: 'rgba(99,102,241,0.2)' },
    { label: 'Critical Threats (9.0+)', value: stats.vulns.critical,  icon: <AlertTriangle size={24}/>, color: '#f43f5e', glow: 'rgba(244,63,94,0.2)' },
    { label: 'High Severity Issues',  value: stats.vulns.high,        icon: <AlertTriangle size={24}/>, color: '#f97316', glow: 'rgba(249,115,22,0.2)' },
    { label: 'Open Remediation Tasks', value: stats.vulns.open,       icon: <XCircle size={24}/>,      color: '#eab308', glow: 'rgba(234,179,8,0.2)' },
    { label: 'Resolved In Progress',  value: stats.vulns.resolved,    icon: <CheckCircle size={24}/>,  color: '#06b6d4', glow: 'rgba(6,182,212,0.2)' },
    { label: 'Verified Remediations', value: stats.vulns.verified,    icon: <ShieldCheck size={24}/>,  color: '#10b981', glow: 'rgba(16,185,129,0.2)' },
  ] : [];

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.9rem', marginBottom: '6px' }}>Threat Intelligence Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Real-time security posture telemetry, vulnerability distributions, and active audit history.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={fetchStats} className="btn-cyber-outline">
            <RefreshCw size={15} /> Refresh Telemetry
          </button>
          <button onClick={() => navigate('/scan/new')} className="btn-cyber-primary">
            <Zap size={16} /> New Assessment
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          {/* Stat Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '32px' }}>
            {statCards.map((c, i) => (
              <div
                key={i}
                className="glass-panel glass-card-interactive"
                style={{
                  padding: '22px', position: 'relative', overflow: 'hidden',
                  borderTop: `2px solid ${c.color}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{
                    padding: '10px', borderRadius: '10px',
                    background: `${c.color}18`, color: c.color,
                    border: `1px solid ${c.color}33`, boxShadow: `0 0 14px ${c.glow}`
                  }}>
                    {c.icon}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.05em' }}>
                    METRIC #{i + 1}
                  </span>
                </div>
                <div style={{ fontSize: '2.4rem', fontWeight: 800, lineHeight: 1, marginBottom: '8px', color: '#ffffff' }}>
                  {c.value ?? 0}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
                  {c.label}
                </div>
              </div>
            ))}
          </div>

          {/* Severity Bar Panel */}
          {stats && stats.vulns.total > 0 && (
            <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Filter size={18} color="#818cf8" /> Vulnerability Severity Spectrum
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Total Flagged Vulnerabilities: <strong style={{ color: '#ffffff' }}>{stats.vulns.total}</strong>
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ display: 'flex', height: '14px', borderRadius: '8px', overflow: 'hidden', gap: '3px', background: 'rgba(0,0,0,0.3)', padding: '2px' }}>
                {[
                  { key: 'critical', color: '#f43f5e' },
                  { key: 'high',     color: '#f97316' },
                  { key: 'medium',   color: '#eab308' },
                  { key: 'low',      color: '#10b981' },
                ].map(s => {
                  const pct = ((stats.vulns[s.key] / stats.vulns.total) * 100).toFixed(1);
                  return pct > 0 ? (
                    <div
                      key={s.key}
                      title={`${s.key.toUpperCase()}: ${stats.vulns[s.key]} (${pct}%)`}
                      style={{ width: `${pct}%`, background: s.color, borderRadius: '4px', transition: 'width 0.5s ease' }}
                    />
                  ) : null;
                })}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: '24px', marginTop: '16px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Critical (9.0 - 10.0)', val: stats.vulns.critical, color: '#f43f5e' },
                  { label: 'High (7.0 - 8.9)',     val: stats.vulns.high,     color: '#f97316' },
                  { label: 'Medium (4.0 - 6.9)',   val: stats.vulns.medium,   color: '#eab308' },
                  { label: 'Low (0.1 - 3.9)',      val: stats.vulns.low,      color: '#10b981' },
                ].map(s => (
                  <span key={s.label} style={{ fontSize: '0.84rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: s.color, display: 'inline-block', boxShadow: `0 0 8px ${s.color}` }} />
                    {s.label}: <strong style={{ color: s.color }}>{s.val}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Scans Table */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '4px' }}>Recent Assessments</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Latest Nmap probe targets and execution statuses</p>
              </div>
              <Link to="/scans" className="btn-cyber-outline" style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
                View All Scans →
              </Link>
            </div>

            {stats?.recent_scans?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <Search size={36} color="var(--text-dim)" style={{ marginBottom: '12px' }} />
                <p>No active assessment records found. Launch your first network scan.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {stats?.recent_scans?.map(s => (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/scans/${s.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 18px', borderRadius: '10px', cursor: 'pointer',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(99,102,241,0.08)';
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>
                        <Terminal size={16} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontFamily: 'JetBrains Mono', color: '#ffffff', fontSize: '0.92rem' }}>
                          {s.target}
                        </div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginTop: '2px' }}>
                          Scan ID: #{s.id} · Initiated: {s.created_at ? new Date(s.created_at).toLocaleString() : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <Badge label={s.status} type="status" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: New Scan Form (Advanced Launchpad)
// ─────────────────────────────────────────────────────────────────────────────
const NewScan = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const prefill = location.state || {};
  const [target, setTarget] = useState(prefill.target || '');
  const [profile, setProfile] = useState('audit'); // recon | audit | deep
  const [scanning, setScanning] = useState(false);
  const [networks, setNetworks] = useState([]);
  const { show, ToastEl } = useToast();

  useEffect(() => {
    apiFetch('/api/networks').then(r => r.ok && r.json().then(setNetworks));
  }, []);

  const handleLaunch = async (e) => {
    e.preventDefault();
    if (!target.trim()) {
      show('Please specify a valid target address or domain.', 'error');
      return;
    }
    setScanning(true);
    const body = { target: target.trim() };
    if (prefill.network_id) body.network_id = prefill.network_id;

    try {
      const res = await apiFetch('/api/scans', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        show(`Vulnerability probe initiated! Assessment #${data.scan_id}`, 'success');
        setTimeout(() => navigate(`/scans/${data.scan_id}`), 1200);
      } else {
        show(data.error || 'Failed to initiate scan', 'error');
      }
    } catch {
      show('Server connection failure while dispatching probe task.', 'error');
    } finally {
      setScanning(false);
    }
  };

  const presets = [
    { label: 'Localhost (127.0.0.1)', value: '127.0.0.1' },
    { label: 'Local Gateway (192.168.1.1)', value: '192.168.1.1' },
    { label: 'Subnet /24', value: '192.168.1.0/24' },
    { label: 'Scanme Nmap', value: 'scanme.nmap.org' },
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: '820px' }}>
      {ToastEl}

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.9rem', marginBottom: '6px' }}>Dispatch Network Vulnerability Scan</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          Configure target reconnaissance parameters, port probes, and automated CVE vulnerability correlation.
        </p>
      </div>

      <form onSubmit={handleLaunch} className="glass-panel" style={{ padding: '32px', marginBottom: '24px' }}>
        {/* Target Address Input */}
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label className="form-label">
            <span>Target Host / Network CIDR</span>
            <span className="form-label-hint">IPv4, IPv6, Subnet, or FQDN</span>
          </label>
          <div className="input-container">
            <div className="input-icon-left"><Globe size={18} /></div>
            <input
              type="text"
              className="input-cyber has-icon-left mono"
              placeholder="e.g. 192.168.1.1 or 10.0.0.0/24 or example.com"
              value={target}
              onChange={e => setTarget(e.target.value)}
              required
            />
          </div>

          {/* Quick Preset Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', alignSelf: 'center' }}>Presets:</span>
            {presets.map(p => (
              <span key={p.value} className="chip-preset" onClick={() => setTarget(p.value)}>
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* Scan Profile Cards */}
        <div className="form-group" style={{ marginBottom: '28px' }}>
          <label className="form-label">
            <span>Scan Engine Profile</span>
            <span className="form-label-hint">Nmap execution flags</span>
          </label>
          <div className="scan-profile-grid">
            {[
              { id: 'recon', title: '⚡ Fast Recon', flags: '-F -Pn', desc: 'Top 100 ports fast sweep' },
              { id: 'audit', title: '🔍 Standard Audit', flags: '-F -sV -Pn', desc: 'Banner grab & CVE matching' },
              { id: 'deep',  title: '🛡️ Deep Profiling', flags: '-sV -Pn --version-all', desc: 'Comprehensive version analysis' },
            ].map(p => (
              <div
                key={p.id}
                className={`scan-profile-card ${profile === p.id ? 'active' : ''}`}
                onClick={() => setProfile(p.id)}
              >
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff', marginBottom: '4px' }}>{p.title}</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.72rem', color: '#06b6d4', marginBottom: '4px' }}>{p.flags}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Saved Networks quick picker */}
        {networks.length > 0 && (
          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label className="form-label">
              <span>Or Select From Managed Target Network</span>
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {networks.map(n => (
                <div
                  key={n.id}
                  onClick={() => setTarget(n.target)}
                  style={{
                    padding: '8px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s',
                    fontSize: '0.82rem'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <strong style={{ color: '#ffffff' }}>{n.name}:</strong> <span className="mono" style={{ color: '#818cf8' }}>{n.target}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Assessment Engine Details Box */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(6,182,212,0.04))',
          border: '1px solid rgba(99,102,241,0.25)', borderRadius: '12px',
          padding: '16px 20px', marginBottom: '28px', fontSize: '0.85rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#c7d2fe', marginBottom: '4px' }}>
            <ShieldCheck size={18} color="#818cf8" />
            Automated CVE Correlation Enabled
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.5 }}>
            Identified open ports will automatically be queried against local exploit rules and the live NIST National Vulnerability Database (NVD v2.0 REST API).
          </p>
        </div>

        {/* Dispatch Button */}
        <button
          type="submit"
          className="btn-cyber-primary"
          disabled={scanning}
          style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
        >
          {scanning ? (
            <><span className="spinner-sm" /> Running Port Scanning Probe...</>
          ) : (
            <><Zap size={18} /> Launch Vulnerability Assessment</>
          )}
        </button>
      </form>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: Saved Networks Management Form
// ─────────────────────────────────────────────────────────────────────────────
const Networks = () => {
  const [networks, setNetworks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const { show, ToastEl } = useToast();
  const navigate = useNavigate();

  const fetchNetworks = useCallback(async () => {
    const res = await apiFetch('/api/networks');
    if (res.ok) setNetworks(await res.json());
  }, []);

  useEffect(() => {
    fetchNetworks();
  }, [fetchNetworks]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await apiFetch('/api/networks', {
      method: 'POST',
      body: JSON.stringify({ name, target })
    });
    if (res.ok) {
      show('Target network saved to registry!', 'success');
      setName('');
      setTarget('');
      setShowModal(false);
      fetchNetworks();
    } else {
      const d = await res.json();
      show(d.error || 'Failed to save target network', 'error');
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this saved network target?')) return;
    await apiFetch(`/api/networks/${id}`, { method: 'DELETE' });
    fetchNetworks();
    show('Network removed from registry', 'info');
  };

  return (
    <div className="animate-fade-in">
      {ToastEl}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.9rem', marginBottom: '6px' }}>Managed Target Networks</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Store internal IP subnets, perimeter servers, and domain targets for rapid security auditing.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-cyber-primary">
          <Plus size={16} /> Add Target Network
        </button>
      </div>

      {/* Networks Grid */}
      {networks.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Network size={54} color="var(--text-dim)" style={{ marginBottom: '16px' }} />
          <h3 style={{ marginBottom: '8px' }}>No Saved Network Targets</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 20px' }}>
            Add your company infrastructure, gateways, or cloud CIDR ranges to trigger assessments in one click.
          </p>
          <button onClick={() => setShowModal(true)} className="btn-cyber-primary">
            <Plus size={16} /> Register First Target
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
          {networks.map(n => (
            <div key={n.id} className="glass-panel glass-card-interactive" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
                  <Network size={20} />
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
                  ID #{n.id}
                </span>
              </div>

              <h3 style={{ fontSize: '1.1rem', marginBottom: '4px', color: '#ffffff' }}>{n.name}</h3>
              <div style={{ fontFamily: 'JetBrains Mono', color: '#06b6d4', fontSize: '0.92rem', marginBottom: '16px' }}>
                {n.target}
              </div>

              <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginBottom: '20px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                Added: {n.created_at ? new Date(n.created_at).toLocaleDateString() : 'N/A'}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn-cyber-primary"
                  style={{ flex: 1, padding: '8px', fontSize: '0.84rem' }}
                  onClick={() => navigate('/scan/new', { state: { target: n.target, network_id: n.id } })}
                >
                  <Zap size={14} /> Scan Now
                </button>
                <button
                  className="btn-cyber-outline"
                  style={{ padding: '8px 14px', fontSize: '0.84rem', color: '#fda4af', borderColor: 'rgba(244,63,94,0.3)' }}
                  onClick={() => handleDelete(n.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Network Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-content-panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Network size={20} color="#818cf8" /> Add Target Network
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">
                  <span>Target Friendly Name</span>
                  <span className="form-label-hint">Asset label</span>
                </label>
                <input
                  type="text"
                  className="input-cyber"
                  placeholder="e.g. Core Production VPC or Database Gateway"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '28px' }}>
                <label className="form-label">
                  <span>Target IP / CIDR / Hostname</span>
                  <span className="form-label-hint">Network scope</span>
                </label>
                <input
                  type="text"
                  className="input-cyber mono"
                  placeholder="e.g. 192.168.1.0/24 or prod.internal"
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-cyber-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-cyber-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Register Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: Scan History List
// ─────────────────────────────────────────────────────────────────────────────
const ScanHistory = () => {
  const [scans, setScans] = useState([]);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const fetchScans = useCallback(async () => {
    const res = await apiFetch('/api/scans');
    if (res.ok) setScans(await res.json());
  }, []);

  useEffect(() => {
    fetchScans();
    const interval = setInterval(fetchScans, 6000);
    return () => clearInterval(interval);
  }, [fetchScans]);

  const filtered = scans.filter(s =>
    s.target?.toLowerCase().includes(search.toLowerCase()) ||
    String(s.id).includes(search)
  );

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.9rem', marginBottom: '6px' }}>Assessment Audit History</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Complete audit trail of all port probe executions and vulnerability scans.
          </p>
        </div>
        <Link to="/scan/new" className="btn-cyber-primary">
          <Plus size={16} /> New Assessment
        </Link>
      </div>

      {/* Filter / Search Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <Search size={18} color="var(--text-dim)" />
        <input
          type="text"
          className="input-cyber mono"
          placeholder="Filter scans by target IP or ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: 'transparent', border: 'none', padding: '4px', boxShadow: 'none' }}
        />
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              {['Scan ID', 'Target Host / Scope', 'Execution Timestamp', 'Completed At', 'Status', 'Action'].map(h => (
                <th key={h} style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No assessment records found.
                </td>
              </tr>
            ) : (
              filtered.map(scan => (
                <tr
                  key={scan.id}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => navigate(`/scans/${scan.id}`)}
                >
                  <td style={{ padding: '16px 20px', fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                    #{scan.id}
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: '#ffffff' }}>
                    {scan.target}
                  </td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                    {scan.created_at ? new Date(scan.created_at).toLocaleString() : 'N/A'}
                  </td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-dim)', fontSize: '0.84rem' }}>
                    {scan.completed_at ? new Date(scan.completed_at).toLocaleTimeString() : '—'}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <Badge label={scan.status} type="status" />
                  </td>
                  <td style={{ padding: '16px 20px' }} onClick={e => e.stopPropagation()}>
                    <button
                      className="btn-cyber-outline"
                      style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                      onClick={() => navigate(`/scans/${scan.id}`)}
                    >
                      <Eye size={14} /> View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: Scan Detail & Vulnerabilities (Remediation & Verification Workflow)
// ─────────────────────────────────────────────────────────────────────────────
const ScanDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [vulns, setVulns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [copiedId, setCopiedId] = useState(null);
  const [rescanning, setRescanning] = useState(false);
  const { show, ToastEl } = useToast();

  const fetchScan = useCallback(async () => {
    const [scanRes, vulnRes] = await Promise.all([
      apiFetch(`/api/scans/${id}`),
      apiFetch(`/api/scans/${id}/vulnerabilities`),
    ]);
    if (scanRes.ok) setScan(await scanRes.json());
    if (vulnRes.ok) setVulns(await vulnRes.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchScan();
    const interval = setInterval(async () => {
      const res = await apiFetch(`/api/scans/${id}`);
      if (res.ok) {
        const data = await res.json();
        setScan(data);
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
          fetchScan();
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchScan, id]);

  const updateStatus = async (vulnId, newStatus) => {
    const res = await apiFetch(`/api/vulnerabilities/${vulnId}`, {
      method: 'PATCH',
      body: JSON.stringify({ remediation_status: newStatus })
    });
    if (res.ok) {
      const updated = await res.json();
      setVulns(prev => prev.map(v => v.id === vulnId ? { ...v, ...updated } : v));
      show(`Remediation status updated to "${newStatus.toUpperCase()}"`, 'success');
    } else {
      show('Failed to update remediation status', 'error');
    }
  };

  const copyToClipboard = (text, vid) => {
    navigator.clipboard.writeText(text);
    setCopiedId(vid);
    show(`Copied CVE identifier: ${text}`, 'info');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const downloadReport = async () => {
    const res = await apiFetch(`/api/scans/${id}/report`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assessment_${id}_${scan?.target}_report.csv`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      show('CSV audit report downloaded successfully', 'success');
    } else {
      show('CSV report generation encountered an error', 'error');
    }
  };

  const handleRescan = async () => {
    setRescanning(true);
    const res = await apiFetch(`/api/scans/${id}/rescan`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      show(`Verification re-scan dispatched! Assessment #${data.scan_id}`, 'info');
      setTimeout(() => navigate(`/scans/${data.scan_id}`), 1200);
    } else {
      show(data.error || 'Re-scan execution failed', 'error');
    }
    setRescanning(false);
  };

  const filters = ['All', 'Critical', 'High', 'Medium', 'Low'];
  const displayed = filter === 'All' ? vulns : vulns.filter(v => v.severity === filter);

  const statusCycle = { open: 'in_progress', in_progress: 'resolved', resolved: 'verified', verified: 'open' };
  const statusLabel = { open: 'Start Remediation', in_progress: 'Mark Resolved', resolved: 'Mark Verified', verified: 'Reopen Issue' };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {ToastEl}

      {/* Breadcrumb & Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => navigate('/scans')} className="btn-cyber-outline" style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
          ← Back to Scan History
        </button>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
          Assessment ID #{id}
        </span>
      </div>

      {/* Target Header Card */}
      <div className="glass-panel" style={{ padding: '28px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h1 style={{ fontFamily: 'JetBrains Mono', fontSize: '2rem' }}>{scan?.target}</h1>
              <Badge label={scan?.status} type="status" />
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.86rem', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span>Initiated: {scan?.created_at ? new Date(scan.created_at).toLocaleString() : 'N/A'}</span>
              {scan?.completed_at && <span>Completed: {new Date(scan.completed_at).toLocaleTimeString()}</span>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={downloadReport} className="btn-cyber-outline">
              <Download size={15} /> Export CSV Audit
            </button>
            <button onClick={handleRescan} disabled={rescanning} className="btn-cyber-primary">
              <RefreshCw size={15} /> {rescanning ? 'Launching...' : 'Verify With Re-Scan'}
            </button>
          </div>
        </div>
      </div>

      {/* Severity Filter Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div className="pill-tab-container">
          {filters.map(f => (
            <button
              key={f}
              className={`pill-tab-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f} ({f === 'All' ? vulns.length : vulns.filter(v => v.severity === f).length})
            </button>
          ))}
        </div>
      </div>

      {/* Vulnerabilities List */}
      {scan?.status === 'in_progress' && vulns.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="spinner" style={{ margin: '0 auto 20px' }} />
          <h3 style={{ marginBottom: '8px' }}>Probing Target Network Ports...</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Nmap is performing service detection and version auditing. Results will populate automatically.
          </p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <ShieldCheck size={52} color="#10b981" style={{ marginBottom: '16px' }} />
          <h3 style={{ marginBottom: '8px' }}>No Threats Detected</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            {filter !== 'All' ? `No ${filter} severity vulnerabilities matching filter.` : 'No open vulnerability vectors found on target.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {displayed.map(v => {
            const sevColor = SEVERITY_CONFIG[v.severity] || SEVERITY_CONFIG.Unknown;
            return (
              <div key={v.id} className="vuln-card-elevated">
                <div className="vuln-accent-bar" style={{ background: sevColor.text }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  {/* Left Column: Details */}
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: 'JetBrains Mono', fontWeight: 800, fontSize: '1.05rem',
                        color: '#ffffff', background: 'rgba(255,255,255,0.06)',
                        padding: '3px 10px', borderRadius: '6px'
                      }}>
                        Port {v.port} / {v.protocol?.toUpperCase()}
                      </span>

                      <Badge label={v.severity} type="severity" />

                      {v.cve_id && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <a
                            href={`https://nvd.nist.gov/vuln/detail/${v.cve_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontFamily: 'JetBrains Mono', fontSize: '0.84rem', color: '#06b6d4',
                              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            {v.cve_id} <ExternalLink size={12} />
                          </a>
                          <button
                            onClick={() => copyToClipboard(v.cve_id, v.id)}
                            title="Copy CVE ID"
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                          >
                            {copiedId === v.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '0.96rem', color: '#ffffff', marginBottom: '6px' }}>
                      Service: <span style={{ color: '#c7d2fe' }}>{v.service}</span>
                    </div>

                    <div style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.5, marginBottom: '14px' }}>
                      {v.description}
                    </div>

                    {/* CVSS Risk Score Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>CVSS Risk</span>
                      <div style={{ flex: 1, maxWidth: '200px', height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{
                          width: `${((v.risk_score || 0) / 10) * 100}%`, height: '100%',
                          background: sevColor.text, borderRadius: '4px',
                          boxShadow: `0 0 10px ${sevColor.glow}`
                        }} />
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: sevColor.text, fontFamily: 'JetBrains Mono' }}>
                        {v.risk_score?.toFixed(1) || '0.0'}
                      </span>
                    </div>

                    {/* Remediation Advice */}
                    {v.remediation && (
                      <div style={{
                        background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                        borderRadius: '10px', padding: '12px 16px', fontSize: '0.84rem'
                      }}>
                        <div style={{ color: '#34d399', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShieldCheck size={16} /> Remediation Protocol
                        </div>
                        <div style={{ color: '#e2e8f0', lineHeight: 1.4 }}>
                          {v.remediation}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Workflow Control */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                    gap: '10px', minWidth: '170px'
                  }}>
                    <Badge label={v.remediation_status} type="status" />

                    {v.verified_at && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', textAlign: 'right' }}>
                        Verified: {new Date(v.verified_at).toLocaleDateString()}
                      </div>
                    )}

                    <button
                      className="btn-cyber-outline"
                      style={{
                        padding: '7px 14px', fontSize: '0.82rem',
                        color: v.remediation_status === 'verified' ? '#f43f5e' : '#10b981',
                        borderColor: v.remediation_status === 'verified' ? 'rgba(244,63,94,0.3)' : 'rgba(16,185,129,0.3)'
                      }}
                      onClick={() => updateStatus(v.id, statusCycle[v.remediation_status])}
                    >
                      {statusLabel[v.remediation_status]}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 404 Not Found Page
// ─────────────────────────────────────────────────────────────────────────────
const NotFound = () => (
  <div style={{ textAlign: 'center', padding: '100px 20px' }}>
    <h1 style={{ fontSize: '5rem', opacity: 0.15, marginBottom: '16px' }}>404</h1>
    <h2 style={{ marginBottom: '8px' }}>Security Perimeter Route Unreachable</h2>
    <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>The requested navigation endpoint does not exist.</p>
    <Link to="/" className="btn-cyber-primary">← Return to Threat Dashboard</Link>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Application Router
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/networks" element={<Layout><Networks /></Layout>} />
        <Route path="/scans" element={<Layout><ScanHistory /></Layout>} />
        <Route path="/scan/new" element={<Layout><NewScan /></Layout>} />
        <Route path="/scans/:id" element={<Layout><ScanDetail /></Layout>} />
        <Route path="*" element={<Layout><NotFound /></Layout>} />
      </Routes>
    </Router>
  );
}
