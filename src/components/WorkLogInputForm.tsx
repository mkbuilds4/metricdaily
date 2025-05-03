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
import { cn, calculateHoursWorked } from '@/lib/utils';
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
    .default(0),
  documentsCompleted: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .nonnegative({ message: 'Docs cannot be negative' })
    .default(0),
  videoSessionsCompleted: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .nonnegative({ message: 'Videos cannot be negative' })
    .default(0),
  notes: z.string().optional(),
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
  // The client-side action function to save/update the log
  onWorkLogSaved: (workLogData: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number }) => DailyWorkLog;
  existingLog?: DailyWorkLog | null; // For editing (passed from parent if edit feature exists)
}

const WorkLogInputForm: React.FC<WorkLogInputFormProps> = ({ onWorkLogSaved, existingLog }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [calculatedHours, setCalculatedHours] = useState<number | null>(null);

  const form = useForm<WorkLogFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        date: new Date(),
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
            if (timeRegex.test(watchStartTime) && timeRegex.test(watchEndTime) && watchBreakMinutes !== undefined && formattedDate) {
                const hours = calculateHoursWorked(formattedDate, watchStartTime, watchEndTime, watchBreakMinutes);
                setCalculatedHours(hours);
            } else {
                 setCalculatedHours(null);
            }
      } else {
          setCalculatedHours(null);
      }
  }, [watchStartTime, watchEndTime, watchBreakMinutes, watchDate]);


   // Update form default values if existingLog changes or on initial load
   useEffect(() => {
    if (existingLog) {
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
          notes: existingLog.notes ?? '',
        });
      } else {
         setCalculatedHours(null);
         form.reset({
            date: new Date(), // Fallback to today if parse fails
            startTime: existingLog.startTime,
            endTime: existingLog.endTime,
            breakDurationMinutes: existingLog.breakDurationMinutes,
            documentsCompleted: existingLog.documentsCompleted,
            videoSessionsCompleted: existingLog.videoSessionsCompleted,
            notes: existingLog.notes ?? '',
         });
      }
    } else {
       // Reset form for adding a new log if existingLog becomes null/undefined
       setCalculatedHours(null);
       // Reset to the defined default values
       form.reset({
        date: new Date(),
        startTime: '14:00',
        endTime: '22:30',
        breakDurationMinutes: 65,
        documentsCompleted: 0,
        videoSessionsCompleted: 0,
        notes: '',
      });
    }
    // Note: Not including form in dependencies to avoid potential loops if form instance changes unexpectedly.
    // Relying on existingLog changing is usually sufficient.
   }, [existingLog, form.reset]); // Added form.reset to dependency array

   // Calculate initial hours when the component mounts with default values
   useEffect(() => {
        const defaultValues = form.getValues();
        if (isValid(defaultValues.date)) {
            const formattedDate = format(defaultValues.date, 'yyyy-MM-dd');
            const hours = calculateHoursWorked(formattedDate, defaultValues.startTime, defaultValues.endTime, defaultValues.breakDurationMinutes);
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

    // Allow saving even if hoursWorked is 0, as user might just be logging time/break
    // if (hoursWorked <= 0 && (values.documentsCompleted > 0 || values.videoSessionsCompleted > 0)) {
    //     toast({ variant: "destructive", title: "Invalid Time Entry", description: "Calculated hours worked is zero or negative. Please check start time, end time, and break duration." });
    //     setIsLoading(false);
    //     return;
    // }

    // Prepare data payload for the action function
    const payloadToSave: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number } = {
        ...(existingLog?.id && { id: existingLog.id }), // Include ID only if editing
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
        description: `Entry for ${formattedDate} has been ${existingLog ? 'updated' : 'added'}.`,
      });

      // Reset form after successful save, unless it was an edit
      if (!existingLog) {
        form.reset({ // Reset to default values
            date: new Date(),
            startTime: '14:00',
            endTime: '22:30',
            breakDurationMinutes: 65,
            documentsCompleted: 0,
            videoSessionsCompleted: 0,
            notes: '',
        });
         // Recalculate hours for the new default times
        const defaultHours = calculateHoursWorked(format(new Date(), 'yyyy-MM-dd'), '14:00', '22:30', 65);
        setCalculatedHours(defaultHours);
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
        <CardTitle>{existingLog ? 'Edit Work Log' : 'Add New Work Log'}</CardTitle>
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
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                            )}
                            >
                            {field.value && isValid(field.value) ? (
                                format(field.value, 'PPP')
                            ) : (
                                <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                            date > new Date() || date < new Date('1900-01-01')
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
                        {calculatedHours !== null ? `${calculatedHours.toFixed(2)} hrs` : 'Enter times & break'}
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
                        {/* Ensure value passed is never undefined */}
                        <Input type="number" placeholder="e.g., 30" {...field} value={field.value ?? 0} onChange={field.onChange} min="0" step="1" />
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
                         {/* Ensure value passed is never undefined */}
                        <Input type="number" placeholder="0" {...field} value={field.value ?? 0} onChange={field.onChange} min="0" />
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
                         {/* Ensure value passed is never undefined */}
                        <Input type="number" placeholder="0" {...field} value={field.value ?? 0} onChange={field.onChange} min="0" />
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
                    {isLoading ? 'Saving...' : (existingLog ? 'Update Log' : 'Add Log')}
                </Button>
                {/* Optional: Add a button to clear/reset or cancel edit */}
                {existingLog && (
                    <Button type="button" variant="outline" onClick={() => {
                        // Reset form to the original existingLog data
                        if (existingLog) {
                             const parsedDate = parse(existingLog.date, 'yyyy-MM-dd', new Date());
                             if(isValid(parsedDate)) {
                                form.reset({
                                    date: parsedDate,
                                    startTime: existingLog.startTime,
                                    endTime: existingLog.endTime,
                                    breakDurationMinutes: existingLog.breakDurationMinutes,
                                    documentsCompleted: existingLog.documentsCompleted,
                                    videoSessionsCompleted: existingLog.videoSessionsCompleted,
                                    notes: existingLog.notes ?? '',
                                });
                                setCalculatedHours(existingLog.hoursWorked);
                             }
                        }
                    }} className="ml-2" disabled={isLoading}>
                        Cancel Edit
                    </Button>
                )}
                {/* Button to reset to the component's default values */}
                {!existingLog && (
                    <Button type="button" variant="outline" onClick={() => {
                        form.reset({
                            date: new Date(),
                            startTime: '14:00',
                            endTime: '22:30',
                            breakDurationMinutes: 65,
                            documentsCompleted: 0,
                            videoSessionsCompleted: 0,
                            notes: '',
                        });
                        const defaultHours = calculateHoursWorked(format(new Date(), 'yyyy-MM-dd'), '14:00', '22:30', 65);
                        setCalculatedHours(defaultHours);
                    }} className="ml-2" disabled={isLoading}>
                        Reset Defaults
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
