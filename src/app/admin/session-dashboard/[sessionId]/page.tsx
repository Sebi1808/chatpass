import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Bot, ChevronDown, ChevronUp, Download, LinkIcon, MessageSquare, Play, Pause, QrCode, Users, Settings, Zap, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface AdminSessionDashboardPageProps {
  params: { sessionId: string };
}

export default function AdminSessionDashboardPage({ params }: AdminSessionDashboardPageProps) {
  // Placeholder data and functions
  const scenarioTitle = "Hate-Speech Simulation";
  const participants = [
    { id: "1", name: "Schüler Max", role: "Teilnehmer A", isMuted: false },
    { id: "2", name: "Schülerin Anna", role: "Teilnehmer B", isMuted: true },
    { id: "3", name: "Bot Provokateur", role: "Bot", isBot: true, status: "Aktiv", escalation: 2 },
    { id: "4", name: "Bot Verteidiger", role: "Bot", isBot: true, status: "Inaktiv", escalation: 0 },
  ];

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
          <Button variant="outline"><LinkIcon className="mr-2 h-4 w-4" /> Einladungslink</Button>
          <Button variant="outline"><QrCode className="mr-2 h-4 w-4" /> QR-Code</Button>
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
              <CardTitle className="flex items-center"><Bot className="mr-2 h-5 w-5 text-primary" /> Bot-Steuerung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {participants.filter(p => p.isBot).map(bot => (
                <div key={bot.id} className="p-3 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{bot.name} <Badge variant={bot.status === "Aktiv" ? "default" : "outline"}>{bot.status}</Badge></p>
                    <Switch checked={bot.status === "Aktiv"} onCheckedChange={() => alert(`Toggle Bot ${bot.name}`)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Eskalationslevel: {bot.escalation}</Label>
                    <Progress value={(bot.escalation || 0) * 33.33} className="h-2" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => alert(`Eskalieren ${bot.name}`)}><ChevronUp className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => alert(`Deeskalieren ${bot.name}`)}><ChevronDown className="h-4 w-4" /></Button>
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => alert(`Manuell Posten ${bot.name}`)}>Posten</Button>
                  </div>
                  <div className="flex items-center space-x-2 pt-1">
                    <Label htmlFor={`autotimer-${bot.id}`} className="text-xs">Auto-Timer</Label>
                    <Switch id={`autotimer-${bot.id}`} />
                  </div>
                </div>
              ))}
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
