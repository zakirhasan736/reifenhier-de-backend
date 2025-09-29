import FooerBottom from '@/components/share/Fooer';
import DashboardHeader from '@/components/share/Header';
import LeftSidebar from '@/components/share/LeftSidebar';
import { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="layout-wrap">
      <div id="preload" className="preload-container">
        <div className="preloading">
          <span></span>
        </div>
      </div>
      <LeftSidebar />
      <div className="section-content-right">
        <DashboardHeader />
        {/* <!-- main-content --> */}
        <div className="main-content">
          {/* <!-- main-content-wrap --> */}
          <div className="main-content-inner">
            {/* <!-- main-content-wrap --> */}
            <main className="main-content-wrap bg-gray-100">
              {children}
            </main>
            {/* <!-- /main-content-wrap --> */}
          </div>
          {/* <!-- /main-content --> */}

          <FooerBottom />
        </div>
        {/* <!-- /main-content --> */}
      </div>
    </div>
  );
}
