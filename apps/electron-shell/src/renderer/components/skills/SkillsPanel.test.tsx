import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SkillsPanel } from './SkillsPanel';

const mockGetCurrentWorkspace = vi.fn();
const mockListSkills = vi.fn();
const mockCreateSkill = vi.fn();
const mockUpdateSkill = vi.fn();
const mockDeleteSkill = vi.fn();
const mockSetEnabled = vi.fn();
const mockSetDefault = vi.fn();
const mockSetLastUsed = vi.fn();

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();

  (globalThis as any).window = (globalThis as any).window || {};
  (window as any).api = {
    workspace: {
      getCurrent: mockGetCurrentWorkspace,
    },
    skills: {
      list: mockListSkills,
      create: mockCreateSkill,
      update: mockUpdateSkill,
      delete: mockDeleteSkill,
      setEnabled: mockSetEnabled,
      setDefault: mockSetDefault,
      setLastUsed: mockSetLastUsed,
    },
  };

  mockGetCurrentWorkspace.mockResolvedValue(null);

  mockListSkills.mockResolvedValue({
    skills: [
      {
        definition: {
          id: 'skill.reviewer',
          name: 'Reviewer',
          description: 'Reviews implementation details',
        },
        source: 'user',
        scope: 'global',
        enabled: true,
      },
    ],
    preferences: {
      defaultSkillId: 'skill.reviewer',
      lastUsedSkillId: null,
    },
  });

  mockCreateSkill.mockResolvedValue({
    skill: {
      definition: {
        id: 'skill.writer',
        name: 'Writer',
      },
      source: 'user',
      scope: 'global',
      enabled: true,
    },
  });

  mockUpdateSkill.mockResolvedValue(undefined);
  mockDeleteSkill.mockResolvedValue({ success: true });
  mockSetEnabled.mockResolvedValue(undefined);
  mockSetDefault.mockResolvedValue({
    preferences: { defaultSkillId: 'skill.reviewer', lastUsedSkillId: null },
  });
  mockSetLastUsed.mockResolvedValue({
    preferences: { defaultSkillId: 'skill.reviewer', lastUsedSkillId: 'skill.reviewer' },
  });
});

describe('SkillsPanel', () => {
  it('loads and displays skills with default indicator', async () => {
    render(<SkillsPanel />);

    await waitFor(() => {
      expect(mockListSkills).toHaveBeenCalledWith({ scope: 'global' });
    });

    expect(await screen.findByText('Reviewer (skill.reviewer)')).toBeInTheDocument();
    expect(await screen.findByText('Default')).toBeInTheDocument();
  });

  it('creates a new skill in the active scope', async () => {
    render(<SkillsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Reviewer (skill.reviewer)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'New skill' }));

    fireEvent.change(screen.getByLabelText('Skill ID'), {
      target: { value: 'skill.writer' },
    });
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Writer' },
    });
    fireEvent.change(screen.getByLabelText('Tool Allowlist (comma separated)'), {
      target: { value: 'repo.search, workspace.read' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockCreateSkill).toHaveBeenCalledWith({
        scope: 'global',
        skill: {
          id: 'skill.writer',
          name: 'Writer',
          toolAllowlist: ['repo.search', 'workspace.read'],
        },
      });
    });
  });
});
