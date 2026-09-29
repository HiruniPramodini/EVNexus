/**
 * OpenStreetMap Nominatim Geocoding & Reverse Geocoding Service Utility for EVNexus
 * Public APIs:
 * - Search: https://nominatim.openstreetmap.org/search
 * - Reverse: https://nominatim.openstreetmap.org/reverse
 * Free geocoding service - No API key required.
 */

export async function searchNominatimLocations(query) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const encodedQuery = encodeURIComponent(query.trim());
  const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=5&addressdetails=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept-Language': 'en'
    }
  });

  if (!response.ok) {
    throw new Error(`Nominatim search request failed with status: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function reverseGeocodeNominatim(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    return null;
  }

  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept-Language': 'en'
    }
  });

  if (!response.ok) {
    throw new Error(`Nominatim reverse geocoding failed with status: ${response.status}`);
  }

  const data = await response.json();
  return data || null;
}
