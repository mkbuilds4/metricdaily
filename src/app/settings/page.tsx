
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getDefaultSettings, saveDefaultSettings } from '@/lib/actions';
import type { UserSettings } from '@/types';

// Schema for settings form validation
const settingsSchema = z.object({
  defaultStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  defaultEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  defaultBreakMinutes: z.coerce.number().nonnegative().int().default(0),
  defaultTrainingMinutes: z.coerce.number().nonnegative().int().default(0),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { // Initialize with empty or actual defaults
      defaultStartTime: '',
      defaultEndTime: '',
      defaultBreakMinutes: 0,
      defaultTrainingMinutes: 0,
    },
  });

  // Load current settings when the component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentSettings = getDefaultSettings();
      form.reset(currentSettings); // Populate form with loaded settings
    }
  }, [form]);

  const handleSaveChanges = (values: SettingsFormData) => {
    setIsLoading(true);
    try {
      const savedSettings = saveDefaultSettings(values);
      form.reset(savedSettings); // Update form with saved (potentially cleaned) values
      toast({
        title: "Settings Updated",
        description: "Your default settings have been saved.",
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Could not save settings.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Application Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Default Log Settings</CardTitle>
          <CardDescription>
            Set the default values used when starting a new day or resetting the log input form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveChanges)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <FormField
                  control={form.control}
                  name="defaultStartTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Start Time (HH:mm)</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="defaultEndTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default End Time (HH:mm)</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <FormField
                  control={form.control}
                  name="defaultBreakMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Break (Minutes)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 0" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} min="0" step="1" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="defaultTrainingMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Training (Minutes)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 0" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} min="0" step="1" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
