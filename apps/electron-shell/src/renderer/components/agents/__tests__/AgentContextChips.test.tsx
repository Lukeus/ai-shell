import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentContextChips } from '../AgentContextChips';
import type { AgentContextAttachment } from 'packages-api-contracts';

describe('AgentContextChips', () => {
  it('renders attachment labels and ranges', () => {
    const attachments: AgentContextAttachment[] = [
      {
        kind: 'file',
        filePath: '/repo/src/file.ts',
      },
      {
        kind: 'selection',
        filePath: 'C:\\repo\\index.ts',
        range: {
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 2,
          endColumn: 3,
        },
      },
    ];

    render(<AgentContextChips attachments={attachments} />);

    expect(screen.getByText('file')).toBeInTheDocument();
    expect(screen.getByText('selection')).toBeInTheDocument();
    expect(screen.getByText('file.ts')).toBeInTheDocument();
    expect(screen.getByText('index.ts (L1:1-L2:3)')).toBeInTheDocument();
  });

  it('removes attachments by index', () => {
    const attachments: AgentContextAttachment[] = [
      { kind: 'file', filePath: '/repo/src/a.ts' },
      { kind: 'file', filePath: '/repo/src/b.ts' },
    ];
    const onRemove = vi.fn();

    render(<AgentContextChips attachments={attachments} onRemove={onRemove} />);

    const removeButtons = screen.getAllByLabelText('Remove attachment');
    fireEvent.click(removeButtons[1]);

    expect(onRemove).toHaveBeenCalledWith(1);
  });
});
