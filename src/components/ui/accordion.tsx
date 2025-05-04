
"use client"

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react" // Import the ChevronDown icon

import { cn } from "@/lib/utils"

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    // Ensure border is handled by the Item wrapper or content styling
    className={cn("border-b", className)} // Added back border-b for visual separation
    {...props}
  />
))
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & { hideChevron?: boolean }
>(({ className, children, hideChevron, asChild = false, ...props }, ref) => ( // Destructure asChild, default to false
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      asChild={asChild} // Pass asChild to the primitive
      className={cn(
        // Apply base trigger styles only if not using asChild
        !asChild && "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline",
        // Apply icon rotation styles only if not using asChild and not hiding chevron
        !asChild && !hideChevron && "[&[data-state=open]>svg]:rotate-180",
        className // Allow className overrides
      )}
      {...props}
    >
      {asChild ? (
        children // If asChild, render only the single child passed down
      ) : (
        <>
          {children}
          {/* If not asChild, render children and the chevron icon (if not hidden) */}
          {!hideChevron && (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
          )}
        </>
      )}
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
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

