import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type TodoStatus = "pending" | "in_progress" | "completed";

export interface TodoItem {
  id: string;
  label: string;
  status: TodoStatus;
}

type TodoContextValue = {
  items: TodoItem[];
  setItems: (items: TodoItem[], shouldExpand?: boolean) => void;
  updateItem: (id: string, status: TodoStatus) => void;
  clearAll: () => void;
  isExpanded: boolean;
  toggleExpanded: () => void;
};

const TodoContext = createContext<TodoContextValue | null>(null);

export function useTodo(): TodoContextValue {
  const value = useContext(TodoContext);
  if (!value) {
    throw new Error("useTodo must be used within a TodoProvider");
  }
  return value;
}

type Props = { children: ReactNode };

export function TodoProvider({ children }: Props) {
  const [items, setItemsState] = useState<TodoItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const setItems = useCallback((newItems: TodoItem[], shouldExpand = false) => {
    setItemsState(newItems);
    if (shouldExpand && newItems.length > 0) {
      setIsExpanded(true);
    }
  }, []);

  const updateItem = useCallback((id: string, status: TodoStatus) => {
    setItemsState((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item)),
    );
  }, []);

  const clearAll = useCallback(() => {
    setItemsState([]);
    setIsExpanded(false);
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <TodoContext.Provider
      value={{
        items,
        setItems,
        updateItem,
        clearAll,
        isExpanded,
        toggleExpanded,
      }}
    >
      {children}
    </TodoContext.Provider>
  );
}
