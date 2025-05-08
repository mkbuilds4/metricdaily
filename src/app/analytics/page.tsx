
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getWorkLogs, getUPHTargets, getActiveUPHTarget, getAuditLogs } from '@/lib/actions';
import type { DailyWorkLog, UPHTarget, AuditLogEntry } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, LabelList, ReferenceLine } from 'recharts'; // Added ReferenceLine
import { format, parseISO, isValid, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, subWeeks, getHours, isSameDay, parse, setHours, setMinutes, setSeconds, isAfter, addDays, addHours } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Filter, X, Activity, TrendingUp, Clock, BookOpen, Video } from 'lucide-react';
import { cn, calculateDailyUPH, formatDurationFromMinutes } from '@/lib/utils'; // Import formatDurationFromMinutes
import { Separator } from '@/components/ui/separator';

// Define chart colors using HSL variables from globals.css
const CHART_COLORS = {
  documents: 'hsl(var(--chart-1))',
  videos: 'hsl(var(--chart-2))',
  uph: 'hsl(var(--chart-3))',
  targetUPHLine: 'hsl(var(--destructive))', // Color for the target UPH line
  hoursWorked: 'hsl(var(--chart-5))', // Added color for hours worked
  // Colors for the hourly chart - using documents/videos colors again
  hourlyDocuments: 'hsl(var(--chart-1))',
  hourlyVideos: 'hsl(var(--chart-2))',
};

