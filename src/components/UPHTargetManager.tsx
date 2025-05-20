'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Trash2, Edit, CheckCircle, XCircle, ArrowUpDown, Copy, Eye, EyeOff } from 'lucide-react'; // Added Eye, EyeOff
import { useToast } from "@/hooks/use-toast";
import type { UPHTarget } from '@/types';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox

const targetFormSchema = z.object({
  name: z.string().min(1, { message: 'Target name is required.' }),
  targetUPH: z.coerce.number().positive({ message: 'Target UPH must be positive.' }),
  docsPerUnit: z.coerce.number().positive({ message: 'Docs per unit must be a positive number.' }),
  videosPerUnit: z.coerce.number().positive({ message: 'Videos per unit must be a positive number.' }),
  isDisplayed: z.boolean().optional(), // Add isDisplayed to form schema
});

type TargetFormData = z.infer<typeof targetFormSchema>;

interface UPHTargetManagerProps {
  targets: UPHTarget[];
  addUPHTargetAction: (data: Omit<UPHTarget, 'id' | 'isActive'>) => Promise<UPHTarget | void>;
  updateUPHTargetAction: (data: UPHTarget) => Promise<UPHTarget | void>;
  deleteUPHTargetAction: (id: string) => Promise<void>;
  setActiveUPHTargetAction: (id: string) => Promise<void>;
  duplicateUPHTargetAction: (id: string) => Promise<void>;
  asyncHandlers?: boolean;
}

type SortableColumn = keyof Pick<UPHTarget, 'name' | 'targetUPH' | 'docsPerUnit' | 'videosPerUnit' | 'isDisplayed'>; // Added isDisplayed
type SortDirection = 'asc' | 'desc';

