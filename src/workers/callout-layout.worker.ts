import {
  layoutCallouts,
  type CalloutItem,
  type LayoutOptions,
  type Point,
} from "../lib/callout-layout";

interface LayoutRequest {
  id: number;
  items: CalloutItem[];
  route: Point[];
  viewport: { width: number; height: number };
  options?: LayoutOptions;
}

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const { id, items, route, viewport, options } = event.data;
  self.postMessage({
    id,
    placements: layoutCallouts(items, route, viewport, options),
  });
};
