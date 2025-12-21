declare module 'node-pty' {
  export interface IPty {
    onData(callback: (data: string) => void): void;
    onExit(callback: (event: { exitCode: number }) => void): void;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    kill(signal?: string): void;
  }

  export type SpawnOptions = {
    name?: string;
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string | undefined>;
  };

  export function spawn(
    file: string,
    args: string[],
    options: SpawnOptions
  ): IPty;
}
