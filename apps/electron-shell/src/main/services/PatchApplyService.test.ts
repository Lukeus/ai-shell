import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Proposal } from 'packages-api-contracts';
import { PatchApplyService } from './PatchApplyService';

describe('PatchApplyService', () => {
  let tempDir: string;
  let service: PatchApplyService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-apply-'));
    service = new PatchApplyService();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('applies file writes within the workspace', async () => {
    const proposal: Proposal = {
      writes: [{ path: 'src/file.txt', content: 'hello' }],
      summary: { filesChanged: 1 },
    };

    await service.applyProposal(proposal, tempDir);

    const content = fs.readFileSync(path.join(tempDir, 'src', 'file.txt'), 'utf-8');
    expect(content).toBe('hello');
  });

  it('applies unified diff patches', async () => {
    const targetPath = path.join(tempDir, 'file.txt');
    fs.writeFileSync(targetPath, 'hello\nworld\n', 'utf-8');

    const patch = [
      'diff --git a/file.txt b/file.txt',
      '--- a/file.txt',
      '+++ b/file.txt',
      '@@ -1,2 +1,2 @@',
      '-hello',
      '+hello there',
      ' world',
      '',
    ].join('\n');

    const proposal: Proposal = {
      writes: [],
      patch,
      summary: { filesChanged: 1 },
    };

    await service.applyProposal(proposal, tempDir);

    const content = fs.readFileSync(targetPath, 'utf-8');
    expect(content).toBe('hello there\nworld\n');
  });

  it('rejects writes outside the workspace', async () => {
    const proposal: Proposal = {
      writes: [{ path: '../escape.txt', content: 'nope' }],
      summary: { filesChanged: 1 },
    };

    await expect(service.applyProposal(proposal, tempDir)).rejects.toThrow(
      /outside workspace/i
    );
  });
});
