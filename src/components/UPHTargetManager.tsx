'use client';

import React, { useState } from 'react';
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

// Zod Schema remains the same
const targetFormSchema = z.object({
  name: z.string().min(1, { message: 'Target name is required.' }),
  targetUPH: z.coerce.number().positive({ message: 'Target UPH must be positive.' }),
  docWeight: z.coerce.number().nonnegative({ message: 'Doc weight cannot be negative.' }),
  videoWeight: z.coerce.number().nonnegative({ message: 'Video weight cannot be negative.' }),
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
    targets = [],
    addUPHTargetAction,
    updateUPHTargetAction,
    deleteUPHTargetAction,
    setActiveUPHTargetAction,
}) => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<UPHTarget | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<TargetFormData>({
    resolver: zodResolver(targetFormSchema),
    defaultValues: {
      name: '',
      targetUPH: undefined,
      docWeight: 1,
      videoWeight: 1,
    },
  });

  // --- Form Handling ---
  const openEditDialog = (target: UPHTarget) => {
    setEditingTarget(target);
    form.reset({ // Pre-fill form for editing
      name: target.name,
      targetUPH: target.targetUPH,
      docWeight: target.docWeight,
      videoWeight: target.videoWeight,
    });
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingTarget(null);
    form.reset({ // Reset to defaults for adding
      name: '',
      targetUPH: undefined,
      docWeight: 1,
      videoWeight: 1,
    });
    setIsDialogOpen(true);
  };

  const handleFormSubmit = async (values: TargetFormData) => {
     setIsLoading(true);
    try {
      if (editingTarget) {
        // Update existing target - use the update action prop
        const updatedTargetData: UPHTarget = {
          ...editingTarget, // Keep id and isActive status from the original editing target
          ...values, // Include updated form values
        };
        await updateUPHTargetAction(updatedTargetData); // Call server Action prop
        toast({ title: "Target Updated", description: `"${values.name}" has been updated.` });
      } else {
        // Add new target - use the add action prop
        const newTargetData: Omit<UPHTarget, 'id' | 'isActive'> = values;
        await addUPHTargetAction(newTargetData); // Call server Action prop
        toast({ title: "Target Added", description: `"${values.name}" has been added.` });
      }
      setIsDialogOpen(false); // Close dialog on success
      // Revalidation is handled by the server action, no need for onTargetsUpdate callback
    } catch (error) {
        console.error("Failed to save target:", error);
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
    try {
      await setActiveUPHTargetAction(id); // Use the set active action prop
      toast({ title: "Target Activated", description: "The selected target is now active." });
      // Revalidation handled by server action
    } catch (error) {
        console.error("Failed to set active target:", error);
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
    // Find the target to ensure it's not active before confirming
    const targetToDelete = targets.find(t => t.id === id);
    if (targetToDelete?.isActive) {
        toast({
            variant: "destructive",
            title: "Deletion Blocked",
            description: "Cannot delete the currently active target. Set another target as active first.",
        });
        return; // Prevent deletion if it's active
    }

    if (!confirm(`Are you sure you want to delete the target "${name}"?`)) {
        return;
    }

    setIsLoading(true);
    try {
      await deleteUPHTargetAction(id); // Use the delete action prop
      toast({ title: "Target Deleted", description: `"${name}" has been deleted.` });
       // Revalidation handled by server action
    } catch (error) {
       console.error("Failed to delete target:", error);
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
            <Button onClick={openAddDialog}>Add New Target</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingTarget ? 'Edit Target' : 'Add New Target'}</DialogTitle>
              <DialogDescription>
                {editingTarget ? 'Modify the details of this UPH target.' : 'Define a new UPH target with its weights.'}
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
                    name="docWeight"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Document Unit Weight</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g., 1" {...field} step="0.1" min="0" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField
                    control={form.control}
                    name="videoWeight"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Video Session Unit Weight</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g., 2.5" {...field} step="0.1" min="0" />
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
              <TableHead>Doc Weight</TableHead>
              <TableHead>Video Weight</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.length === 0 && (
                 <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">No UPH targets defined yet.</TableCell>
                </TableRow>
            )}
            {targets.map((target) => (
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
                <TableCell>{target.docWeight}</TableCell>
                <TableCell>{target.videoWeight}</TableCell>
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
