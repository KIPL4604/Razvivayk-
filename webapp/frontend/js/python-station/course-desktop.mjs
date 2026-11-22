export const cargoDesktopSuffix = `

# Окно вызывает ту же функцию, что мы проверяли в курсе.
def main():
    import tkinter as tk
    from tkinter import ttk

    root = tk.Tk()
    root.title("Пульт груза")
    root.minsize(340, 210)
    root.columnconfigure(0, weight=1)

    form = ttk.Frame(root, padding=18)
    form.grid(sticky="nsew")
    form.columnconfigure(1, weight=1)
    rows = layout_rows(0)

    ttk.Label(form, text="Количество коробок").grid(row=rows["boxes"], column=0, sticky="w", pady=6)
    boxes = ttk.Entry(form)
    boxes.grid(row=rows["boxes"], column=1, sticky="ew", padx=(12, 0))
    ttk.Label(form, text="Вес коробки, кг").grid(row=rows["weight"], column=0, sticky="w", pady=6)
    weight = ttk.Entry(form)
    weight.grid(row=rows["weight"], column=1, sticky="ew", padx=(12, 0))

    message = tk.StringVar(value="Введите количество и вес.")
    def calculate(event=None):
        message.set(cargo_report(boxes.get(), weight.get()))

    ttk.Button(form, text="Рассчитать", command=calculate).grid(
        row=rows["calculate"], column=0, columnspan=2, sticky="ew", pady=(12, 8)
    )
    ttk.Label(form, textvariable=message, wraplength=300).grid(
        row=rows["message"], column=0, columnspan=2, sticky="w"
    )
    root.bind("<Return>", calculate)
    boxes.focus_set()
    root.mainloop()


if __name__ == "__main__":
    main()
`;

export const telegramBotSuffix = `

# Этот блок запускается только в настольном Python.
# Токен собственного учебного бота хранится в переменной TERAMONT_LEARNING_BOT_TOKEN.
def main():
    import json
    import os
    import re
    import time
    from urllib.error import HTTPError, URLError
    from urllib.parse import urlencode
    from urllib.request import Request, urlopen

    token = os.environ.get("TERAMONT_LEARNING_BOT_TOKEN", "")
    if not re.fullmatch(r"[0-9]+:[A-Za-z0-9_-]+", token):
        raise SystemExit("Укажите токен в TERAMONT_LEARNING_BOT_TOKEN.")

    def telegram(method, fields):
        url = f"https://api.telegram.org/bot{token}/{method}"
        request = Request(url, data=urlencode(fields).encode("utf-8"), method="POST")
        with urlopen(request, timeout=30) as response:
            data = json.load(response)
        if not data.get("ok"):
            raise RuntimeError("Сервис не подтвердил запрос.")
        return data["result"]

    offset = 0
    print("Бот запущен. Для выхода нажмите Ctrl+C.")
    while True:
        try:
            updates = telegram("getUpdates", {
                "offset": offset, "timeout": 20, "allowed_updates": '["message"]'
            })
            for update in updates:
                offset = max(offset, update["update_id"] + 1)
                message = update.get("message", {})
                chat = message.get("chat", {})
                text = message.get("text")
                if chat.get("type") == "private" and isinstance(text, str):
                    telegram("sendMessage", {"chat_id": chat["id"], "text": reply_to(text)})
        except KeyboardInterrupt:
            print("Бот остановлен.")
            break
        except HTTPError as error:
            if error.code in (401, 404, 409):
                raise SystemExit("Проверьте токен и убедитесь, что бот запущен только один раз.") from None
            print(f"Ответ сервиса: HTTP {error.code}. Пауза перед следующим запросом.")
            time.sleep(5)
        except (URLError, TimeoutError, RuntimeError, ValueError):
            print("Не удалось получить корректный ответ. Новый запрос через 5 секунд.")
            time.sleep(5)


if __name__ == "__main__":
    main()
`;
