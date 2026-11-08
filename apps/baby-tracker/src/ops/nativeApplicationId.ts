import { PERSONAL_APPLICATION_ID } from './releaseEvidence.ts';

/**
 * Reads application / bundle identifiers from Expo-generated native projects.
 * Used before packaging so JSON config alone is not treated as install proof.
 */

export type NativeIdCheckInput = {
  androidAppGradle?: string;
  iosPbxproj?: string;
  expectedId?: string;
};

export type NativeIdCheckResult = {
  expectedId: string;
  androidApplicationId: string | null;
  iosBundleIdentifier: string | null;
  ok: boolean;
  problems: string[];
};

const ANDROID_APPLICATION_ID =
  /(?:^|\n)\s*applicationId\s+['"]([^'"]+)['"]/;
const ANDROID_NAMESPACE = /(?:^|\n)\s*namespace\s+['"]([^'"]+)['"]/;
const IOS_BUNDLE_ID =
  /PRODUCT_BUNDLE_IDENTIFIER\s*=\s*"?([^";\s]+)"?\s*;/g;

export function extractAndroidApplicationId(gradleSource: string): string | null {
  const match = ANDROID_APPLICATION_ID.exec(gradleSource);
  return match?.[1] ?? null;
}

export function extractAndroidNamespace(gradleSource: string): string | null {
  const match = ANDROID_NAMESPACE.exec(gradleSource);
  return match?.[1] ?? null;
}

export function extractIosBundleIdentifiers(pbxprojSource: string): string[] {
  const ids = new Set<string>();
  for (const match of pbxprojSource.matchAll(IOS_BUNDLE_ID)) {
    ids.add(match[1]!);
  }
  return [...ids];
}

export function checkNativeApplicationIds(
  input: NativeIdCheckInput,
): NativeIdCheckResult {
  const expectedId = input.expectedId ?? PERSONAL_APPLICATION_ID;
  const problems: string[] = [];
  let androidApplicationId: string | null = null;
  let iosBundleIdentifier: string | null = null;

  if (input.androidAppGradle !== undefined) {
    androidApplicationId = extractAndroidApplicationId(input.androidAppGradle);
    const namespace = extractAndroidNamespace(input.androidAppGradle);
    if (androidApplicationId !== expectedId) {
      problems.push(
        `android applicationId is ${androidApplicationId ?? '<missing>'}, expected ${expectedId}`,
      );
    }
    if (namespace !== expectedId) {
      problems.push(
        `android namespace is ${namespace ?? '<missing>'}, expected ${expectedId}`,
      );
    }
  }

  if (input.iosPbxproj !== undefined) {
    const ids = extractIosBundleIdentifiers(input.iosPbxproj);
    iosBundleIdentifier = ids[0] ?? null;
    if (ids.length === 0) {
      problems.push(`ios PRODUCT_BUNDLE_IDENTIFIER missing, expected ${expectedId}`);
    } else if (ids.some((id) => id !== expectedId)) {
      problems.push(
        `ios PRODUCT_BUNDLE_IDENTIFIER values [${ids.join(', ')}] must all equal ${expectedId}`,
      );
    }
  }

  if (input.androidAppGradle === undefined && input.iosPbxproj === undefined) {
    problems.push('no native project sources provided');
  }

  return {
    expectedId,
    androidApplicationId,
    iosBundleIdentifier,
    ok: problems.length === 0,
    problems,
  };
}
