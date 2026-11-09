export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  href?: string;
};

export type BusinessMapGroup = {
  key: string;
  lat: number;
  lng: number;
  points: MapPoint[];
};

export function groupMapPoints(points: MapPoint[]): BusinessMapGroup[] {
  const groups = new Map<string, BusinessMapGroup>();
  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
    const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
    const existing = groups.get(key);
    if (existing) existing.points.push(point);
    else groups.set(key, { key, lat: point.lat, lng: point.lng, points: [point] });
  }
  return [...groups.values()];
}
