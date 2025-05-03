import React from 'react';
import WorkLogInputForm from '@/components/WorkLogInputForm';
import UPHTargetManager from '@/components/UPHTargetManager';
import ProductivityDashboard from '@/components/DashboardDisplay';
import { getWorkLogs, getActiveUPHTarget, saveWorkLog, getUPHTargets } from '@/lib/actions'; // Import server actions
import type { DailyWorkLog, UPHTarget } from '@/types';
import { revalidatePath } from 'next/cache'; // Import revalidatePath

// This component remains a Server Component

// Helper function to trigger revalidation - needed after mutations
async function revalidateDashboard() {
  'use server';
  revalidatePath('/'); // Revalidate the home page
}


export default async function Home() {
  // Fetch initial data directly in the Server Component
  // Using Promise.all for potentially parallel fetching
  const [workLogs, activeTarget, targets] = await Promise.all([
    getWorkLogs(),
    getActiveUPHTarget(),
    getUPHTargets(),
  ]);

  // Server action to handle saving work logs
  // It will internally call the saveWorkLog action and then revalidate
  // No need for inline 'use server' here as it's defined within a Server Component
  const handleSaveWorkLogAction = async (logData: Omit<DailyWorkLog, 'id'>) => {
    // 'use server'; // Removed inline directive
    try {
      await saveWorkLog(logData);
      revalidateDashboard(); // Revalidate after saving
    } catch (error) {
      console.error("Failed to save work log:", error);
      // Optionally, return an error state or throw the error
      throw error; // Re-throw to potentially handle in the form
    }
  };

   // Server action to handle target updates and revalidation
   // No need for inline 'use server' here as it's defined within a Server Component
  const handleTargetsUpdateAction = async () => {
    // 'use server'; // Removed inline directive
    revalidateDashboard(); // Revalidate when targets are updated/deleted/activated
  };


  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 lg:p-12">
       {/* Added responsive padding */}
      <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Metric Daily Dashboard</h1>
      <div className="w-full max-w-5xl space-y-8">
        {/* Pass the server action wrapper to the client component */}
        <WorkLogInputForm onWorkLogSaved={handleSaveWorkLogAction} />
        {/* Pass targets and the revalidation action wrapper */}
        <UPHTargetManager targets={targets} onTargetsUpdate={handleTargetsUpdateAction} />
        {/* Pass fetched data to the display component */}
        <ProductivityDashboard workLogs={workLogs} activeTarget={activeTarget} />
      </div>
    </main>
  );
}
