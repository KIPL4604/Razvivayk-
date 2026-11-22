"""Run a bounded classroom exercise in the browser's Python worker."""

import ast
import builtins
import contextlib
import csv
import io
import json
import math
import os
import re
import sqlite3
import tempfile
import traceback
import types

_SOURCE = "<код ученика>"
_FILE = re.compile(r"[\w-]+(?:\.[\w-]+)*\Z")
_BUILTINS = (
    "abs all any bool chr dict divmod enumerate filter float format frozenset int "
    "isinstance issubclass iter len list map max min next object ord pow print range "
    "repr reversed round set slice sorted str sum super tuple type zip "
    "ArithmeticError AssertionError EOFError Exception FileNotFoundError ImportError IndexError "
    "KeyError NameError OSError RuntimeError StopIteration TypeError ValueError ZeroDivisionError "
    "__build_class__"
).split()


def _name(name):
    if not isinstance(name, str) or not _FILE.fullmatch(name) or len(name) > 96:
        raise ValueError("Используй простое имя учебного файла без пути.")
    return name


def _connect(database):
    connection = sqlite3.connect(database if database == ":memory:" else _name(database))
    connection.set_authorizer(lambda action, arg1, arg2, database, source:
                              sqlite3.SQLITE_DENY if action in (sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH)
                              else sqlite3.SQLITE_OK)
    return connection


def _lesson_modules():
    exports = {
        "csv": (csv, "reader writer DictReader DictWriter"),
        "json": (json, "dump dumps load loads JSONDecodeError"),
        "math": (math, "ceil floor isclose pi sqrt"),
        "sqlite3": (sqlite3, "Error OperationalError IntegrityError Row"),
    }
    modules = {
        name: types.SimpleNamespace(**{key: getattr(module, key) for key in keys.split()})
        for name, (module, keys) in exports.items()
    }
    modules["sqlite3"].connect = _connect
    return modules


def _compile(source, filename):
    tree = ast.parse(source, filename=filename)
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
            if node.attr != "__init__":
                raise ValueError("В тренажёре доступны только публичные атрибуты.")
        if isinstance(node, ast.Name) and node.id.startswith("__") and node.id != "__name__":
            raise ValueError("Это служебное имя недоступно в тренажёре.")
        if isinstance(node, ast.Attribute) and node.attr in {"load_extension", "enable_load_extension", "set_authorizer"}:
            raise ValueError("Этот метод базы данных недоступен в тренажёре.")
    return compile(tree, filename, "exec")


class _Output(io.StringIO):
    def write(self, text):
        if self.tell() + len(text) > 12000:
            raise ValueError("Слишком много строк вывода. Проверь условие выхода из цикла.")
        return super().write(text)


def _matches(actual, expected):
    if isinstance(expected, bool):
        return isinstance(actual, bool) and actual == expected
    if isinstance(expected, (int, float)):
        return type(actual) in (int, float) and math.isclose(actual, expected, rel_tol=1e-10, abs_tol=1e-12)
    if isinstance(expected, list):
        return isinstance(actual, (tuple, list)) and len(actual) == len(expected) and all(
            _matches(left, right) for left, right in zip(actual, expected)
        )
    if isinstance(expected, dict):
        return isinstance(actual, dict) and actual.keys() == expected.keys() and all(
            _matches(actual[key], value) for key, value in expected.items()
        )
    return type(actual) is type(expected) and actual == expected


def _error(exc):
    rows = traceback.extract_tb(exc.__traceback__)
    line = getattr(exc, "lineno", 0) or next(
        (row.lineno for row in reversed(rows) if row.filename == _SOURCE), 0
    )
    message = exc.msg if isinstance(exc, SyntaxError) else str(exc)
    return {"name": type(exc).__name__, "message": message[:300], "line": line}


