'use client';

import React, { useState, useEffect, useCallback } from 'react';
import WorkLogInputForm from '@/components/WorkLogInputForm';
import UPHTargetManager from '@/components/UPHTargetManager';
import {
  getWorkLogs, 
  getActiveUPHTarget,
  saveWorkLog,
  getUPHTargets,
  addUPHTarget,
  updateUPHTarget,
  deleteUPHTarget,
  setActiveUPHTarget,
  duplicateUPHTarget, // Import new action
} from '@/lib/actions';
import type { DailyWorkLog, UPHTarget as AppUPHTarget } from '@/types';
import { formatDateISO } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/lib/AuthContext';
import {
  createUPHTarget,
  getUserUPHTargets,
  updateUPHTargetInFirestore,
  deleteUPHTargetFromFirestore,
} from '@/lib/firestore';

export default function LogInputPage() {
  const [todayLog, setTodayLog] = useState<DailyWorkLog | null>(null);
  const [uphTargets, setUphTargets] = useState<AppUPHTarget[]>([]);
  const [activeTarget, setActiveTarget] = useState<AppUPHTarget | null>(null); 
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  // Helper to map Firestore UPHTarget to app UPHTarget
  type FirestoreUPHTarget = {
    id: string;
    name: string;
    unitsPerHour: number;
    docsPerUnit: number;
    videosPerUnit: number;
    isActive: boolean;
    isDisplayed: boolean;
  };

  function mapFirestoreTargetToAppTarget(target: FirestoreUPHTarget): AppUPHTarget {
    return {
      id: target.id,
      name: target.name,
      targetUPH: target.unitsPerHour,
      docsPerUnit: target.docsPerUnit,
      videosPerUnit: target.videosPerUnit,
      isActive: target.isActive,
      isDisplayed: target.isDisplayed,
    };
  }

  function mapAppTargetToFirestoreTarget(target: Partial<AppUPHTarget>): Omit<FirestoreUPHTarget, 'id'> {
    return {
      name: target.name || '',
      unitsPerHour: target.targetUPH || 0,
      docsPerUnit: target.docsPerUnit || 0,
      videosPerUnit: target.videosPerUnit || 0,
      isActive: target.isActive || false,
      isDisplayed: target.isDisplayed ?? true,
    };
  }

  const loadTargets = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      console.log('Loading targets for user:', user.uid);
      const firestoreTargets = await getUserUPHTargets(user.uid);
      console.log('Raw Firestore targets:', firestoreTargets);
      const mappedTargets = firestoreTargets.map((t: any) => {
        const mapped = {
          id: t.id,
          name: t.name || '',
          targetUPH: t.unitsPerHour || 0,
          docsPerUnit: t.docsPerUnit || 1,
          videosPerUnit: t.videosPerUnit || 1,
          isActive: t.isActive || false,
          isDisplayed: t.isDisplayed ?? true,
        };
        console.log('Mapped target:', mapped);
        return mapped;
      });
      console.log('Final mapped targets:', mappedTargets);
      setUphTargets(mappedTargets);
      const active = mappedTargets.find(t => t.isActive);
      setActiveTarget(active || null);
    } catch (error) {
      console.error('Error loading targets:', error);
      toast({
        variant: 'destructive',
        title: 'Error Loading Targets',
        description: error instanceof Error ? error.message : 'Could not load UPH targets from the cloud.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      loadTargets();
    }
  }, [user, loadTargets]);

  // Add debug logging for uphTargets state changes
  useEffect(() => {
    console.log('uphTargets state updated:', uphTargets);
  }, [uphTargets]);

  const handleSaveWorkLog = useCallback((logData: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number }) => {
    if (typeof window === 'undefined') return {} as DailyWorkLog; 
    try {
      const savedLog = saveWorkLog(logData);
      if (savedLog.date === formatDateISO(new Date())) {
        setTodayLog(savedLog);
      }
      return savedLog;
    } catch (error) {
      console.error('[LogInputPage] Error saving work log:', error);
      throw error; 
    }
  }, []); 

  const handleAddTarget = useCallback(async (targetData: Omit<AppUPHTarget, 'id' | 'isActive'>): Promise<AppUPHTarget | undefined> => {
    if (!user) return;
    try {
      const newTargetId = await createUPHTarget(user.uid, mapAppTargetToFirestoreTarget({ ...targetData, isActive: false }));
      const newTarget: AppUPHTarget = {
        id: newTargetId,
        ...targetData,
        isActive: false,
        isDisplayed: targetData.isDisplayed ?? true,
      };
      setUphTargets(prev => [...prev, newTarget]);
      toast({ title: 'Target Added', description: `"${targetData.name}" has been added.` });
      return newTarget;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Add Target Failed',
        description: error instanceof Error ? error.message : 'Could not add the target.',
      });
      throw error;
    }
  }, [user, toast]);

  const handleUpdateTarget = useCallback(async (targetData: AppUPHTarget): Promise<AppUPHTarget | undefined> => {
    if (!user) return;
    try {
      await updateUPHTargetInFirestore(targetData.id, mapAppTargetToFirestoreTarget(targetData));
      setUphTargets(prev => prev.map(t => t.id === targetData.id ? targetData : t));
      toast({ title: 'Target Updated', description: `"${targetData.name}" has been updated.` });
      return targetData;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update Target Failed',
        description: error instanceof Error ? error.message : 'Could not update the target.',
      });
      throw error;
    }
  }, [user, toast]);

  const handleDeleteTarget = useCallback(async (id: string): Promise<void> => {
    if (!user) return;
    try {
      const targetToDelete = uphTargets.find(t => t.id === id);
      if (targetToDelete?.isActive) {
        toast({
          variant: 'destructive',
          title: 'Deletion Blocked',
          description: 'Cannot delete the currently active target. Set another target as active first.',
        });
        throw new Error('Cannot delete the currently active target. Set another target as active first.');
      }
      await deleteUPHTargetFromFirestore(id);
      setUphTargets(prev => prev.filter(t => t.id !== id));
      toast({ title: 'Target Deleted', description: 'UPH Target deleted successfully.' });
    } catch (error) {
      if (!(error instanceof Error && error.message.includes('Cannot delete'))) {
        toast({
          variant: 'destructive',
          title: 'Deletion Failed',
          description: error instanceof Error ? error.message : 'Could not delete the target.',
        });
      }
      throw error;
    }
  }, [user, uphTargets, toast]);

  const handleSetActiveTarget = useCallback(async (id: string): Promise<void> => {
    if (!user) return;
    try {
      // Update all targets in Firestore
      const updates = uphTargets.map(t => 
        updateUPHTargetInFirestore(t.id, { isActive: t.id === id })
      );
      await Promise.all(updates);
      
      // Update local state
      setUphTargets(prev => prev.map(t => ({
        ...t,
        isActive: t.id === id
      })));
      
      const newActiveTarget = uphTargets.find(t => t.id === id);
      toast({ title: 'Target Activated', description: `"${newActiveTarget?.name ?? ''}" is now the active target.` });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Activation Failed',
        description: error instanceof Error ? error.message : 'Could not activate the target.',
      });
      throw error;
    }
  }, [user, uphTargets, toast]);

  const handleDuplicateTarget = useCallback(async (id: string): Promise<void> => {
    if (!user) return;
    try {
      const originalTarget = uphTargets.find(t => t.id === id);
      if (!originalTarget) throw new Error('Target not found for duplication.');
      
      let duplicateName = `${originalTarget.name} - Copy`;
      let counter = 1;
      while (uphTargets.some(t => t.name === duplicateName)) {
        counter++;
        duplicateName = `${originalTarget.name} - Copy ${counter}`;
      }
      
      const newTargetId = await createUPHTarget(user.uid, mapAppTargetToFirestoreTarget({ 
        ...originalTarget, 
        id: undefined, 
        name: duplicateName, 
        isActive: false 
      }));
      
      const newTarget: AppUPHTarget = {
        id: newTargetId,
        name: duplicateName,
        targetUPH: originalTarget.targetUPH,
        docsPerUnit: originalTarget.docsPerUnit,
        videosPerUnit: originalTarget.videosPerUnit,
        isActive: false,
        isDisplayed: originalTarget.isDisplayed,
      };
      
      setUphTargets(prev => [...prev, newTarget]);
      toast({ title: 'Target Duplicated', description: `"${duplicateName}" has been created as a copy.` });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Duplication Failed',
        description: error instanceof Error ? error.message : 'Could not duplicate the target.',
      });
      throw error;
    }
  }, [user, uphTargets, toast]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center p-4 md:p-6 lg:p-8">
        <p className="text-xl text-muted-foreground">Loading Input Form...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Log Work & Manage Targets</h1>

      <WorkLogInputForm
        onWorkLogSaved={handleSaveWorkLog}
        existingLog={todayLog}
      />

      <UPHTargetManager
        targets={uphTargets}
        addUPHTargetAction={handleAddTarget}
        updateUPHTargetAction={handleUpdateTarget}
        deleteUPHTargetAction={handleDeleteTarget}
        setActiveUPHTargetAction={handleSetActiveTarget}
        duplicateUPHTargetAction={handleDuplicateTarget}
        asyncHandlers
      />
    </div>
  );
}
