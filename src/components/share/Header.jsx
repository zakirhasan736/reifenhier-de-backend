'use client';

import React from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';

const DashboardHeader = () => {
  const { data: session } = useSession();

  // const handleLogout = async e => {
  //   e.preventDefault();
  //   await signOut({ callbackUrl: '/' });
  // };

  return (
    <>
      {/* <!-- header-dashboard --> */}
      <div className="header-dashboard">
        <div className="wrap">
          <div className="header-left">
            <Link href="/">
              <Image
                className=""
                id="logo_header"
                alt=""
                src="/images/logo/reifenier_logo_new.webp"
                data-light="/images/logo/reifenier_logo_new.webp"
                data-dark="/images/logo/reifenier_logo_new.webp"
                width={144}
                height={55}
                priority
                // data-retina="/images/logo/logo@2x.png"
              />
            </Link>
            <div className="button-show-hide">
              <i className="icon-menu-left"></i>
            </div>
          </div>
          <div className="header-grid">
            <div className="header-item button-dark-light">
              <i className="icon-moon"></i>
            </div>

            <div className="header-item button-zoom-maximize">
              <div className="">
                <i className="icon-maximize"></i>
              </div>
            </div>

            <div className="popup-wrap user type-header">
              <div className="dropdown">
                <button
                  className="btn btn-secondary dropdown-toggle"
                  type="button"
                  id="dropdownMenuButton3"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  <span className="header-user wg-user">
                    <span className="image">
                      <Image
                        src="/images/avatar/user-1.png"
                        alt="admin avatar image"
                        width={36}
                        height={36}
                      />
                    </span>
                    <span className="flex flex-column">
                      <span className="body-title mb-2">
                        {' '}
                        {session?.user?.firstName || 'Admin'}
                      </span>
                      <span className="text-tiny">Admin</span>
                    </span>
                  </span>
                </button>
                <ul
                  className="dropdown-menu dropdown-menu-end has-content"
                  aria-labelledby="dropdownMenuButton3"
                >
                  <li>
                    <a href="setting.html" className="user-item">
                      <div className="icon">
                        <i className="icon-settings"></i>
                      </div>
                      <div className="body-title-2">Setting</div>
                    </a>
                  </li>

                  <li>
                    <button
                      onClick={() =>
                        signOut({ callbackUrl: '/', redirect: true })
                      }
                      type="button"
                      className="user-item"
                    >
                      <div className="icon">
                        <i className="icon-log-out"></i>
                      </div>
                      <div className="body-title-2">Log out</div>
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* <!-- /header-dashboard --> */}
    </>
  );
}

export default DashboardHeader
