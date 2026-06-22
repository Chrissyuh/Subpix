import { createContext, createElement, useContext, useMemo, useReducer, type ReactElement, type ReactNode } from "react";
import {
  cloneSubpixDocument,
  createDefaultSubpixDocument,
  getWidthSubpixels,
  type SubpixDocument
} from "@/format/subpixTypes";

interface DocumentStoreState {
  currentDocument: SubpixDocument;
  filePath: string | null;
  isDirty: boolean;
  past: SubpixDocument[];
  future: SubpixDocument[];
  strokeStart: SubpixDocument | null;
}

interface DocumentStoreActions {
  loadDocument: (document: SubpixDocument, filePath: string | null) => void;
  newDocument: () => void;
  setSavedPath: (filePath: string) => void;
  beginStroke: () => void;
  paintCell: (x: number, y: number, intensity: number) => void;
  endStroke: () => void;
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
}

interface DocumentStoreValue {
  state: DocumentStoreState;
  actions: DocumentStoreActions;
}

type Action =
  | { type: "load"; document: SubpixDocument; filePath: string | null }
  | { type: "new" }
  | { type: "saved"; filePath: string }
  | { type: "begin-stroke" }
  | { type: "paint-cell"; x: number; y: number; intensity: number }
  | { type: "end-stroke" }
  | { type: "clear" }
  | { type: "undo" }
  | { type: "redo" };

const initialState: DocumentStoreState = {
  currentDocument: createDefaultSubpixDocument(),
  filePath: null,
  isDirty: false,
  past: [],
  future: [],
  strokeStart: null
};

function documentsEqual(left: SubpixDocument, right: SubpixDocument): boolean {
  if (left.layers.length !== right.layers.length) {
    return false;
  }

  return left.layers.every((layer, layerIndex) => {
    const nextLayer = right.layers[layerIndex];
    return layer.data.length === nextLayer.data.length && layer.data.every((value, index) => value === nextLayer.data[index]);
  });
}

function replaceCell(document: SubpixDocument, x: number, y: number, intensity: number): SubpixDocument {
  const widthSubpixels = getWidthSubpixels(document);
  const index = y * widthSubpixels + x;
  const layer = document.layers[0];

  if (!layer || layer.data[index] === intensity) {
    return document;
  }

  const nextDocument = cloneSubpixDocument(document);
  nextDocument.layers[0].data[index] = intensity;
  return nextDocument;
}

function clearDocument(document: SubpixDocument): SubpixDocument {
  const nextDocument = cloneSubpixDocument(document);
  nextDocument.layers = nextDocument.layers.map((layer) => ({
    ...layer,
    data: layer.data.map(() => 0)
  }));
  return nextDocument;
}

function reducer(state: DocumentStoreState, action: Action): DocumentStoreState {
  switch (action.type) {
    case "load":
      return {
        currentDocument: cloneSubpixDocument(action.document),
        filePath: action.filePath,
        isDirty: false,
        past: [],
        future: [],
        strokeStart: null
      };

    case "new":
      return {
        currentDocument: createDefaultSubpixDocument(),
        filePath: null,
        isDirty: false,
        past: [],
        future: [],
        strokeStart: null
      };

    case "saved":
      return {
        ...state,
        filePath: action.filePath,
        isDirty: false
      };

    case "begin-stroke":
      return state.strokeStart
        ? state
        : {
            ...state,
            strokeStart: cloneSubpixDocument(state.currentDocument)
          };

    case "paint-cell": {
      const nextDocument = replaceCell(state.currentDocument, action.x, action.y, action.intensity);
      return nextDocument === state.currentDocument
        ? state
        : {
            ...state,
            currentDocument: nextDocument,
            isDirty: true
          };
    }

    case "end-stroke": {
      if (!state.strokeStart || documentsEqual(state.strokeStart, state.currentDocument)) {
        return {
          ...state,
          strokeStart: null
        };
      }

      return {
        ...state,
        past: [...state.past, state.strokeStart],
        future: [],
        strokeStart: null
      };
    }

    case "clear": {
      const nextDocument = clearDocument(state.currentDocument);
      if (documentsEqual(nextDocument, state.currentDocument)) {
        return state;
      }

      return {
        ...state,
        currentDocument: nextDocument,
        isDirty: true,
        past: [...state.past, cloneSubpixDocument(state.currentDocument)],
        future: [],
        strokeStart: null
      };
    }

    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) {
        return state;
      }

      return {
        ...state,
        currentDocument: cloneSubpixDocument(previous),
        isDirty: true,
        past: state.past.slice(0, -1),
        future: [cloneSubpixDocument(state.currentDocument), ...state.future],
        strokeStart: null
      };
    }

    case "redo": {
      const next = state.future[0];
      if (!next) {
        return state;
      }

      return {
        ...state,
        currentDocument: cloneSubpixDocument(next),
        isDirty: true,
        past: [...state.past, cloneSubpixDocument(state.currentDocument)],
        future: state.future.slice(1),
        strokeStart: null
      };
    }

    default:
      return state;
  }
}

const DocumentStoreContext = createContext<DocumentStoreValue | null>(null);

export function DocumentStoreProvider({ children }: { children: ReactNode }): ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo<DocumentStoreValue>(
    () => ({
      state,
      actions: {
        loadDocument: (document, filePath) => dispatch({ type: "load", document, filePath }),
        newDocument: () => dispatch({ type: "new" }),
        setSavedPath: (filePath) => dispatch({ type: "saved", filePath }),
        beginStroke: () => dispatch({ type: "begin-stroke" }),
        paintCell: (x, y, intensity) => dispatch({ type: "paint-cell", x, y, intensity }),
        endStroke: () => dispatch({ type: "end-stroke" }),
        clearCanvas: () => dispatch({ type: "clear" }),
        undo: () => dispatch({ type: "undo" }),
        redo: () => dispatch({ type: "redo" })
      }
    }),
    [state]
  );

  return createElement(DocumentStoreContext.Provider, { value }, children);
}

export function useDocumentStore(): DocumentStoreValue {
  const value = useContext(DocumentStoreContext);
  if (!value) {
    throw new Error("useDocumentStore must be used inside DocumentStoreProvider.");
  }

  return value;
}
