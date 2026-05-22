# SYNDRAX SYNC - IMAGE OPTIMIZATION & AI GENERATION STRATEGY

## Overview

This document details the complete image handling strategy for Syndrax Sync, including downloading Amazon images locally, auto-optimization, AI image generation for premium products, and eBay hosting integration.

---

## Image Processing Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                   IMAGE PROCESSING PIPELINE                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  STEP 1: DOWNLOAD FROM AMAZON                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Download ALL product images                        │   │
│  │ • Store locally (never rely on Amazon CDN)           │   │
│  │ • Preserve original quality                          │   │
│  │ • Rename with product ID                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  STEP 2: AUTO-OPTIMIZE                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Brightness: +15%                                   │   │
│  │ • Saturation: +20%                                   │   │
│  │ • Contrast: +10%                                     │   │
│  │ • Sharpen edges                                      │   │
│  │ • Resize to 1600x1600px                              │   │
│  │ • Convert to JPEG (quality 95)                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  STEP 3: AI GENERATION CHECK                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ IF margin >= 25% AND AI toggle ON:                   │   │
│  │   → Generate AI-enhanced image                       │   │
│  │   → Professional studio lighting                     │   │
│  │   → Vibrant colors                                   │   │
│  │   → Lifestyle shot composition                       │   │
│  │ ELSE:                                                │   │
│  │   → Use optimized Amazon image                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  STEP 4: UPLOAD TO EBAY                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Upload to eBay image hosting                       │   │
│  │ • Keep local backup copy                             │   │
│  │ • Store eBay image URL in database                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Download Amazon Images

### Why Download Locally?

1. **Amazon CDN links expire** - URLs become invalid after time
2. **Amazon may block hotlinking** - Direct links from eBay listings may fail
3. **Ownership of assets** - Your listings survive if Amazon changes
4. **Optimization requires local files** - Can't enhance remote images
5. **Backup protection** - Images preserved even if Amazon product delisted

### Download Implementation

```typescript
interface ImageDownloadConfig {
  maxImagesPerProduct: number;     // Default: 10
  preferredImageTypes: string[];   // ['MAIN', 'PT01', 'PT02', ...]
  minResolution: number;           // 500px minimum
  outputFormat: 'jpeg' | 'png';    // jpeg for smaller size
  outputDirectory: string;         // ./images/{productId}/
}

const DEFAULT_DOWNLOAD_CONFIG: ImageDownloadConfig = {
  maxImagesPerProduct: 10,
  preferredImageTypes: ['MAIN', 'PT01', 'PT02', 'PT03', 'PT04', 'PT05'],
  minResolution: 500,
  outputFormat: 'jpeg',
  outputDirectory: './images'
};

async function downloadAmazonImages(asin: string): Promise<DownloadResult> {
  const product = await getAmazonProductData(asin);
  const images = product.images || [];
  
  // Create product directory
  const productDir = path.join(DEFAULT_DOWNLOAD_CONFIG.outputDirectory, asin);
  await fs.mkdir(productDir, { recursive: true });
  
  const downloadedImages: ImageFile[] = [];
  
  for (let i = 0; i < Math.min(images.length, DEFAULT_DOWNLOAD_CONFIG.maxImagesPerProduct); i++) {
    const image = images[i];
    
    // Get highest resolution version
    const imageUrl = getHighResImageUrl(image.url);
    
    // Download image
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    
    // Save locally
    const filename = `${asin}_${i.toString().padStart(2, '0')}.jpg`;
    const filepath = path.join(productDir, filename);
    await fs.writeFile(filepath, Buffer.from(buffer));
    
    downloadedImages.push({
      originalUrl: image.url,
      localPath: filepath,
      filename,
      size: buffer.byteLength,
      type: image.type || 'UNKNOWN'
    });
  }
  
  return {
    asin,
    imagesDownloaded: downloadedImages.length,
    images: downloadedImages,
    directory: productDir
  };
}

function getHighResImageUrl(url: string): string {
  // Amazon image URLs can be modified for resolution
  // Replace resolution indicators with maximum
  return url
    .replace(/\._[A-Z]+\d+_\./, '._SL1600_.')
    .replace(/\._S[XY]\d+_\./, '._SL1600_.');
}
```

