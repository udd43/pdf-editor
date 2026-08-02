import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Tab =
  | "home"
  | "pdf"
  | "bgremove"
  | "upscale"
  | "colorize"
  | "romanize"
  | "signature"
  | "calculator"
  | "corporate"
  | "smartpdf"
  | "img2pdf"
  | "mergesplit"
  | "compress";

interface AppState {
  // Navigation
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;

  // File management
  file: File | null;
  setFile: (file: File | null) => void;
  referenceFile: File | null;
  setReferenceFile: (file: File | null) => void;
  isCorporateMode: boolean;
  setIsCorporateMode: (v: boolean) => void;

  // UI toggles
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  toggleDarkMode: () => void;
  darkModePreference: "light" | "dark" | "system";
  setDarkModePreference: (pref: "light" | "dark" | "system") => void;

  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (v: boolean) => void;
  isSecretMode: boolean;
  setIsSecretMode: (v: boolean) => void;
  showChangelog: boolean;
  setShowChangelog: (v: boolean) => void;

  // Convenience actions
  goHome: () => void;
  openPdfEditor: (file: File, corporateMode?: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Navigation
      activeTab: "home",
      setActiveTab: (tab) => set({ activeTab: tab }),

      // File management
      file: null,
      setFile: (file) => set({ file }),
      referenceFile: null,
      setReferenceFile: (referenceFile) => set({ referenceFile }),
      isCorporateMode: false,
      setIsCorporateMode: (isCorporateMode) => set({ isCorporateMode }),

      // UI toggles
      isDarkMode: false,
      setIsDarkMode: (isDarkMode) => set({ isDarkMode }),
      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      darkModePreference: "system",
      setDarkModePreference: (pref) => set({ darkModePreference: pref }),

      isMobileMenuOpen: false,
      setIsMobileMenuOpen: (isMobileMenuOpen) => set({ isMobileMenuOpen }),
      isSecretMode: false,
      setIsSecretMode: (isSecretMode) => set({ isSecretMode }),
      showChangelog: false,
      setShowChangelog: (showChangelog) => set({ showChangelog }),

      // Convenience actions
      goHome: () => set({ activeTab: "home", file: null, referenceFile: null, isCorporateMode: false }),
      openPdfEditor: (file, corporateMode = false) =>
        set({ file, referenceFile: null, isCorporateMode: corporateMode, activeTab: "pdf" }),
    }),
    {
      name: "pdf-editor-app-store",
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        darkModePreference: state.darkModePreference,
      }),
    }
  )
);
