# foundry-lab

Песочница для быстрых модулей Foundry V14. Модуль `modules/<name>` подключается в Foundry
симлинком как `lab-<name>`; не понравилось — `npm run drop <name>`.

```sh
npm run new chat-filter   # modules/chat-filter из template/, симлинк в Data/modules/lab-chat-filter
npm run link              # переподключить все (после клона)
npm run drop chat-filter  # удалить
npm run release staart    # выпустить версию модуля, см. ниже
```

npm-скрипты вызывают `./lab` (shell), его можно звать и напрямую. Нужен пакет — `npm i -D <пакет>`.

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

Другой путь к Data: `FOUNDRY_DATA=/path/to/FoundryVTT npm run link`.

## Отдать модуль в настоящую игру

`npm run release <name>` берёт версию из `modules/<name>/module.json`, коммитит и пушит ссылку на архив,
собирает `<name>.zip` и создаёт GitHub-релиз `<name>-v<версия>`. Новая версия: поднять `version`
в `module.json`, закоммитить, `npm run release <name>`.

Мастеру — manifest URL (Add-on Modules → Install Module → Manifest URL):
`https://raw.githubusercontent.com/Joxter/foundry-lab/master/modules/<name>/module.json`.
Обновления Foundry подтягивает по нему же.

Модули:
- `staart` — панель бросков для Staart: правая кнопка по нему в списке актёров → Roll panel,
  закрыть крестиком. У остальных игроков пункта нет, им не мешает.
