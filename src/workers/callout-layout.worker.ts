import {
  layoutCallouts,
  layoutCalloutsFast,
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
  progressive?: boolean;
}

let pending: LayoutRequest | undefined;
let refinementTimer: number | undefined;

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const request = event.data;
  const { id, items, route, viewport, options } = request;
  if (!request.progressive) {
    self.postMessage({
      id,
      phase: "final",
      placements: layoutCallouts(items, route, viewport, options),
    });
    return;
  }

  self.postMessage({
    id,
    phase: "preview",
    placements: layoutCalloutsFast(items, route, viewport, options),
  });
  pending = request;
  if (refinementTimer !== undefined) clearTimeout(refinementTimer);
  refinementTimer = self.setTimeout(() => {
    const latest = pending;
    pending = undefined;
    refinementTimer = undefined;
    if (!latest) return;
    self.postMessage({
      id: latest.id,
      phase: "final",
      placements: layoutCallouts(
        latest.items,
        latest.route,
        latest.viewport,
        latest.options,
      ),
    });
  }, 90);
};
