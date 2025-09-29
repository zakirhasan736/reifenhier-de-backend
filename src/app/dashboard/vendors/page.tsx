'use client';

import Image from 'next/image';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import ConfirmDialog from '@/components/share/ConfirmDialog';

interface Vendor {
  _id: string;
  vendor: string;
  vendor_logo: string;
  vendor_id: string;
  totalProducts: number;
}

const apiUrl =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'http://localhost:8001';
const VendorsListsPage = () => {
  const { status } = useSession();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteVendor, setConfirmDeleteVendor] = useState<string | null>(
    null
  );

  // 👇 Exposed for reuse
  const fetchVendors = async () => {
    if (status !== 'authenticated') return;
    try {
      const res = await axios.get(`${apiUrl}/api/vendors/vendor-lists`);
      setVendors(res.data.vendors || []);
    } catch (error) {
      console.error('Vendor fetch failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [status]);

  if (loading) return <p>Loading vendors...</p>;

  return (
    <>
      <div className="flex items-center flex-wrap justify-between gap20 mb-27">
        <h3>Vendor List</h3>
        <ul className="breadcrumbs flex items-center flex-wrap justify-start gap10">
          <li>
            <a href="index-2.html">
              <div className="text-tiny">Dashboard</div>
            </a>
          </li>
          <li>
            <i className="icon-chevron-right"></i>
          </li>
          <li>
            <a href="#">
              <div className="text-tiny">Vendor</div>
            </a>
          </li>
          <li>
            <i className="icon-chevron-right"></i>
          </li>
          <li>
            <div className="text-tiny">Vendor List</div>
          </li>
        </ul>
      </div>

      {/* <!-- vendors-list --> */}
      <div className="wg-box">
        <div className="flex items-center justify-between gap10 flex-wrap">
          <div className="wg-filter flex-grow">
            <form className="form-search">
              <fieldset className="name">
                <input
                  type="text"
                  placeholder="Search here..."
                  className=""
                  name="name"
                  tabIndex={2}
                  value=""
                  aria-required="true"
                  required
                />
              </fieldset>
              <div className="button-submit">
                <button className="" type="submit">
                  <i className="icon-search"></i>
                </button>
              </div>
            </form>
          </div>
        </div>
        <div className="wg-table table-all-category">
          <ul className="table-title flex gap20 mb-14">
            <li>
              <div className="body-title">Vendor</div>
            </li>
            <li>
              <div className="body-title">Vendor ID</div>
            </li>
            <li>
              <div className="body-title">Total Products</div>
            </li>
            <li>
              <div className="body-title">Action</div>
            </li>
          </ul>
          <ul className="flex flex-column">
            {vendors.map(vendor => (
              <li key={vendor._id} className="product-item gap14">
                <div className="image no-bg">
                  <Image
                    width={200}
                    height={200}
                    src={vendor.vendor_logo}
                    alt=""
                  />
                </div>
                <div className="flex items-center justify-between gap20 flex-grow">
                  <div className="name">
                    <a href="product-list.html" className="body-title-2">
                      {vendor.vendor}
                    </a>
                  </div>
                  <div className="body-text">{vendor.vendor_id}</div>
                  <div>
                    <div className="block-tracking">{vendor.totalProducts}</div>
                  </div>
                  <div className="list-icon-function">
                    <div
                      className="item trash"
                      onClick={() => setConfirmDeleteVendor(vendor.vendor)}
                    >
                      <i className="icon-trash-2"></i>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="divider"></div>
        <div className="flex items-center justify-between flex-wrap gap10">
          <div className="text-tiny">Showing 10 entries</div>
          <ul className="wg-pagination">
            <li>
              <a href="#">
                <i className="icon-chevron-left"></i>
              </a>
            </li>
            <li className="active">
              <a href="#">1</a>
            </li>
            <li>
              <a href="#">
                <i className="icon-chevron-right"></i>
              </a>
            </li>
          </ul>
        </div>
      </div>
      {confirmDeleteVendor && (
        <ConfirmDialog
          message={`Are you sure you want to delete vendor "${confirmDeleteVendor}" and all its products?`}
          onCancel={() => setConfirmDeleteVendor(null)}
          onConfirm={async () => {
            try {
              await axios.delete(
                `${apiUrl}/api/admin/vendor/${encodeURIComponent(
                  confirmDeleteVendor
                )}`,
                {
                  headers: {
                    Authorization: process.env.NEXT_PUBLIC_ADMIN_SECRET || '',
                  },
                }
              );
              setConfirmDeleteVendor(null);
              fetchVendors();
            } catch (error) {
              console.error('Failed to delete vendor:', error);
              alert('Error deleting vendor.');
            }
          }}
        />
      )}
    </>
  );
};

export default VendorsListsPage;
