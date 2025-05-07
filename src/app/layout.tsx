
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
import { Home, Settings, List, History, BarChart, HelpCircle, ShieldCheck, Lock } from 'lucide-react'; // Import icons, Added ShieldCheck, Lock
import { usePathname } from 'next/navigation'; // Import usePathname
import { cn } from "@/lib/utils"; // Import cn utility
import { ThemeProvider } from '@/components/ThemeProvider'; // Import ThemeProvider
import { ThemeToggle } from '@/components/ThemeToggle'; // Import ThemeToggle
import TutorialDialog from '@/components/TutorialDialog'; // Import TutorialDialog
import { addAuditLog } from '@/lib/actions'; // Import addAuditLog

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

  const handleAuditLogClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (pathname === '/audit-log') {
      e.preventDefault(); // Prevent navigation if already on the page
      return;
    }

    const auditLogPasswordFromEnv = process.env.NEXT_PUBLIC_AUDIT_LOG_PASSWORD;
    if (!auditLogPasswordFromEnv) {
        e.preventDefault();
        addAuditLog('SECURITY_CONFIGURATION_ERROR', 'Security', 'Audit Log access denied: Password not configured by admin.');
        alert("Audit Log password not configured by admin. Access denied.");
        return;
    }

    const enteredPassword = prompt("Please enter the password to access the Audit Log:");

    // Trim both entered password and environment variable password for comparison
    const trimmedEnteredPassword = enteredPassword ? enteredPassword.trim() : null;
    const trimmedAuditLogPassword = auditLogPasswordFromEnv ? auditLogPasswordFromEnv.trim() : '';


    if (trimmedEnteredPassword && trimmedEnteredPassword === trimmedAuditLogPassword) {
      // Password is correct
      if (typeof window !== 'undefined') {
        localStorage.setItem('auditLogAuthenticated', 'true'); // Set flag for page to check
      }
      addAuditLog('SECURITY_ACCESS_GRANTED', 'Security', 'Audit Log access granted via sidebar prompt.');
      // Allow navigation (NextLink will handle it by not calling e.preventDefault())
    } else {
      e.preventDefault(); // Prevent navigation
      if (enteredPassword !== null) { // User entered something (even if it's wrong after trimming or empty string)
        addAuditLog('SECURITY_ACCESS_DENIED', 'Security', 'Audit Log access denied: Incorrect password entered via sidebar prompt.');
        alert("Incorrect password. Access denied.");
      } else { // User cancelled the prompt (enteredPassword will be null)
        addAuditLog('SECURITY_ACCESS_CANCELLED', 'Security', 'Audit Log access attempt cancelled by user via sidebar prompt.');
      }
    }
  };

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
                                {/* Link to Previous Logs page */}
                                <SidebarMenuButton href="/previous-logs" isActive={pathname === '/previous-logs'} tooltip="Previous Logs">
                                    <History />
                                    <span>Previous Logs</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </div>

                        {/* Audit Log at the bottom of the main navigation section */}
                        <div>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    href="/audit-log"
                                    isActive={pathname === '/audit-log'}
                                    tooltip="Audit Log (Protected)"
                                    onClick={handleAuditLogClick}
                                >
                                    <Lock /> {/* Changed icon to Lock */}
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
