import type { CharacterPart, CharacterPose } from './blueprint';

/**
 * Stable, non-skeletal pose recipes in local character coordinates. They are
 * interpreted at compile time; animation will later operate on separate groups.
 */
export function poseTransform(part: CharacterPart, pose: CharacterPose): string | undefined {
  if (pose === 'default' || pose === 'sitting') return undefined;
  if (pose === 'standing') {
    switch (part.role) {
      case 'body': case 'belly': case 'mark': return 'translate(0 78) scale(0.88 1.12) translate(0 -78)';
      case 'head': case 'eye': case 'nose': case 'mouth': case 'cheek':
      case 'muzzle': case 'ear': case 'face': return 'translate(0 -14)';
      case 'paw': return part.id.startsWith('foot-') ? 'translate(0 15)' : 'translate(0 -9)';
      case 'spines': return 'translate(0 -6)';
      default: return undefined;
    }
  }
  if (pose === 'sleeping') {
    // Outer body tilt is applied by compiler; parts stay at their authored anchors.
    return undefined;
  }
  return undefined;
}

export function wholePoseTransform(pose: CharacterPose): string | undefined {
  return pose === 'sleeping' ? 'translate(-10 34) rotate(-19 0 72) scale(1 0.92)' : undefined;
}
