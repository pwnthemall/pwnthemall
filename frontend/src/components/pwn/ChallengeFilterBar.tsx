import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutGrid, Table2 } from "lucide-react";

interface ChallengeFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  categoryFilter: string[];
  onCategoryFilterChange: (categories: string[]) => void;
  solveFilter: 'all' | 'solved' | 'unsolved';
  onSolveFilterChange: (filter: 'all' | 'solved' | 'unsolved') => void;
  categories: string[];
  t: (key: string) => string;
  loading?: boolean;
  viewMode?: 'table' | 'grid';
  onViewModeChange?: (mode: 'table' | 'grid') => void;
}

export function ChallengeFilterBar({
  query,
  onQueryChange,
  categoryFilter,
  onCategoryFilterChange,
  solveFilter,
  onSolveFilterChange,
  categories,
  t,
  loading = false,
  viewMode = 'grid',
  onViewModeChange,
}: ChallengeFilterBarProps) {
  const cycleSolveFilter = () => {
    if (solveFilter === 'all') onSolveFilterChange('solved');
    else if (solveFilter === 'solved') onSolveFilterChange('unsolved');
    else onSolveFilterChange('all');
  };

  if (loading && categories.length === 0) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <Skeleton className="h-7 w-24" />
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Skeleton className="h-10 w-full sm:w-64" />
          <Skeleton className="h-10 w-full sm:w-48" />
          <Skeleton className="h-10 w-full sm:w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <h2 className="text-xl font-semibold">
        {t("browse") !== "browse" ? t("browse") : "Browse"}
      </h2>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("search") !== "search" ? t("search") : "Search"}
          className="w-full sm:w-64"
          disabled={loading}
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full sm:w-48 justify-start text-left font-normal"
              disabled={loading}
            >
              {categoryFilter.length === 0
                ? (t("all_categories") !== "all_categories" ? t("all_categories") : "All categories")
                : categoryFilter.length === 1
                ? categoryFilter[0]
                : `${categoryFilter.length} ${t("categories") !== "categories" ? t("categories") : "categories"}`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="all-categories"
                  checked={categoryFilter.length === 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onCategoryFilterChange([]);
                    }
                  }}
                />
                <label
                  htmlFor="all-categories"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {t("all_categories") !== "all_categories" ? t("all_categories") : "All categories"}
                </label>
              </div>
              <div className="border-t pt-2 space-y-2">
                {categories.map((name) => (
                  <div key={name} className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${name}`}
                      checked={categoryFilter.includes(name)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onCategoryFilterChange([...categoryFilter, name]);
                        } else {
                          onCategoryFilterChange(categoryFilter.filter(c => c !== name));
                        }
                      }}
                    />
                    <label
                      htmlFor={`category-${name}`}
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant={solveFilter !== 'all' ? "default" : "outline"}
          onClick={cycleSolveFilter}
          disabled={loading}
        >
          {solveFilter === 'all' 
            ? (t("all") !== "all" ? t("all") : "All")
            : solveFilter === 'solved'
            ? (t("solved_only") !== "solved_only" ? t("solved_only") : "Solved only")
            : (t("unsolved_only") !== "unsolved_only" ? t("unsolved_only") : "Unsolved only")}
        </Button>

        {onViewModeChange && (
          <div className="flex gap-1 border rounded-md p-1">
            <Button
              type="button"
              variant={viewMode === 'grid' ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange('grid')}
              disabled={loading}
              className="px-2"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === 'table' ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange('table')}
              disabled={loading}
              className="px-2"
            >
              <Table2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
