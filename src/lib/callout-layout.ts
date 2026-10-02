export interface Point {
  x: number;
  y: number;
}
export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface CalloutItem {
  id: string;
  anchor: Point;
  width: number;
  height: number;
}
export interface CalloutPlacement extends CalloutItem {
  box: Box;
  offset: [number, number];
  connectorStart: Point;
  connectorEnd: Point;
}
export interface LayoutOptions {
  padding?: number;
  routeClearance?: number;
  viewportMargin?: number;
  minDistance?: number;
  maxDistance?: number;
  distanceStep?: number;
  optimizationPasses?: number;
  startingLayouts?: number;
}

export const boxesOverlap = (a: Box, b: Box, padding = 0) =>
  a.left < b.right + padding &&
  a.right + padding > b.left &&
  a.top < b.bottom + padding &&
  a.bottom + padding > b.top;

const inside = (p: Point, b: Box) =>
  p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom;
const cross = (a: Point, b: Point, c: Point) =>
  (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
export const segmentsCross = (a: Point, b: Point, c: Point, d: Point) => {
  const [a1, a2, b1, b2] = [
    cross(a, b, c),
    cross(a, b, d),
    cross(c, d, a),
    cross(c, d, b),
  ];
  return (
    ((a1 > 0 && a2 < 0) || (a1 < 0 && a2 > 0)) &&
    ((b1 > 0 && b2 < 0) || (b1 < 0 && b2 > 0))
  );
};

const boxOverflow = (
  box: Box,
  viewport: { width: number; height: number },
  margin: number,
) =>
  Math.max(0, margin - box.left) +
  Math.max(0, box.right - viewport.width + margin) +
  Math.max(0, margin - box.top) +
  Math.max(0, box.bottom - viewport.height + margin);

const overlapArea = (a: Box, b: Box, padding: number) =>
  Math.max(
    0,
    Math.min(a.right + padding, b.right + padding) - Math.max(a.left, b.left),
  ) *
  Math.max(
    0,
    Math.min(a.bottom + padding, b.bottom + padding) - Math.max(a.top, b.top),
  );

export function segmentIntersectsBox(a: Point, b: Point, box: Box) {
  if (inside(a, box) || inside(b, box)) return true;
  const tl = { x: box.left, y: box.top },
    tr = { x: box.right, y: box.top };
  const br = { x: box.right, y: box.bottom },
    bl = { x: box.left, y: box.bottom };
  return (
    segmentsCross(a, b, tl, tr) ||
    segmentsCross(a, b, tr, br) ||
    segmentsCross(a, b, br, bl) ||
    segmentsCross(a, b, bl, tl)
  );
}

export function boxIntersectsPolyline(box: Box, route: Point[], clearance = 0) {
  const expanded = {
    left: box.left - clearance,
    right: box.right + clearance,
    top: box.top - clearance,
    bottom: box.bottom + clearance,
  };
  for (let i = 1; i < route.length; i += 1)
    if (segmentIntersectsBox(route[i - 1], route[i], expanded)) return true;
  return false;
}

const nearestPoint = (anchor: Point, box: Box): Point => ({
  x: Math.max(box.left, Math.min(anchor.x, box.right)),
  y: Math.max(box.top, Math.min(anchor.y, box.bottom)),
});

const candidateBoxes = (
  item: CalloutItem,
  min: number,
  max: number,
  step: number,
) => {
  const directions = [
    [0, -1],
    [1, -1],
    [-1, -1],
    [1, 0],
    [-1, 0],
    [1, 1],
    [-1, 1],
    [0, 1],
  ];
  const result: Box[] = [];
  for (let distance = min; distance <= max; distance += step)
    directions.forEach(([dx, dy]) => {
      const left =
        dx === 0
          ? item.anchor.x - item.width / 2
          : dx > 0
            ? item.anchor.x + distance
            : item.anchor.x - distance - item.width;
      const top =
        dy === 0
          ? item.anchor.y - item.height / 2
          : dy < 0
            ? item.anchor.y - distance - item.height
            : item.anchor.y + distance;
      result.push({
        left,
        right: left + item.width,
        top,
        bottom: top + item.height,
      });
    });
  return result;
};

interface Candidate extends CalloutPlacement {
  preference: number;
  distance: number;
}

const createCandidates = (
  item: CalloutItem,
  min: number,
  max: number,
  step: number,
): Candidate[] =>
  candidateBoxes(item, min, max, step).map((box, preference) => {
    const connectorStart = nearestPoint(item.anchor, box);
    return {
      ...item,
      box,
      offset: [
        (box.left + box.right) / 2 - item.anchor.x,
        box.bottom - item.anchor.y,
      ],
      connectorStart,
      connectorEnd: item.anchor,
      preference,
      distance: Math.hypot(
        connectorStart.x - item.anchor.x,
        connectorStart.y - item.anchor.y,
      ),
    };
  });

export interface LayoutMetrics {
  overlaps: number;
  routeIntersections: number;
  connectorCrossings: number;
  connectorBoxIntersections: number;
  overflow: number;
  totalDistance: number;
  maximumDistance: number;
}

export function measureLayout(
  placements: CalloutPlacement[],
  route: Point[],
  viewport: { width: number; height: number },
  options: LayoutOptions = {},
): LayoutMetrics {
  const padding = options.padding ?? 10;
  const clearance = options.routeClearance ?? 8;
  const margin = options.viewportMargin ?? 8;
  const metrics: LayoutMetrics = {
    overlaps: 0,
    routeIntersections: 0,
    connectorCrossings: 0,
    connectorBoxIntersections: 0,
    overflow: 0,
    totalDistance: 0,
    maximumDistance: 0,
  };
  placements.forEach((placement) => {
    const distance = Math.hypot(
      placement.connectorStart.x - placement.connectorEnd.x,
      placement.connectorStart.y - placement.connectorEnd.y,
    );
    metrics.totalDistance += distance;
    metrics.maximumDistance = Math.max(metrics.maximumDistance, distance);
    metrics.overflow += boxOverflow(placement.box, viewport, margin);
    if (boxIntersectsPolyline(placement.box, route, clearance))
      metrics.routeIntersections += 1;
  });
  for (let first = 0; first < placements.length; first += 1) {
    for (let second = first + 1; second < placements.length; second += 1) {
      const a = placements[first];
      const b = placements[second];
      if (boxesOverlap(a.box, b.box, padding)) metrics.overlaps += 1;
      if (
        segmentsCross(
          a.connectorStart,
          a.connectorEnd,
          b.connectorStart,
          b.connectorEnd,
        )
      )
        metrics.connectorCrossings += 1;
      if (segmentIntersectsBox(a.connectorStart, a.connectorEnd, b.box))
        metrics.connectorBoxIntersections += 1;
      if (segmentIntersectsBox(b.connectorStart, b.connectorEnd, a.box))
        metrics.connectorBoxIntersections += 1;
    }
  }
  return metrics;
}

const scoreLayout = (
  placements: Candidate[],
  route: Point[],
  viewport: { width: number; height: number },
  options: LayoutOptions,
) => {
  const metrics = measureLayout(placements, route, viewport, options);
  const padding = options.padding ?? 10;
  let overlapSeverity = 0;
  for (let first = 0; first < placements.length; first += 1)
    for (let second = first + 1; second < placements.length; second += 1)
      overlapSeverity += overlapArea(
        placements[first].box,
        placements[second].box,
        padding,
      );
  return (
    metrics.overlaps * 1_000_000_000 +
    overlapSeverity * 1_000_000 +
    metrics.routeIntersections * 300_000_000 +
    metrics.connectorBoxIntersections * 150_000_000 +
    metrics.connectorCrossings * 10_000_000 +
    metrics.overflow * 20_000_000 +
    metrics.totalDistance * 100 +
    metrics.maximumDistance * 25 +
    placements.reduce((sum, placement) => sum + placement.preference, 0) * 0.001
  );
};

const optimize = (
  initial: Candidate[],
  candidates: Candidate[][],
  route: Point[],
  viewport: { width: number; height: number },
  options: LayoutOptions,
) => {
  const placements = [...initial];
  let score = scoreLayout(placements, route, viewport, options);
  for (let pass = 0; pass < (options.optimizationPasses ?? 8); pass += 1) {
    let improved = false;
    for (let index = 0; index < placements.length; index += 1) {
      let best = placements[index];
      let bestScore = score;
      for (const candidate of candidates[index]) {
        if (candidate === placements[index]) continue;
        const previous = placements[index];
        placements[index] = candidate;
        const candidateScore = scoreLayout(
          placements,
          route,
          viewport,
          options,
        );
        placements[index] = previous;
        if (candidateScore < bestScore) {
          best = candidate;
          bestScore = candidateScore;
        }
      }
      if (best !== placements[index]) {
        placements[index] = best;
        score = bestScore;
        improved = true;
      }
    }
    if (!improved) break;
  }
  return { placements, score };
};

export function layoutCalloutsFast(
  items: CalloutItem[],
  route: Point[],
  viewport: { width: number; height: number },
  options: LayoutOptions = {},
): CalloutPlacement[] {
  const padding = options.padding ?? 10;
  const clearance = options.routeClearance ?? 8;
  const margin = options.viewportMargin ?? 8;
  const placed: Candidate[] = [];
  items.forEach((item) => {
    const candidates = createCandidates(
      item,
      options.minDistance ?? 18,
      options.maxDistance ?? 242,
      options.distanceStep ?? 32,
    );
    let best = candidates[0];
    let bestScore = Number.POSITIVE_INFINITY;
    candidates.forEach((candidate) => {
      const overlaps = placed.filter((other) =>
        boxesOverlap(candidate.box, other.box, padding),
      ).length;
      const connectorBoxes = placed.filter((other) =>
        segmentIntersectsBox(
          candidate.connectorStart,
          candidate.connectorEnd,
          other.box,
        ),
      ).length;
      const connectorCrossings = placed.filter((other) =>
        segmentsCross(
          candidate.connectorStart,
          candidate.connectorEnd,
          other.connectorStart,
          other.connectorEnd,
        ),
      ).length;
      const score =
        overlaps * 1_000_000_000 +
        (boxIntersectsPolyline(candidate.box, route, clearance)
          ? 300_000_000
          : 0) +
        connectorBoxes * 150_000_000 +
        connectorCrossings * 10_000_000 +
        boxOverflow(candidate.box, viewport, margin) * 20_000_000 +
        candidate.distance * 100 +
        candidate.preference * 0.001;
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    });
    placed.push(best);
  });
  return placed.map(
    ({ preference: _preference, distance: _distance, ...placement }) =>
      placement,
  );
}

export function layoutCallouts(
  items: CalloutItem[],
  route: Point[],
  viewport: { width: number; height: number },
  options: LayoutOptions = {},
): CalloutPlacement[] {
  if (!items.length) return [];
  const candidates = items.map((item) =>
    createCandidates(
      item,
      options.minDistance ?? 18,
      options.maxDistance ?? 242,
      options.distanceStep ?? 32,
    ),
  );

  const orders = [
    items.map((_, index) => index),
    items.map((_, index) => index).reverse(),
    items
      .map((item, index) => ({ index, area: item.width * item.height }))
      .sort((a, b) => b.area - a.area)
      .map(({ index }) => index),
    items
      .map((item, index) => ({ index, x: item.anchor.x }))
      .sort((a, b) => a.x - b.x)
      .map(({ index }) => index),
  ];

  let best: { placements: Candidate[]; score: number } | undefined;
  orders.slice(0, options.startingLayouts ?? 4).forEach((order) => {
    const initial = new Array<Candidate>(items.length);
    order.forEach((index) => {
      let chosen = candidates[index][0];
      let chosenScore = Number.POSITIVE_INFINITY;
      candidates[index].forEach((candidate) => {
        const partial = [...initial.filter(Boolean), candidate];
        const score = scoreLayout(partial, route, viewport, options);
        if (score < chosenScore) {
          chosen = candidate;
          chosenScore = score;
        }
      });
      initial[index] = chosen;
    });
    const optimized = optimize(initial, candidates, route, viewport, options);
    if (!best || optimized.score < best.score) best = optimized;
  });

  return (best?.placements ?? candidates.map((list) => list[0])).map(
    ({ preference: _preference, distance: _distance, ...placement }) =>
      placement,
  );
}

export function connectorPath(start: Point, end: Point, curved: boolean) {
  if (!curved) return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  const dx = end.x - start.x,
    dy = end.y - start.y,
    length = Math.max(1, Math.hypot(dx, dy));
  const bend = Math.min(24, length * 0.18);
  return `M ${start.x} ${start.y} Q ${(start.x + end.x) / 2 - (dy / length) * bend} ${(start.y + end.y) / 2 + (dx / length) * bend} ${end.x} ${end.y}`;
}
