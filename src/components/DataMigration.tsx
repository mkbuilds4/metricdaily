import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { migrateLocalDataToFirestore, shouldMigrateData, backupLocalData, restoreLocalData } from '@/lib/migration';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

export function DataMigration() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [backup, setBackup] = useState<Record<string, any> | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showMigration, setShowMigration] = useState(false);

  useEffect(() => {
    setMounted(true);
    setShowMigration(shouldMigrateData());
  }, []);

  const handleStartMigration = async () => {
    if (!user) return;

    setIsMigrating(true);
    setProgress(0);
    
    try {
      // Backup current data
      const dataBackup = backupLocalData();
      setBackup(dataBackup);
      setProgress(20);

      // Perform migration
      const result = await migrateLocalDataToFirestore(user.uid);
      setProgress(80);

      if (result.success) {
        toast({
          title: "Migration Successful",
          description: `Migrated ${result.workLogsMigrated} work logs, ${result.targetsMigrated} targets, and settings.`,
        });
        setProgress(100);
      } else {
        throw new Error(result.error || 'Migration failed');
      }
    } catch (error) {
      console.error('Migration error:', error);
      toast({
        variant: "destructive",
        title: "Migration Failed",
        description: error instanceof Error ? error.message : "An error occurred during migration",
      });
      
      // Restore from backup if available
      if (backup) {
        restoreLocalData(backup);
        toast({
          title: "Data Restored",
          description: "Your local data has been restored from backup.",
        });
      }
    } finally {
      setIsMigrating(false);
      setIsOpen(false);
    }
  };

  // Only show migration dialog if there's data to migrate and component is mounted
  if (!mounted || !showMigration) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4"
      >
        Migrate Data to Cloud
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Migrate Data to Cloud</DialogTitle>
            <DialogDescription>
              Your data will be migrated from local storage to the cloud. This process is safe and your data will be backed up automatically.
            </DialogDescription>
          </DialogHeader>

          {isMigrating && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground">
                Migrating your data... {progress}%
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isMigrating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartMigration}
              disabled={isMigrating}
            >
              {isMigrating ? 'Migrating...' : 'Start Migration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 