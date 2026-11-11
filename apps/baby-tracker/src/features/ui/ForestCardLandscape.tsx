import React from 'react';
import { LumiMotifLandscape } from '@lumi/forest-design/native';
import type { LumiMotif, LumiMotifVariant } from '@lumi/forest-design/core';

/** Kept as an app façade; world geometry lives in the framework's pure IR. */
export function ForestCardLandscape({ variant = 'dusk', motif, opacity = 1 }: {
  variant?: LumiMotifVariant; motif?: LumiMotif; opacity?: number;
}) {
  return <LumiMotifLandscape variant={variant} style={{ opacity }} {...(motif === undefined ? {} : { motif })} />;
}
