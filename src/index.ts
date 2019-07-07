import * as simplegit from "simple-git/promise";
import * as path from "path";
import * as fs from "./fs";

export type Log = {
  hash: string;
  date: string;
  message: string;
  author_name: string;
};

export class GitHistory {
  constructor(public workspace: string) {}
  getRepoPath(): string {
    return path.join(this.workspace, "repo");
  }
  getRevsPath(): string {
    return path.join(this.workspace, "revs");
  }
  getRevPath(hash: string): string {
    return path.join(this.getRevsPath(), hash);
  }
  getDataPath(hash: string): string {
    return path.join(this.getRevPath(hash), "data");
  }
  private async ensureDir(path: string): Promise<void> {
    if (!(await fs.exists(path))) {
      await fs.mkdir(path);
    }
  }
  private async ensureWorkspace(): Promise<void> {
    await this.ensureDir(this.workspace);
    await this.ensureDir(this.getRevsPath());
  }
  private async ensureRepo(repoUrl: string, branch: string): Promise<void> {
    const repoPath = this.getRepoPath();
    if (!(await fs.exists(repoPath))) {
      await this.clone(repoUrl, branch);
    }
  }
  private async ensureRev(hash: string): Promise<void> {
    const revPath = await this.getRevPath(hash);
    if (!(await fs.exists(revPath))) {
      await fs.mkdir(revPath);
    }
  }
  private async clone(repoUrl: string, branch: string): Promise<void> {
    console.log(`Cloning ${repoUrl} ...`);
    await simplegit(this.workspace).clone(repoUrl, "repo", ["-b", branch]);
  }
  async analyze(
    repoUrl: string,
    branch: string,
    filter: (log: Log) => boolean,
    mapper: (log: Log) => Promise<unknown>,
    max?: number
  ): Promise<string[]> {
    await this.ensureWorkspace();
    await this.ensureRepo(repoUrl, branch);
    const git = simplegit(this.getRepoPath());
    await git.checkout(branch);
    await git.pull();
    const logs = await this.getLogs(max, filter);
    for (let i = 0; i < logs.length; i++) {
      process.stdout.write(
        `Analyzing ${i + 1}/${logs.length}`.padEnd(30) + "\r"
      );
      const log = logs[i];
      await this.ensureRev(log.hash);
      const dataPath = await this.getDataPath(log.hash);
      if (!(await fs.exists(dataPath))) {
        await git.checkout(log.hash);
        const result = await mapper(log);
        const data = JSON.stringify(result || null, null, 2);
        await fs.writeFile(dataPath, data);
      }
    }
    process.stdout.write("Analysing done.".padEnd(30) + "\n");
    return logs.map(l => l.hash);
  }
  private async reduce<A, B>(
    hashes: string[],
    f: (accumulator: B, value: A) => B,
    firstValue?: B
  ): Promise<B> {
    let value = firstValue;
    for (const hash of hashes) {
      const dataPath = this.getDataPath(hash);
      const data = JSON.parse(await fs.readFile(dataPath, "utf8"));
      value = f(value, data);
    }
    return value;
  }
  async getAllData(hashes: string[]): Promise<unknown[]> {
    return this.reduce(
      hashes,
      (arr, data) => {
        arr.push(data);
        return arr;
      },
      []
    );
  }
  async getLogs(
    max: number,
    filter: (log: Log) => boolean
  ): Promise<readonly Log[]> {
    const git = simplegit(this.getRepoPath());
    const logs = await git.log({
      ...(max ? { "--max-count": String(max) } : {}),
      format: {
        hash: "%h",
        date: "%ai",
        message: "%s",
        author_name: "%aN"
      }
    });
    const filtered = logs.all.filter(filter);
    console.log(
      `Got ${logs.all.length} logs and narrowed it to ${filtered.length}.`
    );
    return filtered;
  }
  async clearCache(): Promise<void> {
    const revsPath = this.getRevsPath();
    if (await fs.exists(revsPath)) {
      await fs.rimraf(revsPath);
    }
  }
  async clean(): Promise<void> {
    const repoPath = this.getRepoPath();
    if (await fs.exists(repoPath)) {
      await fs.rimraf(repoPath);
    }
    await this.clearCache();
  }
}
