
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { startOfWeek, endOfWeek, eachDayOfInterval, format, parseISO, isValid, isWithinInterval } from 'date-fns';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { calculateDailyUPH, calculateDailyUnits } from '@/lib/utils'; // Import calculation utils

interface WeeklyAveragesProps {
  allWorkLogs: DailyWorkLog[];
  targets: UPHTarget[];
  activeTarget: UPHTarget | null; // For potentially highlighting active target average
}

const WeeklyAverages: React.FC<WeeklyAveragesProps> = ({
  allWorkLogs = [],
  targets = [],
  activeTarget,
}) => {

  const weeklyAverages = useMemo(() => {
    const today = new Date();
    // Start week on Monday (1)
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    const logsThisWeek = allWorkLogs.filter(log => {
      try {
        const logDate = parseISO(log.date); // Assuming date is 'YYYY-MM-DD'
        return isValid(logDate) && isWithinInterval(logDate, { start: weekStart, end: weekEnd });
      } catch (e) {
        console.warn(`Invalid date format for log: ${log.id}, date: ${log.date}`);
        return false;
      }
    });

    if (logsThisWeek.length === 0 || targets.length === 0) {
      return [];
    }

    const averages: Array<{ target: UPHTarget; avgDocs: number; avgVideos: number; avgUnits: number; avgUPH: number; daysLogged: number }> = [];

    targets.forEach(target => {
      let totalDocs = 0;
      let totalVideos = 0;
      let totalUnits = 0;
      let totalUPHSum = 0;
      let daysWithValidUPH = 0;

      logsThisWeek.forEach(log => {
        totalDocs += log.documentsCompleted || 0;
        totalVideos += log.videoSessionsCompleted || 0;
        totalUnits += calculateDailyUnits(log, target);
        const dailyUPH = calculateDailyUPH(log, target);
        if (dailyUPH > 0) { // Only average days where UPH is calculable and positive
            totalUPHSum += dailyUPH;
            daysWithValidUPH++;
        }
      });

      const numDaysLogged = logsThisWeek.length; // Total days logged this week

      averages.push({
        target,
        avgDocs: numDaysLogged > 0 ? parseFloat((totalDocs / numDaysLogged).toFixed(2)) : 0,
        avgVideos: numDaysLogged > 0 ? parseFloat((totalVideos / numDaysLogged).toFixed(2)) : 0,
        avgUnits: numDaysLogged > 0 ? parseFloat((totalUnits / numDaysLogged).toFixed(2)) : 0,
        avgUPH: daysWithValidUPH > 0 ? parseFloat((totalUPHSum / daysWithValidUPH).toFixed(2)) : 0, // Average UPH only over days with valid UPH
        daysLogged: numDaysLogged,
      });
    });

    // Sort averages based on target order or name
    averages.sort((a, b) => a.target.name.localeCompare(b.target.name));

    return averages;

  }, [allWorkLogs, targets]);

  const weekStartDateFormatted = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d');
  const weekEndDateFormatted = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Averages</CardTitle>
        <CardDescription>
           Averages for the current work week ({weekStartDateFormatted} - {weekEndDateFormatted}). Based on days logged.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {weeklyAverages.length === 0 ? (
          <p className="text-muted-foreground">No logs or targets available for this week to calculate averages.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Target</TableHead>
                <TableHead className="text-right">Avg Docs/Day</TableHead>
                <TableHead className="text-right">Avg Videos/Day</TableHead>
                <TableHead className="text-right">Avg Units/Day</TableHead>
                <TableHead className="text-right">Avg UPH</TableHead>
                <TableHead className="text-right">Days Logged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeklyAverages.map(({ target, avgDocs, avgVideos, avgUnits, avgUPH, daysLogged }) => (
                <TableRow key={target.id} className={target.id === activeTarget?.id ? 'bg-accent/10' : ''}>
                  <TableCell className="font-medium">{target.name}</TableCell>
                  <TableCell className="text-right">{avgDocs}</TableCell>
                  <TableCell className="text-right">{avgVideos}</TableCell>
                  <TableCell className="text-right">{avgUnits}</TableCell>
                  <TableCell className="text-right">{avgUPH > 0 ? avgUPH : '-'}</TableCell>
                   <TableCell className="text-right">{daysLogged}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklyAverages;
