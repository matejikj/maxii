/**
 * Canonical Czech product copy for care actions and feedback. Screens bind to
 * these keys so “Zapsat mokrou” never means something else on another tab.
 */
export const PRODUCT_COPY = {
  actions: {
    feeding: 'Krmení',
    startSleep: 'Zahájit spánek',
    sleepRunning: 'Spánek běží',
    recordWet: 'Zapsat mokrou',
    recordDirty: 'Zapsat stolici',
    recordBoth: 'Zapsat obojí',
    save: 'Uložit',
    undo: 'Zpět',
    edit: 'Upravit',
    weTried: 'Vyzkoušeli jsme',
    recordAgain: 'Zapsat znovu',
    favorite: 'Do oblíbených',
    newRecord: 'Nový záznam',
    showTodayRecords: 'Zobrazit dnešní záznamy',
    otherTimeOrNote: 'Jiný čas nebo poznámka',
    close: 'Zavřít',
  },
  sheets: {
    diaperNow: 'Zapsat plenku nyní',
    detailedDiaper: 'Podrobný zápis plenky',
    startSleep: 'Zahájit spánek',
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
  },
  measurement: {
    running: 'Probíhající měření',
    elapsedAvailable: 'Aktuální délka je dostupná po klepnutí.',
  },
  empty: {
    noLastFeed: 'Krmení zatím není zaznamenané.',
    littleHistory: 'Až přibudou záznamy, uvidíte tady přehled.',
  },
} as const;

export type ProductCopy = typeof PRODUCT_COPY;
