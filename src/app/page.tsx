'use client'

import * as React from 'react';
import { MetricInputForm } from '@/components/MetricInputForm';
import { DashboardDisplay } from '@/components/DashboardDisplay';
import { type Metric } from '@/types';
import { getMetrics, addMetric } from '@/app/actions'; // Import server actions
import { useToast } from "@/hooks/use-toast"; // Import useToast

export default function Home() {
  const [metrics, setMetrics] = React.useState<Metric[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast(); // Use the toast hook

  // Fetch initial metrics on component mount
  React.useEffect(() => {
    async function loadMetrics() {
      try {
        setIsLoading(true);
        const fetchedMetrics = await getMetrics();
        // Sort fetched metrics by date descending immediately
        setMetrics(fetchedMetrics.sort((a, b) => b.date.localeCompare(a.date)));
        setError(null);
      } catch (err) {
        console.error("Failed to fetch metrics:", err);
        setError("Failed to load metrics. Please try refreshing the page.");
      } finally {
        setIsLoading(false);
      }
    }
    loadMetrics();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Callback function to update metrics state when a new metric is added or updated
  const handleMetricSaved = async (metricData: Omit<Metric, 'id'>) => {
    try {
      const savedMetric = await addMetric(metricData); // Call the server action

      setMetrics((prevMetrics) => {
        // Check if the metric already exists (based on date)
        const existingIndex = prevMetrics.findIndex(m => m.date === savedMetric.date);
        let updatedMetrics;
        if (existingIndex > -1) {
          // Update existing metric in the array
          updatedMetrics = [...prevMetrics];
          updatedMetrics[existingIndex] = savedMetric;
           toast({
             title: "Metric Updated",
             description: `Metric for ${savedMetric.date} updated successfully.`,
             variant: "default",
           });
        } else {
          // Add new metric
          updatedMetrics = [...prevMetrics, savedMetric];
           toast({
             title: "Metric Added",
             description: `Metric for ${savedMetric.date} saved successfully.`,
             variant: "default",
           });
        }
        // Ensure the list remains sorted by date descending
        return updatedMetrics.sort((a, b) => b.date.localeCompare(a.date));
      });

    } catch (error) {
       console.error("Failed to save metric:", error);
       toast({
           title: "Error",
           description: "Failed to save metric. Please try again.",
           variant: "destructive",
       });
    }
  };


  return (
    <main className="container mx-auto p-4 md:p-8 min-h-screen bg-background"> {/* Changed bg-secondary to bg-background for main area */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-primary">Metric Daily</h1>
        <p className="text-muted-foreground">Track your important numbers day by day.</p>
      </header>

      {error && (
        <div className="mb-4 p-4 border border-destructive/50 text-destructive bg-destructive/10 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form now sits in a Card for visual consistency */}
        <div className="lg:col-span-1">
           <MetricInputForm onMetricSaved={handleMetricSaved} />
        </div>

        <div className="lg:col-span-2">
          {isLoading ? (
             <div className="p-6 border rounded-lg shadow-sm bg-card text-center text-muted-foreground">Loading dashboard...</div>
          ) : (
             <DashboardDisplay metrics={metrics} />
          )}
        </div>
      </div>
    </main>
  );
}
