import { api } from "./api";

export interface ChatBootstrap {
  conversations: any[];
  users: any[];
  [key: string]: any;
}

export const chatApi = {
  bootstrap: async (): Promise<ChatBootstrap> => {
    const { data } = await api.get("/chat/bootstrap");
    return data;
  },
};
