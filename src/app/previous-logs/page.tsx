'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TargetMetricsDisplay from '@/components/TargetMetricsDisplay';
import {
  getWorkLogs,
  getUPHTargets,
  deleteWorkLog,
  addAuditLog, 
  getAuditLogs, // Import getAuditLogs
  getDefaultSettings, // Import getDefaultSettings
  isSampleDataLoaded, // Import isSampleDataLoaded
} from '@/lib/actions';
import type { DailyWorkLog, UPHTarget, ApplicationData, AuditLogEntry, UserSettings } from '@/types'; // Import ApplicationData
import { formatDateISO, calculateDailyUPH, calculateDailyUnits, cn, formatFriendlyDate } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, Filter, X, Calendar as CalendarIcon, ArrowUpDown } from 'lucide-react'; // Changed FileSpreadsheet to Upload for JSON
import { format, parseISO, isValid, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, subWeeks, isBefore } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Separator } from '@/components/ui/separator';
import { getUserWorkLogs, deleteWorkLogFromFirestore } from '@/lib/firestore';
import { useAuth } from '@/lib/AuthContext';

// Pagination settings
const ITEMS_PER_PAGE = 10;

// Sorting types
type SortableColumn = keyof Pick<DailyWorkLog, 'date' | 'hoursWorked' | 'documentsCompleted' | 'videoSessionsCompleted'> | 'avgUPH';
type SortDirection = 'asc' | 'desc';

// Helper to map Firestore log to DailyWorkLog
function mapFirestoreLogToDailyWorkLog(log: any): DailyWorkLog {
  return {
    id: log.id,
    date: log.date && typeof log.date.toDate === 'function' ? formatDateISO(log.date.toDate()) : (typeof log.date === 'string' ? log.date : ''),
    startTime: log.startTime ?? '',
    endTime: log.endTime ?? '',
    breakDurationMinutes: log.breakDurationMinutes ?? 0,
    trainingDurationMinutes: log.trainingDurationMinutes ?? 0,
    hoursWorked: log.hoursWorked ?? 0,
    documentsCompleted: log.documentsProcessed ?? 0,
    videoSessionsCompleted: log.videosProcessed ?? 0,
    targetId: log.targetId ?? '',
    notes: log.notes ?? '',
    goalMetTimes: log.goalMetTimes ?? {},
    isFinalized: log.isFinalized ?? false,
  };
}

