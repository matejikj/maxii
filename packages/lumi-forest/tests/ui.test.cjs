const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolveLumiTheme, contrastRatio, passesTextContrast, relativeLuminance, LUMI_UI_TOKENS } = require('../.test-dist/core/ui');
const scenes = ['home', 'growth', 'sleep', 'feeding', 'milestones'];
const modes = ['light', 'dark'];
const pairs = [['text', 'background'], ['text', 'surface'], ['text', 'surfaceSubtle'], ['textMuted', 'surface'],
  ['textMuted', 'background'], ['onPrimary', 'primary'], ['onSecondary', 'secondary'], ['onDanger', 'danger'],
  ['onSceneAccent', 'sceneAccent']];
for (const mode of modes) {
  for (const scene of scenes) {
    test(`color tokens ${mode}/${scene} meet WCAG AA text contrast`, () => {
      const t = resolveLumiTheme(scene, mode);
      for (const [fg, bg] of pairs) {
        const ratio = contrastRatio(t.colors[fg], t.colors[bg]);
        assert.ok(ratio >= 4.5, `${scene}/${mode}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
      }
    });
  }
}
test('form control outlines meet WCAG non-text contrast', () => {
  for (const mode of modes) for (const scene of scenes) {
    const { colors } = resolveLumiTheme(scene, mode);
    assert.ok(contrastRatio(colors.controlBorder, colors.surface) >= 3, `${scene}/${mode} control border`);
    assert.ok(contrastRatio(colors.focus, colors.surface) >= 3, `${scene}/${mode} focus color`);
  }
});
test('theme instances are stable, immutable and maintain v0.4 compatibility', () => {
  const t = resolveLumiTheme('home', 'light');
  assert.strictEqual(t, resolveLumiTheme('home', 'light'));
  assert.notStrictEqual(t, resolveLumiTheme('home', 'dark'));
  assert.ok(Object.isFrozen(t));
  assert.ok(Object.isFrozen(t.colors));
  assert.equal(t.semantic.surface, t.colors.surface);
  assert.equal(t.semantic.text, t.colors.text);
  assert.ok(t.palette && t.tokens && t.ui);
});
test('UI primitives meet minimum touch heights and regular body text size', () => {
  assert.ok(LUMI_UI_TOKENS.size.touch >= 44);
  assert.ok(LUMI_UI_TOKENS.size.touchCompact >= 44);
  assert.ok(LUMI_UI_TOKENS.size.input >= 44);
  assert.ok(LUMI_UI_TOKENS.type.body.fontSize >= 16);
  assert.ok(LUMI_UI_TOKENS.type.caption.fontSize >= 12);
});
test('contrast helper rejects bad colors and correctly compares extremes', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
  assert.equal(relativeLuminance('#000000'), 0);
  assert.ok(passesTextContrast('#000000', '#FFFFFF'));
  assert.ok(!passesTextContrast('#888888', '#FFFFFF'));
  assert.throws(() => contrastRatio('rgb(0,0,0)', '#FFFFFF'), RangeError);
});
test('all 10 scene/mode combinations have semantic roles', () => {
  const roles = ['background', 'surface', 'surfaceSubtle', 'text', 'textMuted', 'border', 'controlBorder', 'focus', 'primary',
    'onPrimary', 'secondary', 'onSecondary', 'danger', 'onDanger', 'success', 'warning', 'sceneAccent'];
  for (const scene of scenes) for (const mode of modes) {
    const { colors } = resolveLumiTheme(scene, mode);
    for (const role of roles) assert.match(colors[role], /^#[0-9a-fA-F]{6}$/);
  }
});
test('native ui components source visual color only from theme tokens, not local hex colors', () => {
  const files = fs.readdirSync(path.join(__dirname, '../src/react-native/ui')).filter(n => n.endsWith('.tsx'));
  assert.ok(files.length >= 10);
  for (const file of files) {
    const code = fs.readFileSync(path.join(__dirname, '../src/react-native/ui', file), 'utf8');
    assert.doesNotMatch(code, /#[0-9A-Fa-f]{3,8}\b/, `${file} uses a hardcoded color`);
  }
});
test('story catalog covers all key components and uses dedicated bundle entry', () => {
  const root = path.join(__dirname, '../apps/expo-showcase');
  const entries = fs.readdirSync(path.join(root, 'stories')).filter(n => n.endsWith('.stories.tsx'));
  for (const required of ['Buttons', 'Input', 'Card', 'Typography', 'Timeline', 'Chart', 'BottomSheet', 'Controls', 'EmptyState']) {
    assert.ok(entries.includes(required + '.stories.tsx'));
  }
  const metro = fs.readFileSync(path.join(root, 'metro.config.js'), 'utf8');
  assert.match(metro, /withStorybook/);
  assert.match(fs.readFileSync(path.join(root, '.rnstorybook/index.tsx'), 'utf8'), /AppRegistry\.registerComponent/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'App.tsx'), 'utf8'), /\.rnstorybook/);
});
test('screen reader semantics are present for progress, chart, buttons, and modal', () => {
  const root = path.join(__dirname, '../src/react-native/ui');
  for (const [file, marker] of [['LumiButton.tsx', 'accessibilityRole="button"'],
    ['LumiProgress.tsx', 'accessibilityRole="progressbar"'], ['LumiChartContainer.tsx', 'accessibilityRole="image"'],
    ['LumiInput.tsx', 'accessibilityLabel'], ['LumiBottomSheet.tsx', 'onRequestClose={onClose}']]) {
    assert.ok(fs.readFileSync(path.join(root, file), 'utf8').includes(marker), `${file} missing semantic marker`);
  }
});
