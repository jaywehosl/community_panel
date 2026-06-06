import { Outlet } from 'react-router-dom';
import AppSidebar from '@/layouts/AppSidebar';
import { useWebSocketBridge } from '@/api/websocketBridge';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTheme } from '@/hooks/useTheme';
import GravityVortexCanvas from '@/components/ui/GravityVortexCanvas';

export default function PanelLayout() {
  useWebSocketBridge();
  usePageTitle();
  const { isDark, isUltra } = useTheme();
  
  const pageClass = `panel-app-wrapper ${isDark ? 'is-dark' : ''} ${isUltra ? 'is-ultra' : ''}`.trim();

  return (
    <div className={pageClass}>
      <GravityVortexCanvas />
      <AppSidebar />
      <div className="panel-main-content">
        <Outlet />
      </div>
    </div>
  );
}
