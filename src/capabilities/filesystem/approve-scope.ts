import { tool } from 'ai';
import { z } from 'zod';
import { resolve } from 'node:path';
import type { PermissionManager } from '../permissions.js';

export function createApproveScopeTool(permissions: PermissionManager) {
  return tool({
    description: 'Request user approval to add a directory to the allowed filesystem scopes. Use this when a file operation fails due to scope permissions. The user will see an approval prompt (inline keyboard on Telegram, readline on CLI). If approved, the scope is added permanently.',
    parameters: z.object({
      path: z.string().describe('The directory path to add to allowed scopes'),
      mode: z.enum(['read', 'write']).describe('The access mode needed'),
    }),
    execute: async ({ path, mode }) => {
      const resolved = resolve(path);
      const result = await permissions.requestScopeExternal(resolved, mode);
      if (result.allowed) {
        return `Access approved for ${mode} access to ${resolved}`;
      }
      return `Access denied for ${mode} access to ${resolved}`;
    },
  });
}