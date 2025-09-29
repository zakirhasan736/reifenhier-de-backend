'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';

interface BrandGroup {
  brand_name: string;
  brand_logo: string;
  totalProducts: number;
}

const apiUrl =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'http://localhost:8001';

const BrandListsPage = () => {
  const {  status } = useSession();
  const [brands, setBrands] = useState<BrandGroup[]>([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalBrands, setTotalBrands] = useState(0);
  const limit = 24;

  const fetchBrandData = async () => {
    if (status === 'authenticated') {
      try {
        const res = await axios.get(`${apiUrl}/api/admin/brand-lists`, {
          params: { page, limit },
        });
        console.log('test data' , res.data.brands)
        setBrands(res.data.brands);
        setTotalBrands(res.data.totalBrands);
      } catch (err) {
        console.error('Failed to fetch brands:', err);
        setError('Failed to load brand data.');
      }
    }
  };

  useEffect(() => {
    fetchBrandData();
  }, [status, page]);

  const totalPages = Math.ceil(totalBrands / limit);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) setPage(newPage);
  };

  if (status === 'loading') return <p>Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <>
      <div className="flex items-center flex-wrap justify-between gap20 mb-27">
        <h3>All Brand</h3>
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
            <div className="text-tiny">Brand</div>
          </li>
        </ul>
      </div>
      {/* <!-- all-gallery --> */}
      <div className="all-gallery-wrap">
        <div className="wg-box left flex-grow">
          <div className="flex items-center justify-between gap10 flex-wrap">
            <form className="form-search w286">
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
          <div className="wrap-title flex items-center justify-between gap20 flex-wrap">
            <div className="body-title">File</div>
            <div className="flex items-center gap20">
              <div className="grid-list-style">
                <div className="button-grid-style">
                  <i className="icon-grid"></i>
                </div>
              </div>
            </div>
          </div>
          <div className="wrap-gallery-item">
            {brands.map((brand, index) => (
              <Link
                key={index}
                href={`/dashboard/brand/${encodeURIComponent(
                  brand.brand_name
                )}`}
                className="gallery-item"
              >
                <div className="image">
                  {brand.brand_logo ? (
                    <Image
                      src={brand.brand_logo}
                      alt={brand.brand_name}
                      width={152}
                      height={152}
                    />
                  ) : (
                    <div className="brand-title bg-gray-200 p-4 text-center">
                      {brand.brand_name}
                    </div>
                  )}
                </div>
                <h4 className="body-title">{brand.brand_name}</h4>
                <p className="text-tiny">{brand.totalProducts} Products</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="divider"></div>
      <div className="flex items-center justify-between flex-wrap gap10 mt-24">
        <div className="text-tiny">
          Showing page {page} of {totalPages}
        </div>
        <ul className="wg-pagination">
          <li>
            <a onClick={() => handlePageChange(page - 1)}>
              <i className="icon-chevron-left"></i>
            </a>
          </li>
          {Array.from({ length: totalPages }, (_, i) => (
            <li key={i} className={page === i + 1 ? 'active' : ''}>
              <button type='button' onClick={() => handlePageChange(i + 1)}>{i + 1}</button>
            </li> 
          ))}
          <li>
            <a onClick={() => handlePageChange(page + 1)}>
              <i className="icon-chevron-right"></i>
            </a>
          </li>
        </ul>
      </div>
      {/* <!-- /all-brands --> */}
    </>
  );
};

export default BrandListsPage;
