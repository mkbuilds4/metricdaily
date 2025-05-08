

'use client'; // Required for usePathname

import type { Metadata } from 'next';
import { Inter as FontSans } from 'next/font/google'; // Changed font import
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Home, Settings, List, History, BarChart3, HelpCircle } from 'lucide-react'; // Changed BarChart to BarChart3
import { usePathname } from 'next/navigation'; // Import usePathname
import { cn } from "@/lib/utils"; // Import cn utility
import { ThemeProvider } from '@/components/ThemeProvider'; // Import ThemeProvider
import { ThemeToggle } from '@/components/ThemeToggle'; // Import ThemeToggle
import TutorialDialog from '@/components/TutorialDialog'; // Import TutorialDialog

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
});

// Metadata can still be defined in layout for static parts
// export const metadata: Metadata = {
//   title: 'Metric Daily',
//   description: 'Track your daily metrics.',
// };
// If metadata needs to be dynamic based on route, move it to specific page.tsx files

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname(); // Get the current path

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Metadata tags can be placed here directly or managed via page metadata objects */}
        <title>Metric Daily</title>
        <meta name="description" content="Track your daily metrics." />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased overflow-hidden", // Use font-sans, prevent body scroll
          fontSans.variable // Apply font variable
        )}
      >
        <ThemeProvider
            defaultTheme="system"
            storageKey="metric-daily-theme"
        >
            <SidebarProvider defaultOpen={true}>
            <Sidebar side="left" variant="sidebar" collapsible="icon">
                <SidebarHeader>
                    <SidebarTrigger />
                    {/* Can add Logo/Title here if needed */}
                </SidebarHeader>
                <SidebarContent>
                    <SidebarMenu className="flex flex-col justify-between flex-1"> {/* Make menu take full height */}
                        {/* Main navigation items */}
                        <div>
                            <SidebarMenuItem>
                                {/* Link to dashboard (home page) */}
                                <SidebarMenuButton href="/" isActive={pathname === '/'} tooltip="Dashboard">
                                    <Home />
                                    <span>Dashboard</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                {/* Link to Log Input page */}
                                <SidebarMenuButton href="/log-input" isActive={pathname === '/log-input'} tooltip="Log Input / Targets">
                                    <List />
                                    <span>Log / Targets</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                             <SidebarMenuItem>
                                {/* Link to Analytics page */}
                                <SidebarMenuButton href="/analytics" isActive={pathname === '/analytics'} tooltip="Analytics">
                                    <BarChart3 /> {/* Changed icon */}
                                    <span>Analytics</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                {/* Link to Previous Logs page */}
                                <SidebarMenuButton href="/previous-logs" isActive={pathname === '/previous-logs'} tooltip="Previous Logs">
                                    <History /> {/* Kept History icon as it's generic */}
                                    <span>Previous Logs</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            {/* Add Settings Link */}
                            <SidebarMenuItem>
                                <SidebarMenuButton href="/settings" isActive={pathname === '/settings'} tooltip="Settings">
                                    <Settings />
                                    <span>Settings</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </div>

                        {/* Audit Log at the bottom of the main navigation section */}
                        <div>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    href="/audit-log"
                                    isActive={pathname === '/audit-log'}
                                    tooltip="Audit Log"
                                >
                                    <History /> {/* Changed icon to History for general log access */}
                                    <span>Audit Log</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </div>
                    </SidebarMenu>
                </SidebarContent>
                <SidebarFooter className="flex items-center justify-between p-2"> {/* Changed to justify-between */}
                    <TutorialDialog />
                    <ThemeToggle />
                </SidebarFooter>
            </Sidebar>
            <SidebarInset className="overflow-y-auto h-screen"> {/* Allow scrolling within the inset */}
                {/* Use main tag for semantic structure and apply padding here */}
                <main className="p-4 md:p-6 lg:p-8">
                {children}
                </main>
            </SidebarInset>
            </SidebarProvider>
            <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
