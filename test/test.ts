import { run } from "./lang-history";

const user = process.env.GITHUB_USER;
if (!user) {
  throw new Error("GITHUB_USER is required.");
}
const token = process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error("GITHUB_TOKEN is required.");
}
const repo = process.env.GITHUB_REPO;
if (!user) {
  throw new Error("GITHUB_REPO is required.");
}
const url = `https://${user}:${token}@github.com/${repo}.git`;
const workspace = "work";
const branch = "master";
const out = "result.html";

run(workspace, url, branch, out)
  .then(_ => {
    console.log("done.");
  })
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
