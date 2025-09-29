'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import ConfirmDialog from '@/components/share/ConfirmDialog'; // adjust path

import Image from 'next/image';
import Link from 'next/link';

interface offer{
vendor:string;
}
interface Product {
  _id: string;
  product_name: string;
  merchant_product_third_category: string;
  product_image: string;
  search_price: number;
  status: number;
  brand_name: string;
  vendor_name: string;
  in_stock: string;
  createdAt: string;
  offers: offer[];
}

const apiUrl =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'http://localhost:8001';

const BrandProductListPage = () => {
   const {  status } = useSession();
  const { brand } = useParams() as { brand: string };
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const limit = 10;

  const fetchBrandProducts = async () => {
    if (status === 'authenticated') {
      try {
        const res = await axios.get(
          `${apiUrl}/api/admin/brand-lists/${brand}`,
          {
            params: { page, limit },
          }
        );
        console.log('test data', res.data.products);
        setProducts(res.data.products);
        setTotal(res.data.total);
      } catch (error) {
        console.error('Failed to fetch products by brand:', error);
      }
    }
  };

  useEffect(() => {
    if (brand) fetchBrandProducts();
  }, [status, brand, page]);
  

  
  const totalPages = Math.ceil(total / limit);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) setPage(newPage);
  };

  return (
    <div className="brand-products-page">
      <div className="flex justify-between items-center mb-6">
        <h3>Brand: {decodeURIComponent(brand)}</h3>
        <ul className="breadcrumbs flex items-center gap-2">
          <li>
            <a href="/dashboard">Dashboard</a>
          </li>
          <li>
            <i className="icon-chevron-right" />
          </li>
          <li>
            <a href="/dashboard">Brands</a>
          </li>
          <li>
            <i className="icon-chevron-right" />
          </li>
          <li>
            <span>{brand}</span>
          </li>
        </ul>
      </div>

      <>
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
                <div className="body-title">Product Category</div>
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
                      src={product.product_image}
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
                    <div className="body-text">€ {product.search_price}</div>
                    <div className="body-text">{product.offers[0]?.vendor}</div>
                    <div className="block-not-available">
                      {product.in_stock === 'true' ? 'In Stock' : 'Out of Stock'}
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
            <ul className="wg-pagination">
              <li>
                <Link href="" onClick={() => handlePageChange(page - 1)}>
                  <i className="icon-chevron-left"></i>
                </Link>
              </li>
              {Array.from({ length: totalPages }, (_, i) => (
                <li key={i} className={page === i + 1 ? 'active' : ''}>
                  <Link href="" onClick={() => handlePageChange(i + 1)}>
                    {i + 1}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="" onClick={() => handlePageChange(page + 1)}>
                  <i className="icon-chevron-right"></i>
                </Link>
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
                fetchBrandProducts();
              } catch (error) {
                console.error('Failed to delete product:', error);
              }
            }}
          />
        )}
      </>
    </div>
  );
};

export default BrandProductListPage;
