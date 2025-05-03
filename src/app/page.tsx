import React from 'react';
import WorkLogInputForm from '@/components/WorkLogInputForm';
import UPHTargetManager from '@/components/UPHTargetManager';
import ProductivityDashboard from '@/components/DashboardDisplay';
// Import server actions directly
import { getWorkLogs, getActiveUPHTarget, saveWorkLog, getUPHTargets, addUPHTarget, updateUPHTarget, deleteUPHTarget, setActiveUPHTarget } from '@/lib/actions';
import type { DailyWorkLog, UPHTarget } from '@/types';


// This component remains a Server Component
export default async function Home() {
  // Fetch initial data directly in the Server Component
  // Using Promise.all for potentially parallel fetching
  const [initialWorkLogs, initialActiveTarget, initialTargets] = await Promise.all([
    getWorkLogs(),
    getActiveUPHTarget(),
    getUPHTargets(),
  ]);

  // No need for wrapper action handlers here, pass the actual actions

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 lg:p-12">
       {/* Added responsive padding */}
      <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Metric Daily Dashboard</h1>
      <div className="w-full max-w-5xl space-y-8">
        {/* Pass the actual saveWorkLog server action */}
        {/* The WorkLogInputForm component will handle optimistic updates internally */}
        <WorkLogInputForm
            onWorkLogSaved={saveWorkLog}
            // No existingLog prop needed here as it's for adding new logs
            // onOptimisticUpdate prop is handled within the form component now
            />

        {/* Pass initial targets and the necessary action functions */}
        {/* UPHTargetManager will call these actions directly and handle optimistic updates */}
        <UPHTargetManager
          targets={initialTargets} // Pass initial data
          addUPHTargetAction={addUPHTarget}
          updateUPHTargetAction={updateUPHTarget}
          deleteUPHTargetAction={deleteUPHTarget}
          setActiveUPHTargetAction={setActiveUPHTarget}
        />
        {/* Pass fetched data to the display component */}
        {/* ProductivityDashboard will now manage its own state for optimistic updates */}
        <ProductivityDashboard
            initialWorkLogs={initialWorkLogs}
            initialActiveTarget={initialActiveTarget}
            />
      </div>
    </main>
  );
}
