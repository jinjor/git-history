import * as fs from "fs";
import * as _rimraf from "rimraf";
import * as util from "util";

export const exists = util.promisify(fs.exists);
export const readFile = util.promisify(fs.readFile);
export const writeFile = util.promisify(fs.writeFile);
export const mkdir = util.promisify(fs.mkdir);
export const rimraf = util.promisify(_rimraf);
export async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path))) {
    await mkdir(path);
  }
}
