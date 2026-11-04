const ID = "lab-__NAME__";

// CSS ядро перезагружает само, на JS — перезагружаем страницу.
Hooks.on("hotReload", ({ packageId, extension }) => {
  if (packageId === ID && extension === "js") location.reload();
});

Hooks.once("ready", () => {
  console.log(`${ID} | ready`);
});
