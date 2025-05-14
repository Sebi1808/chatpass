
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/icons/logo";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Mail, User, ArrowLeft, ShieldAlert } from "lucide-react";
import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const initialRole = searchParams.get("role") || "admin";
  const [adminUsername, setAdminUsername] = useState("");

  const handleAdminLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (adminUsername.trim().toLowerCase() === "admin") {
      toast({
        title: "Login erfolgreich",
        description: "Sie werden zum Admin-Dashboard weitergeleitet.",
      });
      router.push("/admin");
    } else {
      toast({
        variant: "destructive",
        title: "Login fehlgeschlagen",
        description: "Ungültiger Benutzername.",
      });
    }
  };

  const handleGuestLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // In a real app, this would register the guest
    toast({
        title: "Gast-Login (simuliert)",
        description: "Sie können nun teilnehmen.",
    });
    // Guests would typically be redirected via a session link,
    // for now, a placeholder redirect or message.
    // router.push("/chat/some-session-id"); // Example redirect
  };


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Link href="/" className="absolute top-4 left-4 sm:top-8 sm:left-8">
        <Button variant="ghost" size="icon">
          <ArrowLeft className="h-6 w-6" />
          <span className="sr-only">Zurück zur Startseite</span>
        </Button>
      </Link>
      <div className="mb-8">
        <Logo className="h-12 w-auto" />
      </div>
      <Tabs defaultValue={initialRole} className="w-full max-w-md">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="admin">Admin Login</TabsTrigger>
          <TabsTrigger value="guest">Gastzugang</TabsTrigger>
        </TabsList>
        <TabsContent value="admin">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" /> Admin Login</CardTitle>
              <CardDescription>
                Geben Sie &quot;admin&quot; als Benutzernamen ein, um sich anzumelden.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleAdminLogin}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="adminUsername">Benutzername</Label>
                  <Input
                    id="adminUsername"
                    type="text"
                    placeholder="admin"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full">Anmelden</Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
        <TabsContent value="guest">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Gastzugang</CardTitle>
              <CardDescription>
                Nehmen Sie mit Ihrem Namen an einer Sitzung teil. Sie benötigen einen Einladungslink oder QR-Code.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleGuestLogin}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="guestName">Ihr Name</Label>
                  <Input id="guestName" type="text" placeholder="Max Mustermann" required />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full">Teilnehmen</Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
