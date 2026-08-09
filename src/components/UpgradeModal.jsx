import React, { useState } from 'react';
import { Crown, Check, Zap, X, ShieldCheck, HelpCircle } from 'lucide-react';

const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || 'https://lfuaxrkukzmzjoljhmvw.supabase.co/functions/v1/gemini-intent';

export default function UpgradeModal({ isOpen, onClose, userId, subscriptionInfo }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('compare'); // 'compare' | 'upgrade'

  if (!isOpen) return null;

  const handleSubscribe = async () => {
    if (!userId) {
      setError('Please log in to upgrade.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Derive base functions URL (e.g. https://lfuaxrkukzmzjoljhmvw.supabase.co/functions/v1)
      const baseUrl = SUPABASE_FUNCTIONS_URL.substring(0, SUPABASE_FUNCTIONS_URL.lastIndexOf('/'));
      const checkoutUrl = `${baseUrl}/create-checkout-session`;

      const res = await fetch(checkoutUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userId,
          redirectOrigin: window.location.origin
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data.url) {
        // Redirect to Stripe Checkout Session
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned.');
      }

    } catch (err) {
      console.error('Checkout Error:', err);
      setError(err.message || 'Failed to initiate checkout.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 7, 10, 0.88)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '1.5rem'
    }}>
      <div style={{
        backgroundColor: '#0A0E14',
        border: '1px solid #2E6FF2',
        boxShadow: '0 0 35px rgba(46, 111, 242, 0.3)',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '540px',
        padding: '2rem',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: '#6B7688',
            cursor: 'pointer',
            padding: '4px'
          }}
          title="Close"
        >
          <X size={20} />
        </button>

        {/* Header Icon & Title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: 'rgba(57, 255, 138, 0.1)',
            border: '1px solid #39FF8A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Crown size={26} color="#39FF8A" />
          </div>

          <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#E8ECF3', fontWeight: 'bold' }}>
            VoiceX Subscription Plans
          </h2>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#B8C2D3' }}>
            {subscriptionInfo?.isLimitReached
              ? "You've reached your free prompt limit. Compare plans and upgrade to continue!"
              : "Compare features and upgrade for unlimited voice commands & priority access."}
          </p>
        </div>

        {/* Plan Comparison Table */}
        <div style={{
          backgroundColor: '#12171F',
          border: '1px solid #1E2530',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr 1fr',
            backgroundColor: '#0A0E14',
            padding: '10px 12px',
            borderBottom: '1px solid #1E2530',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 'bold',
            color: '#6B7688',
            letterSpacing: '0.05em'
          }}>
            <span>FEATURE</span>
            <span style={{ textAlign: 'center' }}>FREE TRIAL</span>
            <span style={{ textAlign: 'center', color: '#39FF8A' }}>PREMIUM 👑</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.82rem', color: '#E8ECF3' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', padding: '10px 12px', borderBottom: '1px solid #1E2530', alignItems: 'center' }}>
              <span>Monthly Prompts</span>
              <span style={{ textAlign: 'center', color: '#B8C2D3', fontSize: '0.78rem' }}>30 days + 5 max</span>
              <span style={{ textAlign: 'center', color: '#39FF8A', fontWeight: 'bold' }}>Unlimited 🚀</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', padding: '10px 12px', borderBottom: '1px solid #1E2530', alignItems: 'center' }}>
              <span>Deep Link Handoffs</span>
              <span style={{ textAlign: 'center', color: '#39FF8A' }}><Check size={14} style={{ margin: '0 auto' }} /></span>
              <span style={{ textAlign: 'center', color: '#39FF8A' }}><Check size={14} style={{ margin: '0 auto' }} /></span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', padding: '10px 12px', borderBottom: '1px solid #1E2530', alignItems: 'center' }}>
              <span>Multi-Turn Chat History</span>
              <span style={{ textAlign: 'center', color: '#39FF8A' }}><Check size={14} style={{ margin: '0 auto' }} /></span>
              <span style={{ textAlign: 'center', color: '#39FF8A' }}><Check size={14} style={{ margin: '0 auto' }} /></span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', padding: '10px 12px', borderBottom: '1px solid #1E2530', alignItems: 'center' }}>
              <span>Contact Memory & Emojis</span>
              <span style={{ textAlign: 'center', color: '#39FF8A' }}><Check size={14} style={{ margin: '0 auto' }} /></span>
              <span style={{ textAlign: 'center', color: '#39FF8A' }}><Check size={14} style={{ margin: '0 auto' }} /></span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', padding: '10px 12px', alignItems: 'center' }}>
              <span>Priority Function Processing</span>
              <span style={{ textAlign: 'center', color: '#6B7688', fontSize: '0.78rem' }}>Standard</span>
              <span style={{ textAlign: 'center', color: '#39FF8A', fontWeight: 'bold' }}>Priority ⚡</span>
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem',
            backgroundColor: 'rgba(255, 77, 106, 0.1)',
            border: '1px solid #FF4D6A',
            borderRadius: '6px',
            fontSize: '0.82rem',
            color: '#FF4D6A',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleSubscribe}
          disabled={loading}
          style={{
            backgroundColor: '#39FF8A',
            color: '#0A0E14',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '6px',
            fontFamily: 'inherit',
            fontSize: '0.95rem',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 0 18px rgba(57, 255, 138, 0.35)',
            transition: 'all 0.2s ease'
          }}
        >
          <Zap size={18} />
          {loading ? 'Redirecting to Checkout...' : 'Upgrade Now — Stripe Checkout'}
        </button>

        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#6B7688', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <ShieldCheck size={14} color="#6B7688" />
          <span>Secured by Stripe • Instant Activation</span>
        </div>
      </div>
    </div>
  );
}
