/**
 * Git operations for rotation-engine codebase
 */

export interface GitResult {
  output?: string;
  error?: string;
}

export async function executeGitCommand(
  command: string,
  options: Record<string, any>,
  engineRoot: string
): Promise<GitResult> {
  try {
    let args: string[] = [];

    switch (command) {
      case 'status':
        args = ['status', '--short'];
        break;
      
      case 'diff':
        args = ['diff'];
        if (options.staged) args.push('--cached');
        if (options.path) args.push(options.path);
        break;
      
      case 'log':
        args = ['log', `--max-count=${options.limit || 10}`, '--oneline', '--decorate'];
        if (options.path) args.push(options.path);
        break;
      
      case 'commit':
        args = ['commit', '-m', options.message];
        break;
      
      case 'add':
        args = ['add'];
        if (options.path) {
          args.push(options.path);
        } else {
          args.push('.');
        }
        break;
      
      case 'branch':
        args = ['branch'];
        if (options.list) args.push('-a');
        break;
      
      default:
        return { error: `Unknown git command: ${command}` };
    }

    const process = new Deno.Command('git', {
      args,
      cwd: engineRoot,
      stdout: 'piped',
      stderr: 'piped'
    });

    const { code, stdout, stderr } = await process.output();
    const output = new TextDecoder().decode(stdout);
    const errorOutput = new TextDecoder().decode(stderr);

    if (code !== 0) {
      return { error: `Git command failed: ${errorOutput || 'Unknown error'}` };
    }

    return { output: output || errorOutput };
  } catch (error) {
    return { error: `Git operation failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}
