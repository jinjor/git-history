import { GitHistory } from "../src";
import * as glob from "fast-glob";

export async function run(user: string, passwordOrToken: string) {
  const gitHistory = new GitHistory(
    "work/example",
    `https://${user}:${passwordOrToken}@github.com/jinjor/git-history.git`,
    "master"
  );
  const result = await gitHistory.analyze({
    map: async log => {
      const files = await glob([`**/*.ts`], {
        cwd: gitHistory.getRepoPath()
      });
      return files.length;
    }
    // optionally use `filter` to skip some revisions.
  });
  const data = await result.all(); // or use `reduce` if data is too large.
  console.log(data); // [ 2, 2, 4, ... ]
}
