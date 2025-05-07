
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getAuditLogs, addAuditLog } from '@/lib/actions';
import type { AuditLogEntry } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { RefreshCw, Download, Filter, X } from 'lucide-react'; // Removed Lock icon
import { useToast } from '@/hooks/use-toast';
// Removed useRouter as it's no longer needed for redirects based on auth

const ITEMS_PER_PAGE = 20;

export default function AuditLogPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [currentPage, setCurrentPage] = useState(1);
  const [filterTerm, setFilterTerm] = useState('');
  const { toast } = useToast();

  const loadAuditLogs = useCallback(() => {
    setIsLoading(true);
    try {
      const logs = getAuditLogs();
      setAuditLogs(logs);
      // Log successful loading of audit logs
      // addAuditLog('SYSTEM_VIEW_AUDIT_LOG', 'System', 'Accessed the Audit Log page.'); // Optional: log page access
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
    // Directly load logs since authentication is removed
    loadAuditLogs();
  }, [loadAuditLogs]);

  const filteredLogs = auditLogs.filter(log => {
    const searchTerm = filterTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(searchTerm) ||
      log.entityType.toLowerCase().includes(searchTerm) ||
      (log.entityId && log.entityId.toLowerCase().includes(searchTerm)) ||
      log.details.toLowerCase().includes(searchTerm) ||
      format(parseISO(log.timestamp), 'PPP p').toLowerCase().includes(searchTerm)
    );
  });

  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);

  const handleRefresh = () => {
    setCurrentPage(1);
    setFilterTerm('');
    loadAuditLogs();
    toast({ title: "Audit Log Refreshed", description: "The latest changes are now displayed." });
  };

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      toast({ title: "No Data to Export", description: "There are no logs matching the current filter." });
      return;
    }
    const headers = ['Timestamp', 'Action', 'Entity Type', 'Entity ID', 'Details', 'Previous State', 'New State'];
    const rows = filteredLogs.map(log => [
      format(parseISO(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
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

  // This handles loading logs.
  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center p-4 md:p-6 lg:p-8">
        <p className="text-xl text-muted-foreground">Loading Audit Log...</p>
      </div>
    );
  }
  
  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 p-4 md:p-6 lg:p-8">
      <Card className="shadow-lg">
        <CardHeader className="border-b">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-bold">Application Audit Log</CardTitle>
              <CardDescription>History of changes made within the application.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRefresh} size="sm" disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
              <Button variant="outline" onClick={handleExport} size="sm" disabled={isLoading || filteredLogs.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter logs..."
              value={filterTerm}
              onChange={(e) => {
                setFilterTerm(e.target.value);
                setCurrentPage(1); 
              }}
              className="flex-grow p-2 border border-input rounded-md text-sm focus:ring-ring focus:outline-none focus:ring-2"
              disabled={isLoading}
            />
            {filterTerm && (
                 <Button variant="ghost" size="icon" onClick={() => { setFilterTerm(''); setCurrentPage(1); }} className="h-8 w-8" disabled={isLoading}>
                    <X className="h-4 w-4 text-muted-foreground"/>
                 </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {paginatedLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              {auditLogs.length === 0 ? "No audit log entries found." : "No logs match your filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[200px]">Action</TableHead>
                    <TableHead className="w-[120px]">Entity Type</TableHead>
                    <TableHead className="w-[150px]">Entity ID</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">{format(parseISO(log.timestamp), 'MMM d, yyyy p')}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                          {log.action.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>{log.entityType}</TableCell>
                      <TableCell className="text-xs truncate max-w-[150px]" title={log.entityId}>
                        {log.entityId || 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm">{log.details}</TableCell>
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

