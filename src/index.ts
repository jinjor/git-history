import * as simplegit from "simple-git/promise";
import * as path from "path";
import * as fs from "./fs";

export type Log = {
  hash: string;
  date: string;
  message: string;
  author_name: string;
};

export interface Analyzer<A> {
  filter?: (log: Log) => boolean;
  map: (log: Log) => Promise<A>;
  max?: number;
}

export class AnalyzerResult<A> {
  constructor(
    private hashes: string[],
    private getDataPath: (hash: string) => string
  ) {}
  private async getRevData(hash: string): Promise<A> {
    const dataPath = this.getDataPath(hash);
    return JSON.parse(await fs.readFile(dataPath, "utf8"));
  }
  async reduce<B>(
    f: (accumulator: B, value: A) => B,
    firstValue: B
  ): Promise<B> {
    let value = firstValue;
    for (const hash of this.hashes) {
      const data = await this.getRevData(hash);
      value = f(value, data);
    }
    return value;
  }
  async all(): Promise<A[]> {
    return this.reduce((arr, data) => {
      arr.push(data);
      return arr;
    }, []);
  }
}

export class GitHistory {
  constructor(
    public workspace: string,
    public repoUrl: string,
    public branch: string
  ) {}
  getRepoPath(): string {
    return path.join(this.workspace, "repo");
  }
  private getRevsPath(): string {
    return path.join(this.workspace, "revs");
  }
  private getRevPath(hash: string): string {
    return path.join(this.getRevsPath(), hash);
  }
  private getDataPath(hash: string): string {
    return path.join(this.getRevPath(hash), "data");
  }
  private async ensureWorkspace(): Promise<void> {
    await fs.ensureDir(this.workspace);
    await fs.ensureDir(this.getRevsPath());
  }
  private async ensureRepo(): Promise<void> {
    if (!(await fs.exists(this.getRepoPath()))) {
      await this.clone();
    }
  }
  private async ensureRev(hash: string): Promise<void> {
    const revPath = await this.getRevPath(hash);
    await fs.ensureDir(revPath);
  }
  private async clone(): Promise<void> {
    process.stdout.write(`Cloning ${this.branch} ...\r`);
    await simplegit(this.workspace).clone(this.repoUrl, "repo", [
      "-b",
      this.branch
    ]);
    process.stdout.write("".padEnd(50) + "\r");
    console.log(`Cloning ${this.branch} done.`);
  }
  private async getLogs(
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
  async analyze<A>(analyzer: Analyzer<A>): Promise<AnalyzerResult<A>> {
    const { filter = () => true, map, max } = analyzer;
    await this.ensureWorkspace();
    await this.ensureRepo();
    const git = simplegit(this.getRepoPath());
    await git.checkout(this.branch);
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
        const result = await map(log);
        const data = JSON.stringify(result || null, null, 2);
        await fs.writeFile(dataPath, data);
      }
    }
    process.stdout.write("".padEnd(30) + "\r");
    console.log("Analyzing done.");
    const hashes = logs.map(l => l.hash);
    hashes.reverse();
    return new AnalyzerResult(hashes, this.getDataPath.bind(this));
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
