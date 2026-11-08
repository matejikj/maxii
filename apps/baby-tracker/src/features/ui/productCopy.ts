/**
 * Canonical Czech product copy for care actions and feedback. Screens bind to
 * these keys so “Zapsat mokrou” never means something else on another tab.
 */
export const PRODUCT_COPY = {
  actions: {
    feeding: 'Krmení',
    startSleep: 'Zahájit spánek',
    sleepRunning: 'Spánek běží',
    diaper: 'Plenka',
    experience: 'Zážitek',
    recordWet: 'Zapsat mokrou',
    recordDirty: 'Zapsat stolici',
    recordBoth: 'Zapsat obojí',
    save: 'Uložit',
    undo: 'Zpět',
    edit: 'Upravit',
    editQuickActions: 'Upravit rychlé akce',
    weTried: 'Vyzkoušeli jsme',
    recordAgain: 'Zapsat znovu',
    favorite: 'Do oblíbených',
    newRecord: 'Nový záznam',
    showTodayRecords: 'Zobrazit dnešní záznamy',
    otherTimeOrNote: 'Jiný čas nebo poznámka',
    close: 'Zavřít',
    retry: 'Zkusit znovu',
  },
  sheets: {
    diaperNow: 'Zapsat plenku nyní',
    detailedDiaper: 'Podrobný zápis plenky',
    startSleep: 'Zahájit spánek',
    unavailableFeeding: 'Krmení zatím není k dispozici',
    unavailableSleep: 'Spánek zatím není k dispozici',
    unavailableExperience: 'Zážitek zatím není k dispozici',
  },
  feedback: {
    diaperSaved: 'Přebalení uloženo.',
    savedLocally: 'Uloženo v tomto zařízení.',
    saveFailed: 'Uložení se nepovedlo. Zadané hodnoty zůstaly zachované.',
    draftUnprotected: 'Rozepsané hodnoty zatím nejsou chráněné.',
  },
  fields: {
    eventTime: 'Čas události',
    amount: 'Množství',
    unit: 'Jednotka',
    note: 'Poznámka',
    noteHint: 'Můžete použít diktování, pokud ho vaše klávesnice nabízí.',
    contents: 'Obsah plenky',
  },
  measurement: {
    running: 'Probíhající měření',
    elapsedAvailable: 'Aktuální délka je dostupná po klepnutí.',
    none: 'Žádné probíhající měření.',
  },
  empty: {
    noLastFeed: 'Krmení zatím není zaznamenané.',
    noLastCare: 'Zatím není žádná dokončená péče.',
    littleHistory: 'Až přibudou záznamy, uvidíte tady přehled.',
    activitySlot: 'Denní nabídka her přijde s místním obsahem. Teď tu nic nepředstíráme.',
    feedingSoon: 'Zápis krmení připravujeme. Plenku můžete zapsat hned.',
    sleepSoon: 'Odolný spánkový časovač připravujeme. Probíhající měření tu uvidíte, až poběží.',
    experienceSoon: 'Zážitky a hry budou v Rozvoji. Dnes zůstává volný pro péči.',
  },
  today: {
    lastCare: 'Poslední péče',
    together: 'Dnes spolu',
    quickActions: 'Rychlé akce',
  },
} as const;

export type ProductCopy = typeof PRODUCT_COPY;
