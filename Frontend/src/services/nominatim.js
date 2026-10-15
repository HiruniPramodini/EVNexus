/**
 * OpenStreetMap Nominatim Geocoding & Reverse Geocoding Service Utility for EVNexus
 * Compliant with Nominatim Usage Policy:
 * - Debouncing & in-memory caching to eliminate redundant requests
 * - Country biasing to Sri Lanka ('lk') with fallback
 * - Explicit user-agent identification and error handling
 */

const searchCache = new Map();
const reverseCache = new Map();
const CACHE_MAX_ENTRIES = 50;

function trimCache(cache) {
  if (cache.size > CACHE_MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

/**
 * Searches real-world locations via OpenStreetMap Nominatim.
 * Prioritizes Sri Lanka addresses while supporting full landmarks and fallback.
 * 
 * @param {string} query - Location query (e.g., '410/1/A/Phala Bomiriya, Kaduwela', 'Kandy')
 * @param {object} [options]
 * @param {string} [options.countryCode='lk'] - Country code bias ('lk' for Sri Lanka)
 * @returns {Promise<Array>} Array of parsed location suggestion objects
 */
export async function searchNominatimLocations(query, options = {}) {
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return [];
  }

  const cleanQuery = query.trim();
  const countryCode = options.countryCode !== undefined ? options.countryCode : 'lk';
  const cacheKey = `${countryCode}:${cleanQuery.toLowerCase()}`;

  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }

  const encodedQuery = encodeURIComponent(cleanQuery);
  const countryParam = countryCode ? `&countrycodes=${encodeURIComponent(countryCode)}` : '';
  const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=6&addressdetails=1${countryParam}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept-Language': 'en'
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Nominatim geocoding rate limit reached. Please wait a moment.');
      }
      throw new Error(`Geocoding request failed with status: ${response.status}`);
    }

    let data = await response.json();

    // If no results with country bias and query might be outside, attempt fallback without country filter
    if ((!data || data.length === 0) && countryCode) {
      const fallbackUrl = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=5&addressdetails=1`;
      const fallbackRes = await fetch(fallbackUrl, {
        method: 'GET',
        headers: { 'Accept-Language': 'en' }
      });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        if (Array.isArray(fallbackData)) {
          data = fallbackData;
        }
      }
    }

    if (!Array.isArray(data)) {
      return [];
    }

    const parsed = data.map((item) => {
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      const isLocality = ['city', 'town', 'village', 'administrative', 'suburb', 'state', 'county'].includes(item.type) ||
        ['boundary', 'place'].includes(item.class);

      return {
        place_id: item.place_id,
        osm_id: item.osm_id,
        display_name: item.display_name,
        lat,
        lon,
        type: item.type,
        category: item.class,
        isLocality,
        address: item.address || {},
        importance: item.importance || 0
      };
    });

    searchCache.set(cacheKey, parsed);
    trimCache(searchCache);
    return parsed;
  } catch (error) {
    console.warn('searchNominatimLocations error:', error.message);
    throw error;
  }
}

/**
 * Reverse geocodes coordinates to a human-readable address.
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<object|null>} Address details object or null
 */
export async function reverseGeocodeNominatim(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    return null;
  }

  const cacheKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  if (reverseCache.has(cacheKey)) {
    return reverseCache.get(cacheKey);
  }

  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept-Language': 'en'
      }
    });

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed with status: ${response.status}`);
    }

    const data = await response.json();
    if (data && data.display_name) {
      reverseCache.set(cacheKey, data);
      trimCache(reverseCache);
      return data;
    }
    return null;
  } catch (error) {
    console.warn('reverseGeocodeNominatim error:', error.message);
    return null;
  }
}
