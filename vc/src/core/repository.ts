import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class Repository {
  private path: string;
  private vceditDir: string;
  private objectsDir: string;
  private refsDir: string;
  private headPath: string;

  constructor(repoPath: string) {
    this.path = repoPath;
    this.vceditDir = path.join(repoPath, '.vcedit');
    this.objectsDir = path.join(this.vceditDir, 'objects');
    this.refsDir = path.join(this.vceditDir, 'refs');
    this.headPath = path.join(this.vceditDir, 'HEAD');

    if (!fs.existsSync(this.vceditDir)) {
      fs.mkdirSync(this.vceditDir, { recursive: true });
      fs.mkdirSync(this.objectsDir, { recursive: true });
      fs.mkdirSync(this.refsDir, { recursive: true });
      fs.writeFileSync(this.headPath, 'ref: refs/heads/main');
    }
  }

  private hashObject(data: string): string {
    const sha = crypto.createHash('sha1').update(data).digest('hex');
    fs.writeFileSync(path.join(this.objectsDir, sha), data);
    return sha;
  }

  public commit(message: string): string {
    const projectData = this.serializeProject(); // Implement this
    const commitData = {
      message,
      project: this.hashObject(projectData),
      parent: this.getHeadCommit(),
    };
    const commitJson = JSON.stringify(commitData);
    const commitSha = this.hashObject(commitJson);

    // Update HEAD
    fs.writeFileSync(this.headPath, commitSha);
    return commitSha;
  }

  private getHeadCommit(): string | null {
    if (fs.existsSync(this.headPath)) {
      return fs.readFileSync(this.headPath, 'utf-8').trim();
    }
    return null;
  }

  private serializeProject(): string {
    // Serialize State
    return JSON.stringify({ files: [] });
  }

  public createBranch(branchName: string): void {
    const branchPath = path.join(this.refsDir, 'heads', branchName);
    fs.writeFileSync(branchPath, this.getHeadCommit() || '');
  }

  public checkout(branchName: string): void {
    const branchPath = path.join(this.refsDir, 'heads', branchName);
    if (!fs.existsSync(branchPath)) {
      throw new Error(`Branch ${branchName} does not exist`);
    }
    const commitSha = fs.readFileSync(branchPath, 'utf-8').trim();
    fs.writeFileSync(this.headPath, commitSha);
  }

  public diff(commit1: string, commit2: string): string {
    const project1 = this.loadProject(commit1); // Implement this
    const project2 = this.loadProject(commit2); // Implement this
    return this.computeDiff(project1, project2); // Implement this
  }

  private loadProject(commitSha: string): any {
    const commitPath = path.join(this.objectsDir, commitSha);
    if (!fs.existsSync(commitPath)) {
      throw new Error(`Commit ${commitSha} does not exist`);
    }
    const commitData = fs.readFileSync(commitPath, 'utf-8');
    return JSON.parse(commitData);
  }

  private computeDiff(project1: any, project2: any): string {
    // Implement a basic diff algorithm
    return 'Differences between versions';
  }

}

