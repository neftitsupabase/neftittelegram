



// not using Router in this project instead of router   used App.tsx








// import { createBrowserRouter } from "react-router-dom";
// import { lazy, Suspense } from "react";
// import AuthenticatedLayout from "@/components/layout/AuthenticatedLayout";
// import PublicLayout from "@/components/layout/PublicLayout";

// // Loading component
// const LoadingSpinner = () => (
//   <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white flex items-center justify-center">
//     <div className="text-center space-y-4">
//       <div className="w-16 h-16 border-t-2 border-blue-500 rounded-full animate-spin mx-auto"></div>
//       <p className="text-lg">Loading...</p>
//     </div>
//   </div>
// );

// // Lazy-loaded components
// const Index = lazy(() => import("@/pages/Index"));
// const Discover = lazy(() => import("@/pages/Discover"));
// const BurnPage = lazy(() => import("@/pages/Burn"));
// const Staking = lazy(() => import("@/pages/Staking"));
// const HowItWorks = lazy(() => import("@/pages/HowItWorks"));
// const Activity = lazy(() => import("@/pages/Activity"));
// // const DailyClaim = lazy(() => import("@/pages/DailyClaim"));
// // const DailyClaimStreak = lazy(() => import("@/pages/DailyClaimStreak"));
// const Profile = lazy(() => import("@/pages/Profile"));
// const EditProfile = lazy(() => import("@/pages/EditProfile"));
// const SocialLoginDemo = lazy(() => import("@/pages/SocialLoginDemo"));
// const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
// const ReferralPage = lazy(() => import("@/pages/ReferralPage"));
// const ErrorBoundary = lazy(() => import("@/components/errors/ErrorBoundary"));

// // Define which routes require authentication
// const router = createBrowserRouter([
//   // Public route (login page)
//   {
//     path: "/",
//     element: (
//       <PublicLayout>
//         <Suspense fallback={<LoadingSpinner />}>
//           <Index />
//         </Suspense>
//       </PublicLayout>
//     ),
//     errorElement: <ErrorBoundary />,
//   },
//   // Auth callback page - accessible to anyone but has its own auth logic
//   {
//     path: "/auth/callback",
//     element: (
//       <PublicLayout requireNoAuth={false}>
//         <Suspense fallback={<LoadingSpinner />}>
//           <AuthCallback />
//         </Suspense>
//       </PublicLayout>
//     ),
//   },
//   // Social login demo page - public
//   {
//     path: "/social-login",
//     element: (
//       <PublicLayout>
//         <Suspense fallback={<LoadingSpinner />}>
//           <SocialLoginDemo />
//         </Suspense>
//       </PublicLayout>
//     ),
//   },
//   // Referral page - public but handles wallet connection
//   {
//     path: "/invite/:referralCode",
//     element: (
//       <PublicLayout requireNoAuth={false}>
//         <Suspense fallback={<LoadingSpinner />}>
//           <ReferralPage />
//         </Suspense>
//       </PublicLayout>
//     ),
//   },
//   // Protected routes - require authentication
//   {
//     path: "/discover",
//     element: (
//       <AuthenticatedLayout>
//         <Suspense fallback={<LoadingSpinner />}>
//           <Discover />
//         </Suspense>
//       </AuthenticatedLayout>
//     ),
//   },
//   {
//     path: "/burn",
//     element: (
//       <AuthenticatedLayout>
//         <Suspense fallback={<LoadingSpinner />}>
//           <BurnPage />
//         </Suspense>
//       </AuthenticatedLayout>
//     ),
//   },
//   {
//     path: "/staking",
//     element: (
//       <AuthenticatedLayout>
//         <Suspense fallback={<LoadingSpinner />}>
//           <Staking />
//         </Suspense>
//       </AuthenticatedLayout>
//     ),
//   },
//   {
//     path: "/how-it-works",
//     element: (
//       <AuthenticatedLayout>
//         <Suspense fallback={<LoadingSpinner />}>
//           <HowItWorks />
//         </Suspense>
//       </AuthenticatedLayout>
//     ),
//   },
//   {
//     path: "/activity",
//     element: (
//       <AuthenticatedLayout>
//         <Suspense fallback={<LoadingSpinner />}>
//           <Activity />
//         </Suspense>
//       </AuthenticatedLayout>
//     ),
//   },
//   // {
//   //   path: "/daily-claim",
//   //   element: (
//   //     <AuthenticatedLayout>
//   //       <Suspense fallback={<LoadingSpinner />}>
//   //         <DailyClaim />
//   //       </Suspense>
//   //     </AuthenticatedLayout>
//   //   ),
//   // // },
//   // {
//   //   path: "/daily-claim-streak",
//   //   element: (
//   //     <AuthenticatedLayout>
//   //       <Suspense fallback={<LoadingSpinner />}>
//   //         <DailyClaimStreak />
//   //       </Suspense>
//   //     </AuthenticatedLayout>
//   //   ),
//   // },
//   {
//     path: "/profile",
//     element: (
//       <AuthenticatedLayout>
//         <Suspense fallback={<LoadingSpinner />}>
//           <Profile />
//         </Suspense>
//       </AuthenticatedLayout>
//     ),
//   },
//   {
//     path: "/edit-profile",
//     element: (
//       <AuthenticatedLayout>
//         <Suspense fallback={<LoadingSpinner />}>
//           <EditProfile />
//         </Suspense>
//       </AuthenticatedLayout>
//     ),
//   },
// ]);

// export default router;
