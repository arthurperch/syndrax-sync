/**
 * Address Parser - Clean TypeScript port from obfuscated address_parser.js
 * Parses addresses from various formats including international addresses
 */

export interface ParsedAddress {
  name: string | null;
  country: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  postalCode: string | null;
  stateOrProvince: string | null;
  phoneNumber: string | null;
  emailAddress: string | null;
  website: string | null;
}

// 195-country ISO code lookup table
const COUNTRY_CODES: Record<string, string> = {
  AD: 'Andorra', AE: 'United Arab Emirates', AF: 'Afghanistan', AG: 'Antigua and Barbuda',
  AI: 'Anguilla', AL: 'Albania', AM: 'Armenia', AO: 'Angola', AR: 'Argentina', AT: 'Austria',
  AU: 'Australia', AZ: 'Azerbaijan', BA: 'Bosnia and Herzegovina', BB: 'Barbados',
  BD: 'Bangladesh', BE: 'Belgium', BF: 'Burkina Faso', BG: 'Bulgaria', BH: 'Bahrain',
  BI: 'Burundi', BJ: 'Benin', BN: 'Brunei', BO: 'Bolivia', BR: 'Brazil', BS: 'Bahamas',
  BT: 'Bhutan', BW: 'Botswana', BY: 'Belarus', BZ: 'Belize', CA: 'Canada',
  CD: 'Democratic Republic of the Congo', CF: 'Central African Republic',
  CG: 'Republic of the Congo', CH: 'Switzerland', CI: 'Côte d\'Ivoire', CL: 'Chile',
  CM: 'Cameroon', CN: 'China', CO: 'Colombia', CR: 'Costa Rica', CU: 'Cuba', CV: 'Cabo Verde',
  CY: 'Cyprus', CZ: 'Czech Republic', DE: 'Germany', DJ: 'Djibouti', DK: 'Denmark',
  DM: 'Dominica', DO: 'Dominican Republic', DZ: 'Algeria', EC: 'Ecuador', EE: 'Estonia',
  EG: 'Egypt', EH: 'Western Sahara', ER: 'Eritrea', ES: 'Spain', ET: 'Ethiopia', FI: 'Finland',
  FJ: 'Fiji', FM: 'Micronesia', FR: 'France', GA: 'Gabon', GB: 'United Kingdom', GD: 'Grenada',
  GE: 'Georgia', GH: 'Ghana', GI: 'Gibraltar', GL: 'Greenland', GM: 'Gambia', GN: 'Guinea',
  GQ: 'Equatorial Guinea', GR: 'Greece', GT: 'Guatemala', GW: 'Guinea-Bissau', GY: 'Guyana',
  HK: 'Hong Kong', HN: 'Honduras', HR: 'Croatia', HT: 'Haiti', HU: 'Hungary', ID: 'Indonesia',
  IE: 'Ireland', IL: 'Israel', IN: 'India', IQ: 'Iraq', IR: 'Iran', IS: 'Iceland', IT: 'Italy',
  JM: 'Jamaica', JO: 'Jordan', JP: 'Japan', KE: 'Kenya', KG: 'Kyrgyzstan', KH: 'Cambodia',
  KI: 'Kiribati', KM: 'Comoros', KN: 'Saint Kitts and Nevis', KP: 'North Korea',
  KR: 'South Korea', KW: 'Kuwait', KZ: 'Kazakhstan', LA: 'Laos', LB: 'Lebanon',
  LC: 'Saint Lucia', LI: 'Liechtenstein', LK: 'Sri Lanka', LR: 'Liberia', LS: 'Lesotho',
  LT: 'Lithuania', LU: 'Luxembourg', LV: 'Latvia', LY: 'Libya', MA: 'Morocco', MC: 'Monaco',
  MD: 'Moldova', ME: 'Montenegro', MG: 'Madagascar', MH: 'Marshall Islands',
  MK: 'North Macedonia', ML: 'Mali', MM: 'Myanmar', MN: 'Mongolia', MR: 'Mauritania',
  MT: 'Malta', MU: 'Mauritius', MV: 'Maldives', MW: 'Malawi', MX: 'Mexico', MY: 'Malaysia',
  MZ: 'Mozambique', NA: 'Namibia', NE: 'Niger', NG: 'Nigeria', NI: 'Nicaragua',
  NL: 'Netherlands', NO: 'Norway', NP: 'Nepal', NR: 'Nauru', NZ: 'New Zealand', OM: 'Oman',
  PA: 'Panama', PE: 'Peru', PG: 'Papua New Guinea', PH: 'Philippines', PK: 'Pakistan',
  PL: 'Poland', PT: 'Portugal', PW: 'Palau', PY: 'Paraguay', QA: 'Qatar', RO: 'Romania',
  RS: 'Serbia', RU: 'Russia', RW: 'Rwanda', SA: 'Saudi Arabia', SB: 'Solomon Islands',
  SC: 'Seychelles', SD: 'Sudan', SE: 'Sweden', SG: 'Singapore', SI: 'Slovenia',
  SK: 'Slovakia', SL: 'Sierra Leone', SM: 'San Marino', SN: 'Senegal', SO: 'Somalia',
  SR: 'Suriname', ST: 'São Tomé and Príncipe', SV: 'El Salvador', SY: 'Syria',
  SZ: 'Eswatini', TD: 'Chad', TG: 'Togo', TH: 'Thailand', TJ: 'Tajikistan', TL: 'Timor-Leste',
  TM: 'Turkmenistan', TN: 'Tunisia', TO: 'Tonga', TR: 'Turkey', TT: 'Trinidad and Tobago',
  TV: 'Tuvalu', TW: 'Taiwan', TZ: 'Tanzania', UA: 'Ukraine', UG: 'Uganda',
  US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan', VA: 'Vatican City',
  VC: 'Saint Vincent and the Grenadines', VE: 'Venezuela', VN: 'Vietnam',
  VU: 'Vanuatu', WS: 'Samoa', YE: 'Yemen', ZA: 'South Africa', ZM: 'Zambia', ZW: 'Zimbabwe'
};

