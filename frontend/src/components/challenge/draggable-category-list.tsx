import React from 'react';
import Link from 'next/link';
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

interface DraggableCategoryItem {
  id: string | number;
  title: string;
  url: string;
}

interface SortableItemProps {
  id: string | number;
  title: string;
  url: string;
  isDragOverlay?: boolean;
}

function SortableItem({ id, title, url, isDragOverlay = false }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragOverlay) {
    return (
      <div className="flex items-center rounded-lg text-sm bg-sidebar-accent text-sidebar-accent-foreground shadow-lg border border-sidebar-border">
        <div className="flex items-center justify-center w-6 h-6 p-1">
          <GripVertical className="w-3 h-3" />
        </div>
        <div className="flex-1 p-2 pl-1 font-medium">
          {title}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center rounded-lg text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group transition-colors",
        isDragging && "opacity-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="flex items-center justify-center w-6 h-6 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-3 h-3 text-muted-foreground" />
      </button>
      <Link
        href={url}
        className="flex-1 p-2 pl-1 block rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        {title}
      </Link>
    </div>
  );
}

interface DraggableCategoryListProps {
  items: DraggableCategoryItem[];
  onReorder: (items: DraggableCategoryItem[]) => void;
  className?: string;
}

export function DraggableCategoryList({ items, onReorder, className }: DraggableCategoryListProps) {
  const [activeId, setActiveId] = React.useState<string | number | null>(null);
  
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
    setActiveId(event.active.id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over?.id);
      
      const newItems = arrayMove(items, oldIndex, newIndex);
      onReorder(newItems);
    }
    
    setActiveId(null);
  }

  const activeItem = activeId ? items.find(item => item.id === activeId) : null;

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
        <div className={cn("space-y-1", className)}>
          {items.map((item) => (
            <SortableItem
              key={item.id}
              id={item.id}
              title={item.title}
              url={item.url}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeItem && (
          <SortableItem
            id={activeItem.id}
            title={activeItem.title}
            url={activeItem.url}
            isDragOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
