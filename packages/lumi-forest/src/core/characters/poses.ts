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

  // Workshop static actions lean on standing anatomy with purposeful hand/head bias.
  if (pose === 'planPath') {
    switch (part.role) {
      case 'body': case 'belly': case 'mark': return 'translate(0 78) scale(0.9 1.1) translate(0 -78)';
      case 'head': case 'eye': case 'nose': case 'mouth': case 'cheek':
      case 'muzzle': case 'ear': case 'face': return 'translate(6 -16) rotate(6)';
      case 'paw': return part.id.startsWith('foot-') ? 'translate(0 12)' : 'translate(18 -18)';
      default: return undefined;
    }
  }
  if (pose === 'tryAlternatePath') {
    switch (part.role) {
      case 'body': case 'belly': case 'mark': return 'translate(0 78) scale(0.9 1.1) translate(0 -78)';
      case 'head': case 'eye': case 'nose': case 'mouth': case 'cheek':
      case 'muzzle': case 'ear': case 'face': return 'translate(-8 -14) rotate(-8)';
      case 'paw': return part.id.startsWith('foot-') ? 'translate(0 12)' : 'translate(-14 -12)';
      default: return undefined;
    }
  }
  if (pose === 'bridgeSpan') {
    switch (part.role) {
      case 'body': case 'belly': case 'mark': return 'translate(0 78) scale(0.92 1.08) translate(0 -78)';
      case 'head': case 'eye': case 'nose': case 'mouth': case 'cheek':
      case 'muzzle': case 'ear': case 'face': return 'translate(0 -10)';
      case 'paw': return part.id.startsWith('foot-') ? 'translate(0 10)' : 'translate(22 -4)';
      default: return undefined;
    }
  }
  if (pose === 'testBridge') {
    switch (part.role) {
      case 'body': case 'belly': case 'mark': return 'translate(0 78) scale(0.9 1.1) translate(0 -78)';
      case 'head': case 'eye': case 'nose': case 'mouth': case 'cheek':
      case 'muzzle': case 'ear': case 'face': return 'translate(4 -18)';
      case 'paw': return part.id.startsWith('foot-') ? 'translate(0 14)' : 'translate(8 -22)';
      default: return undefined;
    }
  }
  if (pose === 'sketchPlan') {
    switch (part.role) {
      case 'body': case 'belly': case 'mark': return 'translate(0 78) scale(0.94 1.06) translate(0 -78)';
      case 'head': case 'eye': case 'nose': case 'mouth': case 'cheek':
      case 'muzzle': case 'ear': case 'face': return 'translate(10 -8) rotate(4)';
      case 'paw': return part.id.startsWith('foot-') ? 'translate(0 8)' : 'translate(16 -6)';
      default: return undefined;
    }
  }
  if (pose === 'compareNotes') {
    switch (part.role) {
      case 'body': case 'belly': case 'mark': return 'translate(0 78) scale(0.92 1.08) translate(0 -78)';
      case 'head': case 'eye': case 'nose': case 'mouth': case 'cheek':
      case 'muzzle': case 'ear': case 'face': return 'translate(-6 -12) rotate(-4)';
      case 'paw': return part.id.startsWith('foot-') ? 'translate(0 10)' : 'translate(12 -10)';
      default: return undefined;
    }
  }
  if (pose === 'arrangePattern') {
    switch (part.role) {
      case 'body': case 'belly': case 'mark': return 'translate(0 78) scale(0.9 1.1) translate(0 -78)';
      case 'head': case 'eye': case 'nose': case 'mouth': case 'cheek':
      case 'muzzle': case 'ear': case 'face': return 'translate(0 -16)';
      case 'paw': return part.id.startsWith('foot-') ? 'translate(0 12)' : 'translate(20 -14)';
      case 'tail': return 'translate(6 -4) rotate(8)';
      default: return undefined;
    }
  }
  if (pose === 'presentCreation') {
    switch (part.role) {
      case 'body': case 'belly': case 'mark': return 'translate(0 78) scale(0.88 1.12) translate(0 -78)';
      case 'head': case 'eye': case 'nose': case 'mouth': case 'cheek':
      case 'muzzle': case 'ear': case 'face': return 'translate(0 -18)';
      case 'paw': return part.id.startsWith('foot-') ? 'translate(0 14)' : 'translate(10 -28)';
      case 'tail': return 'translate(4 2) rotate(-6)';
      default: return undefined;
    }
  }
  return undefined;
}

export function wholePoseTransform(pose: CharacterPose): string | undefined {
  if (pose === 'sleeping') return 'translate(-10 34) rotate(-19 0 72) scale(1 0.92)';
  return undefined;
}
