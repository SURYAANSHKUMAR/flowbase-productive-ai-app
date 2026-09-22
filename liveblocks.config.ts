type Presence = {
  selectedTaskId?: number | null;
};

type UserMeta = {
  id: string;
  info: {
    name: string;
    email: string;
    avatarUrl?: string;
    color: string;
  };
};

type RoomEvent = {
  type: "board:changed";
  boardId: number;
};

type ThreadMetadata = {
  boardId: number;
  taskId: number;
};

declare global {
  interface Liveblocks {
    Presence: Presence;
    UserMeta: UserMeta;
    RoomEvent: RoomEvent;
    ThreadMetadata: ThreadMetadata;
    CommentMetadata: Record<string, never>;
  }
}

export {};
