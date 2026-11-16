const ID = "lab-staart";

// CSS ядро перезагружает само, на JS — перезагружаем страницу.
Hooks.on("hotReload", ({ packageId, extension }) => {
  if (packageId === ID && extension === "js") location.reload();
});

const { ApplicationV2 } = foundry.applications.api;
const esc = foundry.utils.escapeHTML;
const fmt = n => (n >= 0 ? "+" : "−") + Math.abs(n);
const adv = m => m > 0 ? { advantage: true } : m < 0 ? { disadvantage: true } : {};
// Режим броска: из data-mode кнопки, иначе Shift — преимущество, Ctrl/Cmd — помеха (как в Foundry)
const modeOf = (event, el) => el.dataset.mode !== undefined ? Number(el.dataset.mode)
  : event.shiftKey ? 1 : (event.ctrlKey || event.metaKey) ? -1 : 0;
const NO_DIALOG = { configure: false };

// Cunning Strike: сегментный контрол 2×2, первая ячейка — «ничего». Ключ = имя активности на предмете.
const CUNNING = [["none", "×"], ["trip", "Trip"], ["poison", "Poison"], ["withdraw", "Withdraw"]];
const NO_MODS = { crit: false, sneak: false, cunning: "none" };

class RollPanel extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "staart-panel",
    window: { title: "Rolls", minimizable: true },
    position: { width: 424, left: 70, top: Math.max(10, window.innerHeight - 830) },
    actions: {
      check: RollPanel.#check, save: RollPanel.#save, skill: RollPanel.#skill,
      attack: RollPanel.#attack, damage: RollPanel.#damage, toggle: RollPanel.#toggle,
      mod: RollPanel.#mod, cunning: RollPanel.#cunning, slot: RollPanel.#slot,
      use: RollPanel.#use, sheet: RollPanel.#sheet, other: RollPanel.#other, setTab: RollPanel.#setTab,
    },
  };

  tab = "actions";
  mods = { ...NO_MODS }; // общие модификаторы урона оружия
  crits = {};            // itemId -> Crit для заклинаний (Fire Bolt)

  get actor() {
    return canvas.tokens?.controlled[0]?.actor ?? game.user.character ?? null;
  }

  // Шкала Sneak Attack (кости) и предмет Cunning Strike, если есть у персонажа
  get sneakScale() { return this.actor?.system.scale?.rogue?.["sneak-attack"] ?? null; }
  get cunningItem() { return this.actor?.itemTypes.feat.find(i => i.system.identifier === "cunning-strike") ?? null; }
  // Cunning Strike стоит 1 кость Sneak Attack
  get sneakFormula() {
    const s = this.sneakScale;
    return s && `${s.number - (this.mods.cunning !== "none" ? 1 : 0)}d${s.faces}`;
  }

  // --- рендер ---

  async _renderHTML() {
    const actor = this.actor;
    if (!actor?.system.skills) return `<p class="empty">Select a character token</p>`;
    const s = actor.system;

    const d20 = (action, key, label) => `
      <button class="dis" data-action="${action}" data-key="${key}" data-mode="-1">▼</button>
      <button class="atk" data-action="${action}" data-key="${key}" data-mode="0">${label}</button>
      <button class="adv" data-action="${action}" data-key="${key}" data-mode="1">▲</button>`;
    const nameCell = item => `<div class="name link" data-action="sheet" data-key="${item.id}" title="${esc(item.name)}">${esc(item.name)}</div>`;
    const icon = item => `<img class="icon" src="${item.img}">`;

    // ===== Skills: характеристики, спасы, навыки =====
    const abil = kind => Object.keys(CONFIG.DND5E.abilities).map(k => {
      const v = kind === "check" ? s.abilities[k].mod : s.abilities[k].save.value;
      return `<button data-action="${kind}" data-key="${k}">${k.toUpperCase()}<small>${fmt(v)}</small></button>`;
    }).join("");
    const skills = Object.entries(s.skills)
      .map(([k, sk]) => ({ k, label: CONFIG.DND5E.skills[k]?.label ?? k, total: sk.total }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(({ k, label, total }) => `<div class="row skill"><div class="name">${esc(label)}</div>${d20("skill", k, fmt(total))}</div>`)
      .join("");

    // ===== Weapons: подложка — сверху общие модификаторы урона, под ними оружие =====
    const m = this.mods;
    const check = (key, label) => `<label><input type="checkbox" data-action="mod" data-key="${key}"${m[key] ? " checked" : ""}>${label}</label>`;
    const cunning = this.cunningItem && this.sneakScale ? `<div class="seg"><div class="seg-title">Cunning Strike</div>${
      CUNNING.map(([k, label]) => `<button class="${m.cunning === k ? "on" : ""}" data-action="cunning" data-key="${k}">${label}</button>`).join("")
    }</div>` : "";
    const weaponRows = actor.itemTypes.weapon.filter(i => this.#activities(i).atk).map(item => `
      <div class="row action">${icon(item)}${nameCell(item)}${d20("attack", item.id, "Attack")}<span></span>
        <div class="dmgbox"><button class="dmg" data-action="damage" data-key="${item.id}">Damage</button></div></div>`).join("");
    const weapons = `<div class="zone">
      <div class="mods"><div class="checks">${check("crit", "Crit")}${
        this.sneakScale ? check("sneak", `Sneak Attack <small>${this.sneakFormula}</small>`) : ""}</div>${cunning}</div>
      ${weaponRows}</div>`;

    // ===== Spells: по кругам, у каждого свой заголовок и ячейки =====
    const spellRow = item => {
      const { atk, dmg } = this.#activities(item);
      const attack = atk ? d20("attack", item.id, "Attack")
        : `<span></span><button class="atk" data-action="use" data-key="${item.id}">Cast</button><span></span>`;
      const crit = atk && dmg ? `<button class="toggle crit${this.crits[item.id] ? " on" : ""}" data-action="toggle" data-key="${item.id}">Crit</button>` : "";
      const damage = dmg ? `<button class="dmg" data-action="damage" data-key="${item.id}">Damage</button>${crit}` : "";
      return `<div class="row action">${icon(item)}${nameCell(item)}${attack}<span></span><div class="dmgbox">${damage}</div></div>`;
    };
    // Ячейки: кружки, потраченные перечёркнуты. ponytail: ячейки пакта не показываем — у Staart их нет.
    const slots = lvl => {
      const sl = s.spells?.[`spell${lvl}`];
      if (!sl?.max) return "";
      return `<span class="slots">${Array.from({ length: sl.max }, (_, i) =>
        `<span class="pip${i < sl.value ? "" : " used"}" data-action="slot" data-key="${lvl}" data-index="${i}"></span>`).join("")}</span>`;
    };
    const spells = this.#spells(actor);
    const spellGroups = [...new Set(spells.map(i => i.system.level))].map(lvl =>
      `<div class="head">${lvl ? `Spell level ${lvl}` : "Cantrip"}${slots(lvl)}</div>`
      + spells.filter(i => i.system.level === lvl).map(spellRow).join("")).join("");

    // ===== Other =====
    const other = [["init", "Initiative"], ["conc", "Concentration"], ["death", "Death save"]]
      .map(([k, label]) => `<div class="row action"><span></span><div class="name">${label}</div>${d20("other", k, "Roll")}</div>`).join("")
      + `<div class="row action"><span></span><div class="name">Hit die</div><span></span><span></span><span></span><span></span>
         <div class="dmgbox"><button class="dmg" data-action="other" data-key="hitdie">Roll</button></div></div>`;

    const on = tab => this.tab === tab ? " on" : "";
    return `
      <div class="tabs">
        <button class="${on("actions")}" data-action="setTab" data-key="actions">Actions</button>
        <button class="${on("skills")}" data-action="setTab" data-key="skills">Skills</button>
      </div>
      <div class="tab actions${on("actions")}">${weapons}${spellGroups}<div class="head">Other</div>${other}</div>
      <div class="tab${on("skills")}">
        <div class="abil"><div class="lbl">Check</div>${abil("check")}<div class="lbl">Save</div>${abil("save")}</div>
        ${skills}
      </div>`;
  }

  _replaceHTML(html, content) {
    content.innerHTML = html;
  }

  // Закрыли (крестиком или Shift+R) — при следующей загрузке не открывать
  _onClose(options) {
    super._onClose(options);
    game.settings.set(ID, "open", false);
  }

  // Заклинания по кругу; внутри круга: боевые, иллюзии, Mage Hand, остальное.
  // Mage Hand бывает дважды: обычный кантрип и копия от Legerdemain (cachedFor, бонусное действие) —
  // оставляем копию, обычный прячем.
  #spells(actor) {
    const cached = i => !!i.getFlag("dnd5e", "cachedFor");
    const spells = actor.itemTypes.spell.filter(i => i.system.activities.size);
    const cachedIds = new Set(spells.filter(cached).map(i => i.system.identifier));
    const rank = i => {
      const types = i.system.activities.map(a => a.type);
      if (["attack", "save", "damage"].some(t => types.includes(t)) || i.system.activation?.type === "reaction") return 0;
      if (i.system.school === "ill") return 1;
      if (i.system.identifier === "mage-hand") return 2;
      return 3;
    };
    return spells.filter(i => cached(i) || !cachedIds.has(i.system.identifier))
      .sort((a, b) => a.system.level - b.system.level || rank(a) - rank(b) || a.name.localeCompare(b.name));
  }

  // Атакующая активность и активность урона предмета
  #activities(item) {
    const acts = item.system.activities;
    const atk = acts.getByType("attack")[0];
    const dmg = atk ?? acts.find(a => a.damage?.parts?.length);
    return { atk, dmg };
  }

  // Sneak Attack: оружие finesse или дальнобойное
  #canSneak(item) {
    return item.type === "weapon" && (item.system.properties.has("fin") || item.system.attackType === "ranged");
  }

  // --- обработчики (this = панель) ---

  static #check(event, el) { this.actor.rollAbilityCheck({ ability: el.dataset.key, ...adv(modeOf(event, el)) }, NO_DIALOG); }
  static #save(event, el) { this.actor.rollSavingThrow({ ability: el.dataset.key, ...adv(modeOf(event, el)) }, NO_DIALOG); }
  static #skill(event, el) { this.actor.rollSkill({ skill: el.dataset.key, ...adv(modeOf(event, el)) }, NO_DIALOG); }
  static #use(event, el) { this.actor.items.get(el.dataset.key)?.use({ event }); }
  static #sheet(event, el) { this.actor.items.get(el.dataset.key)?.sheet.render(true); }
  static #setTab(event, el) { this.tab = el.dataset.key; this.render(); }

  // Crit у заклинания
  static #toggle(event, el) {
    this.crits[el.dataset.key] = !this.crits[el.dataset.key];
    this.render();
  }

  // Чекбоксы Crit / Sneak. Выключение Sneak сбрасывает Cunning Strike.
  static #mod(event, el) {
    this.mods[el.dataset.key] = el.checked;
    if (el.dataset.key === "sneak" && !el.checked) this.mods.cunning = "none";
    this.render();
  }

  // Cunning Strike требует Sneak — выбор эффекта включает Sneak
  static #cunning(event, el) {
    this.mods.cunning = el.dataset.key;
    if (el.dataset.key !== "none") this.mods.sneak = true;
    this.render();
  }

  // Клик по ячейке: по заполненной — потратить её и правее, по пустой — восстановить до неё (как на листе)
  static #slot(event, el) {
    const key = `system.spells.spell${el.dataset.key}.value`;
    const i = Number(el.dataset.index), value = foundry.utils.getProperty(this.actor, key);
    this.actor.update({ [key]: i < value ? i : i + 1 });
  }

  static async #attack(event, el) {
    const item = this.actor.items.get(el.dataset.key);
    const rolls = await this.#activities(item).atk.rollAttack(adv(modeOf(event, el)), NO_DIALOG);
    if (!rolls?.length) return;
    // Натуральная 20 включает Crit: у оружия — общий, у заклинания — свой
    if (item.type === "weapon") this.mods.crit = rolls[0].isCritical;
    else this.crits[item.id] = rolls[0].isCritical;
    this.render();
  }

  static async #damage(event, el) {
    const item = this.actor.items.get(el.dataset.key);
    const { dmg } = this.#activities(item);

    if (item.type !== "weapon") {
      await dmg.rollDamage({ isCritical: !!this.crits[item.id] }, NO_DIALOG);
      delete this.crits[item.id];
      return this.render();
    }

    // Оружие: Sneak Attack — отдельный бросок в том же сообщении, тип урона как у оружия
    const m = this.mods, sneak = m.sneak && this.sneakScale && this.#canSneak(item);
    const rolls = [];
    if (sneak) {
      const type = [...item.system.damage.base.types][0];
      rolls.push({ parts: [this.sneakFormula], options: { type, types: [type] } });
    }
    await dmg.rollDamage({ isCritical: m.crit, rolls }, NO_DIALOG);
    // Cunning Strike: запускаем активность с тем же именем на предмете (Poison/Trip — карточка со спасом цели)
    if (sneak && m.cunning !== "none") {
      await this.cunningItem?.system.activities.find(a => a.name.toLowerCase() === m.cunning)?.use({}, NO_DIALOG);
    }
    this.mods = { ...NO_MODS };
    this.render();
  }

  static #other(event, el) {
    const a = this.actor, m = adv(modeOf(event, el));
    switch (el.dataset.key) {
      case "init": return a.rollInitiativeDialog(m, NO_DIALOG);
      case "conc": return a.rollConcentration(m, NO_DIALOG);
      case "death": return a.rollDeathSave(m, NO_DIALOG);
      case "hitdie": return a.rollHitDie({}, NO_DIALOG);
    }
  }
}

const panel = new RollPanel();

// Панель открывается только у того, кто сам её открыл (Shift+R); состояние хранится в этом браузере.
// Так модуль, включённый мастером для всего мира, ничего не показывает остальным игрокам.
Hooks.once("init", () => {
  game.settings.register(ID, "open", { scope: "client", config: false, type: Boolean, default: false });
  game.keybindings.register(ID, "toggle", {
    name: "Toggle roll panel",
    editable: [{ key: "KeyR", modifiers: ["Shift"] }],
    onDown: () => {
      if (panel.rendered) panel.close();
      else { panel.render({ force: true }); game.settings.set(ID, "open", true); }
      return true;
    },
  });
});

Hooks.once("ready", () => game.settings.get(ID, "open") && panel.render({ force: true }));

// Перерисовка при смене токена и изменении персонажа/предметов
const rerender = doc => {
  if (!panel.rendered) return;
  const actor = doc instanceof Actor ? doc : doc.parent;
  if (actor === panel.actor) panel.render();
};
Hooks.on("controlToken", () => panel.rendered && panel.render());
for (const hook of ["updateActor", "updateItem", "createItem", "deleteItem"]) Hooks.on(hook, rerender);
