
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getWorkLogs, getUPHTargets, getActiveUPHTarget, getAuditLogs } from '@/lib/actions';
import type { DailyWorkLog, UPHTarget, AuditLogEntry } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, LabelList, ReferenceLine } from 'recharts';
import { format, parseISO, isValid, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, subWeeks, getHours, isSameDay, parse, setHours, setMinutes, setSeconds, isAfter, addDays, addHours, getDayOfYear, getYear } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Filter, X, Activity, TrendingUp, Clock, BookOpen, Video, Target as TargetIcon } from 'lucide-react';
import { cn, calculateDailyUPH, formatDurationFromMinutes } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Label as RechartsLabel } from 'recharts';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';


// Define chart colors using HSL variables from globals.css
const CHART_COLORS = {
  documents: 'hsl(var(--chart-1))',
  videos: 'hsl(var(--chart-2))',
  uph: 'hsl(var(--chart-3))',
  targetUPHLine: 'hsl(var(--destructive))',
  hoursWorked: 'hsl(var(--chart-5))',
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
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    return { from: todayStart, to: todayEnd };
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedTargetIdForUPHChart, setSelectedTargetIdForUPHChart] = useState<string | undefined>(undefined);


  const loadData = useCallback(() => {
    if (typeof window === 'undefined') return;
    setIsLoading(true);
    try {
      const loadedLogs = getWorkLogs();
      const loadedAuditLogs = getAuditLogs();
      const loadedTargets = getUPHTargets();
      const loadedActiveTarget = getActiveUPHTarget();

      setWorkLogs(loadedLogs);
      setAuditLogs(loadedAuditLogs);
      setTargets(loadedTargets);
      setActiveTarget(loadedActiveTarget);
      console.log('[AnalyticsPage] Data loaded:', { logs: loadedLogs.length, auditLogs: loadedAuditLogs.length, targets: loadedTargets.length });
    } catch (error) {
      console.error('[AnalyticsPage] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      loadData();
    }
  }, [loadData]);

  // Initialize selectedTargetIdForUPHChart when targets or activeTarget change
  useEffect(() => {
    if (targets.length > 0) {
      const activeAndDisplayed = activeTarget && targets.find(t => t.id === activeTarget.id && (t.isDisplayed ?? true));
      if (activeAndDisplayed) {
        setSelectedTargetIdForUPHChart(activeAndDisplayed.id);
      } else {
        const firstDisplayed = targets.find(t => t.isDisplayed ?? true);
        if (firstDisplayed) {
          setSelectedTargetIdForUPHChart(firstDisplayed.id);
        } else if (targets.length > 0) {
            setSelectedTargetIdForUPHChart(targets[0].id);
        } else {
            setSelectedTargetIdForUPHChart(undefined);
        }
      }
    } else {
      setSelectedTargetIdForUPHChart(undefined);
    }
  }, [targets, activeTarget]);


  const filteredLogs = useMemo(() => {
    return workLogs.filter(log => {
      const logDate = parseISO(log.date + 'T00:00:00');
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

   const isSingleDaySelected = useMemo(() => {
        return !!(filterDateRange?.from && filterDateRange?.to && isSameDay(filterDateRange.from, filterDateRange.to));
   }, [filterDateRange]);

  const selectedDateForHourlyChart = useMemo(() => {
     if (isSingleDaySelected) {
      return filterDateRange!.from!;
    }
     if (filterDateRange?.from && !filterDateRange?.to) {
        return filterDateRange.from;
    }
    return null;
  }, [filterDateRange, isSingleDaySelected]);

  const dailyWorkChartData = useMemo(() => {
    const sortedLogs = [...filteredLogs].sort((a, b) => a.date.localeCompare(b.date));

    return sortedLogs.map(log => {
      const logDate = parseISO(log.date);
      const targetForLog = targets.find(t => t.id === log.targetId) ?? activeTarget;
      const uph = targetForLog ? calculateDailyUPH(log, targetForLog) : null;

      return {
        date: format(logDate, 'MMM d'),
        fullDate: log.date,
        documents: log.documentsCompleted,
        videos: log.videoSessionsCompleted,
        hoursWorked: log.hoursWorked,
        uph: uph !== null && isFinite(uph) ? uph : 0,
      };
    });
  }, [filteredLogs, targets, activeTarget]);

  // Data specifically for the Daily Average UPH chart, using the selected target
  const uphChartSpecificData = useMemo(() => {
    const selectedTargetDetails = targets.find(t => t.id === selectedTargetIdForUPHChart);
    if (!selectedTargetDetails) return [];

    const sortedLogs = [...filteredLogs].sort((a, b) => a.date.localeCompare(b.date));

    return sortedLogs.map(log => {
      const logDate = parseISO(log.date);
      const uph = calculateDailyUPH(log, selectedTargetDetails); // Use the selected target for this chart

      return {
        date: format(logDate, 'MMM d'),
        fullDate: log.date,
        uph: uph !== null && isFinite(uph) ? uph : 0,
      };
    });
  }, [filteredLogs, targets, selectedTargetIdForUPHChart]);


  const hourlyActivityChartData = useMemo(() => {
     if (!selectedDateForHourlyChart || !auditLogs || auditLogs.length === 0) {
       return [];
     }
     const startOfSelectedDay = startOfDay(selectedDateForHourlyChart);
     const endOfSelectedDay = endOfDay(selectedDateForHourlyChart);
     const selectedDayIdentifier = `${getYear(selectedDateForHourlyChart)}-${getDayOfYear(selectedDateForHourlyChart)}`;
     const relevantAuditLogs = auditLogs
       .filter(log => {
         if (log.entityType !== 'WorkLog') return false;
         const logTimestamp = parseISO(log.timestamp);
         if (!isValid(logTimestamp)) return false;
         if (!(logTimestamp >= startOfSelectedDay && logTimestamp <= endOfSelectedDay)) {
            return false;
         }
          let logDateFromEntry: string | null = null;
          if (log.newState && typeof log.newState === 'object' && 'date' in log.newState && typeof log.newState.date === 'string') {
             logDateFromEntry = log.newState.date;
          } else if (log.previousState && typeof log.previousState === 'object' && 'date' in log.previousState && typeof log.previousState.date === 'string') {
              logDateFromEntry = log.previousState.date;
          }
           if (logDateFromEntry) {
               const parsedLogDate = parseISO(logDateFromEntry + 'T00:00:00');
               if (isValid(parsedLogDate)) {
                  const logDayIdentifier = `${getYear(parsedLogDate)}-${getDayOfYear(parsedLogDate)}`;
                  if (logDayIdentifier !== selectedDayIdentifier) {
                      return false;
                  }
               }
           }
         return true;
       })
       .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      if (relevantAuditLogs.length === 0) {
          return [];
      }
     const hourlyStates: Record<number, { documents: number; videos: number; timestamp: string }> = {};
     let minHour = 24;
     let maxHour = -1;

     for (const auditEntry of relevantAuditLogs) {
         if (auditEntry.newState && typeof auditEntry.newState === 'object') {
             const newState = auditEntry.newState as Partial<DailyWorkLog>;
             if (newState.documentsCompleted !== undefined || newState.videoSessionsCompleted !== undefined) {
                 const timestamp = parseISO(auditEntry.timestamp);
                 if (isValid(timestamp)) {
                     const hour = getHours(timestamp);
                     minHour = Math.min(minHour, hour);
                     maxHour = Math.max(maxHour, hour);
                     hourlyStates[hour] = {
                         documents: newState.documentsCompleted ?? hourlyStates[hour]?.documents ?? 0,
                         videos: newState.videoSessionsCompleted ?? hourlyStates[hour]?.videos ?? 0,
                         timestamp: auditEntry.timestamp,
                     };
                 }
             }
         }
         else if (auditEntry.previousState && typeof auditEntry.previousState === 'object') {
             const prevState = auditEntry.previousState as Partial<DailyWorkLog>;
             if (prevState.documentsCompleted !== undefined || prevState.videoSessionsCompleted !== undefined) {
                  const timestamp = parseISO(auditEntry.timestamp);
                 if (isValid(timestamp)) {
                     const hour = getHours(timestamp);
                     minHour = Math.min(minHour, hour);
                     maxHour = Math.max(maxHour, hour);
                     if (!hourlyStates[hour]) {
                         hourlyStates[hour] = {
                            documents: prevState.documentsCompleted ?? 0,
                            videos: prevState.videoSessionsCompleted ?? 0,
                            timestamp: auditEntry.timestamp,
                         };
                     }
                 }
             }
         }
     }
     if (minHour > maxHour) {
        return [];
     }
     const hourlyDeltas: Record<number, { documents: number; videos: number }> = {};
     let lastKnownCounts = { documents: 0, videos: 0 };
      const firstRelevantEntry = relevantAuditLogs[0];
      if (firstRelevantEntry?.previousState && typeof firstRelevantEntry.previousState === 'object') {
        const prevState = firstRelevantEntry.previousState as Partial<DailyWorkLog>;
        lastKnownCounts = {
            documents: prevState.documentsCompleted ?? 0,
            videos: prevState.videoSessionsCompleted ?? 0,
        };
      }
     for (let hour = minHour; hour <= maxHour; hour++) {
        const currentHourState = hourlyStates[hour];
        const currentHourCounts = currentHourState
            ? { documents: currentHourState.documents, videos: currentHourState.videos }
            : lastKnownCounts;
        const deltaDocs = Math.max(0, currentHourCounts.documents - lastKnownCounts.documents);
        const deltaVideos = Math.max(0, currentHourCounts.videos - lastKnownCounts.videos);
        hourlyDeltas[hour] = { documents: deltaDocs, videos: deltaVideos };
        if (currentHourState) {
             lastKnownCounts = currentHourCounts;
        }
     }
     return Object.entries(hourlyDeltas)
       .map(([hour, counts]) => ({
         hour: parseInt(hour, 10),
         hourLabel: `${String(hour).padStart(2, '0')}:00`,
         documents: counts.documents,
         videos: counts.videos,
       }))
       .sort((a, b) => a.hour - b.hour);
   }, [selectedDateForHourlyChart, auditLogs]);

  const dailyCountsChartConfig = {
    documents: { label: "Documents", color: CHART_COLORS.documents },
    videos: { label: "Videos", color: CHART_COLORS.videos },
    hoursWorked: { label: "Hours Worked", color: CHART_COLORS.hoursWorked },
  };

  const dailyUPHChartConfig = {
     uph: { label: "Actual UPH", color: CHART_COLORS.uph },
     targetUPHLine: { label: "Target UPH", color: CHART_COLORS.targetUPHLine },
  };

   const hourlyActivityChartConfig = {
     documents: { label: "Docs", color: CHART_COLORS.hourlyDocuments },
     videos: { label: "Videos", color: CHART_COLORS.hourlyVideos },
   };

  const setPresetDateRange = (range: DateRange | undefined) => {
      setFilterDateRange(range);
      setDatePickerOpen(false);
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

   const uphTargetOptionsForChart: ComboboxOption[] = useMemo(() => {
     return targets
       .filter(t => t.isDisplayed ?? true)
       .map(t => ({ value: t.id, label: `${t.name} (Goal: ${t.targetUPH.toFixed(1)})` }));
   }, [targets]);


   const HourlyCompletionsChart = () => (
        <Card className="lg:col-span-2">
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
            {selectedDateForHourlyChart ? (
              hourlyActivityChartData.length > 0 ? (
                <ChartContainer config={hourlyActivityChartConfig} className="h-[300px] w-full">
                  <BarChart data={hourlyActivityChartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }} isAnimationActive={false}>
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
                      allowDecimals={false}
                      label={{
                        value: 'Total Sessions Completed',
                        angle: -90,
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))', fontSize: 12 },
                        dy: 70,
                      }}
                    />
                     <ChartTooltip
                       cursor={false}
                       content={<></>}
                     />
                     <Bar dataKey="documents" stackId="a" fill={CHART_COLORS.hourlyDocuments} radius={[0, 0, 0, 0]} name="Docs" isAnimationActive={false}>
                       <LabelList
                         dataKey="documents"
                         position="middle"
                         fill="hsl(var(--background))"
                         fontSize={10}
                         formatter={(value: number) => (value > 0 ? String(value) : '')}
                       />
                     </Bar>
                     <Bar dataKey="videos" stackId="a" fill={CHART_COLORS.hourlyVideos} radius={[4, 4, 0, 0]} name="Videos" isAnimationActive={false}>
                       <LabelList
                         dataKey="videos"
                         position="middle"
                         fill="hsl(var(--background))"
                         fontSize={10}
                         formatter={(value: number) => (value > 0 ? String(value) : '')}
                       />
                       <LabelList
                         position="top"
                         offset={5}
                         fill="hsl(var(--foreground))"
                         fontSize={10}
                         formatter={(_value, entry: any) => {
                           if (!entry) {
                               return '';
                           }
                           const dataPayload = entry.payload ?? entry;
                           if (!dataPayload || typeof dataPayload.documents === 'undefined' || typeof dataPayload.videos === 'undefined') {
                               return '';
                           }
                           const total = (dataPayload.documents || 0) + (dataPayload.videos || 0);
                           return total > 0 ? String(total) : '';
                         }}
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
                  isAnimationActive={false}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))"/>
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                     tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                     domain={['auto', 'auto']}
                     allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    domain={['auto', 'auto']}
                    allowDecimals={true}
                    tickFormatter={(value) => value.toFixed(1)}
                  />
                   <ChartTooltip
                     cursor={false}
                     content={
                       <ChartTooltipContent
                         indicator="line"
                         labelFormatter={(label, payload) => {
                            if (payload && payload.length > 0 && payload[0].payload?.fullDate) {
                                try {
                                    return format(parseISO(payload[0].payload.fullDate), 'PPP');
                                } catch (e) {
                                    console.warn("Invalid date in tooltip payload:", payload[0].payload.fullDate);
                                    return label;
                                }
                            }
                           return label;
                         }}
                         formatter={(value, name, props) => {
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
                  <Line yAxisId="left" type="monotone" dataKey="documents" stroke={CHART_COLORS.documents} strokeWidth={2} dot={false} name="documents" isAnimationActive={false} />
                  <Line yAxisId="left" type="monotone" dataKey="videos" stroke={CHART_COLORS.videos} strokeWidth={2} dot={false} name="videos" isAnimationActive={false} />
                   <Line yAxisId="right" type="monotone" dataKey="hoursWorked" stroke={CHART_COLORS.hoursWorked} strokeWidth={2} strokeDasharray="5 5" dot={false} name="hoursWorked" isAnimationActive={false} />
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
        const selectedTargetDetails = targets.find(t => t.id === selectedTargetIdForUPHChart);
        const maxUph = Math.max(...uphChartSpecificData.map(d => d.uph), selectedTargetDetails?.targetUPH ?? 0);
        const yAxisDomain: [number | string, number | string] = [0, Math.ceil((maxUph + 5) / 5) * 5];

        return (
         <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                    <CardTitle>Daily Average UPH</CardTitle>
                    <CardDescription>
                        Average Units Per Hour achieved each day.
                        {selectedTargetDetails ? ` (Calculated against: ${selectedTargetDetails.name})` : ' (Select a target)'}
                    </CardDescription>
                </div>
                {uphTargetOptionsForChart.length > 0 && (
                     <Combobox
                        options={uphTargetOptionsForChart}
                        value={selectedTargetIdForUPHChart}
                        onSelect={(value) => setSelectedTargetIdForUPHChart(value)}
                        placeholder="Select Target for UPH Chart"
                        searchPlaceholder='Search targets...'
                        notFoundText='No targets found.'
                        triggerClassName="h-9 text-sm w-full sm:w-[220px]"
                        disabled={isLoading}
                     />
                )}
            </div>
          </CardHeader>
          <CardContent>
            {uphChartSpecificData.length > 0 && selectedTargetDetails ? (
                <ChartContainer config={dailyUPHChartConfig} className="h-[300px] w-full">
                    <BarChart data={uphChartSpecificData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }} isAnimationActive={false}>
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
                            domain={yAxisDomain}
                            allowDecimals={true}
                         />
                        <ChartTooltip
                           cursor={false}
                           content={<ChartTooltipContent hideLabel />}
                        />
                        <Bar dataKey="uph" fill={CHART_COLORS.uph} radius={4} name="Actual UPH" isAnimationActive={false}/>
                        {selectedTargetDetails && selectedTargetDetails.targetUPH > 0 && (
                             <ReferenceLine
                                y={selectedTargetDetails.targetUPH}
                                stroke={CHART_COLORS.targetUPHLine}
                                strokeDasharray="3 3"
                                strokeWidth={1.5}
                                isAnimationActive={false}
                             >
                                 <RechartsLabel
                                    value={`Target: ${selectedTargetDetails.targetUPH.toFixed(1)}`}
                                    position="insideTopLeft"
                                    fill={CHART_COLORS.targetUPHLine}
                                    fontSize={10}
                                    dy={-5}
                                 />
                             </ReferenceLine>
                        )}
                       <ChartLegend content={<ChartLegendContent />} />
                    </BarChart>
                </ChartContainer>
            ) : (
                 <div className="h-[300px] flex items-center justify-center">
                    <p className="text-muted-foreground">
                        {targets.length === 0 ? "No UPH targets defined." :
                         !selectedTargetIdForUPHChart ? "Please select a target to display UPH chart." :
                         "No data available for the selected range."}
                    </p>
                 </div>
            )}
          </CardContent>
        </Card>
        );
    };


  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading analytics...</div>;
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Productivity Analytics</h1>
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
                                onClick={() => setPresetDateRange(undefined)}
                            >
                                Clear
                            </Button>
                        </div>
                        <Calendar
                           initialFocus
                           mode="range"
                           defaultMonth={filterDateRange?.from}
                           selected={filterDateRange}
                           onSelect={setPresetDateRange}
                           numberOfMonths={1}
                           disabled={(date) => date > new Date() || date < new Date("2023-01-01")}
                         />
                    </PopoverContent>
                 </Popover>
                  {filterDateRange && (
                    <Button variant="link" size="sm" onClick={() => setPresetDateRange(undefined)} className="p-0 h-auto text-muted-foreground hover:text-foreground">
                        <X className="mr-1 h-3 w-3" /> Reset Range
                    </Button>
                  )}
            </CardContent>
        </Card>
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
            <HourlyCompletionsChart /> {/* Displayed last if not single day */}
          </>
        )}
      </div>
    </div>
  );
}

    
