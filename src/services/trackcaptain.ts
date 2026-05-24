/**
 * TrackCaptain API service for claiming tracking numbers.
 * API key is stored in chrome.storage.local under 'trackcaptain_api_key'.
 */

const BASE_URL = 'https://trackcaptain.com/api/v1';
const STORAGE_KEY = 'trackcaptain_api_key';

export async function getTrackCaptainKey(): Promise<string | undefined> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] as string | undefined;
}

export async function saveTrackCaptainKey(key: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: key });
}

export async function getAccountBalance(apiKey: string): Promise<{ credits: number } | null> {
  try {
    const response = await fetch(`${BASE_URL}/account`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    return { credits: data.credits ?? data.balance ?? 0 };
  } catch {
    return null;
  }
}

export interface ClaimParams {
  city: string;
  state: string;
  zip: string;
  country: string;
  deliveryDate: string; // ISO date string YYYY-MM-DD
}

export type ClaimResult =
  | { trackingNumber: string; carrier: string }
  | { error: string };

async function doClaimRequest(apiKey: string, params: ClaimParams): Promise<Response> {
  return fetch(`${BASE_URL}/tracking/match-and-claim`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      city: params.city,
      state: params.state,
      zip: params.zip,
      country: params.country,
      delivery_date: params.deliveryDate
    })
  });
}

export async function claimTrackingNumber(
  apiKey: string,
  params: ClaimParams
): Promise<ClaimResult> {
  try {
    let response = await doClaimRequest(apiKey, params);

    // 409 = already claimed — retry once
    if (response.status === 409) {
      response = await doClaimRequest(apiKey, params);
    }

    // 402 = insufficient credits
    if (response.status === 402) {
      return { error: 'Insufficient credits' };
    }

    if (!response.ok) {
      let errMsg = `API error ${response.status}`;
      try {
        const errData = await response.json();
        if (errData.message || errData.error) {
          errMsg = errData.message || errData.error;
        }
      } catch { /* ignore parse errors */ }
      return { error: errMsg };
    }

    const data = await response.json();
    const trackingNumber: string = data.tracking_number || data.trackingNumber || '';
    const carrier: string = data.carrier || '';

    if (!trackingNumber) {
      return { error: 'No tracking number returned' };
    }

    return { trackingNumber, carrier };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' };
  }
}
