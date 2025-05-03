"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, ArrowLeft, ArrowRight } from 'lucide-react'; // Add navigation icons
import { type Metric } from "@/types";
import { getMetricsForCurrentWeek, calculateWeeklyAverage, formatDateISO, getWeekDates, getMetricForDate } from "@/lib/utils";
import { exportMetricsToSheet } from "@/app/actions"; // Import server action
import { useToast } from "@/hooks/use-toast";
import { eachDayOfInterval, format, addWeeks, subWeeks } from 'date-fns';


type DashboardDisplayProps = {
  metrics: Metric[]; // Directly use the metrics prop
};

export function DashboardDisplay({ metrics }: DashboardDisplayProps) {
  // Initialize currentWeekDate state internally and ensure it runs only once on mount
  const [currentWeekDate, setCurrentWeekDate] = React.useState(() => new Date());
  const [isExporting, setIsExporting] = React.useState(false);
  const { toast } = useToast();

  // Calculate derived state based on props and internal state
  const weeklyMetrics = getMetricsForCurrentWeek(metrics, currentWeekDate);
  const weeklyAverage = calculateWeeklyAverage(weeklyMetrics);
  const { start, end } = getWeekDates(currentWeekDate);
  const daysInWeek = eachDayOfInterval({ start, end });

  const handleExport = async () => {
    setIsExporting(true);
    try {
       const sheetData = metrics.map(m => ({
        date: m.date,
        value: m.value,
        notes: m.notes || '',
      }));

      await exportMetricsToSheet(sheetData);

      toast({
        title: "Export Successful",
        description: "Metrics data exported to Google Sheet.",
        variant: "default",
      });
    } catch (error) {
      console.error("Failed to export metrics:", error);
      const errorMessage = error instanceof Error ? error.message : "Could not export data to Google Sheet. Ensure authentication and configuration are correct.";
      toast({
        title: "Export Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const goToPreviousWeek = () => {
    setCurrentWeekDate(prevDate => subWeeks(prevDate, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeekDate(prevDate => addWeeks(prevDate, 1));
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-x-4">
        {/* Week Navigation */}
        <div className="flex items-center space-x-2">
           <Button onClick={goToPreviousWeek} variant="outline" size="icon" aria-label="Previous Week">
              <ArrowLeft className="h-4 w-4" />
           </Button>
            <div>
                <CardTitle className="text-xl md:text-2xl font-bold">Dashboard</CardTitle>
                <CardDescription>
                    Week: {format(start, 'MMM d')} - {format(end, 'MMM d, yyyy')}
                </CardDescription>
            </div>
           <Button onClick={goToNextWeek} variant="outline" size="icon" aria-label="Next Week">
              <ArrowRight className="h-4 w-4" />
           </Button>
        </div>

        {/* Export Button */}
        <Button onClick={handleExport} variant="outline" size="sm" disabled={isExporting} className="ml-auto">
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <Card>
           <CardHeader>
             <CardTitle className="text-lg">Weekly Overview</CardTitle>
           </CardHeader>
           <CardContent>
              <div className="text-3xl font-bold text-primary">
                {weeklyAverage.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Average metric value this week
              </p>
           </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daily Metrics</CardTitle>
          </CardHeader>
          <CardContent>
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px] md:w-[150px]">Date</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {daysInWeek.map((day) => {
                    // Use weeklyMetrics derived from the main metrics prop and currentWeekDate state
                    const metric = getMetricForDate(weeklyMetrics, day);
                    const formattedDate = formatDateISO(day);
                    const dayOfWeek = format(day, 'EEEE'); // e.g., Monday

                    return (
                      <TableRow key={formattedDate}>
                        <TableCell className="font-medium">{format(day, 'MMM d')}</TableCell>
                        <TableCell>{dayOfWeek}</TableCell>
                        <TableCell className="text-right">
                            {metric !== undefined ? metric.toLocaleString() : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
