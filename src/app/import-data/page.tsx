'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { importApplicationData } from '@/lib/actions'; // This action needs to be created
import { Upload, AlertTriangle } from 'lucide-react';
import type { ApplicationData } from '@/types'; // This type needs to be created

export default function ImportDataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    } else {
      setFile(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        variant: "destructive",
        title: "No File Selected",
        description: "Please select a JSON file to import.",
      });
      return;
    }

    if (file.type !== 'application/json') {
        toast({
            variant: "destructive",
            title: "Invalid File Type",
            description: "Please select a valid JSON file (.json).",
        });
        return;
    }

    setIsLoading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      const fileContent = e.target?.result;
      if (typeof fileContent === 'string') {
        try {
          // Call the import action
          const result = importApplicationData(fileContent);
          if (result.success) {
             toast({
                title: "Import Successful",
                description: "Application data has been imported.",
             });
            // Optionally, redirect or refresh data on current page if needed
            // For now, user can navigate away to see changes
          } else {
             toast({
                variant: "destructive",
                title: "Import Failed",
                description: result.error || "An unknown error occurred during import.",
             });
          }
        } catch (error) {
          console.error("Error during import process:", error);
          toast({
            variant: "destructive",
            title: "Import Error",
            description: error instanceof Error ? error.message : "An unexpected error occurred.",
          });
        } finally {
          setIsLoading(false);
        }
      } else {
        toast({
          variant: "destructive",
          title: "File Read Error",
          description: "Could not read the file content.",
        });
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: "File Read Error",
        description: "Failed to read the selected file.",
      });
      setIsLoading(false);
    };

    reader.readAsText(file);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Import Application Data</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-6 w-6" /> Upload Data File
          </CardTitle>
          <CardDescription>
            Select a JSON file containing your previously exported application data.
            This will overwrite all current data in the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 border-l-4 border-destructive bg-destructive/10 text-destructive">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div>
                <h5 className="font-semibold">Warning: Data Overwrite</h5>
                <p className="text-sm">
                  Importing data will permanently replace all existing work logs, UPH targets, audit logs, and settings.
                  This action cannot be undone. Please ensure you have a backup if needed.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="import-file" className="block text-sm font-medium text-foreground mb-1">
              Select JSON File
            </label>
            <Input
              id="import-file"
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
             {file && <p className="text-xs text-muted-foreground mt-1">Selected file: {file.name}</p>}
          </div>

          <Button onClick={handleImport} disabled={isLoading || !file} className="w-full sm:w-auto">
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" /> Import Data
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
