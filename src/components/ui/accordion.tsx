
"use client"

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react" // Keep the import if needed elsewhere, but remove from default render
import { Slot } from "@radix-ui/react-slot"; // Import Slot

import { cn } from "@/lib/utils"

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    // Ensure border is handled by the Item wrapper or content styling
    className={cn("", className)} // Keep base class minimal
    {...props}
  />
))
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & { asChild?: boolean } // Add asChild prop
>(({ className, children, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : AccordionPrimitive.Trigger; // Use Slot if asChild is true
    return (
        <AccordionPrimitive.Header className="flex">
            {/* Apply flex-1 to the trigger itself if it wraps content that needs space */}
            <Comp // Use the dynamic component type
            ref={ref}
            className={cn(
                "flex flex-1 items-center font-medium transition-all", // Removed justify-between, py-4, removed hover:underline, removed icon rotation class
                // Add custom styles for hover/focus/state if needed, e.g., hover:bg-muted/50
                // Important: Ensure styling applies correctly whether it's a button or a Slot
                !asChild && "justify-between", // Add default button styling only if not asChild
                className
            )}
            {...props}
            >
            {children}
            {/* Removed the default ChevronDown icon - it should be added manually where needed */}
            {/* {!asChild && <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ml-auto group-data-[state=open]:rotate-180" />} */}
            </Comp>
        </AccordionPrimitive.Header>
    )
})
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    {/* Padding should be applied consistently, maybe pb-4 is enough */}
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
))

AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }

    