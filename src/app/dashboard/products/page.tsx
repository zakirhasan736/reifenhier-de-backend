'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import ConfirmDialog from '@/components/share/ConfirmDialog';

interface Offer {
  brand: string;
  vendor_logo: string;
  vendor: string;
  brand_name: string;
  product_category: string;
  product_name: string;
  price: number;
  affiliate_product_cloak_url: string;
  aw_deep_link: string;
  savings_percent: string;
  delivery_cost: string | number; // ← Adjusted for flexibility (string or number)
  delivery_time: string;
  payment_icons: string[];
  original_affiliate_url: string;
}

interface CheapestVendor {
  aw_deep_link: string;
  delivery_cost: string | number; // ← Adjusted here too
  payment_icons: string[];
  vendor: string;
  affiliate_product_cloak_url: string;
  vendor_id: string;
  vendor_logo: string;
}

interface Product {
  _id: string;
  slug: string;
  product_name: string;
  brand_name: string;
  product_image: string;
  dimensions: string;
  search_price: number;
  fuel_class: string;
  wet_grip: string;
  noise_class: string;
  in_stock: string;
  delivery_time: string;
  review_count: number;
  average_rating: number;
  cheapest_offer: number;
  expensive_offer: number;
  savings_percent: string;
  related_cheaper: Product[];
  cheapest_vendor: CheapestVendor;
  ean: string;
  product_url: string;
  brand_logo?: string;
  merchant_product_third_category?: string;
  descriptions?: string;
  description?: string;
  width?: string;
  height?: string;
  diameter?: string;
  lastIndex?: string;
  speedIndex?: string;
  offers?: Offer[];
  createdAt: string;
}


const apiUrl =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'http://localhost:8001';

  const ProductPage: React.FC = () => {
    const { status } = useSession();
    const [products, setProducts] = useState<Product[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const limit = 12;
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const fetchProducts = async () => {
      if (status === 'authenticated') {
        try {
          const res = await axios.get(`${apiUrl}/api/admin/product-lists`, {
            params: { page, limit },
          });
          console.log('test data', res.data.products);
          setProducts(res.data.products);
          setTotal(res.data.total);
        } catch (err) {
          console.error('Error fetching products:', err);
        }
      }
    };

    useEffect(() => {
      fetchProducts();
    }, [status, page]);

    const totalPages = Math.ceil(total / limit);

    const handlePageChange = (newPage: number) => {
      if (newPage > 0 && newPage <= totalPages) setPage(newPage);
    };
    return (
      <>
        <div className="flex items-center flex-wrap justify-between gap20 mb-27">
          <h3>Product List</h3>
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
                <div className="text-tiny">Products</div>
              </a>
            </li>
            <li>
              <i className="icon-chevron-right"></i>
            </li>
            <li>
              <div className="text-tiny">Product Lists</div>
            </li>
          </ul>
        </div>

        {/* <!-- product-list --> */}
        <div className="wg-box">
          <div className="title-box">
            <i className="icon-coffee"></i>
            <div className="body-text">
              Tip search by Product ID: Each product is provided with a unique
              ID, which you can rely on to find the exact product you need.
            </div>
          </div>

          <div className="flex items-center justify-between gap10 flex-wrap">
            <div className="wg-filter flex-grow">
              <form className="form-search">
                <fieldset className="name">
                  <input
                    type="text"
                    placeholder="Search here..."
                    name="name"
                    tabIndex={2}
                    required
                    aria-required="true"
                    className=""
                  />
                </fieldset>
                <div className="button-submit">
                  <button type="submit" className="">
                    <i className="icon-search"></i>
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="wg-table table-product-list">
            <ul className="table-title flex gap20 mb-14">
              <li>
                <div className="body-title">Product</div>
              </li>
              <li>
                <div className="body-title">Product ID</div>
              </li>
              <li>
                <div className="body-title">Category</div>
              </li>
              <li>
                <div className="body-title">Price</div>
              </li>
              <li>
                <div className="body-title">Vendor</div>
              </li>
              <li>
                <div className="body-title">Stock</div>
              </li>
              <li>
                <div className="body-title">Date</div>
              </li>
              <li>
                <div className="body-title">Action</div>
              </li>
            </ul>

            <ul className="flex flex-column">
              {/* Example product row (repeat as needed) */}
              {products.map(product => (
                <li className="product-item gap14" key={product._id}>
                  <div className="image no-bg">
                    <Image
                      src={product.product_image || '/images/placeholder.png'}
                      alt={product.product_name}
                      width={200}
                      height={200}
                      className="mb-2 object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between gap20 flex-grow">
                    <div className="name">
                      <Link href="" className="body-title-2">
                        {product.product_name}
                      </Link>
                    </div>
                    <div className="body-text">{product._id}</div>
                    <div className="body-text">
                      {product.merchant_product_third_category}
                    </div>
                    <div className="body-text">
                      €{' '}
                      {typeof product.search_price === 'number'
                        ? product.search_price.toFixed(2)
                        : '—'}
                    </div>
                    <div className="body-text">
                      {product.offers?.[0]?.vendor ?? '—'}
                    </div>
                    <div className="block-not-available">
                      {product.in_stock === 'true'
                        ? 'In Stock'
                        : 'Out of Stock'}
                    </div>
                    <div className="body-text">
                      {product.createdAt
                        ? new Date(product.createdAt).toLocaleDateString()
                        : ''}
                    </div>
                    <div className="list-icon-function">
                      <div
                        className="item trash"
                        onClick={() => setConfirmDeleteId(product._id)}
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
          <div className="flex items-center justify-between flex-wrap gap10 mt-24">
            <div className="text-tiny">
              Showing page {page} of {totalPages}
            </div>
            <ul className="wg-pagination flex items-center gap-2">
              {/* Previous Button */}
              <li>
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-2 py-1"
                >
                  <i className="icon-chevron-left"></i>
                </button>
              </li>

              {/* Page Numbers */}
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                const showPage =
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  Math.abs(pageNum - page) <= 2;

                if (pageNum === 2 && page > 4) {
                  return (
                    <li key="start-ellipsis" className="px-2 py-1">
                      ...
                    </li>
                  );
                }

                if (pageNum === totalPages - 1 && page < totalPages - 3) {
                  return (
                    <li key="end-ellipsis" className="px-2 py-1">
                      ...
                    </li>
                  );
                }

                if (!showPage) return null;

                return (
                  <li key={pageNum}>
                    <button
                      onClick={() => handlePageChange(pageNum)}
                      className={`!px-5 !py-4 ${
                        page === pageNum
                          ? 'bg-blue-600 text-white !rounded-full'
                          : ''
                      }`}
                    >
                      {pageNum}
                    </button>
                  </li>
                );
              })}

              {/* Next Button */}
              <li>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="px-2 py-1"
                >
                  <i className="icon-chevron-right"></i>
                </button>
              </li>
            </ul>
          </div>
        </div>
        {confirmDeleteId && (
          <ConfirmDialog
            message="Are you sure you want to delete this product?"
            onCancel={() => setConfirmDeleteId(null)}
            onConfirm={async () => {
              try {
                await axios.delete(
                  `${apiUrl}/api/admin/product/${confirmDeleteId}`
                );
                setConfirmDeleteId(null);
                fetchProducts();
              } catch (error) {
                console.error('Failed to delete product:', error);
              }
            }}
          />
        )}
      </>
    );
  };

export default ProductPage;
