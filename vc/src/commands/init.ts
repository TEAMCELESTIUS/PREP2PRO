import { Repository } from '../core/repository';

export function init(repoPath: string): void {
  new Repository(repoPath);
  console.log(`Initialized empty VCEdit repository in ${repoPath}`);
}