
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { calculateCurrentMetrics, calculateRequiredUnitsForTarget } from '@/lib/utils';
import { format } from 'date-fns';

interface DailyUPHChartProps {
  todayLog: DailyWorkLog | null;
  activeTarget: UPHTarget | null;
}

const DailyUPHChart: React.FC<DailyUPHChartProps> = ({ todayLog, activeTarget }) => {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    // Defer setting current time until client-side mount
    setCurrentTime(new Date());
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timerId);
  }, []);

  const chartData = useMemo(() => {
    if (!todayLog || !activeTarget || !currentTime) {
      return [];
    }

    const { currentUnits, currentUPH } = calculateCurrentMetrics(todayLog, activeTarget, currentTime);
    const targetUnits = calculateRequiredUnitsForTarget(todayLog.hoursWorked, activeTarget.targetUPH);
    const targetUPH = activeTarget.targetUPH;

    return [
      { name: 'Current', units: currentUnits, uph: currentUPH, targetUnits: targetUnits, targetUPH: targetUPH },
    ];
  }, [todayLog, activeTarget, currentTime]);

  if (!todayLog || !activeTarget || !currentTime) {
    return (
        <Card>
             <CardHeader>
                <CardTitle>Today's UPH Progress</CardTitle>
                <CardDescription>No data available yet.</CardDescription>
             </CardHeader>
             <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground">
                 Waiting for log and target data...
             </CardContent>
        </Card>
    );
  }

  const chartConfig = {
    uph: {
      label: 'Current UPH',
      color: 'hsl(var(--chart-1))',
    },
    targetUPH: {
      label: `Target UPH (${activeTarget.targetUPH.toFixed(1)})`,
      color: 'hsl(var(--chart-2))', // Use a different color
    },
  } satisfies import('@/components/ui/chart').ChartConfig;

  // Determine max Y-axis value based on current and target UPH, add some padding
  const maxYAxisValue = Math.ceil(Math.max(chartData[0]?.uph || 0, chartData[0]?.targetUPH || 0) * 1.2);


  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's UPH Progress</CardTitle>
        <CardDescription>Comparing current UPH against your target for {format(currentTime, 'MMM d')}.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 10, left: -20, bottom: 0 }} // Adjust margins
              barGap={4} // Reduce gap between bars if needed
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={false} // Hide the 'Current' label on X-axis
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                domain={[0, maxYAxisValue > 0 ? maxYAxisValue : 10]} // Ensure domain starts at 0 and handles 0 values
                 tickFormatter={(value) => `${value}`} // Format Y-axis ticks as needed
              />
              <ChartTooltip
                 cursor={false}
                 content={<ChartTooltipContent indicator="dot" />}
              />
              <Bar dataKey="uph" fill="var(--color-uph)" radius={4}>
                 <LabelList
                    position="top"
                    offset={8} // Adjust label position
                    className="fill-foreground text-xs"
                    formatter={(value: number) => value.toFixed(2)}
                 />
              </Bar>
               {/* Add a bar for the target UPH */}
              <Bar dataKey="targetUPH" fill="var(--color-targetUPH)" radius={4}>
                 <LabelList
                    position="top"
                    offset={8}
                     className="fill-foreground text-xs"
                    formatter={(value: number) => value.toFixed(1)}
                 />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default DailyUPHChart;

