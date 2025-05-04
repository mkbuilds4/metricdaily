
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Home, Settings, List } from 'lucide-react'; // Import icons

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Metric Daily',
  description: 'Track your daily metrics.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SidebarProvider defaultOpen={true}>
          <Sidebar side="left" variant="sidebar" collapsible="icon">
            <SidebarHeader>
                <SidebarTrigger />
                {/* Can add Logo/Title here if needed */}
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    <SidebarMenuItem>
                         {/* Placeholder link to dashboard (current view) */}
                        <SidebarMenuButton href="/" isActive={true} tooltip="Dashboard">
                            <Home />
                            <span>Dashboard</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                     {/* Add placeholders for future sections */}
                    <SidebarMenuItem>
                        <SidebarMenuButton href="#" tooltip="Log Input">
                            <List />
                            <span>Log Input</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton href="#" tooltip="Manage Targets">
                             <Settings />
                            <span>Manage Targets</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    {/* Add placeholder for Weekly Averages */}
                    {/* <SidebarMenuItem>
                        <SidebarMenuButton href="#" tooltip="Weekly Averages">
                            <BarChart />
                            <span>Weekly Averages</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem> */}
                </SidebarMenu>
            </SidebarContent>
            {/* <SidebarFooter>
              <SidebarMenuButton href="#" tooltip="Settings">
                  <Settings />
                  <span>Settings</span>
              </SidebarMenuButton>
            </SidebarFooter> */}
          </Sidebar>
          <SidebarInset>
            <div className="p-4 md:p-8 lg:p-12"> {/* Add padding to the inset area */}
                 {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
