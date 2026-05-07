jest.mock('execa', () => ({
  __esModule: true,
  execa: jest.fn(),
}));

jest.mock('fs-extra', () => ({
  __esModule: true,
  default: {
    pathExists: jest.fn(),
  },
}));

import path from 'path';
import fs from 'fs-extra';
import { execa } from 'execa';
import { runContextForAi } from '../context-for-ai.js';

const mockPathExists = fs.pathExists as jest.MockedFunction<typeof fs.pathExists>;
const mockExeca = execa as jest.MockedFunction<typeof execa>;

describe('runContextForAi', () => {
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  it('throws when the source path does not exist', async () => {
    mockPathExists.mockResolvedValue(false);

    await expect(runContextForAi('/proj', 'src')).rejects.toThrow('Path does not exist');
    expect(mockExeca).not.toHaveBeenCalled();
  });

  it('runs npx jscodeshift with the bundled transform when the source exists', async () => {
    const projectRoot = path.resolve('/tmp', 'pfcli-context-ai-proj');
    const srcDir = path.join(projectRoot, 'src');
    mockPathExists.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.includes('transform.js')) return Promise.resolve(true);
      if (p === srcDir) return Promise.resolve(true);
      return Promise.resolve(false);
    });

    await runContextForAi(projectRoot, 'src');

    expect(mockExeca).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = mockExeca.mock.calls[0];
    expect(cmd).toBe('npx');
    expect(args?.[0]).toBe('jscodeshift');
    expect(args?.[1]).toBe('-t');
    expect(args?.[2]).toContain('transform.js');
    expect(args).toContain('--extensions=ts,tsx,js,jsx');
    expect(args).toContain('--parser=tsx');
    expect(args?.[args.length - 1]).toBe(srcDir);
    expect(opts).toMatchObject({ cwd: projectRoot, stdio: 'inherit' });
  });

  it('passes --dry to jscodeshift when dry is true', async () => {
    const projectRoot = path.resolve('/tmp', 'pfcli-context-ai-dry');
    const srcDir = path.join(projectRoot, 'components');
    mockPathExists.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.includes('transform.js')) return Promise.resolve(true);
      if (p === srcDir) return Promise.resolve(true);
      return Promise.resolve(false);
    });

    await runContextForAi(projectRoot, 'components', { dry: true });

    const args = mockExeca.mock.calls[0][1] as string[];
    expect(args).toContain('--dry');
  });
});