### Image File Structure

```
images/
├── B09V3KXJPB/
│   ├── B09V3KXJPB_00.jpg    (MAIN image)
│   ├── B09V3KXJPB_01.jpg    (PT01)
│   ├── B09V3KXJPB_02.jpg    (PT02)
│   └── ...
├── B07XJ8C8F5/
│   ├── B07XJ8C8F5_00.jpg
│   └── ...
└── metadata.json            (tracking file)
```

---

## Step 2: Auto-Optimize Images

### Optimization Parameters

| Parameter | Value | Reason |
|-----------|-------|--------|
| Brightness | +15% | Make products pop, counteract Amazon's flat lighting |
| Saturation | +20% | More vibrant colors attract attention |
| Contrast | +10% | Sharper definition, professional look |
| Sharpening | Medium | Crisp edges, better detail |
| Size | 1600x1600px | eBay maximum, zoom-friendly |
| Format | JPEG 95% | Good quality, small file size |

### Python Implementation (PIL/Pillow)

```python
from PIL import Image, ImageEnhance, ImageFilter
import os

class ImageOptimizer:
    def __init__(self):
        self.config = {
            'brightness': 1.15,    # +15%
            'saturation': 1.20,    # +20%
            'contrast': 1.10,      # +10%
            'sharpness': 1.50,     # Medium sharpening
            'target_size': (1600, 1600),
            'quality': 95
        }
    
    def optimize(self, input_path: str, output_path: str) -> dict:
        """
        Optimize a single image with all enhancements.
        
        Args:
            input_path: Path to source image
            output_path: Path to save optimized image
            
        Returns:
            Dict with optimization results
        """
        # Open image
        img = Image.open(input_path)
        original_size = img.size
        
        # Convert to RGB if necessary (handles PNG with transparency)
        if img.mode in ('RGBA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'RGBA':
                background.paste(img, mask=img.split()[3])
            else:
                background.paste(img)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Apply brightness
        enhancer = ImageEnhance.Brightness(img)
        img = enhancer.enhance(self.config['brightness'])
        
        # Apply saturation (color)
        enhancer = ImageEnhance.Color(img)
        img = enhancer.enhance(self.config['saturation'])
        
        # Apply contrast
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(self.config['contrast'])
        
        # Apply sharpening
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(self.config['sharpness'])
        
        # Resize to target (maintain aspect ratio, fit within bounds)
        img = self._resize_to_fit(img, self.config['target_size'])
        
        # Create white background canvas at exact target size
        canvas = Image.new('RGB', self.config['target_size'], (255, 255, 255))
        
        # Center the image on canvas
        offset = (
            (self.config['target_size'][0] - img.size[0]) // 2,
            (self.config['target_size'][1] - img.size[1]) // 2
        )
        canvas.paste(img, offset)
        
        # Save optimized image
        canvas.save(output_path, 'JPEG', quality=self.config['quality'])
        
        return {
            'input': input_path,
            'output': output_path,
            'original_size': original_size,
            'final_size': self.config['target_size'],
            'file_size': os.path.getsize(output_path)
        }
    
    def _resize_to_fit(self, img: Image, target: tuple) -> Image:
        """Resize image to fit within target while maintaining aspect ratio."""
        ratio = min(target[0] / img.size[0], target[1] / img.size[1])
        new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
        return img.resize(new_size, Image.LANCZOS)
    
    def optimize_batch(self, input_dir: str, output_dir: str) -> list:
        """Optimize all images in a directory."""
        os.makedirs(output_dir, exist_ok=True)
        results = []
        
        for filename in os.listdir(input_dir):
            if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                input_path = os.path.join(input_dir, filename)
                output_path = os.path.join(output_dir, filename.rsplit('.', 1)[0] + '_optimized.jpg')
                
                try:
                    result = self.optimize(input_path, output_path)
                    results.append(result)
                except Exception as e:
                    results.append({
                        'input': input_path,
                        'error': str(e)
                    })
        
        return results
```

