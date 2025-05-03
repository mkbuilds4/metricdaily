'use client'

import * as React from 'react';
import { MetricInputForm } from '@/components/MetricInputForm';
import { DashboardDisplay } from '@/components/DashboardDisplay';
import { type Metric } from '@/types';
import { getMetrics } from '@/app/actions'; // Import server action to fetch metrics

export default function Home() {
  const [metrics, setMetrics] = React.useState<Metric[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch initial metrics on component mount
  React.useEffect(() => {
    async function loadMetrics() {
      try {
        setIsLoading(true);
        const fetchedMetrics = await getMetrics();
        setMetrics(fetchedMetrics);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch metrics:", err);
        setError("Failed to load metrics. Please try refreshing the page.");
      } finally {
        setIsLoading(false);
      }
    }
    loadMetrics();
  }, []);

  // Callback function to update metrics state when a new metric is added
  const handleMetricAdded = (newMetric: Metric) => {
    // Add the new metric and sort by date descending
    setMetrics((prevMetrics) =>
      [...prevMetrics, newMetric].sort((a, b) => b.date.localeCompare(a.date))
    );
  };

  return (
    <main className="container mx-auto p-4 md:p-8 min-h-screen bg-secondary">
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
        <div className="lg:col-span-1">
          <MetricInputForm onMetricAdded={handleMetricAdded} />
        </div>

        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="p-6 border rounded-lg shadow-sm bg-card">Loading dashboard...</div>
          ) : (
            <DashboardDisplay metrics={metrics} />
          )}
        </div>
      </div>
    </main>
  );
}
