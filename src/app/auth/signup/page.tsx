'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

export default function SignupPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agree, setAgree] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!agree) {
      setError('You must agree to the Privacy Policy.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!firstName || !lastName || !email || !password) {
      setError('All fields are required.');
      return;
    }

    setLoading(true);
    try {
      // Adjust this URL as needed!
      const apiUrl =
        process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
        'http://localhost:5000';

      const res = await fetch(`${apiUrl}/api/auth/admin/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      setSuccess('Registration successful! You can login now.');
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setAgree(false);
    } catch  {
      setError( 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wrap-login-page sign-up">
      <div className="flex-grow flex flex-column justify-center gap30">
        <Link href="/" id="site-logo-inner" />
        <div className="login-box">
          <div>
            <h3>Create your account</h3>
            <div className="body-text">
              Enter your personal details to create account
            </div>
          </div>
          <form
            className="form-login flex flex-column gap24"
            onSubmit={handleSubmit}
          >
            <fieldset className="name">
              <div className="body-title mb-10">
                Your username <span className="tf-color-1">*</span>
              </div>
              <div className="flex gap10">
                <input
                  className="flex-grow"
                  type="text"
                  placeholder="First name"
                  name="firstName"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                />
                <input
                  className="flex-grow"
                  type="text"
                  placeholder="Last name"
                  name="lastName"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                />
              </div>
            </fieldset>
            <fieldset className="email">
              <div className="body-title mb-10">
                Email address <span className="tf-color-1">*</span>
              </div>
              <input
                className="flex-grow"
                type="email"
                placeholder="Enter your email address"
                name="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
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
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </fieldset>
            <fieldset className="password">
              <div className="body-title mb-10">
                Confirm password <span className="tf-color-1">*</span>
              </div>
              <input
                className="password-input"
                type="password"
                placeholder="Confirm your password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </fieldset>
            <div className="flex justify-between items-center">
              <div className="flex gap10">
                <input
                  type="checkbox"
                  id="signed"
                  checked={agree}
                  onChange={e => setAgree(e.target.checked)}
                  required
                />
                <label className="body-text" htmlFor="signed">
                  Agree with Privacy Policy
                </label>
              </div>
            </div>
            {error && (
              <div className="text-red-500 text-sm" role="alert">
                {error}
              </div>
            )}
            {success && (
              <div className="text-green-600 text-sm" role="alert">
                {success}
              </div>
            )}
            <button
              type="submit"
              className="tf-button w-full"
              disabled={loading}
            >
              {loading ? 'Signing Up...' : 'Sign Up'}
            </button>
          </form>
          <div className="body-text text-center">
            You have an account?{' '}
            <Link href="/auth/login" className="body-text tf-color">
              Login Now
            </Link>
          </div>
        </div>
      </div>
      <div className="text-tiny">
        Copyright © 2024 reifenhier.de, All rights reserved.
      </div>
    </div>
  );
}
