import React from 'react';
import { View } from 'react-native';
import { LumiIcon, useLumiTheme } from '@lumi/forest-design/native';
import type { LumiMotif } from '@lumi/forest-design/core';

export type ForestTone =
  | 'sleep'
  | 'nursing'
  | 'bottle'
  | 'food'
  | 'diaper'
  | 'growth'
  | 'care'
  | 'experience'
  | 'development'
  | 'today'
  | 'history';
const LIGHT: Record<ForestTone, readonly [string, string, string]> = {
  sleep: ['#EEE8F4', '#65537E', '#A48ABB'],
  nursing: ['#F7E8E0', '#855645', '#BE886D'],
  bottle: ['#F5EDDA', '#7C6339', '#B59B62'],
  food: ['#F4E5DA', '#8A583C', '#BD8E68'],
  diaper: ['#E6EEEA', '#416E62', '#84A697'],
  growth: ['#E9EFDE', '#566D43', '#94AA78'],
  care: ['#E5EEE4', '#3E6550', '#B69A63'],
  experience: ['#F6EDDA', '#816231', '#B5955C'],
  development: ['#E9EFDE', '#566D43', '#94AA78'],
  today: ['#F6EDDA', '#816231', '#B5955C'],
  history: ['#E6EEEA', '#416E62', '#84A697'],
};
const DARK: Record<ForestTone, readonly [string, string, string]> = {
  sleep: ['#383345', '#E1D1F2', '#B59DCE'],
  nursing: ['#44362F', '#F2D7C6', '#D6AA90'],
  bottle: ['#403B2D', '#EEDDB7', '#CCB07C'],
  food: ['#44372F', '#F3D3B8', '#D5A57E'],
  diaper: ['#2C4239', '#D0E8DD', '#9CC1AF'],
  growth: ['#35402D', '#DEECC9', '#B4C68F'],
  care: ['#2E4337', '#D7E9D5', '#CFB782'],
  experience: ['#403B2D', '#EEDDB7', '#CCB07C'],
  development: ['#35402D', '#DEECC9', '#B4C68F'],
  today: ['#403B2D', '#EEDDB7', '#CCB07C'],
  history: ['#2C4239', '#D0E8DD', '#9CC1AF'],
};

/** Shared botanical materials for care cards, diary actions and illustrations. */
export function forestTone(mode: 'light' | 'dark', name: ForestTone, motif: LumiMotif = 'forest') {
  const [background, ink, accent] = (mode === 'dark' ? DARK : LIGHT)[name];
  if (
    ['care', 'experience', 'development', 'today', 'history'].includes(name) &&
    motif !== 'forest'
  ) {
    if (motif === 'garden')
      return mode === 'dark'
        ? { background: '#49343E', ink: '#F0D2DC', accent: '#D4A397' }
        : { background: '#F4E4E7', ink: '#87515F', accent: '#C5987E' };
    return mode === 'dark'
      ? { background: '#334B59', ink: '#CEE6F0', accent: '#D9B889' }
      : { background: '#E2EDF1', ink: '#3E6877', accent: '#B89B6B' };
  }
  return { background, ink, accent };
}

export function ForestIconBadge({ name, size = 44 }: { name: ForestTone; size?: number }) {
  const { mode, motif } = useLumiTheme();
  const tone = forestTone(mode, name, motif);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.36,
        backgroundColor: tone.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <LumiIcon name={name} color={tone.ink} accentColor={tone.accent} size={size * 0.61} />
    </View>
  );
}
