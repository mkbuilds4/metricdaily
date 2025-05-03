'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Edit, CheckCircle, XCircle } from 'lucide-react'; // Icons
import { useToast } from "@/hooks/use-toast";
import type { UPHTarget } from '@/types'; // Assuming type is defined

// Zod Schema updated for docsPerUnit and videosPerUnit
const targetFormSchema = z.object({
  name: z.string().min(1, { message: 'Target name is required.' }),
  targetUPH: z.coerce.number().positive({ message: 'Target UPH must be positive.' }),
  docsPerUnit: z.coerce.number().positive({ message: 'Docs per unit must be a positive number.' }), // Must be positive
  videosPerUnit: z.coerce.number().positive({ message: 'Videos per unit must be a positive number.' }), // Must be positive
});

type TargetFormData = z.infer<typeof targetFormSchema>;

// --- Component Props ---
interface UPHTargetManagerProps {
  targets: UPHTarget[];
  // Accept specific server actions as props
  addUPHTargetAction: (data: Omit<UPHTarget, 'id' | 'isActive'>) => Promise<UPHTarget>;
  updateUPHTargetAction: (data: UPHTarget) => Promise<UPHTarget>;
  deleteUPHTargetAction: (id: string) => Promise<void>;
  setActiveUPHTargetAction: (id: string) => Promise<UPHTarget>;
}