export default function PreviousLogsPage() {
  const [allLogs, setAllLogs] = useState<DailyWorkLog[]>([]);
  const [uphTargets, setUphTargets] = useState<UPHTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  // Filtering State
  const [filterTerm, setFilterTerm] = useState('');
  const [filterDateRange, setFilterDateRange] = useState<DateRange | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Sorting State
  const [sortColumn, setSortColumn] = useState<SortableColumn | null>('date'); // Default sort by date
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc'); // Default descending

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Determine active target based on uphTargets state
  const activeTarget = useMemo(() => uphTargets.find(t => t.isActive && (t.isDisplayed ?? true)) || uphTargets.find(t => t.isDisplayed ?? true) || (uphTargets.length > 0 ? uphTargets[0] : null), [uphTargets]);


  // Load data needed for this page
  const loadData = useCallback(() => {
     if (typeof window === 'undefined') return; // Don't run on server
    console.log('[PreviousLogsPage] Loading data...');
    setIsLoading(true);
    try {
      const loadedLogs = getWorkLogs(); // getWorkLogs returns all logs, sorted by date descending by default
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

  const handleDeleteWorkLog = useCallback(async (id: string) => {
    if (!user) return;
    try {
      await deleteWorkLogFromFirestore(id);
      const updatedLogs = (await getUserWorkLogs(user.uid)).map(mapFirestoreLogToDailyWorkLog);
      setAllLogs(updatedLogs);
      toast({ title: "Log Deleted", description: "Previous work log deleted from the cloud." });
    } catch (error) {
      console.error('[PreviousLogsPage] Error deleting work log from Firestore:', error);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Could not delete the work log from Firestore.",
      });
      throw error;
    }
  }, [toast, user]);


  // Filtering and Sorting Logic
  const filteredAndSortedLogs = useMemo(() => {
    const todayStart = startOfDay(new Date()); // Get start of today

    let logsToProcess = allLogs.filter(log => {
        const logDateObj = parseISO(log.date + 'T00:00:00');
        if (!isValid(logDateObj)) return false;

        const isPreviousDay = isBefore(logDateObj, todayStart);
        const isFinalizedToday = log.date === formatDateISO(new Date()) && log.isFinalized;

        return isPreviousDay || isFinalizedToday;
    });

    if (filterTerm) {
        logsToProcess = logsToProcess.filter(log => {
            const searchTerm = filterTerm.toLowerCase();
            const logTarget = uphTargets.find(t => t.id === log.targetId) ?? activeTarget; // Needed for UPH search
            const logDateObj = parseISO(log.date + 'T00:00:00');

            const avgUPHForSearch = logTarget ? calculateDailyUPH(log, logTarget) : 0; // Calculate UPH for searching

            return (
                log.date.toLowerCase().includes(searchTerm) ||
                log.startTime.toLowerCase().includes(searchTerm) ||
                log.endTime.toLowerCase().includes(searchTerm) ||
                log.hoursWorked.toString().includes(searchTerm) ||
                log.documentsCompleted.toString().includes(searchTerm) ||
                log.videoSessionsCompleted.toString().includes(searchTerm) ||
                (log.notes && log.notes.toLowerCase().includes(searchTerm)) ||
                (isValid(logDateObj) && format(logDateObj, 'PPP').toLowerCase().includes(searchTerm)) ||
                (logTarget && avgUPHForSearch.toFixed(2).includes(searchTerm)) // Search formatted UPH
            );
        });
    }

    if (filterDateRange?.from) {
        logsToProcess = logsToProcess.filter(log => {
            const logDateObj = parseISO(log.date + 'T00:00:00');
            return isValid(logDateObj) && logDateObj >= startOfDay(filterDateRange.from!);
        });
    }
    if (filterDateRange?.to) {
        logsToProcess = logsToProcess.filter(log => {
            const logDateObj = parseISO(log.date + 'T00:00:00');
            return isValid(logDateObj) && logDateObj <= endOfDay(filterDateRange.to!);
        });
    }

    // Sorting Logic
    if (sortColumn) {
        logsToProcess.sort((a, b) => {
            let valA: string | number | Date;
            let valB: string | number | Date;

            if (sortColumn === 'date') {
                valA = parseISO(a.date + 'T00:00:00');
                valB = parseISO(b.date + 'T00:00:00');
            } else if (sortColumn === 'avgUPH') {
                 // --- Corrected UPH sorting ---
                 // Find the target associated with each log, fallback to active target
                 const targetA = uphTargets.find(t => t.id === a.targetId) ?? activeTarget;
                 const targetB = uphTargets.find(t => t.id === b.targetId) ?? activeTarget;
                 // Calculate UPH using the determined target for each log
                 valA = targetA ? calculateDailyUPH(a, targetA) : 0;
                 valB = targetB ? calculateDailyUPH(b, targetB) : 0;
                 // --- End of correction ---
            } else {
                const rawA = a[sortColumn as keyof DailyWorkLog];
                const rawB = b[sortColumn as keyof DailyWorkLog];
                if (typeof rawA === 'boolean') {
                  valA = rawA ? 1 : 0;
                } else if (typeof rawA === 'object') {
                  valA = 0;
                } else {
                  valA = rawA ?? 0;
                }
                if (typeof rawB === 'boolean') {
                  valB = rawB ? 1 : 0;
                } else if (typeof rawB === 'object') {
                  valB = 0;
                } else {
                  valB = rawB ?? 0;
                }
            }

            let comparison = 0;
            if (valA instanceof Date && valB instanceof Date) {
                comparison = valA.getTime() - valB.getTime();
            } else if (typeof valA === 'number' && typeof valB === 'number') {
                comparison = valA - valB;
            } else if (typeof valA === 'string' && typeof valB === 'string') {
                 comparison = valA.localeCompare(valB);
            } else {
                 comparison = String(valA).localeCompare(String(valB)); // Fallback comparison
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }


    return logsToProcess;
  }, [allLogs, filterTerm, filterDateRange, sortColumn, sortDirection, activeTarget, uphTargets]); // Added uphTargets and activeTarget to dependencies

  // Pagination Logic - uses filteredAndSortedLogs
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedLogs, currentPage]);

  const totalPages = useMemo(() => Math.ceil(filteredAndSortedLogs.length / ITEMS_PER_PAGE), [filteredAndSortedLogs]);


  // Handlers
  const handleResetFilters = () => {
     setFilterTerm('');
     setFilterDateRange(undefined);
     setSortColumn('date'); // Reset sort to default
     setSortDirection('desc');
     setCurrentPage(1);
  };

   // Handle Sorting
  const handleSort = useCallback((column: SortableColumn) => {
    if (sortColumn === column) {
      // If clicking the same column, toggle direction
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a new column, set column and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page on sort change
  }, [sortColumn]);


  // Check if filters or custom sort are active
  const hasActiveFilters = filterTerm || filterDateRange || sortColumn !== 'date' || sortDirection !== 'desc';


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


  // JSON Export
  const downloadJSON = useCallback((jsonData: string, filename: string) => {
    if (typeof window === 'undefined') return;
    const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8;' });
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
        description: "Your browser does not support direct JSON downloads."
      });
    }
  }, [toast]);

  const handleExportData = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      // Fetch all data for export
      const allWorkLogsData = getWorkLogs();
      const allUphTargetsData = getUPHTargets();
      const allAuditLogsData = getAuditLogs();
      const currentUserSettings = getDefaultSettings();
      const currentSampleDataLoaded = isSampleDataLoaded();

      if (allWorkLogsData.length === 0 && allUphTargetsData.length === 0 && allAuditLogsData.length === 0) {
        toast({
          title: "No Data to Export",
          description: "There is no application data to export.",
        });
        return;
      }

      const applicationDataToExport: ApplicationData = {
        workLogs: allWorkLogsData,
        uphTargets: allUphTargetsData,
        auditLogs: allAuditLogsData,
        userSettings: currentUserSettings,
        sampleDataLoaded: currentSampleDataLoaded,
      };

      const jsonData = JSON.stringify(applicationDataToExport, null, 2); // Pretty print JSON
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadJSON(jsonData, `metric_daily_backup_${timestamp}.json`);

      toast({
        title: "Export Successful",
        description: "All application data has been exported to a JSON file.",
      });
      addAuditLog('SYSTEM_EXPORT_DATA', 'System', 'Exported all application data to JSON.');
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "An error occurred while preparing the data for export.",
      });
      addAuditLog('SYSTEM_EXPORT_DATA_FAILED', 'System', `Failed to export application data to JSON. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [downloadJSON, toast]);


  // Helper to render sort icon
  const renderSortIcon = (column: SortableColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />;
    }
    return sortDirection === 'asc' ?
      <ArrowUpDown className="ml-1 h-3 w-3 transform rotate-180" /> : // Up arrow (conceptually)
      <ArrowUpDown className="ml-1 h-3 w-3" />; // Down arrow (conceptually)
  };


  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center p-4 md:p-6 lg:p-8">
        <p className="text-xl text-muted-foreground">Loading Previous Logs...</p>
      </div>
    );
  }
  
  const displayedTargets = uphTargets.filter(t => t.isDisplayed ?? true);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 md:mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-center sm:text-left">Previous Work Logs</h1>
        <Button onClick={handleExportData}>
          <Upload className="mr-2 h-4 w-4" /> Export All Data (JSON)
        </Button>
      </div>

      {/* Filter and Sort Controls Card */}
      <Card className="shadow-sm">
        <CardHeader>
             <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Filter className="h-5 w-5" /> Filter & Sort Logs
             </CardTitle>
             <CardDescription>Refine and order the list of previous work logs displayed below. Export includes all data.</CardDescription>
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

             {/* Sorting Buttons Row */}
             <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground mr-2">Sort by:</span>
                <Button variant={sortColumn === 'date' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleSort('date')}>Date {renderSortIcon('date')}</Button>
                <Button variant={sortColumn === 'hoursWorked' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleSort('hoursWorked')}>Hours {renderSortIcon('hoursWorked')}</Button>
                <Button variant={sortColumn === 'documentsCompleted' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleSort('documentsCompleted')}>Docs {renderSortIcon('documentsCompleted')}</Button>
                <Button variant={sortColumn === 'videoSessionsCompleted' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleSort('videoSessionsCompleted')}>Videos {renderSortIcon('videoSessionsCompleted')}</Button>
                <Button variant={sortColumn === 'avgUPH' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleSort('avgUPH')}>Avg UPH {renderSortIcon('avgUPH')}</Button>
             </div>


              {/* Show reset button if filters are active */}
              {hasActiveFilters && (
                 <div className="flex justify-end">
                    <Button variant="link" size="sm" onClick={handleResetFilters} className="p-0 h-auto text-muted-foreground hover:text-foreground">
                        <X className="mr-1 h-3 w-3" /> Reset Filters & Sort
                    </Button>
                 </div>
              )}
        </CardContent>
      </Card>

      {/* Render logs using TargetMetricsDisplay with Accordion */}
      <TargetMetricsDisplay
        allWorkLogs={paginatedLogs} // Pass sorted and filtered logs for the current page
        targets={displayedTargets} // Pass only displayed targets
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

       {filteredAndSortedLogs.length === 0 && !isLoading && (
          <p className="text-center text-muted-foreground py-10">
            {allLogs.filter(l => l.isFinalized || isBefore(parseISO(l.date + 'T00:00:00'), startOfDay(new Date()))).length === 0
              ? "No previous work logs found."
              : "No logs match your filters."}
            </p>
       )}
    </div>
  );
}

