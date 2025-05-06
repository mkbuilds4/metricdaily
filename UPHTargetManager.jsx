
</Button>
</TableHead>
<TableHead>
<Button variant="ghost" onClick={() => handleSort('targetUPH')} className="px-0 hover:bg-transparent">
Target UPH
{renderSortIcon('targetUPH')}
</Button>
</TableHead>
{/* New Column Header: Docs / Unit */}
<TableHead className="hidden sm:table-cell">
<Button variant="ghost" onClick={() => handleSort('docsPerUnit')} className="px-0 hover:bg-transparent">
Docs / Unit
{renderSortIcon('docsPerUnit')}
</Button>
</TableHead>
{/* New Column Header: Videos / Unit */}
<TableHead className="hidden sm:table-cell">
<Button variant="ghost" onClick={() => handleSort('videosPerUnit')} className="px-0 hover:bg-transparent">
Videos / Unit
{renderSortIcon('videosPerUnit')}
</Button>
</TableHead>
<TableHead className="w-[100px] text-right">Actions</TableHead>
</TableRow>
</TableHeader>
<TableBody>
{sortedTargets.length === 0 && ( // Use sortedTargets here
<TableRow>
{/* Adjust colSpan to include new columns */}
<TableCell colSpan={6} className="text-center text-muted-foreground h-24">No UPH targets defined yet.</TableCell> {/* Increased height */}
</TableRow>
)}
{sortedTargets.map((target) => ( // Use sortedTargets here
<TableRow key={target.id} className={target.isActive ? 'bg-accent/10' : ''}>
<TableCell className="text-center"> {/* Center icon */}
{target.isActive ? (
<CheckCircle className="h-5 w-5 text-accent mx-auto" />
) : (
<Button
variant="ghost"
size="icon" // Use icon size
onClick={() => handleSetActive(target.id)}
disabled={isLoading}
title="Set as Active"
aria-label="Set as Active"
className="p-1 h-8 w-8 mx-auto" // Adjust size/padding/margin
>
<XCircle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
</Button>
)}
</TableCell>
<TableCell className="font-medium">{target.name}</TableCell>
<TableCell>{target.targetUPH}</TableCell>
{/* New Cell: Docs per Unit */}
<TableCell className="hidden sm:table-cell">{target.docsPerUnit}</TableCell>
{/* New Cell: Videos per Unit */}
<TableCell className="hidden sm:table-cell">{target.videosPerUnit}</TableCell>
<TableCell className="text-right"> {/* Align actions to the right */}
<Button
variant="ghost"
size="icon"
onClick={() => openEditDialog(target)}
disabled={isLoading}
title="Edit Target"
aria-label="Edit Target"
className="h-8 w-8 mr-1" // Add margin
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

    