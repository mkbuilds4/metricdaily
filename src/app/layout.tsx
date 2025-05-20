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
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { Home, Settings, List, History, BarChart3, HelpCircle, Upload, Download, Loader2, LogOut } from 'lucide-react'; // Added Loader2 for loading state and LogOut for logout
import { usePathname } from 'next/navigation';
import { cn } from "@/lib/utils";
import { ThemeProvider } from '@/components/ThemeProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button'; // Import Button for loading state
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
});

// Lazy load TutorialDialog
const TutorialDialog = dynamic(() => import('@/components/TutorialDialog'), {
  ssr: false, // It's a client-side dialog
  loading: () => ( // Optional: Show a placeholder while loading
    <Button variant="ghost" size="icon" disabled>
      <Loader2 className="h-5 w-5 animate-spin" />
    </Button>
  ),
});

function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const isAuthPage = pathname === '/login' || pathname === '/register';
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthPage && user) {
    return (
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
                    <SidebarMenuButton href="/settings" isActive={pathname === '/settings' || pathname === '/import-data'} tooltip="Settings / Data">
                      <Settings />
                      <span>Settings / Data</span>
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
          <SidebarFooter className="flex flex-col gap-2 p-2">
            <div className="flex items-center justify-between">
              <TutorialDialog />
              <ThemeToggle />
            </div>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </Button>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="overflow-y-auto h-screen">
          <main className="p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <main>
      {children}
    </main>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <AuthProvider>
          <ThemeProvider
            defaultTheme="system"
            storageKey="metric-daily-theme"
          >
            <AppContent>
              {children}
            </AppContent>
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
