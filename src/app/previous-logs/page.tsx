
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TargetMetricsDisplay from '@/components/TargetMetricsDisplay';
import {
  getWorkLogs,
  getUPHTargets,
  deleteWorkLog,
  addAuditLog, // Keep addAuditLog for export action
} from '@/lib/actions';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { formatDateISO, calculateDailyUPH, calculateDailyUnits, cn, formatFriendlyDate } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileSpreadsheet, Filter, X, Calendar as CalendarIcon } from 'lucide-react'; // Removed ArrowUpDown, BookOpen, Clock, Video, TargetIcon
import { format, parseISO, isValid, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, subWeeks, isBefore } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Separator } from '@/components/ui/separator';

// Pagination settings
const ITEMS_PER_PAGE = 10;

// Default sort by date descending (applied in getWorkLogs or initial load)
const DEFAULT_SORT_DIRECTION: 'asc' | 'desc' = 'desc';

export default function PreviousLogsPage() {
  const [allLogs, setAllLogs] = useState<DailyWorkLog[]>([]);
  const [uphTargets, setUphTargets] = useState<UPHTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Filtering State
  const [filterTerm, setFilterTerm] = useState('');
  const [filterDateRange, setFilterDateRange] = useState<DateRange | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Determine active target based on uphTargets state
  const activeTarget = useMemo(() => uphTargets.find(t => t.isActive) || (uphTargets.length > 0 ? uphTargets[0] : null), [uphTargets]);


  // Load data needed for this page
  const loadData = useCallback(() => {
     if (typeof window === 'undefined') return; // Don't run on server
    console.log('[PreviousLogsPage] Loading data...');
    setIsLoading(true);
    try {
      const loadedLogs = getWorkLogs(); // getWorkLogs now returns all logs, sorted by date descending by default
      const loadedTargets = getUPHTargets();
      setAllLogs(loadedLogs); // Store all logs initially
      setUphTargets(loadedTargets);
      console.log('[PreviousLogsPage] Data loaded:', { logs: loadedLogs.length, targets: loadedTargets.length });
    } catch (error) {
      console.error('[PreviousLogsPage] Error loading data:', error);
       toast({
            variant: "destructive",
            title: "Error Loading Data",
            description: "Could not load previous work logs or targets.",
       });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        loadData();
    }
  }, [loadData]);

  const handleDeleteWorkLog = useCallback((id: string) => {
     if (typeof window === 'undefined') return;
    try {
      deleteWorkLog(id);
      loadData(); // Reload all data to reflect the deletion
      toast({ title: "Log Deleted", description: "Previous work log deleted successfully." });
    } catch (error) {
      console.error('[PreviousLogsPage] Error deleting work log:', error);
      toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: error instanceof Error ? error.message : "Could not delete the work log.",
      });
      throw error;
    }
  }, [toast, loadData]);


  // Filtering Logic
  const filteredLogs = useMemo(() => {
    const todayStart = startOfDay(new Date()); // Get start of today

    let logsToFilter = allLogs.filter(log => {
        const logDateObj = parseISO(log.date + 'T00:00:00');
        if (!isValid(logDateObj)) return false;

        const isPreviousDay = isBefore(logDateObj, todayStart);
        const isFinalizedToday = log.date === formatDateISO(new Date()) && log.isFinalized;

        return isPreviousDay || isFinalizedToday;
    });

    if (filterTerm) {
        logsToFilter = logsToFilter.filter(log => {
            const searchTerm = filterTerm.toLowerCase();
            const logTarget = uphTargets.find(t => t.id === log.targetId) ?? activeTarget;
            const logDateObj = parseISO(log.date + 'T00:00:00');

            return (
                log.date.toLowerCase().includes(searchTerm) ||
                log.startTime.toLowerCase().includes(searchTerm) ||
                log.endTime.toLowerCase().includes(searchTerm) ||
                log.hoursWorked.toString().includes(searchTerm) ||
                log.documentsCompleted.toString().includes(searchTerm) ||
                log.videoSessionsCompleted.toString().includes(searchTerm) ||
                (log.notes && log.notes.toLowerCase().includes(searchTerm)) ||
                (isValid(logDateObj) && format(logDateObj, 'PPP').toLowerCase().includes(searchTerm)) ||
                (logTarget && calculateDailyUPH(log, logTarget).toFixed(2).includes(searchTerm))
            );
        });
    }

    if (filterDateRange?.from) {
        logsToFilter = logsToFilter.filter(log => {
            const logDateObj = parseISO(log.date + 'T00:00:00');
            return isValid(logDateObj) && logDateObj >= startOfDay(filterDateRange.from!);
        });
    }
    if (filterDateRange?.to) {
        logsToFilter = logsToFilter.filter(log => {
            const logDateObj = parseISO(log.date + 'T00:00:00');
            return isValid(logDateObj) && logDateObj <= endOfDay(filterDateRange.to!);
        });
    }
    // Logs are already sorted by date descending from getWorkLogs
    return logsToFilter;
  }, [allLogs, filterTerm, filterDateRange, activeTarget, uphTargets]);

  // Pagination Logic - directly uses filteredLogs as sorting is removed
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  const totalPages = useMemo(() => Math.ceil(filteredLogs.length / ITEMS_PER_PAGE), [filteredLogs]);


  // Handlers
  const handleResetFilters = () => {
     setFilterTerm('');
     setFilterDateRange(undefined);
     setCurrentPage(1);
     // No sorting reset needed
  };

  // Check if filters are active
  const hasActiveFilters = filterTerm || filterDateRange;


  // Preset Date Range Handlers
  const setPresetDateRange = (range: DateRange | undefined) => {
      setFilterDateRange(range);
      setCurrentPage(1);
      setDatePickerOpen(false); // Close popover after selection
  };

  const today = new Date(); // Define today here for use in presets
  const presetRanges = [
    { label: "Yesterday", range: { from: startOfDay(subDays(today, 1)), to: endOfDay(subDays(today, 1)) } },
    { label: "This Week", range: { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfDay(today) } }, // End on today for 'This Week'
    { label: "Last Week", range: { from: startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }), to: endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }) } },
    { label: "Last 7 Days", range: { from: startOfDay(subDays(today, 6)), to: endOfDay(today) } },
    { label: "Last 30 Days", range: { from: startOfDay(subDays(today, 29)), to: endOfDay(today) } },
  ];


  // CSV Export
  const escapeCSVField = (field: any): string => {
    if (field === null || field === undefined) return '';
    let stringField = String(field);
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
      stringField = stringField.replace(/"/g, '""');
      return `"${stringField}"`;
    }
    return stringField;
  };

  const generateCSVContent = useCallback((logs: DailyWorkLog[], targets: UPHTarget[]): string => {
    const headers = [
      'Date', 'Start Time', 'End Time', 'Break Duration (min)', 'Training Duration (min)', 'Net Hours Worked',
      'Documents Completed', 'Video Sessions Completed', 'Notes', 'Finalized',
      'Logged Target ID', 'Logged Target Name', 'Logged Target UPH (Goal)', 'Logged Target Docs/Unit', 'Logged Target Videos/Unit',
      'Avg UPH (vs Logged Target)'
    ];

    const rows = logs.map(log => {
      const loggedTarget = targets.find(t => t.id === log.targetId);
      const avgUph = loggedTarget ? calculateDailyUPH(log, loggedTarget) : 0;

      const row = [
        escapeCSVField(log.date),
        escapeCSVField(log.startTime),
        escapeCSVField(log.endTime),
        escapeCSVField(log.breakDurationMinutes),
        escapeCSVField(log.trainingDurationMinutes || 0),
        escapeCSVField(log.hoursWorked.toFixed(2)),
        escapeCSVField(log.documentsCompleted),
        escapeCSVField(log.videoSessionsCompleted),
        escapeCSVField(log.notes || ''),
        escapeCSVField(log.isFinalized ? 'Yes' : 'No'),
        escapeCSVField(log.targetId || 'N/A'),
        escapeCSVField(loggedTarget?.name || 'N/A'),
        escapeCSVField(loggedTarget?.targetUPH?.toFixed(2) || 'N/A'),
        escapeCSVField(loggedTarget?.docsPerUnit?.toString() || 'N/A'),
        escapeCSVField(loggedTarget?.videosPerUnit?.toString() || 'N/A'),
        escapeCSVField(avgUph.toFixed(2)),
      ];

      return row.join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }, []);

   const downloadCSV = useCallback((csvString: string, filename: string) => {
    if (typeof window === 'undefined') return;
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Your browser does not support direct CSV downloads."
      });
    }
  }, [toast]);

  const handleExportData = useCallback(() => {
    if (filteredLogs.length === 0) { // Use filteredLogs for export
      toast({
        title: "No Data to Export",
        description: "There are no logs matching the current filters to export.",
      });
      return;
    }
    try {
      const csvData = generateCSVContent(filteredLogs, uphTargets); // Use filteredLogs
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadCSV(csvData, `metric_daily_previous_logs_${timestamp}.csv`);
      toast({
        title: "Export Successful",
        description: "Filtered previous logs data has been exported to CSV.",
      });
      addAuditLog('SYSTEM_EXPORT_DATA', 'System', 'Exported filtered previous work logs to CSV.');
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "An error occurred while preparing the data for export.",
      });
       addAuditLog('SYSTEM_EXPORT_DATA_FAILED', 'System', `Failed to export previous work logs to CSV. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [filteredLogs, uphTargets, generateCSVContent, downloadCSV, toast]); // Use filteredLogs


  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center p-4 md:p-6 lg:p-8">
        <p className="text-xl text-muted-foreground">Loading Previous Logs...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 md:mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-center sm:text-left">Previous Work Logs</h1>
        <Button onClick={handleExportData} disabled={filteredLogs.length === 0}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Filtered ({filteredLogs.length})
        </Button>
      </div>

      {/* Filter Controls Card */}
      <Card className="shadow-sm">
        <CardHeader>
             <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Filter className="h-5 w-5" /> Filter Logs
             </CardTitle>
             <CardDescription>Refine the list of previous work logs. Default order is most recent first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
            {/* Search and Date Filter Row */}
            <div className="flex flex-col md:flex-row items-center gap-3">
              <Input
                type="text"
                placeholder="Search notes, date, counts, UPH..."
                value={filterTerm}
                onChange={(e) => { setFilterTerm(e.target.value); setCurrentPage(1); }}
                className="flex-grow p-2 border border-input rounded-md text-sm focus:ring-ring focus:outline-none focus:ring-2 bg-background text-foreground"
                aria-label="Search previous logs"
              />
              {filterTerm && (
                 <Button variant="ghost" size="icon" onClick={() => { setFilterTerm(''); setCurrentPage(1); }} className="h-8 w-8 md:ml-[-40px]" title="Clear search">
                    <X className="h-4 w-4 text-muted-foreground"/>
                 </Button>
              )}

                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                   <PopoverTrigger asChild>
                     <Button
                       id="date"
                       variant={"outline"}
                       className={cn(
                         "w-full md:w-[280px] justify-start text-left font-normal h-9 text-sm",
                         !filterDateRange && "text-muted-foreground"
                       )}
                     >
                       <CalendarIcon className="mr-2 h-4 w-4" />
                       {filterDateRange?.from ? (
                         filterDateRange.to ? (
                           <>
                             {format(filterDateRange.from, "LLL dd, y")} -{" "}
                             {format(filterDateRange.to, "LLL dd, y")}
                           </>
                         ) : (
                           format(filterDateRange.from, "LLL dd, y")
                         )
                       ) : (
                         <span>Filter by Date Range</span>
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
                           onSelect={(range) => { setFilterDateRange(range); setCurrentPage(1); }}
                           numberOfMonths={1}
                           disabled={(date) => date >= startOfDay(new Date()) || date < new Date("2023-01-01")}
                         />
                    </PopoverContent>
                 </Popover>
            </div>

             {/* Removed Sorting Buttons Row */}

              {/* Show reset button if filters are active */}
              {hasActiveFilters && (
                 <div className="flex justify-end">
                    <Button variant="link" size="sm" onClick={handleResetFilters} className="p-0 h-auto text-muted-foreground hover:text-foreground">
                        <X className="mr-1 h-3 w-3" /> Reset Filters
                    </Button>
                 </div>
              )}
        </CardContent>
      </Card>

      {/* Render logs using TargetMetricsDisplay with Accordion */}
      <TargetMetricsDisplay
        allWorkLogs={paginatedLogs} // Pass only the logs for the current page
        targets={uphTargets}
        deleteWorkLogAction={handleDeleteWorkLog}
        showTodaySection={false} // Ensure today's section is not shown here
        onGoalMet={() => {}} // Provide a dummy function
       />

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-6 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}

       {filteredLogs.length === 0 && !isLoading && (
          <p className="text-center text-muted-foreground py-10">
            {allLogs.filter(l => l.isFinalized || isBefore(parseISO(l.date + 'T00:00:00'), startOfDay(new Date()))).length === 0
              ? "No previous work logs found."
              : "No logs match your filters."}
            </p>
       )}
    </div>
  );
}
