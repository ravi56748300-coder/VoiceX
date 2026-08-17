import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

/**
 * TextConsoleInput is the fallback text input console formatted as a terminal prompt.
 * @param {Object} props
 * @param {Function} [props.onSubmit] - Triggered when user submits a text command
 * @param {Function} [props.onSendMessage] - Alias for onSubmit
 * @param {boolean} [props.disabled] - Disables input while assistant is processing
 * @param {boolean} [props.isProcessing] - Alias for disabled
 */
export function TextConsoleInput({ onSubmit, onSendMessage, disabled = false, isProcessing = false }) {
  const [value, setValue] = useState('');
  const isDisabled = Boolean(disabled || isProcessing);
  const submitHandler = onSubmit || onSendMessage;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim() || isDisabled || !submitHandler) return;
    submitHandler(value.trim());
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
