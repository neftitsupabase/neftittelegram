import { useState, useEffect } from 'react';
import { optimizedProjectService } from '@/services/OptimizedProjectService';

interface UseOptimizedProjectsOptions {
  category?: string;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
  featured?: boolean;
}

interface UseOptimizedProjectsReturn {
  projects: any[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useOptimizedProjects(options: UseOptimizedProjectsOptions = {}): UseOptimizedProjectsReturn {
  const { category = 'all', searchQuery = '', page = 0, pageSize = 20, featured = false } = options;
  
  const [projects, setProjects] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(page);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = async (pageNum: number = 0, append: boolean = false) => {
    setLoading(true);
    setError(null);

    try {
      const result = await optimizedProjectService.getProjects({
        category,
        searchQuery,
        page: pageNum,
        pageSize,
        featured
      });

      if (append) {
        setProjects(prev => [...prev, ...result.projects]);
      } else {
        setProjects(result.projects);
      }

      setTotal(result.total);
      setCurrentPage(result.page);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('Error loading projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (hasMore && !loading) {
      await loadProjects(currentPage + 1, true);
    }
  };

  const refresh = async () => {
    // Clear cache and reload from first page
    optimizedProjectService.clearProjectCache();
    setProjects([]);
    setCurrentPage(0);
    await loadProjects(0, false);
  };

  useEffect(() => {
    // Reset to first page when filters change
    setProjects([]);
    setCurrentPage(0);
    loadProjects(0, false);
  }, [category, searchQuery, featured]);

  return {
    projects,
    total,
    page: currentPage,
    pageSize,
    hasMore,
    loading,
    error,
    loadMore,
    refresh
  };
}
