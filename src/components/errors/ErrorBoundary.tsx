import React from 'react';
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';

const ErrorBoundary = () => {
  const error = useRouteError();
  
  let errorMessage: string;
  let errorStatus: number | null = null;
  
  if (isRouteErrorResponse(error)) {
    // This is a route error
    errorStatus = error.status;
    errorMessage = error.statusText || error.data?.message || 'Something went wrong';
  } else if (error instanceof Error) {
    // This is a JavaScript error
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    // This is a string error
    errorMessage = error;
  } else {
    // Unknown error type
    errorMessage = 'Unknown error occurred';
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white flex items-center justify-center">
      <div className="max-w-md w-full p-8 rounded-lg bg-gray-900/50 backdrop-blur-lg border border-gray-800">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto flex items-center justify-center rounded-full bg-red-500/20 border border-red-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">
            {errorStatus ? `Error ${errorStatus}` : 'Oops!'}
          </h1>
          <p className="text-gray-400 text-lg">{errorMessage}</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorBoundary; 