import { createContext, createElement, useContext, useMemo, useReducer, type ReactElement, type ReactNode } from "react";
import { applySubpixPattern, type SubpixPatternId } from "@/format/patterns";
import {
  cloneSubpixDocument,
  createSubpixDocument,
  createDefaultSubpixDocument,
  getWidthSubpixels,
  type CreateSubpixDocumentOptions,
  type SubpixDocument
} from "@/format/subpixTypes";

interface DocumentStoreState {
  currentDocument: SubpixDocument;
  savedDocument: SubpixDocument;
  filePath: string | null;
  isDirty: boolean;
  past: SubpixDocument[];
  future: SubpixDocument[];
  strokeStart: SubpixDocument | null;
}

interface DocumentStoreActions {
  loadDocument: (document: SubpixDocument, filePath: string | null) => void;
  newDocument: (options?: CreateSubpixDocumentOptions) => void;
  setSavedPath: (filePath: string) => void;
  beginStroke: () => void;
  paintCell: (x: number, y: number, intensity: number) => void;
  endStroke: () => void;
  insertPattern: (patternId: SubpixPatternId) => void;
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
  | { type: "new"; options?: CreateSubpixDocumentOptions }
  | { type: "saved"; filePath: string }
  | { type: "begin-stroke" }
  | { type: "paint-cell"; x: number; y: number; intensity: number }
  | { type: "end-stroke" }
  | { type: "insert-pattern"; patternId: SubpixPatternId }
  | { type: "clear" }
  | { type: "undo" }
  | { type: "redo" };

const initialDocument = createDefaultSubpixDocument();

const initialState: DocumentStoreState = {
  currentDocument: initialDocument,
  savedDocument: cloneSubpixDocument(initialDocument),
  filePath: null,
  isDirty: false,
  past: [],
  future: [],
  strokeStart: null
};

function documentsEqual(left: SubpixDocument, right: SubpixDocument): boolean {
  if (
    left.format !== right.format ||
    left.version !== right.version ||
    left.document.name !== right.document.name ||
    left.document.widthPixels !== right.document.widthPixels ||
    left.document.heightPixels !== right.document.heightPixels ||
    left.architecture.geometry !== right.architecture.geometry ||
    left.architecture.defaultOrder !== right.architecture.defaultOrder ||
    left.architecture.lossyFallbackAllowed !== right.architecture.lossyFallbackAllowed ||
    left.architecture.slotsPerPixel.join("x") !== right.architecture.slotsPerPixel.join("x") ||
    left.architecture.compatibleOrders.join(",") !== right.architecture.compatibleOrders.join(",")
  ) {
    return false;
  }

  if (left.layers.length !== right.layers.length) {
    return false;
  }

  return left.layers.every((layer, layerIndex) => {
    const nextLayer = right.layers[layerIndex];
    return (
      layer.name === nextLayer.name &&
      layer.visible === nextLayer.visible &&
      layer.opacity === nextLayer.opacity &&
      layer.widthSubpixels === nextLayer.widthSubpixels &&
      layer.heightSubpixels === nextLayer.heightSubpixels &&
      layer.dataEncoding === nextLayer.dataEncoding &&
      layer.data.length === nextLayer.data.length &&
      layer.data.every((value, index) => value === nextLayer.data[index])
    );
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
    case "load": {
      const nextDocument = cloneSubpixDocument(action.document);
      return {
        currentDocument: nextDocument,
        savedDocument: cloneSubpixDocument(nextDocument),
        filePath: action.filePath,
        isDirty: false,
        past: [],
        future: [],
        strokeStart: null
      };
    }

    case "new": {
      const nextDocument = createSubpixDocument(action.options);
      return {
        currentDocument: nextDocument,
        savedDocument: cloneSubpixDocument(nextDocument),
        filePath: null,
        isDirty: false,
        past: [],
        future: [],
        strokeStart: null
      };
    }

    case "saved":
      return {
        ...state,
        savedDocument: cloneSubpixDocument(state.currentDocument),
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
            isDirty: !documentsEqual(nextDocument, state.savedDocument)
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

    case "insert-pattern": {
      const nextDocument = applySubpixPattern(state.currentDocument, action.patternId);
      if (documentsEqual(nextDocument, state.currentDocument)) {
        return state;
      }

      return {
        ...state,
        currentDocument: nextDocument,
        isDirty: !documentsEqual(nextDocument, state.savedDocument),
        past: [...state.past, cloneSubpixDocument(state.currentDocument)],
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
        isDirty: !documentsEqual(nextDocument, state.savedDocument),
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

      const previousDocument = cloneSubpixDocument(previous);

      return {
        ...state,
        currentDocument: previousDocument,
        isDirty: !documentsEqual(previousDocument, state.savedDocument),
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

      const nextDocument = cloneSubpixDocument(next);

      return {
        ...state,
        currentDocument: nextDocument,
        isDirty: !documentsEqual(nextDocument, state.savedDocument),
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

  const actions = useMemo<DocumentStoreActions>(
    () => ({
        loadDocument: (document, filePath) => dispatch({ type: "load", document, filePath }),
        newDocument: (options) => dispatch({ type: "new", options }),
        setSavedPath: (filePath) => dispatch({ type: "saved", filePath }),
        beginStroke: () => dispatch({ type: "begin-stroke" }),
        paintCell: (x, y, intensity) => dispatch({ type: "paint-cell", x, y, intensity }),
        endStroke: () => dispatch({ type: "end-stroke" }),
        insertPattern: (patternId) => dispatch({ type: "insert-pattern", patternId }),
        clearCanvas: () => dispatch({ type: "clear" }),
        undo: () => dispatch({ type: "undo" }),
        redo: () => dispatch({ type: "redo" })
    }),
    []
  );

  const value = useMemo<DocumentStoreValue>(() => ({ state, actions }), [actions, state]);

  return createElement(DocumentStoreContext.Provider, { value }, children);
}

export function useDocumentStore(): DocumentStoreValue {
  const value = useContext(DocumentStoreContext);
  if (!value) {
    throw new Error("useDocumentStore must be used inside DocumentStoreProvider.");
  }

  return value;
}