// --- Component ---
const UPHTargetManager: React.FC<UPHTargetManagerProps> = ({
    targets: initialTargets = [], // Rename prop to avoid conflict
    addUPHTargetAction,
    updateUPHTargetAction,
    deleteUPHTargetAction,
    setActiveUPHTargetAction,
}) => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<UPHTarget | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Use local state for targets to enable optimistic updates
  const [localTargets, setLocalTargets] = useState<UPHTarget[]>(initialTargets);

  // Sync local state when the initial prop changes (e.g., after server revalidation)
   useEffect(() => {
    setLocalTargets(initialTargets);
  }, [initialTargets]);


  const form = useForm<TargetFormData>({
    resolver: zodResolver(targetFormSchema),
    defaultValues: {
      name: '',
      targetUPH: undefined,
      docsPerUnit: 1, // Default to 1 item per unit
      videosPerUnit: 1, // Default to 1 item per unit
    },
  });

  // --- Form Handling ---
  const openEditDialog = (target: UPHTarget) => {
    setEditingTarget(target);
    form.reset({ // Pre-fill form for editing
      name: target.name,
      targetUPH: target.targetUPH,
      docsPerUnit: target.docsPerUnit,
      videosPerUnit: target.videosPerUnit,
    });
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingTarget(null);
    form.reset({ // Reset to defaults for adding
      name: '',
      targetUPH: undefined,
      docsPerUnit: 1,
      videosPerUnit: 1,
    });
    setIsDialogOpen(true);
  };

 const handleFormSubmit = async (values: TargetFormData) => {
    setIsLoading(true);
    const previousTargets = [...localTargets]; // Store previous state for rollback

    try {
      if (editingTarget) {
        // === Optimistic Update (Edit) ===
        const updatedTargetData: UPHTarget = {
          ...editingTarget,
          ...values, // Values from form now contain docsPerUnit, videosPerUnit
        };
        setLocalTargets(prev =>
          prev.map(t => (t.id === editingTarget.id ? updatedTargetData : t))
        );
        setIsDialogOpen(false); // Close dialog optimistically
        // === Call Server Action ===
        await updateUPHTargetAction(updatedTargetData);
        toast({ title: "Target Updated", description: `"${values.name}" has been updated.` });
        // Server action revalidates, props will eventually update, local state is already updated
      } else {
        // === Optimistic Update (Add) ===
        // Create a temporary ID for the optimistic update
        const tempId = `temp-${Date.now()}`;
        const optimisticNewTarget: UPHTarget = {
          ...values, // Values from form now contain docsPerUnit, videosPerUnit
          id: tempId,
          isActive: false, // New targets are inactive
        };
        setLocalTargets(prev => [...prev, optimisticNewTarget]);
        setIsDialogOpen(false); // Close dialog optimistically
         // === Call Server Action ===
        const newTargetData: Omit<UPHTarget, 'id' | 'isActive'> = values;
        const actualNewTarget = await addUPHTargetAction(newTargetData);
        // === Replace temporary target with actual data from server ===
        setLocalTargets(prev =>
          prev.map(t => (t.id === tempId ? actualNewTarget : t))
        );
        toast({ title: "Target Added", description: `"${values.name}" has been added.` });
         // Server action revalidates
      }
    } catch (error) {
      console.error("Failed to save target:", error);
      // === Rollback ===
      setLocalTargets(previousTargets);
      setIsDialogOpen(true); // Re-open dialog on error? Or just show toast?
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Could not save the UPH target.",
      });
    } finally {
      setIsLoading(false);
    }
  };


  // --- Action Handlers ---
 const handleSetActive = async (id: string) => {
    setIsLoading(true);
    const previousTargets = [...localTargets];

    // === Optimistic Update ===
    setLocalTargets(prev =>
      prev.map(t => ({ ...t, isActive: t.id === id }))
    );

    try {
      // === Call Server Action ===
      await setActiveUPHTargetAction(id);
      toast({ title: "Target Activated", description: "The selected target is now active." });
      // Server action revalidates
    } catch (error) {
      console.error("Failed to set active target:", error);
      // === Rollback ===
      setLocalTargets(previousTargets);
      toast({
        variant: "destructive",
        title: "Activation Failed",
        description: error instanceof Error ? error.message : "Could not activate the target.",
      });
    } finally {
      setIsLoading(false);
    }
  };


 const handleDelete = async (id: string, name: string) => {
    const targetToDelete = localTargets.find(t => t.id === id);
    if (targetToDelete?.isActive) {
        toast({
            variant: "destructive",
            title: "Deletion Blocked",
            description: "Cannot delete the currently active target. Set another target as active first.",
        });
        return;
    }

    // Use browser confirm for simplicity, consider a confirmation dialog component for better UX
    if (!confirm(`Are you sure you want to delete the target "${name}"?`)) {
        return;
    }

    setIsLoading(true);
    const previousTargets = [...localTargets];

     // === Optimistic Update ===
    setLocalTargets(prev => prev.filter(t => t.id !== id));


    try {
      // === Call Server Action ===
      await deleteUPHTargetAction(id);
      toast({ title: "Target Deleted", description: `"${name}" has been deleted.` });
       // Server action revalidates
    } catch (error) {
       console.error("Failed to delete target:", error);
        // === Rollback ===
       setLocalTargets(previousTargets);
       toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: error instanceof Error ? error.message : "Could not delete the target.",
        });
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>UPH Target Manager</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} disabled={isLoading}>Add New Target</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingTarget ? 'Edit Target' : 'Add New Target'}</DialogTitle>
              <DialogDescription>
                {editingTarget ? 'Modify the details of this UPH target.' : 'Define a new UPH target and how many items make one unit.'}
              </DialogDescription>
            </DialogHeader>
            {/* Target Add/Edit Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
                 <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Target Name</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Standard Shift" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                 <FormField
                    control={form.control}
                    name="targetUPH"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Target UPH</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g., 15.5" {...field} step="0.1" min="0.1" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                 <FormField
                    control={form.control}
                    name="docsPerUnit" // Updated field name
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Documents per Unit</FormLabel> {/* Updated label */}
                        <FormControl>
                            <Input type="number" placeholder="e.g., 5" {...field} step="0.1" min="0.1" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField
                    control={form.control}
                    name="videosPerUnit" // Updated field name
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Video Sessions per Unit</FormLabel> {/* Updated label */}
                        <FormControl>
                            <Input type="number" placeholder="e.g., 2.5" {...field} step="0.1" min="0.1" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isLoading}>
                         {isLoading ? 'Saving...' : (editingTarget ? 'Save Changes' : 'Add Target')}
                    </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {/* Targets List Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Active</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Target UPH</TableHead>
              <TableHead>Docs / Unit</TableHead> {/* Updated header */}
              <TableHead>Videos / Unit</TableHead> {/* Updated header */}
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localTargets.length === 0 && (
                 <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">No UPH targets defined yet.</TableCell>
                </TableRow>
            )}
            {localTargets.map((target) => (
              <TableRow key={target.id} className={target.isActive ? 'bg-accent/10' : ''}>
                <TableCell>
                  {target.isActive ? (
                    <CheckCircle className="h-5 w-5 text-accent" />
                  ) : (
                     <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetActive(target.id)}
                        disabled={isLoading}
                        title="Set as Active"
                        aria-label="Set as Active"
                        className="p-1 h-auto" // Adjust padding/height
                        >
                       <XCircle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                    </Button>
                  )}
                </TableCell>
                <TableCell>{target.name}</TableCell>
                <TableCell>{target.targetUPH}</TableCell>
                <TableCell>{target.docsPerUnit}</TableCell> {/* Display new field */}
                <TableCell>{target.videosPerUnit}</TableCell> {/* Display new field */}
                <TableCell className="space-x-1">
                   <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(target)}
                    disabled={isLoading}
                    title="Edit Target"
                    aria-label="Edit Target"
                    className="h-8 w-8"
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive h-8 w-8"
                    onClick={() => handleDelete(target.id, target.name)}
                    disabled={isLoading || target.isActive} // Explicitly disable if target is active
                    title={target.isActive ? "Cannot delete the active target" : "Delete Target"} // Updated tooltip message
                    aria-label={target.isActive ? "Cannot delete the active target" : "Delete Target"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default UPHTargetManager;
