import { storage } from './storage';

export interface ProductData {
  title: string;
  description: string;
  price: number;
  images: string[];
}

export interface SEOResult {
  ebayTitle: string;
  ebayDescription: string;
  suggestedPrice: number;
  keywords: string[];
}

export async function getStoredApiKey(): Promise<string> {
  const key = await storage.getApiKey();
  if (!key) {
    throw new Error('API key not configured. Please add your Anthropic API key in Settings.');
  }
  return key;
}

export async function generateEbayListing(productData: ProductData): Promise<SEOResult> {
  const apiKey = await getStoredApiKey();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are an expert eBay SEO specialist. Generate an optimized eBay listing for this product.

Product Details:
- Title: ${productData.title}
- Description: ${productData.description}
- Source Price: $${productData.price.toFixed(2)}

Requirements:
1. Create an eBay title under 80 characters with top-ranking keywords
2. Write a compelling description with bullet points highlighting key features and benefits
3. Suggest a competitive selling price with appropriate markup
4. Provide 5 relevant search keywords

Return ONLY valid JSON in this exact format:
{
  "ebayTitle": "optimized title under 80 chars",
  "ebayDescription": "compelling description with bullet points",
  "suggestedPrice": 29.99,
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`
      }]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to generate listing');
  }

  const data = await response.json();
  const content = data.content[0].text;

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    return JSON.parse(jsonMatch[0]) as SEOResult;
  } catch {
    throw new Error('Failed to parse AI response');
  }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: 'Say "ok" only.'
        }]
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}
