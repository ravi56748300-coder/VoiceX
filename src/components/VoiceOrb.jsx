import React from 'react';
import { Mic, MicOff, AlertTriangle, Loader2, Volume2, VolumeX, AlertCircle } from 'lucide-react';

/**
 * VoiceOrb component with Web Speech integration indicators.
 * @param {Object} props
 * @param {'idle' | 'listening' | 'thinking' | 'error'} props.state
 * @param {Function} props.onClick - Toggles listening / active state
 * @param {Function} [props.onMicToggle] - Direct toggle for accessibility mic button
 * @param {boolean} [props.isVoiceSupported=true] - Whether browser supports SpeechRecognition
 * @param {boolean} [props.isMuted=false] - Speech synthesis mute state
 * @param {Function} [props.onToggleMute] - Handler for mute/unmute
 */
export function VoiceOrb({
  state = 'idle',
  onClick,
  onMicToggle,
  isVoiceSupported = true,
  isMuted = false,
  onToggleMute
}) {
  const getStatusLabel = () => {
    if (!isVoiceSupported) {
      return 'Voice Unsupported';
    }
    switch (state) {
      case 'listening':
        return 'Listening...';
      case 'thinking':
        return 'Processing...';
      case 'error':
        return 'Microphone / Voice Error';
      case 'idle':
      default:
        return 'Ready / Tap to speak';
    }
  };

  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isError = state === 'error';

  return (
    <div className="orb-section">
      <div className="orb-wrapper">
        {/* Mute/Unmute toggle button positioned top-right of orb area */}
        {onToggleMute && (
          <button
            className={`orb-mute-btn ${isMuted ? 'muted' : ''}`}
            onClick={onToggleMute}
            type="button"
            aria-label={isMuted ? 'Unmute voice output' : 'Mute voice output'}
            title={isMuted ? 'Voice output muted (Click to unmute)' : 'Voice output active (Click to mute)'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        )}

        <button
          className={`voice-orb-btn is-${state} ${!isVoiceSupported ? 'disabled' : ''}`}
          onClick={isVoiceSupported ? onClick : undefined}
          aria-label={
            isVoiceSupported
              ? `Voice Orb Assistant: ${getStatusLabel()}. Click to toggle microphone.`
              : 'Voice input not supported in this browser. Use terminal console.'
          }
          aria-pressed={isListening}
          aria-disabled={!isVoiceSupported}
          type="button"
          tabIndex={isVoiceSupported ? 0 : -1}
          style={{ cursor: isVoiceSupported ? 'pointer' : 'not-allowed' }}
        >
          {/* Main orb core sphere */}
          <div className={`orb-core state-${state}`} />

          {/* Sonar Ping Ring (Active during Listening) */}
          <div className="sonar-ring" aria-hidden="true" />

          {/* Rotating rim gradient ring (Active during Thinking) */}
          <div className="thinking-rim" aria-hidden="true" />
        </button>
      </div>

      {/* Status indicator label & Unsupported browser warning */}
      <div className="orb-status-container">
        <div className={`orb-status-text ${state}`}>
          <span>[</span>
          <span>{getStatusLabel()}</span>
          <span>]</span>
        </div>

        {!isVoiceSupported && (
          <div className="unsupported-notice">
            <AlertCircle size={13} />
            <span>Voice input isn't supported in this browser — use the console below</span>
          </div>
        )}

        {/* Accessibility mic button below orb */}
        <button
          className={`mic-control-btn ${isListening ? 'active' : ''} ${!isVoiceSupported ? 'disabled' : ''}`}
          onClick={isVoiceSupported ? (onMicToggle || onClick) : undefined}
          type="button"
          disabled={!isVoiceSupported}
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
        >
          {isListening ? (
            <>
              <Mic size={14} />
              <span>LISTENING</span>
            </>
          ) : isThinking ? (
            <>
              <Loader2 size={14} className="spin-icon" />
              <span>THINKING</span>
            </>
          ) : isError ? (
            <>
              <AlertTriangle size={14} />
              <span>RETRY VOICE</span>
            </>
          ) : (
            <>
              <MicOff size={14} />
              <span>{isVoiceSupported ? 'MIC OFF' : 'NO MIC API'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default VoiceOrb;
