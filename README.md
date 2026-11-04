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

Другой путь к Data: `FOUNDRY_DATA=/path/to/FoundryVTT ./lab link`.
