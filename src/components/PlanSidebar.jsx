import React, { useState } from 'react';
import { Crown, Zap, AlertTriangle, Lock, ChevronLeft, ChevronRight, Layers } from 'lucide-react';

export default function PlanSidebar({ subscriptionInfo, onOpenUpgradeModal }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isPremium = subscriptionInfo?.isPremium;
  const inTrial = subscriptionInfo?.inTrial;
  const daysLeft = subscriptionInfo?.daysRemainingInTrial ?? 30;
  const promptsLeft = subscriptionInfo?.postTrialPromptsRemaining ?? 5;
  const isLimitReached = subscriptionInfo?.isLimitReached;

  // Calculate progress bar percentages
  const trialProgressPct = Math.min(100, Math.max(0, (daysLeft / 30) * 100));
  const postTrialProgressPct = Math.min(100, Math.max(0, (promptsLeft / 5) * 100));

  return (
    <div style={{
      position: 'fixed',
      top: '80px',
      right: isCollapsed ? '-280px' : '20px',
      width: '280px',
      zIndex: 9000,
      transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      display: 'flex',
      alignItems: 'flex-start'
    }}>
      {/* Toggle Tab */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          transform: 'translateX(-100%)',
          backgroundColor: '#0A0E14',
          border: '1px solid #1E2530',
          borderRight: 'none',
          borderRadius: '8px 0 0 8px',
          color: isPremium ? '#FFD700' : isLimitReached ? '#FF4D6A' : '#39FF8A',
          padding: '10px 8px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '-4px 0 15px rgba(0,0,0,0.5)'
        }}
        title={isCollapsed ? "Expand Plan Panel" : "Collapse Plan Panel"}
      >
        {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        <Crown size={16} />
      </button>

      {/* Main Panel Content */}
      <div style={{
        width: '100%',
        backgroundColor: '#0A0E14',
        border: '1px solid #1E2530',
        borderRadius: '0 0 10px 10px',
        borderTop: isPremium ? '2px solid #FFD700' : isLimitReached ? '2px solid #FF4D6A' : '2px solid #2E6FF2',
        padding: '1.25rem',
        boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        fontFamily: 'var(--font-sans)'
      }}>
        {/* Panel Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={14} color="#6B7688" />
            <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: '#6B7688', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              PLAN STATUS
            </span>
          </div>

          {isPremium && (
            <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: '#FFD700', backgroundColor: 'rgba(255, 215, 0, 0.12)', border: '1px solid #FFD700', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
              ACTIVE
            </span>
          )}
        </div>

        {/* Status Body & Countdown */}
        {isPremium ? (
          <div style={{
            backgroundColor: '#12171F',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            borderRadius: '8px',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Crown size={24} color="#FFD700" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#FFD700' }}>
                Premium Member ✓
              </div>
              <div style={{ fontSize: '0.75rem', color: '#B8C2D3', marginTop: '2px' }}>
                Unlimited access to all features.
              </div>
            </div>
          </div>
        ) : inTrial ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#E8ECF3', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={14} color="#2E6FF2" /> Free Trial Active
              </span>
              <span style={{ fontSize: '0.75rem', color: '#39FF8A', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                {daysLeft}d left
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: '6px', backgroundColor: '#12171F', borderRadius: '3px', overflow: 'hidden', border: '1px solid #1E2530' }}>
              <div style={{
                width: `${trialProgressPct}%`,
                height: '100%',
                backgroundColor: trialProgressPct > 20 ? '#2E6FF2' : '#FFAA00',
                borderRadius: '3px',
                transition: 'width 0.3s ease'
              }} />
            </div>

            <div style={{ fontSize: '0.72rem', color: '#6B7688' }}>
              30 days of unlimited access included with your trial.
            </div>
          </div>
        ) : !isLimitReached && promptsLeft > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#FFAA00', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={14} color="#FFAA00" /> Post-Trial Free Tier
              </span>
              <span style={{ fontSize: '0.75rem', color: '#FFAA00', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                {promptsLeft} of 5 left
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: '6px', backgroundColor: '#12171F', borderRadius: '3px', overflow: 'hidden', border: '1px solid #1E2530' }}>
              <div style={{
                width: `${postTrialProgressPct}%`,
                height: '100%',
                backgroundColor: '#FFAA00',
                borderRadius: '3px',
                transition: 'width 0.3s ease'
              }} />
            </div>

            <div style={{ fontSize: '0.72rem', color: '#6B7688' }}>
              Trial expired. You have {promptsLeft} free prompt{promptsLeft > 1 ? 's' : ''} left before limit.
            </div>
          </div>
        ) : (
          <div style={{
            backgroundColor: 'rgba(255, 77, 106, 0.1)',
            border: '1px solid #FF4D6A',
            borderRadius: '8px',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#FF4D6A', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={14} color="#FF4D6A" /> Trial & Free Prompts Ended
            </div>
            <div style={{ fontSize: '0.75rem', color: '#E8ECF3' }}>
              Upgrade to Premium for unlimited voice commands & automation.
            </div>
          </div>
        )}

        {/* Buttons: View Plans & Upgrade */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.2rem' }}>
          {!isPremium && (
            <button
              onClick={onOpenUpgradeModal}
              style={{
                width: '100%',
                backgroundColor: '#39FF8A',
                color: '#0A0E14',
                border: 'none',
                padding: '9px 12px',
                borderRadius: '6px',
                fontFamily: 'inherit',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 0 12px rgba(57, 255, 138, 0.25)',
                transition: 'all 0.2s ease'
              }}
            >
              <Crown size={15} /> Upgrade to Premium
            </button>
          )}

          <button
            onClick={onOpenUpgradeModal}
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: '1px solid #1E2530',
              color: '#B8C2D3',
              padding: '7px 12px',
              borderRadius: '6px',
              fontFamily: 'inherit',
              fontSize: '0.78rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            View Plans & Compare
          </button>
        </div>
      </div>
    </div>
  );
}
