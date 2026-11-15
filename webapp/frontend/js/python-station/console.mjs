export const MAX_SOURCE = 420;

class PythonError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = kind;
  }
}

const syntax = message => { throw new PythonError("SyntaxError", message); };
const lexeme = /\s+|#.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[0-9]+|[A-Za-z_]\w*|[+-]=|[=()+-]|./gy;
const escapes = new Map([["n", "\n"], ["t", "\t"], ["r", "\r"], ["\\", "\\"], ['"', '"'], ["'", "'"]]);
const reserved = new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(" "));

function tokenize(line) {
  return [...line.matchAll(lexeme)].map(match => match[0])
    .filter(token => !/^\s|^#/.test(token));
}

function stringValue(token) {
  return token.slice(1, -1).replace(/\\(.)/g, (_, character) => {
    if (!escapes.has(character)) syntax("В этой главе внутри текста можно использовать обычные буквы и прямые кавычки.");
    return escapes.get(character);
  });
}

function calculate(left, operator, right) {
  if (typeof left === "number" && typeof right === "number") {
    const value = operator === "+" ? left + right : left - right;
    if (!Number.isSafeInteger(value)) throw new PythonError("OverflowError", "Возьми числа поменьше.");
    return value;
  }
  if (operator === "+" && typeof left === "string" && typeof right === "string") {
    if (left.length + right.length > MAX_SOURCE) throw new PythonError("ValueError", "Сообщение слишком длинное.");
    return left + right;
  }
  throw new PythonError("TypeError", "Для вычисления нужны числа. Проверь кавычки вокруг чисел.");
}

class Statement {
  constructor(line, variables, output) {
    this.tokens = tokenize(line);
    this.variables = variables;
    this.output = output;
    this.index = 0;
  }

  take(expected) {
    if (this.tokens[this.index] !== expected) return false;
    this.index++;
    return true;
  }

  valueOf(name) {
    if (!this.variables.has(name)) throw new PythonError("NameError", "Имя «" + name + "» ещё не задано.");
    return this.variables.get(name);
  }

  term() {
    if (this.take("(")) {
      const value = this.expression();
      if (!this.take(")")) syntax("Закрой скобку после выражения.");
      return value;
    }
    if (this.take("-")) return calculate(0, "-", this.term());
    if (this.take("+")) return calculate(0, "+", this.term());
    const token = this.tokens[this.index++] ?? "";
    if (/^["'].*["']$/.test(token)) return stringValue(token);
    if (/^[0-9]+$/.test(token)) {
      const value = Number(token);
      if (!Number.isSafeInteger(value) || (/^0[0-9]/.test(token) && value)) syntax("Проверь запись целого числа.");
      return value;
    }
    if (/^[A-Za-z_]\w*$/.test(token) && !reserved.has(token)) return this.valueOf(token);
    syntax("Здесь нужно число, имя переменной или текст в прямых кавычках.");
  }

  expression() {
    let value = this.term();
    while (["+", "-"].includes(this.tokens[this.index])) {
      const operator = this.tokens[this.index++];
      value = calculate(value, operator, this.term());
    }
    return value;
  }

  run() {
    if (!this.tokens.length) return;
    if (this.take("print")) {
      if (!this.take("(")) syntax("Поставь открывающую скобку сразу после print.");
      const value = this.expression();
      if (!this.take(")")) syntax("Закрой скобку. В этой главе print выводит одно значение за раз.");
      if (this.index === this.tokens.length) this.output.push(String(value));
    } else {
      const [name, operator] = this.tokens;
      if (!/^[A-Za-z_]\w*$/.test(name) || reserved.has(name) || !["=", "+=", "-="].includes(operator)) {
        syntax("Начни строку с print(…) или запиши значение в переменную через =.");
      }
      this.index = 2;
      const value = this.expression();
      if (this.index === this.tokens.length) {
        this.variables.set(name, operator === "=" ? value : calculate(this.valueOf(name), operator[0], value));
      }
    }
    if (this.index !== this.tokens.length) syntax("Оставь одну команду на строке и проверь лишние символы.");
  }
}

export function runPython(source, initial = {}) {
  const variables = new Map(Object.entries(initial));
  const output = [];
  if (typeof source !== "string" || source.length > MAX_SOURCE) {
    return { output, variables, error: { name: "Ошибка ввода", message: "Сократи программу до 420 символов." } };
  }
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    try {
      if (/^[ \t]+[^\s#]/.test(lines[index])) syntax("В начале этой строки лишний отступ.");
      new Statement(lines[index], variables, output).run();
    } catch (error) {
      if (!(error instanceof PythonError)) throw error;
      return { output, variables, error: { name: error.name, message: error.message, line: index + 1 } };
    }
  }
  return { output, variables, error: null };
}
