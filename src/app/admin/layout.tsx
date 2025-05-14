
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Logo } from '@/components/icons/logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LayoutGrid, MessageCircle, Settings, LogOut, Home, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { scenarios } from '@/lib/scenarios';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const firstScenarioId = scenarios.length > 0 ? scenarios[0].id : '1'; // Use first scenario or fallback

  return (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarHeader className="p-4">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="block group-data-[collapsible=icon]:hidden">
              <Logo />
            </Link>
             {/* SidebarTrigger is now part of the Sidebar component's internal logic for desktop, 
                 but we might need a manual one if we want it *inside* the header when collapsed for icon mode */}
            <div className="block group-data-[collapsible=icon]:hidden">
              <SidebarTrigger />
            </div>
             {/* Explicit trigger for icon mode, always visible in header */}
            <div className="hidden group-data-[collapsible=icon]:block">
                <SidebarTrigger />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/admin" legacyBehavior passHref>
                <SidebarMenuButton tooltip="Szenarien">
                  <LayoutGrid />
                  <span>Szenarien</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href={`/admin/session-dashboard/${firstScenarioId}`} legacyBehavior passHref>
                <SidebarMenuButton tooltip="Aktive Simulation">
                  <MessageCircle />
                  <span>Aktive Simulation</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="#" legacyBehavior passHref>
                <SidebarMenuButton tooltip="Einstellungen">
                  <Settings />
                  <span>Einstellungen</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        {/* Footer can be added here if needed */}
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
            <div className="md:hidden"> {/* Mobile trigger - visible when sidebar is part of Sheet */}
                <SidebarTrigger />
            </div>
             <div className="hidden md:block group-data-[variant=sidebar]:group-data-[collapsible=offcanvas]:group-data-[state=collapsed]:block">
                {/* This trigger is for when the sidebar is fully off-canvas collapsed on desktop */}
                <SidebarTrigger />
            </div>
            <div className="flex-1">
                {/* Could add breadcrumbs or page title here */}
            </div>
            <div className="flex items-center gap-4">
                <Link href="/" passHref legacyBehavior>
                    <Button variant="ghost" size="icon" aria-label="Startseite">
                        <Home className="h-5 w-5" />
                    </Button>
                </Link>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src="https://placehold.co/100x100.png" alt="Admin Avatar" data-ai-hint="person user" />
                                <AvatarFallback>AD</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none">Admin User</p>
                            <p className="text-xs leading-none text-muted-foreground">
                            admin@schule.de
                            </p>
                        </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Abmelden</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
