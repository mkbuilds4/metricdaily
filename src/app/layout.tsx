

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
import { Home, Settings, List, History, BarChart } from 'lucide-react'; // Import icons
import { usePathname } from 'next/navigation'; // Import usePathname
import { cn } from "@/lib/utils"; // Import cn utility

const fontSans = FontSans({ // Changed variable name
  subsets: ['latin'],
  variable: '--font-sans', // Changed CSS variable name
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
          "min-h-screen bg-background font-sans antialiased", // Use font-sans
          fontSans.variable // Apply font variable
        )}
      >
        <SidebarProvider defaultOpen={true}>
          <Sidebar side="left" variant="sidebar" collapsible="icon">
            <SidebarHeader>
                <SidebarTrigger />
                {/* Can add Logo/Title here if needed */}
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
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
                         {/* Link to Previous Logs page */}
                        <SidebarMenuButton href="/previous-logs" isActive={pathname === '/previous-logs'} tooltip="Previous Logs">
                             <History />
                             <span>Previous Logs</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    {/* Future: Weekly Averages link */}
                    {/* <SidebarMenuItem>
                        <SidebarMenuButton href="/weekly-averages" isActive={pathname === '/weekly-averages'} tooltip="Weekly Averages">
                            <BarChart />
                            <span>Weekly Averages</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem> */}
                    {/* Future: Settings link */}
                    {/* <SidebarMenuItem>
                        <SidebarMenuButton href="/settings" isActive={pathname === '/settings'} tooltip="Settings">
                            <Settings />
                            <span>Settings</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem> */}
                </SidebarMenu>
            </SidebarContent>
             {/* Optional Footer */}
             {/* <SidebarFooter>
               <SidebarMenuButton href="#" tooltip="Settings">
                   <Settings />
                   <span>Settings</span>
               </SidebarMenuButton>
             </SidebarFooter> */}
          </Sidebar>
          <SidebarInset>
            {/* Use main tag for semantic structure and apply padding here */}
             <main className="p-4 md:p-6 lg:p-8">
               {children}
             </main>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
