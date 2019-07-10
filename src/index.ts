import * as simplegit from "simple-git/promise";
import * as path from "path";
import * as fs from "./fs";

export interface LogFormat {
  hash?: string;
  date?: string;
  message?: string;
  refs?: string;
  body?: string;
  author_name?: string;
  author_email?: string;
}

export interface Log {
  hash: string;
  date: string;
  message: string;
  refs: string;
  body: string;
  author_name: string;
  author_email: string;
  tags: string[];
}

export interface Analyzer<A> {
  name?: string;
  filter?: (log: Log) => boolean;
  map: (log: Log) => Promise<A>;
  max?: number;
  format?: LogFormat;
  dateFormat?: string;
}

export class AnalyzerResult<A> {
  constructor(
    private hashes: string[],
    private getRevPath: (hash: string) => string
  ) {}
  private async getRevData(hash: string): Promise<A> {
    const dataPath = this.getRevPath(hash);
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
  private getDataPath(): string {
    return path.join(this.workspace, "data");
  }
  private getRevsPath(name: string): string {
    return path.join(this.getDataPath(), name);
  }
  private getRevPath(name: string, hash: string): string {
    return path.join(this.getRevsPath(name), hash);
  }
  private async ensureWorkspace(): Promise<void> {
    await fs.ensureDir(this.workspace);
    await fs.ensureDir(this.getDataPath());
  }
  private async ensureRevs(name: string): Promise<void> {
    await fs.ensureDir(this.getRevsPath(name));
  }
  private async ensureRepo(): Promise<void> {
    if (!(await fs.exists(this.getRepoPath()))) {
      await this.clone();
    }
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
    filter: (log: Log) => boolean,
    format: LogFormat,
    dateFormat: string
  ): Promise<Log[]> {
    const git = simplegit(this.getRepoPath());
    const logs = await git.log({
      ...(max ? { "--max-count": String(max) } : {}),
      ...(dateFormat ? { "--date": `format:${dateFormat}` } : {}),
      format: {
        hash: "%H",
        date: "%ai",
        message: "%s",
        refs: "%D",
        body: "%b",
        author_name: "%aN",
        author_email: "%ae",
        ...format
      }
    });
    const filtered = logs.all
      .map(log => ({ ...log, tags: this.getTags(log.refs) }))
      .filter(filter);
    console.log(
      `Got ${logs.all.length} logs and narrowed it to ${filtered.length}.`
    );
    return filtered;
  }
  private getTags(refs: string): string[] {
    return refs
      .split(",")
      .filter(token => token.includes("tag:"))
      .map(token => token.split("tag:")[1].trim());
  }
  async analyze<A>(analyzer: Analyzer<A>): Promise<AnalyzerResult<A>> {
    const {
      filter = () => true,
      map,
      max,
      name = "default",
      format,
      dateFormat
    } = analyzer;
    await this.ensureWorkspace();
    await this.ensureRevs(name);
    await this.ensureRepo();
    const git = simplegit(this.getRepoPath());
    await git.checkout(this.branch);
    await git.pull();
    const logs = await this.getLogs(max, filter, format, dateFormat);
    for (let i = 0; i < logs.length; i++) {
      process.stdout.write(
        `Analyzing ${i + 1}/${logs.length}`.padEnd(30) + "\r"
      );
      const log = logs[i];
      const revPath = await this.getRevPath(name, log.hash);
      if (!(await fs.exists(revPath))) {
        await git.checkout(log.hash);
        const result = await map(log);
        const data = JSON.stringify(result || null, null, 2);
        await fs.writeFile(revPath, data);
      }
    }
    process.stdout.write("".padEnd(30) + "\r");
    console.log("Analyzing done.");
    const hashes = logs.map(l => l.hash);
    hashes.reverse();
    return new AnalyzerResult(hashes, this.getRevPath.bind(this, name));
  }
  async clearCache(name: string): Promise<void> {
    const revsPath = this.getRevsPath(name);
    if (await fs.exists(revsPath)) {
      await fs.rimraf(revsPath);
    }
  }
  async clearAllCaches(): Promise<void> {
    const dataPath = this.getDataPath();
    if (await fs.exists(dataPath)) {
      await fs.rimraf(dataPath);
    }
  }
  async clean(): Promise<void> {
    const repoPath = this.getRepoPath();
    if (await fs.exists(repoPath)) {
      await fs.rimraf(repoPath);
    }
    await this.clearAllCaches();
  }
}