### TypeScript Wrapper (for Chrome Extension)

```typescript
interface OptimizationResult {
  success: boolean;
  inputPath: string;
  outputPath: string;
  originalSize: { width: number; height: number };
  finalSize: { width: number; height: number };
  fileSize: number;
  error?: string;
}

async function optimizeImage(imagePath: string): Promise<OptimizationResult> {
  // Call Python optimizer via subprocess or API
  const outputPath = imagePath.replace(/\.[^.]+$/, '_optimized.jpg');
  
  const response = await fetch('http://localhost:5001/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: imagePath,
      output: outputPath
    })
  });
  
  return await response.json();
}

async function optimizeAllProductImages(asin: string): Promise<void> {
  const productDir = `./images/${asin}`;
  const optimizedDir = `./images/${asin}/optimized`;
  
  const files = await fs.readdir(productDir);
  const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  
  for (const file of imageFiles) {
    const inputPath = path.join(productDir, file);
    await optimizeImage(inputPath);
  }
}
```

---

## Step 3: AI Image Generation

### When to Use AI Generation

```typescript
interface AIGenerationConfig {
  enabled: boolean;
  minMarginPercent: number;        // Only for products with margin >= this
  maxCostPerImage: number;         // Budget limit per image
  preferredStyle: 'studio' | 'lifestyle' | 'minimal';
  provider: 'replicate' | 'stability' | 'midjourney';
}

const DEFAULT_AI_CONFIG: AIGenerationConfig = {
  enabled: false,                   // Off by default
  minMarginPercent: 25,            // Only for 25%+ margin products
  maxCostPerImage: 0.05,           // Max $0.05 per image
  preferredStyle: 'studio',
  provider: 'replicate'
};

function shouldGenerateAIImage(product: Product): boolean {
  const config = getAIConfig();
  
  // Check if AI generation is enabled
  if (!config.enabled) return false;
  
  // Check margin threshold
  const margin = calculateMargin(product.amazonPrice, product.ebayPrice);
  if (margin < config.minMarginPercent) return false;
  
  // Check if product type is suitable
  // (Don't generate AI for branded products - could be trademark issue)
  if (isVEROBrand(product.brand)) return false;
  
  // Check budget (monthly limit)
  const monthlySpend = getMonthlyAISpend();
  const budget = getMonthlyAIBudget();
  if (monthlySpend >= budget) return false;
  
  return true;
}
```

### Toggle Rules Matrix

| Condition | AI Generation |
|-----------|---------------|
| Margin >= 25% AND toggle ON | ✅ Generate |
| Margin < 25% | ❌ Use optimized only |
| Toggle OFF | ❌ Use optimized only |
| VERO brand detected | ❌ Never generate |
| Monthly budget exceeded | ❌ Use optimized only |
| Premium/Sniper pricing mode | ✅ Generate (if enabled) |
| Volume pricing mode | ❌ Use optimized only |

### Replicate API Integration

