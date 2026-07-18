import { create } from "zustand";
import { constructionApi, Project, DashboardStats } from "../lib/constructionApi";

interface ConstructionState {
  // Dashboard
  stats: DashboardStats | null;
  statsLoading: boolean;
  projects: Project[];
  projectsLoading: boolean;
  currentProject: Project | null;

  // Actions
  fetchStats: () => Promise<void>;
  fetchProjects: (params?: any) => Promise<void>;
  fetchProject: (id: number) => Promise<void>;
  refreshCurrentProject: () => Promise<void>;

  // Active project context
  activeProjectId: number | null;
  setActiveProject: (id: number | null) => void;
}

export const useConstructionStore = create<ConstructionState>((set, get) => ({
  stats: null,
  statsLoading: false,
  projects: [],
  projectsLoading: false,
  currentProject: null,
  activeProjectId: null,

  fetchStats: async () => {
    set({ statsLoading: true });
    try {
      const stats = await constructionApi.stats();
      set({ stats, statsLoading: false });
    } catch {
      set({ statsLoading: false });
    }
  },

  fetchProjects: async (params) => {
    set({ projectsLoading: true });
    try {
      const projects = await constructionApi.listProjects(params);
      set({ projects, projectsLoading: false });
    } catch {
      set({ projectsLoading: false });
    }
  },

  fetchProject: async (id) => {
    try {
      const project = await constructionApi.getProject(id);
      set({ currentProject: project, activeProjectId: id });
    } catch {
      // handled by component
    }
  },

  refreshCurrentProject: async () => {
    const id = get().activeProjectId;
    if (id) {
      try {
        const project = await constructionApi.getProject(id);
        set({ currentProject: project });
      } catch { /* ignore */ }
    }
  },

  setActiveProject: (id) => set({ activeProjectId: id }),
}));
