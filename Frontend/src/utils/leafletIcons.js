import L from 'leaflet';

/**
 * Custom SVG Marker Icons for EVNexus Leaflet Maps
 * Avoids dependency on default Leaflet PNG image assets.
 */

// Charging Station Marker Icon
export const createStationIcon = (color = '#0284c7', size = 36) => {
  const svgHtml = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 3px 6px rgba(0,0,0,0.3));">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="#ffffff"></circle>
    </svg>
  `;
  return L.divIcon({
    className: 'evnexus-custom-station-icon',
    html: svgHtml,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size]
  });
};

// Search / Pin Location Marker Icon
export const createSearchIcon = (color = '#e11d48', size = 38) => {
  const svgHtml = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 3px 6px rgba(0,0,0,0.35));">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
      <circle cx="12" cy="9" r="2.5" fill="#ffffff"></circle>
    </svg>
  `;
  return L.divIcon({
    className: 'evnexus-custom-search-icon',
    html: svgHtml,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size]
  });
};

// User Live Location Dot Icon
export const createUserLocationIcon = (color = '#0284c7', size = 20) => {
  const svgHtml = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 8px ${color}, 0 2px 6px rgba(0,0,0,0.3);
    "></div>
  `;
  return L.divIcon({
    className: 'evnexus-custom-user-icon',
    html: svgHtml,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
};
