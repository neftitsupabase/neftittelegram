import React, { useCallback } from "react";
import { SearchResult } from "@/utils/search";
import { useNavigate } from "react-router-dom";
import { useDocsNavigation } from "@/contexts/DocsNavigationContext";

interface SearchResultsProps {
  results: SearchResult[];
  searchTerm: string;
  onResultClick?: () => void;
}

const HighlightMatch: React.FC<{ text: string; searchTerm: string }> = ({
  text,
  searchTerm,
}) => {
  if (!searchTerm.trim()) return <>{text}</>;

  const escapeRegex = (str: string) =>
    str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const regex = new RegExp(`(${escapeRegex(searchTerm)})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-yellow-200 text-yellow-900 px-0.5 rounded"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  searchTerm,
  onResultClick,
}) => {
  const navigate = useNavigate();
  const { handleDocsNavigation } = useDocsNavigation();

  const handleResultClick = useCallback((e: React.MouseEvent, slug: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Close search dropdown
    if (onResultClick) {
      onResultClick();
    }
    
    // Navigate to the selected page using docs navigation
    handleDocsNavigation(`/docs/${slug}`);
    
    // Close mobile keyboard on mobile devices
    if (window.innerWidth < 1024) {
      const activeElement = document.activeElement as HTMLElement;
      activeElement?.blur();
    }
    
    // Scroll to top of the page
    window.scrollTo(0, 0);
  }, [handleDocsNavigation, onResultClick]);
  if (!searchTerm.trim()) return null;

  if (results.length === 0) {
    return (
      <div
        className="rounded-lg max-h-[400px] overflow-hidden text-sm"
        style={{ backgroundColor: "#121021" }}
      >
        <p className="text-gray-400">
          No results found for <span className="text-white">"{searchTerm}"</span>
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg max-h-[400px] overflow-y-auto custom-scrollbar"
      style={{ backgroundColor: "#121021" }}
    >
      <div className="space-y-3 p-2">
        {results.map((result) => (
          <div
            key={result.slug}
            onClick={(e) => handleResultClick(e, result.slug)}
            className="block p-4 rounded-lg transition-all hover:shadow-lg hover:bg-[#24213d] cursor-pointer"
            style={{ backgroundColor: "#1b1930" }}
          >
            <div className="flex items-center mb-1">
              <span className="text-xs font-medium text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">
                {result.section}
              </span>
            </div>
            <h3 className="text-lg font-medium text-white mb-1">
              <HighlightMatch text={result.title} searchTerm={searchTerm} />
            </h3>
            <p className="text-sm text-gray-300 line-clamp-2">
              <HighlightMatch
                text={result.snippet || result.content}
                searchTerm={searchTerm}
              />
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