const UPHTargetManager: React.FC<UPHTargetManagerProps> = ({
    targets: initialTargets = [],
    addUPHTargetAction,
    updateUPHTargetAction,
    deleteUPHTargetAction,
    setActiveUPHTargetAction,
    duplicateUPHTargetAction,
}) => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<UPHTarget | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [localTargets, setLocalTargets] = useState<UPHTarget[]>(initialTargets);
  const [sortColumn, setSortColumn] = useState<SortableColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Debug output to confirm data flow
  console.log('UPHTargetManager received targets:', initialTargets);

  useEffect(() => {
    setLocalTargets(initialTargets);
  }, [initialTargets]);

  const sortedTargets = useMemo(() => {
    if (!sortColumn) {
       return [...localTargets].sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...localTargets].sort((a, b) => {
      const valA = sortColumn === 'isDisplayed' ? (a.isDisplayed ?? true) : a[sortColumn as keyof Omit<UPHTarget, 'isDisplayed'>];
      const valB = sortColumn === 'isDisplayed' ? (b.isDisplayed ?? true) : b[sortColumn as keyof Omit<UPHTarget, 'isDisplayed'>];
      let comparison = 0;
      if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        comparison = valA === valB ? 0 : valA ? -1 : 1; // True comes before false for descending
      }
      else {
        comparison = String(valA).localeCompare(String(valB));
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [localTargets, sortColumn, sortDirection]);

  const form = useForm<TargetFormData>({
    resolver: zodResolver(targetFormSchema),
    defaultValues: {
      name: '',
      targetUPH: 0,
      docsPerUnit: 1,
      videosPerUnit: 1,
      isDisplayed: true,
    },
  });

  const handleSort = useCallback((column: SortableColumn) => {
    setSortDirection(prevDirection =>
      sortColumn === column && prevDirection === 'asc' ? 'desc' : 'asc'
    );
    setSortColumn(column);
  }, [sortColumn]);

  const openEditDialog = (target: UPHTarget) => {
    setEditingTarget(target);
    form.reset({
      name: target.name,
      targetUPH: target.targetUPH,
      docsPerUnit: target.docsPerUnit,
      videosPerUnit: target.videosPerUnit,
      isDisplayed: target.isDisplayed ?? true,
    });
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingTarget(null);
    form.reset({
      name: '',
      targetUPH: 0,
      docsPerUnit: 1,
      videosPerUnit: 1,
      isDisplayed: true,
    });
    setIsDialogOpen(true);
  };

 const handleFormSubmit = async (values: TargetFormData) => {
    setIsLoading(true);
    try {
      if (editingTarget) {
        const updatedTargetData: UPHTarget = {
          ...editingTarget,
          ...values,
          isDisplayed: values.isDisplayed ?? editingTarget.isDisplayed ?? true,
        };
        await updateUPHTargetAction(updatedTargetData);
        toast({ title: "Target Updated", description: `"${values.name}" has been updated.` });
      } else {
        const newTargetData: Omit<UPHTarget, 'id' | 'isActive'> = {
            ...values,
            isDisplayed: values.isDisplayed ?? true,
        };
        await addUPHTargetAction(newTargetData);
        toast({ title: "Target Added", description: `"${values.name}" has been added.` });
      }
      setIsDialogOpen(false);
      form.reset({name: '', targetUPH: 0, docsPerUnit: 1, videosPerUnit: 1, isDisplayed: true });
      setEditingTarget(null);
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

 const handleSetActive = async (id: string) => {
    setIsLoading(true);
    try {
      await setActiveUPHTargetAction(id);
      toast({ title: "Target Activated", description: `Target is now active.` });
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
    const targetToDelete = localTargets.find(t => t.id === id);
    if (!targetToDelete) return;

    if (targetToDelete.isActive) {
        toast({
            variant: "destructive",
            title: "Deletion Blocked",
            description: "Cannot delete the currently active target. Set another target as active first.",
        });
        return;
    }
    if (!confirm(`Are you sure you want to delete the target "${name}"?`)) {
        return;
    }
    setIsLoading(true);
    try {
      await deleteUPHTargetAction(id);
      toast({ title: "Target Deleted", description: `"${name}" has been deleted.` });
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

  const handleDuplicate = async (id: string) => {
    setIsLoading(true);
    try {
      await duplicateUPHTargetAction(id);
      toast({ title: "Target Duplicated", description: `Target has been duplicated.` });
    } catch (error) {
      console.error("Failed to duplicate target:", error);
      toast({
        variant: "destructive",
        title: "Duplication Failed",
        description: error instanceof Error ? error.message : "Could not duplicate the target.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDisplay = async (target: UPHTarget) => {
    setIsLoading(true);
    const updatedTarget = { ...target, isDisplayed: !(target.isDisplayed ?? true) };
    try {
        const savedTarget = await updateUPHTargetAction(updatedTarget) as UPHTarget;
        setLocalTargets(prev => prev.map(t => t.id === savedTarget.id ? savedTarget : t));
        toast({ title: "Display Updated", description: `Display for "${savedTarget.name}" set to ${savedTarget.isDisplayed}.`});
    } catch (error) {
        console.error("Failed to update display status:", error);
        toast({ variant: "destructive", title: "Update Failed", description: "Could not update display status." });
    } finally {
        setIsLoading(false);
    }
  };


  const renderSortIcon = (column: SortableColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    return sortDirection === 'asc' ?
      <ArrowUpDown className="ml-2 h-4 w-4" /> :
      <ArrowUpDown className="ml-2 h-4 w-4" />;
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
                            <Input type="number" placeholder="e.g., 15.5" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} step="0.000001" min="0.000001" />
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
                            <Input type="number" placeholder="e.g., 5.25" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} step="any" min="0.000001" />
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
                            <Input type="number" placeholder="e.g., 2.55" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} step="any" min="0.000001" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField
                  control={form.control}
                  name="isDisplayed"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Display on Dashboard</FormLabel>
                        <DialogDescription className="text-xs"> {/* Using DialogDescription for smaller text */}
                          Show this target in dashboard metrics.
                        </DialogDescription>
                      </div>
                      <FormControl>
                        <Checkbox
                          checked={field.value ?? true}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); form.reset({name: '', targetUPH: 0, docsPerUnit: 1, videosPerUnit: 1, isDisplayed: true }); setEditingTarget(null); }}>Cancel</Button>
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
        <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Active</TableHead>
                  <TableHead className="w-[60px]">Display</TableHead> {/* New column for Display toggle */}
                  <TableHead>
                     <Button variant="ghost" onClick={() => handleSort('name')} className="px-0 hover:bg-transparent">
                       Name
                       {renderSortIcon('name')}
                     </Button>
                  </TableHead>
                  <TableHead>
                     <Button variant="ghost" onClick={() => handleSort('targetUPH')} className="px-0 hover:bg-transparent">
                       Target UPH
                       {renderSortIcon('targetUPH')}
                     </Button>
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                     <Button variant="ghost" onClick={() => handleSort('docsPerUnit')} className="px-0 hover:bg-transparent">
                       Docs / Unit
                       {renderSortIcon('docsPerUnit')}
                     </Button>
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                     <Button variant="ghost" onClick={() => handleSort('videosPerUnit')} className="px-0 hover:bg-transparent">
                       Videos / Unit
                       {renderSortIcon('videosPerUnit')}
                     </Button>
                  </TableHead>
                  <TableHead className="w-[130px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && sortedTargets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <p className="text-muted-foreground">No UPH targets defined yet.</p>
                        <Button variant="outline" onClick={openAddDialog}>Add Your First Target</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && sortedTargets.map((target) => (
                  <TableRow key={target.id} className={cn(target.isActive ? 'bg-accent/10' : '', !(target.isDisplayed ?? true) && 'opacity-50 hover:opacity-75')}>
                    <TableCell className="text-center">
                      {target.isActive ? (
                        <CheckCircle className="h-5 w-5 text-accent mx-auto" />
                      ) : (
                         <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSetActive(target.id)}
                            disabled={isLoading}
                            title="Set as Active"
                            aria-label="Set as Active"
                            className="p-1 h-8 w-8 mx-auto"
                            >
                           <XCircle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                        </Button>
                      )}
                    </TableCell>
                     <TableCell className="text-center">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleDisplay(target)}
                            disabled={isLoading}
                            title={target.isDisplayed ?? true ? "Hide on Dashboard" : "Show on Dashboard"}
                            aria-label={target.isDisplayed ?? true ? "Hide on Dashboard" : "Show on Dashboard"}
                            className="p-1 h-8 w-8 mx-auto"
                        >
                           {(target.isDisplayed ?? true) ? <Eye className="h-5 w-5 text-primary" /> : <EyeOff className="h-5 w-5 text-muted-foreground hover:text-foreground" />}
                        </Button>
                    </TableCell>
                    <TableCell className="font-medium">{target.name}</TableCell>
                    <TableCell>{target.targetUPH}</TableCell>
                    <TableCell className="hidden sm:table-cell">{target.docsPerUnit}</TableCell>
                    <TableCell className="hidden sm:table-cell">{target.videosPerUnit}</TableCell>
                    <TableCell className="text-right">
                       <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDuplicate(target.id)}
                        disabled={isLoading}
                        title="Duplicate Target"
                        aria-label="Duplicate Target"
                        className="h-8 w-8 mr-1"
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                       <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(target)}
                        disabled={isLoading}
                        title="Edit Target"
                        aria-label="Edit Target"
                        className="h-8 w-8 mr-1"
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
        </div>
      </CardContent>
    </Card>
  );
};

export default UPHTargetManager;