```typescript
import Replicate from 'replicate';

interface AIImageRequest {
  productDescription: string;
  originalImageUrl: string;
  style: 'studio' | 'lifestyle' | 'minimal';
}

interface AIImageResult {
  success: boolean;
  imageUrl?: string;
  localPath?: string;
  cost: number;
  generationTime: number;
  error?: string;
}

async function generateAIProductImage(request: AIImageRequest): Promise<AIImageResult> {
  const startTime = Date.now();
  
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_KEY
  });
  
  // Build prompt based on style
  const prompt = buildImagePrompt(request);
  
  try {
    // Use Stable Diffusion XL or similar model
    const output = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      {
        input: {
          prompt: prompt,
          negative_prompt: "blurry, low quality, watermark, text, logo, banner",
          image: request.originalImageUrl,  // Use as reference
          num_outputs: 1,
          guidance_scale: 7.5,
          num_inference_steps: 30,
          width: 1024,
          height: 1024
        }
      }
    );
    
    const generatedUrl = Array.isArray(output) ? output[0] : output;
    
    // Download and save locally
    const localPath = await downloadAndSaveAIImage(generatedUrl);
    
    // Optimize the AI-generated image
    await optimizeImage(localPath);
    
    return {
      success: true,
      imageUrl: generatedUrl,
      localPath,
      cost: 0.03,  // Approximate cost per generation
      generationTime: Date.now() - startTime
    };
    
  } catch (error) {
    return {
      success: false,
      cost: 0,
      generationTime: Date.now() - startTime,
      error: error.message
    };
  }
}

function buildImagePrompt(request: AIImageRequest): string {
  const stylePrompts = {
    studio: "professional product photography, studio lighting, white background, high-end commercial photo, 8k, sharp focus",
    lifestyle: "lifestyle product photo, natural lighting, elegant setting, professional photography, aspirational, magazine quality",
    minimal: "minimalist product photo, clean white background, soft shadows, modern, professional, crisp"
  };
  
  return `${request.productDescription}, ${stylePrompts[request.style]}`;
}
```

### AI Generation Costs

| Provider | Model | Cost per Image | Quality | Speed |
|----------|-------|----------------|---------|-------|
| Replicate | SDXL | $0.01-0.03 | High | 3-5 sec |
| Stability AI | Stable Diffusion | $0.02-0.04 | High | 3-5 sec |
| Midjourney | v5/v6 | $0.02-0.05 | Very High | 30-60 sec |

### Monthly Budget Tracking

```typescript
interface AIBudget {
  monthlyLimit: number;           // e.g., $50
  currentMonthSpend: number;      // Running total
  imagesGenerated: number;
  averageCostPerImage: number;
  remainingBudget: number;
}

async function trackAIGeneration(cost: number): Promise<void> {
  const budget = await getAIBudget();
  
  budget.currentMonthSpend += cost;
  budget.imagesGenerated += 1;
  budget.averageCostPerImage = budget.currentMonthSpend / budget.imagesGenerated;
  budget.remainingBudget = budget.monthlyLimit - budget.currentMonthSpend;
  
  await saveAIBudget(budget);
  
  // Alert if budget is running low
  if (budget.remainingBudget < budget.monthlyLimit * 0.1) {
    await sendToDiscord('margin-alerts', {
      title: '⚠️ AI Image Budget Alert',
      description: `AI image generation budget is ${Math.round(budget.remainingBudget / budget.monthlyLimit * 100)}% remaining`,
      fields: [
        { name: 'Spent', value: `$${budget.currentMonthSpend.toFixed(2)}` },
        { name: 'Remaining', value: `$${budget.remainingBudget.toFixed(2)}` },
        { name: 'Images Generated', value: budget.imagesGenerated.toString() }
      ]
    });
  }
}
```

---

## Step 4: eBay Image Hosting

### Upload to eBay

```typescript
interface EbayImageUpload {
  localPath: string;
  ebayUrl?: string;
  uploadTime: number;
  success: boolean;
  error?: string;
}

async function uploadToEbayHosting(localPath: string): Promise<EbayImageUpload> {
  const startTime = Date.now();
  
  try {
    // Read file
    const imageBuffer = await fs.readFile(localPath);
    const base64Image = imageBuffer.toString('base64');
    
    // Upload via eBay API
    const response = await ebayApi.sell.media.uploadImage({
      imageData: base64Image,
      format: 'JPEG'
    });
    
    return {
      localPath,
      ebayUrl: response.imageUrl,
      uploadTime: Date.now() - startTime,
      success: true
    };
    
  } catch (error) {
    return {
      localPath,
      uploadTime: Date.now() - startTime,
      success: false,
      error: error.message
    };
  }
}

async function uploadAllProductImages(productId: string): Promise<UploadResult> {
  const optimizedDir = `./images/${productId}/optimized`;
  const files = await fs.readdir(optimizedDir);
  
  const uploads: EbayImageUpload[] = [];
  
  for (const file of files) {
    const localPath = path.join(optimizedDir, file);
    const result = await uploadToEbayHosting(localPath);
    uploads.push(result);
    
    // Rate limiting
    await sleep(500);  // 500ms between uploads
  }
  
  return {
    productId,
    totalImages: uploads.length,
    successful: uploads.filter(u => u.success).length,
    failed: uploads.filter(u => !u.success).length,
    uploads
  };
}
```

