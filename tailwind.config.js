/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // Also include SDK source so sw- prefixed classes are generated
    '../src/**/*.{js,ts,jsx,tsx}',
  ],
  prefix: '',
  theme: { extend: {} },
  plugins: [],
};
