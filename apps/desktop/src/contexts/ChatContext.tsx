import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { api, type ConversationView, type MessageView, type ProviderView, type ModelView } from "../api/client";
import { streamLocalChat, type LocalProviderKind } from "../api/local";
import { useAuth } from "./AuthContext";
import { useModelStore } from "../features/models/modelStore";
import { isDesktopRuntime, streamProviderChat } from "../features/providers/providerClient";

export interface ChatState {
  conversations: ConversationView[];
  currentConversation: ConversationView | null;
  messages: MessageView[];
  streaming: boolean;
  streamingContent: string;
  error: string | null;
  loading: boolean;
  selectedProvider: ProviderView | null;
  selectedModel: string;
  providers: ProviderView[];
  models: ModelView[];
  fetchConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  stopStreaming: () => void;
  regenerate: () => Promise<void>;
  clearChat: () => void;
  setSelectedProvider: (p: ProviderView | null) => void;
  setSelectedModel: (m: string) => void;
  setProviders: (p: ProviderView[]) => void;
  setModels: (m: ModelView[]) => void;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
}

const ChatContext = createContext<ChatState | null>(null);

let abortController: AbortController | null = null;

export function ChatProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth();
  const {
    models,
    providers,
    selectedModel,
    selectedProvider,
    setSelectedModel,
    setSelectedProvider,
    setModels,
    setProviders,
  } = useModelStore();
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [currentConversation, setCurrentConversation] =
    useState<ConversationView | null>(null);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState("");

  useEffect(() => {
    if (authStatus !== "local") return;
    try {
      const saved = window.localStorage.getItem("aegis-local-conversation");
      if (saved) setMessages(JSON.parse(saved) as MessageView[]);
    } catch {
      // Local mode remains usable even if browser storage is unavailable.
    }
  }, [authStatus]);

  useEffect(() => {
    if (authStatus !== "local" || streaming) return;
    try {
      window.localStorage.setItem("aegis-local-conversation", JSON.stringify(messages));
    } catch {
      // Do not block a local conversation when storage is unavailable.
    }
  }, [authStatus, messages, streaming]);

  const fetchConversations = useCallback(async () => {
    try {
      const { conversations: c } = await api.listConversations();
      setConversations(c);
    } catch {
      // ignore — might be offline
    }
  }, []);

  const selectConversation = useCallback(
    async (id: string) => {
      try {
        setLoading(true);
        setError(null);
        const { conversation } = await api.getConversation(id);
        setCurrentConversation(conversation);
        setMessages(conversation.messages);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load conversation."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      const userMessage: MessageView = {
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setLastUserMessage(content);
      setStreaming(true);
      setStreamingContent("");
      setError(null);

      abortController = new AbortController();

      try {
        const request = {
          conversationId: currentConversation?.id,
          providerId: selectedProvider?.id,
          model: selectedModel,
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          privacyMode: "synced" as const,
          attachmentIds: [],
          toolMode: "auto" as const,
          enabledTools: [],
        };
        let completedConversationId = currentConversation?.id;
        let completedMessageId: string | undefined;
        if (authStatus === "local") {
          if (!selectedProvider || !selectedModel) throw new Error("Choose an available model before sending a message.");
          let localContent = "";
          const stream = isDesktopRuntime()
            ? streamProviderChat(selectedProvider.id, selectedModel, [...messages, userMessage], abortController.signal)
            : streamLocalChat((selectedProvider.kind === "lm-studio" || selectedProvider.kind === "lmstudio" ? "lm-studio" : "ollama") as LocalProviderKind, selectedModel, [...messages, userMessage], abortController.signal);
          for await (const delta of stream) { localContent += delta; setStreamingContent(localContent); }
          if (!localContent.trim()) throw new Error("The local provider closed without returning a response.");
          setMessages((prev) => [...prev, { role: "assistant", content: localContent, createdAt: new Date().toISOString() }]);
        } else {
          let receivedTerminalEvent = false;
          for await (const event of api.streamChat(request, abortController.signal)) {
            if (event.type === "message.started") completedConversationId = event.conversationId;
            else if (event.type === "message.delta") setStreamingContent((previous) => previous + event.delta);
            else if (event.type === "message.completed") { receivedTerminalEvent = true; completedConversationId = event.conversationId; completedMessageId = event.messageId; }
            else if (event.type === "message.error") throw new Error(event.error.message);
          }
          if (!receivedTerminalEvent) throw new Error("The provider stream ended before a terminal event was received.");
          if (completedConversationId) {
            const { conversation } = await api.getConversation(completedConversationId);
            setCurrentConversation(conversation); setMessages(conversation.messages);
          } else setMessages((prev) => [...prev, { id: completedMessageId, role: "assistant", content: "", createdAt: new Date().toISOString() }]);
          await fetchConversations();
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Chat failed. Check your provider."
        );
      } finally {
        setStreaming(false);
        abortController = null;
      }
    },
    [authStatus, currentConversation, selectedProvider, selectedModel, messages, fetchConversations]
  );

  const stopStreaming = useCallback(() => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    setStreaming(false);
  }, []);

  const regenerate = useCallback(async () => {
    if (!lastUserMessage) return;
    // Remove last assistant message if present
    setMessages((prev) => {
      const idx = prev.length - 1;
      if (prev[idx]?.role === "assistant") return prev.slice(0, -1);
      return prev;
    });
    await sendMessage(lastUserMessage);
  }, [lastUserMessage, sendMessage]);

  const clearChat = useCallback(() => {
    setCurrentConversation(null);
    setMessages([]);
    setStreamingContent("");
    setError(null);
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (authStatus === "authenticated") await api.deleteConversation(id);
    if (currentConversation?.id === id) clearChat();
  }, [authStatus, clearChat, currentConversation?.id]);

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c))
      );
      if (authStatus === "authenticated") await api.updateConversation(id, title);
      if (currentConversation?.id === id) setCurrentConversation((current) => current ? { ...current, title } : current);
    },
    [authStatus, currentConversation?.id]
  );

  return (
    <ChatContext.Provider
      value={{
        conversations,
        currentConversation,
        messages,
        streaming,
        streamingContent,
        error,
        loading,
        selectedProvider,
        selectedModel,
        providers,
        models,
        fetchConversations,
        selectConversation,
        sendMessage,
        stopStreaming,
        regenerate,
        clearChat,
        setSelectedProvider,
        setSelectedModel,
        setProviders,
        setModels,
        deleteConversation,
        renameConversation,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatState {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
