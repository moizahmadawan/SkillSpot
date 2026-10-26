import { km, inPakistan } from './utils.js';
import { MARKET } from './config.js';
// Approximate centres of Pakistani cities [lng, lat]. Used so a user's city gives a real location
// (for the map and distance matching) even before they share GPS.
const RAW = {
  karachi: [67.0011, 24.8607], lahore: [74.3587, 31.5204], islamabad: [73.0479, 33.6844], rawalpindi: [73.0169, 33.5651], faisalabad: [73.0857, 31.4504],
  multan: [71.5249, 30.1575], peshawar: [71.5249, 34.0151], quetta: [66.975, 30.1798], hyderabad: [68.3737, 25.396], gujranwala: [74.1883, 32.1877],
  sialkot: [74.5229, 32.4945], bahawalpur: [71.6833, 29.4], sargodha: [72.672, 32.0836], sukkur: [68.8228, 27.7052], larkana: [68.2123, 27.56],
  sheikhupura: [73.985, 31.7167], 'rahim yar khan': [70.295, 28.4202], jhang: [72.3258, 31.2681], gujrat: [74.0754, 32.5742], kasur: [74.45, 31.1167],
  mardan: [72.0403, 34.1989], mingora: [72.3611, 34.7717], swat: [72.3611, 34.7717], 'dera ghazi khan': [70.6343, 30.0561], sahiwal: [73.1069, 30.6667],
  okara: [73.4458, 30.8081], wah: [72.7447, 33.7714], 'wah cantt': [72.7447, 33.7714], 'dera ismail khan': [70.9017, 31.8313], abbottabad: [73.2215, 34.1688],
  'mirpur khas': [69.0111, 25.5276], nawabshah: [68.4097, 26.2483], chiniot: [72.9789, 31.7292], kamoke: [74.2231, 31.9747], hafizabad: [73.6881, 32.0709],
  sadiqabad: [70.125, 28.306], burewala: [72.659, 30.1667], jacobabad: [68.4376, 28.2769], muzaffargarh: [71.1933, 30.07], gojra: [72.6844, 31.1497],
  'mandi bahauddin': [73.4833, 32.5833], jhelum: [73.7257, 32.9345], attock: [72.3598, 33.7667], chakwal: [72.8553, 32.9328], bhakkar: [71.0667, 31.6333],
  muzaffarabad: [73.4711, 34.37], mirpur: [73.75, 33.15], gilgit: [74.3, 35.9167], skardu: [75.57, 35.29], kohat: [71.4411, 33.5869], nowshera: [71.9747, 34.0153],
  charsadda: [71.7333, 34.15], bannu: [70.604, 32.9889], turbat: [63.0544, 26.0023], gwadar: [62.3225, 25.1216], khuzdar: [66.61, 27.8], narowal: [74.8731, 32.1019],
  lodhran: [71.6333, 29.5333], vehari: [72.3489, 30.045], layyah: [70.9392, 30.9611], 'toba tek singh': [72.4825, 30.9709], pakpattan: [73.3886, 30.3436],
  khushab: [72.35, 32.3], mianwali: [71.55, 32.58], taxila: [72.8, 33.75], 'tando adam': [68.6667, 25.7667], khanpur: [70.6517, 28.6469],
};
const norm = (s) => String(s || '').toLowerCase().replace(/\bcity\b/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
export function cityLocation(name) {
  const c = RAW[norm(name)];
  return c ? { type: 'Point', coordinates: [...c] } : null;
}
export const validCoords = (lat, lng) => lat != null && lng != null && lat !== '' && lng !== '' && isFinite(+lat) && isFinite(+lng) && Math.abs(+lat) <= 90 && Math.abs(+lng) <= 180;

// Compares the GPS position with the city the user typed. The admin sees this result next to the map.
export function checkLocation(city, lat, lng) {
  if (!inPakistan(+lat, +lng)) return { distanceKm: null, flag: true, note: 'GPS position is outside Pakistan' };
  const c = cityLocation(city);
  if (!c) return { distanceKm: null, flag: false, note: 'City is not in the built-in list, please check the map' };
  const d = km(c.coordinates, [+lng, +lat]); const distanceKm = Math.round(d * 10) / 10;
  return d > MARKET.farLocationKm ? { distanceKm, flag: true, note: `GPS is ${Math.round(d)} km away from ${city}` } : { distanceKm, flag: false, note: 'GPS matches the city' };
}
