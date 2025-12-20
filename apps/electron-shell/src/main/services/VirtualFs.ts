import * as fs from 'fs';
import * as path from 'path';
import { minimatch } from 'minimatch';

export type VfsMount = {
  mountPath: string;
  realPath: string;
  readonly: boolean;
};

export type VfsQuotas = {
  maxFiles: number;
  maxTotalSizeBytes: number;
  maxFileSizeBytes: number;
};

export type VfsStats = {
  fileCount: number;
  totalSizeBytes: number;
};

const DEFAULT_QUOTAS: VfsQuotas = {
  maxFiles: 1000,
  maxTotalSizeBytes: 100 * 1024 * 1024, // 100MB
  maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
};

/**
 * VirtualFS - sandboxed filesystem for agent operations.
 * 
 * Security: all paths validated against mount boundaries (P1: Process isolation).
 * Quotas prevent unbounded growth (P2: Security defaults).
 */
export class VirtualFs {
  private readonly mounts: VfsMount[];
  private readonly quotas: VfsQuotas;

  constructor(mounts: VfsMount[], quotas?: Partial<VfsQuotas>) {
    this.mounts = mounts;
    this.quotas = { ...DEFAULT_QUOTAS, ...quotas };
  }

  public listMounts(): VfsMount[] {
    return [...this.mounts];
  }

  public getStats(mountPath: string): VfsStats {
    const mount = this.findMount(mountPath);
    if (!mount) {
      throw new Error(`Mount not found: ${mountPath}`);
    }

    return this.calculateStats(mount.realPath);
  }

  public ls(vfsPath: string): string[] {
    const realPath = this.resolveAndValidate(vfsPath);
    if (!fs.existsSync(realPath)) {
      throw new Error(`Path not found: ${vfsPath}`);
    }

    const stat = fs.statSync(realPath);
    if (!stat.isDirectory()) {
      throw new Error(`Not a directory: ${vfsPath}`);
    }

    return fs.readdirSync(realPath);
  }

  public read(vfsPath: string): string {
    const realPath = this.resolveAndValidate(vfsPath);
    if (!fs.existsSync(realPath)) {
      throw new Error(`File not found: ${vfsPath}`);
    }

    const stat = fs.statSync(realPath);
    if (!stat.isFile()) {
      throw new Error(`Not a file: ${vfsPath}`);
    }

    if (stat.size > this.quotas.maxFileSizeBytes) {
      throw new Error(`File too large: ${vfsPath}`);
    }

    return fs.readFileSync(realPath, 'utf-8');
  }

  public write(vfsPath: string, content: string): void {
    const realPath = this.resolveAndValidate(vfsPath, { mustExist: false });
    const mount = this.findMountForPath(vfsPath);
    if (!mount) {
      throw new Error(`No mount for path: ${vfsPath}`);
    }

    if (mount.readonly) {
      throw new Error(`Mount is read-only: ${mount.mountPath}`);
    }

    const contentBytes = Buffer.byteLength(content, 'utf-8');
    if (contentBytes > this.quotas.maxFileSizeBytes) {
      throw new Error(`Content exceeds max file size`);
    }

    const stats = this.calculateStats(mount.realPath);
    const existingSize = fs.existsSync(realPath) ? fs.statSync(realPath).size : 0;
    const newTotalSize = stats.totalSizeBytes - existingSize + contentBytes;

    if (newTotalSize > this.quotas.maxTotalSizeBytes) {
      throw new Error(`Quota exceeded: total size limit`);
    }

    if (!fs.existsSync(realPath) && stats.fileCount >= this.quotas.maxFiles) {
      throw new Error(`Quota exceeded: max files limit`);
    }

    const dir = path.dirname(realPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(realPath, content, 'utf-8');
  }

  public edit(vfsPath: string, replacements: Array<{ search: string; replace: string }>): void {
    const content = this.read(vfsPath);
    let updated = content;

    for (const { search, replace } of replacements) {
      updated = updated.replace(new RegExp(search, 'g'), replace);
    }

    this.write(vfsPath, updated);
  }

  public glob(pattern: string, mountPath: string): string[] {
    const mount = this.findMount(mountPath);
    if (!mount) {
      throw new Error(`Mount not found: ${mountPath}`);
    }

    const results: string[] = [];
    const traverse = (dir: string): void => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(mount.realPath, fullPath);
        const vfsPath = path.posix.join(mountPath, relativePath.replace(/\\/g, '/'));

        if (entry.isFile() && minimatch(vfsPath, pattern)) {
          results.push(vfsPath);
        }

        if (entry.isDirectory() && results.length < this.quotas.maxFiles) {
          traverse(fullPath);
        }
      }
    };