// Canadian province codes
const CANADA_PROVINCES: Record<string, string> = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', NT: 'Northwest Territories',
  NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec',
  SK: 'Saskatchewan', YT: 'Yukon'
};

// Company suffixes to strip
const COMPANY_SUFFIXES = [
  'ltd', 'llc', 'inc', 'gmbh', 'corp', 'plc', 'lp', 'sarl', 'srl', 's.r.l.', 's.l.', 's.a.',
  'pvt', 'pty', 'ag', 'bv', 'nv', 'oy', 'ab', 'as', 'kg', 'kgaa', 'zrt', 's.p.a', 'sa', 'sas',
  'ulc', 'lllp', 'llp', 'pte', 'limited', 'limitada', 'sociedad limitada',
  'kabushiki kaisha', 'gongsi'
];

// Chinese provinces for AliExpress parsing
const CHINESE_PROVINCES = [
  'anhui', 'beijing', 'chongqing', 'fujian', 'gansu', 'guangdong', 'guangxi',
  'guangzhou', 'hainan', 'hebei', 'heilongjiang', 'henan', 'hubei', 'hunan',
  'inner mongolia', 'jiangsu', 'jiangxi', 'jilin', 'liaoning', 'macau',
  'neimenggu', 'ningxia', 'qinghai', 'shaanxi', 'shandong', 'shanghai',
  'shanxi', 'sichuan', 'taiwan', 'tianjin', 'tibet', 'xizang', 'xinjiang',
  'yunnan', 'zhejiang'
];

function isEmail(line: string): boolean {
  return line.includes('@');
}

function isWebsite(line: string): boolean {
  return line.includes('http') || line.includes('www');
}

function isPhone(line: string): boolean {
  return /^\+?\d[\d\s\-()]+$/.test(line) && !isEmail(line) && !isWebsite(line);
}

function isCompanyName(line: string): boolean {
  if (!line) return false;
  const lower = line.toLowerCase();
  const words = lower.split(/[^a-z0-9.]+/).filter(Boolean);
  
  for (const word of words) {
    const cleaned = word.replace(/[^a-z0-9.]+$/g, '');
    for (const suffix of COMPANY_SUFFIXES) {
      if (cleaned === suffix.toLowerCase()) return true;
    }
  }
  return false;
}

