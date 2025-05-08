
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getAuditLogs, addAuditLog } from '@/lib/actions';
import type { AuditLogEntry, AuditLogActionType } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, startOfDay, endOfDay, isValid, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { RefreshCw, Download, Filter, X, Calendar as CalendarIcon, Activity, Database, Settings as SettingsIcon, Server, Shield } from 'lucide-react'; // Changed System to Server
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'; // Import Cell from recharts
import { useToast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';


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

// Define colors for chart segments (adjust as needed)
const CHART_COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
];

export default function AuditLogPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterTerm, setFilterTerm] = useState('');
  const [filterActionType, setFilterActionType] = useState<AuditLogActionType | 'all'>('all');
  const [filterEntityType, setFilterEntityType] = useState<AuditLogEntry['entityType'] | 'all'>('all');
  const [filterDateRange, setFilterDateRange] = useState<DateRange | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false); // State to control popover
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
      isValid(parseISO(log.timestamp)) ? format(parseISO(log.timestamp), 'yyyy-MM-dd HH:mm:ss') : log.timestamp, // Already includes seconds
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

  // --- Analytics Data Calculation ---
  const analyticsData = useMemo(() => {
    const totalLogs = auditLogs.length;
    const entityCounts: Record<AuditLogEntry['entityType'], number> = {
      WorkLog: 0,
      UPHTarget: 0,
      System: 0,
      Security: 0,
      Settings: 0,
    };
    const actionCounts: Record<AuditLogActionType, number> = ALL_ACTION_TYPES.reduce((acc, type) => {
        acc[type] = 0;
        return acc;
    }, {} as Record<AuditLogActionType, number>);

    auditLogs.forEach(log => {
      if (entityCounts[log.entityType] !== undefined) {
        entityCounts[log.entityType]++;
      }
      if (actionCounts[log.action] !== undefined) {
        actionCounts[log.action]++;
      }
    });

    // Data for entity type chart
    const entityChartData = Object.entries(entityCounts)
        .map(([name, value], index) => ({
            name,
            value,
            fill: CHART_COLORS[index % CHART_COLORS.length], // Assign colors
        }))
        .filter(item => item.value > 0) // Only show entities with counts > 0
        .sort((a, b) => b.value - a.value); // Sort descending by count

    // Data for top actions chart (e.g., top 5)
    const actionChartData = Object.entries(actionCounts)
        .map(([name, value], index) => ({
            name: formatActionTypeDisplay(name),
            value,
            fill: CHART_COLORS[index % CHART_COLORS.length],
        }))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5); // Limit to top 5 for readability

    return {
      totalLogs,
      entityCounts,
      actionCounts,
      entityChartData,
      actionChartData,
    };
  }, [auditLogs]);

  const hasActiveFilters = filterTerm || filterActionType !== 'all' || filterEntityType !== 'all' || filterDateRange;

  // Preset Date Range Handlers
  const setPresetDateRange = (range: DateRange | undefined) => {
      setFilterDateRange(range);
      setCurrentPage(1);
      setDatePickerOpen(false); // Close popover after selection
  };

  const today = new Date();
  const presetRanges = [
    { label: "Today", range: { from: startOfDay(today), to: endOfDay(today) } },
    { label: "Yesterday", range: { from: startOfDay(subDays(today, 1)), to: endOfDay(subDays(today, 1)) } },
    { label: "This Week", range: { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) } },
    { label: "Last 7 Days", range: { from: startOfDay(subDays(today, 6)), to: endOfDay(today) } },
  ];


  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center p-4 md:p-6 lg:p-8">
        <p className="text-xl text-muted-foreground">Loading Audit Log...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-4 md:p-6 lg:p-8">
      {/* Analytics Section */}
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                    <Activity className="h-5 w-5" /> Audit Log Analytics
                </CardTitle>
                <CardDescription>
                    Overview of logged activities. Total Logs: {analyticsData.totalLogs}
                </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-0">
                {/* Entity Type Counts */}
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Entries by Entity Type</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        {Object.entries(analyticsData.entityCounts).map(([entity, count]) => (
                            count > 0 && ( // Only show if count > 0
                                <div key={entity} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                    <span className="font-medium flex items-center gap-1.5">
                                        {entity === 'WorkLog' && <Database className="h-4 w-4 text-blue-500" />}
                                        {entity === 'UPHTarget' && <Activity className="h-4 w-4 text-green-500" />}
                                        {entity === 'System' && <Server className="h-4 w-4 text-purple-500" />} {/* Changed System to Server */}
                                        {entity === 'Security' && <Shield className="h-4 w-4 text-red-500" />}
                                        {entity === 'Settings' && <SettingsIcon className="h-4 w-4 text-orange-500" />}
                                        {entity}
                                    </span>
                                    <span className="font-semibold text-foreground">{count}</span>
                                </div>
                            )
                        ))}
                    </div>
                </div>
                 {/* Top Actions Chart */}
                <div className="space-y-2">
                     <h4 className="text-sm font-medium text-muted-foreground">Top 5 Actions</h4>
                     {analyticsData.actionChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={150}>
                            <BarChart data={analyticsData.actionChartData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/>
                                <Tooltip
                                    cursor={{ fill: 'hsl(var(--muted))' }}
                                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                                    labelStyle={{ color: 'hsl(var(--foreground))', fontSize: '12px' }}
                                    itemStyle={{ fontSize: '12px' }}
                                />
                                <Bar dataKey="value" name="Count" radius={[0, 4, 4, 0]} barSize={12}>
                                    {/* Add Cell to apply individual colors */}
                                    {analyticsData.actionChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                     ) : (
                         <p className="text-sm text-muted-foreground text-center py-10">No actions logged yet.</p>
                     )}
                </div>
            </CardContent>
        </Card>


      <Card className="shadow-lg">
        <CardHeader className="border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-bold">Application Audit Log</CardTitle>
              <CardDescription>History of changes made within the application. ({filteredLogs.length} entries shown)</CardDescription>
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

                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
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
                           numberOfMonths={1} // Show one month for smaller popover
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
                      <TableCell className="text-xs whitespace-nowrap">
                        {/* Updated format to include seconds: 'MMM d, yyyy h:mm:ss a' */}
                        {isValid(parseISO(log.timestamp)) ? format(parseISO(log.timestamp), 'MMM d, yyyy h:mm:ss a') : log.timestamp}
                      </TableCell>
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
