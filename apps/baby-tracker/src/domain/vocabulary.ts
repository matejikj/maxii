/**
 * Stable meaning tokens for UI copy. Screens bind labels to these keys so the
 * same care state cannot be narrated as a different product concept.
 */
export const DOMAIN_VOCABULARY = {
  draft: {
    key: 'draft',
    meaning: 'Unconfirmed form values; recoverable, excluded from history and summaries.',
    uiLabelCs: 'Rozepsáno',
  },
  runningMeasurement: {
    key: 'runningMeasurement',
    meaning: 'Persisted session without completion; elapsed time derives from stored instants.',
    uiLabelCs: 'Probíhající měření',
  },
  nursingPause: {
    key: 'nursingPause',
    meaning: 'Paused nursing of the same session; adds no active minutes and is not a second feed.',
    uiLabelCs: 'Pauza kojení',
  },
  completedKnownDuration: {
    key: 'completedKnownDuration',
    meaning: 'Known start and end; displays the recorded length, optionally approximate.',
    uiLabelCs: 'Dokončený interval',
  },
  completedUnknownDuration: {
    key: 'completedUnknownDuration',
    meaning: 'Confirmed event without known length; not running and not zero minutes.',
    uiLabelCs: 'Dokončený zápis bez délky',
  },
  unsavedChange: {
    key: 'unsavedChange',
    meaning: 'Persist confirmation failed; previous saved state remains the summary source.',
    uiLabelCs: 'Neuložená změna',
  },
  deletedRecord: {
    key: 'deletedRecord',
    meaning: 'Event in the trash; outside ordinary summaries while retention lasts.',
    uiLabelCs: 'Smazaný záznam',
  },
  syncConflict: {
    key: 'syncConflict',
    meaning: 'Incompatible versions after sync; keep evidence and do not present as confirmed.',
    uiLabelCs: 'Konflikt po synchronizaci',
  },
  savedLocally: {
    key: 'savedLocally',
    meaning: 'Operation finished on device and survives app return.',
    uiLabelCs: 'Uloženo v zařízení',
  },
  awaitingTransfer: {
    key: 'awaitingTransfer',
    meaning: 'Local change not yet confirmed by the family service.',
    uiLabelCs: 'Čeká na přenos',
  },
  synchronized: {
    key: 'synchronized',
    meaning: 'Known changes transferred; another offline phone may still hold undelivered ones.',
    uiLabelCs: 'Synchronizováno',
  },
  backupCreated: {
    key: 'backupCreated',
    meaning: 'Consistent copy with a concrete date and scope; state must say local/export/remote.',
    uiLabelCs: 'Záloha vytvořena',
  },
  readyOffline: {
    key: 'readyOffline',
    meaning: 'App base and content are actually available offline; not a backup off-device.',
    uiLabelCs: 'Připraveno bez internetu',
  },
  notRecorded: {
    key: 'notRecorded',
    meaning: 'Missing record; never implied zero intake, sleep, or care.',
    uiLabelCs: 'Nezaznamenáno',
  },
  amountNotProvided: {
    key: 'amountNotProvided',
    meaning: 'Quantity intentionally unknown; distinct from an explicit zero measurement.',
    uiLabelCs: 'Množství neuvedeno',
  },
} as const;

export type DomainVocabularyKey = keyof typeof DOMAIN_VOCABULARY;
