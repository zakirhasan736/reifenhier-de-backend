'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface FAQ {
  _id: string;
  question: string;
  answer: string;
}

const apiUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8001';

const SettingsPage = () => {
  const { status } = useSession();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [editing, setEditing] = useState<FAQ | null>(null);
  const [form, setForm] = useState({ question: '', answer: '' });
  const [loading, setLoading] = useState(true);

  const fetchFAQs = async () => {
    try {
      const res = await axios.get(`${apiUrl}/api/faq/faqs-lists`);
      setFaqs(res.data);
    } catch (error) {
      console.error('Error fetching FAQs', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') fetchFAQs();
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== 'authenticated') return;

    try {
      if (editing) {
        await axios.put(`${apiUrl}/api/faq/${editing._id}`, form);
      } else {
        await axios.post(`${apiUrl}/api/faq/add-faq`, form);
      }

      setForm({ question: '', answer: '' });
      setEditing(null);
      fetchFAQs();
    } catch (error) {
      console.error('Error saving FAQ:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    if (status !== 'authenticated') return;

    try {
      await axios.delete(`${apiUrl}/api/faq/delete/${id}`);
      fetchFAQs();
    } catch (error) {
      console.error('Error deleting FAQ:', error);
    }
  };

  if (loading) return <p>Loading FAQs...</p>;

  return (
    <>
      <div className="flex items-center flex-wrap justify-between gap20 mb-27">
        <h3>Site MISC Settings</h3>
        <ul className="breadcrumbs flex items-center flex-wrap justify-start gap10">
          <li>
            <Link href="/dashboard">
              <div className="text-tiny">Dashboard</div>
            </Link>
          </li>
          <li>
            <i className="icon-chevron-right"></i>
          </li>
          <li>
            <div className="text-tiny">Settings</div>
          </li>
        </ul>
      </div>

      <div className="wg-box !flex !flex-row justify-between gap20">
        <div className="left max-w-2/5 w-full">
          <h5 className="mb-4">FAQ Accordion</h5>
          <div className="body-text">Manage FAQ entries below</div>
          <h6 className="text-2xl font-bold mb-12 mt-24">
            {editing ? 'Edit FAQ' : 'Add New FAQ'}
          </h6>

          <form onSubmit={handleSubmit} className="mb-6 space-y-4">
            <fieldset className="name mb-24">
              <input
                className=""
                type="text"
                placeholder="Question"
                value={form.question}
                onChange={e => setForm({ ...form, question: e.target.value })}
                tabIndex={0}
                aria-required="true"
                required
                name='question'
              />
            </fieldset>
           
            <fieldset className="description mb-24">
              <textarea
                className=""
                name="answer"
                placeholder="Answer"
                value={form.answer}
                onChange={e => setForm({ ...form, answer: e.target.value })}
                tabIndex={0}
                aria-required="true"
                required
              />
            </fieldset>
            <div className="flex gap-2 !mt-8">
              <button type="submit" className="tf-button px-4 py-2">
                {editing ? 'Update FAQ' : 'Create FAQ'}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setForm({ question: '', answer: '' });
                  }}
                  className="tf-button px-4 py-2"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="right flex-grow w-full max-w-3/5">
          <div className="p-6 mx-auto">
            <h6 className="text-2xl font-bold mt-24 mb-12">FAQs List</h6>
            <ul className="space-y-4">
              {faqs.map(faq => (
                <li
                  key={faq._id}
                  className="border p-4 rounded mb-12 !flex items-baseline justify-between !gap-2"
                >
                  <div className="cont-box">
                    <h6 className="font-semibold !mb-3">{faq.question}</h6>
                    <p className="text-sm text-gray-700">{faq.answer}</p>
                  </div>
                  <div className="!pt-6 flex !gap-2">
                    <button
                      onClick={() => {
                        setEditing(faq);
                        setForm({
                          question: faq.question,
                          answer: faq.answer,
                        });
                      }}
                      className="!text-[17px] !p-4"
                    >
                      <i className="icon-edit-3"></i>
                    </button>
                    <button
                      onClick={() => handleDelete(faq._id)}
                      className="!text-[17px] !p-4"
                    >
                      <i className="icon-trash-2"></i>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsPage;
{/* <div className="list-icon-function">
  <div className="item eye">
    <i className="icon-eye"></i>
  </div>
  <div className="item edit">
    <i className="icon-edit-3"></i>
  </div>
  <div className="item trash">
    <i className="icon-trash-2"></i>
  </div>
</div>; */}