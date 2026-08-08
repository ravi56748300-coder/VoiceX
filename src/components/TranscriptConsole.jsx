import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Cpu, Copy } from 'lucide-react';

/**
 * Helper function to trigger deep links cleanly via DOM attachment/detachment with logging.
 */
const openDeepLink = (url, target) => {
  try {
    console.log('[DeepLink] Attempting to open URL:', url);
    const link = document.createElement('a');
    link.href = url;
    if (target) {
      link.target = target;
      if (target === '_blank') {
        link.rel = 'noopener noreferrer';
      }
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log('[DeepLink] Successfully clicked link:', url);
  } catch (err) {
    console.error('[DeepLink] Error clicking deep link:', err);
  }
};

/**
 * Single line component that displays transcript lines and optional Action Cards.
 */
function TranscriptLine({ line }) {
  const { role, text, timestamp, isInterim, tool, params, commandId, citations } = line;
  const words = text ? text.split(' ') : [];
  
  const [executeStatus, setExecuteStatus] = useState('idle'); // 'idle', 'loading', 'success', 'ready_mailto', 'handed_off', 'error'
  const [executeError, setExecuteError] = useState(null);
  const [shoppingData, setShoppingData] = useState(null);
  const [mailtoFallbackData, setMailtoFallbackData] = useState(null);
  const [copied, setCopied] = useState(false);

  // Auto-execute shopping_search on render
  useEffect(() => {
    if (tool === 'shopping_search' && executeStatus === 'idle' && commandId) {
      setExecuteStatus('loading');
      fetch('https://lfuaxrkukzmzjoljhmvw.supabase.co/functions/v1/shopping-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commandId,
          userId: 'mock-user-id-1234',
          product_query: params?.product_query || '',
          quantity: params?.quantity || 1
        })
      })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          setShoppingData(data);
          setExecuteStatus('success');
        } else {
          setExecuteStatus('error');
          setExecuteError(data.error || 'No matching product found in catalog');
        }
      })
      .catch((err) => {
        console.error('Shopping search error:', err);
        setExecuteStatus('error');
        setExecuteError(err.message || 'Failed to search catalog');
      });
    }
  }, [tool, commandId, params, executeStatus]);

  const handleExecute = async () => {
    if ((tool !== 'send_email' && tool !== 'zapier_trigger' && tool !== 'make_call' && tool !== 'send_sms' && tool !== 'send_whatsapp') || !commandId) return;
    
    setExecuteStatus('loading');
    setExecuteError(null);
    
    try {
      if (tool === 'send_sms') {
        const number = String(params?.to || '');
        const message = String(params?.message || '');
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const smsUrl = isIOS 
          ? `sms:${number}&body=${encodeURIComponent(message)}`
          : `sms:${number}?body=${encodeURIComponent(message)}`;
        
        console.log('[SMS] Generated deep link URL:', smsUrl);
        openDeepLink(smsUrl);
        setExecuteStatus('handed_off');

        if (commandId) {
          fetch('https://lfuaxrkukzmzjoljhmvw.supabase.co/functions/v1/update-command-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commandId, status: 'handed_off' })
          }).catch(e => console.warn('[SMS] Failed to update command status:', e));
        }
        return;
      }

      if (tool === 'send_whatsapp') {
        const cleanNumber = String(params?.to || '').replace(/\D/g, '');
        const message = String(params?.message || '');
        const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
        
        console.log('[WhatsApp] Generated deep link URL:', waUrl);
        openDeepLink(waUrl, '_blank');
        setExecuteStatus('handed_off');

        if (commandId) {
          fetch('https://lfuaxrkukzmzjoljhmvw.supabase.co/functions/v1/update-command-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commandId, status: 'handed_off' })
          }).catch(e => console.warn('[WhatsApp] Failed to update command status:', e));
        }
        return;
      }

      if (tool === 'make_call') {
        const response = await fetch('https://lfuaxrkukzmzjoljhmvw.supabase.co/functions/v1/make-call', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            commandId,
            to: params.to,
            script: params.script || params.purpose || 'Hello from VoiceX'
          })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          if (data.isUnverified) {
            throw new Error("Trial accounts can only call verified numbers — verify this number in your Twilio console, or test with your own number instead.");
          }
          throw new Error(data.error || `Server returned ${response.status}`);
        }

        setExecuteStatus('success');
        return;
      }

      if (tool === 'zapier_trigger') {
        const response = await fetch('https://lfuaxrkukzmzjoljhmvw.supabase.co/functions/v1/zapier-trigger', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            commandId,
            action_type: params.action_type,
            payload: params.payload || {}
          })
        });
        
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Server returned ${response.status}`);
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Zapier webhook trigger failed');
        }

        setExecuteStatus('success');
        return;
      }

      const response = await fetch('https://lfuaxrkukzmzjoljhmvw.supabase.co/functions/v1/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          commandId,
          to: params.to,
          subject: params.subject,
          body: params.body || 'Sent from VoiceX'
        })
      });
      
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Server returned ${response.status}`);
      }

      if (data.fallbackToMailto) {
        const mailtoTo = data.to || params.to || '';
        const mailtoSubject = data.subject || params.subject || '';
        const mailtoBody = data.body || params.body || '';
        
        const mailtoUrl = `mailto:${mailtoTo}?subject=${encodeURIComponent(mailtoSubject)}&body=${encodeURIComponent(mailtoBody)}`;
        console.log('[Email] Generated mailto deep link URL:', mailtoUrl);
        openDeepLink(mailtoUrl);
        
        setExecuteStatus('handed_off');
        return;
      }

      if (data.success) {
        setExecuteStatus('success');
        return;
      }

      throw new Error(data.error || 'Email send failed');
    } catch (err) {
      console.error("Execution failed:", err);
      setExecuteStatus('error');
      setExecuteError(err.message);
    }
  };

  const handleCopyContent = () => {
    const to = mailtoFallbackData?.to || params?.to || '';
    const subject = mailtoFallbackData?.subject || params?.subject || '';
    const body = mailtoFallbackData?.body || params?.body || '';
    const textToCopy = `To: ${to}\nSubject: ${subject}\n\nBody:\n${body}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleHandOffUpdate = () => {
    if (!commandId) return;
    setExecuteStatus('handed_off');
    
    // Fire and forget DB update
    fetch('https://lfuaxrkukzmzjoljhmvw.supabase.co/functions/v1/update-command-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        commandId,
        status: 'handed_off'
      })
    }).catch(err => console.warn("Failed to update status", err));
  };

  const getPrefix = () => {
    if (isInterim) {
      return 'USER (listening...) >';
    }
    switch (role) {
      case 'user':
        return 'USER >';
      case 'error':
        return '[ERR] >';
      case 'system':
      default:
        return 'VOICEX $';
    }
  };

  return (
    <div className={`transcript-wrapper ${role === 'user' ? 'user-wrapper' : ''}`}>
      <div className={`transcript-line role-${role} ${isInterim ? 'is-interim' : ''}`}>
        {timestamp && <span className="line-time">[{timestamp}]</span>}
        <span className="line-prefix">{getPrefix()}</span>
        <span className="line-content">
          {isInterim ? (
            <span className="interim-text">{text}</span>
          ) : (
            words.map((word, index) => (
              <span
                key={`${word}-${index}`}
                className="word-span"
                style={{ animationDelay: `${index * 25}ms` }}
              >
                {word}{index < words.length - 1 ? '\u00A0' : ''}
              </span>
            ))
          )}
        </span>
      </div>

      {citations && citations.length > 0 && (
        <div className="citations-list" style={{ marginLeft: '120px', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {citations.map((url, i) => {
            let hostname = url;
            try { hostname = new URL(url).hostname; } catch (e) {}
            return (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#2E6FF2', fontSize: '0.8em', textDecoration: 'none', padding: '2px 6px', background: '#12171F', borderRadius: '4px', border: '1px solid #1E2530' }}>
                [{i + 1}] {hostname}
              </a>
            );
          })}
        </div>
      )}

      {/* Render Auto-Executed Product Search Results */}
      {tool === 'shopping_search' && (
        <div className="shopping-auto-results" style={{ marginLeft: '120px', marginTop: '10px' }}>
          {(() => {
            let products = [];
            try {
              if (result) products = typeof result === 'string' ? JSON.parse(result) : result;
            } catch (e) {}

            if (!Array.isArray(products) || products.length === 0) {
              return null;
            }

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', maxWidth: '700px' }}>
                {products.map((prod, idx) => (
                  <div key={prod.id || idx} style={{
                    background: '#0A0E14',
                    border: '1px solid #1E2530',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    gap: '8px'
                  }}>
                    {prod.image_url && (
                      <img src={prod.image_url} alt={prod.name} style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '4px' }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#E8ECF3', fontSize: '0.9em' }}>{prod.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 'bold', color: '#39FF8A', fontSize: '0.95em' }}>${prod.price}</span>
                        {prod.color && (
                          <span style={{ fontSize: '0.7em', padding: '2px 6px', background: '#12171F', border: '1px solid #1E2530', borderRadius: '4px', color: '#B8C2D3' }}>
                            {prod.color}
                          </span>
                        )}
                        {prod.size && (
                          <span style={{ fontSize: '0.7em', padding: '2px 6px', background: '#12171F', border: '1px solid #1E2530', borderRadius: '4px', color: '#B8C2D3' }}>
                            Size: {prod.size}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Render Action Card if Gemini identified a tool intent (except web_search and shopping_search which auto-execute) */}
      {tool && tool !== 'web_search' && tool !== 'shopping_search' && (
        <div className="action-card">
          <div className="action-card-header">
            <div className="action-title-group">
              <Cpu size={14} className="action-icon" />
              <span className="action-badge">ACTION IDENTIFIED</span>
              <span className="action-tool-name">{tool}()</span>
            </div>
            <span className="action-stub-status">Not yet executed</span>
          </div>

          {params && Object.keys(params).length > 0 && (
            <div className="action-params-grid">
              {Object.entries(params).map(([key, value]) => (
                <div key={key} className="action-param-row">
                  <span className="param-label">{key}</span>
                  <span className="param-value">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {tool === 'send_email' && (
            <div className="action-execute-row" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {executeStatus !== 'picking' && executeStatus !== 'handed_off' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button 
                    onClick={() => setExecuteStatus('picking')}
                    style={{
                      background: '#2E6FF2',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: '4px',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.85em'
                    }}
                  >
                    Execute
                  </button>
                </div>
              )}

              {(executeStatus === 'picking' || executeStatus === 'handed_off') && (
                <div style={{
                  background: '#0A0E14',
                  border: '1px solid #1E2530',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  {/* Email Draft Summary */}
                  <div style={{ fontSize: '0.75em', color: '#6B7688', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                    EMAIL DRAFT SUMMARY
                  </div>
                  <div style={{ fontSize: '0.85em', color: '#E8ECF3' }}>
                    <div><strong style={{ color: '#6B7688' }}>To:</strong> {params?.to || 'Not specified'}</div>
                    <div style={{ marginTop: '2px' }}><strong style={{ color: '#6B7688' }}>Subject:</strong> {params?.subject || 'No subject'}</div>
                    <div style={{ marginTop: '4px' }}>
                      <strong style={{ color: '#6B7688' }}>Body:</strong>
                      <div style={{ background: '#12171F', padding: '8px', borderRadius: '4px', marginTop: '2px', color: '#B8C2D3', whiteSpace: 'pre-wrap' }}>
                        {params?.body || 'Sent from VoiceX'}
                      </div>
                    </div>
                  </div>

                  <div style={{ height: '1px', background: '#1E2530', margin: '4px 0' }} />

                  <div style={{ fontSize: '0.75em', color: '#39FF8A', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    SELECT EMAIL CLIENT TO COMPOSE & SEND:
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '8px'
                  }}>
                    {(() => {
                      const toStr = params?.to || '';
                      const subStr = params?.subject || '';
                      const bodyStr = params?.body || 'Sent from VoiceX';

                      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toStr)}&su=${encodeURIComponent(subStr)}&body=${encodeURIComponent(bodyStr)}`;
                      const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(toStr)}&subject=${encodeURIComponent(subStr)}&body=${encodeURIComponent(bodyStr)}`;
                      const mailtoUrl = `mailto:${toStr}?subject=${encodeURIComponent(subStr)}&body=${encodeURIComponent(bodyStr)}`;

                      const linkStyle = {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px 12px',
                        backgroundColor: '#12171F',
                        border: '1px solid #2E6FF2',
                        borderRadius: '6px',
                        color: '#E8ECF3',
                        fontFamily: 'inherit',
                        fontSize: '0.82em',
                        fontWeight: '600',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      };

                      return (
                        <>
                          <a href={gmailUrl} target="_blank" rel="noopener noreferrer" onClick={handleHandOffUpdate} style={linkStyle}>
                            ✉️ Open in Gmail
                          </a>
                          <a href={outlookUrl} target="_blank" rel="noopener noreferrer" onClick={handleHandOffUpdate} style={linkStyle}>
                            📫 Open in Outlook
                          </a>
                          <a href={mailtoUrl} target="_blank" rel="noopener noreferrer" onClick={handleHandOffUpdate} style={linkStyle}>
                            🍎 Open in Apple Mail
                          </a>
                          <a href={mailtoUrl} target="_blank" rel="noopener noreferrer" onClick={handleHandOffUpdate} style={linkStyle}>
                            💻 Open in Default Email App
                          </a>
                        </>
                      );
                    })()}
                  </div>

                  {executeStatus === 'handed_off' && (
                    <div style={{ marginTop: '6px', color: '#39FF8A', fontSize: '0.85em', fontWeight: 'bold' }}>
                      ✓ Email app opened — sent from your email client
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tool === 'zapier_trigger' && (
            <div className="action-execute-row" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                background: '#0A0E14',
                border: '1px solid #1E2530',
                borderRadius: '6px',
                padding: '10px 12px',
                fontSize: '0.85em',
                color: '#E8ECF3'
              }}>
                <div style={{ color: '#6B7688', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.75em', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  ZAPIER ROUTE: {(params?.action_type || 'generic').toUpperCase()}
                </div>
                {params?.action_type === 'discord' && (
                  <div><strong style={{ color: '#6B7688' }}>Message:</strong> {params.payload?.text || JSON.stringify(params.payload)}</div>
                )}
                {params?.action_type === 'sheet' && (
                  <div>
                    <strong style={{ color: '#6B7688' }}>Note:</strong> {params.payload?.note || JSON.stringify(params.payload)}
                    {params.payload?.amount !== undefined && (
                      <span style={{ marginLeft: '12px' }}><strong style={{ color: '#6B7688' }}>Amount:</strong> ${params.payload.amount}</span>
                    )}
                    {params.payload?.category && (
                      <span style={{ marginLeft: '12px' }}><strong style={{ color: '#6B7688' }}>Category:</strong> {params.payload.category}</span>
                    )}
                  </div>
                )}
                {params?.action_type === 'spotify' && (
                  <div>
                    <strong style={{ color: '#6B7688' }}>Action:</strong> {params.payload?.playlist_action || 'play'}
                    {params.payload?.track_name && (
                      <span style={{ marginLeft: '12px' }}><strong style={{ color: '#6B7688' }}>Track:</strong> {params.payload.track_name}</span>
                    )}
                  </div>
                )}
                {!['discord', 'sheet', 'spotify'].includes(params?.action_type) && (
                  <div><pre style={{ margin: 0, fontSize: '0.85em', color: '#B8C2D3' }}>{JSON.stringify(params?.payload || {}, null, 2)}</pre></div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  onClick={handleExecute}
                  disabled={executeStatus === 'loading' || executeStatus === 'success'}
                  style={{
                    background: executeStatus === 'success' ? '#39FF8A' : '#2E6FF2',
                    color: executeStatus === 'success' ? '#0A0E14' : '#fff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontFamily: 'inherit',
                    cursor: (executeStatus === 'loading' || executeStatus === 'success') ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.85em'
                  }}
                >
                  {executeStatus === 'loading' ? 'Triggering...' : executeStatus === 'success' ? 'Triggered ✓' : 'Execute'}
                </button>

                {executeStatus === 'error' && (
                  <span style={{ color: '#FF4D6A', fontSize: '0.85em' }}>✗ Failed: {executeError}</span>
                )}
                {executeStatus === 'success' && (
                  <span style={{ color: '#39FF8A', fontSize: '0.85em' }}>✓ Webhook sent to Zapier</span>
                )}
              </div>
            </div>
          )}

          {tool === 'make_call' && (
            <div className="action-execute-row" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                background: '#0A0E14',
                border: '1px solid #1E2530',
                borderRadius: '6px',
                padding: '10px 12px',
                fontSize: '0.85em',
                color: '#E8ECF3'
              }}>
                <div style={{ color: '#6B7688', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.75em', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  OUTBOUND CALL DETAILS
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <strong style={{ color: '#6B7688' }}>Recipient:</strong> {params?.to}
                </div>
                <div>
                  <strong style={{ color: '#6B7688' }}>Script / Purpose:</strong> {params?.script || params?.purpose || 'Hello from VoiceX'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  onClick={handleExecute}
                  disabled={executeStatus === 'loading' || executeStatus === 'success'}
                  style={{
                    background: executeStatus === 'success' ? '#39FF8A' : '#2E6FF2',
                    color: executeStatus === 'success' ? '#0A0E14' : '#fff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontFamily: 'inherit',
                    cursor: (executeStatus === 'loading' || executeStatus === 'success') ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.85em'
                  }}
                >
                  {executeStatus === 'loading' ? 'Placing Call...' : executeStatus === 'success' ? 'Call Placed ✓' : 'Execute Call'}
                </button>

                {executeStatus === 'error' && (
                  <span style={{ color: '#FF4D6A', fontSize: '0.85em' }}>✗ {executeError}</span>
                )}
                {executeStatus === 'success' && (
                  <span style={{ color: '#39FF8A', fontSize: '0.85em' }}>✓ Phone call initiated via Twilio</span>
                )}
              </div>
            </div>
          )}

          {(tool === 'send_sms' || tool === 'send_whatsapp') && (
            <div className="action-execute-row" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {executeStatus !== 'picking' && executeStatus !== 'handed_off' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button 
                    onClick={() => setExecuteStatus('picking')}
                    style={{
                      background: '#2E6FF2',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: '4px',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.85em'
                    }}
                  >
                    Execute
                  </button>
                </div>
              )}

              {(executeStatus === 'picking' || executeStatus === 'handed_off') && (
                <div style={{
                  background: '#0A0E14',
                  border: '1px solid #1E2530',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  {/* Message Summary */}
                  <div style={{ fontSize: '0.75em', color: '#6B7688', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                    MESSAGE DRAFT SUMMARY
                  </div>
                  <div style={{ fontSize: '0.85em', color: '#E8ECF3' }}>
                    <div><strong style={{ color: '#6B7688' }}>To:</strong> {params?.to || 'Not specified'}</div>
                    <div style={{ marginTop: '4px' }}>
                      <strong style={{ color: '#6B7688' }}>Message:</strong>
                      <div style={{ background: '#12171F', padding: '8px', borderRadius: '4px', marginTop: '2px', color: '#B8C2D3', whiteSpace: 'pre-wrap' }}>
                        {params?.message || 'No message content'}
                      </div>
                    </div>
                  </div>

                  <div style={{ height: '1px', background: '#1E2530', margin: '4px 0' }} />

                  <div style={{ fontSize: '0.75em', color: '#39FF8A', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    SELECT MESSAGING APP TO COMPOSE & SEND:
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '8px'
                  }}>
                    {(() => {
                      const rawNumber = String(params?.to || '');
                      const message = String(params?.message || '');
                      const cleanPhone = rawNumber.replace(/[^\d+]/g, '');
                      const cleanDigits = rawNumber.replace(/\D/g, '');
                      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
                      
                      const smsUrl = isIOS 
                        ? `sms:${cleanPhone}&body=${encodeURIComponent(message)}`
                        : `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
                      
                      const smstoUrl = `smsto:${cleanPhone}?body=${encodeURIComponent(message)}`;
                      const waUrl = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(message)}`;

                      console.log('SMS Link:', smsUrl);
                      console.log('SMSTO Link:', smstoUrl);
                      console.log('WhatsApp Link:', waUrl);

                      const linkStyle = {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px 12px',
                        backgroundColor: '#12171F',
                        border: '1px solid #2E6FF2',
                        borderRadius: '6px',
                        color: '#E8ECF3',
                        fontFamily: 'inherit',
                        fontSize: '0.82em',
                        fontWeight: '600',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      };

                      return (
                        <>
                          <a href={smsUrl} target="_blank" rel="noopener noreferrer" onClick={handleHandOffUpdate} style={linkStyle}>
                            📱 Send via SMS
                          </a>
                          <a href={smstoUrl} target="_blank" rel="noopener noreferrer" onClick={handleHandOffUpdate} style={linkStyle}>
                            📱 Send via SMS (SMSTO)
                          </a>
                          <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={handleHandOffUpdate} style={linkStyle}>
                            💬 Send via WhatsApp
                          </a>
                        </>
                      );
                    })()}
                  </div>

                  {executeStatus === 'handed_off' && (
                    <div style={{ marginTop: '6px', color: '#39FF8A', fontSize: '0.85em', fontWeight: 'bold' }}>
                      ✓ SMS app opened — sent from your messaging client
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tool === 'shopping_search' && (
            <div className="shopping-action-container" style={{ marginTop: '12px' }}>
              {executeStatus === 'loading' && (
                <span style={{ color: '#6B7688', fontSize: '0.85em' }}>Searching catalog & creating Stripe checkout...</span>
              )}

              {executeStatus === 'error' && (
                <span style={{ color: '#FF4D6A', fontSize: '0.85em' }}>✗ {executeError}</span>
              )}

              {executeStatus === 'success' && shoppingData && (
                <div className="product-card" style={{
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'center',
                  background: '#0A0E14',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #1E2530'
                }}>
                  {shoppingData.product.image_url && (
                    <img 
                      src={shoppingData.product.image_url} 
                      alt={shoppingData.product.name} 
                      style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '4px' }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#E8ECF3', fontSize: '0.95em' }}>
                      {shoppingData.product.name}
                    </div>
                    <div style={{ color: '#6B7688', fontSize: '0.85em', marginTop: '2px' }}>
                      Qty: {params?.quantity || 1} • ${shoppingData.product.price} ea
                    </div>
                    <div style={{ color: '#39FF8A', fontWeight: 'bold', fontSize: '0.9em', marginTop: '2px' }}>
                      Total: ${(shoppingData.product.price * (params?.quantity || 1)).toFixed(2)}
                    </div>
                  </div>
                  <button
                    onClick={() => window.open(shoppingData.checkoutUrl, '_blank')}
                    style={{
                      background: '#39FF8A',
                      color: '#0A0E14',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      fontFamily: 'inherit',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '0.9em',
                      boxShadow: '0 0 10px rgba(57, 255, 138, 0.2)'
                    }}
                  >
                    Checkout →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * TranscriptConsole displays log of voice commands, system responses, and action cards.
 * @param {Object} props
 * @param {Array<Object>} props.lines
 */
export function TranscriptConsole({ lines = [] }) {
  const consoleRef = useRef(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <section className="transcript-section" aria-label="Live Transcript Log">
      <div className="transcript-console" ref={consoleRef}>
        {lines.length === 0 ? (
          <div className="transcript-line role-system" style={{ opacity: 0.5 }}>
            <span className="line-prefix">VOICEX $</span>
            <span className="line-content">Awaiting audio stream or text input...</span>
          </div>
        ) : (
          lines.map((line, idx) => (
            <TranscriptLine key={line.id || `line-${idx}`} line={line} />
          ))
        )}
      </div>
    </section>
  );
}

export default TranscriptConsole;
