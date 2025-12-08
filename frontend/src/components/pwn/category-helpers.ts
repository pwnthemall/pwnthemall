import { Challenge } from "@/models/Challenge";

export interface GeoCoords {
  lat: number;
  lng: number;
}

export function parseGeoCoords(
  flag: string,
  geoCoords: GeoCoords | null
): { lat: number; lng: number } | null {
  // Use coordinates from picker if available
  if (geoCoords && !Number.isNaN(geoCoords.lat) && !Number.isNaN(geoCoords.lng)) {
    return { lat: geoCoords.lat, lng: geoCoords.lng };
  }

  // Try parsing from flag text (lat,lng format)
  const parts = flag.split(',').map((p) => p.trim());
  if (parts.length === 2) {
    const lat = Number.parseFloat(parts[0]);
    const lng = Number.parseFloat(parts[1]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { lat, lng };
    }
  }

  return null;
}

export function buildSubmitPayload(
  challenge: Challenge,
  flag: string,
  geoCoords: GeoCoords | null
): any {
  if (challenge.challengeType?.name?.toLowerCase() === 'geo') {
    const coords = parseGeoCoords(flag, geoCoords);
    return coords || { flag };
  }
  return { flag };
}

export function formatDate(dateString: string): string {
  if (!dateString) return 'Unknown date';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Invalid date';
  }
}