function findCountryInLine(line: string): string | null {
  const parts = line.split(',').map(p => p.trim()).filter(Boolean);
  
  for (const part of parts) {
    const cleaned = part.replace(/[^A-Za-z]/g, '');
    const upper = cleaned.toUpperCase();
    
    // Check ISO code
    if (COUNTRY_CODES[upper]) return upper;
    
    // Check country name
    const entry = Object.entries(COUNTRY_CODES).find(([, name]) => 
      name.toUpperCase() === upper
    );
    if (entry) return entry[0];
  }
  
  return null;
}

function findNameLine(lines: string[]): string | null {
  // Find company name first
  const companyLine = lines.find(isCompanyName);
  if (companyLine) return companyLine;
  
  // Find line with 2+ capitalized words
  const namePattern = (line: string) => {
    const words = line.split(/\s+/);
    let capCount = 0;
    for (const word of words) {
      if (/^[A-Z][a-z]/.test(word)) capCount++;
    }
    return capCount >= 2;
  };
  
  const nameLine = lines.find(namePattern);
  if (nameLine) return nameLine;
  
  // Fallback to first line
  if (lines.length > 0) return lines[0];
  return null;
}

export function parseFirstAddress(text: string): ParsedAddress {
  const allLines = text.split('\n');
  const lines: string[] = [];
  
  // Read until blank line
  for (const line of allLines) {
    if (line.trim() === '') break;
    lines.push(line.trim());
  }
  
  const nonEmptyLines = lines.filter(l => l !== '');
  
  const result: ParsedAddress = {
    name: null,
    country: null,
    address1: null,
    address2: null,
    city: null,
    postalCode: null,
    stateOrProvince: null,
    phoneNumber: null,
    emailAddress: null,
    website: null
  };
  
  if (nonEmptyLines.length === 0) return result;
  
  // Find country
  let countryFound = false;
  let countryCode: string | null = null;
  
  for (const line of nonEmptyLines) {
    const parts = line.split(',').map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      const code = findCountryInLine(part);
      if (code) {
        countryFound = true;
        countryCode = code;
        break;
      }
    }
    if (countryFound) break;
  }
  
  if (!countryFound) return result;
  
  result.country = countryCode;
  
  // Find address line (line with country and 3+ comma-separated parts)
  let addressLineIndex = -0x1;
  const preAddressLines: string[] = [];
  
  for (let i = 0; i < nonEmptyLines.length; i++) {
    const line = nonEmptyLines[i];
    const parts = line.split(',').map(p => p.trim()).filter(Boolean);
    
    let hasCountry = false;
    for (const part of parts) {
      if (findCountryInLine(part)) {
        hasCountry = true;
        break;
      }
    }
    
    if (hasCountry && parts.length >= 3) {
      addressLineIndex = i;
      break;
    } else {
      preAddressLines.push(line);
    }
  }
  
  // Find name
  const nameLine = findNameLine(preAddressLines);
  result.name = nameLine || null;
  
  // Extract address2 from pre-address lines
  const nameIndex = preAddressLines.indexOf(result.name!);
  const afterNameLines = nameIndex !== -1 ? preAddressLines.slice(nameIndex + 1) : preAddressLines;
  
  if (afterNameLines.length > 0) {
    result.address1 = afterNameLines[0];
  } else {
    const nameIdx = nonEmptyLines.indexOf(result.name!);
    if (nameIdx !== -1 && nameIdx + 1 < nonEmptyLines.length) {
      result.address1 = nonEmptyLines[nameIdx + 1];
    }
  }
  
  if (afterNameLines.length > 1) {
    const addr2Line = afterNameLines.slice(1).find(l => !isEmail(l) && !isWebsite(l));
    if (addr2Line) result.address2 = addr2Line;
  }
  
  // Parse address line
  let city: string | null = null;
  let postal: string | null = null;
  let state: string | null = null;
  
  if (addressLineIndex !== -1) {
    const addressLine = nonEmptyLines[addressLineIndex];
    const parts = addressLine.split(',').map(p => p.trim()).filter(Boolean);
    
    let countryPartIndex = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (findCountryInLine(parts[i])) {
        countryPartIndex = i;
        break;
      }
    }
    
    if (countryPartIndex !== -1) {
      const beforeCountry = parts.slice(0, countryPartIndex);
      const afterCountry = parts.slice(countryPartIndex + 1);
      
      if (afterCountry.length > 0 && /\d/.test(afterCountry[0])) {
        postal = afterCountry[0];
      }
      
      if (beforeCountry.length > 2) {
        city = beforeCountry.slice(0, -1).join(', ');
        state = beforeCountry[beforeCountry.length - 1];
      } else if (beforeCountry.length === 2) {
        city = beforeCountry[0];
        state = beforeCountry[1];
      } else if (beforeCountry.length === 1) {
        city = beforeCountry[0];
      }
    }
  }
  
  result.city = city || result.country;
  result.postalCode = postal || result.country;
  result.stateOrProvince = state || result.country;
  
  // Truncate postal code
  if (result.postalCode && result.postalCode.length > 9) {
    result.postalCode = result.postalCode.substring(0, 9);
  }
  
  // Extract email, phone, website
  for (const line of nonEmptyLines) {
    if (!result.emailAddress && isEmail(line)) result.emailAddress = line;
    if (!result.website && isWebsite(line)) result.website = line;
    if (!result.phoneNumber && isPhone(line)) result.phoneNumber = line;
    if (result.emailAddress && result.website && result.phoneNumber) break;
  }
  
  // CRITICAL: Germany/Deutschland special case - swap address1 and address2
  if (result.country === 'DE' || result.city?.toLowerCase() === 'germany' || result.city?.toLowerCase() === 'deutschland') {
    const temp = result.address1;
    result.address1 = result.address2;
    result.address2 = temp;
  }
  
  // CRITICAL: Canada province code conversion
  if (result.country === 'CA' && result.stateOrProvince && result.stateOrProvince.length === 2) {
    const fullProvince = CANADA_PROVINCES[result.stateOrProvince.toUpperCase()];
    if (fullProvince) result.stateOrProvince = fullProvince;
  }
  
  return result;
}

