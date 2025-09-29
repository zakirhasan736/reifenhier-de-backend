import { useEffect, useState } from 'react';

export default function AwinImportStatusWidget() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const apiUrl =
    process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
    'http://localhost:5000';
  const fetchStatus = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/products/import/status`);
      const data = await res.json();
      console.log(data);
      setStatus(data);
    } catch (err) {
      setError('Failed to fetch status.');
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (error) return <div className="text-red-600">{error}</div>;
  if (!status) return <div>Loading AWIN import status...</div>;

  return (
    <div className="p-4 rounded-2xl shadow-md bg-white border border-gray-200">
      <h6 className="text-xl font-semibold !mb-4">AWIN Import Status</h6>
      <div className="grid grid-cols-2 !gap-x-8 border p-4 border-gray-200 !gap-y-4 text-sm">
        <Stat label="Running" value={status.running ? 'Yes' : 'No'} />
        <Stat label="Progress" value={`${status.progress}%`} />
        <Stat label="Imported" value={status.imported} />
        <Stat label="Updated" value={status.updated} />
        <Stat label="Skipped" value={status.skipped} />
        <Stat label="Deleted" value={status.deleted} />
        <Stat
          label="Invalid Vendor"
          value={status.skipReasons?.invalidVendor || 0}
        />
        <Stat
          label="Invalid 2nd Cat."
          value={status.skipReasons?.invalidSecondCategory || 0}
        />
        <Stat
          label="Missing 3rd Cat."
          value={status.skipReasons?.missingThirdCategory || 0}
        />
      </div>
      <br />
      {status.error && (
        <div className="text-red-500 mt-3 text-sm">Error: {status.error}</div>
      )}

      <div className="mt-3 text-xs text-gray-500 border p-4 border-gray-200">
        Started: {new Date(status.startedAt).toLocaleString()}
        <br />
        <br />
        Finished:{' '}
        {status.finishedAt
          ? new Date(status.finishedAt).toLocaleString()
          : 'In progress'}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="font-medium text-gray-600">{label}:</span>
      <span>{value}</span>
    </div>
  );
}
