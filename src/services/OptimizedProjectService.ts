import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabaseClientManager';

interface ProjectSummary {
  id: string;
  title: string;
  description: string;
  collection_name: string; // ensure compatibility with Discover.Project
  banner_url?: string;
  category: string;
  reward_amount: number; // required for Discover.Project
  reward_currency?: string;
  xp_reward: number; // required for Discover.Project
  max_participants?: number;
  current_participants?: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_featured: boolean;
}

interface ProjectDetails extends ProjectSummary {
  blockchain?: string;
  metadata?: any;
  tasks?: ProjectTask[];
}

interface ProjectTask {
  id: string;
  title: string;
  description?: string;
  type: string;
  action_url?: string;
  is_active: boolean;
  sort_order: number;
}

interface PaginatedProjects {
  projects: ProjectSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

class OptimizedProjectService {
  private supabase: SupabaseClient;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private CACHE_TTL = 10 * 60 * 1000; // 10 minutes for projects

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Get paginated projects with selective columns
   */
  async getProjects(
    options: {
      category?: string;
      searchQuery?: string;
      page?: number;
      pageSize?: number;
      featured?: boolean;
    } = {}
  ): Promise<PaginatedProjects> {
    const { category = 'all', searchQuery = '', page = 0, pageSize = 20, featured = false } = options;
    
    const cacheKey = `projects_${category}_${searchQuery}_${page}_${pageSize}_${featured}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`Returning cached projects for ${cacheKey}`);
      return cached.data;
    }

    try {
      console.log(`Fetching fresh projects with pagination`);
      
      // Build query with selective columns
      let query = this.supabase
        .from('projects')
        .select('id, title, description, collection_name, banner_url, category, reward_amount, reward_currency, xp_reward, max_participants, current_participants, start_date, end_date, is_active, is_featured', { count: 'exact' })
        .eq('is_active', true)
        .order('end_date', { ascending: false });

      // Apply filters
      if (category !== 'all') {
        query = query.eq('category', category);
      }
      
      if (featured) {
        query = query.eq('is_featured', true);
      }
      
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      // Apply pagination
      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: projects, count, error } = await query;

      if (error) {
        console.error('Error fetching projects:', error);
        return { projects: [], total: 0, page, pageSize, hasMore: false };
      }

      const result: PaginatedProjects = {
        projects: projects || [],
        total: count || 0,
        page,
        pageSize,
        hasMore: (count || 0) > (page + 1) * pageSize
      };

      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.error('Error in getProjects:', error);
      return { projects: [], total: 0, page, pageSize, hasMore: false };
    }
  }

  /**
   * Get project count only (no data transfer)
   */
  async getProjectCount(category: string = 'all'): Promise<number> {
    const cacheKey = `project_count_${category}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      let query = this.supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (category !== 'all') {
        query = query.eq('category', category);
      }

      const { count, error } = await query;

      if (error) {
        console.error('Error fetching project count:', error);
        return 0;
      }

      const result = count || 0;
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.error('Error in getProjectCount:', error);
      return 0;
    }
  }

  /**
   * Get single project with tasks
   */
  async getProjectDetails(projectId: string): Promise<ProjectDetails | null> {
    const cacheKey = `project_details_${projectId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`Returning cached project details for ${projectId}`);
      return cached.data;
    }

    try {
      console.log(`Fetching fresh project details for ${projectId}`);
      
      // Fetch project with selective columns
      const { data: project, error: projectError } = await this.supabase
        .from('projects')
        .select('id, title, description, banner_url, category, reward_amount, reward_currency, xp_reward, max_participants, current_participants, start_date, end_date, is_active, is_featured, collection_name, blockchain, metadata')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        console.error('Error fetching project:', projectError);
        return null;
      }

      // Fetch tasks with selective columns
      const { data: tasks, error: tasksError } = await this.supabase
        .from('project_tasks')
        .select('id, title, description, type, action_url, is_active, sort_order')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (tasksError) {
        console.error('Error fetching project tasks:', tasksError);
      }

      const result: ProjectDetails = {
        ...project,
        tasks: tasks || []
      };

      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.error('Error in getProjectDetails:', error);
      return null;
    }
  }

  /**
   * Get featured projects (limited set)
   */
  async getFeaturedProjects(limit: number = 6): Promise<ProjectSummary[]> {
    const cacheKey = `featured_projects_${limit}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const { data: projects, error } = await this.supabase
        .from('projects')
        .select('id, title, description, collection_name, banner_url, category, reward_amount, reward_currency, xp_reward, max_participants, current_participants, start_date, end_date, is_active, is_featured')
        .eq('is_active', true)
        .eq('is_featured', true)
        .order('end_date', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching featured projects:', error);
        return [];
      }

      const result = projects || [];
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.error('Error in getFeaturedProjects:', error);
      return [];
    }
  }

  /**
   * Clear project cache
   */
  clearProjectCache(projectId?: string): void {
    if (projectId) {
      // Clear specific project cache
      const keysToDelete = Array.from(this.cache.keys()).filter(key => 
        key.includes(`project_details_${projectId}`) || 
        key.includes(`project_count_`) ||
        key.includes(`projects_`)
      );
      keysToDelete.forEach(key => this.cache.delete(key));
      console.log(`Cleared cache for project ${projectId}`);
    } else {
      // Clear all project-related cache
      const keysToDelete = Array.from(this.cache.keys()).filter(key => 
        key.includes('project_') || key.includes('projects_')
      );
      keysToDelete.forEach(key => this.cache.delete(key));
      console.log('Cleared all project cache');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; projectEntries: number } {
    const projectEntries = Array.from(this.cache.keys()).filter(key => 
      key.includes('project_') || key.includes('projects_')
    ).length;

    return {
      size: this.cache.size,
      projectEntries
    };
  }
}

export const optimizedProjectService = new OptimizedProjectService();
export default optimizedProjectService;
