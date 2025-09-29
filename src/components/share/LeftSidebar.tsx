import Image from 'next/image';
import Link from 'next/link';
import React from 'react'

const LeftSidebar = () => {
  return (
    <>
      {/* <!-- section-menu-left --> */}
      <div className="section-menu-left">
        <div className="box-logo">
          <Link href="/" id="site-logo-inner">
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
        <div className="section-menu-left-wrap">
          <div className="center">
            <div className="center-item">
              <div className="center-heading">Main Home</div>
              <ul className="menu-list">
                <li className="menu-item has-children active">
                  <Link href="/dashboard" className="menu-item-button">
                    {/* <!-- <div className="icon"><i className="icon-grid"></i></div> --> */}
                    <div className="text">Dashboard</div>
                  </Link>
                </li>
              </ul>
            </div>
            <div className="center-item">
              <div className="center-heading">All links</div>
              <ul className="menu-list">
                <li className="menu-item has-children">
                  <Link href="javascript:void(0);" className="menu-item-button">
                    <div className="icon">
                      <i className="icon-shopping-cart"></i>
                    </div>
                    <div className="text">Products</div>
                  </Link>
                  <ul className="sub-menu">
                    <li className="sub-menu-item">
                      <Link href="/dashboard/products/add-product" className="">
                        <div className="text">Add Product</div>
                      </Link>
                    </li>
                    <li className="sub-menu-item">
                      <Link href="/dashboard/products" className="">
                        <div className="text">Product List</div>
                      </Link>
                    </li>
                    <li className="sub-menu-item">
                      <Link href="/dashboard/products/feature-product" className="">
                        <div className="text">Feature Product</div>
                      </Link>
                    </li>
                  </ul>
                </li>

                <li className="menu-item has-children">
                  <Link href="javascript:void(0);" className="menu-item-button">
                    <div className="icon">
                      <i className="icon-file-plus"></i>
                    </div>
                    <div className="text">Vendors</div>
                  </Link>
                  <ul className="sub-menu">
                    <li className="sub-menu-item">
                      <Link href="/dashboard/vendors" className="">
                        <div className="text">Vendors list</div>
                      </Link>
                    </li>
                    {/* <li className="sub-menu-item">
                      <Link href="/dashboard/vendor-detail" className="">
                        <div className="text">Vendors detail</div>
                      </Link>
                    </li> */}
                  </ul>
                </li>
                <li className="menu-item has-children">
                  <Link href="javascript:void(0);" className="menu-item-button">
                    <div className="icon">
                      <i className="icon-box"></i>
                    </div>
                    <div className="text">Blogs</div>
                  </Link>
                  <ul className="sub-menu">
                    <li className="sub-menu-item">
                      <Link href="/dashboard/blogs/create-blog" className="">
                        <div className="text">Add new blog</div>
                      </Link>
                    </li>
                    <li className="sub-menu-item">
                      <Link href="/dashboard/blogs" className="">
                        <div className="text">Blogs list</div>
                      </Link>
                    </li>
                    {/* <li className="sub-menu-item">
                      <Link href="/dashboard/blog-detail" className="">
                        <div className="text">Blog detail</div>
                      </Link>
                    </li> */}
                  </ul>
                </li>
                <li className="menu-item has-children">
                  <Link href="javascript:void(0);" className="menu-item-button">
                    <div className="icon">
                      <i className="icon-user"></i>
                    </div>
                    <div className="text">Auth</div>
                  </Link>
                  <ul className="sub-menu">
                    <li className="sub-menu-item">
                      <Link href="/" className="">
                        <div className="text">Login</div>
                      </Link>
                    </li>
                    <li className="sub-menu-item">
                      <Link href="/auth/signup" className="">
                        <div className="text">Sign up</div>
                      </Link>
                    </li>
                  </ul>
                </li>

                <li className="menu-item">
                  <Link href="/dashboard/brand" className="">
                    <div className="icon">
                      <i className="icon-image"></i>
                    </div>
                    <div className="text">Brands</div>
                  </Link>
                </li>
              </ul>
            </div>
            <div className="center-item">
              <div className="center-heading">Setting</div>
              <ul className="menu-list">
                <li className="menu-item">
                  <Link href="/dashboard/setting" className="">
                    <div className="icon">
                      <i className="icon-settings"></i>
                    </div>
                    <div className="text">Setting</div>
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      {/* <!-- /section-menu-left --> */}
    </>
  );
}

export default LeftSidebar
