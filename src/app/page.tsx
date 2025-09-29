'use client';
import { signIn, useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // const [setError] = useState('');

  const { status } = useSession();
  const router = useRouter();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // setError('');
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    if (res && res.error)
    if (res && res.ok) router.replace('/dashboard');
  };

  // Show nothing or a spinner while redirecting
  if (status === 'authenticated') {
    return null;
  }


  return (
    <div className="wrap-login-page">
      <div className="flex-grow flex flex-column justify-center gap30">
        <div className="login-box">
          <div>
            <h3>Login to account</h3>
            <div className="body-text">
              Enter your email & password to login
            </div>
          </div>
          <form
            className="form-login flex flex-column gap24"
            onSubmit={handleSubmit}
          >
            <fieldset className="email">
              <div className="body-title mb-10">
                Email address <span className="tf-color-1">*</span>
              </div>
              <input
                className="flex-grow"
                type="email"
                placeholder="Enter your email address"
                name="email"
                tabIndex={0}
                value={email}
                onChange={e => setEmail(e.target.value)}
                aria-required="true"
                required
              />
            </fieldset>
            <fieldset className="password">
              <div className="body-title mb-10">
                Password <span className="tf-color-1">*</span>
              </div>
              <input
                className="password-input"
                type="password"
                placeholder="Enter your password"
                name="password"
                tabIndex={0}
                value={password}
                onChange={e => setPassword(e.target.value)}
                aria-required="true"
                required
              />
              <span className="show-pass">
                <i className="icon-eye view"></i>
                <i className="icon-eye-off hide"></i>
              </span>
            </fieldset>
            <div className="flex justify-between items-center">
              <div className="flex gap10">
                {/* <input
                  type="checkbox"
                  id="signed"
                  checked={keepSignedIn}
                  onChange={e => setKeepSignedIn(e.target.checked)}
                />
                <label className="body-text" htmlFor="signed">
                  Keep me signed in
                </label> */}
              </div>
              <a href="#" className="body-text tf-color">
                Forgot password?
              </a>
            </div>
            <button type="submit" className="tf-button w-full">
              Login
            </button>
          </form>
          <div className="body-text text-center">
            You don&apos;t have an account yet?{' '}
            <a href="/auth/signup" className="body-text tf-color">
              Register Now
            </a>
          </div>
        </div>
      </div>
      <div className="text-tiny">
        Copyright © 2025 reifenhier.de. Developed by{' '}
        <a href="www.webdevzakir.tech">webdevzakir</a> All rights reserved
        reserved.
      </div>
    </div>
  );
}
