import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { loadPyodide } from "../webapp/frontend/vendor/pyodide-314.0.8/pyodide.mjs";
import { chapters, stages } from "../webapp/frontend/js/python-station/course-catalog.mjs";
import { stages as original } from "../webapp/frontend/js/python-station/course-content.mjs";

const indexURL = fileURLToPath(new URL("../webapp/frontend/vendor/pyodide-314.0.8/", import.meta.url));

const engine = (async () => {
  const python = await loadPyodide({ indexURL });
  python.runPython(await readFile(new URL("../webapp/frontend/js/python-station/course-python.py", import.meta.url), "utf8"));
  return python.globals.get("run_station");
})();

async function run(code, cases = [{}], display) {
  return JSON.parse((await engine)(JSON.stringify({ code, cases, display })));
}

test("the full route appends all chapters to the existing twenty islands and gives each a project", () => {
  assert.equal(chapters.length, 15);
  assert.equal(new Set(chapters.map(item => item.id)).size, 15);
  assert.deepEqual(stages.slice(0, 20), original);
  for (const chapter of chapters) {
    assert.equal(chapter.end - chapter.first, chapter.stages.length, chapter.title);
    assert.equal(chapter.stages.at(-1).group, "project", chapter.title);
  }
  assert.equal(chapters[1].stages.length, 8);
  assert.equal(chapters[1].stages.at(-1).slides.filter(item => item.kind === "practice").length, 4);
  assert.equal(typeof chapters[11].stages.at(-1).download?.suffix, "string");
  assert.equal(typeof chapters[14].stages.at(-1).download?.suffix, "string");
});

for (const chapter of chapters.slice(1)) {
  test("Pyodide accepts each worked solution in " + chapter.title, async () => {
    for (const stage of chapter.stages) {
      for (const slide of stage.slides.filter(item => item.kind === "theory" && item.code)) {
        const result = await run(slide.code, [slide.example ?? {}]);
        assert.equal(result.ok, true, stage.title + " · пример · " + (result.detail ?? result.error?.message));
      }
      const exercises = stage.slides.filter(slide => slide.kind === "practice");
      assert.ok(exercises.length, stage.title);
      for (const exercise of exercises) {
        const result = await run(exercise.solution, exercise.cases, exercise.display);
        assert.equal(result.ok, true, stage.title + " · " + (result.detail ?? result.error?.message));
      }
    }
  });
}

test("verification distinguishes numerical types and rejects a pasted output on an additional input", async () => {
  const checks = [
    { initial: { raw: "3" }, expected: { cargo: 3 }, types: { cargo: "float" }, output: ["3.0"] },
    { initial: { raw: "7.5" }, expected: { cargo: 7.5 }, types: { cargo: "float" }, output: ["7.5"] },
  ];
  assert.equal((await run("cargo = 3\nprint('3.0')", checks)).failedCase, 0);
  assert.equal((await run("cargo = 3.0\nprint(cargo)", checks)).failedCase, 1);
  assert.equal((await run("cargo = float(raw)\nprint(cargo)", checks)).ok, true);
});

test("files, fixtures and public modules are local to an exercise run", async () => {
  const file = { files: { "data.txt": "fixture" }, expectedFiles: { "output.txt": "fixture" } };
  assert.equal((await run("with open('data.txt') as f:\n    value = f.read()\nwith open('output.txt', 'w') as f:\n    f.write(value)", [file])).files["output.txt"], "fixture");
  assert.equal((await run("open('output.txt')")).error.name, "FileNotFoundError");
  assert.equal((await run("open('../data.txt')")).error.name, "ValueError");
  const changed = await run("import json\njson.loads = str\nprint(json.loads('5'))");
  assert.equal(changed.ok, true);
  const fresh = await run("import json\nprint(type(json.loads('5')).__name__)");
  assert.equal(fresh.ok, false);
  assert.deepEqual((await run("import json\nprint(json.loads('5') + 1)")).output, ["6"]);
  for (const code of ["import js", "import os", "import importlib", "import urllib.request", "import sys"]) {
    assert.equal((await run(code)).error.name, "ImportError");
  }
  assert.equal((await run("import sqlite3\nsqlite3.connect('/outside.db')")).error.name, "ValueError");
});
