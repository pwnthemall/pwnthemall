/**
 * Custom hook for managing challenge filtering, sorting, and searching
 * Extracted from CategoryContent.tsx to improve maintainability and testability
 */

import { useMemo, useState, useCallback } from 'react';
import { Challenge } from '@/models/Challenge';

type SortColumn = 'category' | 'name' | 'difficulty' | 'points' | 'solves' | 'status';
type SortOrder = 'asc' | 'desc';
type SolveFilter = 'all' | 'solved' | 'unsolved';

interface UseChallengeFiltersProps {
  challenges: Challenge[];
  initialCategory?: string;
}

interface ChallengeFiltersResult {
  // State
  query: string;
  categoryFilter: string[];
  solveFilter: SolveFilter;
  sortBy: SortColumn;
  sortOrder: SortOrder;
  
  // Setters
  setQuery: (query: string) => void;
  setCategoryFilter: (categories: string[]) => void;
  setSolveFilter: (filter: SolveFilter) => void;
  handleSort: (column: SortColumn) => void;
  
  // Computed
  filteredChallenges: Challenge[];
  categories: string[];
}

export const useChallengeFilters = ({
  challenges,
  initialCategory,
}: UseChallengeFiltersProps): ChallengeFiltersResult => {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string[]>(
    initialCategory ? [initialCategory] : []
  );
  const [solveFilter, setSolveFilter] = useState<SolveFilter>('all');
  const [sortBy, setSortBy] = useState<SortColumn>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Handle sorting - toggle order if same column, otherwise reset to asc
  const handleSort = useCallback((column: SortColumn) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  }, [sortBy, sortOrder]);

  // Extract unique categories from challenges
  const categories = useMemo(() => {
    const names = (challenges || [])
      .map((c) => c.challengeCategory?.name)
      .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [challenges]);

  // Filter and sort challenges
  const filteredChallenges = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    
    return (challenges || [])
      .filter((challenge) => {
        // Category filter: if any categories selected, challenge must match one of them
        if (categoryFilter.length > 0 && !categoryFilter.includes(challenge.challengeCategory?.name || '')) {
          return false;
        }
        
        // Solve filter
        if (solveFilter === 'solved' && !challenge.solved) {
          return false;
        }
        if (solveFilter === 'unsolved' && challenge.solved) {
          return false;
        }
        
        // Search filter
        if (!normalizedQuery) return true;

        const haystack = [
          challenge.name,
          challenge.description,
          challenge.author,
          challenge.challengeCategory?.name,
          challenge.challengeDifficulty?.name,
          challenge.challengeType?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
          
        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        let aValue: any, bValue: any;

        switch (sortBy) {
          case 'category':
            aValue = a.challengeCategory?.name || '';
            bValue = b.challengeCategory?.name || '';
            break;
          case 'name':
            aValue = a.name || '';
            bValue = b.name || '';
            break;
          case 'difficulty':
            aValue = a.challengeDifficulty?.name || '';
            bValue = b.challengeDifficulty?.name || '';
            break;
          case 'points':
            aValue = typeof a.currentPoints === 'number' ? a.currentPoints : (typeof a.points === 'number' ? a.points : 0);
            bValue = typeof b.currentPoints === 'number' ? b.currentPoints : (typeof b.points === 'number' ? b.points : 0);
            break;
          case 'solves':
            aValue = typeof a.solveCount === 'number' ? a.solveCount : 0;
            bValue = typeof b.solveCount === 'number' ? b.solveCount : 0;
            break;
          case 'status':
            aValue = a.solved ? 2 : (a.locked ? 0 : 1);
            bValue = b.solved ? 2 : (b.locked ? 0 : 1);
            break;
          default:
            return 0;
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue, 'en', { sensitivity: 'base' });
          return sortOrder === 'asc' ? comparison : -comparison;
        } else {
          const comparison = aValue - bValue;
          return sortOrder === 'asc' ? comparison : -comparison;
        }
      });
  }, [challenges, categoryFilter, query, solveFilter, sortBy, sortOrder]);

  return {
    query,
    categoryFilter,
    solveFilter,
    sortBy,
    sortOrder,
    setQuery,
    setCategoryFilter,
    setSolveFilter,
    handleSort,
    filteredChallenges,
    categories,
  };
};
