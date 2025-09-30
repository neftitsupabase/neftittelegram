// src/components/layout/DocsLayout.tsx
import { Link, useLocation } from "react-router-dom";
import * as React from "react";
import { useRef, useState } from "react";
import { DocsPagination } from "../docs/DocsPagination";
import { docsSidebar } from "@/config/docs.config";
import { Search, Menu, X } from "lucide-react";
import { searchContent, SearchResult } from "@/utils/search";
import { SearchResults } from "@/components/search/SearchResults";
import { debounce } from "lodash";
import { useDocsNavigation } from "@/contexts/DocsNavigationContext";

// ====== Highlight search term in sidebar ======
const HighlightText = ({ text, searchTerm }: { text: string; searchTerm: string }) => {
  if (!searchTerm.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${searchTerm})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <span key={i} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
};

// ====== Logo ======
const NeftitLogo = () => (
  <img src="/images/logo.png" alt="Neftit Logo" className="h-6 w-28" />
);

// ====== Flatten docs pages ======
const flattenPages = (sections: typeof docsSidebar) =>
  sections.flatMap((section) =>
    section.items.map((item) => ({
      title: item.title,
      slug: item.slug,
    }))
  );

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const contentSearchRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { handleDocsNavigation } = useDocsNavigation();

  // Pages + current index
  const allPages = flattenPages(docsSidebar);
  const [currentPageIndex, setCurrentPageIndex] = React.useState(0);

  // Update current page index when location changes
  React.useEffect(() => {
    const currentPath = location.pathname.replace(/^\/docs\/?/, "");
    const newIndex = allPages.findIndex(
      (page) =>
        page.slug === currentPath ||
        (currentPath === "" && page.slug === "introduction/problems-targeted")
    );
    
    if (newIndex !== -1) {
      setCurrentPageIndex(newIndex);
    } else {
      // Default to first page if no match found
      setCurrentPageIndex(0);
    }
  }, [location.pathname]);

  // ===== Debounced search =====
  const debouncedSearch = React.useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      try {
        const results = await searchContent(query);

        // 🔹 Clean dev code snippets like "function mdx..." from preview text
        const cleanResults = results.map((r) => ({
          ...r,
          snippet: r.snippet?.replace(/function\s+mdx.*|export\s+default.*|import\s+.*;/gi, "")
        }));

        setSearchResults(cleanResults);
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  React.useEffect(() => {
    debouncedSearch(searchTerm);
    return () => debouncedSearch.cancel();
  }, [searchTerm, debouncedSearch]);

  // Handle clicks outside search results
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchResultsRef.current && !searchResultsRef.current.contains(event.target as Node) &&
          contentSearchRef.current && !contentSearchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Clear search on navigation
  React.useEffect(() => {
    setSearchTerm("");
    setSearchResults([]);
    setMobileSearchOpen(false);
    setSidebarOpen(false);
    setIsSearchFocused(false);
  }, [location.pathname]);

  // Sidebar sections
  const allSections = [
    {
      label: "General",
      links: [
        { to: "/docs/overview", label: "Overview", searchableText: "general overview" },
      ],
    },
    ...docsSidebar.map((section) => ({
      label: section.title,
      links: section.items.map((item) => ({
        to: `/docs/${item.slug}`,
        label: item.title,
        searchableText: `${section.title} ${item.title}`.toLowerCase(),
      })),
    })),
  ];

  return (
    <div className="min-h-screen bg-[#0B0A14] text-white">
      {/* ===== Desktop/Laptop Layout ===== */}
      <div className="hidden lg:flex">
        <aside className="w-[280px] border-r border-[#1e1e2d] p-5 h-screen sticky top-0 overflow-y-auto bg-[#0B0A14] text-white">
          <div className="flex items-center mb-6">
            <NeftitLogo />
            <div className="text-xl font-bold ml-2">Docs</div>
          </div>
          {allSections.map((section) => (
            <div key={section.label} className="mt-6">
              <div className="text-xs font-bold text-[#5d43ef] uppercase tracking-wider mb-3">
                {section.label}
              </div>
              <ul>
                {section.links.map((link) => (
                  <li key={link.to} className="my-1">
                    <Link
                      to={link.to}
                      onClick={(e) => {
                        e.preventDefault();
                        handleDocsNavigation(link.to);
                      }}
                      className={`block px-3 py-2 text-sm rounded-md ${
                        location.pathname === link.to
                          ? "text-[#5d43ef] bg-[#5D43EF]/10 border-r-2 border-[#5d43ef] hover:text-[#5d43ef]"
                          : "text-white hover:text-[#5d43ef] hover:bg-[#5D43EF]/10"
                      }`}
                    >
                      <HighlightText text={link.label} searchTerm={searchTerm} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>

        <main className="flex-1 p-8 max-w-[85rem] mx-auto bg-[#0B0A14] text-white">
          <div className="max-w-3xl mx-auto">
            {/* ===== Search (Desktop) ===== */}
            <div className="relative max-w-3xl mx-auto mb-8">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  ref={contentSearchRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  className="block w-full pl-11 pr-4 py-2 text-white placeholder-gray-400 text-sm bg-[#121021] rounded-full focus:outline-none focus:ring-2 focus:ring-[#5d43ef]"
                  placeholder="Search documentation..."
                />
              </div>
              {isSearchFocused && searchTerm && (
                <div 
                  ref={searchResultsRef}
                  className="absolute left-0 right-0 mt-2 bg-white text-black rounded-lg shadow-xl z-50 max-h-[70vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {isSearching ? (
                    <div className="p-4 text-center">Searching...</div>
                  ) : (
                    <SearchResults
                      results={searchResults}
                      searchTerm={searchTerm}
                      onResultClick={() => {
                        setSearchTerm("");
                        setIsSearchFocused(false);
                      }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Main content */}
            <div className="docs-content prose prose-invert max-w-none">
              <style>{`
                .docs-content a {
                  color: #5D43EF;
                  text-decoration: underline;
                  text-underline-offset: 2px;
                  text-decoration-color: rgba(93, 67, 239, 0.4);
                  transition: color 0.2s ease;
                }
                .docs-content a:hover {
                  color: #8B5CF6;
                }
              `}</style>
              {children}
            </div>

            <div className="max-w-3xl mx-auto mt-12">
              <DocsPagination
                prevPage={
                  // Special handling for overview page - no previous page
                  location.pathname === "/docs/overview" ? null :
                  currentPageIndex > 0
                    ? {
                        title: allPages[currentPageIndex - 1]?.title || "Previous",
                        href: `/docs/${allPages[currentPageIndex - 1]?.slug || ""}`,
                      }
                    : null
                }
                nextPage={
                  // Special handling for overview page - next page should be the first page (Problems Targeted)
                  location.pathname === "/docs/overview" 
                    ? {
                        title: allPages[0]?.title || "Next",
                        href: `/docs/${allPages[0]?.slug || ""}`,
                      }
                    : currentPageIndex < allPages.length - 1
                    ? {
                        title: allPages[currentPageIndex + 1]?.title || "Next",
                        href: `/docs/${allPages[currentPageIndex + 1]?.slug || ""}`,
                      }
                    : null
                }
                onNavigate={handleDocsNavigation}
              />
            </div>
          </div>
        </main>
      </div>

      {/* ===== Mobile / Tablet Layout ===== */}
      <div className="lg:hidden flex flex-col h-screen">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 p-3 border-b border-[#1e1e2d] bg-[#0B0A14]">
          <div className="flex items-center gap-3">
            <NeftitLogo />
            <span className="font-semibold text-lg">Docs</span>
          </div>

          {/* Right side buttons (search + hamburger) */}
          <div className="flex items-center gap-2">
            {/* Search trigger (mobile) */}
            <button onClick={() => setMobileSearchOpen(true)}>
              <Search className="h-6 w-6 text-white" />
            </button>

            {/* Sidebar toggle */}
            <button onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="h-6 w-6 text-white" /> : <Menu className="h-6 w-6 text-white" />}
            </button>
          </div>
        </header>

        {/* ===== Fullscreen Search (Mobile/Tablet) ===== */}
        {mobileSearchOpen && (
          <div className="fixed inset-0 bg-[#0B0A14] z-50 flex flex-col p-4">
            <div className="flex items-center mb-3">
              <input
                ref={contentSearchRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                className="flex-1 px-4 py-2 rounded-md bg-[#121021] text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5d43ef]"
                placeholder="Search documentation..."
              />
              <button onClick={() => { setMobileSearchOpen(false); setSearchTerm(""); }}>
                <X className="h-6 w-6 text-white ml-2" />
              </button>
            </div>

            <div 
              className="flex-1 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {isSearching ? (
                <div className="p-4 text-center text-gray-300">Searching...</div>
              ) : (
                <SearchResults
                  results={searchResults}
                  searchTerm={searchTerm}
                  onResultClick={() => {
                    setSearchTerm("");
                    setMobileSearchOpen(false);
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* ===== Sidebar overlay (open from right) ===== */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 flex">
            {/* Dark overlay (click to close) */}
            <div className="flex-1 bg-black/50" onClick={() => setSidebarOpen(false)} />

            {/* Sidebar on the right */}
            <div
              className={`ml-auto w-64 bg-[#0B0A14] border-l border-[#1e1e2d] p-5 overflow-y-auto transform transition-transform duration-300 ${
                sidebarOpen ? "translate-x-0" : "translate-x-full"
              }`}
            >
              {allSections.map((section) => (
                <div key={section.label} className="mt-6">
                  <div className="text-xs font-bold text-[#5d43ef] uppercase tracking-wider mb-3">
                    {section.label}
                  </div>
                  <ul>
                    {section.links.map((link) => (
                      <li key={link.to} className="my-1">
                        <Link
                          to={link.to}
                          onClick={(e) => {
                            e.preventDefault();
                            handleDocsNavigation(link.to);
                            setSidebarOpen(false);
                          }}
                          className={`block px-3 py-2 text-sm rounded-md ${
                            location.pathname === link.to
                              ? "text-[#5d43ef] bg-[#5D43EF]/10 border-l-2 border-[#5d43ef] hover:text-[#5d43ef]"
                              : "text-white hover:text-[#5d43ef] hover:bg-[#5D43EF]/10"
                          }`}
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4">
          <div className="docs-content">{children}</div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1e1e2d] bg-[#0B0A14] py-4">
        <div className="text-center text-sm text-gray-400">
          Docs powered by <span className="text-[#5d43ef] font-medium">NEFTIT</span>
        </div>
      </footer>
    </div>
  );
}
