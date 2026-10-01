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
const segmentsCross = (a: Point, b: Point, c: Point, d: Point) => {
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

export function layoutCallouts(
  items: CalloutItem[],
  route: Point[],
  viewport: { width: number; height: number },
  options: LayoutOptions = {},
): CalloutPlacement[] {
  const padding = options.padding ?? 10,
    clearance = options.routeClearance ?? 8,
    margin = options.viewportMargin ?? 8;
  const occupied: Box[] = [];
  return items.map((item) => {
    const candidates = candidateBoxes(
      item,
      options.minDistance ?? 18,
      options.maxDistance ?? 242,
      options.distanceStep ?? 32,
    );
    const ranked = candidates
      .map((box, index) => {
        const overlaps = occupied.filter((other) =>
          boxesOverlap(box, other, padding),
        ).length;
        const overflow =
          Math.max(0, margin - box.left) +
          Math.max(0, box.right - viewport.width + margin) +
          Math.max(0, margin - box.top) +
          Math.max(0, box.bottom - viewport.height + margin);
        const score =
          index +
          overlaps * 1_000_000 +
          (boxIntersectsPolyline(box, route, clearance) ? 100_000 : 0) +
          overflow * 10_000;
        return { box, score };
      })
      .sort((a, b) => a.score - b.score);
    const box = ranked[0].box;
    occupied.push(box);
    return {
      ...item,
      box,
      offset: [
        (box.left + box.right) / 2 - item.anchor.x,
        box.bottom - item.anchor.y,
      ],
      connectorStart: nearestPoint(item.anchor, box),
      connectorEnd: item.anchor,
    };
  });
}

export function connectorPath(start: Point, end: Point, curved: boolean) {
  if (!curved) return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  const dx = end.x - start.x,
    dy = end.y - start.y,
    length = Math.max(1, Math.hypot(dx, dy));
  const bend = Math.min(24, length * 0.18);
  return `M ${start.x} ${start.y} Q ${(start.x + end.x) / 2 - (dy / length) * bend} ${(start.y + end.y) / 2 + (dx / length) * bend} ${end.x} ${end.y}`;
}
