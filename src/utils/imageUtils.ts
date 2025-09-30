/**
 * Image utilities for converting local image paths to File objects for IPFS upload
 */

/**
 * Convert local image path to File object for IPFS upload
 */
export async function loadImageAsFile(imagePath: string): Promise<File> {
  try {
    // Remove leading slash if present
    const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
    
    // Fetch the image from public directory
    const response = await fetch(`/${cleanPath}`);
    
    if (!response.ok) {
      throw new Error(`Failed to load image: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    // Extract filename from path
    const filename = cleanPath.split('/').pop() || 'image.jpg';
    
    // Create File object
    const file = new File([blob], filename, { type: blob.type });
    
    console.log(`✅ Loaded image as File: ${filename} (${blob.size} bytes)`);
    return file;
    
  } catch (error) {
    console.error(`❌ Failed to load image ${imagePath}:`, error);
    throw new Error(`Failed to load image ${imagePath}: ${error}`);
  }
}

/**
 * Get image file extension from path
 */
export function getImageExtension(imagePath: string): string {
  const extension = imagePath.split('.').pop()?.toLowerCase() || 'jpg';
  return extension;
}

/**
 * Validate if path is an image file
 */
export function isImageFile(path: string): boolean {
  const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'];
  const extension = getImageExtension(path);
  return validExtensions.includes(extension);
}

/**
 * Generate IPFS-compatible filename from image path
 */
export function generateIPFSFilename(imagePath: string, nftId: string): string {
  const extension = getImageExtension(imagePath);
  return `${nftId}.${extension}`;
}
