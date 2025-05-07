
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getAuditLogs, addAuditLog } from '@/lib/actions';
import type { AuditLogEntry, AuditLogActionType } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input'; // Import Input
import { Combobox, ComboboxOption } from '@/components/ui/combobox'; // Import Combobox
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; // Import Popover
import { Calendar } from '@/components/ui/calendar'; // Import Calendar
import { format, parseISO, startOfDay, endOfDay, isValid } from 'date-fns';
import { RefreshCw, Download, Filter, X, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker'; // Import DateRange type
import { cn } from '@/lib/utils'; // Import cn

const ITEMS_PER_PAGE = 20;

// Generate distinct action types and entity types from AuditLogActionType
const ALL_ACTION_TYPES = [
  'CREATE_WORK_LOG',
  'UPDATE_WORK_LOG',
  'UPDATE_WORK_LOG_QUICK_COUNT',
  'UPDATE_WORK_LOG_BREAK',
  'UPDATE_WORK_LOG_TRAINING',
  'DELETE_WORK_LOG',
  'CREATE_UPH_TARGET',
  'UPDATE_UPH_TARGET',
  'DELETE_UPH_TARGET',
  'DUPLICATE_UPH_TARGET',
  'SET_ACTIVE_UPH_TARGET',
  'SYSTEM_LOAD_SAMPLE_DATA',
  'SYSTEM_CLEAR_ALL_DATA',
  'SYSTEM_ARCHIVE_TODAY_LOG',
  'SYSTEM_EXPORT_DATA',
  'SYSTEM_EXPORT_DATA_FAILED',
  'SYSTEM_VIEW_AUDIT_LOG',
  'UPDATE_SETTINGS',
] as const; // Use const assertion

const ALL_ENTITY_TYPES: AuditLogEntry['entityType'][] = ['WorkLog', 'UPHTarget', 'System', 'Security', 'Settings'];

export default function AuditLogPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterTerm, setFilterTerm] = useState('');
  const [filterActionType, setFilterActionType] = useState<AuditLogActionType | 'all'>('all');
  const [filterEntityType, setFilterEntityType] = useState<AuditLogEntry['entityType'] | 'all'>('all');
  const [filterDateRange, setFilterDateRange] = useState<DateRange | undefined>(undefined);
  const { toast } = useToast();

  const loadAuditLogs = useCallback(() => {
    setIsLoading(true);
    try {
      const logs = getAuditLogs();
      setAuditLogs(logs);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      toast({
        variant: "destructive",
        title: "Error Loading Audit Logs",
        description: "Could not load the audit trail.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const searchTerm = filterTerm.toLowerCase();
      const logTimestamp = parseISO(log.timestamp);

      const matchesSearch = (
        log.action.toLowerCase().includes(searchTerm) ||
        log.entityType.toLowerCase().includes(searchTerm) ||
        (log.entityId && log.entityId.toLowerCase().includes(searchTerm)) ||
        log.details.toLowerCase().includes(searchTerm) ||
        (isValid(logTimestamp) ? format(logTimestamp, 'PPP p').toLowerCase().includes(searchTerm) : false)
      );

      const matchesActionType = filterActionType === 'all' || log.action === filterActionType;
      const matchesEntityType = filterEntityType === 'all' || log.entityType === filterEntityType;

      let matchesDateRange = true;
      if (filterDateRange?.from && isValid(logTimestamp)) {
        matchesDateRange = logTimestamp >= startOfDay(filterDateRange.from);
      }
      if (filterDateRange?.to && isValid(logTimestamp)) {
        matchesDateRange = matchesDateRange && logTimestamp <= endOfDay(filterDateRange.to);
      }

      return matchesSearch && matchesActionType && matchesEntityType && matchesDateRange;
    });
  }, [auditLogs, filterTerm, filterActionType, filterEntityType, filterDateRange]);


  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [filteredLogs, currentPage]);

  const totalPages = useMemo(() => Math.ceil(filteredLogs.length / ITEMS_PER_PAGE), [filteredLogs]);

  const handleRefresh = () => {
    setCurrentPage(1);
    setFilterTerm('');
    setFilterActionType('all');
    setFilterEntityType('all');
    setFilterDateRange(undefined);
    loadAuditLogs();
    toast({ title: "Audit Log Refreshed", description: "The latest changes are now displayed." });
  };

  const handleResetFilters = () => {
     setCurrentPage(1);
     setFilterTerm('');
     setFilterActionType('all');
     setFilterEntityType('all');
     setFilterDateRange(undefined);
     // No toast needed, just reset filters
  };

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      toast({ title: "No Data to Export", description: "There are no logs matching the current filter." });
      return;
    }
    const headers = ['Timestamp', 'Action', 'Entity Type', 'Entity ID', 'Details', 'Previous State', 'New State'];
    const rows = filteredLogs.map(log => [
      isValid(parseISO(log.timestamp)) ? format(parseISO(log.timestamp), 'yyyy-MM-dd HH:mm:ss') : log.timestamp,
      log.action,
      log.entityType,
      log.entityId || '',
      log.details,
      log.previousState ? JSON.stringify(log.previousState) : '',
      log.newState ? JSON.stringify(log.newState) : '',
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `metric_daily_audit_log_${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Export Successful", description: "Audit log exported to CSV." });
    addAuditLog('SYSTEM_EXPORT_DATA', 'System', 'Exported audit log to CSV.');
  };

  const formatActionTypeDisplay = (action: AuditLogActionType | string) => {
     return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Prepare options for Combobox components
  const actionTypeOptions: ComboboxOption[] = useMemo(() => ([
    { value: 'all', label: 'All Action Types' },
    ...ALL_ACTION_TYPES.map(type => ({
      value: type,
      label: formatActionTypeDisplay(type),
    })),
  ]), []); // Empty dependency array, runs once

  const entityTypeOptions: ComboboxOption[] = useMemo(() => ([
    { value: 'all', label: 'All Entity Types' },
    ...ALL_ENTITY_TYPES.map(type => ({ value: type, label: type })),
  ]), []); // Empty dependency array, runs once

  const hasActiveFilters = filterTerm || filterActionType !== 'all' || filterEntityType !== 'all' || filterDateRange;


  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center p-4 md:p-6 lg:p-8">
        <p className="text-xl text-muted-foreground">Loading Audit Log...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-4 md:p-6 lg:p-8">
      <Card className="shadow-lg">
        <CardHeader className="border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-bold">Application Audit Log</CardTitle>
              <CardDescription>History of changes made within the application.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleRefresh} size="sm" disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
              <Button variant="outline" onClick={handleExport} size="sm" disabled={isLoading || filteredLogs.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <Filter className="h-5 w-5 text-muted-foreground hidden md:block" />
              <Input
                type="text"
                placeholder="Search logs..."
                value={filterTerm}
                onChange={(e) => { setFilterTerm(e.target.value); setCurrentPage(1); }}
                className="flex-grow p-2 border border-input rounded-md text-sm focus:ring-ring focus:outline-none focus:ring-2 bg-background text-foreground" // Ensure text color is foreground
                disabled={isLoading}
                aria-label="Search audit logs"
              />
              {filterTerm && (
                 <Button variant="ghost" size="icon" onClick={() => { setFilterTerm(''); setCurrentPage(1); }} className="h-8 w-8 md:ml-[-40px] md:mr-2" disabled={isLoading} title="Clear search">
                    <X className="h-4 w-4 text-muted-foreground"/>
                 </Button>
              )}
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Combobox
                    options={actionTypeOptions}
                    value={filterActionType}
                    onSelect={(value) => { setFilterActionType(value as AuditLogActionType | 'all'); setCurrentPage(1); }}
                    placeholder="Filter by Action Type"
                    searchPlaceholder="Search actions..."
                    notFoundText="No actions found."
                    disabled={isLoading}
                />

               <Combobox
                    options={entityTypeOptions}
                    value={filterEntityType}
                    onSelect={(value) => { setFilterEntityType(value as AuditLogEntry['entityType'] | 'all'); setCurrentPage(1); }}
                    placeholder="Filter by Entity Type"
                    searchPlaceholder="Search entities..."
                    notFoundText="No entities found."
                    disabled={isLoading}
                />

                <Popover>
                   <PopoverTrigger asChild>
                     <Button
                       id="date"
                       variant={"outline"}
                       className={cn(
                         "justify-start text-left font-normal h-9 text-sm",
                         !filterDateRange && "text-muted-foreground"
                       )}
                       disabled={isLoading}
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
                   <PopoverContent className="w-auto p-0" align="start">
                     <Calendar
                       initialFocus
                       mode="range"
                       defaultMonth={filterDateRange?.from}
                       selected={filterDateRange}
                       onSelect={(range) => { setFilterDateRange(range); setCurrentPage(1); }}
                       numberOfMonths={2}
                       disabled={(date) => date > new Date() || date < new Date("2023-01-01")}
                     />
                   </PopoverContent>
                 </Popover>

             </div>
              {hasActiveFilters && (
                 <div className="flex justify-end">
                    <Button variant="link" size="sm" onClick={handleResetFilters} className="p-0 h-auto text-muted-foreground hover:text-foreground" disabled={isLoading}>
                        <X className="mr-1 h-3 w-3" /> Reset Filters
                    </Button>
                 </div>
              )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {paginatedLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              {auditLogs.length === 0 ? "No audit log entries found." : "No logs match your filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px] min-w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[200px] min-w-[200px]">Action</TableHead>
                    <TableHead className="w-[120px] min-w-[120px]">Entity Type</TableHead>
                    <TableHead className="w-[150px] min-w-[150px]">Entity ID</TableHead>
                    <TableHead className="min-w-[250px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">{isValid(parseISO(log.timestamp)) ? format(parseISO(log.timestamp), 'MMM d, yyyy p') : log.timestamp}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                          {formatActionTypeDisplay(log.action)}
                        </span>
                      </TableCell>
                      <TableCell>{log.entityType}</TableCell>
                      <TableCell className="text-xs truncate max-w-[150px]" title={log.entityId}>
                        {log.entityId || 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm break-words">{log.details}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-6 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || isLoading}
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
                disabled={currentPage === totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
