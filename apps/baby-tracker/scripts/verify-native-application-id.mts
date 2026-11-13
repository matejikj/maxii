#!/usr/bin/env node
/**
 * Verifies generated android/ios projects carry PERSONAL_APPLICATION_ID.
 * Run after `expo prebuild` and before packaging an installable binary.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkNativeApplicationIds } from '../src/ops/nativeApplicationId.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidGradle = path.join(root, 'android/app/build.gradle');
const iosPbxproj = path.join(root, 'ios/LumiBabyTracker.xcodeproj/project.pbxproj');

const input: {
  androidAppGradle?: string;
  iosPbxproj?: string;
} = {};

if (fs.existsSync(androidGradle)) {
  input.androidAppGradle = fs.readFileSync(androidGradle, 'utf8');
} else {
  process.stderr.write(`missing ${androidGradle} — run npm run prebuild:native first\n`);
}

if (fs.existsSync(iosPbxproj)) {
  input.iosPbxproj = fs.readFileSync(iosPbxproj, 'utf8');
} else {
  process.stderr.write(`missing ${iosPbxproj} — run npm run prebuild:native first\n`);
}

const result = checkNativeApplicationIds(input);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

if (!result.ok) {
  process.exitCode = 1;
}
