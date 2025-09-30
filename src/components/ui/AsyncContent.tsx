import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Props for the AsyncContent component
 */
interface AsyncContentProps<T> {
  /** Whether the content is currently loading */
  isLoading: boolean;
  /** Any error that occurred during loading */
  error: Error | string | null;
  /** The data to render when loaded successfully */
  data: T | null;
  /** Function to retry loading if an error occurred */
  onRetry?: () => void;
  /** Custom renderer for the loading state */
  renderLoading?: () => React.ReactNode;
  /** Custom renderer for the error state */
  renderError?: (error: Error | string, retry?: () => void) => React.ReactNode;
  /** Custom renderer for the data */
  renderData: (data: T) => React.ReactNode;
  /** Custom renderer for empty state (when data is null but no error or loading) */
  renderEmpty?: () => React.ReactNode;
}

/**
 * AsyncContent - A component for handling async data rendering states
 * 
 * Provides consistent handling of loading, error, and success states for async data.
 * Uses render props pattern for flexible content rendering while maintaining consistent UX.
 * 
 * @example
 * <AsyncContent
 *   isLoading={isLoading}
 *   error={error}
 *   data={userData}
 *   onRetry={fetchUserData}
 *   renderData={(user) => <UserProfile user={user} />}
 * />
 */
export function AsyncContent<T>({
  isLoading,
  error,
  data,
  onRetry,
  renderLoading,
  renderError,
  renderData,
  renderEmpty,
}: AsyncContentProps<T>) {
  // Default loading state
  const defaultLoadingState = (
    <div className="flex flex-col items-center justify-center p-6 space-y-4">
      <div className="w-12 h-12 border-t-2 border-blue-500 rounded-full animate-spin"></div>
      <p className="text-gray-400">Loading...</p>
    </div>
  );

  // Default error state
  const defaultErrorState = (error: Error | string) => (
    <div className="flex flex-col items-center justify-center p-6 space-y-4 text-center">
      <div className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500/20">
        <AlertCircle className="w-6 h-6 text-red-500" />
      </div>
      <p className="text-red-400">
        {typeof error === 'string' ? error : error.message || 'An error occurred'}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          Try Again
        </Button>
      )}
    </div>
  );

  // Default empty state
  const defaultEmptyState = (
    <div className="flex flex-col items-center justify-center p-6 space-y-2 text-center">
      <p className="text-gray-400">No data available</p>
    </div>
  );

  // Render states in priority order: loading → error → data → empty
  if (isLoading) {
    return <>{renderLoading ? renderLoading() : defaultLoadingState}</>;
  }

  if (error) {
    return <>{renderError ? renderError(error, onRetry) : defaultErrorState(error)}</>;
  }

  if (data) {
    return <>{renderData(data)}</>;
  }

  return <>{renderEmpty ? renderEmpty() : defaultEmptyState}</>;
}

export default AsyncContent; 