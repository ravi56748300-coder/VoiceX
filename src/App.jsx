import React, { useState, useEffect, useRef, useCallback } from 'react';
import VoiceOrb from './components/VoiceOrb';
import TranscriptConsole from './components/TranscriptConsole';
import TextConsoleInput from './components/TextConsoleInput';
import { Sliders, RefreshCw, LogOut, History, Plus } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import AuthScreen from './components/AuthScreen';
import HistoryScreen from './components/HistoryScreen';
const getTimestamp = () => {
  const now = new Date();
  return now.toTimeString().split(' ')[0];
};

const EDGE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || 'https://lfuaxrkukzmzjoljhmvw.supabase.co/functions/v1/gemini-intent';

const INITIAL_TRANSCRIPT = [
  {
    id: '1',
    role: 'system',
    text: 'VoiceX Intent Engine online. Web Speech & Gemini Function Calling ready.',
    timestamp: getTimestamp()
  }
];

export default function App() {
  const [orbState, setOrbState] = useState('idle'); // 'idle' | 'listening' | 'thinking' | 'error'
  const [transcript, setTranscript] = useState(INITIAL_TRANSCRIPT);
  const [isMuted, setIsMuted] = useState(false);
  const [isVoiceSupported, setIsVoiceSupported] = useState(true);
  const [showDevPanel, setShowDevPanel] = useState(true);
  const [currentView, setCurrentView] = useState('main'); // 'main' | 'history'
  const [conversationId, setConversationId] = useState(null);

  // References for Web Speech API and voice synthesis
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const interimLineIdRef = useRef(null);
  const capturedTextRef = useRef('');
  const preferredVoiceRef = useRef(null);

  // Auth State
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 0. Listen for Auth State Changes & manage active conversation ID
  const createNewConversation = useCallback(async (userIdToUse) => {
    const activeUid = userIdToUse || user?.uid;
    if (!activeUid) return null;
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://lfuaxrkukzmzjoljhmvw.supabase.co'}/rest/v1/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          user_id: activeUid,
          title: 'New Conversation'
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const newId = data[0].id;
          setConversationId(newId);
          localStorage.setItem('voicex_current_conversation_id', newId);
          setTranscript(INITIAL_TRANSCRIPT);
          setCurrentView('main');
          return newId;
        }
      }
    } catch (err) {
      console.error('Failed to create new conversation:', err);
    }
    return null;
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        const savedConvId = localStorage.getItem('voicex_current_conversation_id');
        if (savedConvId) {
          setConversationId(savedConvId);
        } else {
          createNewConversation(currentUser.uid);
        }
      }
    });
    return () => unsubscribe();
  }, [createNewConversation]);

  // 1. Detect SpeechRecognition & SpeechSynthesis availability on mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsVoiceSupported(false);
      setTranscript((prev) => [
        ...prev,
        {
          id: 'err-unsupported',
          role: 'error',
          text: 'Voice input (SpeechRecognition API) is not supported in this browser. Use the terminal console below.',
          timestamp: getTimestamp()
        }
      ]);
    } else {
      setIsVoiceSupported(true);
    }

    // Load SpeechSynthesis voices
    if ('speechSynthesis' in window) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        const naturalVoice = voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Natural') ||
              v.name.includes('Google') ||
              v.name.includes('Samantha') ||
              v.name.includes('Karen') ||
              v.name.includes('Daniel') ||
              v.name.includes('Microsoft'))
        ) || voices.find((v) => v.lang.startsWith('en')) || voices[0];
        
        preferredVoiceRef.current = naturalVoice || null;
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // 2. Text-To-Speech Synthesizer function
  const speakResponse = useCallback((text) => {
    if (isMuted || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel(); // Stop any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      if (preferredVoiceRef.current) {
        utterance.voice = preferredVoiceRef.current;
      }
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('SpeechSynthesis error:', err);
    }
  }, [isMuted]);

  // 3. Process Thinking state by calling the Gemini Intent Edge Function with a 20s timeout and 1 retry
  const processCommandAndRespond = useCallback(async (userText, inputType) => {
    setOrbState('thinking');

    // Get the last 4 transcript items as history (excluding the one we just added for the current prompt)
    const history = transcript.slice(-4).map(item => ({
      role: item.role,
      text: item.text
    }));

    const attemptFetch = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout requirement

      try {
        const response = await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ transcript: userText, userId: user?.uid || 'anonymous', conversationId, history }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Server returned status ${response.status}`);
        }

        return await response.json();
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    };

    try {
      let data;
      try {
        data = await attemptFetch();
      } catch (err) {
        console.warn(`[Dev] Attempt 1 failed for gemini-intent: ${err.message}. Retrying silently...`);
        data = await attemptFetch();
      }

      const replyText = data.reply || 'Command processed.';
      console.log('[VoiceX Engine] Response received:', data);
      if (data.dbError) {
        console.error('[Supabase DB Insert Error]:', data.dbError);
      }

      // Add system response and optional tool action card to transcript
      setTranscript((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'system',
          text: replyText,
          tool: data.tool || null,
          params: data.params || null,
          commandId: data.commandId || null,
          citations: data.citations || null,
          result: data.result || null,
          timestamp: getTimestamp()
        }
      ]);

      setOrbState('idle');
      if (inputType === 'voice') {
        speakResponse(replyText);
      }

    } catch (err) {
      console.error('Gemini Intent Function Error (Both attempts failed):', err);

      const errorMessage = err.name === 'AbortError'
        ? 'Request timed out (20s limit reached). Engine did not respond in time.'
        : `Edge Function Error: ${err.message}`;

      setTranscript((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'error',
          text: errorMessage,
          timestamp: getTimestamp()
        }
      ]);

      setOrbState('error');
    }
  }, [speakResponse, transcript]);

  // 4. Initialize and control SpeechRecognition engine
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsVoiceSupported(false);
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    capturedTextRef.current = '';
    const interimId = `interim-${Date.now()}`;
    interimLineIdRef.current = interimId;

    recognition.onstart = () => {
      isListeningRef.current = true;
      setOrbState('listening');
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptText = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcriptText;
        } else {
          interim += transcriptText;
        }
      }

      const currentText = final || interim;
      if (currentText) {
        capturedTextRef.current = currentText;

        setTranscript((prev) => {
          const filtered = prev.filter((item) => item.id !== interimId);
          return [
            ...filtered,
            {
              id: interimId,
              role: 'user',
              text: currentText,
              timestamp: getTimestamp(),
              isInterim: !final
            }
          ];
        });
      }
    };

    recognition.onspeechend = () => {
      setOrbState('thinking');
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      const finalCapturedText = capturedTextRef.current.trim();

      if (finalCapturedText) {
        setTranscript((prev) => {
          const filtered = prev.filter((item) => item.id !== interimLineIdRef.current);
          return [
            ...filtered,
            {
              id: Date.now().toString(),
              role: 'user',
              text: finalCapturedText,
              timestamp: getTimestamp(),
              isInterim: false
            }
          ];
        });

        processCommandAndRespond(finalCapturedText, 'voice');
      } else {
        setTranscript((prev) => prev.filter((item) => item.id !== interimLineIdRef.current));
        setOrbState('idle');
      }
    };

    recognition.onerror = (event) => {
      isListeningRef.current = false;
      setTranscript((prev) => prev.filter((item) => item.id !== interimLineIdRef.current));

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setOrbState('error');
        setTranscript((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'error',
            text: 'Microphone access denied — use the text console below instead.',
            timestamp: getTimestamp()
          }
        ]);
      } else if (event.error === 'no-speech') {
        setOrbState('idle');
      } else if (event.error !== 'aborted') {
        setOrbState('error');
        setTranscript((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'error',
            text: `Speech recognition error: ${event.error}. Use the text console below.`,
            timestamp: getTimestamp()
          }
        ]);
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setOrbState('error');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListeningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  };

  const toggleListening = () => {
    if (!isVoiceSupported) return;

    if (orbState === 'listening') {
      stopListening();
    } else if (orbState === 'idle' || orbState === 'error') {
      startListening();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.code === 'Space' &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        toggleListening();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [orbState, isVoiceSupported]);

  const handleTextSubmit = (inputText) => {
    stopListening();

    const userLine = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      timestamp: getTimestamp()
    };

    setTranscript((prev) => [...prev, userLine]);
    processCommandAndRespond(inputText, 'text');
  };

  const handleManualStateChange = (newState) => {
    stopListening();
    setOrbState(newState);
    if (newState === 'error') {
      setTranscript((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'error',
          text: 'Microphone access denied — use the text console below instead.',
          timestamp: getTimestamp()
        }
      ]);
    }
  };

  const handleResetTranscript = () => {
    stopListening();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setTranscript(INITIAL_TRANSCRIPT);
    setOrbState('idle');
  };

  if (authLoading) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="brand-dot state-thinking" style={{ width: '20px', height: '20px' }} />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (currentView === 'history') {
    return (
      <HistoryScreen 
        userId={user.uid} 
        onBack={() => setCurrentView('main')}
        onNewChat={() => createNewConversation(user.uid)}
        onResumeConversation={(conv, threadCmds) => {
          setConversationId(conv.id);
          localStorage.setItem('voicex_current_conversation_id', conv.id);
          
          const loadedTranscript = [
            {
              id: 'init-1',
              role: 'system',
              text: `Resumed session: "${conv.title || 'Conversation'}"`,
              timestamp: getTimestamp()
            }
          ];
          
          threadCmds.forEach((cmd, idx) => {
            loadedTranscript.push({
              id: `cmd-u-${cmd.id || idx}`,
              role: 'user',
              text: cmd.transcript,
              timestamp: getTimestamp()
            });
            loadedTranscript.push({
              id: `cmd-s-${cmd.id || idx}`,
              role: 'system',
              text: cmd.result || `Action ${cmd.intent_tool || 'processed'}.`,
              tool: cmd.intent_tool,
              params: cmd.intent_params,
              commandId: cmd.id,
              timestamp: getTimestamp()
            });
          });
          
          setTranscript(loadedTranscript);
          setCurrentView('main');
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      {/* Top Chrome Header */}
      <header className="top-chrome">
        <div className="brand-mark">
          <div className={`brand-dot state-${orbState}`} aria-hidden="true" />
          <span>VOICEX // INTENT ENGINE</span>
        </div>

        <div className="chrome-actions">
          {/* Dev State Switcher */}
          {showDevPanel && (
            <div className="state-switcher" role="toolbar" aria-label="Orb State Switcher">
              <button
                className={`state-btn idle ${orbState === 'idle' ? 'active' : ''}`}
                onClick={() => handleManualStateChange('idle')}
                title="Set Orb to Idle"
              >
                IDLE
              </button>
              <button
                className={`state-btn listening ${orbState === 'listening' ? 'active' : ''}`}
                onClick={() => handleManualStateChange('listening')}
                title="Set Orb to Listening"
              >
                LISTEN
              </button>
              <button
                className={`state-btn thinking ${orbState === 'thinking' ? 'active' : ''}`}
                onClick={() => handleManualStateChange('thinking')}
                title="Set Orb to Thinking"
              >
                THINK
              </button>
              <button
                className={`state-btn error ${orbState === 'error' ? 'active' : ''}`}
                onClick={() => handleManualStateChange('error')}
                title="Set Orb to Error"
              >
                ERR
              </button>
            </div>
          )}

          <button
            className="icon-btn"
            onClick={() => createNewConversation(user.uid)}
            aria-label="New Chat"
            title="New Chat"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', width: 'auto', background: 'rgba(46, 111, 242, 0.15)', border: '1px solid #2E6FF2', color: '#E8ECF3' }}
          >
            <Plus size={14} color="#39FF8A" />
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>New Chat</span>
          </button>

          <button
            className="icon-btn"
            onClick={handleResetTranscript}
            aria-label="Reset transcript log"
            title="Reset transcript"
          >
            <RefreshCw size={15} />
          </button>

          <button
            className="icon-btn"
            onClick={() => setShowDevPanel(!showDevPanel)}
            aria-label="Toggle state toolbar"
            title="Toggle toolbar"
          >
            <Sliders size={15} />
          </button>

          <button
            className="icon-btn"
            onClick={() => setCurrentView('history')}
            aria-label="View history"
            title="View history"
          >
            <History size={15} />
          </button>

          <button
            className="icon-btn"
            onClick={() => signOut(auth)}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Main Focused Stage */}
      <main className="stage-container">
        <VoiceOrb
          state={orbState}
          onClick={toggleListening}
          onMicToggle={toggleListening}
          isVoiceSupported={isVoiceSupported}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted((prev) => !prev)}
        />

        <TranscriptConsole lines={transcript} />
      </main>

      {/* Bottom Third: Terminal Text Input */}
      <footer>
        <TextConsoleInput
          onSubmit={handleTextSubmit}
          disabled={orbState === 'thinking'}
        />
      </footer>
    </div>
  );
}
