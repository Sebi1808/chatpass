
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Bot, ChevronDown, ChevronUp, Download, LinkIcon, MessageSquare, Play, Pause, QrCode, Users, Settings, Zap, Volume2, VolumeX, Copy } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { scenarios } from "@/lib/scenarios";
import type { Scenario } from "@/lib/types";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface AdminSessionDashboardPageProps {
  params: { sessionId: string };
}

export default function AdminSessionDashboardPage({ params }: AdminSessionDashboardPageProps) {
  const { toast } = useToast();
  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [invitationLink, setInvitationLink] = useState<string>("");

  useEffect(() => {
    const scenario = scenarios.find(s => s.id === params.sessionId);
    setCurrentScenario(scenario);
    if (typeof window !== "undefined") {
      setInvitationLink(`${window.location.origin}/join/${params.sessionId}`);
    }
  }, [params.sessionId]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(invitationLink).then(() => {
      toast({ title: "Link kopiert!", description: "Der Einladungslink wurde in die Zwischenablage kopiert." });
    }).catch(err => {
      toast({ variant: "destructive", title: "Fehler", description: "Link konnte nicht kopiert werden." });
      console.error('Failed to copy: ', err);
    });
  };

  // Placeholder data and functions
  const participants = [ // This would eventually be dynamic
    { id: "1", name: "Schüler Max", role: "Teilnehmer A", isMuted: false, isBot: false },
    { id: "2", name: "Schülerin Anna", role: "Teilnehmer B", isMuted: true, isBot: false },
    { id: "3", name: "Bot Provokateur", role: "Bot", isBot: true, status: "Aktiv", escalation: 2 },
    { id: "4", name: "Bot Verteidiger", role: "Bot", isBot: true, status: "Inaktiv", escalation: 0 },
  ];

  const scenarioTitle = currentScenario?.title || "Szenario wird geladen...";

  const getBotName = (index: number, personalityType?: 'provokateur' | 'verteidiger' | 'informant'): string => {
    if (personalityType) {
      switch (personalityType) {
        case 'provokateur': return 'Bot Provokateur';
        case 'verteidiger': return 'Bot Verteidiger';
        case 'informant': return 'Bot Informant';
        default: return `Bot ${index + 1}`;
      }
    }
    // Fallback or default naming if personalities are not yet defined for each bot
    return `Bot ${index + 1} (${currentScenario?.defaultBotsConfig?.[index]?.personality || 'Standard'})`;
  };


  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">
            Live Dashboard: <span className="text-foreground">{scenarioTitle}</span>
          </h1>
          <p className="text-muted-foreground">Sitzungs-ID: {params.sessionId}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Buttons moved to the "Sitzungseinstellungen & Einladung" card */}
          <Button variant="destructive"><Pause className="mr-2 h-4 w-4" /> Sitzung beenden</Button>
        </div>
      </div>
      <Separator />

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Chat Preview & Controls */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><Settings className="mr-2 h-5 w-5 text-primary" /> Sitzungseinstellungen & Einladung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="font-semibold">Vordefinierte Rollen für dieses Szenario:</Label>
                <p className="text-sm text-muted-foreground">
                  {currentScenario ? `${currentScenario.standardRollen - currentScenario.defaultBots} Teilnehmer, ${currentScenario.defaultBots} Bot(s)` : 'Laden...'}
                </p>
                {/* Future: Add UI for custom role definition here */}
              </div>
              <div>
                <Label htmlFor="invitation-link" className="font-semibold">Einladungslink:</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input id="invitation-link" type="text" value={invitationLink} readOnly className="bg-muted" />
                  <Button variant="outline" size="icon" onClick={copyToClipboard} aria-label="Link kopieren">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button variant="outline" onClick={() => alert("QR-Code Anzeige ist noch nicht implementiert.")}>
                <QrCode className="mr-2 h-4 w-4" /> QR-Code anzeigen
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><MessageSquare className="mr-2 h-5 w-5 text-primary" /> Chat-Verlauf (Live-Vorschau)</CardTitle>
              <CardDescription>Beobachten Sie die laufende Diskussion.</CardDescription>
            </CardHeader>
            <CardContent className="h-96 bg-muted/30 rounded-md p-4 overflow-y-auto">
              <p className="text-sm text-muted-foreground">[Simulierte Chat-Nachrichten hier]</p>
              <div className="mt-2 p-2 border border-dashed rounded">
                <p className="text-xs"><strong>Bot Provokateur:</strong> Das ist doch alles übertrieben!</p>
                <p className="text-xs"><strong>Schüler Max:</strong> Finde ich nicht, das verletzt Gefühle.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><Settings className="mr-2 h-5 w-5 text-primary" /> Pace & Allgemeine Steuerung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label htmlFor="pace-slider" className="mb-2 block">Pace-Regler (Cool-down: <span className="font-bold text-primary">5s</span>)</Label>
                    <Slider defaultValue={[5]} max={10} step={1} id="pace-slider" />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="simulation-active" className="text-base">Simulation Aktiv</Label>
                    <Switch id="simulation-active" defaultChecked />
                </div>
                 <div className="flex items-center space-x-2">
                    <Button variant="outline"><Play className="mr-2 h-4 w-4" /> Globale Pause</Button>
                    <Button variant="destructive"><AlertCircle className="mr-2 h-4 w-4" /> Alle Stummschalten</Button>
                </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Participants & Bots */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" /> Teilnehmende ({participants.filter(p => !p.isBot).length})</CardTitle>
            </CardHeader>
            <CardContent className="max-h-64 overflow-y-auto space-y-3">
              {participants.filter(p => !p.isBot).map(p => (
                <div key={p.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-md">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.role}</p>
                  </div>
                  <Button variant={p.isMuted ? "secondary" : "outline"} size="sm" onClick={() => alert(`Mute/Unmute ${p.name}`)}>
                    {p.isMuted ? <VolumeX className="mr-1 h-4 w-4" /> : <Volume2 className="mr-1 h-4 w-4" />}
                    {p.isMuted ? "Entstummen" : "Stumm"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><Bot className="mr-2 h-5 w-5 text-primary" /> Bot-Steuerung ({currentScenario?.defaultBots || 0})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentScenario && Array.from({ length: currentScenario.defaultBots }).map((_, index) => {
                 const botConfig = currentScenario.defaultBotsConfig?.[index];
                 const botName = getBotName(index, botConfig?.personality);
                 // Placeholder status and escalation, should come from dynamic state
                 const botStatus = index === 0 ? "Aktiv" : "Inaktiv"; 
                 const botEscalation = index === 0 ? 2 : 0;

                return (
                  <div key={`bot-${index}`} className="p-3 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{botName} <Badge variant={botStatus === "Aktiv" ? "default" : "outline"}>{botStatus}</Badge></p>
                      <Switch checked={botStatus === "Aktiv"} onCheckedChange={() => alert(`Toggle Bot ${botName}`)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Eskalationslevel: {botEscalation}</Label>
                      <Progress value={botEscalation * 33.33} className="h-2" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => alert(`Eskalieren ${botName}`)}><ChevronUp className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => alert(`Deeskalieren ${botName}`)}><ChevronDown className="h-4 w-4" /></Button>
                      <Button variant="secondary" size="sm" className="flex-1" onClick={() => alert(`Manuell Posten ${botName}`)}>Posten</Button>
                    </div>
                    <div className="flex items-center space-x-2 pt-1">
                      <Label htmlFor={`autotimer-bot-${index}`} className="text-xs">Auto-Timer</Label>
                      <Switch id={`autotimer-bot-${index}`} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><Download className="mr-2 h-5 w-5 text-primary" /> Datenexport</CardTitle>
            </CardHeader>
            <CardContent>
                <Button className="w-full" onClick={() => alert("CSV Export gestartet...")}>
                    Chat-Protokoll als CSV herunterladen
                </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

