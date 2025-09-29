'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import Image from 'next/image';
interface Blog {
  _id: string;
  title: string;
  slug: string;
  coverImage: string;
  createdAt?: string;
}

const apiUrl =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'http://localhost:8001';

const BlogsListsPage = () => {
  const [blogs, setBlogs] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const fetchBlogs = async () => {
    try {
      const res = await axios.get(`${apiUrl}/api/blogs/list`, {
        params: { page, limit, search },
      });
      console.log(res.data);
      setBlogs(res.data.blogs);
      setTotal(res.data.total);
    } catch (error) {
      console.error('Error fetching blogs:', error);
    }
  };

  useEffect(() => {
    fetchBlogs();
  }, [page, search]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this blog?')) return;
    try {
      await axios.delete(`${apiUrl}/api/blogs/delete/${id}`);
      fetchBlogs();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };
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
              <div className="text-tiny">Blogs</div>
            </a>
          </li>
          <li>
            <i className="icon-chevron-right"></i>
          </li>
          <li>
            <div className="text-tiny">Blogs Lists</div>
          </li>
        </ul>
      </div>

      {/* <!-- product-list --> */}
      <div className="wg-box">
        <div className="title-box">
          <i className="icon-coffee"></i>
          <div className="body-text">
            Tip search by Product ID: Each product is provided with a unique ID,
            which you can rely on to find the exact product you need.
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
                  value={search}
                  onChange={e => setSearch(e.target.value)}
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
              <div className="body-title">Blogs</div>
            </li>
            <li>
              <div className="body-title">Blog ID</div>
            </li>
            <li>
              <div className="body-title">Slug</div>
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
            {blogs.map((blog: Blog) => (
              <li className="product-item gap14" key={blog._id}>
                <div className="image no-bg">
                  <Image
                    src={blog.coverImage}
                    alt={blog.title}
                    width={200}
                    height={200}
                    className="mb-2 object-contain"
                  />
                </div>
                <div className="flex items-center justify-between gap20 flex-grow">
                  <div className="name">
                    <Link href="" className="body-title-2">
                      {blog.title}
                    </Link>
                  </div>
                  <div className="body-text">{blog._id}</div>
                  <div className="body-text">{blog.slug}</div>
                  <div className="body-text">
                    {blog.createdAt
                      ? new Date(blog.createdAt).toLocaleDateString()
                      : ''}
                  </div>
                  <div className="list-icon-function">
                    <Link href={`/dashboard/blogs/${blog._id}`}>
                      <div className="item edit">
                        <i className="icon-edit-3"></i>
                      </div>
                    </Link>
                    <div
                      className="item trash"
                      onClick={() => handleDelete(blog._id)}
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
    </>
  );
};

export default BlogsListsPage;