### Image Database Schema

```typescript
interface ProductImage {
  id: string;
  productId: string;
  amazonAsin: string;
  
  // URLs
  amazonOriginalUrl: string;
  localOriginalPath: string;
  localOptimizedPath: string;
  ebayHostedUrl: string;
  
  // AI Generation
  isAIGenerated: boolean;
  aiGenerationCost?: number;
  aiPromptUsed?: string;
  
  // Metadata
  imageType: 'MAIN' | 'GALLERY' | 'LIFESTYLE';
  order: number;
  width: number;
  height: number;
  fileSize: number;
  
  // Status
  status: 'DOWNLOADED' | 'OPTIMIZED' | 'AI_GENERATED' | 'UPLOADED' | 'ACTIVE';
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Speed Ranking

### Processing Speed Comparison

| Method | Speed | Cost | Quality | Use When |
|--------|-------|------|---------|----------|
| Optimized Amazon | Instant | Free | Good | Default for all products |
| AI Generated | 3-5 seconds | $0.01-0.03 | Excellent | High-margin products only |
| Plain Amazon | N/A | Free | Poor | NEVER USE |

### Decision Tree

```typescript
function determineImageStrategy(product: Product): ImageStrategy {
  const margin = calculateMargin(product.amazonPrice, product.ebayPrice);
  const config = getImageConfig();
  
  // Premium products: AI + Optimization
  if (margin >= 25 && config.aiGeneration.enabled) {
    return {
      strategy: 'AI_ENHANCED',
      steps: [
        'DOWNLOAD',
        'OPTIMIZE',
        'AI_GENERATE',
        'UPLOAD_TO_EBAY'
      ],
      estimatedCost: 0.03,
      estimatedTime: 8000  // ms
    };
  }
  
  // Standard products: Optimization only
  if (margin >= 10) {
    return {
      strategy: 'OPTIMIZED',
      steps: [
        'DOWNLOAD',
        'OPTIMIZE',
        'UPLOAD_TO_EBAY'
      ],
      estimatedCost: 0,
      estimatedTime: 3000  // ms
    };
  }
  
  // Low margin: Skip entirely (shouldn't be listing these)
  return {
    strategy: 'SKIP',
    reason: 'Margin too low for listing'
  };
}
```

---

## Integration with Strategy Dashboard

### Image Strategy by Pricing Mode

```typescript
const IMAGE_STRATEGY_BY_PRICING: Record<PricingMode, ImageStrategy> = {
  // Volume Mode: Speed is priority, no AI
  volume: {
    aiGeneration: false,
    optimizationLevel: 'basic',
    maxImagesPerProduct: 5
  },
  
  // Balanced Mode: Standard optimization
  balanced: {
    aiGeneration: false,
    optimizationLevel: 'full',
    maxImagesPerProduct: 8
  },
  
  // Premium Mode: Full optimization + AI for first image
  premium: {
    aiGeneration: true,
    aiImagesPerProduct: 1,  // Only main image
    optimizationLevel: 'full',
    maxImagesPerProduct: 10
  },
  
  // Sniper Mode: Maximum quality
  sniper: {
    aiGeneration: true,
    aiImagesPerProduct: 3,  // Main + 2 lifestyle
    optimizationLevel: 'maximum',
    maxImagesPerProduct: 10
  }
};
```

### Dashboard Integration

```tsx
function ImageSettings() {
  const { settings, updateSettings } = useImageSettings();
  const { pricingMode } = usePricingStrategy();
  
  return (
    <div className="image-settings">
      <h2>🖼️ Image Settings</h2>
      
      <div className="current-mode">
        <p>Pricing Mode: <strong>{pricingMode}</strong></p>
        <p>Recommended Image Strategy: {IMAGE_STRATEGY_BY_PRICING[pricingMode].name}</p>
      </div>
      
      <div className="ai-toggle">
        <label>
          <input 
            type="checkbox"
            checked={settings.aiGeneration.enabled}
            onChange={(e) => updateSettings({ 
              aiGeneration: { ...settings.aiGeneration, enabled: e.target.checked }
            })}
          />
          Enable AI Image Generation
        </label>
        <p className="help-text">
          Generates professional studio-quality images for high-margin products.
          Cost: ~$0.03 per image
        </p>
      </div>
      
      <div className="ai-config" style={{ display: settings.aiGeneration.enabled ? 'block' : 'none' }}>
        <label>
          Minimum Margin for AI:
          <input 
            type="number"
            value={settings.aiGeneration.minMargin}
            onChange={(e) => updateSettings({
              aiGeneration: { ...settings.aiGeneration, minMargin: parseInt(e.target.value) }
            })}
          />%
        </label>
        
        <label>
          Monthly Budget:
          <input 
            type="number"
            value={settings.aiGeneration.monthlyBudget}
            onChange={(e) => updateSettings({
              aiGeneration: { ...settings.aiGeneration, monthlyBudget: parseFloat(e.target.value) }
            })}
          />
        </label>
        
        <label>
          Style:
          <select 
            value={settings.aiGeneration.style}
            onChange={(e) => updateSettings({
              aiGeneration: { ...settings.aiGeneration, style: e.target.value }
            })}
          >
            <option value="studio">Studio (White Background)</option>
            <option value="lifestyle">Lifestyle (Natural Setting)</option>
            <option value="minimal">Minimal (Clean/Modern)</option>
          </select>
        </label>
      </div>
      
      <div className="budget-tracker">
        <h3>AI Budget This Month</h3>
        <BudgetProgressBar 
          spent={settings.aiGeneration.currentMonthSpend}
          limit={settings.aiGeneration.monthlyBudget}
        />
      </div>
    </div>
  );
}
```

---

## Complete Implementation Checklist

### Phase 1: Download & Storage
- [ ] Implement Amazon image URL extraction
- [ ] Create high-resolution URL converter
- [ ] Build local storage system
- [ ] Create metadata tracking

### Phase 2: Optimization
- [ ] Set up Python image processing service
- [ ] Implement PIL optimization pipeline
- [ ] Create TypeScript wrapper
- [ ] Batch processing for product directories

### Phase 3: AI Generation
- [ ] Integrate Replicate API
- [ ] Build prompt generation system
- [ ] Implement budget tracking
- [ ] Create toggle controls

### Phase 4: eBay Upload
- [ ] Integrate eBay Media API
- [ ] Build upload queue system
- [ ] Implement retry logic
- [ ] Store eBay URLs in database

### Phase 5: Dashboard Integration
- [ ] Create Image Settings page
- [ ] Connect to Strategy Dashboard
- [ ] Implement budget visualization
- [ ] Add per-product image preview

---

## Quick Reference

### Default Settings

```typescript
const IMAGE_DEFAULTS = {
  // Download
  maxImagesPerProduct: 10,
  minResolution: 500,
  
  // Optimization
  brightness: 1.15,
  saturation: 1.20,
  contrast: 1.10,
  targetSize: [1600, 1600],
  quality: 95,
  
  // AI Generation
  aiEnabled: false,
  aiMinMargin: 25,
  aiMonthlyBudget: 50,
  aiStyle: 'studio',
  
  // Upload
  retryAttempts: 3,
  rateLimitMs: 500
};
```

### File Paths

```
./images/
├── {ASIN}/
│   ├── {ASIN}_00.jpg           (original)
│   ├── {ASIN}_01.jpg           (original)
│   └── optimized/
│       ├── {ASIN}_00_optimized.jpg
│       ├── {ASIN}_01_optimized.jpg
│       └── {ASIN}_00_ai.jpg    (AI generated)
└── metadata.json
```

---

*Last Updated: 2024*
*Version: 1.0*
*Feature Phase: 3+*
