'use client';
import { useRef, useState } from 'react';
import AwinImportStatusWidget from '@elements/AwinImportStatusWidget';

const AddProductPage = () => {
  const fileRef = useRef();
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const apiUrl =
    process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
    'http://localhost:5000';

  // Progress polling for import status
  const poll = () => {
    setPolling(true);
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${apiUrl}/api/products/upload-csv-progress`);
        const data = await res.json();
        console.log('data progress', data)
        setProgress(data.progress || 0);
        if (data.done || data.error) {
          setPolling(false);
          setMsg(
            data.error
              ? 'Error: ' + data.error
              : `Imported: ${data.imported || 0}, Skipped: ${data.skipped || 0}`
          );
          clearInterval(timer);
        }
      } catch (err) {
        setMsg('Progress error: ' + err.message);
        setPolling(false);
        clearInterval(timer);
      }
    }, 1000);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setMsg('');
    setProgress(0);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', fileRef.current.files[0]);

    try {
      const res = await fetch(`${apiUrl}/api/products/upload-csv`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setMsg(
        data.success ? 'CSV imported! Importing...' : data.error || 'Failed'
      );
      if (data.success) poll();
    } catch (err) {
      setMsg('Error: ' + err.message);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center flex-wrap justify-between gap20 mb-27">
        <h3>Add new Product</h3>
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
              <div className="text-tiny">Ecommerce</div>
            </a>
          </li>
          <li>
            <i className="icon-chevron-right"></i>
          </li>
          <li>
            <div className="text-tiny">Create Product</div>
          </li>
        </ul>
      </div>
      <div className="themesflat-container full">
        <div className="row">
          <div className="col-xl-4 mb-20">
            <div className="wg-box h-full">
              <form onSubmit={handleUpload}>
                <input type="file" accept=".csv" ref={fileRef} required />
                <button type="submit" disabled={loading || polling}>
                  {loading || polling ? 'Uploading...' : 'Upload CSV'}
                </button>
                {polling && (
                  <div>
                    <progress
                      value={progress}
                      max={100}
                      style={{ width: 200 }}
                    />
                    <span> {progress}%</span>
                  </div>
                )}
                {msg && <div>{msg}</div>}
              </form>
            </div>
          </div>
        </div>
      </div>
      <AwinImportStatusWidget />
    </>
  );
};

export default AddProductPage;