'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getWorkLogs, getUPHTargets, getActiveUPHTarget, getAuditLogs } from '@/lib/actions'; // Added getAuditLogs
import type { DailyWorkLog, UPHTarget, AuditLogEntry } from '@/types'; // Added AuditLogEntry
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { format, parseISO, isValid, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, subWeeks, getHours, isSameDay } from 'date-fns'; // Added getHours, isSameDay
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Filter, X, Activity, TrendingUp, Clock } from 'lucide-react'; // Added Clock
import { cn, calculateDailyUPH } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

// Define chart colors using HSL variables from globals.css
const CHART_COLORS = {
  documents: 'hsl(var(--chart-1))',
  videos: 'hsl(var(--chart-2))',
  uph: 'hsl(var(--chart-3))',
  targetUPH: 'hsl(var(--chart-4))',
  hourlyActivity: 'hsl(var(--chart-5))', // Color for the new chart
};

const DEFAULT_DAYS_TO_SHOW = 30; // Show last 30 days by default

export default function AnalyticsPage() {
  const [workLogs, setWorkLogs] = useState<DailyWorkLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]); // State for audit logs
  const [targets, setTargets] = useState<UPHTarget[]>([]);
  const [activeTarget, setActiveTarget] = useState<UPHTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterDateRange, setFilterDateRange] = useState<DateRange | undefined>(() => {
    // Default to last 30 days
    const endDate = endOfDay(new Date());
    const startDate = startOfDay(subDays(endDate, DEFAULT_DAYS_TO_SHOW - 1));
    return { from: startDate, to: endDate };
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const loadData = useCallback(() => {
    if (typeof window === 'undefined') return;
    setIsLoading(true);
    try {
      const loadedLogs = getWorkLogs();
      const loadedAuditLogs = getAuditLogs(); // Load audit logs
      const loadedTargets = getUPHTargets();
      const loadedActiveTarget = getActiveUPHTarget();

      setWorkLogs(loadedLogs);
      setAuditLogs(loadedAuditLogs); // Set audit logs state
      setTargets(loadedTargets);
      setActiveTarget(loadedActiveTarget);
      console.log('[AnalyticsPage] Data loaded:', { logs: loadedLogs.length, auditLogs: loadedAuditLogs.length, targets: loadedTargets.length });
    } catch (error) {
      console.error('[AnalyticsPage] Error loading data:', error);
      // Add toast notification here if needed
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      loadData();
    }
  }, [loadData]);

  // Filter logs based on selected date range
  const filteredLogs = useMemo(() => {
    return workLogs.filter(log => {
      const logDate = parseISO(log.date + 'T00:00:00'); // Ensure proper date object
      if (!isValid(logDate)) return false;

      let matchesDateRange = true;
      if (filterDateRange?.from) {
        matchesDateRange = logDate >= startOfDay(filterDateRange.from);
      }
      if (filterDateRange?.to) {
        matchesDateRange = matchesDateRange && logDate <= endOfDay(filterDateRange.to);
      }
      return matchesDateRange;
    });
  }, [workLogs, filterDateRange]);

  // Determine selected date for hourly chart
  const selectedDateForHourlyChart = useMemo(() => {
    if (filterDateRange?.from && filterDateRange?.to && isSameDay(filterDateRange.from, filterDateRange.to)) {
      return filterDateRange.from; // Use the date if the range is a single day
    }
     if (filterDateRange?.from && !filterDateRange?.to) {
        return filterDateRange.from; // Use 'from' date if only 'from' is selected
    }
    return null; // No single date selected or range spans multiple days
  }, [filterDateRange]);

  // Prepare data for charts
  const dailyWorkChartData = useMemo(() => {
    // Sort logs by date ascending for charting trends over time
    const sortedLogs = [...filteredLogs].sort((a, b) => a.date.localeCompare(b.date));

    return sortedLogs.map(log => {
      const logDate = parseISO(log.date);
      // Use the target associated with the log, or fallback to active target for UPH calculation
      const targetForLog = targets.find(t => t.id === log.targetId) ?? activeTarget;
      const uph = targetForLog ? calculateDailyUPH(log, targetForLog) : null;

      return {
        date: format(logDate, 'MMM d'), // Format date for XAxis label
        fullDate: log.date, // Keep original date for sorting/tooltips if needed
        documents: log.documentsCompleted,
        videos: log.videoSessionsCompleted,
        uph: uph !== null && isFinite(uph) ? uph : 0, // Set to 0 if null or infinite
        targetUPH: targetForLog?.targetUPH ?? null, // Include target UPH for reference line
      };
    });
  }, [filteredLogs, targets, activeTarget]);

  // Prepare data for hourly activity chart
   const hourlyActivityChartData = useMemo(() => {
    if (!selectedDateForHourlyChart || auditLogs.length === 0) {
        return [];
    }

    const selectedDayStart = startOfDay(selectedDateForHourlyChart);
    const selectedDayEnd = endOfDay(selectedDateForHourlyChart);

    // Filter audit logs for the selected date and relevant actions
    const relevantActions: AuditLogEntry['action'][] = [
        'CREATE_WORK_LOG',
        'UPDATE_WORK_LOG',
        'UPDATE_WORK_LOG_QUICK_COUNT',
        'UPDATE_WORK_LOG_BREAK',
        'UPDATE_WORK_LOG_TRAINING',
        'UPDATE_WORK_LOG_GOAL_MET',
        'SYSTEM_ARCHIVE_TODAY_LOG', // Might indicate end-of-day activity
    ];

    const hourlyCounts: Record<number, number> = Array.from({ length: 24 }, (_, i) => i).reduce((acc, hour) => {
        acc[hour] = 0;
        return acc;
    }, {} as Record<number, number>);

    auditLogs.forEach(log => {
        const logTimestamp = parseISO(log.timestamp);
        if (
            isValid(logTimestamp) &&
            logTimestamp >= selectedDayStart &&
            logTimestamp <= selectedDayEnd &&
            relevantActions.includes(log.action)
        ) {
            const hour = getHours(logTimestamp);
            hourlyCounts[hour]++;
        }
    });

    // Format for chart
    return Object.entries(hourlyCounts).map(([hour, count]) => ({
        hourLabel: `${String(hour).padStart(2, '0')}:00`, // Format as HH:00
        count: count,
    }));

   }, [auditLogs, selectedDateForHourlyChart]);


  // Chart Configurations
  const dailyCountsChartConfig = {
    documents: { label: "Documents", color: CHART_COLORS.documents },
    videos: { label: "Videos", color: CHART_COLORS.videos },
  };

  const dailyUPHChartConfig = {
     uph: { label: "Actual UPH", color: CHART_COLORS.uph },
     targetUPH: { label: "Target UPH", color: CHART_COLORS.targetUPH },
  };

   const hourlyActivityChartConfig = {
     count: { label: "Logged Activities", color: CHART_COLORS.hourlyActivity },
   };

  // Preset Date Range Handlers
  const setPresetDateRange = (range: DateRange | undefined) => {
      setFilterDateRange(range);
      setDatePickerOpen(false); // Close popover after selection
  };

  const today = new Date();
  const presetRanges = [
    { label: "Today", range: { from: startOfDay(today), to: endOfDay(today) } }, // Added Today
    { label: "Yesterday", range: { from: startOfDay(subDays(today, 1)), to: endOfDay(subDays(today, 1)) } }, // Added Yesterday
    { label: "Last 7 Days", range: { from: startOfDay(subDays(today, 6)), to: endOfDay(today) } },
    { label: "Last 30 Days", range: { from: startOfDay(subDays(today, 29)), to: endOfDay(today) } },
    { label: "This Week", range: { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfDay(today) } },
    { label: "Last Week", range: { from: startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }), to: endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }) } },
    { label: "This Month", range: { from: startOfDay(new Date(today.getFullYear(), today.getMonth(), 1)), to: endOfDay(today) } },
    { label: "Last Month", range: { from: startOfDay(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: endOfDay(new Date(today.getFullYear(), today.getMonth(), 0)) } },
  ];

   // Calculate Summary Statistics
   const summaryStats = useMemo(() => {
    const totalDocs = dailyWorkChartData.reduce((sum, d) => sum + d.documents, 0);
    const totalVideos = dailyWorkChartData.reduce((sum, d) => sum + d.videos, 0);
    const avgUPH = dailyWorkChartData.length > 0 ? dailyWorkChartData.reduce((sum, d) => sum + d.uph, 0) / dailyWorkChartData.length : 0;
    const daysLogged = dailyWorkChartData.length;
    return {
      totalDocs,
      totalVideos,
      avgUPH: parseFloat(avgUPH.toFixed(2)),
      daysLogged
    };
   }, [dailyWorkChartData]);

  if (isLoading) {
    return &lt;div className="p-6 text-center text-muted-foreground"&gt;Loading analytics...&lt;/div&gt;;
  }

  return (
    &lt;div className="w-full max-w-7xl mx-auto space-y-8 p-4 md:p-6 lg:p-8"&gt;
      &lt;h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center"&gt;Productivity Analytics&lt;/h1&gt;

        {&/* Filter Controls */}
        &lt;Card className="shadow-sm"&gt;
            &lt;CardHeader&gt;
                &lt;CardTitle className="text-lg font-semibold flex items-center gap-2"&gt;
                    &lt;Filter className="h-5 w-5" /&gt; Filter Data Range
                &lt;/CardTitle&gt;
                &lt;CardDescription&gt;Select the time period for the analytics. Hourly chart requires a single day selection.&lt;/CardDescription&gt;
            &lt;/CardHeader&gt;
            &lt;CardContent className="flex flex-col sm:flex-row items-center gap-3 pt-2"&gt;
                &lt;Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}&gt;
                   &lt;PopoverTrigger asChild&gt;
                     &lt;Button
                       id="date"
                       variant={"outline"}
                       className={cn(
                         "w-full sm:w-[300px] justify-start text-left font-normal h-9 text-sm", // Fixed width for popover trigger consistency
                         !filterDateRange && "text-muted-foreground"
                       )}
                     &gt;
                       &lt;CalendarIcon className="mr-2 h-4 w-4" /&gt;
                       {filterDateRange?.from ? (
                         filterDateRange.to ? (
                            // Check if start and end dates are the same
                            isSameDay(filterDateRange.from, filterDateRange.to)
                             ? format(filterDateRange.from, "LLL dd, y") // Show single date
                             : &lt;&gt;
                                 {format(filterDateRange.from, "LLL dd, y")} -&lt;{" "}
                                 {format(filterDateRange.to, "LLL dd, y")}
                               &lt;/&gt;
                         ) : (
                           format(filterDateRange.from, "LLL dd, y")
                         )
                       ) : (
                         &lt;span&gt;Select Date Range&lt;/span&gt;
                       )}
                     &lt;/Button&gt;
                   &lt;/PopoverTrigger&gt;
                    &lt;PopoverContent className="w-auto p-0 flex flex-col sm:flex-row" align="start"&gt;
                         &lt;div className="flex flex-col p-2 border-b sm:border-r sm:border-b-0"&gt;
                            &lt;p className="text-xs font-semibold text-muted-foreground px-2 py-1"&gt;Presets&lt;/p&gt;
                            {presetRanges.map((preset) => (
                                &lt;Button
                                    key={preset.label}
                                    variant="ghost"
                                    size="sm"
                                    className="justify-start text-sm font-normal h-8"
                                    onClick={() => setPresetDateRange(preset.range)}
                                &gt;
                                    {preset.label}
                                &lt;/Button&gt;
                            ))}
                            &lt;Separator className="my-1" /&gt;
                            &lt;Button
                                variant="ghost"
                                size="sm"
                                className="justify-start text-sm font-normal h-8 text-muted-foreground"
                                onClick={() => setPresetDateRange(undefined)} // Allow clearing the range
                            &gt;
                                Clear
                            &lt;/Button&gt;
                        &lt;/div&gt;
                        &lt;Calendar
                           initialFocus
                           mode="range"
                           defaultMonth={filterDateRange?.from}
                           selected={filterDateRange}
                           onSelect={setPresetDateRange} // Use the same handler
                           numberOfMonths={1}
                           disabled={(date) => date &gt; new Date() || date &lt; new Date("2023-01-01")}
                         /&gt;
                    &lt;/PopoverContent&gt;
                 &lt;/Popover&gt;
                  {filterDateRange && (
                    &lt;Button variant="link" size="sm" onClick={() => setFilterDateRange(undefined)} className="p-0 h-auto text-muted-foreground hover:text-foreground"&gt;
                        &lt;X className="mr-1 h-3 w-3" /&gt; Reset Range
                    &lt;/Button&gt;
                  )}
            &lt;/CardContent&gt;
        &lt;/Card&gt;

       {&/* Summary Stats */}
        &lt;Card&gt;
            &lt;CardHeader&gt;
                &lt;CardTitle className="text-lg font-semibold flex items-center gap-2"&gt;
                    &lt;TrendingUp className="h-5 w-5" /&gt; Summary Statistics
                &lt;/CardTitle&gt;
                 &lt;CardDescription&gt;
                     Overview for the selected period ({filterDateRange?.from ? format(filterDateRange.from, 'MMM d, y') : 'Start'} - {filterDateRange?.to ? format(filterDateRange.to, 'MMM d, y') : 'End'}).
                 &lt;/CardDescription&gt;
            &lt;/CardHeader&gt;
            &lt;CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center"&gt;
                &lt;div className="bg-muted/50 p-4 rounded-lg"&gt;
                    &lt;p className="text-sm font-medium text-muted-foreground"&gt;Total Documents&lt;/p&gt;
                    &lt;p className="text-2xl font-bold"&gt;{summaryStats.totalDocs}&lt;/p&gt;
                &lt;/div&gt;
                 &lt;div className="bg-muted/50 p-4 rounded-lg"&gt;
                    &lt;p className="text-sm font-medium text-muted-foreground"&gt;Total Videos&lt;/p&gt;
                    &lt;p className="text-2xl font-bold"&gt;{summaryStats.totalVideos}&lt;/p&gt;
                &lt;/div&gt;
                 &lt;div className="bg-muted/50 p-4 rounded-lg"&gt;
                    &lt;p className="text-sm font-medium text-muted-foreground"&gt;Average Daily UPH&lt;/p&gt;
                    &lt;p className="text-2xl font-bold"&gt;{summaryStats.avgUPH &gt; 0 ? summaryStats.avgUPH : '-'}&lt;/p&gt;
                &lt;/div&gt;
                 &lt;div className="bg-muted/50 p-4 rounded-lg"&gt;
                    &lt;p className="text-sm font-medium text-muted-foreground"&gt;Days Logged&lt;/p&gt;
                    &lt;p className="text-2xl font-bold"&gt;{summaryStats.daysLogged}&lt;/p&gt;
                &lt;/div&gt;
            &lt;/CardContent&gt;
        &lt;/Card&gt;

      {&/* Chart Section */}
      &lt;div className="grid grid-cols-1 lg:grid-cols-2 gap-8"&gt;
        {&/* Daily Counts Chart */}
        &lt;Card&gt;
          &lt;CardHeader&gt;
            &lt;CardTitle&gt;Daily Completed Items&lt;/CardTitle&gt;
             &lt;CardDescription&gt;Documents and Video Sessions completed per day.&lt;/CardDescription&gt;
          &lt;/CardHeader&gt;
          &lt;CardContent&gt;
            {dailyWorkChartData.length &gt; 0 ? (
              &lt;ChartContainer config={dailyCountsChartConfig} className="h-[300px] w-full"&gt;
                &lt;LineChart
                  data={dailyWorkChartData}
                  margin={{ top: 5, right: 20, left: -10, bottom: 5 }} // Adjust margins
                &gt;
                  &lt;CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))"/&gt;
                  &lt;XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    // interval="preserveStartEnd" // Show more labels potentially
                    // angle={-30} // Angle labels if too crowded
                    // textAnchor="end"
                  /&gt;
                  &lt;YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                     tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  /&gt;
                   &lt;ChartTooltip
                     cursor={false}
                     content=&lt;ChartTooltipContent hideLabel indicator="line" /&gt;
                   /&gt;
                  &lt;Line type="monotone" dataKey="documents" stroke={CHART_COLORS.documents} strokeWidth={2} dot={false} name="Documents" /&gt;
                  &lt;Line type="monotone" dataKey="videos" stroke={CHART_COLORS.videos} strokeWidth={2} dot={false} name="Videos" /&gt;
                   &lt;ChartLegend content=&lt;ChartLegendContent /&gt; /&gt;
                &lt;/LineChart&gt;
              &lt;/ChartContainer&gt;
            ) : (
                 &lt;div className="h-[300px] flex items-center justify-center"&gt;
                    &lt;p className="text-muted-foreground"&gt;No data available for the selected range.&lt;/p&gt;
                 &lt;/div&gt;
            )}
          &lt;/CardContent&gt;
        &lt;/Card&gt;

        {&/* Daily UPH Chart */}
        &lt;Card&gt;
          &lt;CardHeader&gt;
            &lt;CardTitle&gt;Daily Average UPH&lt;/CardTitle&gt;
            &lt;CardDescription&gt;
                Average Units Per Hour achieved each day compared to the target for that day's log.
                ({activeTarget ? `Using "${activeTarget.name}" as fallback` : 'Requires an active target as fallback'})
            &lt;/CardDescription&gt;
          &lt;/CardHeader&gt;
          &lt;CardContent&gt;
            {dailyWorkChartData.length &gt; 0 ? (
                &lt;ChartContainer config={dailyUPHChartConfig} className="h-[300px] w-full"&gt;
                    &lt;BarChart data={dailyWorkChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}&gt;
                        &lt;CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))"/&gt;
                        &lt;XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        /&gt;
                         &lt;YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            domain={['auto', 'auto']} // Let Y-axis scale automatically
                            allowDecimals={true}
                         /&gt;
                        &lt;ChartTooltip
                           cursor={false}
                           content=&lt;ChartTooltipContent hideLabel /&gt;
                        /&gt;
                         {&/* Target UPH Reference Line */}
                         {&/* We draw a bar for target UPH for comparison - could also use ReferenceLine */}
                         &lt;Bar dataKey="targetUPH" fill={CHART_COLORS.targetUPH} radius={4} name="Target UPH" /&gt;
                        &lt;Bar dataKey="uph" fill={CHART_COLORS.uph} radius={4} name="Actual UPH"/&gt;
                       &lt;ChartLegend content=&lt;ChartLegendContent /&gt; /&gt;
                    &lt;/BarChart&gt;
                &lt;/ChartContainer&gt;
            ) : (
                 &lt;div className="h-[300px] flex items-center justify-center"&gt;
                    &lt;p className="text-muted-foreground"&gt;No data available for the selected range.&lt;/p&gt;
                 &lt;/div&gt;
            )}
          &lt;/CardContent&gt;
        &lt;/Card&gt;

        {&/* Hourly Activity Chart */}
        &lt;Card className="lg:col-span-2"&gt; {&/* Span 2 columns on large screens */}
          &lt;CardHeader&gt;
            &lt;CardTitle className="flex items-center gap-2"&gt;
                &lt;Clock className="h-5 w-5" /&gt; Hourly Activity
            &lt;/CardTitle&gt;
            &lt;CardDescription&gt;
              Number of logged activities (log creation/updates) per hour for the selected day.
              {selectedDateForHourlyChart ? ` (${format(selectedDateForHourlyChart, 'MMM d, yyyy')})` : ''}
            &lt;/CardDescription&gt;
          &lt;/CardHeader&gt;
          &lt;CardContent&gt;
            {selectedDateForHourlyChart ? (
              hourlyActivityChartData.length &gt; 0 ? (
                &lt;ChartContainer config={hourlyActivityChartConfig} className="h-[300px] w-full"&gt;
                  &lt;BarChart data={hourlyActivityChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}&gt;
                    &lt;CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /&gt;
                    &lt;XAxis
                      dataKey="hourLabel"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      angle={-45} // Angle labels for better fit
                      textAnchor="end"
                      interval={1} // Show every other label
                    /&gt;
                    &lt;YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      allowDecimals={false} // Counts are integers
                    /&gt;
                    &lt;ChartTooltip
                      cursor={false}
                      content=&lt;ChartTooltipContent hideLabel /&gt;
                    /&gt;
                    &lt;Bar dataKey="count" fill={CHART_COLORS.hourlyActivity} radius={4} name="Activities" /&gt;
                    {&/* No legend needed for single series */}
                  &lt;/BarChart&gt;
                &lt;/ChartContainer&gt;
              ) : (
                &lt;div className="h-[300px] flex items-center justify-center"&gt;
                  &lt;p className="text-muted-foreground"&gt;No logged activity found for {format(selectedDateForHourlyChart, 'MMM d, yyyy')}.&lt;/p&gt;
                &lt;/div&gt;
              )
            ) : (
              &lt;div className="h-[300px] flex items-center justify-center"&gt;
                &lt;p className="text-muted-foreground"&gt;Please select a single day in the date range filter to view hourly activity.&lt;/p&gt;
              &lt;/div&gt;
            )}
          &lt;/CardContent&gt;
        &lt;/Card&gt;


      &lt;/div&gt;
    &lt;/div&gt;
  );
}
