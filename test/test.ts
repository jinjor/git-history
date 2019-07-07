import * as ex1 from "./lang-history";
import * as ex2 from "./file-count";

const user = process.env.GITHUB_USER;
if (!user) {
  throw new Error("GITHUB_USER is required.");
}
const token = process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error("GITHUB_TOKEN is required.");
}
const repo = process.env.GITHUB_REPO;
if (!repo) {
  throw new Error("GITHUB_REPO is required.");
}
const url = `https://${user}:${token}@github.com/${repo}.git`;
const branch = "master";
const out = "work/result.html";

(async () => {
  await ex1.run(url, branch, out);
  await ex2.run(user, token);
})()
  .then(_ => {
    console.log("done.");
  })
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
