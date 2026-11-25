export declare const DEFAULT_WIDGET_ORIGIN: string;
export declare const WIDGET_VERSION: string;

export type WidgetPosition = "bottomRight" | "bottomLeft" | "topRight" | "topLeft";
export type WidgetTheme = "light" | "dark" | "auto";

export interface JaanoLeadEvent {
  lead_id?: string;
  name?: string;
  phone?: string;
  email?: string;
  variables?: Record<string, unknown>;
}

export interface JaanoMessageEvent {
  role: "user" | "assistant";
  text: string;
  timestamp?: string;
}

export interface JaanoWidgetConfig {
  chatbotId: string;
  userId: string;
  widgetDomain?: string;
  position?: WidgetPosition;
  theme?: WidgetTheme;
  color?: string;
  reranking?: boolean;
  queryExpansion?: boolean;
  onLead?: (lead: JaanoLeadEvent) => void;
  onMessage?: (message: JaanoMessageEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onReady?: () => void;
  onError?: (error: unknown) => void;
}

export declare class JaanoWidget {
  constructor(config: JaanoWidgetConfig);
  readonly isMounted: boolean;
  readonly isOpen: boolean;
  buildIframeUrl(): string;
  mount(target?: HTMLElement): this;
  open(): this;
  close(): this;
  toggle(): this;
  sendMessage(question: string): this;
  setTheme(theme: "light" | "dark"): this;
  destroy(): void;
}

export declare function createJaanoWidget(config: JaanoWidgetConfig): JaanoWidget;