export function parseFallbackAddress(text: string): ParsedAddress {
  const lines = text.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  
  const result: ParsedAddress = {
    name: null,
    country: null,
    address1: null,
    address2: null,
    city: null,
    postalCode: null,
    stateOrProvince: null,
    phoneNumber: null,
    emailAddress: null,
    website: null
  };
  
  // Extract email, phone, website first
  for (const line of lines) {
    if (!result.emailAddress && isEmail(line)) result.emailAddress = line;
    if (!result.website && isWebsite(line)) result.website = line;
    if (!result.phoneNumber && isPhone(line)) result.phoneNumber = line;
  }
  
  // Filter out email/phone/website lines
  const addressLines = lines.filter(l => !isEmail(l) && !isWebsite(l) && !isPhone(l));
  
  // City lookup table
  const cityLookup: Record<string, { c: string; s: string }> = {
    frankfurt: { c: 'DE', s: 'HE' }, hamburg: { c: 'DE', s: 'HH' }, berlin: { c: 'DE', s: 'BE' },
    munich: { c: 'DE', s: 'BY' }, stuttgart: { c: 'DE', s: 'BW' }, leipzig: { c: 'DE', s: 'SN' },
    cologne: { c: 'DE', s: 'NW' }, madrid: { c: 'ES', s: 'M' }, barcelona: { c: 'ES', s: 'B' },
    fuenlabrada: { c: 'ES', s: 'M' }, valencia: { c: 'ES', s: 'V' }, sevilla: { c: 'ES', s: 'SE' },
    bilbao: { c: 'ES', s: 'BI' }, vienna: { c: 'AT', s: 'W' }, graz: { c: 'AT', s: 'ST' },
    salzburg: { c: 'AT', s: 'S' }, innsbruck: { c: 'AT', s: 'T' }, zurich: { c: 'CH', s: 'ZH' },
    geneva: { c: 'CH', s: 'GE' }, basel: { c: 'CH', s: 'BS' }, bern: { c: 'CH', s: 'BE' },
    paris: { c: 'FR', s: 'IDF' }, lyon: { c: 'FR', s: 'ARA' }, marseille: { c: 'FR', s: 'PAC' },
    toulouse: { c: 'FR', s: 'OCC' }, london: { c: 'GB', s: 'ENG' }, manchester: { c: 'GB', s: 'ENG' },
    birmingham: { c: 'GB', s: 'ENG' }, glasgow: { c: 'GB', s: 'SCT' }
  };
  
  let inferred = { c: null as string | null, s: null as string | null, city: null as string | null, postal: null as string | null };
  
  // Check for country name in lines
  const countryNames: Record<string, string> = {
    ES: 'spain', DE: 'germany', AT: 'austria', CH: 'switzerland', FR: 'france', GB: 'united kingdom'
  };
  
  for (const line of addressLines) {
    for (const [code, name] of Object.entries(countryNames)) {
      if (line.toLowerCase().endsWith(name)) {
        inferred.c = code;
        break;
      }
    }
    if (inferred.c) break;
  }
  
  // City lookup
  if (!inferred.c) {
    for (const line of addressLines) {
      const lower = line.toLowerCase().replace(/[^a-z]/g, '');
      for (const [cityName, data] of Object.entries(cityLookup)) {
        if (lower.includes(cityName)) {
          inferred = { ...inferred, ...data, city: cityName };
          break;
        }
      }
      if (inferred.c) break;
    }
  }
  
  // Postal code patterns
  if (!inferred.c) {
    for (const line of addressLines) {
      // German postal codes
      if (/^\d{5}$/.test(line)) {
        const num = parseInt(line);
        if (num >= 60000 && num <= 69999) { inferred.c = 'DE'; inferred.s = 'HE'; inferred.postal = line; break; }
        if (num >= 10000 && num <= 19999) { inferred.c = 'DE'; inferred.s = 'BE'; inferred.postal = line; break; }
        if (num >= 10000 && num <= 99999) { inferred.c = 'DE'; inferred.postal = line; break; }
      }
      // Spanish postal codes
      if (/^08\d{3}$/.test(line)) { inferred.c = 'ES'; inferred.s = 'B'; inferred.postal = line; break; }
      if (/^28\d{3}$/.test(line)) { inferred.c = 'ES'; inferred.s = 'M'; inferred.postal = line; break; }
      if (/^46\d{3}$/.test(line)) { inferred.c = 'ES'; inferred.s = 'V'; inferred.postal = line; break; }
      // Austrian postal codes
      if (/^\d{4}$/.test(line)) {
        const num = parseInt(line);
        if (num >= 1000 && num <= 1999) { inferred.c = 'AT'; inferred.s = 'W'; inferred.postal = line; break; }
        if (num >= 8000 && num <= 8999) { inferred.c = 'CH'; inferred.s = 'ZH'; inferred.postal = line; break; }
      }
      // UK postal codes
      if (/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(line)) { inferred.c = 'GB'; inferred.postal = line; break; }
      // US postal codes
      if (/^\d{5}(-\d{4})?$/.test(line)) { inferred.c = 'US'; inferred.postal = line; break; }
    }
  }
  
  // Street indicators
  if (!inferred.c) {
    if (addressLines.some(l => /straße|str\./i.test(l))) inferred.c = 'DE';
    if (addressLines.some(l => /sociedad limitada|s\.l\./i.test(l))) inferred.c = 'ES';
  }
  
  result.country = inferred.c;
  result.stateOrProvince = inferred.s;
  result.city = inferred.city ? inferred.city.charAt(0).toUpperCase() + inferred.city.slice(1) : null;
  result.postalCode = inferred.postal;
  
  if (addressLines.length === 0) return result;
  
  result.name = addressLines[0];
  const remaining = addressLines.slice(1);
  
  if (remaining.length === 0) return result;
  
  // Find line with postal code
  let cityLineIndex = remaining.findIndex(l => {
    if (result.postalCode && l.includes(result.postalCode)) return true;
    if (inferred.city && l.toLowerCase().includes(inferred.city)) return true;
    return false;
  });
  
  if (cityLineIndex === -1) cityLineIndex = remaining.length - 1;
  
  const cityLine = remaining[cityLineIndex];
  const beforeCity = remaining.slice(0, cityLineIndex).join(', ');
  const cityParts = cityLine.split(',').map(p => p.trim()).filter(Boolean);
  
  // Extract postal code from city line
  const postalMatch = cityLine.match(/\d{4,6}/);
  if (postalMatch) {
    result.postalCode = result.postalCode || postalMatch[0];
  }
  
  result.address1 = beforeCity || cityParts.slice(0, -1).join(', ') || '';
  
  return result;
}

