/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#001f3f', // Navy Blue
                secondary: '#003366', // Lighter Navy
                accent: '#3949ab',    // Indigo
                success: '#43a047',   // Green
                danger: '#d81b60',    // Pink/Red for expenses
                surface: {
                    ground: '#f4f6f9',
                    card: '#ffffff',
                    hover: '#f8f9fa'
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
