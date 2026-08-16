import React, { useState } from 'react';
import { ArrowRight, CornerDownLeft } from 'lucide-react';

/**
 * TextConsoleInput is the fallback text input console formatted as a terminal prompt.
 * @param {Object} props
 * @param {Function} props.onSubmit - Triggered when user submits a text command
 * @param {boolean} [props.disabled] - Disables input while assistant is processing
 */
export function TextConsoleInput({ onSubmit, onSendMessage, disabled = false, isProcessing = false }) {
  const [value, setValue] = useState('');
  const isDisabled = Boolean(disabled || isProcessing);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;
    const sendFn = onSubmit || onSendMessage;
    if (typeof sendFn === 'function') {
      sendFn(trimmed);
    }
    setValue('');
  };

  return (
    <div className="input-console-wrapper">
      <form className="terminal-input-form" onSubmit={handleSubmit}>
        <span className="prompt-prefix" aria-hidden="true">&gt;</span>
        <input
          type="text"
          className="terminal-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={isDisabled ? 'Processing command...' : 'Type a command or query...'}
          disabled={isDisabled}
          aria-label="Terminal prompt command input"
          autoComplete="off"
          spellCheck="false"
        />
        <button
          type="submit"
          className="send-btn"
          disabled={!value.trim() || isDisabled}
          aria-label="Send command"
          title="Send command (Enter)"
        >
          <ArrowRight size={18} />
        </button>
      </form>
      <div className="console-footer-hint">
        <span>VOICE-NATIVE SHELL v1.0.0</span>
        <span>Press <kbd className="key-badge">Enter</kbd> to execute • <kbd className="key-badge">Space</kbd> on Orb to talk</span>
      </div>
    </div>
  );
}

export default TextConsoleInput;
