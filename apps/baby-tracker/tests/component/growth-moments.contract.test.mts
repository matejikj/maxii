import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../../src');

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('Today opens experience recorder without speech SDK hooks', () => {
  const today = read('features/today/TodayScreen.tsx');
  assert.match(today, /ExperienceRecorder/);
  assert.doesNotMatch(today, /experienceSoon|unavailableExperience/);
  const experience = read('features/today/ExperienceRecorder.tsx');
  assert.match(experience, /NoteField/);
  assert.match(experience, /eveningNote|Poznámka/);
  assert.doesNotMatch(
    experience,
    /SpeechRecognition|expo-speech|expo-av|getUserMedia|MediaRecorder|microphone permission/i,
  );
});

test('note field remains system-keyboard only', () => {
  const note = read('features/ui/NoteField.tsx');
  assert.match(note, /noteHint/);
  assert.match(note, /blurOnSubmit=\{false\}/);
  assert.doesNotMatch(note, /Speech|startRecording|getUserMedia|expo-speech/i);
});

test('Care hosts growth chart table and recorder', () => {
  const care = read('features/care/CareScreen.tsx');
  assert.match(care, /GrowthChart/);
  assert.match(care, /GrowthRecorder/);
  assert.match(care, /buildGrowthSeries/);
  const chart = read('features/care/GrowthChart.tsx');
  assert.match(chart, /singlePoint/);
  assert.match(chart, /table/);
});

test('dispatcher and history cover notes experiences milestones growth', () => {
  const dispatcher = read('application/commandDispatcher.ts');
  assert.match(dispatcher, /recordNote/);
  assert.match(dispatcher, /recordExperience/);
  assert.match(dispatcher, /recordMilestone/);
  assert.match(dispatcher, /recordGrowth/);
  const history = read('features/history/HistoryScreen.tsx');
  assert.match(history, /loadHistoryDay|loadHistoryPage/);
  assert.match(history, /notes|activities|care/);
  const query = read('domain/projections/historyQuery.ts');
  assert.match(query, /event\.type === 'note'/);
  assert.match(query, /event\.type === 'experience'/);
  assert.match(query, /event\.type === 'milestone'/);
});
