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
  // Receive initial data and client-side action functions as props
  targets: UPHTarget[];
  addUPHTargetAction: (data: Omit<UPHTarget, 'id' | 'isActive'>) => UPHTarget; // Now returns the new target synchronously
  updateUPHTargetAction: (data: UPHTarget) => UPHTarget; // Returns updated target synchronously
  deleteUPHTargetAction: (id: string) => void; // Synchronous delete
  setActiveUPHTargetAction: (id: string) => UPHTarget; // Returns the activated target
}

// --- Component ---
const UPHTargetManager: React.FC<UPHTargetManagerProps> = ({
    targets: initialTargets = [],
    addUPHTargetAction,
    updateUPHTargetAction,
    deleteUPHTargetAction,
    setActiveUPHTargetAction,
}) => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<UPHTarget | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Keep for visual feedback during sync operations
  // Use local state for targets to enable immediate UI updates
  const [localTargets, setLocalTargets] = useState<UPHTarget[]>(initialTargets);

  // Sync local state when the initial prop changes (e.g., after parent reloads data)
  useEffect(() => {
    setLocalTargets(initialTargets);
  }, [initialTargets]);


  const form = useForm<TargetFormData>({
    resolver: zodResolver(targetFormSchema),
    defaultValues: {
      name: '',
      targetUPH: 0, // Initialize with 0 to avoid undefined -> controlled error
      docsPerUnit: 1,
      videosPerUnit: 1,
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
      targetUPH: 0, // Initialize with 0
      docsPerUnit: 1,
      videosPerUnit: 1,
    });
    setIsDialogOpen(true);
  };

 const handleFormSubmit = (values: TargetFormData) => {
    setIsLoading(true);
    // No need for previous state rollback with sync localStorage

    try {
      if (editingTarget) {
        // === Call Client Action (Update) ===
        const updatedTargetData: UPHTarget = {
          ...editingTarget,
          ...values,
        };
        const updatedTarget = updateUPHTargetAction(updatedTargetData); // Call sync action
        // === Update Local State ===
        setLocalTargets(prev =>
          prev.map(t => (t.id === editingTarget.id ? updatedTarget : t))
        );
        toast({ title: "Target Updated", description: `"${values.name}" has been updated.` });

      } else {
        // === Call Client Action (Add) ===
        const newTargetData: Omit<UPHTarget, 'id' | 'isActive'> = values;
        const actualNewTarget = addUPHTargetAction(newTargetData); // Call sync action
        // === Update Local State ===
        setLocalTargets(prev => [...prev, actualNewTarget]);
        toast({ title: "Target Added", description: `"${values.name}" has been added.` });
      }
      setIsDialogOpen(false); // Close dialog on success
      form.reset(); // Reset form fields
      setEditingTarget(null); // Clear editing state
    } catch (error) {
      console.error("Failed to save target:", error);
      // No rollback needed, but show error
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Could not save the UPH target.",
      });
      // Keep dialog open on error?
      // setIsDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  };


  // --- Action Handlers ---
 const handleSetActive = (id: string) => {
    setIsLoading(true);

    try {
      // === Call Client Action ===
      const newActiveTarget = setActiveUPHTargetAction(id);
      // === Update Local State ===
      // Update based on the result of the action which handles logic
      setLocalTargets(prev =>
          prev.map(t => ({ ...t, isActive: t.id === newActiveTarget.id }))
      );
      toast({ title: "Target Activated", description: "The selected target is now active." });

    } catch (error) {
      console.error("Failed to set active target:", error);
      // No rollback needed
      toast({
        variant: "destructive",
        title: "Activation Failed",
        description: error instanceof Error ? error.message : "Could not activate the target.",
      });
    } finally {
      setIsLoading(false);
    }
  };


 const handleDelete = (id: string, name: string) => {
    const targetToDelete = localTargets.find(t => t.id === id);
    if (!targetToDelete) return; // Should not happen if UI is synced

    if (targetToDelete.isActive) {
        toast({
            variant: "destructive",
            title: "Deletion Blocked",
            description: "Cannot delete the currently active target. Set another target as active first.",
        });
        return;
    }

    // Use browser confirm for simplicity
    if (!confirm(`Are you sure you want to delete the target "${name}"?`)) {
        return;
    }

    setIsLoading(true);

    try {
      // === Call Client Action ===
      deleteUPHTargetAction(id);
      // === Update Local State ===
      setLocalTargets(prev => prev.filter(t => t.id !== id));
      toast({ title: "Target Deleted", description: `"${name}" has been deleted.` });

    } catch (error) {
       console.error("Failed to delete target:", error);
       // No rollback needed
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
                            {/* Ensure value passed is never undefined */}
                            <Input type="number" placeholder="e.g., 15.5" {...field} value={field.value ?? 0} onChange={field.onChange} step="0.1" min="0.1" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                 <FormField
                    control={form.control}
                    name="docsPerUnit"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Documents per Unit</FormLabel>
                        <FormControl>
                             {/* Ensure value passed is never undefined */}
                            <Input type="number" placeholder="e.g., 5" {...field} value={field.value ?? 0} onChange={field.onChange} step="0.1" min="0.1" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField
                    control={form.control}
                    name="videosPerUnit"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Video Sessions per Unit</FormLabel>
                        <FormControl>
                             {/* Ensure value passed is never undefined */}
                            <Input type="number" placeholder="e.g., 2.5" {...field} value={field.value ?? 0} onChange={field.onChange} step="0.1" min="0.1" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); form.reset(); setEditingTarget(null); }}>Cancel</Button>
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
              <TableHead>Docs / Unit</TableHead>
              <TableHead>Videos / Unit</TableHead>
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
                        className="p-1 h-auto"
                        >
                       <XCircle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                    </Button>
                  )}
                </TableCell>
                <TableCell>{target.name}</TableCell>
                <TableCell>{target.targetUPH}</TableCell>
                <TableCell>{target.docsPerUnit}</TableCell>
                <TableCell>{target.videosPerUnit}</TableCell>
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
                    disabled={isLoading || target.isActive}
                    title={target.isActive ? "Cannot delete the active target" : "Delete Target"}
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
