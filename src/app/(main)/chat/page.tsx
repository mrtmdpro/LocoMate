"use client";

import Link from "next/link";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { LogoFull } from "@/components/logo";

export default function ChatInboxPage() {
  const { data: conversations, isLoading } = trpc.chat.getConversations.useQuery();

  return (
    <PageTransition><div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading text-[#3f6f60]">Messages</h1>
        <LogoFull size="sm" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : conversations?.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No conversations yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Match with travelers to start chatting!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations?.map((conv) => (
            <Link key={conv.matchId} href={`/chat/${conv.matchId}`}>
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    {conv.otherUser?.avatarUrl && <AvatarImage src={conv.otherUser.avatarUrl} alt={conv.otherUser.displayName || ""} />}
                    <AvatarFallback className="bg-[#3f6f60] text-white font-bold">
                      {(conv.otherUser?.displayName || "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm truncate">{conv.otherUser?.displayName}</h3>
                      {conv.unreadCount > 0 && (
                        <Badge className="bg-[#ff8c30] text-white border-0 text-[10px] px-1.5">{conv.unreadCount}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.lastMessage?.content || "You matched! Say hello 👋"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div></PageTransition>
  );
}
