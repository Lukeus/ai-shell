import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { VirtualFs, type VfsMount } from './VirtualFs';

describe('VirtualFs', () => {
  let tempDir: string;
  let workspace: string;
  let runs: string;
  let vfs: VirtualFs;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vfs-test-'));
    workspace = path.join(tempDir, 'workspace');
    runs = path.join(tempDir, 'runs');

    fs.mkdirSync(workspace, { recursive: true });
    fs.mkdirSync(runs, { recursive: true });

    const mounts: VfsMount[] = [
      { mountPath: '/workspace', realPath: workspace, readonly: true },
      { mountPath: '/runs', realPath: runs, readonly: false },
    ];

    vfs = new VirtualFs(mounts, { maxFiles: 10, maxTotalSizeBytes: 1024, maxFileSizeBytes: 512 });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('lists mounts', () => {
    const mounts = vfs.listMounts();
    expect(mounts).toHaveLength(2);
    expect(mounts[0].mountPath).toBe('/workspace');
    expect(mounts[1].mountPath).toBe('/runs');
  });

  it('lists directory contents', () => {
    fs.writeFileSync(path.join(workspace, 'file1.txt'), 'content');
    fs.writeFileSync(path.join(workspace, 'file2.txt'), 'content');

    const entries = vfs.ls('/workspace');
    expect(entries).toContain('file1.txt');
    expect(entries).toContain('file2.txt');
  });

  it('reads file contents', () => {
    fs.writeFileSync(path.join(workspace, 'test.txt'), 'hello world');

    const content = vfs.read('/workspace/test.txt');
    expect(content).toBe('hello world');
  });

  it('writes file contents to writable mount', () => {
    vfs.write('/runs/output.txt', 'result');

    const content = fs.readFileSync(path.join(runs, 'output.txt'), 'utf-8');
    expect(content).toBe('result');
  });

  it('rejects writes to readonly mount', () => {
    expect(() => vfs.write('/workspace/new.txt', 'data')).toThrow('read-only');
  });

  it('enforces mount boundaries', () => {
    // Create a file to try path traversal
    fs.writeFileSync(path.join(workspace, 'test.txt'), 'content');
    // Try to escape using path traversal within the mount
    expect(() => vfs.read('/workspace/subdir/../../../escape.txt')).toThrow();
  });

  it('rejects paths outside mounts', () => {
    expect(() => vfs.read('/other/file.txt')).toThrow('outside mounts');
  });

  it('enforces file size quota', () => {
    const largeContent = 'x'.repeat(600);
    expect(() => vfs.write('/runs/large.txt', largeContent)).toThrow('exceeds max file size');
  });

  it('enforces total size quota', () => {
    vfs.write('/runs/file1.txt', 'a'.repeat(400));
    vfs.write('/runs/file2.txt', 'b'.repeat(400));
    expect(() => vfs.write('/runs/file3.txt', 'c'.repeat(400))).toThrow('total size limit');
  });

  it('enforces max files quota', () => {
    for (let i = 0; i < 10; i++) {
      vfs.write(`/runs/file${i}.txt`, `content${i}`);
    }

    expect(() => vfs.write('/runs/file11.txt', 'overflow')).toThrow('max files limit');
  });

  it('edits file with replacements', () => {
    fs.writeFileSync(path.join(workspace, 'template.txt'), 'Hello NAME, welcome!');
    fs.chmodSync(path.join(workspace, 'template.txt'), 0o666);

    // Copy to writable mount for edit test
    const content = vfs.read('/workspace/template.txt');
    vfs.write('/runs/template.txt', content);

    vfs.edit('/runs/template.txt', [{ search: 'NAME', replace: 'Alice' }]);

    const edited = vfs.read('/runs/template.txt');
    expect(edited).toBe('Hello Alice, welcome!');
  });

  it('globs files by pattern', () => {
    fs.writeFileSync(path.join(workspace, 'test1.ts'), 'code');
    fs.writeFileSync(path.join(workspace, 'test2.ts'), 'code');
    fs.writeFileSync(path.join(workspace, 'readme.md'), 'docs');

    const results = vfs.glob('/workspace/*.ts', '/workspace');
    expect(results).toHaveLength(2);
    expect(results).toContain('/workspace/test1.ts');
    expect(results).toContain('/workspace/test2.ts');
  });

  it('greps files by pattern', () => {
    fs.writeFileSync(path.join(workspace, 'file1.txt'), 'foo bar\nbaz');
    fs.writeFileSync(path.join(workspace, 'file2.txt'), 'hello foo\nworld');

    const results = vfs.grep('foo', '/workspace');
    expect(results).toHaveLength(2);
    expect(results[0].file).toBe('/workspace/file1.txt');
    expect(results[0].line).toBe(1);
    expect(results[0].text).toBe('foo bar');
    expect(results[1].file).toBe('/workspace/file2.txt');
    expect(results[1].line).toBe(1);
    expect(results[1].text).toBe('hello foo');
  });

  it('calculates stats for mount', () => {
    fs.writeFileSync(path.join(runs, 'a.txt'), 'aaa');
    fs.writeFileSync(path.join(runs, 'b.txt'), 'bb');

    const stats = vfs.getStats('/runs');
    expect(stats.fileCount).toBe(2);
    expect(stats.totalSizeBytes).toBe(5);
  });
});
