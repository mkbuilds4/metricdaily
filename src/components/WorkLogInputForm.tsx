
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parse, isValid } from 'date-fns';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn, calculateHoursWorked, formatDateISO } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import type { DailyWorkLog, UPHTarget } from '@/types';
import { getActiveUPHTarget } from '@/lib/actions'; // Import function to get active target

// Schema now includes targetId (optional, as it's determined at save time)
const formSchema = z.object({
  date: z.date({ required_error: 'A date is required.' }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  breakDurationMinutes: z.coerce.number().nonnegative().int().default(65),
  documentsCompleted: z.coerce.number().nonnegative().int().default(0),
  videoSessionsCompleted: z.coerce.number().nonnegative().int().default(0),
  notes: z.string().optional(),
  targetId: z.string().optional(), // Include targetId, but it's not user-input
}).refine(data => {
    if (!isValid(data.date)) return false;
    const startDate = parse(`${format(data.date, 'yyyy-MM-dd')} ${data.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const endDate = parse(`${format(data.date, 'yyyy-MM-dd')} ${data.endTime}`, 'yyyy-MM-dd HH:mm', new Date());
     return isValid(startDate) && isValid(endDate);
}, {
    message: "Start or end time is invalid or date is missing.",
    path: ["endTime"],
});

type WorkLogFormData = z.infer<typeof formSchema>;

interface WorkLogInputFormProps {
  onWorkLogSaved: (workLogData: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number }) => DailyWorkLog;
  existingLog?: DailyWorkLog | null;
}

const WorkLogInputForm: React.FC<WorkLogInputFormProps> = ({ onWorkLogSaved, existingLog }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [calculatedHours, setCalculatedHours] = useState<number | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [activeTargetId, setActiveTargetId] = useState<string | undefined>(undefined); // State for active target ID

  useEffect(() => {
    setIsClient(true);
    // Fetch active target ID on mount
    const target = getActiveUPHTarget();
    setActiveTargetId(target?.id);
  }, []);

  const isEditingToday = existingLog && existingLog.date === formatDateISO(new Date());

  const form = useForm<WorkLogFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: existingLog && isEditingToday && isValid(parse(existingLog.date, 'yyyy-MM-dd', new Date())) ? {
        date: parse(existingLog.date, 'yyyy-MM-dd', new Date()),
        startTime: existingLog.startTime,
        endTime: existingLog.endTime,
        breakDurationMinutes: existingLog.breakDurationMinutes,
        documentsCompleted: existingLog.documentsCompleted,
        videoSessionsCompleted: existingLog.videoSessionsCompleted,
        notes: existingLog.notes ?? '',
        targetId: existingLog.targetId, // Keep existing targetId if editing
    } : {
        date: isClient ? new Date() : undefined, // Set date only on client
        startTime: '14:00',
        endTime: '22:30',
        breakDurationMinutes: 65,
        documentsCompleted: 0,
        videoSessionsCompleted: 0,
        notes: '',
        targetId: undefined, // No target ID for new log initially
    },
  });

   // Update form defaults if existingLog changes or becomes available after mount
   useEffect(() => {
    if (existingLog && isEditingToday) {
        const parsedDate = parse(existingLog.date, 'yyyy-MM-dd', new Date());
        if (isValid(parsedDate)) {
            form.reset({
                date: parsedDate,
                startTime: existingLog.startTime,
                endTime: existingLog.endTime,
                breakDurationMinutes: existingLog.breakDurationMinutes,
                documentsCompleted: existingLog.documentsCompleted,
                videoSessionsCompleted: existingLog.videoSessionsCompleted,
                notes: existingLog.notes ?? '',
                targetId: existingLog.targetId, // Important: use the log's own targetId
            });
            const hours = calculateHoursWorked(existingLog.date, existingLog.startTime, existingLog.endTime, existingLog.breakDurationMinutes);
            setCalculatedHours(hours);
        }
    } else if (!existingLog) {
        // Optionally reset to defaults if the log being edited is removed
        // resetToDefaults(); // Be cautious with this to avoid unwanted resets
    }
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [existingLog]);


    // Handle client-side hydration and initial calculation
   useEffect(() => {
        if (isClient && !form.getValues('date')) {
             form.setValue('date', new Date(), { shouldDirty: false, shouldValidate: false });
        }
        const initialValues = form.getValues();
        if (isValid(initialValues.date)) {
            const hours = calculateHoursWorked(initialValues.date, initialValues.startTime, initialValues.endTime, initialValues.breakDurationMinutes);
            setCalculatedHours(hours);
        }
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isClient]);


  const watchStartTime = form.watch('startTime');
  const watchEndTime = form.watch('endTime');
  const watchBreakMinutes = form.watch('breakDurationMinutes');
  const watchDate = form.watch('date');

  useEffect(() => {
      if (isValid(watchDate)) {
          const formattedDate = format(watchDate, 'yyyy-MM-dd');
           const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (timeRegex.test(watchStartTime) && timeRegex.test(watchEndTime) && watchBreakMinutes !== undefined && watchBreakMinutes !== null && formattedDate) {
                const hours = calculateHoursWorked(formattedDate, watchStartTime, watchEndTime, watchBreakMinutes);
                setCalculatedHours(hours);
            } else {
                 setCalculatedHours(null);
            }
      } else {
          setCalculatedHours(null);
      }
  }, [watchStartTime, watchEndTime, watchBreakMinutes, watchDate]);

   const resetToDefaults = () => {
        const today = new Date();
        form.reset({
            date: today,
            startTime: '14:00',
            endTime: '22:30',
            breakDurationMinutes: 65,
            documentsCompleted: 0,
            videoSessionsCompleted: 0,
            notes: '',
            targetId: activeTargetId, // Reset with current active target ID
        });
        const defaultHours = calculateHoursWorked(formatDateISO(today), '14:00', '22:30', 65);
        setCalculatedHours(defaultHours);
    };


  const onSubmit = (values: WorkLogFormData) => {
    setIsLoading(true);
    if (!isValid(values.date)) {
        toast({ variant: "destructive", title: "Invalid Date", description: "Please select a valid date." });
        setIsLoading(false);
        return;
    }

    const formattedDate = format(values.date, 'yyyy-MM-dd');
    const hoursWorked = calculateHoursWorked(formattedDate, values.startTime, values.endTime, values.breakDurationMinutes);

     if (hoursWorked === null || isNaN(hoursWorked) || hoursWorked < 0) {
        toast({ variant: "destructive", title: "Invalid Times", description: "Calculated hours worked is invalid. Check start/end times and break." });
        setIsLoading(false);
        return;
    }

    const isUpdatingLog = existingLog && existingLog.id === form.getValues('notes')?.split('::')[1]; // A way to track if editing

    // Determine the target ID to save:
    // If editing, keep the original targetId unless it was somehow cleared.
    // If adding new, use the currently active target ID fetched earlier.
    const targetIdToSave = isUpdatingLog ? (existingLog?.targetId ?? activeTargetId) : activeTargetId;

    if (!targetIdToSave && !isUpdatingLog) {
        toast({ variant: "destructive", title: "No Active Target", description: "Cannot save log. No active UPH target found. Please set one." });
        setIsLoading(false);
        return;
    }


    const payloadToSave: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number } = {
        ...(isUpdatingLog && existingLog?.id && { id: existingLog.id }),
        date: formattedDate,
        startTime: values.startTime,
        endTime: values.endTime,
        breakDurationMinutes: values.breakDurationMinutes,
        hoursWorked: hoursWorked,
        documentsCompleted: values.documentsCompleted,
        videoSessionsCompleted: values.videoSessionsCompleted,
        targetId: targetIdToSave, // ** Store the determined target ID **
        notes: values.notes || '',
    };

    try {
      const savedLog = onWorkLogSaved(payloadToSave);

      toast({
        title: "Work Log Saved",
        description: `Entry for ${formattedDate} has been ${isUpdatingLog ? 'updated' : 'added/updated'}.`,
      });

       // Keep form populated if editing today, otherwise reset to today's defaults
       if (savedLog.date === formatDateISO(new Date())) {
           // Re-calculate hours after save might change data
           const updatedHours = calculateHoursWorked(savedLog.date, savedLog.startTime, savedLog.endTime, savedLog.breakDurationMinutes);
            setCalculatedHours(updatedHours);
            // Reset form with the *saved* data to ensure sync, including targetId
            form.reset({
                ...values, // Keep submitted values
                targetId: savedLog.targetId, // Use the actually saved targetId
                date: parse(savedLog.date, 'yyyy-MM-dd', new Date()), // Ensure date is Date object
            });
       } else {
           resetToDefaults(); // Reset to today's defaults for next entry
       }

    } catch (error) {
      console.error("Failed to save work log:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Could not save the work log.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isClient) {
     // Render placeholder or skeleton while waiting for client mount
     return (
         <Card>
             <CardHeader><CardTitle>Loading Form...</CardTitle></CardHeader>
             <CardContent className="space-y-6">
                 {/* Add Skeleton loaders here */}
             </CardContent>
         </Card>
     );
  }


  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditingToday ? 'Update Today\'s Work Log' : 'Add/Update Work Log'}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date Picker */}
                <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={'outline'}
                            className={cn(
                                'w-full justify-start text-left font-normal',
                                !field.value && 'text-muted-foreground'
                            )}
                            >
                             <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value && isValid(field.value) ? format(field.value, 'PPP') : <span>Pick a date</span>}
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => field.onChange(date)}
                            disabled={(date) => date > new Date() || date < new Date('2023-01-01')}
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 {/* Calculated Hours Display */}
                 <div className="flex flex-col justify-end pb-1">
                    <FormLabel>Calculated Hours</FormLabel>
                    <div className="h-10 px-3 py-2 text-sm font-medium text-muted-foreground border border-input rounded-md bg-muted">
                        {(calculatedHours !== null && !isNaN(calculatedHours))
                          ? `${calculatedHours.toFixed(2)} hrs`
                          : 'Enter times & break'}
                    </div>
                 </div>
            </div>

            {/* Time and Break Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="startTime" render={({ field }) => (
                    <FormItem> <FormLabel>Start Time (HH:mm)</FormLabel> <FormControl><Input type="time" {...field} /></FormControl> <FormMessage /> </FormItem>
                )}/>
                 <FormField control={form.control} name="endTime" render={({ field }) => (
                    <FormItem> <FormLabel>End Time (HH:mm)</FormLabel> <FormControl><Input type="time" {...field} /></FormControl> <FormMessage /> </FormItem>
                )}/>
                 <FormField control={form.control} name="breakDurationMinutes" render={({ field }) => (
                    <FormItem> <FormLabel>Break (Minutes)</FormLabel> <FormControl><Input type="number" placeholder="e.g., 65" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} min="0" step="1" /></FormControl> <FormMessage /> </FormItem>
                )}/>
            </div>

            {/* Work Completed Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="documentsCompleted" render={({ field }) => (
                    <FormItem> <FormLabel>Documents Completed</FormLabel> <FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} min="0" /></FormControl> <FormMessage /> </FormItem>
                )}/>
                <FormField control={form.control} name="videoSessionsCompleted" render={({ field }) => (
                    <FormItem> <FormLabel>Video Sessions Completed</FormLabel> <FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} min="0" /></FormControl> <FormMessage /> </FormItem>
                )}/>
            </div>

            {/* Notes */}
            <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem> <FormLabel>Notes (Optional)</FormLabel> <FormControl><Textarea placeholder="Any relevant notes..." {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem>
            )}/>

             <div className="flex space-x-2">
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : (isEditingToday ? 'Update Log' : 'Save Log')}
                </Button>
                {/* Reset button only shown if form date is not today, or if not editing */}
                 {(!isEditingToday || (isValid(watchDate) && formatDateISO(watchDate) !== formatDateISO(new Date())) || !isValid(watchDate) ) && (
                    <Button type="button" variant="outline" onClick={resetToDefaults} className="ml-2" disabled={isLoading}>
                        Reset to Today's Defaults
                    </Button>
                )}
             </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default WorkLogInputForm;
