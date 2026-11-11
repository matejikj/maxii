const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  compileLumiIcon,
  isKnownLumiIconId,
  LUMI_ICON_IDS,
  ICON_SIZE,
  serializeVectorNode,
} = require('../.test-dist/core/index.js');

const COLOR = '#304E42';

function flatten(node) {
  return node.kind === 'group' ? [node, ...node.children.flatMap(flatten)] : [node];
}

function countNodes(nodes) {
  return nodes.reduce((sum, node) => sum + flatten(node).length, 0);
}

test('LUMI_ICON_IDS preserves tab meanings and adds care / action glyphs', () => {
  assert.deepEqual([...LUMI_ICON_IDS], [
    'today', 'care', 'development', 'history',
    'sleep', 'nursing', 'bottle', 'food', 'diaper', 'growth', 'plus', 'arrow-right',
    'experience', 'settings',
  ]);
  assert.equal(ICON_SIZE, 24);
});

for (const id of LUMI_ICON_IDS) {
  test(`compileLumiIcon(${id}) is 24px, frozen, and deterministic`, () => {
    const first = compileLumiIcon(id, { color: COLOR });
    const second = compileLumiIcon(id, { color: COLOR });
    assert.equal(first.schemaVersion, 1);
    assert.equal(first.id, id);
    assert.equal(first.width, 24);
    assert.equal(first.height, 24);
    assert.ok(Object.isFrozen(first));
    assert.ok(first.nodes.length >= 1);
    assert.ok(countNodes(first.nodes) >= (['plus', 'arrow-right'].includes(id) ? 1 : 3));
    assert.ok(countNodes(first.nodes) <= 12, `${id} stays a compact glyph`);
    assert.deepEqual(first, second);
    const xml = first.nodes.map(serializeVectorNode).join('');
    assert.equal(xml, second.nodes.map(serializeVectorNode).join(''));
    assert.ok(xml.includes(COLOR));
  });
}

test('compileLumiIcon fails closed on unknown id and empty color', () => {
  assert.equal(isKnownLumiIconId('today'), true);
  assert.equal(isKnownLumiIconId('missing'), false);
  assert.throws(() => compileLumiIcon('missing', { color: COLOR }), /Unknown Lumi icon id/);
  assert.throws(() => compileLumiIcon('today', { color: '' }), /non-empty color/);
  assert.throws(() => compileLumiIcon('today', { color: COLOR, accentColor: '' }), /non-empty accentColor/);
});

test('optional botanical accent keeps semantic ink and uses only caller colors', () => {
  for (const id of LUMI_ICON_IDS) {
    const document = compileLumiIcon(id, { color: COLOR, accentColor: '#B09058' });
    const props = document.nodes.flatMap(flatten).map(node => node.props);
    assert.ok(props.some(p => p.stroke === COLOR || p.fill === COLOR));
    for (const p of props) {
      if (p.fill && p.fill !== 'none') assert.ok([COLOR, '#B09058'].includes(p.fill));
      if (p.stroke) assert.ok([COLOR, '#B09058'].includes(p.stroke));
    }
    if (!['plus', 'arrow-right'].includes(id)) {
      assert.ok(props.some(p => p.stroke === '#B09058' || p.fill === '#B09058'));
    }
  }
});

test('icon color tints geometry without leaking other palette fills', () => {
  const doc = compileLumiIcon('care', { color: '#AABBCC' });
  const props = doc.nodes.flatMap(flatten).map((n) => n.props);
  for (const p of props) {
    if (p.fill && p.fill !== 'none') assert.equal(p.fill, '#AABBCC');
    if (p.stroke) assert.equal(p.stroke, '#AABBCC');
  }
});
