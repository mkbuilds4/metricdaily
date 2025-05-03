
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
import type { DailyWorkLog } from '@/types';

// Define Zod schema for validation based on the updated DailyWorkLog
const formSchema = z.object({
  date: z.date({ required_error: 'A date is required.' }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  breakDurationMinutes: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .nonnegative({ message: 'Break duration cannot be negative' })
    .int({ message: 'Break must be a whole number' }) // Ensure integer
    .default(65), // Default break: 65 minutes
  documentsCompleted: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .nonnegative({ message: 'Docs cannot be negative' })
    .int({ message: 'Docs must be a whole number' })
    .default(0),
  videoSessionsCompleted: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .nonnegative({ message: 'Videos cannot be negative' })
    .int({ message: 'Videos must be a whole number' })
    .default(0),
  notes: z.string().optional(),
}).refine(data => {
    if (!isValid(data.date)) return false;
    const startDate = parse(`${format(data.date, 'yyyy-MM-dd')} ${data.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const endDate = parse(`${format(data.date, 'yyyy-MM-dd')} ${data.endTime}`, 'yyyy-MM-dd HH:mm', new Date());
    // Allow end time to be earlier (next day)
    // const hours = calculateHoursWorked(data.date, data.startTime, data.endTime, data.breakDurationMinutes);
    // return isValid(startDate) && isValid(endDate) && hours >= 0;
     return isValid(startDate) && isValid(endDate); // Simplified check
}, {
    message: "Start or end time is invalid or date is missing.",
    path: ["endTime"], // Or maybe startTime
});


type WorkLogFormData = z.infer<typeof formSchema>;

interface WorkLogInputFormProps {
  // The client-side action function to save/update the log
  onWorkLogSaved: (workLogData: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number }) => DailyWorkLog;
  existingLog?: DailyWorkLog | null; // Pass the existing log for *today* if it exists
}

const WorkLogInputForm: React.FC<WorkLogInputFormProps> = ({ onWorkLogSaved, existingLog }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [calculatedHours, setCalculatedHours] = useState<number | null>(null);

  const isEditingToday = existingLog && existingLog.date === formatDateISO(new Date());

  const form = useForm<WorkLogFormData>({
    resolver: zodResolver(formSchema),
    // Set default values based on whether we are editing today's log or creating a new one
    defaultValues: isEditingToday && existingLog && isValid(parse(existingLog.date, 'yyyy-MM-dd', new Date())) ? {
        date: parse(existingLog.date, 'yyyy-MM-dd', new Date()),
        startTime: existingLog.startTime,
        endTime: existingLog.endTime,
        breakDurationMinutes: existingLog.breakDurationMinutes,
        documentsCompleted: existingLog.documentsCompleted,
        videoSessionsCompleted: existingLog.videoSessionsCompleted,
        notes: existingLog.notes ?? '',
    } : {
        date: new Date(), // Today's date
        startTime: '14:00', // Default start time: 2:00 PM
        endTime: '22:30', // Default end time: 10:30 PM
        breakDurationMinutes: 65, // Default break: 65 minutes
        documentsCompleted: 0,
        videoSessionsCompleted: 0,
        notes: '',
    },
  });

  const watchStartTime = form.watch('startTime');
  const watchEndTime = form.watch('endTime');
  const watchBreakMinutes = form.watch('breakDurationMinutes');
  const watchDate = form.watch('date');

  // Calculate hours worked whenever relevant fields change
  useEffect(() => {
      if (isValid(watchDate)) {
          const formattedDate = format(watchDate, 'yyyy-MM-dd');
           const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (timeRegex.test(watchStartTime) && timeRegex.test(watchEndTime) && watchBreakMinutes !== undefined && watchBreakMinutes !== null && formattedDate) {
                const hours = calculateHoursWorked(formattedDate, watchStartTime, watchEndTime, watchBreakMinutes);
                setCalculatedHours(hours);
            } else {
                 setCalculatedHours(null); // Invalid time format or missing break
            }
      } else {
          setCalculatedHours(null); // Invalid date
      }
  }, [watchStartTime, watchEndTime, watchBreakMinutes, watchDate]);


   // Update form default values IF the existingLog prop *changes*
   // This handles the case where the parent component might initially pass null, then find the log.
   useEffect(() => {
    const currentFormDate = form.getValues('date');
    const currentFormDateStr = isValid(currentFormDate) ? formatDateISO(currentFormDate) : null;

    // Only reset if the existingLog has an ID and it's different from the current form context
    // or if existingLog becomes null/undefined when we thought we were editing
    if (existingLog?.id && existingLog.id !== form.getValues('notes')?.split('::')[1]) { // Use notes hack if needed, or a hidden field
      const parsedDate = parse(existingLog.date, 'yyyy-MM-dd', new Date());
      if (isValid(parsedDate)) {
        const hours = calculateHoursWorked(existingLog.date, existingLog.startTime, existingLog.endTime, existingLog.breakDurationMinutes);
        setCalculatedHours(hours);
        form.reset({
          date: parsedDate,
          startTime: existingLog.startTime,
          endTime: existingLog.endTime,
          breakDurationMinutes: existingLog.breakDurationMinutes,
          documentsCompleted: existingLog.documentsCompleted,
          videoSessionsCompleted: existingLog.videoSessionsCompleted,
          notes: existingLog.notes ?? '', // Store ID here if needed: `${existingLog.notes ?? ''}::${existingLog.id}`
        });
      }
    } else if (!existingLog && currentFormDateStr !== formatDateISO(new Date())) {
        // If existingLog is removed *and* the form isn't already set for today, reset to today's defaults.
        // This handles clearing an edit state perhaps.
        resetToDefaults();
    }
    // Only run when existingLog changes. Avoid including form or resetToDefaults in deps.
   }, [existingLog]);

   // Function to reset form to default values for a *new* log entry (today)
   const resetToDefaults = () => {
        form.reset({
            date: new Date(),
            startTime: '14:00',
            endTime: '22:30',
            breakDurationMinutes: 65,
            documentsCompleted: 0,
            videoSessionsCompleted: 0,
            notes: '',
        });
        const defaultHours = calculateHoursWorked(formatDateISO(new Date()), '14:00', '22:30', 65);
        setCalculatedHours(defaultHours);
    };


   // Calculate initial hours when the component mounts
    useEffect(() => {
        const initialValues = form.getValues();
        if (isValid(initialValues.date)) {
            const hours = calculateHoursWorked(initialValues.date, initialValues.startTime, initialValues.endTime, initialValues.breakDurationMinutes);
            setCalculatedHours(hours);
        }
    }, []); // Run only once on mount


  // Handle form submission
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

    // Determine if we are updating today's log
    const todayDateStr = formatDateISO(new Date());
    const isUpdatingLog = existingLog && existingLog.date === formattedDate; // Check if editing today's log

    // Prepare data payload for the action function
    const payloadToSave: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number } = {
        ...(isUpdatingLog && existingLog?.id && { id: existingLog.id }), // Include ID only if updating the passed existingLog
        date: formattedDate,
        startTime: values.startTime,
        endTime: values.endTime,
        breakDurationMinutes: values.breakDurationMinutes,
        hoursWorked: hoursWorked,
        documentsCompleted: values.documentsCompleted,
        videoSessionsCompleted: values.videoSessionsCompleted,
        notes: values.notes || '', // Ensure notes is a string
    };

    try {
      // --- Call Client-Side Action ---
      const savedLog = onWorkLogSaved(payloadToSave); // Parent component handles state update/re-fetch

      toast({
        title: "Work Log Saved",
        description: `Entry for ${formattedDate} has been ${isUpdatingLog ? 'updated' : 'added/updated'}.`,
      });

      // Reset form only if a *new* log was added for a *different* day
      // If we just updated today's log, keep the form populated
       if (!isUpdatingLog && formattedDate !== todayDateStr) {
           resetToDefaults(); // Reset to today's defaults for the next entry
       } else if (isUpdatingLog) {
           // If we updated today's log, recalculate hours just in case something odd happened
           const updatedHours = calculateHoursWorked(savedLog.date, savedLog.startTime, savedLog.endTime, savedLog.breakDurationMinutes);
            setCalculatedHours(updatedHours);
            // Keep form populated with the updated data
            form.reset(values); // Reset with the submitted values to ensure sync
       } else if (formattedDate === todayDateStr) {
            // If we added/updated today's log (but didn't start by editing it via prop)
             const updatedHours = calculateHoursWorked(savedLog.date, savedLog.startTime, savedLog.endTime, savedLog.breakDurationMinutes);
             setCalculatedHours(updatedHours);
              form.reset(values); // Keep form populated
       }


    } catch (error) {
      console.error("Failed to save work log:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Could not save the work log.",
      });
      // Keep form populated on error for correction
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
         {/* Dynamically change title based on whether editing today's log */}
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
                                'w-full justify-start text-left font-normal', // Use justify-start
                                !field.value && 'text-muted-foreground'
                            )}
                            >
                             <CalendarIcon className="mr-2 h-4 w-4" /> {/* Icon on the left */}
                            {field.value && isValid(field.value) ? (
                                format(field.value, 'PPP') // e.g., Oct 26, 2023
                            ) : (
                                <span>Pick a date</span>
                            )}
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                                field.onChange(date);
                                // Potentially reset time/docs/etc if date changes? Optional.
                            }}
                            disabled={(date) =>
                            date > new Date() || date < new Date('2023-01-01') // Adjust range as needed
                            }
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


            {/* Grid for time and break inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 {/* Start Time */}
                <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Start Time (HH:mm)</FormLabel>
                    <FormControl>
                       <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 {/* End Time */}
                 <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>End Time (HH:mm)</FormLabel>
                    <FormControl>
                       <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 {/* Break Duration */}
                 <FormField
                control={form.control}
                name="breakDurationMinutes"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Break (Minutes)</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="e.g., 65" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} min="0" step="1" />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>


            {/* Grid for work completed inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Documents Completed */}
                <FormField
                control={form.control}
                name="documentsCompleted"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Documents Completed</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="0" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} min="0" />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

                {/* Video Sessions Completed */}
                <FormField
                control={form.control}
                name="videoSessionsCompleted"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Video Sessions Completed</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="0" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} min="0" />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>


            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any relevant notes..." {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

             <div className="flex space-x-2">
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : (isEditingToday ? 'Update Log' : 'Save Log')}
                </Button>
                {/* Button to reset to the component's default values for today */}
                {/* Show reset only if not currently editing today's log OR if form date is not today */}
                 {(!isEditingToday || formatDateISO(watchDate) !== formatDateISO(new Date())) && (
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
