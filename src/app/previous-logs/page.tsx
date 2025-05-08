
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TargetMetricsDisplay from '@/components/TargetMetricsDisplay';
import {
  getWorkLogs,
  getUPHTargets,
  deleteWorkLog,
  addAuditLog,
} from '@/lib/actions';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { formatDateISO, calculateDailyUPH, calculateDailyUnits, cn, formatFriendlyDate } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSpreadsheet, Filter, X, Calendar as CalendarIcon, ArrowUpDown } from 'lucide-react';
import { format, parseISO, isValid, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, subWeeks } from 'date-fns'; // Added subWeeks
import { DateRange } from 'react-day-picker';
import { Separator } from '@/components/ui/separator';

// Pagination settings
const ITEMS_PER_PAGE = 10;

type SortableColumn = keyof Pick<DailyWorkLog, 'date' | 'hoursWorked' | 'documentsCompleted' | 'videoSessionsCompleted'> | 'avgUPH';
type SortDirection = 'asc' | 'desc';

export default function PreviousLogsPage() {
  const [allLogs, setAllLogs] = useState<DailyWorkLog[]>([]);
  const [uphTargets, setUphTargets] = useState<UPHTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Filtering State
  const [filterTerm, setFilterTerm] = useState('');
  const [filterDateRange, setFilterDateRange] = useState<DateRange | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Sorting State
  const [sortColumn, setSortColumn] = useState<SortableColumn>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  const activeTarget = useMemo(() => uphTargets.find(t => t.isActive) || (uphTargets.length > 0 ? uphTargets[0] : null), [uphTargets]);


  // Load data needed for this page
  const loadData = useCallback(() => {
     if (typeof window === 'undefined') return; // Don't run on server
    console.log('[PreviousLogsPage] Loading data...');
    setIsLoading(true);
    try {
      const loadedLogs = getWorkLogs();
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
      // Refetch or update local state after deletion
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
    const todayDateStr = formatDateISO(new Date());
    return allLogs.filter(log => {
        if (log.date === todayDateStr) return false; // Exclude today's log

        const searchTerm = filterTerm.toLowerCase();
        const logTimestamp = parseISO(log.date + 'T00:00:00'); // Ensure time for correct comparison

        const matchesSearch = (
            log.date.toLowerCase().includes(searchTerm) ||
            log.startTime.toLowerCase().includes(searchTerm) ||
            log.endTime.toLowerCase().includes(searchTerm) ||
            log.hoursWorked.toString().includes(searchTerm) ||
            log.documentsCompleted.toString().includes(searchTerm) ||
            log.videoSessionsCompleted.toString().includes(searchTerm) ||
            (log.notes && log.notes.toLowerCase().includes(searchTerm)) ||
            (isValid(logTimestamp) ? format(logTimestamp, 'PPP').toLowerCase().includes(searchTerm) : false) ||
            (activeTarget && calculateDailyUPH(log, activeTarget).toFixed(2).includes(searchTerm))
        );

        let matchesDateRange = true;
        if (filterDateRange?.from && isValid(logTimestamp)) {
            matchesDateRange = logTimestamp >= startOfDay(filterDateRange.from);
        }
        if (filterDateRange?.to && isValid(logTimestamp)) {
            matchesDateRange = matchesDateRange && logTimestamp <= endOfDay(filterDateRange.to);
        }

        return matchesSearch && matchesDateRange;
    });
  }, [allLogs, filterTerm, filterDateRange, activeTarget]);

  // Sorting Logic
  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => {
      let valA: string | number | null = null;
      let valB: string | number | null = null;

      if (sortColumn === 'avgUPH') {
         valA = activeTarget ? calculateDailyUPH(a, activeTarget) : 0;
         valB = activeTarget ? calculateDailyUPH(b, activeTarget) : 0;
      } else {
         valA = a[sortColumn as keyof Omit<DailyWorkLog, 'avgUPH'>];
         valB = b[sortColumn as keyof Omit<DailyWorkLog, 'avgUPH'>];
      }


      let comparison = 0;
      if (valA === null || valA === undefined) comparison = -1;
      else if (valB === null || valB === undefined) comparison = 1;
      else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else {
        comparison = String(valA).localeCompare(String(valB));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredLogs, sortColumn, sortDirection, activeTarget]);

  // Pagination Logic
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedLogs, currentPage]);

  const totalPages = useMemo(() => Math.ceil(sortedLogs.length / ITEMS_PER_PAGE), [sortedLogs]);


  // Handlers
  const handleSort = useCallback((column: SortableColumn) => {
    setSortDirection(prevDirection =>
      sortColumn === column && prevDirection === 'desc' ? 'asc' : 'desc' // Default to desc first for date
    );
    setSortColumn(column);
    setCurrentPage(1); // Reset page when sorting changes
  }, [sortColumn]);

  const handleResetFilters = () => {
     setFilterTerm('');
     setFilterDateRange(undefined);
     setSortColumn('date'); // Reset sort to default
     setSortDirection('desc');
     setCurrentPage(1);
  };

  const renderSortIcon = (column: SortableColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    return sortDirection === 'asc' ?
      <ArrowUpDown className="ml-2 h-4 w-4 text-accent" /> : // Use accent color for active sort
      <ArrowUpDown className="ml-2 h-4 w-4 text-accent transform rotate-180" />; // Rotate for desc
  };

  const hasActiveFilters = filterTerm || filterDateRange;

  // Preset Date Range Handlers
  const setPresetDateRange = (range: DateRange | undefined) => {
      setFilterDateRange(range);
      setCurrentPage(1);
      setDatePickerOpen(false); // Close popover after selection
  };

  const today = new Date();
  const presetRanges = [
    { label: "Yesterday", range: { from: startOfDay(subDays(today, 1)), to: endOfDay(subDays(today, 1)) } },
    { label: "This Week", range: { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) } },
    { label: "Last Week", range: { from: startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }), to: endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }) } }, // Added Last Week
    { label: "Last 7 Days", range: { from: startOfDay(subDays(today, 6)), to: endOfDay(today) } },
    { label: "Last 30 Days", range: { from: startOfDay(subDays(today, 29)), to: endOfDay(today) } },
  ];


  // CSV Export (remains largely the same, uses filteredLogs)
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
      'Documents Completed', 'Video Sessions Completed', 'Notes',
      'Logged Target ID', 'Logged Target Name', 'Logged Target UPH (Goal)', 'Logged Target Docs/Unit', 'Logged Target Videos/Unit'
    ];

    targets.forEach(target => {
      headers.push(`${target.name} - Calculated Units`);
      headers.push(`${target.name} - Calculated UPH`);
    });

    const rows = logs.map(log => {
      const loggedTarget = targets.find(t => t.id === log.targetId);
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
        escapeCSVField(log.targetId || 'N/A'),
        escapeCSVField(loggedTarget?.name || 'N/A'),
        escapeCSVField(loggedTarget?.targetUPH?.toFixed(2) || 'N/A'),
        escapeCSVField(loggedTarget?.docsPerUnit?.toString() || 'N/A'),
        escapeCSVField(loggedTarget?.videosPerUnit?.toString() || 'N/A'),
      ];

      targets.forEach(target => {
        const units = calculateDailyUnits(log, target);
        const uph = calculateDailyUPH(log, target);
        row.push(escapeCSVField(units.toFixed(2)));
        row.push(escapeCSVField(uph.toFixed(2)));
      });
      return row.join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }, []);

   const downloadCSV = useCallback((csvString: string, filename: string) => {
    if (typeof window === 'undefined') return;
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) { // Feature detection
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
     // Use sortedLogs for export to respect current view
    if (sortedLogs.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no logs matching the current filters to export.",
      });
      return;
    }
    try {
      const csvData = generateCSVContent(sortedLogs, uphTargets);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadCSV(csvData, `metric_daily_previous_logs_${timestamp}.csv`);
      toast({
        title: "Export Successful",
        description: "Filtered & Sorted previous logs data has been exported to CSV.",
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
  }, [sortedLogs, uphTargets, generateCSVContent, downloadCSV, toast]);


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
        <Button onClick={handleExportData} disabled={sortedLogs.length === 0}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Filtered ({sortedLogs.length})
        </Button>
      </div>

      {/* Filter and Sort Controls */}
      <Card className="shadow-sm">
        <CardHeader>
             <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Filter className="h-5 w-5" /> Filter & Sort Logs
             </CardTitle>
             <CardDescription>Refine the list of previous work logs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
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
                         "w-full md:w-[280px] justify-start text-left font-normal h-9 text-sm", // Fixed width for popover trigger consistency
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
                           disabled={(date) => date >= startOfDay(new Date()) || date < new Date("2023-01-01")} // Disable today and future
                         />
                    </PopoverContent>
                 </Popover>
            </div>
              {hasActiveFilters && (
                 <div className="flex justify-end">
                    <Button variant="link" size="sm" onClick={handleResetFilters} className="p-0 h-auto text-muted-foreground hover:text-foreground">
                        <X className="mr-1 h-3 w-3" /> Reset Filters
                    </Button>
                 </div>
              )}
        </CardContent>
      </Card>

      {/* Pass filtered and sorted logs to TargetMetricsDisplay */}
      <TargetMetricsDisplay
        allWorkLogs={paginatedLogs} // Pass only the logs for the current page
        targets={uphTargets}
        deleteWorkLogAction={handleDeleteWorkLog}
        showTodaySection={false}
        paginatePreviousLogs={false} // Disable internal pagination
        showSortingHeaders={true} // Indicate headers should be shown (or handle header display logic here)
        currentSortColumn={sortColumn}
        currentSortDirection={sortDirection}
        onSort={handleSort}
        renderSortIcon={renderSortIcon}
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

       {sortedLogs.length === 0 && !isLoading && (
          <p className="text-center text-muted-foreground py-10">
            {allLogs.filter(l => l.date !== formatDateISO(new Date())).length === 0
              ? "No previous work logs found."
              : "No logs match your filters."}
            </p>
       )}
    </div>
  );
}
