/**
 * Sample React hook + component using @jaano-sdk/widget.
 * Replaces copy-pasted <script> tags with typed config and lifecycle cleanup.
 */
import { useEffect, useRef } from "react";
import { createJaanoWidget } from "../../widget/src/index.js";

export function JaanoChatWidget({ chatbotId, userId, theme = "auto", color = "#111827" }) {
  const widgetRef = useRef(null);

  useEffect(() => {
    const widget = createJaanoWidget({
      chatbotId,
      userId,
      theme,
      color,
      position: "bottomRight",
      onReady: () => {
        console.log("Jaano widget ready");
      },
      onLead: (lead) => {
        console.log("Lead captured:", lead);
      },
      onMessage: (message) => {
        console.log("Chat message:", message.role, message.text);
      },
    });

    widget.mount();
    widgetRef.current = widget;

    return () => {
      widget.destroy();
      widgetRef.current = null;
    };
  }, [chatbotId, userId, theme, color]);

  return null;
}
