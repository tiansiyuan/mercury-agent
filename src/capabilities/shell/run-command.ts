import { tool } from 'ai';
import { z } from 'zod';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { PermissionManager } from '../permissions.js';
import { logger } from '../../utils/logger.js';

export function createRunCommandTool(permissions: PermissionManager) {
  return tool({
    description: `Run a shell command. Commands run in the current working directory unless an absolute path is given.
Blocked commands (sudo, rm -rf /, etc.) are never executed.
Auto-approved commands (ls, cat, git status, curl, etc.) run without asking.
Other commands require user approval — tell the user what command you want to run and ask for confirmation. If they say "yes", try again. If they say "always", use the approve_command tool.`,
    parameters: z.object({
      command: z.string().describe('The shell command to execute'),
    }),
    execute: async ({ command }) => {
      const check = await permissions.checkShellCommand(command);
      if (!check.allowed) {
        if (check.needsApproval) {
          const baseCmd = command.trim().split(/\s+/)[0];
          permissions.addPendingApproval(baseCmd);
          return `⚠ Command requires approval: ${command}\n\nTell the user what this command does and ask for permission. If they approve, try running it again. If they say "always", use the approve_command tool to permanently approve this command type.`;
        }
        return `Error: ${check.reason}`;
      }

      try {
        logger.info({ cmd: command }, 'Executing shell command');
        const result = execSync(command, {
          cwd: process.cwd(),
          timeout: 30000,
          maxBuffer: 1024 * 1024,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        const output = result?.trim() || '(no output)';
        return output;
      } catch (err: any) {
        const stderr = err.stderr?.trim();
        const stdout = err.stdout?.trim();
        let msg = `Command exited with code ${err.status || 'unknown'}`;
        if (stdout) msg += `\nOutput: ${stdout}`;
        if (stderr) msg += `\nError: ${stderr}`;
        return msg;
      }
    },
  });
}