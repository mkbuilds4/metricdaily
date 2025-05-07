

'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import type { DailyWorkLog, UserSettings } from '@/types';
import { getActiveUPHTarget, getDefaultSettings } from '@/lib/actions'; // Import getDefaultSettings

// Schema now includes targetId and trainingDurationMinutes
const formSchema = z.object({
  date: z.date({ required_error: 'A date is required.' }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  breakDurationMinutes: z.coerce.number().nonnegative().int().default(0), // Default break to 0
  trainingDurationMinutes: z.coerce.number().nonnegative().int().optional().default(0), // Optional training time, default 0
  documentsCompleted: z.coerce.number().nonnegative().int().default(0),
  videoSessionsCompleted: z.coerce.number().nonnegative().int().default(0),
  notes: z.string().optional(),
  targetId: z.string().optional(),
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
  const [activeTargetId, setActiveTargetId] = useState<string | undefined>(undefined);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null); // Store settings

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
        const target = getActiveUPHTarget();
        setActiveTargetId(target?.id);
        const settings = getDefaultSettings(); // Fetch settings
        setUserSettings(settings);
    }
  }, []);

  const isEditingToday = existingLog && existingLog.date === formatDateISO(new Date());

  const form = useForm<WorkLogFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        date: undefined,
        startTime: '', // Initialize empty, will be set by useEffect
        endTime: '',   // Initialize empty
        breakDurationMinutes: 0, // Default to 0
        trainingDurationMinutes: 0, // Default to 0
        documentsCompleted: 0,
        videoSessionsCompleted: 0,
        notes: '',
        targetId: undefined,
    },
  });

   // Effect to set initial form values based on existing log or settings
   useEffect(() => {
    if (!isClient || !userSettings) return; // Wait for client and settings

    if (existingLog && isEditingToday) {
        const parsedDate = parse(existingLog.date, 'yyyy-MM-dd', new Date());
        if (isValid(parsedDate)) {
            form.reset({
                date: parsedDate,
                startTime: existingLog.startTime,
                endTime: existingLog.endTime,
                breakDurationMinutes: existingLog.breakDurationMinutes,
                trainingDurationMinutes: existingLog.trainingDurationMinutes || 0,
                documentsCompleted: existingLog.documentsCompleted,
                videoSessionsCompleted: existingLog.videoSessionsCompleted,
                notes: existingLog.notes ?? '',
                targetId: existingLog.targetId ?? activeTargetId, // Use existing log's target or active
            });
            const totalNonWorkMinutes = (existingLog.breakDurationMinutes || 0) + (existingLog.trainingDurationMinutes || 0);
            const hours = calculateHoursWorked(existingLog.date, existingLog.startTime, existingLog.endTime, totalNonWorkMinutes);
            setCalculatedHours(hours);
        }
    } else {
        // Not editing today's log, or no existing log provided, use defaults
        resetToDefaults(userSettings);
    }
   // Run when client, settings, or existingLog changes
   }, [existingLog, isClient, userSettings, activeTargetId, form]); // Added form to dependency array


   // Effect to set today's date initially if no date is present
   useEffect(() => {
        if (isClient) {
            if (!form.getValues('date')) {
                 form.setValue('date', new Date(), { shouldDirty: false, shouldValidate: false });
            }
            // Recalculate hours on mount after potentially setting date
            const initialValues = form.getValues();
            if (isValid(initialValues.date) && initialValues.startTime && initialValues.endTime) {
                const totalNonWorkMinutes = (initialValues.breakDurationMinutes || 0) + (initialValues.trainingDurationMinutes || 0);
                const hours = calculateHoursWorked(initialValues.date, initialValues.startTime, initialValues.endTime, totalNonWorkMinutes);
                setCalculatedHours(hours);
            }
        }
   // Run only once on client mount
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isClient]);


  const watchStartTime = form.watch('startTime');
  const watchEndTime = form.watch('endTime');
  const watchBreakMinutes = form.watch('breakDurationMinutes');
  const watchTrainingMinutes = form.watch('trainingDurationMinutes'); // Watch training minutes
  const watchDate = form.watch('date');

  // Calculate hours worked whenever relevant fields change
  useEffect(() => {
      if (isValid(watchDate)) {
          const formattedDate = format(watchDate, 'yyyy-MM-dd');
           const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (timeRegex.test(watchStartTime) && timeRegex.test(watchEndTime) && watchBreakMinutes !== undefined && watchBreakMinutes !== null && formattedDate) {
                const totalNonWorkMinutes = (watchBreakMinutes || 0) + (watchTrainingMinutes || 0);
                const hours = calculateHoursWorked(formattedDate, watchStartTime, watchEndTime, totalNonWorkMinutes);
                setCalculatedHours(hours);
            } else {
                 setCalculatedHours(null);
            }
      } else {
          setCalculatedHours(null);
      }
  }, [watchStartTime, watchEndTime, watchBreakMinutes, watchTrainingMinutes, watchDate]);

  // Function to reset form to defaults using fetched user settings
   const resetToDefaults = useCallback((settings: UserSettings) => {
        const today = new Date();
        form.reset({
            date: today,
            startTime: settings.defaultStartTime || '14:00', // Use settings or fallback
            endTime: settings.defaultEndTime || '22:30',   // Use settings or fallback
            breakDurationMinutes: settings.defaultBreakMinutes ?? 0, // Use settings or 0
            trainingDurationMinutes: settings.defaultTrainingMinutes ?? 0, // Use settings or 0
            documentsCompleted: 0,
            videoSessionsCompleted: 0,
            notes: '',
            targetId: activeTargetId, // Use currently active target ID
        });
        // Recalculate hours based on the defaults being set
        const defaultNonWorkMinutes = (settings.defaultBreakMinutes ?? 0) + (settings.defaultTrainingMinutes ?? 0);
        const defaultHours = calculateHoursWorked(
            formatDateISO(today),
            settings.defaultStartTime || '14:00',
            settings.defaultEndTime || '22:30',
            defaultNonWorkMinutes
        );
        setCalculatedHours(defaultHours);
   }, [form, activeTargetId]); // Depends on form and activeTargetId


  const onSubmit = (values: WorkLogFormData) => {
    setIsLoading(true);
    if (!isValid(values.date)) {
        toast({ variant: "destructive", title: "Invalid Date", description: "Please select a valid date." });
        setIsLoading(false);
        return;
    }

    const formattedDate = format(values.date, 'yyyy-MM-dd');
    const totalNonWorkMinutes = (values.breakDurationMinutes || 0) + (values.trainingDurationMinutes || 0);
    const hoursWorked = calculateHoursWorked(formattedDate, values.startTime, values.endTime, totalNonWorkMinutes);

     if (hoursWorked === null || isNaN(hoursWorked) || hoursWorked < 0) {
        toast({ variant: "destructive", title: "Invalid Times", description: "Calculated hours worked is invalid. Check start/end times and break/training." });
        setIsLoading(false);
        return;
    }

    // Check if we are potentially updating an existing log based on ID
    const isUpdatingLog = !!existingLog?.id && existingLog.date === formattedDate;

    const targetIdToSave = values.targetId ?? activeTargetId; // Prefer form value, fallback to active

    if (!targetIdToSave && !isUpdatingLog) {
        // Only strictly require a target for brand new logs if no active target is set
        // For updates, it might inherit the existing target ID
        if(!activeTargetId) {
            toast({ variant: "destructive", title: "No Active Target", description: "Cannot save new log. No active UPH target found. Please set one." });
            setIsLoading(false);
            return;
        }
    }


    const payloadToSave: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number } = {
        ...(isUpdatingLog && { id: existingLog.id }), // Include ID only if updating
        date: formattedDate,
        startTime: values.startTime,
        endTime: values.endTime,
        breakDurationMinutes: values.breakDurationMinutes,
        trainingDurationMinutes: values.trainingDurationMinutes || 0,
        hoursWorked: hoursWorked,
        documentsCompleted: values.documentsCompleted,
        videoSessionsCompleted: values.videoSessionsCompleted,
        targetId: targetIdToSave,
        notes: values.notes || '',
    };

    try {
      const savedLog = onWorkLogSaved(payloadToSave);

      toast({
        title: "Work Log Saved",
        description: `Entry for ${formattedDate} has been ${isUpdatingLog ? 'updated' : 'added/updated'}.`,
      });

       // If the saved log is for today, keep the form populated with its data
       if (savedLog.date === formatDateISO(new Date())) {
           const updatedNonWorkMinutes = (savedLog.breakDurationMinutes || 0) + (savedLog.trainingDurationMinutes || 0);
           const updatedHours = calculateHoursWorked(savedLog.date, savedLog.startTime, savedLog.endTime, updatedNonWorkMinutes);
            setCalculatedHours(updatedHours);
            form.reset({
                ...values,
                date: parse(savedLog.date, 'yyyy-MM-dd', new Date()),
                startTime: savedLog.startTime, // Ensure form reflects actual saved data
                endTime: savedLog.endTime,
                breakDurationMinutes: savedLog.breakDurationMinutes,
                trainingDurationMinutes: savedLog.trainingDurationMinutes || 0,
                documentsCompleted: savedLog.documentsCompleted,
                videoSessionsCompleted: savedLog.videoSessionsCompleted,
                notes: savedLog.notes ?? '',
                targetId: savedLog.targetId,
            });
       } else if (userSettings) {
           // If saved log was for a past date, reset to defaults for today
           resetToDefaults(userSettings);
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

  if (!isClient || !userSettings) { // Wait for client and settings load
     return (
         <Card>
             <CardHeader><CardTitle>Loading Form...</CardTitle></CardHeader>
             <CardContent className="space-y-6">
                 {/* Add Skeleton loaders here if desired */}
                 <p className="text-muted-foreground">Loading settings...</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
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
                            onSelect={(date) => date && field.onChange(date)}
                            disabled={(date) => date > new Date() || date < new Date('2023-01-01')}
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <div className="flex flex-col justify-end pb-1">
                    <FormLabel>Calculated Hours</FormLabel>
                    <div className="h-10 px-3 py-2 text-sm font-medium text-muted-foreground border border-input rounded-md bg-muted">
                        {(calculatedHours !== null && !isNaN(calculatedHours))
                          ? `${calculatedHours.toFixed(2)} hrs`
                          : 'Enter times & break/training'}
                    </div>
                 </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <FormField control={form.control} name="startTime" render={({ field }) => (
                    <FormItem> <FormLabel>Start Time (HH:mm)</FormLabel> <FormControl><Input type="time" {...field} /></FormControl> <FormMessage /> </FormItem>
                )}/>
                 <FormField control={form.control} name="endTime" render={({ field }) => (
                    <FormItem> <FormLabel>End Time (HH:mm)</FormLabel> <FormControl><Input type="time" {...field} /></FormControl> <FormMessage /> </FormItem>
                )}/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                 <FormField control={form.control} name="breakDurationMinutes" render={({ field }) => (
                    <FormItem> <FormLabel>Break (Minutes)</FormLabel> <FormControl><Input type="number" placeholder="e.g., 0" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} min="0" step="1" /></FormControl> <FormMessage /> </FormItem>
                )}/>
                 <FormField control={form.control} name="trainingDurationMinutes" render={({ field }) => (
                    <FormItem> <FormLabel>Training (Minutes)</FormLabel> <FormControl><Input type="number" placeholder="e.g., 0" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} min="0" step="1" /></FormControl> <FormMessage /> </FormItem>
                )}/>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <FormField control={form.control} name="documentsCompleted" render={({ field }) => (
                    <FormItem> <FormLabel>Documents Completed</FormLabel> <FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} min="0" /></FormControl> <FormMessage /> </FormItem>
                )}/>
                <FormField control={form.control} name="videoSessionsCompleted" render={({ field }) => (
                    <FormItem> <FormLabel>Video Sessions Completed</FormLabel> <FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} min="0" /></FormControl> <FormMessage /> </FormItem>
                )}/>
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem> <FormLabel>Notes (Optional)</FormLabel> <FormControl><Textarea placeholder="Any relevant notes..." {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem>
            )}/>

             <div className="flex space-x-2">
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : (isEditingToday ? 'Update Log' : 'Save Log')}
                </Button>
                 {/* Show Reset button only if not editing today OR if the selected date is not today */}
                 {(!isEditingToday || (isValid(watchDate) && formatDateISO(watchDate) !== formatDateISO(new Date())) || !isValid(watchDate) ) && (
                    <Button type="button" variant="outline" onClick={() => resetToDefaults(userSettings)} className="ml-2" disabled={isLoading}>
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
