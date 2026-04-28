import path from 'node:path';
import type { ApprovalGrant, ApprovalRequest, ApprovalScope } from '../../shared/domain.js';

export function grantMatchesRequest(grant: ApprovalGrant, request: ApprovalRequest): boolean {
  if (grant.runId !== request.runId) return false;
  return scopeIncludes(grant.scope, request.scope);
}

export function findMatchingGrant(grants: ApprovalGrant[], request: ApprovalRequest): ApprovalGrant | null {
  return grants.find((grant) => grantMatchesRequest(grant, request)) ?? null;
}

function scopeIncludes(grant: ApprovalScope, request: ApprovalScope): boolean {
  if (grant.kind === request.kind) {
    if (grant.kind === 'read_workspace') return true;
    if (grant.kind === 'install_dependencies') return true;
    if (grant.kind === 'network') return true;
    if (grant.kind === 'git_commit') return true;
    if (grant.kind === 'git_push') return true;
    if (grant.kind === 'command_exact' && request.kind === 'command_exact') return grant.command === request.command;
    if (grant.kind === 'command_category' && request.kind === 'command_category') return grant.category === request.category;
    if (grant.kind === 'edit_folder' && request.kind === 'edit_folder') return sameOrInside(request.path, grant.path);
    if (grant.kind === 'edit_files' && request.kind === 'edit_files') {
      return request.paths.every((requestedPath) =>
        grant.paths.some((grantedPath) => samePath(requestedPath, grantedPath))
      );
    }
  }

  if (grant.kind === 'edit_folder' && request.kind === 'edit_files') {
    return request.paths.every((requestedPath) => sameOrInside(requestedPath, grant.path));
  }

  return false;
}

function samePath(leftPath: string, rightPath: string): boolean {
  return normalizePath(leftPath) === normalizePath(rightPath);
}

function sameOrInside(childPath: string, parentPath: string): boolean {
  const normalizedChild = normalizePath(childPath);
  const normalizedParent = normalizePath(parentPath);

  return normalizedChild === normalizedParent || normalizedChild.startsWith(`${normalizedParent}${path.sep}`);
}

function normalizePath(value: string): string {
  return path.resolve(value).toLowerCase();
}
