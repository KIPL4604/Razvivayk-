import assert from "node:assert/strict";
import { test } from "node:test";
import { runPython } from "../webapp/frontend/js/python-station/console.mjs";
import { checkLesson, lessons } from "../webapp/frontend/js/python-station/lessons.mjs";
import { intro, stages } from "../webapp/frontend/js/python-station/course-content.mjs";
import { checkPractice } from "../webapp/frontend/js/python-course-mode.mjs";

test("explains strings and numbers using Python's result", () => {
  const result = runPython("energy = 12\nprint(energy - 4)\nprint('energy')\nprint('# станция') # comment");
  assert.deepEqual(result.output, ["8", "energy", "# станция"]);
  assert.equal(result.variables.get("energy"), 12);
  assert.equal(result.error, null);
});

test("multiplication has priority over addition and subtraction", () => {
  const result = runPython("print(3 + 2 * 4)\nprint((3 + 2) * 4)\nprint(10 - 3 * -2)");
  assert.equal(result.error, null);
  assert.deepEqual(result.output, ["11", "20", "16"]);
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

test("the first islands separate assignment, reading and applying both skills", () => {
  const exercise = level => stages[level - 1].slides.find(slide => slide.kind === "practice");
  assert.equal(checkPractice(exercise(1), "cups = 5").ok, true);
  assert.equal(checkPractice(exercise(1), 'cups = "5"').ok, false);
  assert.equal(checkPractice(exercise(2), "print(cups)").ok, true);
  assert.equal(checkPractice(exercise(2), "print(8)").ok, false);
  assert.equal(checkPractice(exercise(3), "print(stock)").ok, false);
  assert.equal(checkPractice(exercise(3), "ready = stock").ok, false);
  assert.equal(checkPractice(exercise(3), "ready = 6\nprint(ready)").ok, false);
  assert.equal(checkPractice(exercise(3), "ready = (stock)\nprint(ready)").ok, true);
});

test("mixed practice requires the code to work on changed input as well as the visible example", () => {
  for (const [level, hardcoded] of [
    [8, 'ticket_title = "Место"\nseat_number = 14\nprint(ticket_title)\nprint(seat_number)'],
    [10, "level = 6\nprint(level)"],
    [11, "print(3)\nlevel = 8\nprint(level)"],
    [12, 'status = "Готово: Сад"\nprint(status)'],
    [15, "print(3)\nlevel = 5\nprint(level)"],
    [17, "parcel_count = 5\nprint(parcel_count)"],
  ]) {
    const slide = stages[level - 1].slides.find(item => item.kind === "practice");
    assert.equal(checkPractice({ ...slide, cases: slide.cases.slice(0, 1) }, hardcoded).ok, true, "level " + level);
    assert.equal(checkPractice(slide, hardcoded).ok, false, "level " + level);
  }
});

test("every island can be completed in the course interpreter", () => {
  const solutions = [
    ['print("Привет")'],
    ["cups = 5"],
    ["print(cups)"],
    ["ready = stock\nprint(ready)"],
    ["level = 7"],
    ["sensor_2 = incoming\nprint(sensor_2)"],
    ["visitor_count = visitors\nprint(visitor_count)"],
    ["amount = boxes\nlabel = tag\nprint(label)"],
    ['ticket_title = "Место"\nseat_number = seat\nprint(ticket_title)\nprint(seat_number)'],
    ["print(delivered)\nprint(pending)"],
    ["level = reading\nprint(level)"],
    ["print(level)\nlevel = reading\nprint(level)"],
    ['status = "Готово: " + sector\nprint(status)'],
    ["print(price * count)"],
    ["total = price * count\nprint(total)"],
    ["print(level)\nlevel = level + 2\nprint(level)"],
    ["level = left + right"],
    ["parcel_count = scan\nprint(parcel_count)"],
    ["bags = 3\ntotal = crates + bags\nprint(total)"],
    ["total = price * count\nchange = paid - total\nprint(change)"],
    [
      "price = 4\ncount = 3\npaid = 20\ntotal = price * count\nprint(total)",
      "price = 4\ncount = 3\npaid = 20\ntotal = price * count\nprint(total)\nchange = paid - total\nprint(change)",
    ],
  ];
  const chapters = [intro, ...stages];
  assert.equal(chapters.length, solutions.length);
  for (const [index, chapter] of chapters.entries()) {
    for (const slide of chapter.slides.filter(slide => slide.kind === "theory")) {
      assert.equal(runPython(slide.code).error, null, chapter.title);
    }
    const exercises = chapter.slides.filter(slide => slide.kind === "practice");
    assert.equal(exercises.length, solutions[index].length, chapter.title);
    for (const [exercise, slide] of exercises.entries()) {
      const result = checkPractice(slide, solutions[index][exercise]);
      assert.equal(result.ok, true, chapter.title + ": " + result.text);
    }
  }
});
