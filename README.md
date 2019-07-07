# Git History

A utility to analyze the history of Git repository.

## Why?

It's boring to traverse history, make temporary directories, cache results, etc.

## Usage

```typescript
import { GitHistory } from "git-history";
import * as glob from "fast-glob";

async function example(user: string, passwordOrToken: string) {
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
```

## LICENSE

MIT