def _run_case(program, sample, display):
    output = _Output()
    stdin = iter(sample.get("stdin", []))
    fixtures = sample.get("files", {})
    modules = _lesson_modules()
    environment = {"__name__": "__main__", **sample.get("initial", {})}
    error = None
    returned = None

    def lesson_input(prompt=""):
        if prompt:
            print(prompt, end="")
        try:
            return next(stdin)
        except StopIteration:
            raise EOFError("Во входных данных больше нет строк.") from None

    def lesson_open(filename, mode="r", *args, **kwargs):
        return open(_name(filename), mode, *args, **kwargs)

    def lesson_import(name, scope=None, local=None, fromlist=(), level=0):
        if level == 0 and name in modules:
            return modules[name]
        filename = name + ".py"
        if level or filename not in fixtures or not name.isidentifier() or name.startswith("_"):
            raise ImportError("Модуль «" + name + "» недоступен в этой задаче.")
        if name not in modules:
            module = types.ModuleType(name)
            module.__dict__["__builtins__"] = allowed
            modules[name] = module
            exec(_compile(fixtures[filename], filename), module.__dict__)
        return modules[name]

    allowed = {name: getattr(builtins, name) for name in _BUILTINS}
    allowed.update({"__import__": lesson_import, "input": lesson_input, "open": lesson_open})
    environment["__builtins__"] = allowed
    original_dir = os.getcwd()
    with tempfile.TemporaryDirectory(prefix="station-") as work_dir:
        try:
            os.chdir(work_dir)
            for filename, data in fixtures.items():
                with open(_name(filename), "w", encoding="utf-8", newline="") as file:
                    file.write(data)
            with contextlib.redirect_stdout(output):
                try:
                    exec(program, environment)
                    call = sample.get("call")
                    if call:
                        callback = environment.get(call["name"])
                        if not callable(callback):
                            raise ValueError("Создай функцию " + call["name"] + "().")
                        returned = callback(*call.get("args", []))
                        if sample.get("showReturn"):
                            print(returned)
                except Exception as exc:
                    error = _error(exc)
            checks = _check_case(sample, environment, output, returned, error)
            files = {}
            if not error:
                for filename in sorted(os.listdir())[:12]:
                    if not filename.endswith((".txt", ".csv", ".json")) or not os.path.isfile(filename):
                        continue
                    try:
                        with open(_name(filename), encoding="utf-8") as file:
                            data = file.read(12001)
                        if len(data) <= 12000:
                            files[filename] = data
                    except (OSError, UnicodeError, ValueError):
                        continue
        finally:
            os.chdir(original_dir)
    reading = environment.get(display) if display else None
    if not isinstance(reading, (int, float, str)) or isinstance(reading, float) and not math.isfinite(reading):
        reading = None
    return {
        "ok": checks is None, "detail": checks, "error": error,
        "output": output.getvalue().splitlines(), "files": files,
        "reading": reading,
    }


def _check_case(sample, environment, output, returned, error):
    expected_error = sample.get("error")
    if expected_error:
        return None if error and error["name"] == expected_error else "Ожидается ошибка " + expected_error + "."
    if error:
        return error["message"]
    for key, expected in sample.get("expected", {}).items():
        if key not in environment or not _matches(environment[key], expected):
            return "Проверь значение переменной " + key + "."
    for key, expected in sample.get("types", {}).items():
        if key not in environment or type(environment[key]).__name__ != expected:
            return "Переменная " + key + " должна иметь тип " + expected + "."
    call = sample.get("call")
    if call and "result" in call and not _matches(returned, call["result"]):
        return "Проверь, что возвращает " + call["name"] + "()."
    if call and call.get("type") and type(returned).__name__ != call["type"]:
        return "Функция " + call["name"] + "() должна возвращать " + call["type"] + "."
    if "output" in sample and output.getvalue().splitlines() != sample["output"]:
        return "Проверь строки вывода и их порядок."
    for filename, expected in sample.get("expectedFiles", {}).items():
        try:
            with open(_name(filename), encoding="utf-8") as file:
                if file.read(12001) != expected:
                    return "Проверь содержимое файла " + filename + "."
        except (OSError, UnicodeError):
            return "Создай текстовый файл " + filename + "."
    return None


def run_station(payload):
    request = json.loads(payload)
    try:
        program = _compile(request["code"], _SOURCE)
    except Exception as exc:
        return json.dumps({"ok": False, "output": [], "error": _error(exc)}, ensure_ascii=False)
    first = None
    for index, sample in enumerate(request["cases"]):
        result = _run_case(program, sample, request.get("display", ""))
        if first is None:
            first = result
        if not result["ok"]:
            return json.dumps({
                **first, "ok": False, "failedCase": index,
                "detail": result["detail"],
            }, ensure_ascii=False)
    return json.dumps(first, ensure_ascii=False)
