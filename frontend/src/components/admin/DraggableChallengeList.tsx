import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Challenge } from '@/models/Challenge';

interface SortableItemProps {
  challenge: Challenge;
  isDragOverlay?: boolean;
}

function SortableItem({ challenge, isDragOverlay = false }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: challenge.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty?.toLowerCase()) {
      case "easy":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
      case "hard":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100";
    }
  };

  if (isDragOverlay) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-card border-2 border-primary shadow-lg">
        <div className="flex items-center justify-center w-6 h-6">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="font-medium">{challenge.name}</div>
          <div className="flex items-center gap-2 mt-1">
            {challenge.challengeDifficulty && (
              <Badge className={getDifficultyColor(challenge.challengeDifficulty.name)} variant="secondary">
                {challenge.challengeDifficulty.name}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">{challenge.points} pts</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg bg-card border hover:border-primary transition-all cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-center justify-center w-6 h-6">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <div className="font-medium">{challenge.name}</div>
        <div className="flex items-center gap-2 mt-1">
          {challenge.challengeDifficulty && (
            <Badge className={getDifficultyColor(challenge.challengeDifficulty.name)} variant="secondary">
              {challenge.challengeDifficulty.name}
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">{challenge.points} pts</span>
          {challenge.hidden && (
            <Badge variant="destructive">Hidden</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

interface DraggableChallengeListProps {
  challenges: Challenge[];
  onReorder: (challenges: Challenge[]) => void;
  className?: string;
}

export function DraggableChallengeList({ challenges, onReorder, className }: DraggableChallengeListProps) {
  const [activeId, setActiveId] = React.useState<number | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement to start dragging
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = challenges.findIndex(c => c.id === active.id);
      const newIndex = challenges.findIndex(c => c.id === over?.id);
      
      const newChallenges = arrayMove(challenges, oldIndex, newIndex);
      onReorder(newChallenges);
    }
    
    setActiveId(null);
  }

  const activeChallenge = activeId ? challenges.find(c => c.id === activeId) : null;

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={challenges.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div className={cn("space-y-2", className)}>
          {challenges.map((challenge) => (
            <SortableItem
              key={challenge.id}
              challenge={challenge}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeChallenge && (
          <SortableItem
            challenge={activeChallenge}
            isDragOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
