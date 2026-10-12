import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { FeedbackBanner } from '../common/FeedbackBanner';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('parksense_sidebar_collapsed') === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('parksense_sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#F8F9FA] text-[#1A1F26]">
      {/* Sidebar - Independent fixed/sticky non-scrollable entity */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />

      {/* Main Viewport with independent scrollable area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <TopBar
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
          onToggleCollapse={toggleCollapse}
          isCollapsed={isCollapsed}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        <FeedbackBanner />
      </div>
    </div>
  );
};