export default function AnalyticsPage() {
  const [workLogs, setWorkLogs] = useState<DailyWorkLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [targets, setTargets] = useState<UPHTarget[]>([]);
  const [activeTarget, setActiveTarget] = useState<UPHTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterDateRange, setFilterDateRange] = useState<DateRange | undefined>(() => {
    // Default to Today
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    return { from: todayStart, to: todayEnd };
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const loadData = useCallback(() => {
    if (typeof window === 'undefined') return;
    setIsLoading(true);
    try {
      const loadedLogs = getWorkLogs();
      const loadedAuditLogs = getAuditLogs();
      const loadedTargets = getUPHTargets();
      const loadedActiveTarget = getActiveUPHTarget();

      setWorkLogs(loadedLogs);
      setAuditLogs(loadedAuditLogs); // Now uses auditLogs
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

  // Determine if the selected range is a single day
   const isSingleDaySelected = useMemo(() => {
        return !!(filterDateRange?.from && filterDateRange?.to && isSameDay(filterDateRange.from, filterDateRange.to));
   }, [filterDateRange]);

  // Determine selected date for hourly chart
  const selectedDateForHourlyChart = useMemo(() => {
     if (isSingleDaySelected) {
      return filterDateRange!.from!; // Use the date if the range is a single day
    }
     if (filterDateRange?.from && !filterDateRange?.to) {
        return filterDateRange.from; // Use 'from' date if only 'from' is selected
    }
    return null; // No single date selected or range spans multiple days
  }, [filterDateRange, isSingleDaySelected]);

   // Find the work log for the selected date
  const selectedDayLog = useMemo(() => {
    if (!selectedDateForHourlyChart) return null;
    const selectedDateStr = format(selectedDateForHourlyChart, 'yyyy-MM-dd');
    // Find the log for the selected date (consider finalized or not)
    return workLogs.find(log => log.date === selectedDateStr);
  }, [workLogs, selectedDateForHourlyChart]);


  // Prepare data for daily trend charts
  const dailyWorkChartData = useMemo(() => {
    const sortedLogs = [...filteredLogs].sort((a, b) => a.date.localeCompare(b.date));

    return sortedLogs.map(log => {
      const logDate = parseISO(log.date);
      // Use the target associated with the log, fallback to active target for calculation
      const targetForLog = targets.find(t => t.id === log.targetId) ?? activeTarget;
      const uph = targetForLog ? calculateDailyUPH(log, targetForLog) : null;

      return {
        date: format(logDate, 'MMM d'),
        fullDate: log.date,
        documents: log.documentsCompleted,
        videos: log.videoSessionsCompleted,
        hoursWorked: log.hoursWorked, // Keep hoursWorked here
        uph: uph !== null && isFinite(uph) ? uph : 0,
        // Removed targetUPH as it's no longer displayed on the UPH chart
      };
    });
  }, [filteredLogs, targets, activeTarget]);

  // Prepare data for hourly completions chart (based on audit log)
  const hourlyActivityChartData = useMemo(() => {
     if (!selectedDateForHourlyChart || !selectedDayLog || !auditLogs || auditLogs.length === 0) {
       return []; // Cannot calculate if no log, no date, or no audit logs
     }

     const selectedDateStr = format(selectedDateForHourlyChart, 'yyyy-MM-dd');
     const startOfSelectedDay = startOfDay(selectedDateForHourlyChart);
     const endOfSelectedDay = endOfDay(selectedDateForHourlyChart);

     // 1. Filter relevant WorkLog audit logs for the selected day
     const relevantAuditLogs = auditLogs
       .filter(log => {
         if (log.entityType !== 'WorkLog') return false;
         if (log.entityId !== selectedDayLog.id) return false; // Filter by the specific log ID for the day
         const logTimestamp = parseISO(log.timestamp);
         return isValid(logTimestamp) && logTimestamp >= startOfSelectedDay && logTimestamp <= endOfSelectedDay;
       })
       .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()); // Sort chronologically

      if (relevantAuditLogs.length === 0) {
          console.log(`[AnalyticsPage] No relevant audit logs found for ${selectedDateStr}`);
          return [];
      }

     // 2. Track hourly states based on newState in audit logs
     const hourlyStates: Record<number, { documents: number; videos: number; timestamp: string }> = {};
     for (const auditEntry of relevantAuditLogs) {
         if (auditEntry.newState && typeof auditEntry.newState === 'object') {
             const newState = auditEntry.newState as Partial<DailyWorkLog>;
             // Check if newState contains count information (for QUICK_COUNT or regular UPDATE)
             if (newState.documentsCompleted !== undefined || newState.videoSessionsCompleted !== undefined) {
                 const timestamp = parseISO(auditEntry.timestamp);
                 if (isValid(timestamp)) {
                     const hour = getHours(timestamp);
                     // Update the state for this hour with the latest known counts from this log entry
                     // Ensure we handle potential null/undefined from newState
                     hourlyStates[hour] = {
                         documents: newState.documentsCompleted ?? hourlyStates[hour]?.documents ?? 0,
                         videos: newState.videoSessionsCompleted ?? hourlyStates[hour]?.videos ?? 0,
                         timestamp: auditEntry.timestamp,
                     };
                 }
             }
         }
     }


     // 3. Calculate hourly deltas
     const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
     const startMatch = selectedDayLog.startTime.match(timeRegex);
     const endMatch = selectedDayLog.endTime.match(timeRegex);

     if (!startMatch || !endMatch) {
       console.warn('Invalid start or end time format in log for hourly chart:', selectedDayLog);
       return [];
     }

     const startHour = parseInt(startMatch[1], 10);
     const endHour = parseInt(endMatch[1], 10);

     const hourlyDeltas: Record<number, { documents: number; videos: number }> = {};
     let lastKnownCounts = { documents: 0, videos: 0 };

     // Find initial state from the first relevant log if available
       const firstLogState = relevantAuditLogs[0]?.previousState as Partial<DailyWorkLog> ?? relevantAuditLogs[0]?.newState as Partial<DailyWorkLog>;
       if (firstLogState) {
           lastKnownCounts = {
               documents: firstLogState.documentsCompleted ?? 0,
               videos: firstLogState.videoSessionsCompleted ?? 0,
           };
            // Assign initial counts to the start hour if they occurred before or during the start hour
            const firstLogTimestamp = parseISO(relevantAuditLogs[0].timestamp);
            if (isValid(firstLogTimestamp) && getHours(firstLogTimestamp) <= startHour) {
                // Use the state recorded for the start hour if available, else use the derived lastKnownCounts
                const initialHourState = hourlyStates[startHour] ?? lastKnownCounts;
                 hourlyDeltas[startHour] = {
                    documents: Math.max(0, initialHourState.documents - 0), // Delta from 0
                    videos: Math.max(0, initialHourState.videos - 0),     // Delta from 0
                };
                lastKnownCounts = initialHourState; // Update last known counts based on the state used
            }
       }


     // Iterate through hours of the shift
     for (let hour = startHour; hour <= endHour; hour++) {
        // Skip initializing if already done for the start hour
        if (hour === startHour && hourlyDeltas[startHour]) {
             continue;
        }

       const currentHourState = hourlyStates[hour];
       // If no update occurred in this hour, the counts remain the same as the last known counts
       const currentHourCounts = currentHourState
         ? { documents: currentHourState.documents, videos: currentHourState.videos }
         : lastKnownCounts;

       // Calculate the difference from the last known state
       const deltaDocs = Math.max(0, currentHourCounts.documents - lastKnownCounts.documents);
       const deltaVideos = Math.max(0, currentHourCounts.videos - lastKnownCounts.videos);

       hourlyDeltas[hour] = { documents: deltaDocs, videos: deltaVideos };

       // Update last known counts for the next iteration
       lastKnownCounts = currentHourCounts;
     }

     // 4. Format for Chart
     return Object.entries(hourlyDeltas)
       .map(([hour, counts]) => ({
         hour: parseInt(hour, 10),
         hourLabel: `${String(hour).padStart(2, '0')}:00`,
         documents: counts.documents,
         videos: counts.videos,
       }))
       .sort((a, b) => a.hour - b.hour)
       .filter(item => item.documents > 0 || item.videos > 0); // Optionally filter out hours with zero activity


   }, [selectedDayLog, selectedDateForHourlyChart, auditLogs]);


  // Chart Configurations
  const dailyCountsChartConfig = {
    documents: { label: "Documents", color: CHART_COLORS.documents },
    videos: { label: "Videos", color: CHART_COLORS.videos },
    hoursWorked: { label: "Hours Worked", color: CHART_COLORS.hoursWorked }, // Updated config for hours line
  };


  const dailyUPHChartConfig = {
     uph: { label: "Actual UPH", color: CHART_COLORS.uph },
     targetUPHLine: { label: "Target UPH", color: CHART_COLORS.targetUPHLine }, // Add config for the line
  };

   // Updated config for hourly chart legend labels
   const hourlyActivityChartConfig = {
     documents: { label: "Docs", color: CHART_COLORS.hourlyDocuments }, // Changed label
     videos: { label: "Videos", color: CHART_COLORS.hourlyVideos }, // Changed label
   };

  // Preset Date Range Handlers
  const setPresetDateRange = (range: DateRange | undefined) => {
      setFilterDateRange(range);
      setDatePickerOpen(false); // Close popover after selection
  };

  const today = new Date();
  const presetRanges = [
    { label: "Today", range: { from: startOfDay(today), to: endOfDay(today) } },
    { label: "Yesterday", range: { from: startOfDay(subDays(today, 1)), to: endOfDay(subDays(today, 1)) } },
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
    const validUphEntries = dailyWorkChartData.filter(d => d.uph > 0);
    const avgUPH = validUphEntries.length > 0
        ? validUphEntries.reduce((sum, d) => sum + d.uph, 0) / validUphEntries.length
        : 0;
    const daysLogged = dailyWorkChartData.length;
    return {
      totalDocs,
      totalVideos,
      avgUPH: parseFloat(avgUPH.toFixed(2)),
      daysLogged
    };
   }, [dailyWorkChartData]);

   // --- Define Chart Components ---

   const HourlyCompletionsChart = () => (
        <Card className="lg:col-span-2"> {/* Span 2 columns on large screens */}
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" /> Hourly Completions (from Audit Log)
            </CardTitle>
            <CardDescription>
              Actual documents <BookOpen className="inline h-4 w-4" /> and videos <Video className="inline h-4 w-4" /> completed per hour, based on logged updates in the audit trail.
              {selectedDateForHourlyChart ? ` (${format(selectedDateForHourlyChart, 'MMM d, yyyy')})` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Show only if date is selected */}
            {selectedDateForHourlyChart ? (
              hourlyActivityChartData.length > 0 ? (
                <ChartContainer config={hourlyActivityChartConfig} className="h-[300px] w-full">
                  {/* Use stacked BarChart */}
                  <BarChart data={hourlyActivityChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="hourLabel"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      angle={hourlyActivityChartData.length > 10 ? -45 : 0}
                      textAnchor={hourlyActivityChartData.length > 10 ? "end" : "middle"}
                      interval={hourlyActivityChartData.length > 14 ? 1 : 0}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      allowDecimals={false} // Show whole numbers for actual counts
                    />
                     {/* Disable default tooltip content */}
                     <ChartTooltip
                       cursor={false}
                       content={<></>} // Use empty fragment to disable content
                     />
                     {/* Define Bars for documents and videos */}
                     <Bar dataKey="documents" stackId="a" fill={CHART_COLORS.hourlyDocuments} radius={[0, 0, 0, 0]} name="Docs">
                       {/* Add LabelList for documents */}
                       <LabelList
                         dataKey="documents"
                         position="center"
                         fill="hsl(var(--primary-foreground))" // Use a contrasting color
                         fontSize={10}
                         formatter={(value: number) => (value > 0 ? value : '')} // Hide label if value is 0
                       />
                     </Bar>
                     <Bar dataKey="videos" stackId="a" fill={CHART_COLORS.hourlyVideos} radius={[4, 4, 0, 0]} name="Videos"> {/* Top bar gets radius */}
                       {/* Add LabelList for videos */}
                       <LabelList
                         dataKey="videos"
                         position="center"
                         fill="hsl(var(--primary-foreground))" // Use a contrasting color
                         fontSize={10}
                         formatter={(value: number) => (value > 0 ? value : '')} // Hide label if value is 0
                       />
                     </Bar>
                    <ChartLegend content={<ChartLegendContent />} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground">No completion updates found in audit log for {format(selectedDateForHourlyChart, 'MMM d, yyyy')}.</p>
                </div>
              )
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">Please select a single day in the date range filter to view hourly completions.</p>
              </div>
            )}
          </CardContent>
        </Card>
   );

    const DailyCountsChart = () => (
        <Card>
          <CardHeader>
            <CardTitle>Daily Completed Items &amp; Hours</CardTitle>
             <CardDescription>Documents, Videos, and Hours Worked per day.</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyWorkChartData.length > 0 ? (
              <ChartContainer config={dailyCountsChartConfig} className="h-[300px] w-full">
                <LineChart
                  data={dailyWorkChartData}
                  margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))"/>
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  {/* Left Y-axis for Counts */}
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                     tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                     domain={['auto', 'auto']}
                     allowDecimals={false}
                  />
                   {/* Right Y-axis for Hours */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    domain={['auto', 'auto']}
                    allowDecimals={true}
                    tickFormatter={(value) => value.toFixed(1)} // Format hours tick
                  />
                   <ChartTooltip
                     cursor={false}
                     content={
                       <ChartTooltipContent
                         indicator="line"
                         labelFormatter={(label, payload) => {
                           // Display only the date label once
                           return payload?.[0]?.payload?.fullDate ? format(parseISO(payload[0].payload.fullDate), 'PPP') : label;
                         }}
                         formatter={(value, name, props) => {
                           // Custom formatter to display value with correct label
                           let label = '';
                           let color = '';
                           if (name === 'documents') {
                             label = 'Docs:';
                             color = CHART_COLORS.documents;
                           } else if (name === 'videos') {
                             label = 'Videos:';
                             color = CHART_COLORS.videos;
                           } else if (name === 'hoursWorked') {
                             label = 'Hours:';
                             color = CHART_COLORS.hoursWorked;
                             // Format hours to 2 decimal places
                             value = typeof value === 'number' ? value.toFixed(2) : value;
                           }
                           return (
                             <div className="flex items-center gap-2">
                               <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                               <div className="flex flex-1 justify-between">
                                 <span className="text-muted-foreground">{label}</span>
                                 <span className="font-medium">{value}</span>
                               </div>
                             </div>
                           );
                         }}
                       />
                     }
                   />
                  <Line yAxisId="left" type="monotone" dataKey="documents" stroke={CHART_COLORS.documents} strokeWidth={2} dot={false} name="documents" />
                  <Line yAxisId="left" type="monotone" dataKey="videos" stroke={CHART_COLORS.videos} strokeWidth={2} dot={false} name="videos" />
                  {/* Hours Worked Line associated with the right axis */}
                   <Line yAxisId="right" type="monotone" dataKey="hoursWorked" stroke={CHART_COLORS.hoursWorked} strokeWidth={2} strokeDasharray="5 5" dot={false} name="hoursWorked" />
                   <ChartLegend content={<ChartLegendContent />} />
                </LineChart>
              </ChartContainer>
            ) : (
                 <div className="h-[300px] flex items-center justify-center">
                    <p className="text-muted-foreground">No data available for the selected range.</p>
                 </div>
            )}
          </CardContent>
        </Card>
    );

    const DailyUPHChart = () => {
        // Determine Y-axis domain to ensure ReferenceLine is visible
        const maxUph = Math.max(...dailyWorkChartData.map(d => d.uph), activeTarget?.targetUPH ?? 0);
        const yAxisDomain: [number | string, number | string] = [0, Math.ceil((maxUph + 5) / 5) * 5]; // Auto scale with buffer

        return (
         <Card>
          <CardHeader>
            <CardTitle>Daily Average UPH</CardTitle>
            <CardDescription>
                Average Units Per Hour achieved each day (vs Active Target: {activeTarget?.name ?? 'None'}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dailyWorkChartData.length > 0 ? (
                <ChartContainer config={dailyUPHChartConfig} className="h-[300px] w-full">
                    <BarChart data={dailyWorkChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))"/>
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        />
                         <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            domain={yAxisDomain} // Apply dynamic domain
                            allowDecimals={true}
                         />
                        <ChartTooltip
                           cursor={false}
                           content={<ChartTooltipContent hideLabel />}
                        />
                        {/* Actual UPH Bar */}
                        <Bar dataKey="uph" fill={CHART_COLORS.uph} radius={4} name="Actual UPH"/>

                        {/* Add Reference Line for Active Target UPH */}
                        {activeTarget && activeTarget.targetUPH > 0 && (
                             <ReferenceLine
                                y={activeTarget.targetUPH}
                                stroke={CHART_COLORS.targetUPHLine}
                                strokeDasharray="3 3"
                                strokeWidth={1.5}
                             >
                                {/* Optional: Add a label to the line */}
                                 <Label
                                    value={`Target: ${activeTarget.targetUPH.toFixed(1)}`}
                                    position="insideTopLeft" // Adjust position as needed
                                    fill={CHART_COLORS.targetUPHLine}
                                    fontSize={10}
                                    dy={-5} // Offset label slightly above the line
                                 />
                             </ReferenceLine>
                        )}

                       <ChartLegend content={<ChartLegendContent />} />
                    </BarChart>
                </ChartContainer>
            ) : (
                 <div className="h-[300px] flex items-center justify-center">
                    <p className="text-muted-foreground">No data available for the selected range.</p>
                 </div>
            )}
          </CardContent>
        </Card>
        );
    };

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading analytics...</div>;
  }

  // This is the beginning of the main return statement for the component's JSX
  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Productivity Analytics</h1>

        {/* Filter Controls */}
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Filter className="h-5 w-5" /> Filter Data Range
                </CardTitle>
                <CardDescription>Select the time period for the analytics. Hourly completion chart requires a single day selection.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                   <PopoverTrigger asChild>
                     <Button
                       id="date"
                       variant={"outline"}
                       className={cn(
                         "w-full sm:w-[300px] justify-start text-left font-normal h-9 text-sm",
                         !filterDateRange && "text-muted-foreground"
                       )}
                     >
                       <CalendarIcon className="mr-2 h-4 w-4" />
                       {filterDateRange?.from ? (
                         filterDateRange.to ? (
                            isSameDay(filterDateRange.from, filterDateRange.to)
                             ? format(filterDateRange.from, "LLL dd, y")
                             : <>
                                 {format(filterDateRange.from, "LLL dd, y")} -{" "}
                                 {format(filterDateRange.to, "LLL dd, y")}
                               </>
                         ) : (
                           format(filterDateRange.from, "LLL dd, y")
                         )
                       ) : (
                         <span>Select Date Range</span>
                       )}
                     </Button>
                   </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 flex flex-col sm:flex-row" align="start">
                         <div className="flex flex-col p-2 border-b sm:border-r sm:border-b-0">
                            <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Presets</p>
                            {presetRanges.map((preset) => (
                                <Button
                                    key={preset.label}
                                    variant="ghost"
                                    size="sm"
                                    className="justify-start text-sm font-normal h-8"
                                    onClick={() => setPresetDateRange(preset.range)}
                                >
                                    {preset.label}
                                </Button>
                            ))}
                            <Separator className="my-1" />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="justify-start text-sm font-normal h-8 text-muted-foreground"
                                onClick={() => setPresetDateRange(undefined)} // Allow clearing the range
                            >
                                Clear
                            </Button>
                        </div>
                        <Calendar
                           initialFocus
                           mode="range"
                           defaultMonth={filterDateRange?.from}
                           selected={filterDateRange}
                           onSelect={setPresetDateRange} // Use the same handler
                           numberOfMonths={1}
                           disabled={(date) => date > new Date() || date < new Date("2023-01-01")}
                         />
                    </PopoverContent>
                 </Popover>
                  {filterDateRange && (
                    <Button variant="link" size="sm" onClick={() => setFilterDateRange(undefined)} className="p-0 h-auto text-muted-foreground hover:text-foreground">
                        <X className="mr-1 h-3 w-3" /> Reset Range
                    </Button>
                  )}
            </CardContent>
        </Card>

       {/* Summary Stats */}
        <Card>
            <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" /> Summary Statistics
                </CardTitle>
                 <CardDescription>
                     Overview for the selected period ({filterDateRange?.from ? format(filterDateRange.from, 'MMM d, y') : 'Start'} - {filterDateRange?.to ? format(filterDateRange.to, 'MMM d, y') : 'End'}).
                 </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Total Documents</p>
                    <p className="text-2xl font-bold">{summaryStats.totalDocs}</p>
                </div>
                 <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Total Videos</p>
                    <p className="text-2xl font-bold">{summaryStats.totalVideos}</p>
                </div>
                 <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Average Daily UPH</p>
                    <p className="text-2xl font-bold">{summaryStats.avgUPH > 0 ? summaryStats.avgUPH : '-'}</p>
                </div>
                 <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Days Logged</p>
                    <p className="text-2xl font-bold">{summaryStats.daysLogged}</p>
                </div>
            </CardContent>
        </Card>

      {/* Chart Section - Conditionally Rendered Order */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {isSingleDaySelected ? (
          <>
            <HourlyCompletionsChart />
            <DailyCountsChart />
            <DailyUPHChart />
          </>
        ) : (
          <>
            <DailyCountsChart />
            <DailyUPHChart />
            <HourlyCompletionsChart />
          </>
        )}
      </div>
    </div>
  );
}

    