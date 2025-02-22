import { Repository } from '../core/repository';

export function commit(repoPath: string, message: string): void {
  const repo = new Repository(repoPath);
  const commitSha = repo.commit(message);
  console.log(`Committed changes with SHA: ${commitSha}`);
}