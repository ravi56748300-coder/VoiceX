import React, { useState, useEffect } from 'react';
import { ArrowLeft, MessageSquare, Plus, CheckCircle, AlertTriangle, MoreHorizontal, Play } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lfuaxrkukzmzjoljhmvw.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export default function HistoryScreen({ userId, onBack, onResumeConversation, onNewChat }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [threadCommands, setThreadCommands] = useState([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState(null);

  // Fetch list of conversations
  const fetchConversations = async () => {
    if (!userId) return;
    try {
      setLoadingConvs(true);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/conversations?user_id=eq.${userId}&order=updated_at.desc&limit=50`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (!res.ok) throw new Error('Failed to load conversations');
      const data = await res.json();
      setConversations(data);
    } catch (err) {
      console.error(err);
      setError('Could not load conversation history.');
    } finally {
      setLoadingConvs(false);
    }
  };

  // Fetch commands for a selected conversation
  const fetchThread = async (conv) => {
    setSelectedConv(conv);
    if (!conv?.id) return;
    try {
      setLoadingThread(true);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/commands?conversation_id=eq.${conv.id}&order=created_at.asc`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (!res.ok) throw new Error('Failed to load message thread');
      const data = await res.json();
      setThreadCommands(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [userId]);

  const formatAction = (tool) => {
    if (!tool) return null;
    const mapping = {
      'send_email': 'Sent email',
      'send_sms': 'Sent SMS',
      'send_whatsapp': 'Sent WhatsApp',
      'save_contact': 'Saved contact',
      'make_call': 'Placed call',
      'create_calendar_event': 'Scheduled event',
      'web_search': 'Web search',
      'shopping_search': 'Shopping search',
      'zapier_trigger': 'Zapier workflow',
      'schedule_message': 'Scheduled message',
      'ask_clarification': 'Asked clarification'
    };
    return mapping[tool] || tool;
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
  };

  return (
    <div className="app-shell" style={{ overflow: 'hidden' }}>
      {/* Top Chrome */}
      <header className="top-chrome" style={{ justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)', margin: '1.5rem', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={onBack}
            className="icon-btn"
            title="Back to Orb"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="brand-mark">
            <span>VOICEX // CONVERSATION HISTORY</span>
          </div>
        </div>

        <button
          onClick={onNewChat}
          style={{
            backgroundColor: '#2E6FF2',
            color: '#fff',
            border: 'none',
            padding: '6px 14px',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'inherit',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} /> New Chat
        </button>
      </header>

      {/* Main Two-Panel Content */}
      <main style={{ flex: 1, overflow: 'hidden', padding: '1.5rem', display: 'flex', gap: '1.5rem' }}>
        
        {/* Left Panel: Conversation Sessions List */}
        <div style={{
          width: '320px',
          flexShrink: 0,
          borderRight: '1px solid var(--border-color)',
          paddingRight: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          overflowY: 'auto'
        }}>
          <span style={{ fontSize: '0.75rem', color: '#6B7688', fontFamily: 'var(--font-mono)', fontWeight: 'bold', letterSpacing: '0.05em' }}>
            PAST CHATS ({conversations.length})
          </span>

          {loadingConvs && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div className="brand-dot state-listening" style={{ margin: '0 auto' }} />
            </div>
          )}

          {error && (
            <div className="unsupported-notice" style={{ padding: '0.75rem', fontSize: '0.85rem' }}>{error}</div>
          )}

          {!loadingConvs && conversations.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
              <MessageSquare size={36} style={{ opacity: 0.2, margin: '0 auto 0.5rem auto' }} />
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>No past conversations yet.</p>
            </div>
          )}

          {conversations.map((conv) => {
            const isSelected = selectedConv?.id === conv.id;
            return (
              <div
                key={conv.id}
                onClick={() => fetchThread(conv)}
                style={{
                  backgroundColor: isSelected ? 'rgba(46, 111, 242, 0.15)' : 'var(--surface-panel)',
                  border: isSelected ? '1px solid #2E6FF2' : '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}>
                    {conv.title || 'New Conversation'}
                  </h4>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6B7688', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                    {formatTime(conv.updated_at || conv.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Panel: Conversation Message Thread */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--surface-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden'
        }}>
          {selectedConv ? (
            <>
              {/* Thread Header */}
              <div style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                backgroundColor: '#0A0E14'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {selectedConv.title || 'Untitled Session'}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#6B7688', fontFamily: 'var(--font-mono)' }}>
                    Started {formatTime(selectedConv.created_at)}
                  </span>
                </div>

                <button
                  onClick={() => onResumeConversation(selectedConv, threadCommands)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #39FF8A',
                    color: '#39FF8A',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontFamily: 'inherit',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Play size={14} /> Resume Session
                </button>
              </div>

              {/* Thread Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {loadingThread && (
                  <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                    <div className="brand-dot state-listening" style={{ margin: '0 auto' }} />
                  </div>
                )}

                {!loadingThread && threadCommands.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>No messages recorded in this chat.</p>
                  </div>
                )}

                {!loadingThread && threadCommands.map((cmd) => (
                  <div key={cmd.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderBottom: '1px solid #1E2530', paddingBottom: '1rem' }}>
                    {/* User Prompt */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                      <span style={{ color: '#2E6FF2', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        USER &gt;
                      </span>
                      <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.4 }}>
                        {cmd.transcript}
                      </span>
                      <span style={{ marginLeft: 'auto', color: '#434D5D', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                        {formatTime(cmd.created_at)}
                      </span>
                    </div>

                    {/* Action Identified Badge */}
                    {cmd.intent_tool && (
                      <div style={{ marginLeft: '60px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.7rem',
                          color: '#39FF8A',
                          backgroundColor: 'rgba(57, 255, 138, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          textTransform: 'uppercase'
                        }}>
                          {formatAction(cmd.intent_tool)}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          {cmd.status === 'executed' && <CheckCircle size={12} color="var(--orb-listening)" />}
                          {cmd.status === 'failed' && <AlertTriangle size={12} color="var(--orb-error)" />}
                          {cmd.status === 'pending' && <MoreHorizontal size={12} color="var(--orb-idle)" />}
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#6B7688', textTransform: 'uppercase' }}>
                            {cmd.status}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
              <MessageSquare size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>Select a conversation from the left to view messages.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
