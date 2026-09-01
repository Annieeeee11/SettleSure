import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";

type TooltipContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  contentId: string;
};

const TooltipContext = createContext<TooltipContextValue | null>(null);

function useTooltipContext(component: string) {
  const ctx = useContext(TooltipContext);
  if (!ctx) {
    throw new Error(`${component} must be used within Tooltip`);
  }
  return ctx;
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else ref.current = node;
    }
  };
}

export function Tooltip({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentId = useId();

  return (
    <TooltipContext.Provider value={{ open, setOpen, triggerRef, contentId }}>
      {children}
    </TooltipContext.Provider>
  );
}

export function TooltipTrigger({
  asChild,
  className,
  children,
  ...props
}: {
  asChild?: boolean;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  const { setOpen, triggerRef, contentId } = useTooltipContext("TooltipTrigger");

  const handlers = {
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
  };

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{
      className?: string;
      ref?: Ref<HTMLElement>;
      "aria-describedby"?: string;
    }>;
    return cloneElement(child, {
      ...props,
      ...handlers,
      ref: mergeRefs(triggerRef, child.props.ref),
      className: [className, child.props.className].filter(Boolean).join(" ") || undefined,
      "aria-describedby": openDescribedBy(contentId, child.props["aria-describedby"]),
    });
  }

  return (
    <button
      type="button"
      ref={triggerRef as Ref<HTMLButtonElement>}
      className={className}
      aria-describedby={contentId}
      {...handlers}
      {...props}
    >
      {children}
    </button>
  );
}

function openDescribedBy(contentId: string, existing?: string) {
  return existing ? `${existing} ${contentId}` : contentId;
}

export function TooltipContent({
  className,
  children,
  side = "top",
}: {
  className?: string;
  children: ReactNode;
  side?: "top" | "bottom";
}) {
  const { open, triggerRef, contentId } = useTooltipContext("TooltipContent");
  const [style, setStyle] = useState<CSSProperties>({
    position: "fixed",
    top: 0,
    left: 0,
    zIndex: 1000,
    visibility: "hidden",
  });
  const contentRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const content = contentRef.current;
    if (!trigger || !content) return;

    const triggerRect = trigger.getBoundingClientRect();
    const width = content.offsetWidth;
    const height = content.offsetHeight;
    const gap = 8;
    const left = triggerRect.left + triggerRect.width / 2 - width / 2;
    const top =
      side === "top"
        ? triggerRect.top - height - gap
        : triggerRect.bottom + gap;
    const maxLeft = Math.max(8, window.innerWidth - width - 8);

    setStyle({
      position: "fixed",
      top: Math.max(8, top),
      left: Math.min(Math.max(8, left), maxLeft),
      zIndex: 1000,
      visibility: "visible",
    });
  }, [side, triggerRef]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => updatePosition());
    observer.observe(content);
    return () => observer.disconnect();
  }, [open, updatePosition, children]);

  if (!open) return null;

  return createPortal(
    <div
      ref={contentRef}
      id={contentId}
      role="tooltip"
      className={["tooltip-content", className].filter(Boolean).join(" ")}
      style={style}
    >
      {children}
    </div>,
    document.body,
  );
}
