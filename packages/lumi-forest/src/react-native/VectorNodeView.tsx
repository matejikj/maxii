import React from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { VectorNode } from '../core/vector/types';

/** Direct native SVG elements: no XML tokenization / parser on screen renders. */
function renderNode(node: VectorNode, key: number): React.ReactElement {
  switch (node.kind) {
    case 'group':
      return (
        <G key={key} {...node.props}>
          {node.children.map(renderNode)}
        </G>
      );
    case 'path':
      return <Path key={key} {...node.props} />;
    case 'circle':
      return <Circle key={key} {...node.props} />;
    case 'ellipse':
      return <Ellipse key={key} {...node.props} />;
    case 'rect':
      return <Rect key={key} {...node.props} />;
  }
}

export const VectorNodeView = React.memo(function VectorNodeView({
  nodes,
}: {
  readonly nodes: readonly VectorNode[];
}) {
  return <>{nodes.map(renderNode)}</>;
});
