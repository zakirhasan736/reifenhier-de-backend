'use client';

import AuthProvider from '@utils/AuthProvider';


export default function Template({ children }: { children: React.ReactNode }) {

  return (
    <AuthProvider>
      <main>{children}</main>
    </AuthProvider>
  );
}
