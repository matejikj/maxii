import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { PRODUCT_COPY } from '../../src/features/ui/productCopy.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.join(here, '../../src/features/ui');

function read(name: string) {
  return fs.readFileSync(path.join(uiRoot, name), 'utf8');
}

test('canonical copy distinguishes direct write from form save', () => {
  assert.equal(PRODUCT_COPY.actions.recordWet, 'Zapsat mokrou');
  assert.equal(PRODUCT_COPY.actions.save, 'Uložit');
  assert.notEqual(PRODUCT_COPY.actions.recordWet, PRODUCT_COPY.actions.save);
  assert.match(PRODUCT_COPY.fields.noteHint, /pokud ho vaše klávesnice nabízí/);
});

test('direct actions guard double submit and never auto-open as save', () => {
  const source = read('DirectCareActions.tsx');
  assert.match(source, /locked\.current/);
  assert.match(source, /testID="direct-wet"/);
  assert.match(source, /testID="form-save"/);
  assert.match(source, /Potvrdí vyplněný podrobný záznam/);
  assert.doesNotMatch(source, /speech|SpeechRecognition|expo-speech|microphone/i);
});

test('note field stays speech-API free and keeps focus across composition', () => {
  const source = read('NoteField.tsx');
  assert.match(source, /multiline/);
  assert.match(source, /blurOnSubmit=\{false\}/);
  assert.match(source, /PRODUCT_COPY\.fields\.noteHint/);
  assert.doesNotMatch(source, /Speech|ASR|startRecording|expo-av|microphone/i);
  assert.match(PRODUCT_COPY.fields.noteHint, /pokud ho vaše klávesnice nabízí/);
});

test('active measurement does not live-region every timer tick', () => {
  const source = read('ActiveMeasurement.tsx');
  assert.match(source, /elapsedAvailable/);
  assert.match(source, /accessibilityLiveRegion=\{announceElapsed \? 'polite' : 'none'\}/);
  assert.doesNotMatch(source, /setInterval/);
});

test('care sheet keeps footer actions keyboard-reachable', () => {
  const source = read('CareActionSheet.tsx');
  assert.match(source, /footer/);
  assert.match(source, /useSafeAreaInsets/);
  assert.match(source, /bottomInset/);
});

test('walkthrough uses synthetic labels only', () => {
  const source = read('CareUxWalkthrough.tsx');
  assert.match(source, /syntetický průchod/i);
  assert.doesNotMatch(source, /rodné|birthDate|real child|SecureStore/i);
});
