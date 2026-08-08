import React, { useState } from 'react';
import { auth, googleProvider } from '../firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const translateError = (code) => {
    switch (code) {
      case 'auth/invalid-email':
        return 'Invalid email format.';
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect password or email.';
      case 'auth/email-already-in-use':
        return 'An account already exists with this email.';
      case 'auth/weak-password':
        return 'Password is too weak (minimum 6 characters).';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in was canceled.';
      default:
        return 'Authentication failed. Please try again.';
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(translateError(err.code));
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(translateError(err.code));
      setLoading(false);
    }
  };

  return (
    <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        backgroundColor: 'var(--surface-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        zIndex: 10
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <div className="brand-mark" style={{ justifyContent: 'center', fontSize: '1rem', marginBottom: '0.5rem' }}>
            <div className="brand-dot state-idle" />
            <span>VOICEX // AUTH</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Initialize session to access the Intent Engine
          </p>
        </div>

        {error && (
          <div className="unsupported-notice" style={{ padding: '0.75rem', justifyContent: 'center' }}>
            {error}
          </div>
        )}

        <button 
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            backgroundColor: 'var(--bg-color)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            padding: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
          onMouseOver={(e) => !loading && (e.target.style.borderColor = 'var(--text-secondary)')}
          onMouseOut={(e) => !loading && (e.target.style.borderColor = 'var(--border-color)')}
        >
          {loading ? 'Processing...' : 'Sign in with Google'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>OR</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
        </div>

        <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="terminal-input-form" style={{ padding: '0.5rem 0.75rem' }}>
            <input
              type="email"
              placeholder="Email address"
              className="terminal-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              style={{ fontFamily: 'var(--font-sans)', fontSize: '0.95rem' }}
            />
          </div>
          
          <div className="terminal-input-form" style={{ padding: '0.5rem 0.75rem' }}>
            <input
              type="password"
              placeholder="Password"
              className="terminal-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              style={{ fontFamily: 'var(--font-sans)', fontSize: '0.95rem' }}
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: 'rgba(46, 111, 242, 0.1)',
              border: '1px solid var(--orb-idle)',
              color: 'var(--orb-idle)',
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '0.5rem',
              transition: 'all 0.2s ease',
              boxShadow: '0 0 10px rgba(46, 111, 242, 0.2)'
            }}
            onMouseOver={(e) => !loading && (e.target.style.backgroundColor = 'rgba(46, 111, 242, 0.2)')}
            onMouseOut={(e) => !loading && (e.target.style.backgroundColor = 'rgba(46, 111, 242, 0.1)')}
          >
            {loading ? 'Processing...' : (isSignUp ? 'Initialize Profile' : 'Authenticate')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <button 
            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              textDecoration: 'underline'
            }}
          >
            {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}
