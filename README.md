# foundry-lab

Песочница для быстрых модулей Foundry V14. Модуль `modules/<name>` подключается в Foundry
симлинком как `lab-<name>`; не понравилось — `./lab drop <name>`.

```sh
./lab new chat-filter   # modules/chat-filter из template/, симлинк в Data/modules/lab-chat-filter
./lab link              # переподключить все (после клона)
./lab drop chat-filter  # удалить
```

После `new` — включить модуль в мире (Manage Modules), один раз.

Горячая перезагрузка: в `Config/options.json` должно быть `"hotReload": true` (нужен перезапуск
Foundry). Тогда CSS/HBS обновляются без перезагрузки, на правку JS страница перезагружается сама
(хук в `template/main.js`). Следятся только модули, включённые в запущенном мире.

Где смотреть:
- консоль браузера в приложении Foundry — Cmd+Option+I (или открыть http://localhost:30000 в Chrome);
- лог сервера — `~/Library/Application Support/FoundryVTT/Logs/debug.<дата>.log`. Когда мир запущен
  и модуль в нём включён, там есть `Watching for changes to lab-<name>`; нет строки — hot reload
  для модуля не работает.

Foundry — приложение из `/Applications`. Node-сборка той же версии (14.369) лежит в `~/Downloads`,
но на этом Mac не стартует: macOS блокирует её нативный `classic-level.node`.

Другой путь к Data: `FOUNDRY_DATA=/path/to/FoundryVTT ./lab link`.
