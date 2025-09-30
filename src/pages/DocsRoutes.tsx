// src/pages/DocsRoutes.tsx
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from 'react';
import DocsLayout from "@/components/layout/DocsLayout";
import { docsSidebar } from "@/config/docs.config";
import { useDocsNavigation } from "@/contexts/DocsNavigationContext";

// Type for the MDX module
type MDXModule = {
  default: React.ComponentType<any>;
};

// Lazy load all MDX files
const modules = import.meta.glob<MDXModule>('../../neftit_docs-content/**/*.mdx');

// Safe wrapper component to prevent invalid component rendering
const SafeMDXWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div className="mdx-content">{children}</div>;
};

// Create a component that will load the MDX content
const MDXContent = ({ path }: { path: string }) => {
  const Content = lazy<React.ComponentType<any>>(async () => {
    try {
      const modulePath = `../../neftit_docs-content/${path}.mdx`;
      console.log(`Loading MDX module: ${modulePath}`);
      
      const module = await modules[modulePath]?.();
      if (!module || !module.default) {
        console.error(`Module not found or has no default export for: ${modulePath}`);
        throw new Error('Module not found or invalid');
      }
      
      console.log(`Successfully loaded module for: ${path}`);
      
      // Additional safety check to ensure we have a valid React component
      if (typeof module.default !== 'function') {
        console.error(`Module default export is not a function for: ${modulePath}`, module.default);
        throw new Error('Invalid MDX component');
      }
      
      // Wrap the component for safety
      return {
        default: (props: any) => (
          <SafeMDXWrapper>
            <module.default {...props} />
          </SafeMDXWrapper>
        )
      };
    } catch (error) {
      console.error(`Error loading MDX content for ${path}:`, error);
      return {
        default: () => (
          <div className="p-4 text-red-500">
            <h2>Error Loading Content</h2>
            <p>Could not load content for: {path}</p>
            <p className="text-sm opacity-75">{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        )
      };
    }
  });

  return (
    <Suspense fallback={<div className="p-4">Loading documentation...</div>}>
      <Content />
    </Suspense>
  );
};

export default function DocsRoutes() {
  const location = useLocation();
  const { handleDocsNavigation } = useDocsNavigation();
  
  // Handle the root /docs redirect efficiently
  useEffect(() => {
    if (location.pathname === '/docs' || location.pathname === '/docs/') {
      handleDocsNavigation('/docs/overview');
    }
  }, [location.pathname, handleDocsNavigation]);
  
  // Generate routes from docsSidebar
  const generateRoutes = () => {
    const routes = [];
    
    // Add the overview route
    routes.push(
      <Route key="overview" path="overview" element={<MDXContent path="overview" />} />
    );

    // Add routes from docsSidebar
    docsSidebar.forEach(section => {
      section.items.forEach(item => {
        routes.push(
          <Route 
            key={item.slug} 
            path={`${item.slug}/*`} 
            element={<MDXContent path={item.slug} />} 
          />
        );
      });
    });

    return routes;
  };
  
  // If we're at /docs or /docs/, don't render anything while redirecting
  if (location.pathname === '/docs' || location.pathname === '/docs/') {
    return <div className="min-h-screen bg-[#0B0A14]"></div>;
  }
  
  return (
    <DocsLayout key={location.pathname}>
      <Routes location={location} key={location.pathname}>
        {/* Generated routes */}
        {generateRoutes()}
        
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/docs/overview" replace />} />
      </Routes>
    </DocsLayout>
  );
}
