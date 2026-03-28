"use client";

// ─── NewConversationModal ─────────────────────────────────────────────────────
// Messenger/Instagram-inspired modal for starting new conversations.
// Two modes toggled by tab:
//   "direct"  — search users, click one to open or create a 1-on-1 DM
//   "group"   — select multiple users + enter a group name → create group chat
//
// Backend connection:
//   searchUsers()             → GET /api/v1/users?search=<q> (ILIKE username/display_name)
//   createDirectConversation()→ POST /api/v1/conversations { conversation_type: "direct" }
//   createGroupConversation() → POST /api/v1/conversations { conversation_type: "group" }
//
// State flow:
//   query → debounced fetch → results → user clicks → create → addConversation(store) → navigate
//
// Scalability notes:
//   Search is debounced 300ms to avoid hammering the API on every keystroke.
//   Results are limited server-side (no explicit limit here — backend ILIKE cap applies).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Search, Check, Users, MessageCircle } from "lucide-react";
import { searchUsers } from "@/services/users.service";
import { createDirectConversation, createGroupConversation } from "@/services/conversations.service";
import { useConversationsStore } from "@/store/conversations.store";
import { useAuthStore } from "@/store/auth.store";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

type Tab = "direct" | "group";

interface NewConversationModalProps {
  onClose: () => void;
}

export function NewConversationModal({ onClose }: NewConversationModalProps) {
  const router = useRouter();
  const { addConversation } = useConversationsStore();
  const currentUserId = useAuthStore((state) => state.user?.id);

  const [tab, setTab] = useState<Tab>("direct");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus the search input when the modal opens
  useEffect(() => {
    searchRef.current?.focus();
  }, [tab]);

  // ─── Debounced search ────────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const users = await searchUsers(query);
        // Exclude the current user from results (can't DM yourself)
        setResults(users.filter((u) => u.id !== currentUserId));
      } catch {
        toast.error("Search failed. Please try again.");
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, currentUserId]);

  // ─── Direct message ──────────────────────────────────────────────────────────
  async function handleDirectMessage(user: User) {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const conversation = await createDirectConversation(user.id);
      addConversation(conversation);
      router.push(`/conversations/${conversation.id}`);
      onClose();
    } catch {
      toast.error("Could not start conversation. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  // ─── Toggle group member selection ──────────────────────────────────────────
  function toggleUser(user: User) {
    setSelectedUsers((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user],
    );
  }

  // ─── Create group ────────────────────────────────────────────────────────────
  async function handleCreateGroup() {
    if (isCreating || selectedUsers.length === 0 || !groupName.trim()) return;
    setIsCreating(true);
    try {
      const conversation = await createGroupConversation(
        groupName.trim(),
        selectedUsers.map((u) => u.id),
      );
      addConversation(conversation);
      router.push(`/conversations/${conversation.id}`);
      onClose();
    } catch {
      toast.error("Could not create group. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  // Close on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    // Full-screen backdrop
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="New conversation"
    >
      {/* Backdrop */}
      <div
        className="bg-foreground/20 absolute inset-0 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="animate-modal-in bg-surface relative z-10 flex w-full max-w-md flex-col rounded-xl shadow-lg">
        {/* ── Header ──────────────────────────────────────────────────────────*/}
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-foreground text-base font-semibold">New conversation</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-foreground hover:bg-surface-muted flex h-7 w-7 items-center justify-center rounded-md transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Tab switcher ────────────────────────────────────────────────────*/}
        <div className="border-border flex border-b px-4">
          <button
            onClick={() => {
              setTab("direct");
              setSelectedUsers([]);
              setQuery("");
            }}
            className={cn(
              "flex items-center gap-1.5 border-b-2 py-2.5 pr-4 text-sm font-medium transition-colors",
              tab === "direct"
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            <MessageCircle size={14} />
            Direct message
          </button>
          <button
            onClick={() => {
              setTab("group");
              setSelectedUsers([]);
              setQuery("");
            }}
            className={cn(
              "flex items-center gap-1.5 border-b-2 py-2.5 pl-2 pr-4 text-sm font-medium transition-colors",
              tab === "group"
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            <Users size={14} />
            New group
          </button>
        </div>

        {/* ── Group name field (group mode only) ──────────────────────────────*/}
        {tab === "group" && (
          <div className="border-border border-b px-4 py-3">
            <input
              type="text"
              placeholder="Group name…"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className={cn(
                "w-full rounded-md px-3 py-2 text-sm",
                "border-border bg-surface-muted border",
                "text-foreground placeholder:text-muted",
                "focus:border-accent focus:outline-none",
              )}
            />
          </div>
        )}

        {/* ── Selected users chips (group mode) ───────────────────────────────*/}
        {tab === "group" && selectedUsers.length > 0 && (
          <div className="border-border flex flex-wrap gap-1.5 border-b px-4 py-2.5">
            {selectedUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => toggleUser(u)}
                className="bg-accent-muted text-accent flex items-center gap-1 rounded-full py-0.5 pl-2 pr-1 text-xs font-medium"
              >
                {u.display_name || u.username}
                <X size={11} />
              </button>
            ))}
          </div>
        )}

        {/* ── Search input ─────────────────────────────────────────────────────*/}
        <div className="border-border flex items-center gap-2 border-b px-4 py-2.5">
          <Search size={15} className="text-muted flex-shrink-0" />
          <input
            ref={searchRef}
            type="text"
            placeholder={tab === "direct" ? "Search people…" : "Add people…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="text-foreground placeholder:text-muted w-full bg-transparent text-sm outline-none"
          />
          {isSearching && <Spinner size="sm" className="text-muted flex-shrink-0" />}
        </div>

        {/* ── Results list ─────────────────────────────────────────────────────*/}
        <div className="max-h-64 overflow-y-auto">
          {results.length === 0 && query.trim() && !isSearching && (
            <p className="text-muted px-4 py-6 text-center text-sm">
              No users found for &ldquo;{query}&rdquo;
            </p>
          )}

          {results.length === 0 && !query.trim() && (
            <p className="text-muted px-4 py-6 text-center text-sm">
              {tab === "direct"
                ? "Search by username or display name to find someone."
                : "Search people to add to your group."}
            </p>
          )}

          {results.map((user) => {
            const isSelected = selectedUsers.some((u) => u.id === user.id);
            return (
              <button
                key={user.id}
                onClick={() => (tab === "direct" ? handleDirectMessage(user) : toggleUser(user))}
                disabled={isCreating}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  isSelected
                    ? "bg-accent-muted"
                    : "hover:bg-surface-muted",
                  "disabled:opacity-50",
                )}
              >
                <UserAvatar user={user} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">
                    {user.display_name || user.username}
                  </p>
                  <p className="text-muted truncate text-xs">@{user.username}</p>
                </div>
                {tab === "group" && isSelected && (
                  <div className="bg-accent flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full">
                    <Check size={11} className="text-white" />
                  </div>
                )}
                {tab === "direct" && isCreating && (
                  <Spinner size="sm" className="text-muted flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Create group button (group mode) ────────────────────────────────*/}
        {tab === "group" && (
          <div className="border-border border-t px-4 py-3">
            <button
              onClick={handleCreateGroup}
              disabled={isCreating || selectedUsers.length === 0 || !groupName.trim()}
              className={cn(
                "w-full rounded-md py-2.5 text-sm font-medium transition-colors",
                "bg-accent text-accent-foreground hover:bg-accent-hover",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {isCreating ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" />
                  Creating…
                </span>
              ) : (
                `Create group${selectedUsers.length > 0 ? ` (${selectedUsers.length})` : ""}`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
