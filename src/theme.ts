'use client';
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        mode: 'dark'
    },
    typography: {
        fontFamily: 'var(--font-roboto)',
    },
    cssVariables: true
});

export default theme;
