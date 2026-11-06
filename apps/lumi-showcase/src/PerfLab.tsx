import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { composeScene, LUMI_SCENES, type LumiScene } from '@lumi/forest-design/core';

export interface PerformanceReading {
  readonly kind: 'lumi-js-device-sample';
  readonly composeP50Ms: number;
  readonly composeP95Ms: number;
  readonly frameIntervalP95Ms: number;
  readonly frameIntervalsOver16_7Percent: number;
  readonly sampleCount: number;
  readonly note: string;
}

const now = (): number => performance.now();
function percentile(sorted: readonly number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] ?? 0;
}
const round = (value: number): number => Math.round(value * 1000) / 1000;

/** Samples JS scheduling, NOT UI/native/compositor FPS. Run in a release build. */
export function PerfLab() {
  const [reading, setReading] = useState<PerformanceReading | null>(null);
  const [running, setRunning] = useState(false);
  const frameRef = useRef<number | null>(null);
  const cancelled = useRef(false);
  useEffect(() => () => {
    cancelled.current = true;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  const run = useCallback(() => {
    if (running) return;
    cancelled.current = false;
    setRunning(true);
    const compileSamples: number[] = [];
    for (let i = 0; i < 300; i++) {
      const scene: LumiScene = LUMI_SCENES[i % LUMI_SCENES.length] ?? 'home';
      const start = now();
      composeScene({ scene, seed: `device-${i}`, density: 'regular' });
      compileSamples.push(now() - start);
    }
    const frameIntervals: number[] = [];
    let last = 0;
    const tick = (timestamp: number) => {
      if (cancelled.current) return;
      if (last !== 0) frameIntervals.push(timestamp - last);
      last = timestamp;
      if (frameIntervals.length < 180) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      compileSamples.sort((a, b) => a - b);
      frameIntervals.sort((a, b) => a - b);
      const result: PerformanceReading = {
        kind: 'lumi-js-device-sample',
        composeP50Ms: round(percentile(compileSamples, 0.50)),
        composeP95Ms: round(percentile(compileSamples, 0.95)),
        frameIntervalP95Ms: round(percentile(frameIntervals, 0.95)),
        frameIntervalsOver16_7Percent: round(100 * frameIntervals.filter(t => t > 16.7).length / frameIntervals.length),
        sampleCount: frameIntervals.length,
        note: 'JS only. Native UI FPS and GPU compositing MUST be profiled separately.',
      };
      setReading(result);
      setRunning(false);
      // Non-sensitive local performance output; collect via device logs if needed.
      console.log('LUMI_PERF_RESULT', JSON.stringify(result));
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [running]);

  return (
    <ScrollView testID="perf-lab" contentContainerStyle={styles.body}>
      <Text style={styles.title}>Performance Lab</Text>
      <Text style={styles.info}>JS kompozice a intervaly requestAnimationFrame. Měř v release buildu na telefonu; tohle není nativní FPS.</Text>
      <Pressable testID="run-js-benchmark" onPress={run} disabled={running} style={styles.button}>
        <Text style={styles.buttonText}>{running ? 'Měřím 180 snímků…' : 'Změřit na zařízení'}</Text>
      </Pressable>
      {reading && <View style={styles.result}>
        <Text testID="perf-results" selectable style={styles.monospace}>{JSON.stringify(reading, null, 2)}</Text>
      </View>}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  body: { padding: 22, paddingBottom: 48, gap: 20 },
  title: { fontSize: 26, fontWeight: '700', color: '#384C4A' },
  info: { color: '#647672', lineHeight: 22 },
  button: { padding: 16, borderRadius: 16, backgroundColor: '#384C4A', alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '700' },
  result: { padding: 14, borderRadius: 16, backgroundColor: '#F1F6F2' },
  monospace: { fontFamily: 'monospace', color: '#384C4A' },
});
