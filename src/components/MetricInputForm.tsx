"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle // Import Card components
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn, formatDateISO } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
// Removed addMetric import, as it's handled by the parent via onMetricSaved
import { type Metric } from "@/types";

const formSchema = z.object({
  date: z.date({
    required_error: "A date is required.",
  }),
  value: z.coerce.number().min(0, { message: "Value must be non-negative." }),
  notes: z.string().optional(),
});

type MetricInputFormProps = {
  // Renamed prop for clarity, as it handles both adds and updates
  onMetricSaved: (metricData: Omit<Metric, 'id'>) => Promise<void>;
};

export function MetricInputForm({ onMetricSaved }: MetricInputFormProps) {
  const { toast } = useToast(); // Keep toast for internal form feedback if needed, although parent handles save feedback
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date()); // State to manage selected date for the popover

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: selectedDate, // Use state for default date
      value: 0,
      notes: "",
    },
  });

   // Update default date when selectedDate state changes
   React.useEffect(() => {
        form.reset({ ...form.getValues(), date: selectedDate });
   }, [selectedDate, form]);


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const formattedDate = formatDateISO(values.date);
      const metricDataToSave = {
        date: formattedDate,
        value: values.value,
        notes: values.notes,
      };
      // Call the parent handler to perform the save (add or update)
      await onMetricSaved(metricDataToSave);
      // Reset form to current date after successful save handled by parent
      setSelectedDate(new Date()); // Reset calendar date to today
      form.reset({ date: new Date(), value: 0, notes: "" });

    } catch (error) {
       // Error handling is now primarily in the parent, but keep a fallback here if needed
      console.error("Form submission failed:", error);
       toast({
         title: "Submission Error",
         description: "Could not process the metric submission.",
         variant: "destructive",
       });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
     <Card className="w-full shadow-md"> {/* Wrap form in a Card */}
        <CardHeader>
            <CardTitle className="text-xl font-semibold text-card-foreground">Add / Update Metric</CardTitle>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                            variant={"outline"}
                            className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
                            >
                            {field.value ? (
                                format(field.value, "PPP") // e.g., Jul 29, 2024
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
                            // Update state and form field on select
                             onSelect={(date) => {
                                if (date) {
                                    field.onChange(date);
                                    setSelectedDate(date); // Update local state if needed for other logic
                                }
                             }}
                            disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Value</FormLabel>
                    <FormControl>
                        <Input type="number" step="any" placeholder="Enter metric value" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                        <Textarea placeholder="Add any relevant notes" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Metric"}
                </Button>
            </form>
            </Form>
        </CardContent>
     </Card>
  );
}
