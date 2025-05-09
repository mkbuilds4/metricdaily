
'use client'; // Required for usePathname

import type { Metadata } from 'next';
import { Inter as FontSans } from 'next/font/google';
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
  SidebarGroupLabel, // Added SidebarGroupLabel
} from '@/components/ui/sidebar';
import { Home, Settings, List, History, BarChart3, HelpCircle, Upload } from 'lucide-react'; // Added Upload
import { usePathname } from 'next/navigation';
import { cn } from "@/lib/utils";
import { ThemeProvider } from '@/components/ThemeProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import TutorialDialog from '@/components/TutorialDialog';

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Metric Daily</title>
        <meta name="description" content="Track your daily metrics." />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased overflow-hidden",
          fontSans.variable
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
                </SidebarHeader>
                <SidebarContent>
                    <SidebarMenu className="flex flex-col justify-between flex-1">
                        <div>
                            <SidebarMenuItem>
                                <SidebarMenuButton href="/" isActive={pathname === '/'} tooltip="Dashboard">
                                    <Home />
                                    <span>Dashboard</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton href="/log-input" isActive={pathname === '/log-input'} tooltip="Log Input / Targets">
                                    <List />
                                    <span>Log / Targets</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                             <SidebarMenuItem>
                                <SidebarMenuButton href="/analytics" isActive={pathname === '/analytics'} tooltip="Analytics">
                                    <BarChart3 />
                                    <span>Analytics</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton href="/previous-logs" isActive={pathname === '/previous-logs'} tooltip="Previous Logs">
                                    <History />
                                    <span>Previous Logs</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarGroup>
                                <SidebarGroupLabel>Admin</SidebarGroupLabel>
                                <SidebarMenuItem>
                                    <SidebarMenuButton href="/settings" isActive={pathname === '/settings'} tooltip="Settings">
                                        <Settings />
                                        <span>Settings</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton href="/import-data" isActive={pathname === '/import-data'} tooltip="Import Data">
                                        <Upload />
                                        <span>Import Data</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        href="/audit-log"
                                        isActive={pathname === '/audit-log'}
                                        tooltip="Audit Log"
                                    >
                                        <History />
                                        <span>Audit Log</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarGroup>
                        </div>
                    </SidebarMenu>
                </SidebarContent>
                <SidebarFooter className="flex items-center justify-between p-2">
                    <TutorialDialog />
                    <ThemeToggle />
                </SidebarFooter>
            </Sidebar>
            <SidebarInset className="overflow-y-auto h-screen">
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
