import { GitHistory, DefaultLogFields } from "../src";
import * as glob from "fast-glob";
import * as path from "path";
import * as fs from "fs";
import * as util from "util";
import { Lang, ts, elm, rs } from "./lang";

type Langs = { [key: string]: number };
type Result = { hash: string; date: string; langs: Langs };
type Log = {
  hash: string;
  date: string;
  message: string;
  refs: string;
};

export async function run(url: string, branch: string, out: string) {
  const langs = [ts, elm, rs];
  const analyzer = new GitHistory("work/test", url, branch);
  const result = await analyzer.analyze({
    format: {
      hash: "%h",
      date: "%cd",
      message: "%s",
      refs: "%D"
    },
    dateFormat: "%Y/%m/%d",
    filter: log => {
      return log.message.startsWith("Merge pull request ");
    },
    map: async log => {
      return analyze(analyzer.getRepoPath(), log, langs);
    }
  });
  const data = await result.all();
  const html = render(data, langs);
  await util.promisify(fs.writeFile)(out, html);
}

async function analyze(
  repoPath: string,
  log: Log,
  languages: Lang[]
): Promise<Result> {
  const entries = await glob(languages.map(l => `**/*${l.ext}`), {
    cwd: repoPath
  });
  const langs: Langs = {};
  for (const entry of entries) {
    const ext = path.extname(entry as string);
    langs[ext] = (langs[ext] || 0) + 1;
  }
  return { ...log, langs };
}

function makeDataset(lang: Lang, result: Result[]) {
  const data = result.map(d => d.langs[lang.ext] || 0);
  return {
    label: lang.ext,
    borderColor: lang.color,
    borderWidth: 1,
    radius: 0,
    data
  };
}

function render(result: Result[], langs: Lang[]): string {
  const data = {
    labels: result.map(r => r.date),
    datasets: langs.map(l => makeDataset(l, result))
  };
  return `
    <div class="chart-container" style="position: relative; height:40vh; width:80vw;">
      <canvas id="myChart" width="400" height="400"></canvas>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@2.8.0"></script>
    <script>
      var ctx = document.getElementById("myChart").getContext("2d");
      var myChart = new Chart(ctx, {
        type: "line",
        data: ${JSON.stringify(data)}
      });
    </script>
  `;
}
