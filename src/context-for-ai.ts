import path from 'node:path';
import { createRequire } from 'node:module';
import fs from 'fs-extra';
import { execa } from 'execa';

export type RunContextForAiOptions = {
  dry?: boolean;
};

/**
 * Resolves the patternfly-cli install root (directory containing package.json).
 * Uses the invoked CLI path when possible; under Jest, falls back to cwd (repo root).
 */
function getPatternflyCliPackageRoot(): string {
  const invoked = process.argv[1];
  if (invoked) {
    const normalized = path.resolve(invoked);
    const distCliSuffix = `${path.sep}dist${path.sep}cli.js`;
    if (normalized.endsWith(distCliSuffix)) {
      return path.resolve(path.dirname(normalized), '..');
    }
  }
  if (process.env['JEST_WORKER_ID'] !== undefined) {
    return process.cwd();
  }
  throw new Error(
    'Unable to locate patternfly-cli package root. Run the context-for-ai command via patternfly-cli or pfcli.',
  );
}

function getCodemodTransformPath(): string {
  const cliRoot = getPatternflyCliPackageRoot();
  const importMetaRequire = createRequire(path.join(cliRoot, 'package.json'));
  const pkgJsonPath = importMetaRequire.resolve('@patternfly/context-for-ai/package.json');
  return path.join(path.dirname(pkgJsonPath), 'codemod', 'transform.js');
}

/**
 * Runs the @patternfly/context-for-ai jscodeshift codemod on a source path
 * (directory or file) under the given project root.
 *
 * @see https://github.com/patternfly/context-for-ai
 */
export async function runContextForAi(
  projectRoot: string,
  sourcePath: string,
  options: RunContextForAiOptions = {},
): Promise<void> {
  const root = path.resolve(projectRoot);
  const resolvedSource = path.isAbsolute(sourcePath)
    ? sourcePath
    : path.resolve(root, sourcePath);

  if (!(await fs.pathExists(resolvedSource))) {
    throw new Error(`Path does not exist: ${resolvedSource}`);
  }

  const transformPath = getCodemodTransformPath();
  if (!(await fs.pathExists(transformPath))) {
    throw new Error(
      `Codemod transform not found at ${transformPath}. Try reinstalling patternfly-cli.`,
    );
  }

  const args: string[] = [
    'jscodeshift',
    '-t',
    transformPath,
    '--extensions=ts,tsx,js,jsx',
    '--parser=tsx',
  ];
  if (options.dry) {
    args.push('--dry');
  }
  args.push(resolvedSource);

  console.log(`Running @patternfly/context-for-ai codemod on ${resolvedSource}...\n`);
  await execa('npx', args, { cwd: root, stdio: 'inherit' });
}
