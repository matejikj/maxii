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

test('LUMI_ICON_IDS lists the four caregiver tab glyphs', () => {
  assert.deepEqual([...LUMI_ICON_IDS], ['today', 'care', 'development', 'history']);
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
    assert.ok(countNodes(first.nodes) >= 3, `${id} should contain multiple vector nodes`);
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
});

test('icon color tints geometry without leaking other palette fills', () => {
  const doc = compileLumiIcon('care', { color: '#AABBCC' });
  const props = doc.nodes.flatMap(flatten).map((n) => n.props);
  for (const p of props) {
    if (p.fill && p.fill !== 'none') assert.equal(p.fill, '#AABBCC');
    if (p.stroke) assert.equal(p.stroke, '#AABBCC');
  }
});
