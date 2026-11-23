// Use the same accessible labels as keyboard and assistive-technology users.
export function stationField(page, label) {
  return page.getByLabel(label, { exact: true });
}

export async function fillStation(page, name) {
  await stationField(page, /^Station Name$/).fill(name);
  await page.getByLabel('Station Address (Auto-Geocoded)', { exact: true }).fill('Colombo Test Location');
  await page.getByLabel('Latitude', { exact: true }).fill('6.9271');
  await page.getByLabel('Longitude', { exact: true }).fill('79.8612');
  await stationField(page, /^Capacity \(kW\)$/).fill('22');
  await stationField(page, /^Price per kWh \(LKR\)$/).fill('10');
}
