'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link'; // Import Link
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as ShadcnFormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getDefaultSettings, saveDefaultSettings, clearAllData } from '@/lib/actions';
import type { UserSettings } from '@/types';
import { Trash2, Settings as SettingsIcon, Info, Upload } from 'lucide-react'; // Added Upload icon
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';


// Schema for settings form validation
const settingsSchema = z.object({
  defaultStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  defaultEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  defaultBreakMinutes: z.coerce.number().nonnegative().int().default(0),
  defaultTrainingMinutes: z.coerce.number().nonnegative().int().default(0),
  autoSwitchTargetBySchedule: z.boolean().optional().default(false),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { 
      defaultStartTime: '',
      defaultEndTime: '',
      defaultBreakMinutes: 0,
      defaultTrainingMinutes: 0,
      autoSwitchTargetBySchedule: false,
    },
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentSettings = getDefaultSettings();
      form.reset({
        ...currentSettings,
        autoSwitchTargetBySchedule: currentSettings.autoSwitchTargetBySchedule ?? false,
      });
    }
  }, [form]);

  const handleSaveChanges = (values: SettingsFormData) => {
    setIsLoading(true);
    try {
      const savedSettings = saveDefaultSettings(values);
      form.reset(savedSettings);
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

  const handleClearAllDataAction = () => {
    if (typeof window === 'undefined') return;
    setIsClearing(true);
    try {
      clearAllData();
      toast({
        title: "Data Cleared",
        description: "All work logs, UPH targets, and settings have been removed.",
      });
      form.reset({
         defaultStartTime: '14:00',
         defaultEndTime: '22:30',
         defaultBreakMinutes: 0,
         defaultTrainingMinutes: 0,
         autoSwitchTargetBySchedule: false,
      });
    } catch (error) {
      console.error('[Settings] Error clearing data:', error);
      toast({
        variant: "destructive",
        title: "Clear Data Error",
        description: error instanceof Error ? error.message : "Could not clear data.",
      });
    } finally {
      setIsClearing(false);
    }
  };


  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Application Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" /> Default Log & Behavior Settings
          </CardTitle>
          <CardDescription>
            Customize default values and application behavior.
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

              <Separator />

              <FormField
                control={form.control}
                name="autoSwitchTargetBySchedule"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Auto-Switch Active Target</FormLabel>
                      <ShadcnFormDescription>
                        Automatically set the active target on the dashboard to the one closest to being "On Schedule".
                      </ShadcnFormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Toggle auto-switch active target"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />


              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isLoading || isClearing}>
                  {isLoading ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
          <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-6 w-6" /> Import & Export Data
              </CardTitle>
              <CardDescription>
                  Manage your application data by importing or exporting it.
              </CardDescription>
          </CardHeader>
          <CardContent>
                <Separator className="mb-4" />
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <p className="font-medium">Import Application Data</p>
                        <p className="text-sm text-muted-foreground">
                            Upload a JSON file to restore your application data. This will overwrite existing data.
                        </p>
                    </div>
                    <Button asChild variant="outline">
                        <Link href="/import-data">
                            <Upload className="mr-2 h-4 w-4" /> Go to Import Page
                        </Link>
                    </Button>
                </div>
                 <Separator className="my-6" />
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <p className="font-medium">Clear All Application Data</p>
                        <p className="text-sm text-muted-foreground">
                            This will permanently delete all your work logs, UPH targets, and saved settings.
                        </p>
                    </div>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isClearing}>
                                <Trash2 className="mr-2 h-4 w-4" /> {isClearing ? 'Clearing...' : 'Clear All Data'}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete all your
                                    saved work logs, UPH targets, and custom settings from local storage.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClearAllDataAction} className="bg-destructive hover:bg-destructive/90">
                                    Yes, delete everything
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
          </CardContent>
      </Card>
    </div>
  );
}