export function parseFirstAddressSmart(text: string): ParsedAddress {
  const firstResult = parseFirstAddress(text);
  
  if (firstResult && firstResult.country && firstResult.city) {
    return firstResult;
  }
  
  return parseFallbackAddress(text);
}

export function parseManufacturerFromAliExpress(html: string): ParsedAddress {
  // Strip HTML tags
  let text = html.replace(/<[^>]*>/g, '');
  
  // Replace Chinese punctuation
  text = text.replace(/[，。]/g, ',').replace(/\s+/g, ' ').trim();
  
  // Split by newlines, dots, pipes, bullets
  const lines = text.split(/[\r\n]+/)
    .flatMap(l => l.split(/·|•|\|/))
    .map(l => l.trim())
    .filter(Boolean);
  
  const result: ParsedAddress = {
    name: null,
    address1: null,
    address2: null,
    city: null,
    stateOrProvince: null,
    postalCode: null,
    country: null,
    emailAddress: null,
    phoneNumber: null,
    website: null
  };
  
  // Extract email and phone first
  const addressLines = [...lines];
  for (let i = addressLines.length - 1; i >= 0; i--) {
    const line = addressLines[i];
    if (!result.emailAddress && /^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/i.test(line)) {
      result.emailAddress = line;
      addressLines.splice(i, 1);
      continue;
    }
    if (!result.phoneNumber && /^\+?\d[\d\s\-()]{5,}$/.test(line)) {
      result.phoneNumber = line;
      addressLines.splice(i, 1);
    }
  }
  
  if (addressLines.length) result.name = addressLines.shift()!;
  
  const fullAddress = addressLines.join(', ');
  const lower = fullAddress.toLowerCase();
  
  // Try Chinese address pattern
  const chinesePattern = /(.+?),\s*([\w\s]+?)\s+District,\s*([\w\s]+?)\s+City,\s*([\w\s]+?)\s+Province/i;
  const match = fullAddress.match(chinesePattern);
  
  if (match) {
    result.address1 = match[1].trim().replace(/,\s*$/, '').replace(/\bDistrict$/i, '').trim();
    result.city = match[3].trim();
    result.stateOrProvince = match[4].trim();
    result.country = 'CN';
    return result;
  }
  
  // Check for Chinese provinces
  for (const province of CHINESE_PROVINCES) {
    if (lower.includes(province)) {
      result.country = 'CN';
      break;
    }
  }
  
  // Extract postal code
  const postalMatch = fullAddress.match(/\b\d{4,6}\b/);
  if (postalMatch) result.postalCode = postalMatch[0];
  
  // Simple comma-based parsing
  const commaIndex = fullAddress.indexOf(',');
  if (commaIndex !== -1) {
    result.address1 = fullAddress.substring(0, commaIndex).trim();
    const afterComma = fullAddress.slice(commaIndex + 1).trim();
    const parts = afterComma.split(',');
    result.city = parts[0].trim();
    if (parts[1]) result.stateOrProvince = parts[1].trim();
  } else {
    result.address1 = fullAddress;
  }
  
  // Infer country from state if not set
  if (!result.country && result.stateOrProvince && CHINESE_PROVINCES.includes(result.stateOrProvince.toLowerCase())) {
    result.country = 'CN';
  }
  
  return result;
}
