import assert from "node:assert/strict";
import { test } from "node:test";
import { runPython } from "../webapp/frontend/js/python-station/console.mjs";
import { checkLesson, lessons } from "../webapp/frontend/js/python-station/lessons.mjs";

test("explains strings and numbers using Python's result", () => {
  const result = runPython("energy = 12\nprint(energy - 4)\nprint('energy')\nprint('# станция') # comment");
  assert.deepEqual(result.output, ["8", "energy", "# станция"]);
  assert.equal(result.variables.get("energy"), 12);
  assert.equal(result.error, null);
});

test("reports syntax, names and types at the offending line", () => {
  assert.equal(runPython('print("На связи"').error.name, "SyntaxError");
  assert.equal(runPython("print('На связи')\nprint(energy)").error.line, 2);
  assert.equal(runPython('energy = "9"\nprint(energy - 1)').error.name, "TypeError");
  assert.equal(runPython("print(09)").error.name, "SyntaxError");
  assert.equal(runPython("print(0)").output[0], "0");
});

test("the lesson interpreter only accepts its supported Python syntax", () => {
  for (const source of ["import math", "print(values[0])", "print(value.method())", "print(print(1))", "print(1); print(2)"]) {
    assert.ok(runPython(source).error, source);
  }
  assert.ok(runPython(" ".repeat(421)).error);
});

test("all original lesson demonstrations are executable", () => {
  for (const lesson of lessons) if (lesson.example) assert.equal(runPython(lesson.example).error, null, lesson.name);
});

test("chapters distinguish correct output from the skill being practiced", () => {
  assert.equal(checkLesson(0, "'Готов к запуску'").ok, true);
  assert.match(checkLesson(0, "Готов к запуску").message, /кавычках/);
  assert.equal(checkLesson(1, '"9"').ok, false);
  assert.equal(checkLesson(1, "9").ok, true);
  assert.equal(checkLesson(2, 1).ok, true);
  assert.equal(checkLesson(2, 2).ok, false);
  assert.equal(checkLesson(3, "9").ok, false);
  assert.equal(checkLesson(3, "energy - 6").ok, true);
  assert.equal(checkLesson(4, [2, 0, 1]).ok, false);
  assert.equal(checkLesson(4, [2, 1, 0]).ok, true);
});

test("the mission accepts equivalent code and rejects hard-coded or incomplete results", () => {
  const twoUpdates = "energy = energy - outbound_cost\nenergy = energy - return_cost\nprint(energy)";
  const oneUpdate = "energy -= (outbound_cost + return_cost)\nprint(energy)";
  for (const source of [twoUpdates, oneUpdate]) {
    const result = checkLesson(5, source);
    assert.equal(result.ok, true);
    assert.deepEqual(result.output, ["9"]);
  }
  assert.equal(checkLesson(5, "energy = 9\nprint(energy)").ok, false);
  assert.equal(checkLesson(5, "print(energy - outbound_cost - return_cost)").ok, false);
  assert.equal(checkLesson(5, "print(energy)\n" + oneUpdate).ok, false);
});
