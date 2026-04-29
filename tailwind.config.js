/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/renderer/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
    theme: {
        extend: {
            colors: {
                bg: {
                    primary: '#0f0f0f',
                    secondary: '#1a1a1a',
                    tertiary: '#252525',
                },
                border: {
                    DEFAULT: '#333333',
                },
                accent: {
                    DEFAULT: '#6366f1',
                    hover: '#818cf8',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
        },
    },
    plugins: [],
};
