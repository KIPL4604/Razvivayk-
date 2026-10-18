"""Server-issued challenges and completion evidence for the ten campaigns.

The challenge is stored independently from the browser save. Solutions remain in
the public puzzle for the existing local hints, so this verifies an issued task,
not human play or resistance to automation.
"""
from __future__ import annotations

import json
from pathlib import Path
import random
import re
import time

DATA = json.loads(Path(__file__).with_name("puzzle_words.json").read_text(encoding="utf-8"))
FULL_MASK = 0b1111111110
QUESTION_GAMES = {"riddles", "sequences", "arithmetic", "rebuses"}


class InvalidProof(ValueError):
    pass


def _question(text, answer, hint):
    return {"question": text, "answers": [str(answer)], "hint": hint}


def _questions(game, n, rng):
    count, tier = 3 + (n - 1) // 20, 0 if n <= 20 else 1 if n <= 60 else 2
    result = []
    for index in range(count):
        a, b = rng.randint(2, 8 + tier * 12), rng.randint(2, 7 + tier * 5)
        if game == "arithmetic":
            mode = (n + index) % (2 if tier == 0 else 4 if tier == 1 else 6)
            items = [
                (f"{a} + {b} = ?", a+b, "Сложи оба числа."),
                (f"{a+b} − {b} = ?", a, "Вычитай по частям: сначала десятки, затем единицы."),
                (f"{a} × {b} = ?", a*b, f"Это {b} слагаемых по {a}."),
                (f"{a*b} ÷ {b} = ?", a, f"Какое число при умножении на {b} даёт {a*b}?"),
                (f"({a} + {b}) × {tier+2} = ?", (a+b)*(tier+2), "Сначала выполни действие в скобках."),
                (f"{a*b} ÷ {b} + {a+b} = ?", 2*a+b, "Сначала деление, затем сложение."),
            ]
            result.append(_question(*items[mode]))
        elif game == "sequences":
            mode = (n + index) % (2 if tier == 0 else 4 if tier == 1 else 6)
            if mode == 0:
                seq, hint = [a+i*b for i in range(6)], f"Каждый шаг прибавляет {b}."
            elif mode == 1:
                ratio = 2+tier
                seq, hint = [a*ratio**i for i in range(6)], f"Каждый шаг умножает на {ratio}."
            elif mode == 2:
                seq, hint = [(i+1)**2+a for i in range(6)], f"К квадратичным числам прибавлено {a}."
            elif mode == 3:
                seq, hint = [a, b], "Следующее число — сумма двух предыдущих."
                while len(seq) < 6:
                    seq.append(seq[-1]+seq[-2])
            elif mode == 4:
                seq = [a+(i//2)*3 if i % 2 == 0 else b+(i//2)*5 for i in range(6)]
                hint = "Смотри отдельно на нечётные и чётные позиции: шаги 3 и 5."
            else:
                seq = [a+(i+1)*(i+2)//2 for i in range(6)]
                hint = "Разности соседних чисел увеличиваются на единицу."
            result.append(_question(" · ".join(map(str, seq[:-1]))+" · ?", seq[-1], hint))
        elif game == "rebuses":
            word, meaning = DATA["words"][(n*7+index*13) % len(DATA["words"])]
            mode, alphabet = (n+index) % 4, DATA["alphabet"]
            if mode == 0:
                encoded, answer = DATA["rebuses"][(n+index) % len(DATA["rebuses"])]
                result.append(_question(f"Прочитай ребус: {encoded}", answer, "Замени цифры словами, затем прочитай всё слитно."))
            elif mode == 1:
                result.append(_question(f"{word[::-1]} — какое слово спрятано?", word, "Прочитай буквы справа налево."))
            elif mode == 2:
                encoded = " · ".join(str(alphabet.index(char)+1) for char in word)
                result.append(_question(f"{encoded} — расшифруй слово.", word, f"Числа — номера букв: А=1, Б=2, Ё=7. Подсказка: {meaning}."))
            else:
                shift = 1+n//25
                encoded = "".join(alphabet[(alphabet.index(char)+shift) % 33] for char in word)
                result.append(_question(f"{encoded} · сдвиг +{shift}. Найди исходное слово.", word, f"Сдвинь каждую букву на {shift} назад в русском алфавите с Ё. Это {meaning}."))
        else:
            mode = (n+index) % (5 if tier == 0 else 8 if tier == 1 else 11)
            if mode == 0:
                item = (f"В очереди {a+b+1} человек. Перед тобой {a}. Сколько человек после тебя?", b, "Не забудь учесть себя.")
            elif mode == 1:
                item = (f"У кроликов и уток вместе {a*4+b*2} лап. Если всего животных {a+b}, сколько среди них кроликов?", a, "Если бы все были утками, лап было бы по две. Каждая лишняя пара — один кролик.")
            elif mode == 2:
                item = (f"Два друга вместе набрали {a+b+a} очков. Один набрал на {b} больше. Сколько очков у другого?", a, "Вычти разницу из общей суммы и раздели остаток пополам.")
            elif mode == 3:
                item = (f"{a} человек обменялись рукопожатиями: каждый с каждым ровно один раз. Сколько рукопожатий?", a*(a-1)//2, "Посчитай пары людей; каждое рукопожатие при прямом подсчёте учитывается дважды.")
            elif mode == 4:
                item = (f"Лестница имеет {a*b} ступеней. Ты поднимаешься сразу на {b} ступени за шаг. Сколько шагов нужно?", a, "Число ступеней делится на длину шага.")
            elif mode == 5:
                item = (f"В {a} коробок кладут шары. Какое минимальное число шаров гарантирует, что хотя бы в одной коробке окажется {b+1} шаров?", a*b+1, f"Сначала заполни каждую из {a} коробок ровно {b} шарами, затем добавь один.")
            elif mode == 6:
                both = rng.randint(1, min(a,b))
                item = (f"Шахматами увлекаются {a} человек, пазлами — {b}. Хотя бы одним из этих занятий увлекаются {a+b-both}. Сколько увлекаются обоими?", both, "При сложении двух групп общие участники были посчитаны дважды.")
            elif mode == 7:
                item = (f"На отрезке отмечены {a} разные точки. Сколько разных отрезков можно выбрать с концами в этих точках?", a*(a-1)//2, "Каждый отрезок определяется парой различных точек.")
            elif mode == 8:
                rows, cols = rng.randint(2,4), rng.randint(2,5)
                item = (f"Сетка {rows} × {cols} клеток. Сколько в ней прямоугольников, включая составленные из нескольких клеток?", rows*(rows+1)*cols*(cols+1)//4, "Выбери две горизонтальные и две вертикальные линии сетки.")
            elif mode == 9:
                item = (f"В турнире {a+b} участников. Каждый матч навылет исключает одного. Сколько матчей нужно, чтобы остался один победитель?", a+b-1, "Каждый матч убирает из борьбы ровно одного участника.")
            else:
                item = (f"В мешке шарики {a} разных цветов, каждого цвета очень много. Сколько нужно достать вслепую, чтобы гарантированно иметь два одного цвета?", a+1, "В худшем случае первые шарики все разных цветов.")
            result.append(_question(*item))
    return result


def count_sudoku_solutions(board, stop_at=2):
    """Bounded exact search using row/column/box masks and minimum domains."""
    board = list(board)
    row_masks, col_masks, box_masks = [0]*9, [0]*9, [0]*9
    for index, value in enumerate(board):
        if not value:
            continue
        row, col = divmod(index, 9)
        box, bit = (row//3)*3+col//3, 1 << value
        if row_masks[row] & bit or col_masks[col] & bit or box_masks[box] & bit:
            return 0
        row_masks[row] |= bit
        col_masks[col] |= bit
        box_masks[box] |= bit
    count = 0

    def search():
        nonlocal count
        if count >= stop_at:
            return
        best_index, best_mask, fewest = -1, 0, 10
        for index, value in enumerate(board):
            if value:
                continue
            row, col = divmod(index, 9)
            mask = FULL_MASK & ~(row_masks[row] | col_masks[col] | box_masks[(row//3)*3+col//3])
            amount = mask.bit_count()
            if amount == 0:
                return
            if amount < fewest:
                best_index, best_mask, fewest = index, mask, amount
                if amount == 1:
                    break
        if best_index < 0:
            count += 1
            return
        row, col = divmod(best_index, 9)
        box = (row//3)*3+col//3
        while best_mask:
            bit = best_mask & -best_mask
            best_mask ^= bit
            board[best_index] = bit.bit_length()-1
            row_masks[row] |= bit
            col_masks[col] |= bit
            box_masks[box] |= bit
            search()
            board[best_index] = 0
            row_masks[row] ^= bit
            col_masks[col] ^= bit
            box_masks[box] ^= bit
            if count >= stop_at:
                break
    search()
    return count


def _sudoku(n, rng):
    groups = list(range(3))
    def shuffled(values):
        return rng.sample(values, len(values))
    rows = [band*3+offset for band in shuffled(groups) for offset in shuffled(groups)]
    cols = [stack*3+offset for stack in shuffled(groups) for offset in shuffled(groups)]
    digits = shuffled(list(range(1,10)))
    solution = [digits[(row*3+row//3+col) % 9] for row in rows for col in cols]
    board, clues, target = solution[:], 81, max(30,48-int(n*.18))
    for index in shuffled(list(range(81))):
        if clues <= target:
            break
        previous, board[index] = board[index], 0
        if count_sudoku_solutions(board) == 1:
            clues -= 1
        else:
            board[index] = previous
    return {"board": board, "solution": solution, "given": [bool(v) for v in board], "selected": -1}


def line_clues(line):
    result, run = [], 0
    for bit in [*line, 0]:
        if bit:
            run += 1
        elif run:
            result.append(run)
            run = 0
    return result or [0]


def count_nonogram_solutions(rows, cols, limit=2):
    size = len(rows)
    lines = [[(mask >> i) & 1 for i in range(size)] for mask in range(1 << size)]
    row_options = [[line for line in lines if line_clues(line) == clue] for clue in rows]
    col_options = [[line for line in lines if line_clues(line) == clue] for clue in cols]
    chosen, count = [], 0

    def visit(row):
        nonlocal count
        if count >= limit:
            return
        if row == size:
            count += 1
            return
        for candidate in row_options[row]:
            chosen.append(candidate)
            if all(any(all(chosen[r][col] == line[r] for r in range(row+1)) for line in options) for col, options in enumerate(col_options)):
                visit(row+1)
            chosen.pop()
            if count >= limit:
                return
    visit(0)
    return count


def _nonogram(n, rng):
    density = .65 if n <= 20 else .55 if n <= 60 else .45
    for _ in range(200):
        solution = [int(rng.random() < density) for _ in range(25)]
        rows = [line_clues(solution[r*5:r*5+5]) for r in range(5)]
        cols = [line_clues(solution[c::5]) for c in range(5)]
        if any(solution) and not all(solution) and count_nonogram_solutions(rows,cols) == 1:
            return {"solution": solution, "rowClues": rows, "colClues": cols, "board": [0]*25, "markMode": "fill"}
    # Always a unique, nonempty challenge, even if the bounded random search misses.
    solution = [int(r == 2 or c == 2) for r in range(5) for c in range(5)]
    return {"solution": solution, "rowClues": [line_clues(solution[r*5:r*5+5]) for r in range(5)], "colClues": [line_clues(solution[c::5]) for c in range(5)], "board": [0]*25, "markMode": "fill"}


def _tiles(n, rng):
    size = 3 if n <= 40 else 4
    board, last = [(i+1) % (size*size) for i in range(size*size)], -1
    for _ in range(8+n):
        blank = board.index(0)
        row, col = divmod(blank,size)
        options = [i for i in (blank-size if row else -1, blank+size if row < size-1 else -1, blank-1 if col else -1, blank+1 if col < size-1 else -1) if i >= 0 and i != last]
        next_index = rng.choice(options)
        board[blank], board[next_index] = board[next_index], board[blank]
        last = blank
    if board == [(i+1) % len(board) for i in range(len(board))]:
        board[-1], board[-2] = board[-2], board[-1]
    return {"size": size, "board": board, "history": []}


def create_challenge(game, difficulty, level_number, session_id):
    """Return the existing createPuzzle shape, generated without a Node runtime."""
    n = level_number or {"easy": 10, "medium": 40, "hard": 80}[difficulty]
    # Separate server version preserves existing local-browser deterministic stages.
    # The per-session nonce makes another user's issued task insufficient as proof.
    rng = random.Random(f"teramont-server-v1:{game}:{n}:{session_id}")
    puzzle = {"type": game, "difficulty": difficulty, "levelNumber": level_number, "sessionId": session_id, "elapsed": 0, "startedAt": int(time.time()*1000), "completed": False, "hints": 0, "moves": 0, "schemaVersion": 3, "serverChallengeVersion": 1}
    if game == "sudoku":
        puzzle.update(_sudoku(n,rng))
    elif game == "nonogram":
        puzzle.update(_nonogram(n,rng))
    elif game == "tiles":
        puzzle.update(_tiles(n,rng))
    elif game == "memory":
        pairs = min(12, 4+(n-1)//12)
        symbols = rng.sample(DATA["memorySymbols"], pairs)*2
        rng.shuffle(symbols)
        puzzle["cards"] = [{"id": i, "value": value, "open": False, "matched": False} for i,value in enumerate(symbols)]
    elif game == "pattern":
        size = 3 if n <= 20 else 4 if n <= 60 else 5
        rounds, count = 3+(n-1)//25, min(size*size-2,3+(n-1)//12)
        puzzle.update({"size": size, "round": 0, "patterns": [rng.sample(list(range(size*size)),count) for _ in range(rounds)], "selectedCells": [], "revealing": False, "ready": False, "revealDuration": max(1000,2600-n*13)})
    elif game == "stroop":
        questions = []
        for _ in range(5+(n-1)//10):
            ink = rng.randint(0,3)
            questions.append({"ink": ink, "word": (ink+rng.randint(1,3)) % 4})
        puzzle.update({"index": 0, "questions": questions})
    elif game in QUESTION_GAMES:
        puzzle.update({"index": 0, "questions": _questions(game,n,rng), "hintShown": False})
    else:
        raise ValueError("Unknown game")
    return puzzle


def _integers(value, length=None, minimum=0, maximum=10000):
    if not isinstance(value,list) or (length is not None and len(value) != length) or len(value) > 10000:
        raise InvalidProof("Неполное решение")
    if any(type(item) is not int or not minimum <= item <= maximum for item in value):
        raise InvalidProof("Неверный формат решения")
    return value


def _normalize(value):
    return re.sub(r"[.,!?;:'\"«»()\s-]+", "", str(value).lower().replace("ё","е")).strip()


def validate_proof(challenge, proof):
    """Raise InvalidProof if the evidence cannot complete this stored challenge."""
    if not isinstance(challenge,dict) or challenge.get("serverChallengeVersion") != 1:
        raise InvalidProof("Эта партия создана до проверки решений. Начни уровень заново.")
    if not isinstance(proof,dict):
        raise InvalidProof("Серверу нужно решение партии. Обнови приложение и повтори сохранение.")
    game = challenge["type"]
    if game == "sudoku":
        board = _integers(proof.get("board"),81,1,9)
        if any(given and board[i] != given for i,given in enumerate(challenge["board"])) or count_sudoku_solutions(board,1) != 1:
            raise InvalidProof("Решение судоку не соответствует выданному полю")
    elif game == "nonogram":
        raw = _integers(proof.get("board"),25,-1,1)
        board = [int(value == 1) for value in raw]
        if [line_clues(board[r*5:r*5+5]) for r in range(5)] != challenge["rowClues"] or [line_clues(board[c::5]) for c in range(5)] != challenge["colClues"]:
            raise InvalidProof("Решение не соответствует числам японского кроссворда")
    elif game == "tiles":
        size, initial = challenge["size"], challenge["board"]
        moves = _integers(proof.get("tileMoves"),minimum=0,maximum=len(initial)-1)
        if not moves:
            raise InvalidProof("Нужна последовательность ходов пятнашек")
        board = initial[:]
        for index in moves:
            blank = board.index(0)
            if abs(index//size-blank//size)+abs(index % size-blank % size) != 1:
                raise InvalidProof("В пятнашках найден недопустимый ход")
            board[index], board[blank] = board[blank], board[index]
        submitted = _integers(proof.get("board"),len(initial),0,len(initial)-1)
        if submitted != board or board != [(i+1) % len(board) for i in range(len(board))]:
            raise InvalidProof("Пятнашки ещё не собраны")
    elif game == "memory":
        cards, pairs = challenge["cards"], proof.get("pairs")
        if not isinstance(pairs,list) or len(pairs)*2 != len(cards):
            raise InvalidProof("Собраны не все пары")
        used = set()
        for pair in pairs:
            first, second = _integers(pair,2,0,len(cards)-1)
            if first == second or first in used or second in used or cards[first]["value"] != cards[second]["value"]:
                raise InvalidProof("Пара не соответствует выданным карточкам")
            used.update((first,second))
    elif game == "pattern":
        patterns = proof.get("patterns")
        if not isinstance(patterns,list) or len(patterns) != len(challenge["patterns"]):
            raise InvalidProof("Пройдены не все раунды матрицы")
        for submitted, expected in zip(patterns,challenge["patterns"]):
            indices = _integers(submitted,len(expected),0,challenge["size"]**2-1)
            if len(set(indices)) != len(indices) or set(indices) != set(expected):
                raise InvalidProof("Узор не соответствует выданному раунду")
    else:
        answers = proof.get("answers")
        questions = challenge["questions"]
        if not isinstance(answers,list) or len(answers) != len(questions):
            raise InvalidProof("Отправлены ответы не на все вопросы")
        for answer, question in zip(answers,questions):
            if game == "stroop":
                valid = type(answer) is int and answer == question["ink"]
            else:
                valid = type(answer) in (str,int,float) and len(str(answer)) <= 256 and any(_normalize(answer) == _normalize(expected) for expected in question["answers"])
            if not valid:
                raise InvalidProof("Есть неверный ответ на выданное задание")
    return True
