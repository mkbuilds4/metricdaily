'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parse, isValid } from 'date-fns'; // Use date-fns for reliable date formatting

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
import { cn, calculateHoursWorked } from '@/lib/utils'; // Import calculateHoursWorked
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
  documentsCompleted: z.coerce // coerce converts string input to number
    .number({ invalid_type_error: 'Must be a number' })
    .nonnegative({ message: 'Docs cannot be negative' })
    .default(0),
  videoSessionsCompleted: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .nonnegative({ message: 'Videos cannot be negative' })
    .default(0),
  notes: z.string().optional(),
}).refine(data => {
    // Basic validation: end time should logically be after start time (simple check)
    // More complex validation (crossing midnight) is handled in calculateHoursWorked
    // Ensure date is valid before attempting to parse times with it
    if (!isValid(data.date)) return false;
    const startDate = parse(`${format(data.date, 'yyyy-MM-dd')} ${data.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const endDate = parse(`${format(data.date, 'yyyy-MM-dd')} ${data.endTime}`, 'yyyy-MM-dd HH:mm', new Date());
    return isValid(startDate) && isValid(endDate); // Ensure dates are valid before comparison logic
    // We let calculateHoursWorked handle the overnight logic, just check parsing here
}, {
    message: "Start or end time is invalid or date is missing.",
    path: ["endTime"], // Attach error to endTime field for simplicity
});


type WorkLogFormData = z.infer<typeof formSchema>;

interface WorkLogInputFormProps {
  // The server action to save/update the log
  onWorkLogSaved: (workLogData: DailyWorkLog) => Promise<DailyWorkLog>; // Expects the full log with ID
  // Optional prop to signal UI update for dashboard (if not handled by revalidation)
  onOptimisticUpdate?: (updatedLog: DailyWorkLog | null, action: 'add' | 'update' | 'delete' | 'revert', previousLog?: DailyWorkLog | null) => void;
  existingLog?: DailyWorkLog | null; // For editing
}

const WorkLogInputForm: React.FC<WorkLogInputFormProps> = ({ onWorkLogSaved, onOptimisticUpdate, existingLog }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  // Local state for calculated hours, initialized based on existingLog
  const [calculatedHours, setCalculatedHours] = useState<number | null>(
     existingLog && isValid(parse(existingLog.date, 'yyyy-MM-dd', new Date()))
       ? calculateHoursWorked(existingLog.date, existingLog.startTime, existingLog.endTime, existingLog.breakDurationMinutes)
       : null
  );

  const form = useForm<WorkLogFormData>({
    resolver: zodResolver(formSchema),
    // Initialize defaultValues inside useEffect to handle existingLog correctly
    defaultValues: {
        date: new Date(),
        startTime: '',
        endTime: '',
        breakDurationMinutes: 0,
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
      // Check if watchDate is a valid Date object before formatting
      if (isValid(watchDate)) {
          const formattedDate = format(watchDate, 'yyyy-MM-dd');
          // Make sure times are valid HH:mm strings before calculating
           const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (timeRegex.test(watchStartTime) && timeRegex.test(watchEndTime) && watchBreakMinutes !== undefined && formattedDate) {
                const hours = calculateHoursWorked(formattedDate, watchStartTime, watchEndTime, watchBreakMinutes);
                setCalculatedHours(hours);
            } else {
                 setCalculatedHours(null); // Reset if times are incomplete/invalid
            }
      } else {
          setCalculatedHours(null); // Reset if date is invalid
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
         // Handle case where existingLog.date is invalid
         setCalculatedHours(null);
         form.reset({
            date: new Date(), // Default to today if existing date is bad
            startTime: existingLog.startTime,
            endTime: existingLog.endTime,
            breakDurationMinutes: existingLog.breakDurationMinutes,
            documentsCompleted: existingLog.documentsCompleted,
            videoSessionsCompleted: existingLog.videoSessionsCompleted,
            notes: existingLog.notes ?? '',
         });
      }
    } else {
       // Reset form for adding a new log
       setCalculatedHours(null);
       form.reset({
        date: new Date(),
        startTime: '',
        endTime: '',
        breakDurationMinutes: 0,
        documentsCompleted: 0,
        videoSessionsCompleted: 0,
        notes: '',
      });
    }
   }, [existingLog, form]); // Rerun when existingLog or form instance changes


  // Handle form submission with optimistic updates
  const onSubmit = async (values: WorkLogFormData) => {
    setIsLoading(true);
    // Ensure date is valid before proceeding
    if (!isValid(values.date)) {
        toast({ variant: "destructive", title: "Invalid Date", description: "Please select a valid date." });
        setIsLoading(false);
        return;
    }

    const formattedDate = format(values.date, 'yyyy-MM-dd');
    const hoursWorked = calculateHoursWorked(formattedDate, values.startTime, values.endTime, values.breakDurationMinutes);

    if (hoursWorked <= 0 && (values.documentsCompleted > 0 || values.videoSessionsCompleted > 0)) {
        toast({ variant: "destructive", title: "Invalid Time Entry", description: "Calculated hours worked is zero or negative. Please check start time, end time, and break duration." });
        setIsLoading(false);
        return;
    }

    // Prepare optimistic data (use existing ID or a temporary one)
    const optimisticId = existingLog?.id || `temp-${Date.now()}`;
    const optimisticLogData: DailyWorkLog = {
        ...values,
        id: optimisticId,
        date: formattedDate,
        hoursWorked: hoursWorked,
        notes: values.notes || '', // Ensure notes is a string
    };

    // Store previous state for potential rollback (only needed if editing)
    const previousLogState = existingLog ? { ...existingLog } : null;

    // --- Optimistic UI Update ---
    if (onOptimisticUpdate) {
       onOptimisticUpdate(optimisticLogData, existingLog ? 'update' : 'add', previousLogState ?? undefined);
    }

    // If not editing, reset the form optimistically *after* capturing values
    if (!existingLog) {
        setCalculatedHours(null);
        form.reset({
            date: new Date(), // Reset to today's date
            startTime: '',
            endTime: '',
            breakDurationMinutes: 0,
            documentsCompleted: 0,
            videoSessionsCompleted: 0,
            notes: '',
        });
    }


    try {
       // --- Call Server Action ---
      // Pass the full object, including the ID if it exists (for update)
      // Or the object without ID for add (server will generate one)
      const payloadToServer = existingLog
            ? { ...optimisticLogData, id: existingLog.id } // Ensure correct ID for update
            : { // Omit ID for add
                date: formattedDate,
                startTime: values.startTime,
                endTime: values.endTime,
                breakDurationMinutes: values.breakDurationMinutes,
                hoursWorked: hoursWorked,
                documentsCompleted: values.documentsCompleted,
                videoSessionsCompleted: values.videoSessionsCompleted,
                notes: values.notes,
            };

      const savedLog = await onWorkLogSaved(payloadToServer as DailyWorkLog); // Cast based on context

      // --- Update UI with actual data from server (if needed, e.g., replacing temp ID) ---
       if (!existingLog && onOptimisticUpdate) {
           // If adding, replace the temporary log with the one returned by the server (with the real ID)
           onOptimisticUpdate(savedLog, 'update', optimisticLogData); // Treat replacement as an update
       }
        // If editing, the server action revalidates, props will update eventually. Optimistic update already happened.


      toast({
        title: "Work Log Saved",
        description: `Entry for ${formattedDate} has been ${existingLog ? 'updated' : 'added'}.`,
      });

    } catch (error) {
      console.error("Failed to save work log:", error);
        // --- Rollback Optimistic Update ---
        if (onOptimisticUpdate) {
            if (existingLog && previousLogState) {
                // Rollback edit: update the item back to its previous state
                onOptimisticUpdate(previousLogState, 'update', optimisticLogData);
            } else {
                 // Rollback add: remove the temporary item
                 onOptimisticUpdate(optimisticLogData, 'delete'); // Signal deletion of the optimistic item
            }
             // Reset form back to the state before submission attempt if it was an edit failure
             if (existingLog && previousLogState) {
                 const parsedDate = parse(previousLogState.date, 'yyyy-MM-dd', new Date());
                 if (isValid(parsedDate)) {
                    form.reset({
                        date: parsedDate,
                        startTime: previousLogState.startTime,
                        endTime: previousLogState.endTime,
                        breakDurationMinutes: previousLogState.breakDurationMinutes,
                        documentsCompleted: previousLogState.documentsCompleted,
                        videoSessionsCompleted: previousLogState.videoSessionsCompleted,
                        notes: previousLogState.notes ?? '',
                    });
                    setCalculatedHours(previousLogState.hoursWorked);
                 }
             }
        }
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Could not save the work log.",
      });
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
                                format(field.value, 'PPP') // Pretty date format
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
                        <Input type="number" placeholder="e.g., 30" {...field} min="0" step="1" />
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
                        <Input type="number" placeholder="0" {...field} min="0" />
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
                        <Input type="number" placeholder="0" {...field} min="0" />
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
             </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default WorkLogInputForm;
