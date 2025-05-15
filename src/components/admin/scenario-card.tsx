
import type { Scenario } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Bot,
  NotebookPen,
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
  type LucideIcon,
  Image as ImageIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type React from 'react';
import Link from 'next/link';
import Image from 'next/image'; // Import next/image

interface ScenarioCardProps {
  scenario: Scenario;
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
  ImageIcon, // Default/fallback icon
};

const renderTagContent = (tag: string | { name?: any; [key: string]: any }): string => {
  if (typeof tag === 'string') {
    return tag;
  }
  // Attempt to access tag.name if it's an object, otherwise return a fallback.
  if (tag && typeof tag.name === 'string') {
    return tag.name;
  }
  // Fallback for unexpected tag structures
  if (tag && typeof (tag as any).value === 'string') {
    return (tag as any).value;
  }
  return 'Invalid Tag';
};


export function ScenarioCard({ scenario }: ScenarioCardProps) {
  const IconComponent = scenario.iconName && iconMap[scenario.iconName] ? iconMap[scenario.iconName] : ImageIcon; // Fallback to ImageIcon

  return (
    <Card className="flex flex-col h-full shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
      {scenario.previewImageUrl && (
        <div className="relative w-full h-40 md:h-48 rounded-t-lg overflow-hidden">
          <Image
            src={scenario.previewImageUrl}
            alt={`Vorschau für ${scenario.title}`}
            layout="fill"
            objectFit="cover"
            className="rounded-t-lg"
            data-ai-hint="scenario preview"
          />
        </div>
      )}
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
          <span>{scenario.humanRolesConfig?.length || 0} Teilnehmer-Rollen</span>
        </div>
        <div className="flex items-center text-muted-foreground">
          <Bot className="h-4 w-4 mr-2 text-primary/80" />
          <span>{scenario.defaultBotsConfig?.length || 0} Bot(s)</span>
        </div>
        {scenario.tags && scenario.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {scenario.tags.slice(0, 5).map((tag, index) => ( // Show max 5 tags for brevity
              <Badge
                key={typeof tag === 'string' ? tag : (tag as any)?.id || `tag-${index}`}
                variant="secondary"
                className="text-xs"
              >
                {renderTagContent(tag)}
              </Badge>
            ))}
            {scenario.tags.length > 5 && <Badge variant="outline" className="text-xs">...</Badge>}
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
        <Link href={`/admin/session-dashboard/${scenario.id}`} passHref legacyBehavior>
          <Button
              size="sm"
              className="w-full sm:w-auto"
          >
            <PlayCircle className="mr-2 h-4 w-4" />
            Simulation starten
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