    traverse(mount.realPath);
    return results.slice(0, this.quotas.maxFiles);
  }

  public grep(pattern: string, mountPath: string): Array<{ file: string; line: number; text: string }> {
    const mount = this.findMount(mountPath);
    if (!mount) {
      throw new Error(`Mount not found: ${mountPath}`);
    }

    const regex = new RegExp(pattern);
    const results: Array<{ file: string; line: number; text: string }> = [];

    const traverse = (dir: string): void => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(mount.realPath, fullPath);
        const vfsPath = path.posix.join(mountPath, relativePath.replace(/\\/g, '/'));

        if (entry.isFile()) {
          try {
            const stat = fs.statSync(fullPath);
            if (stat.size <= this.quotas.maxFileSizeBytes) {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const lines = content.split('\n');

              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  results.push({ file: vfsPath, line: i + 1, text: lines[i] });
                }
              }
            }
          } catch {
            // Skip unreadable files
          }
        }

        if (entry.isDirectory() && results.length < 1000) {
          traverse(fullPath);
        }
      }
    };

    traverse(mount.realPath);
    return results.slice(0, 1000);
  }

  private findMount(mountPath: string): VfsMount | undefined {
    return this.mounts.find((m) => m.mountPath === mountPath);
  }

  private findMountForPath(vfsPath: string): VfsMount | undefined {
    const normalized = path.posix.normalize(vfsPath);
    for (const mount of this.mounts) {
      if (normalized.startsWith(mount.mountPath + '/') || normalized === mount.mountPath) {
        return mount;
      }
    }
    return undefined;
  }

  private resolveAndValidate(vfsPath: string, options?: { mustExist?: boolean }): string {
    const mustExist = options?.mustExist ?? true;
    const mount = this.findMountForPath(vfsPath);
    if (!mount) {
      throw new Error(`Path outside mounts: ${vfsPath}`);
    }

    const normalized = path.posix.normalize(vfsPath);
    const relative = normalized.slice(mount.mountPath.length);
    const realPath = path.join(mount.realPath, relative);
    const resolved = path.resolve(realPath);

    // Validate path is within mount boundary
    if (!resolved.startsWith(path.resolve(mount.realPath))) {
      throw new Error(`Path escapes mount boundary: ${vfsPath}`);
    }

    if (mustExist && !fs.existsSync(resolved)) {
      throw new Error(`Path not found: ${vfsPath}`);
    }

    return resolved;
  }

  private calculateStats(realPath: string): VfsStats {
    let fileCount = 0;
    let totalSizeBytes = 0;

    const traverse = (dir: string): void => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isFile()) {
            fileCount++;
            const stat = fs.statSync(fullPath);
            totalSizeBytes += stat.size;
          } else if (entry.isDirectory()) {
            traverse(fullPath);
          }
        }
      } catch {
        // Skip unreadable directories
      }
    };

    if (fs.existsSync(realPath)) {
      const stat = fs.statSync(realPath);
      if (stat.isDirectory()) {
        traverse(realPath);
      } else {
        fileCount = 1;
        totalSizeBytes = stat.size;
      }
    }

    return { fileCount, totalSizeBytes };
  }
}
