import { docsSidebar } from "@/config/docs.config";

interface SearchResult {
  title: string;
  slug: string;
  section: string;
  content: string;
  snippet?: string;
  matches: {
    text: string;
    isMatch: boolean;
  }[];
}

let searchIndex: SearchResult[] = [];

// Import all MDX files as React components (same as DocsRoutes)
const modules = import.meta.glob("../../neftit_docs-content/**/*.mdx");

// Initialize search index
const initializeSearchIndex = async () => {
  if (searchIndex.length > 0) return searchIndex;

  const indexPromises: Promise<SearchResult | null>[] = [];

  // Add overview page
  indexPromises.push(processMdxFile("../../neftit_docs-content/overview.mdx", "General", "Overview"));

  // Add all pages from docsSidebar
  for (const section of docsSidebar) {
    for (const item of section.items) {
      const path = `../../neftit_docs-content/${item.slug}.mdx`;
      indexPromises.push(
        processMdxFile(path, section.title, item.title).catch(() => null)
      );
    }
  }

  const results = await Promise.all(indexPromises);
  searchIndex = results.filter(Boolean) as SearchResult[];
  return searchIndex;
};

const processMdxFile = async (
  path: string,
  section: string,
  title: string
): Promise<SearchResult | null> => {
  try {
    // Load the MDX module
    const loader = modules[path];
    if (!loader) {
      console.warn(`No loader found for ${path}`);
      return null;
    }

    // Load the MDX module
    const module = await loader() as any;
    if (!module || !module.default) {
      console.warn(`Module not found or has no default export for: ${path}`);
      return null;
    }

    // For search purposes, we need to extract text content from the MDX file
    // Since we can't easily get the raw markdown from compiled MDX,
    // we'll use a different approach: create a hidden render and extract text
    
    // For now, let's create a simple text extraction based on the path and title
    // This is a fallback solution - in production you'd want to extract actual content
    const pathParts = path.split('/');
    const fileName = pathParts[pathParts.length - 1].replace('.mdx', '');
    
    // Create a searchable content string based on the file metadata
    // This is a temporary solution - ideally we'd extract actual MDX content
    const content = `${title} ${section} ${fileName.replace(/[-_]/g, ' ')}`;
    
    console.log(`Processed ${path}: ${title} in ${section}`);

    return {
      slug: path.replace('../../neftit_docs-content/', '').replace('.mdx', ''),
      title,
      section,
      content,
      matches: [], // Initialize with empty matches
    };
  } catch (error) {
    console.error(`Error processing MDX file ${path}:`, error);
    return null;
  }
};

// Search function
export const searchDocs = async (query: string): Promise<SearchResult[]> => {
  if (!query.trim()) return [];

  const index = await initializeSearchIndex();
  const normalizedQuery = query.toLowerCase();

  return index
    .map((doc) => {
      const titleMatch = doc.title.toLowerCase().includes(normalizedQuery);
      const contentMatch = doc.content.toLowerCase().includes(normalizedQuery);

      if (!titleMatch && !contentMatch) return null;

      // Build snippet around first match
      const matchIndex = doc.content.toLowerCase().indexOf(normalizedQuery);
      const snippet =
        matchIndex >= 0
          ? doc.content.substring(
              Math.max(0, matchIndex - 50),
              Math.min(doc.content.length, matchIndex + 50)
            )
          : doc.title;

      // Highlight matches
      const words = normalizedQuery.split(" ");
      const matches = snippet
        .split(" ")
        .map((word) => ({
          text: word,
          isMatch: words.some((w) => word.toLowerCase().includes(w)),
        }));

      return {
        ...doc,
        snippet,
        matches,
      };
    })
    .filter(Boolean) as SearchResult[];
};

// Initialize search index on module load
initializeSearchIndex().catch(console.error);

// Export additional functions and types
export const searchContent = searchDocs;
export type { SearchResult };
