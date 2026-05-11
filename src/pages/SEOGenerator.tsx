import { useState } from 'react';
import { generateEbayListing, type SEOResult, type ProductData } from '../services/ai';
import { storage } from '../services/storage';

export default function SEOGenerator() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SEOResult | null>(null);
  const [error, setError] = useState('');

  async function handleGenerate() {
    if (!url.trim()) {
      setError('Please enter a product URL');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const productData: ProductData = {
        title: 'Sample Product',
        description: 'Product description from URL',
        price: 29.99,
        images: []
      };

      if (url.includes('amazon.com')) {
        const tab = await chrome.tabs.create({ url, active: false });
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        if (tab.id) {
          try {
            const response = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_PRODUCT' });
            if (response?.product) {
              productData.title = response.product.title || productData.title;
              productData.description = response.product.description || productData.description;
              productData.price = response.product.price || productData.price;
              productData.images = response.product.images || [];
            }
            await chrome.tabs.remove(tab.id);
          } catch {
            await chrome.tabs.remove(tab.id);
          }
        }
      }

      const seoResult = await generateEbayListing(productData);
      setResult(seoResult);
      await storage.addActivity('Generated SEO listing', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate listing';
      setError(message);
      await storage.addActivity(`SEO generation failed: ${message}`, 'error');
    }

    setLoading(false);
  }

  async function handleCopyTitle() {
    if (result) {
      await navigator.clipboard.writeText(result.ebayTitle);
      await storage.addActivity('Copied title to clipboard', 'success');
    }
  }

  async function handleCopyDescription() {
    if (result) {
      await navigator.clipboard.writeText(result.ebayDescription);
      await storage.addActivity('Copied description to clipboard', 'success');
    }
  }

  async function handleCreateListing() {
    if (!result) return;
    
    try {
      await chrome.storage.local.set({
        pendingListing: {
          title: result.ebayTitle,
          description: result.ebayDescription,
          price: result.suggestedPrice,
          keywords: result.keywords
        }
      });
      
      await chrome.tabs.create({ url: 'https://www.ebay.com/sl/sell' });
      await storage.addActivity('Opened eBay listing creator', 'success');
    } catch (error) {
      await storage.addActivity('Failed to open listing creator', 'error');
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>SEO Generator</h2>
        <p>AI-powered listing optimization</p>
      </div>

      <div className="form-group">
        <label>Product URL</label>
        <input
          type="text"
          className="input"
          placeholder="Paste Amazon or AliExpress URL..."
          value={url}
          onChange={e => setUrl(e.target.value)}
        />
      </div>

      <button 
        className="btn btn-gradient" 
        onClick={handleGenerate}
        disabled={loading}
        style={{ width: '100%', marginBottom: 16 }}
      >
        {loading ? '✨ Generating...' : '✨ Generate Listing'}
      </button>

      {error && (
        <div className="card" style={{ borderColor: 'var(--error)', marginBottom: 12 }}>
          <p style={{ color: 'var(--error)', fontSize: 12 }}>{error}</p>
        </div>
      )}

      {result && (
        <div className="seo-output">
          <div className="seo-field">
            <div className="seo-label">
              Optimized Title ({result.ebayTitle.length}/80 chars)
            </div>
            <div className="seo-value">{result.ebayTitle}</div>
            <button 
              className="btn btn-sm btn-outline" 
              onClick={handleCopyTitle}
              style={{ marginTop: 8 }}
            >
              📋 Copy Title
            </button>
          </div>

          <div className="seo-field">
            <div className="seo-label">Description</div>
            <div className="seo-value" style={{ whiteSpace: 'pre-wrap' }}>
              {result.ebayDescription}
            </div>
            <button 
              className="btn btn-sm btn-outline" 
              onClick={handleCopyDescription}
              style={{ marginTop: 8 }}
            >
              📋 Copy Description
            </button>
          </div>

          <div className="seo-field">
            <div className="seo-label">Suggested Price</div>
            <div className="seo-value gradient-text" style={{ fontSize: 18, fontWeight: 700 }}>
              ${result.suggestedPrice.toFixed(2)}
            </div>
          </div>

          <div className="seo-field">
            <div className="seo-label">Keywords</div>
            <div className="keywords">
              {result.keywords.map((kw, i) => (
                <span key={i} className="keyword-pill">{kw}</span>
              ))}
            </div>
          </div>

          <button 
            className="btn btn-gradient" 
            onClick={handleCreateListing}
            style={{ width: '100%', marginTop: 12 }}
          >
            🚀 Create Listing
          </button>
        </div>
      )}
    </div>
  );
}
