'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns'; // Use date-fns for reliable date formatting

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
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import type { DailyWorkLog } from '@/types'; // Assuming type is defined

// Define Zod schema for validation based on DailyWorkLog
const formSchema = z.object({
  date: z.date({ required_error: 'A date is required.' }),
  documentsCompleted: z.coerce // coerce converts string input to number
    .number({ invalid_type_error: 'Must be a number' })
    .nonnegative({ message: 'Docs cannot be negative' })
    .default(0),
  videoSessionsCompleted: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .nonnegative({ message: 'Videos cannot be negative' })
    .default(0),
  hoursWorked: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .positive({ message: 'Hours must be positive' }), // Must work some time
  notes: z.string().optional(),
});

type WorkLogFormData = z.infer<typeof formSchema>;

interface WorkLogInputFormProps {
  // Callback to notify parent component when a log is saved/updated
  // This should be a server action passed from the parent
  onWorkLogSaved: (workLogData: Omit<DailyWorkLog, 'id'>) => Promise<void | DailyWorkLog>; // Allow void or return type from server action
  // Optional: Pass an existing log to pre-fill the form for editing
  existingLog?: DailyWorkLog | null;
}

const WorkLogInputForm: React.FC<WorkLogInputFormProps> = ({ onWorkLogSaved, existingLog }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Initialize the form with react-hook-form
  const form = useForm<WorkLogFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: existingLog ? new Date(existingLog.date + 'T00:00:00') : new Date(), // Ensure correct Date object
      documentsCompleted: existingLog?.documentsCompleted ?? 0,
      videoSessionsCompleted: existingLog?.videoSessionsCompleted ?? 0,
      hoursWorked: existingLog?.hoursWorked ?? undefined, // Start empty unless editing
      notes: existingLog?.notes ?? '',
    },
  });

   // Update form default values if existingLog changes (e.g., user selects a different date to edit)
   useEffect(() => {
    if (existingLog) {
      form.reset({
        date: new Date(existingLog.date + 'T00:00:00'), // Adjust for potential timezone issues if needed
        documentsCompleted: existingLog.documentsCompleted,
        videoSessionsCompleted: existingLog.videoSessionsCompleted,
        hoursWorked: existingLog.hoursWorked,
        notes: existingLog.notes ?? '',
      });
    } else {
      // Optionally reset to defaults if existingLog becomes null (e.g., switching from edit to add mode)
       form.reset({
        date: new Date(),
        documentsCompleted: 0,
        videoSessionsCompleted: 0,
        hoursWorked: undefined,
        notes: '',
      });
    }
  }, [existingLog, form]);


  // Handle form submission
  const onSubmit = async (values: WorkLogFormData) => {
    setIsLoading(true);
    try {
       // Format date consistently before sending
      const formattedDate = format(values.date, 'yyyy-MM-dd');

      const workLogData: Omit<DailyWorkLog, 'id'> = {
        date: formattedDate,
        documentsCompleted: values.documentsCompleted,
        videoSessionsCompleted: values.videoSessionsCompleted,
        hoursWorked: values.hoursWorked,
        notes: values.notes,
      };

      await onWorkLogSaved(workLogData); // Call the server action passed as prop

      toast({
        title: "Work Log Saved",
        description: `Entry for ${formattedDate} has been saved.`,
      });
      // Reset form after successful submission only if NOT editing
      if (!existingLog) {
         form.reset({
            date: new Date(), // Keep today's date as default
            documentsCompleted: 0,
            videoSessionsCompleted: 0,
            hoursWorked: undefined, // Clear hours
            notes: '',
        });
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{existingLog ? 'Edit Work Log' : 'Add New Work Log'}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                            'w-full md:w-[240px] pl-3 text-left font-normal', // Responsive width
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
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

            {/* Grid for number inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Documents Completed */}
                <FormField
                control={form.control}
                name="documentsCompleted"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Documents</FormLabel>
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
                    <FormLabel>Videos</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="0" {...field} min="0" />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

                {/* Hours Worked */}
                <FormField
                control={form.control}
                name="hoursWorked"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Hours Worked</FormLabel>
                    <FormControl>
                        {/* Use step="0.01" for finer control if needed */}
                        <Input type="number" placeholder="e.g., 7.5" {...field} step="0.1" min="0.1" />
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
                    <Textarea placeholder="Any relevant notes..." {...field} />
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
                    <Button type="button" variant="outline" onClick={() => form.reset()} className="ml-2" disabled={isLoading}>
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
