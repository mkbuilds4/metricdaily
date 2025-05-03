"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from 'lucide-react';
import { type Metric } from "@/types";
import { getMetricsForCurrentWeek, calculateWeeklyAverage, formatDateISO, getWeekDates, getMetricForDate } from "@/lib/utils";
import { exportMetricsToSheet } from "@/app/actions"; // Import server action
import { useToast } from "@/hooks/use-toast";
import { eachDayOfInterval, format } from 'date-fns';


type DashboardDisplayProps = {
  metrics: Metric[];
  initialWeekDate?: Date; // Allow specifying an initial week
};

export function DashboardDisplay({ metrics: initialMetrics, initialWeekDate = new Date() }: DashboardDisplayProps) {
  const [metrics, setMetrics] = React.useState<Metric[]>(initialMetrics);
  const [currentWeekDate, setCurrentWeekDate] = React.useState(initialWeekDate);
  const [isExporting, setIsExporting] = React.useState(false);
  const { toast } = useToast();

  // Update metrics state if the initial prop changes
  React.useEffect(() => {
    setMetrics(initialMetrics);
  }, [initialMetrics]);

   // Update currentWeekDate if the initial prop changes
   React.useEffect(() => {
    setCurrentWeekDate(initialWeekDate);
  }, [initialWeekDate]);


  const weeklyMetrics = getMetricsForCurrentWeek(metrics, currentWeekDate);
  const weeklyAverage = calculateWeeklyAverage(weeklyMetrics);

  const { start, end } = getWeekDates(currentWeekDate);
  const daysInWeek = eachDayOfInterval({ start, end });


  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Prepare data in the format expected by Google Sheets service
       const sheetData = metrics.map(m => ({
        date: m.date,
        value: m.value,
        notes: m.notes || '',
      }));

      await exportMetricsToSheet(sheetData); // Call server action

      toast({
        title: "Export Successful",
        description: "Metrics data exported to Google Sheet.",
        variant: "default",
      });
    } catch (error) {
      console.error("Failed to export metrics:", error);
      toast({
        title: "Export Failed",
        description: "Could not export data to Google Sheet. Ensure authentication and configuration are correct.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-2xl font-bold">Dashboard</CardTitle>
          <CardDescription>
            Week of {format(start, 'MMM d')} - {format(end, 'MMM d, yyyy')}
          </CardDescription>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export to Google Sheet'}
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
                    <TableHead className="w-[150px]">Date</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {daysInWeek.map((day) => {
                    const metricValue = getMetricForDate(weeklyMetrics, day);
                    const formattedDate = formatDateISO(day);
                    const dayOfWeek = format(day, 'EEEE'); // e.g., Monday

                    return (
                      <TableRow key={formattedDate}>
                        <TableCell className="font-medium">{format(day, 'MMM d')}</TableCell>
                        <TableCell>{dayOfWeek}</TableCell>
                        <TableCell className="text-right">
                            {metricValue !== undefined ? metricValue.toLocaleString() : <span className="text-muted-foreground">-</span>}
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
