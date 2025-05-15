
import type { Scenario } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Bot,
  NotebookPen, // Changed from Info
  PlayCircle,
  ShieldAlert,
  Code2,
  MessageSquare,
  Annoyed,
  Zap,
  Film,
  ShoppingBag,
  Lock,
  BotMessageSquare,
  type LucideIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type React from 'react';
import Link from 'next/link';

interface ScenarioCardProps {
  scenario: Scenario;
  onStartSimulation: (scenarioId: string) => void;
}

const iconMap: Record<string, LucideIcon> = {
  ShieldAlert,
  Code2,
  MessageSquare,
  Annoyed,
  Zap,
  Users,
  Film,
  ShoppingBag,
  Lock,
  BotMessageSquare,
};

const renderTagContent = (tag: string | { name?: any; [key: string]: any }): string => {
  if (typeof tag === 'string') {
    return tag;
  }
  if (tag && typeof tag.name === 'string') {
    return tag.name;
  }
  return 'Invalid Tag';
};

export function ScenarioCard({ scenario, onStartSimulation }: ScenarioCardProps) {
  const IconComponent = scenario.iconName ? iconMap[scenario.iconName] : null;

  return (
    <Card className="flex flex-col h-full shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-xl font-semibold leading-tight flex items-center">
            {IconComponent && <IconComponent className="h-6 w-6 mr-3 text-primary shrink-0" />}
            {typeof scenario.title === 'string' ? scenario.title : 'Invalid Title'}
          </CardTitle>
        </div>
        <CardDescription className="text-sm text-muted-foreground line-clamp-3 min-h-[3.75rem]">
          {typeof scenario.kurzbeschreibung === 'string' ? scenario.kurzbeschreibung : 'No description'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-3 text-sm">
        <div className="flex items-center text-muted-foreground">
          <Users className="h-4 w-4 mr-2 text-primary/80" />
          <span>{scenario.standardRollen} Standard-Rollen</span>
        </div>
        <div className="flex items-center text-muted-foreground">
          <Bot className="h-4 w-4 mr-2 text-primary/80" />
          <span>{scenario.defaultBots} Default-Bot(s)</span>
        </div>
        {scenario.tags && scenario.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {scenario.tags.map((tag, index) => (
              <Badge 
                key={typeof tag === 'string' ? tag : (tag as any)?.id || `tag-${index}`} 
                variant="secondary" 
                className="text-xs"
              >
                {renderTagContent(tag)}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row sm:justify-between gap-2 pt-4">
        <Link href={`/admin/scenario-editor/${scenario.id}`} passHref legacyBehavior>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
              <NotebookPen className="mr-2 h-4 w-4" />
              Bearbeiten
          </Button>
        </Link>
        <Button 
            size="sm" 
            className="w-full sm:w-auto" 
            onClick={() => onStartSimulation(scenario.id)} 
        >
          <PlayCircle className="mr-2 h-4 w-4" />
          Simulation starten
        </Button>
      </CardFooter>
    </Card>
  );
}
