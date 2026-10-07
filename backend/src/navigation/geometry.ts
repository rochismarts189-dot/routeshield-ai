export interface Coordinate { lat: number; lng: number }
const radians = Math.PI / 180;
const earthRadius = 6371000;
const longitudeDelta = (value: number) => ((value + 540) % 360) - 180;

export function decodePolyline(encoded: string): Coordinate[] {
  let index = 0, latitude = 0, longitude = 0;
  const points: Coordinate[] = [];
  function component(): number {
    let result = 0, shift = 0, byte: number;
    do {
      if (index >= encoded.length || shift > 30) throw new Error('INVALID_POLYLINE');
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) throw new Error('INVALID_POLYLINE');
      result |= (byte & 31) << shift; shift += 5;
    } while (byte >= 32);
    return result & 1 ? ~(result >> 1) : result >> 1;
  }
  while (index < encoded.length) {
    latitude += component(); longitude += component();
    const point = { lat: latitude / 1e5, lng: longitude / 1e5 };
    if (Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180 || points.length >= 20000) throw new Error('INVALID_POLYLINE');
    points.push(point);
  }
  if (points.length < 2) throw new Error('INVALID_POLYLINE');
  return points;
}

// Local projection around the reported point; Google HIGH_QUALITY polylines
// describe short segments. Matching is approximate and never proves road identity.
export function distanceToPathMeters(point: Coordinate, path: Coordinate[]): number {
  const scale = Math.cos(point.lat * radians);
  const projected = (p: Coordinate) => ({ x: earthRadius * longitudeDelta(p.lng - point.lng) * radians * scale, y: earthRadius * (p.lat - point.lat) * radians });
  let distance = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = projected(path[i - 1]), b = projected(path[i]);
    const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    const fraction = length ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / length)) : 0;
    distance = Math.min(distance, Math.hypot(a.x + fraction * dx, a.y + fraction * dy));
  }
  return distance;
}
