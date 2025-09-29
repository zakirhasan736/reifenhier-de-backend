'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';

const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';
const apiUrl =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'http://localhost:8001';

const categoryOptions = ['Sommerreifen', 'Winterreifen', 'Ganzjahresreifen'];

const FeatureProductPage = () => {
  const { status } = useSession();
  const [sectionTitle, setSectionTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${apiUrl}/api/products/sessions-products`);
      setSectionTitle(res.data.title || '');
      setSelectedCategory(res.data.category || '');
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async () => {
    try {
      await axios.put(
        `${apiUrl}/api/products/sessions-settings`,
        {
          section_title: sectionTitle,
          category: selectedCategory,
        },
        {
          headers: {
            Authorization: adminSecret,
          },
        }
      );
      alert('Featured settings updated successfully.');
      setEditMode(false);
    } catch (err) {
      console.error('Failed to update settings:', err);
      alert('Update failed.');
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSettings();
    }
  }, [status]);

  if (loading) return <p>Loading...</p>;

  return (
    <>
      <div className="flex items-center flex-wrap justify-between gap20 mb-27">
        <h3>Change Feature Product</h3>
        <ul className="breadcrumbs flex items-center flex-wrap justify-start gap10">
          <li>
            <a href="#">
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
            <div className="text-tiny">Product Feature</div>
          </li>
        </ul>
      </div>

      <div className="wg-box max-w-1/2">
        <div className="wg-table">
          {!editMode ? (
            <>
              <div className="mb-12">
                <h4 className="body-title mb-2">Current Feature Title:</h4>
                <p className="text-mono-100">{sectionTitle}</p>
              </div>
              <div className="mb-6">
                <h4 className="body-title mb-2">Current Category:</h4>
                <p className="text-mono-100">{selectedCategory}</p>
              </div>
              <button
                className="tf-button ml-auto mt-24"
                onClick={() => setEditMode(true)}
              >
                Edit Settings
              </button>
            </>
          ) : (
            <form
              onSubmit={e => {
                e.preventDefault();
                updateSettings();
              }}
            >
              <fieldset className="name mb-24">
                <div className="body-title mb-10">
                  Edit Feature Section Title:
                </div>
                <input
                  type="text"
                  placeholder="Feature section title"
                  name="sectionTitle"
                  value={sectionTitle}
                  onChange={e => setSectionTitle(e.target.value)}
                  required
                />
              </fieldset>

              <div className="wrap-checkbox mb-10">
                <div className="body-title mb-10">Select Feature Category:</div>
                <ul className="table-title flex gap20 mb-14">
                  {categoryOptions.map(cat => (
                    <li key={cat} className="countries-item">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="checkbox-item"
                          checked={selectedCategory === cat}
                          onChange={() => setSelectedCategory(cat)}
                        />
                        <div className="body-text">{cat}</div>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  className="tf-button bg-gray-300 text-black"
                  onClick={() => setEditMode(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="tf-button">
                  Save Changes
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default FeatureProductPage;
