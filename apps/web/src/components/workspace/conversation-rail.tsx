"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Ellipsis,
  MessageSquareText,
  Pin,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { conversationsApi } from "@/lib/api/conversations";
import { queryKeys } from "@/lib/query/keys";
import { normalizeError } from "@/lib/api/errors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LIST_LIMIT = 8;

export function ConversationRail({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const list = useQuery({
    queryKey: queryKeys.conversations,
    queryFn: () => conversationsApi.list(),
  });

  useEffect(() => {
    setShowAll(false);
  }, [query]);

  const conversations = useMemo(() => {
    const items = list.data?.conversations ?? [];
    const pinned = items.filter((item) => item.pinnedAt);
    const rest = items.filter((item) => !item.pinnedAt);
    const q = query.trim().toLowerCase();
    const filter = (c: { title: string; messages?: Array<{ content: string }> }) =>
      !q || `${c.title} ${c.messages?.map((m) => m.content).join(" ")}`.toLowerCase().includes(q);
    return [...pinned.filter(filter), ...rest.filter(filter)];
  }, [list.data, query]);

  const visible = showAll ? conversations : conversations.slice(0, LIST_LIMIT);

  async function action(id: string, type: "pin" | "archive" | "remove") {
    if (type === "pin") await conversationsApi.pin(id);
    if (type === "archive") await conversationsApi.archive(id);
    if (type === "remove") await conversationsApi.remove(id);
    await qc.invalidateQueries({ queryKey: queryKeys.conversations });
    if (type === "remove" && pathname.endsWith(id)) router.push("/chat");
  }

  return (
    <aside className="v3-rail" data-collapsed={collapsed} aria-label="Conversations">
      {collapsed ? (
        <div className="v3-rail__collapsed">
          <button
            type="button"
            className="v3-rail__expand"
            aria-label="Expand conversation history"
            title="Show conversations"
            onClick={onToggle}
          >
            <MessageSquareText size={17} />
            <ChevronRight size={14} />
          </button>
        </div>
      ) : (
        <>
          <header className="v3-rail__head">
            <div className="v3-rail__title">
              <div>
                <span className="v3-kicker">
                  <MessageSquareText size={10} />
                  Workspace
                </span>
                <div className="v3-rail__title-row">
                  <h2>Conversations</h2>
                  <button
                    type="button"
                    className="v3-rail__collapse"
                    aria-label="Collapse conversation history"
                    aria-expanded={true}
                    onClick={onToggle}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            </div>
            <label className="v3-rail__search">
              {query ? <X size={13} onClick={() => setQuery("")} /> : <Search size={13} />}
              <input
                aria-label="Search conversations"
                placeholder="Search chats"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </header>
          <div className="v3-rail__list v3-scroll">
            {list.isLoading &&
              Array.from({ length: 7 }, (_, i) => (
                <div className="v3-rail__skeleton" key={i}>
                  <i style={{ width: "62%" }} />
                  <i style={{ width: "100%" }} />
                  <i style={{ width: "82%" }} />
                </div>
              ))}
            {list.isError && (
              <div className="v3-rail__empty">
                <MessageSquareText size={20} />
                <strong>History unavailable</strong>
                <p>{normalizeError(list.error).message}</p>
                <button type="button" onClick={() => list.refetch()}>
                  Retry
                </button>
              </div>
            )}
            {list.isSuccess && conversations.length === 0 && (
              <div className="v3-rail__empty">
                <MessageSquareText size={20} />
                <strong>{query ? "No matches" : "No conversations yet"}</strong>
                <p>{query ? "Try a different search." : "Start a chat and it will appear here."}</p>
              </div>
            )}
            <motion.div initial={false}>
              {visible.map((item, index) => {
                const active = pathname.endsWith(item.id);
                const last = item.messages?.at(-1)?.content || "No messages yet";
                return (
                  <motion.button
                    key={item.id}
                    className="v3-rail__item"
                    data-active={active}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.22,
                      delay: Math.min(index * 0.02, 0.25),
                      ease: "easeOut",
                    }}
                    onClick={() => router.push(`/chat/${item.id}`)}
                  >
                    <div className="v3-rail__item-title">
                      <h3>{item.title}</h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="v3-rail__menu"
                          aria-label={`Actions for ${item.title}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Ellipsis size={15} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => action(item.id, "pin")}>
                            <Pin size={14} />
                            {item.pinnedAt ? "Unpin" : "Pin"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => action(item.id, "archive")}>
                            <Archive size={14} />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => action(item.id, "remove")}
                            style={{ color: "var(--danger)" }}
                          >
                            <Trash2 size={14} />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="v3-rail__item-preview">{last}</p>
                    <footer className="v3-rail__item-meta">
                      <span>{item.model}</span>
                      <time>
                        {new Date(item.updatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </footer>
                  </motion.button>
                );
              })}
            </motion.div>
            {list.isSuccess && conversations.length > LIST_LIMIT && (
              <button
                type="button"
                className="v3-rail__more"
                onClick={() => setShowAll((current) => !current)}
                aria-expanded={showAll}
              >
                {showAll ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {showAll ? "Show fewer" : `Show all (${conversations.length})`}
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
