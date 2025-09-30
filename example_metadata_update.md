# IPFS URL Extraction and Update Example

## Your Original Metadata:
```json
{
  "name": "NEFTINUM Platinum",
  "description": "Unique platinum NFT from NEFTIT platform - Serial #4",
  "image": "https://gateway.pinata.cloud/ipfs/QmQLYmfbauDCRCEf1Xjdai4PTjh8RZ2qmeREaGdeZr9RdZ",
  "attributes": [
    {"trait_type": "Rarity", "value": "Platinum"},
    {"trait_type": "Serial Number", "value": 4},
    {"trait_type": "Platform", "value": "NEFTIT"},
    {"trait_type": "Generation", "value": "Unique CID Collection"},
    {"trait_type": "Timestamp", "value": "2025-09-13T12:52:48.932Z"}
  ],
  "external_url": "https://neftit.com",
  "background_color": "CD7F32"
}
```

## Extracted IPFS Hash:
`QmQLYmfbauDCRCEf1Xjdai4PTjh8RZ2qmeREaGdeZr9RdZ`

## Updated Image URL (using improved gateway configuration):
**Old:** `https://gateway.pinata.cloud/ipfs/QmQLYmfbauDCRCEf1Xjdai4PTjh8RZ2qmeREaGdeZr9RdZ`
**New:** `https://ipfs.io/ipfs/QmQLYmfbauDCRCEf1Xjdai4PTjh8RZ2qmeREaGdeZr9RdZ`

## Benefits of the Update:
1. **Better Reliability**: Uses `ipfs.io` as primary gateway (more reliable than Pinata)
2. **Automatic Fallbacks**: If `ipfs.io` fails, automatically tries 5 other gateways
3. **Rate Limit Resistance**: Multiple gateways prevent rate limiting issues
4. **Consistent Loading**: All NFTs use the same gateway priority system

## How to Use:

### 1. Extract IPFS Hash:
```typescript
import { extractIPFSHash } from './src/config/ipfsConfig';
const hash = extractIPFSHash("https://gateway.pinata.cloud/ipfs/QmQLYmfbauDCRCEf1Xjdai4PTjh8RZ2qmeREaGdeZr9RdZ");
// Returns: "QmQLYmfbauDCRCEf1Xjdai4PTjh8RZ2qmeREaGdeZr9RdZ"
```

### 2. Generate Improved URL:
```typescript
import { getIPFSUrl } from './src/config/ipfsConfig';
const newUrl = getIPFSUrl("QmQLYmfbauDCRCEf1Xjdai4PTjh8RZ2qmeREaGdeZr9RdZ");
// Returns: "https://ipfs.io/ipfs/QmQLYmfbauDCRCEf1Xjdai4PTjh8RZ2qmeREaGdeZr9RdZ"
```

### 3. Update Entire Metadata Object:
```typescript
import { updateNFTMetadataIPFS } from './src/config/ipfsConfig';
const updatedMetadata = updateNFTMetadataIPFS(originalMetadata);
// Automatically updates all IPFS URLs in the metadata
```

### 4. Bulk Update Database NFTs:
```typescript
import optimizedCIDPoolBurnService from './src/services/OptimizedCIDPoolBurnService';
const result = await optimizedCIDPoolBurnService.updateNFTMetadataIPFSUrls(walletAddress);
console.log(`Updated ${result.updated} NFTs with improved IPFS URLs`);
```

## Gateway Priority Order:
1. `https://ipfs.io/ipfs/` (Primary - Most reliable)
2. `https://cloudflare-ipfs.com/ipfs/` (Secondary - Fast CDN)
3. `https://gateway.pinata.cloud/ipfs/` (Tertiary - Your current gateway)
4. `https://dweb.link/ipfs/` (Backup)
5. `https://nftstorage.link/ipfs/` (Backup)
6. `https://4everland.io/ipfs/` (Backup)

This ensures your NFT images load faster and more reliably! 🚀
