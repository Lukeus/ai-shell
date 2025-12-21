import React, { useState, useEffect, useRef } from 'react';

/**
 * InlineInput - Reusable input component for inline editing (new file/folder, rename).
 * 
 * Features:
 * - Enter key commits the input
 * - Escape key cancels
 * - Auto-focus on mount
 * - Validates filename (non-empty, no path separators)
 * 
 * P1 (Process isolation): Pure UI component, no Node.js access
 * P4 (UI design): Uses Tailwind 4 tokens for styling
 */

export interface InlineInputProps {
  /** Initial value for the input */
  initialValue?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Called when Enter is pressed with non-empty, valid value */
  onCommit: (value: string) => void;
  /** Called when Escape is pressed or input loses focus without committing */
  onCancel: () => void;
  /** Optional custom validation (returns error message or null if valid) */
  validate?: (value: string) => string | null;
}

/**
 * Validates filename for filesystem operations.
 * 
 * @param filename - The filename to validate
 * @returns Error message if invalid, null if valid
 */
function validateFilename(filename: string): string | null {
  if (!filename || filename.trim().length === 0) {
    return 'Filename cannot be empty';
  }

  // Check for path separators (disallow slashes and backslashes)
  if (filename.includes('/') || filename.includes('\\')) {
    return 'Filename cannot contain path separators';
  }

  // Check for null bytes
  if (filename.includes('\0')) {
    return 'Filename cannot contain null characters';
  }

  // Check for control characters (ASCII 0-31)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F]/.test(filename)) {
    return 'Filename cannot contain control characters';
  }

  // Check max length (255 is common filesystem limit)
  if (filename.length > 255) {
    return 'Filename too long (max 255 characters)';
  }

  return null;
}

export function InlineInput({
  initialValue = '',
  placeholder = 'Enter name...',
  onCommit,
  onCancel,
  validate,
}: InlineInputProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line no-undef
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  // eslint-disable-next-line no-undef
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();

      const trimmedValue = value.trim();

      // Validate filename
      const filenameError = validateFilename(trimmedValue);
      if (filenameError) {
        setError(filenameError);
        return;
      }

      // Custom validation
      if (validate) {
        const customError = validate(trimmedValue);
        if (customError) {
          setError(customError);
          return;
        }
      }

      // Commit
      onCommit(trimmedValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (error) {
      // Clear error on any other key press
      setError(null);
    }
  };

  const handleBlur = () => {
    // Cancel if focus lost without committing
    onCancel();
  };

  return (
    <div className="px-2 py-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`
          w-full px-2 py-1 text-md rounded
          bg-[var(--input-bg)] 
          text-[var(--input-fg)]
          border border-[var(--input-border)]
          focus:border-[var(--focus-border)]
          focus:outline-none
          ${error ? 'border-[var(--error-fg)]' : ''}
        `}
        aria-invalid={!!error}
        aria-describedby={error ? 'inline-input-error' : undefined}
      />
      {error && (
        <div
          id="inline-input-error"
          className="mt-1 text-md text-[var(--error-fg)]"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}
