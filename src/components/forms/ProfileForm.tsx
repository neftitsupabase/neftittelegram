import React, { useState, useCallback } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { useToast } from '@/components/ui/use-toast';
import { formStyles, textStyles } from '@/utils/styles';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

/**
 * Form validation schema using Zod
 */
const profileFormSchema = z.object({
  displayName: z
    .string()
    .min(3, { message: "Display name must be at least 3 characters" })
    .max(30, { message: "Display name cannot exceed 30 characters" }),
  bio: z
    .string()
    .max(160, { message: "Bio cannot exceed 160 characters" })
    .optional(),
  website: z
    .string()
    .url({ message: "Please enter a valid URL" })
    .or(z.literal(''))
    .optional(),
  twitter: z
    .string()
    .regex(/^@?(\w){1,15}$/, { message: "Please enter a valid Twitter handle" })
    .or(z.literal(''))
    .optional()
    .transform(val => val.startsWith('@') ? val : `@${val}`),
});

/**
 * Derived TypeScript type from Zod schema
 */
type ProfileFormValues = z.infer<typeof profileFormSchema>;

/**
 * Form state type using discriminated union for better type safety
 */
type FormStatus = 
  | { state: 'idle' }
  | { state: 'validating' }
  | { state: 'submitting' }
  | { state: 'success', message: string }
  | { state: 'error', message: string, details?: string };

/**
 * Props for the ProfileForm component
 */
interface ProfileFormProps {
  /** Initial values for the form */
  initialValues?: Partial<ProfileFormValues>;
  /** Function to call when form is submitted successfully */
  onSubmit: (values: ProfileFormValues) => Promise<void>;
  /** Optional class name for additional styling */
  className?: string;
}

/**
 * ProfileForm - A form for editing user profile information
 * 
 * Handles validation, submission state, and error handling with a clean interface.
 * Uses React Hook Form with Zod validation for type-safe form handling.
 * 
 * @example
 * <ProfileForm 
 *   initialValues={{ displayName: "CryptoUser", bio: "I love NFTs" }}
 *   onSubmit={handleProfileUpdate}
 * />
 */
export const ProfileForm: React.FC<ProfileFormProps> = ({
  initialValues = {},
  onSubmit,
  className,
}) => {
  // Toast notifications
  const { toast } = useToast();
  
  // Form state management
  const [status, setStatus] = useState<FormStatus>({ state: 'idle' });
  
  // Setup react-hook-form with zod validation
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: initialValues.displayName || '',
      bio: initialValues.bio || '',
      website: initialValues.website || '',
      twitter: initialValues.twitter || '',
    },
  });
  
  /**
   * Handle form submission with proper loading and error states
   */
  const handleFormSubmit = useCallback(async (data: ProfileFormValues) => {
    try {
      // Update form status to submitting
      setStatus({ state: 'submitting' });
      
      // Submit form data
      await onSubmit(data);
      
      // Update status on success
      setStatus({ 
        state: 'success', 
        message: 'Profile updated successfully' 
      });
      
      // Show success toast
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully',
      });
      
      // Reset form state after successful submission
      reset(data);
    } catch (error) {
      // Extract error message
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to update profile';
      
      // Capture error details for debugging
      const errorDetails = error instanceof Error 
        ? error.stack 
        : JSON.stringify(error);
      
      // Update form status with error
      setStatus({ 
        state: 'error', 
        message: errorMessage,
        details: errorDetails,
      });
      
      // Show error toast
      toast({
        title: 'Update Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      
      // Log error for debugging
      console.error('[ProfileForm] Submission error:', error);
    }
  }, [onSubmit, reset, toast]);
  
  /**
   * Check if form is in a loading state
   */
  const isLoading = status.state === 'submitting' || status.state === 'validating';
  
  return (
    <form 
      onSubmit={handleSubmit(handleFormSubmit)}
      className={cn(formStyles.container, className)}
    >
      {/* Display Name Field */}
      <div className={formStyles.group}>
        <Label htmlFor="displayName" className="text-white">
          Display Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="displayName"
          {...register('displayName')}
          placeholder="Enter your display name"
          disabled={isLoading}
          className={errors.displayName ? 'border-red-500' : ''}
        />
        {errors.displayName && (
          <ErrorDisplay 
            error={errors.displayName.message} 
            variant="minimal" 
          />
        )}
      </div>
      
      {/* Bio Field */}
      <div className={formStyles.group}>
        <div className="flex justify-between">
          <Label htmlFor="bio" className="text-white">Bio</Label>
          <span className={textStyles.hint}>
            {/* Show character count */}
            Max 160 characters
          </span>
        </div>
        <Textarea
          id="bio"
          {...register('bio')}
          placeholder="Tell us about yourself..."
          rows={3}
          disabled={isLoading}
          className={errors.bio ? 'border-red-500' : ''}
        />
        {errors.bio && (
          <ErrorDisplay 
            error={errors.bio.message} 
            variant="minimal" 
          />
        )}
      </div>
      
      {/* Website Field */}
      <div className={formStyles.group}>
        <Label htmlFor="website" className="text-white">Website</Label>
        <Input
          id="website"
          {...register('website')}
          placeholder="https://yourwebsite.com"
          disabled={isLoading}
          className={errors.website ? 'border-red-500' : ''}
        />
        {errors.website && (
          <ErrorDisplay 
            error={errors.website.message} 
            variant="minimal" 
          />
        )}
      </div>
      
      {/* Twitter Field */}
      <div className={formStyles.group}>
        <Label htmlFor="twitter" className="text-white">Twitter</Label>
        <Input
          id="twitter"
          {...register('twitter')}
          placeholder="@username"
          disabled={isLoading}
          className={errors.twitter ? 'border-red-500' : ''}
        />
        {errors.twitter && (
          <ErrorDisplay 
            error={errors.twitter.message} 
            variant="minimal" 
          />
        )}
      </div>
      
      {/* Form Error Message */}
      {status.state === 'error' && (
        <ErrorDisplay 
          error={status.message} 
          details={status.details}
          variant="banner" 
        />
      )}
      
      {/* Submit Button */}
      <Button 
        type="submit" 
        disabled={isLoading || !isDirty}
        className="w-full mt-4"
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isLoading ? 'Saving Changes...' : 'Save Changes'}
      </Button>
      
      {/* Success Message */}
      {status.state === 'success' && (
        <p className={cn(textStyles.success, "mt-2 text-center")}>
          {status.message}
        </p>
      )}
    </form>
  );
};

export default ProfileForm; 