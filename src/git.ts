import {Observable} from 'rxjs';
import {exec} from 'shelljs';
import {error} from './ui';

export class Branch {

  hash: string;
  isCurrent = false;
  message: string;
  name: string;
  remote: string;

  constructor(raw: string) {
    if (raw.startsWith('*')) {
      this.isCurrent = true;
      raw = raw.substring(1);
    }
    raw = raw.trim();

    let i = raw.indexOf(' ');
    this.name = raw.substr(0, i);
    raw = raw.substring(i, raw.length).trim();

    i = raw.indexOf(' ');
    this.hash = raw.substring(0, i);
    raw = raw.substring(i, raw.length).trim();

    i = raw.indexOf(' ');
    this.remote = raw.substring(0, i).replace('[', '').replace(']', '');
    raw = raw.substring(i, raw.length).trim();

    this.message = raw;
  }

  matches(input: string): boolean {
    return (!input)
      ? true
      : this.hash.includes(input)
      || this.message.includes(input)
      || this.name.includes(input)
      || this.remote.includes(input);
  }
}

export class Log {
  hash: string;
  committer: string;
  email: string;
  subject: string;
  branch: string;

  constructor(raw: string) {
    const json = JSON.parse(raw);

    this.hash = json.hash;
    this.committer = json.committer;
    this.email = json.email;
    this.subject = json.subject;
    this.branch = json.branch;
  }

  matches(input: string): boolean {

    input = (input) ? input.toLowerCase() : input;

    return (!input)
      ? true
      : this.hash.includes(input)
      || this.committer.toLowerCase().includes(input)
      || this.email.toLowerCase().includes(input)
      || this.subject.toLowerCase().includes(input)
      || this.branch.toLowerCase().includes(input);
  }
}

export class Git {
  currentBranchMatches(branchName: string): boolean {
    return this.getHash(this.getCurrentBranch()) === this.getHash(branchName);
  }

  checkout(branch: string) {
    const code = exec(`git checkout ${branch}`).code;

    if (code !== 0) {
      error(`unable to checkout ${branch}`);
    }
  }

  pushToOrigin() {
    const code = exec(`git push origin --tags`).code;

    if (code !== 0) {
      error(`unable to push ${this.getCurrentBranch()} to origin with tags`);
    }
  }

  getBranches(): Branch[] {
    const branches = (exec('git branch -vv', {silent: true}).stdout as string)
      .split('\n')
      .filter((val) => val !== '');

    const result = [];
    for (const branch of branches) {
      result.push(new Branch(branch));
    }

    return result;
  }

  getCurrentBranch(): string {
    return (exec('git rev-parse --abbrev-ref HEAD', {silent: true}).stdout as string).trim();
  }

  getFile(file: string, commit?: string): string {
    commit = commit || 'HEAD';

    return (exec(`git show ${commit}:./${file}`, {silent: true}).stdout as string).trim();
  }

  getHash(branchName: string): string {
    const branches = this.getBranches();
    for (const branch of branches) {
      if (branch.name === branchName) {
        return branch.hash;
      }
    }
    return null;
  }

  async getLog(hash: string, length?: number): Promise<Log> {
    return Observable
      .from(this.getLogs(length))
      .find((log) => log.hash === hash)
      .toPromise();
  }

  getLogs(length?: number): Log[] {
    const limit = (length) ? ` -${length}` : '';
    const output = exec(`git log --first-parent --pretty=format:'{"hash":"%h","committer":"%cn","email":"%ce","subject":"%s", "branch":"%D"}'${limit}`, {silent: true}).stdout as string;

    const logs = output.split('\n');

    const results: Log[] = [];
    for (const log of logs) {
      results.push(new Log(log));
    }
    return results;
  }

  hasUncommittedChanges() {
    return exec(`git diff-index --quiet HEAD`).code !== 0;
  }

  merge(commit: Log, version: string) {
    const code = exec(`git merge ${commit.hash} --no-ff -m "merge v${version}"`).code;

    if (code !== 0) {
      error(`unable to merge ${commit.hash} to ${this.getCurrentBranch()}`);
    }
  }

  tag(commit: Log, version: string) {
    const code = exec(`git tag -a v${version} ${commit.hash} -m “v${version}”`).code;

    if (code !== 0) {
      error(`unable to tag ${commit.hash} with v${version}`);
    }
  }
}